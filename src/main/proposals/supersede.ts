/**
 * Closes open proposals the graph has outgrown. Called by main/commands/commit.ts inside its commit transaction:
 * when a commit removes nodes a proposal names, or when an import or an opened project replaces the whole graph.
 * A superseded proposal keeps its note with the reason in brackets, so the chat and the canvas can say why it closed.
 */
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
      // A row with a broken payload cannot name nodes; it is left as it is.
      continue;
    }
    const missing = nodeRefsOf(payload).filter((id) => gone.has(id));
    if (missing.length === 0) continue;
    update.run(`${row.note}${row.note ? ' ' : ''}[superseded: node ${missing.join(', ')} was removed by ${cause}]`, now, row.id);
    count += 1;
  }
  if (count > 0) pushLater(db, projectId);
  return count;
}

/** Tells the windows about the changed open list once the current commit is over. */
function pushLater(db: Database.Database, projectId: string): void {
  // Push after the synchronous commit transaction has finished; if it rolled back, the push shows the unchanged list.
  queueMicrotask(() => {
    try {
      proposalsChanged(projectId, listProposals(db, projectId, 'proposed'));
    } catch {
      // The database may already be closed; the next list call shows the truth.
    }
  });
}

/**
 * Inside the commit transaction of an import or an opened project: every open proposal was made for a graph
 * that is gone, so all of them are superseded.
 */
export function supersedeAllOpen(db: Database.Database, projectId: string, cause: string): number {
  const rows = db
    .prepare(`SELECT id, note FROM proposals WHERE project_id = ? AND status = 'proposed'`)
    .all(projectId) as Array<{ id: string; note: string }>;
  const now = Date.now();
  const update = db.prepare(`UPDATE proposals SET status = 'superseded', note = ?, resolved_at = ? WHERE id = ?`);
  for (const row of rows) update.run(`${row.note}${row.note ? ' ' : ''}[superseded: the graph was replaced by ${cause}]`, now, row.id);
  if (rows.length > 0) pushLater(db, projectId);
  return rows.length;
}
