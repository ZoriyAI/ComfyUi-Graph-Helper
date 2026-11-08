import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import type { Proposal, ProposalInput, ProposalKind, ProposalResolution, ResolveProposalRequest } from '../../shared/contracts/proposals';
import { PROPOSAL_KINDS } from '../../shared/contracts/proposals';
import { mutationSchema, type CommandResponse } from '../../shared/commands/types';
import { commitCommand, readProjection } from '../commands/commit';
import { proposalsChanged } from './events';
import { listProposals, readProposal } from './store';

export { listProposals } from './store';
export { setProposalsNotifier, proposalsChanged, type ProposalsNotifier } from './events';

export const PROPOSAL_ERRORS = {
  payload: 'The proposal payload is not a graph change.',
  kind: 'The proposal kind does not match its payload.',
  project: 'Project is not ready.',
  missing: 'Proposal was not found.',
} as const;

export class ProposalError extends Error {}

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
  const kind = input.kind as ProposalKind;
  if (!PROPOSAL_KINDS.includes(kind) || parsed.data.type !== kind) throw new ProposalError(PROPOSAL_ERRORS.kind);
  const projection = readProjection(db, input.projectId);
  if (!projection) throw new ProposalError(PROPOSAL_ERRORS.project);
  const proposal: Proposal = {
    id: randomUUID(),
    projectId: input.projectId,
    runId: input.runId ?? null,
    kind,
    status: 'proposed',
    payload: parsed.data,
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

function reasonOf(response: CommandResponse): string {
  const detail = response.result as { error?: unknown } | null;
  if (detail && typeof detail.error === 'string') return detail.error;
  return response.status === 'conflict' ? 'The graph changed before it could apply.' : 'The engine refused the change.';
}

function finish(db: Database.Database, id: string, status: Proposal['status'], note?: string): Proposal {
  if (note === undefined) {
    db.prepare('UPDATE proposals SET status = ?, resolved_at = ? WHERE id = ?').run(status, Date.now(), id);
  } else {
    db.prepare('UPDATE proposals SET status = ?, note = ?, resolved_at = ? WHERE id = ?').run(status, note, Date.now(), id);
  }
  return readProposal(db, id)!;
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
  const command = commitCommand(db, {
    projectId: proposal.projectId,
    actionId: `proposal-${proposal.id}`,
    expectedRevisionId: projection.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload: proposal.payload,
  });
  const resolved = command.status === 'applied' || command.status === 'historical'
    ? finish(db, proposal.id, 'accepted')
    : finish(db, proposal.id, 'superseded', `${proposal.note}${proposal.note ? ' ' : ''}[superseded: ${reasonOf(command)}]`);
  notify(db, proposal.projectId);
  return { proposal: resolved, command };
}
