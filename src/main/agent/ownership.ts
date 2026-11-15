/**
 * What a build run may change on its own: only what it placed itself in this run. Anything on the person's own
 * nodes, links, notes or the project's name becomes a grey draft the person accepts, so a build never silently
 * rewrites the person's work. Used by agent/buildTools.ts before each change of a build.
 */
import type Database from 'better-sqlite3';
import type { GraphMutation, Projection } from '../../shared/commands/types';
import type { ProposalKind } from '../../shared/contracts';

/** Nodes (and subgraph definitions) this run made: added nodes, inserted subgraphs, subgraphs it made of its nodes. */
export function runOwned(db: Database.Database, projectId: string, runId: string): { nodes: Set<string>; definitions: Set<string>; process: boolean } {
  const nodes = new Set<string>();
  const definitions = new Set<string>();
  let process = false;
  const rows = db
    .prepare(
      `SELECT a.payload_canonical, a.result_json FROM applied_commands a
       JOIN graph_revisions r ON r.id = a.result_revision_id AND r.project_id = a.project_id
       WHERE a.project_id = ? AND a.run_id = ? ORDER BY r.rev_seq`,
    )
    .all(projectId, runId) as Array<{ payload_canonical: string; result_json: string }>;
  for (const row of rows) {
    try {
      const outer = JSON.parse(row.payload_canonical) as { type?: unknown; edit?: { type?: unknown } };
      const payload = outer.type === 'edit-in-subgraph' && outer.edit ? outer.edit : outer;
      const result = JSON.parse(row.result_json) as { nodeId?: unknown; definitionId?: unknown; definitionIds?: unknown; };
      const id = typeof result.nodeId === 'string' || typeof result.nodeId === 'number' ? String(result.nodeId) : null;
      if (outer.type !== 'edit-in-subgraph' && (payload.type === 'insert-blueprint' || payload.type === 'add-node' || payload.type === 'insert-subgraph' || payload.type === 'create-subgraph') && id) nodes.add(id);
      if (payload.type === 'insert-blueprint') {
        if (typeof result.definitionId === 'string') definitions.add(result.definitionId);
        if (Array.isArray(result.definitionIds)) for (const id of result.definitionIds) if (typeof id === 'string') definitions.add(id);
      }
      if (payload.type === 'create-subgraph' && typeof result.definitionId === 'string') definitions.add(result.definitionId);
      if (payload.type === 'set-process') process = true;
    } catch {
      // A row that does not parse names nothing.
    }
  }
  return { nodes, definitions, process };
}

/** The project's name as the graph holds it now, or '' when it has none. */
function processTitle(projection: Projection | null): string {
  const process = projection?.snapshot.process as { title?: unknown } | null | undefined;
  return typeof process?.title === 'string' ? process.title.trim() : '';
}

/**
 * The draft kind a mutation becomes when it would change something the person made, or null when the run may
 * apply it itself.
 */
export function draftKindFor(payload: GraphMutation, owned: ReturnType<typeof runOwned>, projection: Projection | null): ProposalKind | null {
  const mine = (id: string) => owned.nodes.has(String(id));
  switch (payload.type) {
    case 'add-node':
    case 'insert-subgraph':
      return null;
    case 'connect':
      // A link into the person's node changes that node (and may replace a link the person made).
      return mine(payload.target) ? null : 'connect';
    case 'set-parameter':
      return mine(payload.nodeId) ? null : 'set-parameter';
    case 'remove-node':
      return mine(payload.nodeId) ? null : 'remove-node';
    case 'annotate-node':
      return mine(payload.nodeId) ? null : 'annotate-node';
    case 'set-component':
      if (payload.ownerKind === 'node') return mine(payload.ownerId) ? null : 'set-component';
      return owned.definitions.has(payload.ownerId) ? null : 'set-component';
    case 'create-subgraph':
      return payload.nodeIds.every(mine) ? null : 'create-subgraph';
    case 'set-process':
      // The project's name: the run may name a graph that has none, or rename what it named itself.
      return processTitle(projection) === '' || owned.process ? null : 'set-process';
    default:
      return null;
  }
}
