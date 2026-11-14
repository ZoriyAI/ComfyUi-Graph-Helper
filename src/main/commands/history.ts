import type Database from 'better-sqlite3';
import { REVISION_LIST_LIMIT } from '../../shared/contracts/revisions';

/**
 * How long the graph history grows. Every change stores the whole graph as a new revision (about 1 MB for a graph
 * of 1000 nodes), so months of work would fill the disk and slow every start. What is kept, per project:
 *
 * - at most REVISION_LIST_LIMIT (2000) revisions: Undo and the replay only ever see that many, so an older one
 *   cannot be reached anyway;
 * - fewer when the graph is big: as many as fit HISTORY_BUDGET_BYTES at the size of the graph now, but never
 *   fewer than HISTORY_MIN_REVISIONS steps back;
 * - always the revision on screen, the revisions an open assistant run started from or expects, and the
 *   revision an open suggestion was made on.
 *
 * Older revisions are removed together with the record of the command that made them. Nothing else is touched:
 * the graph, chat, explanations and saved project files stay as they are.
 */
export const HISTORY_MAX_REVISIONS = REVISION_LIST_LIMIT;
export const HISTORY_MIN_REVISIONS = 200;
export const HISTORY_BUDGET_BYTES = 256 * 1024 * 1024;
/** Rows removed in one go, so a long-grown history is trimmed in short steps that never stall the window. */
export const HISTORY_PRUNE_BATCH = 200;
/** After a commit the history is looked at every this many revisions. */
export const HISTORY_PRUNE_EVERY = 25;

/** How many revisions to keep for a graph whose stored revision takes `revisionBytes`. */
export function historyKeepCount(revisionBytes: number): number {
  const bytes = Math.max(1, Math.floor(revisionBytes));
  const fit = Math.floor(HISTORY_BUDGET_BYTES / bytes);
  return Math.max(HISTORY_MIN_REVISIONS, Math.min(HISTORY_MAX_REVISIONS, fit));
}

function currentRevisionBytes(db: Database.Database, projectId: string): number {
  const row = db
    .prepare(
      `SELECT LENGTH(CAST(r.nodes AS BLOB)) + LENGTH(CAST(r.edges AS BLOB)) + LENGTH(CAST(r.document AS BLOB))
         + COALESCE(LENGTH(CAST(r.components AS BLOB)), 0) + COALESCE(LENGTH(CAST(r.process_meta AS BLOB)), 0) AS bytes
       FROM projects p JOIN graph_revisions r ON r.id = p.current_revision_id WHERE p.id = ?`,
    )
    .get(projectId) as { bytes: number | null } | undefined;
  return row?.bytes ?? 0;
}

function protectedRevisions(db: Database.Database, projectId: string): Set<string> {
  const kept = new Set<string>();
  const current = db.prepare('SELECT current_revision_id FROM projects WHERE id = ?').get(projectId) as { current_revision_id: string | null } | undefined;
  if (current?.current_revision_id) kept.add(current.current_revision_id);
  const runs = db
    .prepare(`SELECT base_revision_id, expected_revision_id FROM runs WHERE project_id = ? AND status IN ('running', 'paused')`)
    .all(projectId) as Array<{ base_revision_id: string; expected_revision_id: string }>;
  for (const run of runs) {
    kept.add(run.base_revision_id);
    kept.add(run.expected_revision_id);
  }
  const hasProposals = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'proposals'").get();
  if (hasProposals) {
    const open = db.prepare(`SELECT revision_id FROM proposals WHERE project_id = ? AND status IN ('proposed', 'open')`).all(projectId) as Array<{ revision_id: string }>;
    for (const proposal of open) kept.add(proposal.revision_id);
  }
  return kept;
}

export interface PruneOptions {
  /** Revisions to keep; by default from the size of the graph now (historyKeepCount). */
  keep?: number;
  /** Most rows to remove in this call. */
  batch?: number;
}

/**
 * Removes the oldest revisions of one project beyond what is kept (see above), at most `batch` of them.
 * Returns how many were removed; 0 means the history is within its limits. Never throws.
 */
export function pruneHistory(db: Database.Database, projectId: string, options: PruneOptions = {}): number {
  if (db.inTransaction) return 0;
  try {
    const keep = Math.max(1, Math.floor(options.keep ?? historyKeepCount(currentRevisionBytes(db, projectId))));
    const batch = Math.max(1, Math.floor(options.batch ?? HISTORY_PRUNE_BATCH));
    const edge = db
      .prepare('SELECT rev_seq FROM graph_revisions WHERE project_id = ? ORDER BY rev_seq DESC LIMIT 1 OFFSET ?')
      .get(projectId, keep - 1) as { rev_seq: number } | undefined;
    if (!edge) return 0;
    const candidates = db
      .prepare('SELECT id FROM graph_revisions WHERE project_id = ? AND rev_seq < ? ORDER BY rev_seq ASC LIMIT ?')
      .all(projectId, edge.rev_seq, batch + 64) as Array<{ id: string }>;
    if (candidates.length === 0) return 0;
    const kept = protectedRevisions(db, projectId);
    const doomed = candidates.map((row) => row.id).filter((id) => !kept.has(id)).slice(0, batch);
    if (doomed.length === 0) return 0;
    const dropRevision = db.prepare('DELETE FROM graph_revisions WHERE project_id = ? AND id = ?');
    const dropCommand = db.prepare('DELETE FROM applied_commands WHERE project_id = ? AND result_revision_id = ?');
    // Freed pages of old graphs go back to the file and are reused by the next revisions. Zeroing every one of
    // them (secure_delete ON) would write the whole removed history once more, megabytes per revision; FAST
    // still clears what sits in the table's own pages.
    const secure = db.pragma('secure_delete', { simple: true });
    db.pragma('secure_delete = FAST');
    try {
      db.transaction(() => {
        for (const id of doomed) {
          dropCommand.run(projectId, id);
          dropRevision.run(projectId, id);
        }
      }).immediate();
    } finally {
      db.pragma(`secure_delete = ${Number(secure) === 1 ? 'ON' : Number(secure) === 2 ? 'FAST' : 'OFF'}`);
    }
    return doomed.length;
  } catch (error) {
    console.warn('[History] Trim skipped:', error instanceof Error ? error.message.slice(0, 200) : 'unknown error');
    return 0;
  }
}

/** After a commit: every HISTORY_PRUNE_EVERY revisions, one batch. Cheap otherwise. */
export function pruneHistoryAfterCommit(db: Database.Database, projectId: string, revSeq: number | null | undefined): void {
  if (!revSeq || revSeq % HISTORY_PRUNE_EVERY !== 0) return;
  pruneHistory(db, projectId);
}

/**
 * At start: trims every project's history in batches, one batch per tick, so a history grown before this limit
 * existed shrinks without holding up the window. `schedule` is setTimeout in the app; tests run it inline.
 */
export function trimAllHistories(
  db: Database.Database,
  schedule: (step: () => void) => void = (step) => { setTimeout(step, 0); },
): void {
  let projects: string[];
  try {
    projects = (db.prepare('SELECT id FROM projects').all() as Array<{ id: string }>).map((row) => row.id);
  } catch {
    return;
  }
  const step = () => {
    while (projects.length > 0) {
      let removed = 0;
      try {
        if (!db.open) return;
        removed = pruneHistory(db, projects[0]);
      } catch {
        removed = 0;
      }
      if (removed > 0) {
        schedule(step);
        return;
      }
      projects.shift();
    }
  };
  step();
}
