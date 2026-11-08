import type Database from 'better-sqlite3';
import type { GraphMutation } from '../../shared/commands/types';
import { proposalsChanged } from './events';
import { listProposals } from './store';

/** Node ids a mutation points at. A proposal that points at a node that is gone cannot apply as meant. */
export function nodeRefsOf(payload: GraphMutation): string[] {
  switch (payload.type) {
    case 'connect': return [payload.source, payload.target];
    case 'set-parameter':
    case 'remove-node':
    case 'annotate-node':
    case 'move-node':
    case 'dissolve-subgraph':
      return [payload.nodeId];
    case 'retarget-edge': return [payload.target];
    case 'create-subgraph':
    case 'add-group':
      return payload.nodeIds;
    default: return [];
  }
}

/**
 * Best effort, inside the commit transaction: mark open proposals superseded when a commit removed a node
 * they reference. Runs in the same transaction, so a rolled-back commit leaves them open.
 */
export function supersedeForMissingNodes(db: Database.Database, projectId: string, nodeIds: string[], cause: string): number {
  const gone = new Set(nodeIds);
  const rows = db
    .prepare(`SELECT id, payload, note FROM proposals WHERE project_id = ? AND status = 'proposed'`)
    .all(projectId) as Array<{ id: string; payload: string; note: string }>;
  const now = Date.now();
  const update = db.prepare(`UPDATE proposals SET status = 'superseded', note = ?, resolved_at = ? WHERE id = ?`);
  let count = 0;
  for (const row of rows) {
    let payload: GraphMutation;
    try {
      payload = JSON.parse(row.payload) as GraphMutation;
    } catch {
      continue;
    }
    const missing = nodeRefsOf(payload).filter((id) => gone.has(id));
    if (missing.length === 0) continue;
    update.run(`${row.note}${row.note ? ' ' : ''}[superseded: node ${missing.join(', ')} was removed by ${cause}]`, now, row.id);
    count += 1;
  }
  if (count > 0) {
    // Push after the synchronous commit transaction has finished; if it rolled back, the push shows the unchanged list.
    queueMicrotask(() => {
      try {
        proposalsChanged(projectId, listProposals(db, projectId, 'proposed'));
      } catch {
        // The database may already be closed; the next list call shows the truth.
      }
    });
  }
  return count;
}
