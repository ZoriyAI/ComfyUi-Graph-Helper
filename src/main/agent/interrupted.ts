/**
 * Assistant runs that ended without finishing: one chat line saying the run was cut off and how many of its nodes
 * stayed on the canvas. main/database.ts calls closeInterruptedRuns when the database opens at start;
 * ipc/agentIpc.ts calls reportInterruptedRun when a window goes away during a run.
 * The line has the id `interrupted-<runId>`, so a run is never reported twice.
 */
import type Database from 'better-sqlite3';
import { closeStaleRuns, readProjection } from '../commands/commit';
import { runCreatedNodeIds } from '../commands/placement';
import { saveChatMessage } from './chatHistory';
import { createTranslator, type AppLanguage } from '../../shared/i18n';

/**
 * One run cut off because its window went away (closed during a pause or a build): the same line in the chat as at
 * the next start, written now, since the turn's end closes the run and the start-up check would not see it.
 */
export function reportInterruptedRun(db: Database.Database, projectId: string, runId: string, language: AppLanguage, now = Date.now()): boolean {
  try {
    const changes = (db.prepare('SELECT COUNT(*) AS n FROM applied_commands WHERE project_id = ? AND run_id = ?').get(projectId, runId) as { n: number }).n;
    if (changes === 0) return false;
    const onCanvas = new Set(((readProjection(db, projectId)?.snapshot.nodes ?? []) as Array<{ id?: unknown }>).map((node) => String(node.id)));
    const count = runCreatedNodeIds(db, projectId, runId).filter((id) => onCanvas.has(id)).length;
    const t = createTranslator(language);
    return saveChatMessage(db, {
      id: `interrupted-${runId}`,
      projectId,
      role: 'assistant',
      content: t('chat.runInterrupted', { count }),
      timestamp: now,
      graphRevisionId: null,
      toolCalls: null,
    // No held-secret check: the line is the app's own catalog text, not the person's or the model's words.
    }, () => false).ok;
  } catch {
    return false;
  }
}

/**
 * At startup no turn is in flight: a run the previous session left running or paused was cut off by closing the
 * app. It is closed (as before), and when it had changed the graph the chat gets one visible line saying what
 * happened and what stayed on the canvas. A run that changed nothing (a plain question) leaves no line.
 * Returns how many lines were written.
 */
export function closeInterruptedRuns(db: Database.Database, language: AppLanguage, now = Date.now()): number {
  let written = 0;
  try {
    const open = db.prepare(`SELECT project_id, run_id FROM runs WHERE status IN ('running', 'paused')`).all() as Array<{ project_id: string; run_id: string }>;
    const t = createTranslator(language);
    for (const run of open) {
      const changes = (db.prepare('SELECT COUNT(*) AS n FROM applied_commands WHERE project_id = ? AND run_id = ?').get(run.project_id, run.run_id) as { n: number }).n;
      if (changes === 0) continue;
      const onCanvas = new Set(((readProjection(db, run.project_id)?.snapshot.nodes ?? []) as Array<{ id?: unknown }>).map((node) => String(node.id)));
      const count = runCreatedNodeIds(db, run.project_id, run.run_id).filter((id) => onCanvas.has(id)).length;
      const saved = saveChatMessage(db, {
        id: `interrupted-${run.run_id}`,
        projectId: run.project_id,
        role: 'assistant',
        content: t('chat.runInterrupted', { count }),
        timestamp: now,
        graphRevisionId: null,
        toolCalls: null,
      }, () => false);
      if (saved.ok) written += 1;
    }
  } catch (error) {
    // The line is a courtesy: the runs are closed whatever happens here.
    console.warn('[Agent] Interrupted runs were not reported:', error instanceof Error ? error.message.slice(0, 200) : 'unknown error');
  }
  closeStaleRuns(db);
  return written;
}
