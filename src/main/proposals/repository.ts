/**
 * Proposals: changes the assistant suggests as dashed "ghosts" on the canvas instead of applying them. This module
 * creates them (agent/buildTools.ts, agent/tools.ts) and resolves them when the person accepts or rejects one
 * (ipc/engineIpc.ts). An accepted ghost goes through the same commitCommand as a manual edit, so undo, history and
 * the engine's checks treat it like the person's own change.
 */
import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import type { Proposal, ProposalInput, ProposalKind, ProposalResolution, ResolveProposalRequest } from '../../shared/contracts/proposals';
import { PROPOSAL_KINDS } from '../../shared/contracts/proposals';
import { mutationSchema, type CommandResponse, type GraphMutation } from '../../shared/commands/types';
import { cachedCatalog, commitCommand, loadRevision, readProjection } from '../commands/commit';
import { placeDraftNode, placeHelperNode } from '../commands/placement';
import { proposalsChanged } from './events';
import { listProposals, readProposal } from './store';
import { nodeRefsOf } from './supersede';

export { listProposals } from './store';
export { setProposalsNotifier, proposalsChanged, type ProposalsNotifier } from './events';

/** The messages a ProposalError carries; tests compare against them. */
export const PROPOSAL_ERRORS = {
  payload: 'The proposal payload is not a graph change.',
  kind: 'The proposal kind does not match its payload.',
  project: 'Project is not ready.',
  missing: 'Proposal was not found.',
} as const;

/** A proposal that cannot be stored or resolved (bad payload, unknown id, no project). */
export class ProposalError extends Error {}

/** Pushes the project's open proposals to the windows. */
function notify(db: Database.Database, projectId: string): void {
  proposalsChanged(projectId, listProposals(db, projectId, 'proposed'));
}

/**
 * Store a ghost. It never touches the graph: the payload is validated and kept as data.
 * The proposal is pinned to the project's current revision, whatever the caller passed.
 */
export function createProposal(
  db: Database.Database,
  input: Omit<ProposalInput, 'revisionId'> & { revisionId?: string },
): Proposal {
  const parsed = mutationSchema.safeParse(input.payload);
  if (!parsed.success) throw new ProposalError(PROPOSAL_ERRORS.payload);
  // The declared kind must be the payload's own type, so a list filtered by kind never shows a different change.
  const kind = input.kind as ProposalKind;
  if (!PROPOSAL_KINDS.includes(kind) || parsed.data.type !== kind) throw new ProposalError(PROPOSAL_ERRORS.kind);
  const projection = readProjection(db, input.projectId);
  if (!projection) throw new ProposalError(PROPOSAL_ERRORS.project);
  // A draft of a node is drawn where it covers no node and no other open draft.
  const payload = parsed.data.type === 'add-node'
    ? placeDraftNode(parsed.data, projection.snapshot.nodes as Array<Record<string, any>>, openDrafts(db, input.projectId), cachedCatalog(db))
    : parsed.data;
  const proposal: Proposal = {
    id: randomUUID(),
    projectId: input.projectId,
    runId: input.runId ?? null,
    kind,
    status: 'proposed',
    payload,
    note: typeof input.note === 'string' ? input.note.slice(0, 2000) : '',
    revisionId: projection.currentRevisionId,
    createdAt: Date.now(),
    resolvedAt: null,
  };
  db.prepare(
    `INSERT INTO proposals (id, project_id, run_id, kind, status, payload, note, revision_id, created_at, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).run(proposal.id, proposal.projectId, proposal.runId, proposal.kind, proposal.status, JSON.stringify(proposal.payload), proposal.note, proposal.revisionId, proposal.createdAt);
  notify(db, proposal.projectId);
  return proposal;
}

/** The engine's own words for a refused command, or a plain reason when it gave none. */
function reasonOf(response: CommandResponse): string {
  const detail = response.result as { error?: unknown } | null;
  if (detail && typeof detail.error === 'string') return detail.error;
  return response.status === 'conflict' ? 'The graph changed before it could apply.' : 'The engine refused the change.';
}

/** Closes a proposal with a final status (and a new note when given) and returns it as stored. */
function finish(db: Database.Database, id: string, status: Proposal['status'], note?: string): Proposal {
  if (note === undefined) {
    db.prepare('UPDATE proposals SET status = ?, resolved_at = ? WHERE id = ?').run(status, Date.now(), id);
  } else {
    db.prepare('UPDATE proposals SET status = ?, note = ?, resolved_at = ? WHERE id = ?').run(status, note, Date.now(), id);
  }
  return readProposal(db, id)!;
}

/**
 * Why a proposal no longer fits the graph, or null: the graph was replaced (import or opened project) after it
 * was made, or a node it names is gone or now has a different class type.
 */
function staleReason(db: Database.Database, proposal: Proposal, nodes: Array<Record<string, any>>): string | null {
  // A replacing revision newer than the one the proposal was made on: the whole graph it was meant for is gone.
  const replaced = db
    .prepare(
      `SELECT description FROM graph_revisions
       WHERE project_id = ? AND description IN ('import-workflow', 'open-native')
         AND rev_seq > (SELECT rev_seq FROM graph_revisions WHERE id = ? AND project_id = ?)
       ORDER BY rev_seq DESC LIMIT 1`,
    )
    .get(proposal.projectId, proposal.revisionId, proposal.projectId) as { description: string } | undefined;
  if (replaced) return `the graph was replaced by ${replaced.description}`;
  const refs = [...new Set(nodeRefsOf(proposal.payload))];
  if (refs.length === 0) return null;
  const now = new Map(nodes.map((node) => [String(node.id), node]));
  const gone = refs.filter((id) => !now.has(id));
  if (gone.length > 0) return `node ${gone.join(', ')} is not in the graph`;
  // The node with that id now has another class type (it was replaced), so the change would land on the wrong node.
  const then = loadRevision(db, proposal.projectId, proposal.revisionId);
  if (!then) return null;
  const before = new Map((then.nodes as Array<Record<string, any>>).map((node) => [String(node.id), node]));
  const changed = refs.filter((id) => before.has(id) && before.get(id)!.data?.comfyType !== now.get(id)!.data?.comfyType);
  return changed.length > 0 ? `node ${changed.join(', ')} changed type` : null;
}

/**
 * Layout: an accepted add-node or insert-subgraph ghost lands where the canvas showed it (`at`, a free
 * spot the canvas found with measured sizes). Without a spot (accepted from the chat before the canvas drew it), a position that would
 * cover a node moves to the nearest free one.
 */
function acceptedPayload(db: Database.Database, payload: GraphMutation, at: ResolveProposalRequest['at'], nodes: Array<Record<string, any>>): GraphMutation {
  // A suggested subgraph lands where its ghost was drawn too.
  if (payload.type === 'insert-subgraph') return at ? { ...payload, x: Math.round(at.x), y: Math.round(at.y) } : payload;
  if (payload.type !== 'add-node') return payload;
  // Where the ghost was drawn, when the node at its full size covers nothing there now (an earlier accepted draft
  // may stand there, "Accept all" accepts one after another); else the nearest free spot.
  const asked = at ? { ...payload, x: Math.round(at.x), y: Math.round(at.y) } : payload;
  return placeHelperNode(asked, nodes, [], cachedCatalog(db));
}

/** The open drafts of nodes of a project, to keep a new draft off them. */
function openDrafts(db: Database.Database, projectId: string): Array<Extract<GraphMutation, { type: 'add-node' }>> {
  return listProposals(db, projectId, 'proposed').flatMap((proposal) => (proposal.payload.type === 'add-node' ? [proposal.payload] : []));
}

/**
 * Reject marks the ghost rejected. Accept commits its payload through commitCommand as a manual action
 * `proposal-<id>` against the current revision; a refusal or conflict supersedes the ghost with the reason.
 * A proposal that is no longer open is returned as it is, with no command.
 */
export function resolveProposal(db: Database.Database, request: ResolveProposalRequest): ProposalResolution {
  const proposal = readProposal(db, request.proposalId);
  if (!proposal || proposal.projectId !== request.projectId) throw new ProposalError(PROPOSAL_ERRORS.missing);
  if (proposal.status !== 'proposed') return { proposal, command: null };
  if (request.decision === 'reject') {
    const rejected = finish(db, proposal.id, 'rejected');
    notify(db, proposal.projectId);
    return { proposal: rejected, command: null };
  }
  const projection = readProjection(db, proposal.projectId);
  if (!projection) throw new ProposalError(PROPOSAL_ERRORS.project);
  const stale = staleReason(db, proposal, projection.snapshot.nodes as Array<Record<string, any>>);
  if (stale) {
    const superseded = finish(db, proposal.id, 'superseded', `${proposal.note}${proposal.note ? ' ' : ''}[superseded: ${stale}]`);
    notify(db, proposal.projectId);
    return { proposal: superseded, command: null };
  }
  const command = commitCommand(db, {
    projectId: proposal.projectId,
    actionId: `proposal-${proposal.id}`,
    expectedRevisionId: projection.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload: acceptedPayload(db, proposal.payload, request.at, projection.snapshot.nodes as Array<Record<string, any>>),
  });
  // The proposal's own commit may have marked it superseded (it removed a node it names); accepted wins, note restored.
  const resolved = command.status === 'applied' || command.status === 'historical'
    ? finish(db, proposal.id, 'accepted', proposal.note)
    : finish(db, proposal.id, 'superseded', `${proposal.note}${proposal.note ? ' ' : ''}[superseded: ${reasonOf(command)}]`);
  notify(db, proposal.projectId);
  return { proposal: resolved, command };
}
