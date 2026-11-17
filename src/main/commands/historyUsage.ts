/** Measured history usage and preview-bound explicit cleanup. Never vacuums or touches another project. */
import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { HistoryUsage, HistoryTrimResult } from '../../shared/contracts/revisions';
import { HISTORY_BUDGET_BYTES, HISTORY_MAX_REVISIONS, HISTORY_MIN_REVISIONS, HISTORY_PRUNE_BATCH, historyKeepCount, protectedRevisions } from './history';

interface Row { id: string; timestamp: number; bytes: number; commandBytes: number }
const snapshotSize = `LENGTH(CAST(r.nodes AS BLOB)) + LENGTH(CAST(r.edges AS BLOB)) + LENGTH(CAST(r.document AS BLOB))
  + COALESCE(LENGTH(CAST(r.components AS BLOB)), 0) + COALESCE(LENGTH(CAST(r.process_meta AS BLOB)), 0)`;

function plan(db: Database.Database, projectId: string) {
  const head = (db.prepare('SELECT current_revision_id FROM projects WHERE id = ?').get(projectId) as { current_revision_id: string } | undefined)?.current_revision_id ?? null;
  const protectedIds = protectedRevisions(db, projectId);
  const rows = db.prepare(`SELECT r.id, r.timestamp, ${snapshotSize} AS bytes,
    COALESCE((SELECT SUM(LENGTH(CAST(a.payload_canonical AS BLOB)) + LENGTH(CAST(a.result_json AS BLOB)))
      FROM applied_commands a WHERE a.project_id = r.project_id AND a.result_revision_id = r.id), 0) AS commandBytes
    FROM graph_revisions r WHERE r.project_id = ? ORDER BY r.rev_seq DESC, r.rowid DESC`).all(projectId) as Row[];
  const candidates = rows.slice(HISTORY_MIN_REVISIONS).filter(row => !protectedIds.has(row.id));
  const token = createHash('sha256').update(JSON.stringify([projectId, head, [...protectedIds].sort(), rows.map(row => [row.id, row.bytes, row.commandBytes])])).digest('hex');
  return { head, protectedIds, rows, candidates, token };
}

export function historyUsage(db: Database.Database, projectId: string): HistoryUsage {
  const current = plan(db, projectId); const available = current.rows.slice(0, HISTORY_MAX_REVISIONS);
  const pageSize = Number(db.pragma('page_size', { simple: true }));
  const commandBytes = (db.prepare(`SELECT COALESCE(SUM(LENGTH(CAST(payload_canonical AS BLOB)) + LENGTH(CAST(result_json AS BLOB))), 0) AS bytes
    FROM applied_commands WHERE project_id = ?`).get(projectId) as { bytes: number }).bytes;
  return {
    revisions: current.rows.length,
    snapshotBytes: current.rows.reduce((sum, row) => sum + row.bytes, 0), commandBytes,
    protectedRevisions: current.rows.filter(row => current.protectedIds.has(row.id)).length,
    availableRevisions: available.length, oldestAvailableAt: available.at(-1)?.timestamp ?? null, newestAt: available[0]?.timestamp ?? null,
    automaticKeep: historyKeepCount(current.rows.find(row => row.id === current.head)?.bytes ?? 0), minimumKeep: HISTORY_MIN_REVISIONS,
    softBudgetBytes: HISTORY_BUDGET_BYTES,
    databaseBytes: Number(db.pragma('page_count', { simple: true })) * pageSize,
    reusableDatabaseBytes: Number(db.pragma('freelist_count', { simple: true })) * pageSize,
    trim: { token: current.token, count: current.candidates.length, bytes: current.candidates.reduce((sum, row) => sum + row.bytes + row.commandBytes, 0), remaining: current.rows.length - current.candidates.length },
  };
}

/** Each short transaction keeps the UI responsive. A changed graph or protection set stops the remaining batches. */
export async function trimHistoryExplicitly(db: Database.Database, projectId: string, token: string): Promise<HistoryTrimResult> {
  const current = plan(db, projectId);
  let removed = 0; let releasedBytes = 0;
  const done = (ok: boolean, reason?: HistoryTrimResult['reason']): HistoryTrimResult => ({ ok, removed, releasedBytes, ...(reason ? { reason } : {}), usage: historyUsage(db, projectId) });
  if (current.token !== token || db.inTransaction) return done(false, 'changed');
  const protections = JSON.stringify([...current.protectedIds].sort());
  for (let at = 0; at < current.candidates.length; at += HISTORY_PRUNE_BATCH) {
    const head = (db.prepare('SELECT current_revision_id FROM projects WHERE id = ?').get(projectId) as { current_revision_id: string } | undefined)?.current_revision_id ?? null;
    if (head !== current.head || JSON.stringify([...protectedRevisions(db, projectId)].sort()) !== protections) return done(false, 'changed');
    const batch = current.candidates.slice(at, at + HISTORY_PRUNE_BATCH);
    const secure = db.pragma('secure_delete', { simple: true });
    try {
      db.pragma('secure_delete = FAST');
      const result = db.transaction(() => {
        let count = 0; let bytes = 0;
        for (const row of batch) {
          const dropped = db.prepare('DELETE FROM graph_revisions WHERE project_id = ? AND id = ?').run(projectId, row.id).changes;
          if (!dropped) continue;
          db.prepare('DELETE FROM applied_commands WHERE project_id = ? AND result_revision_id = ?').run(projectId, row.id);
          count += dropped; bytes += row.bytes + row.commandBytes;
        }
        return { count, bytes };
      }).immediate();
      removed += result.count; releasedBytes += result.bytes;
    } catch { return done(false, 'storage'); }
    finally { db.pragma(`secure_delete = ${Number(secure) === 1 ? 'ON' : Number(secure) === 2 ? 'FAST' : 'OFF'}`); }
    if (at + HISTORY_PRUNE_BATCH < current.candidates.length) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return done(true);
}
