/**
 * The db:load-project and db:list-projects handlers: read project rows (name, times, a graph_data blob). Registered
 * in ipc.ts; the preload exposes them, though no renderer code calls them at present. The rows are written by
 * commands/commit.ts; the graph itself lives in graph_revisions, so this is the older record.
 * There is no handler that writes a row from the renderer.
 */
import type Database from 'better-sqlite3';
import type { Translator } from '../../shared/i18n';

/** A project row as the renderer receives it, with its JSON columns parsed. */
export interface ProjectRecordView {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  graph_data: unknown;
  metadata: unknown;
}

interface ProjectRow {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  graph_data: string | null;
  metadata: string | null;
}

/** The row with its JSON columns parsed; throws when a column is not JSON (a damaged row). */
function viewOf(row: ProjectRow): ProjectRecordView {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    updated_at: row.updated_at,
    graph_data: row.graph_data === null ? null : JSON.parse(row.graph_data),
    metadata: row.metadata === null ? null : JSON.parse(row.metadata),
  };
}

/**
 * db:load-project: the row, null when there is none, or a plain translated error when the row is damaged (its
 * stored JSON does not parse), instead of an exception carrying a parser message.
 */
export function loadProjectRecord(db: Database.Database, id: unknown, translate: Translator): ProjectRecordView | null | { error: string } {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
  if (!row) return null;
  try {
    return viewOf(row);
  } catch {
    return { error: translate('errors.projectRecordBroken') };
  }
}

/**
 * db:list-projects: every readable row, newest first. A damaged row is left out, so one broken record does not
 * hide all the others; the log names its id only, never its content (it may hold a person's graph).
 */
export function listProjectRecords(db: Database.Database, log: (line: string) => void = console.warn): ProjectRecordView[] {
  const rows = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as ProjectRow[];
  const out: ProjectRecordView[] = [];
  for (const row of rows) {
    try {
      out.push(viewOf(row));
    } catch {
      log(`[Projects] Skipped a damaged project record (${String(row.id).slice(0, 80)})`);
    }
  }
  return out;
}
