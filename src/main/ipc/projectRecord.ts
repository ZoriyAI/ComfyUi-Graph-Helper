/**
 * The db:save-project, db:load-project and db:list-projects handlers: write and read project rows (name, times, a
 * graph_data blob). Registered in ipc.ts; the preload exposes them, though no renderer code calls them at present.
 * The graph itself is not stored here but in graph_revisions by commands/commit.ts; this is the older record.
 * Input is validated strictly and capped in size, because it comes from the renderer.
 */
import type Database from 'better-sqlite3';
import { z } from 'zod';
import type { Translator } from '../../shared/i18n';

/** The one error text for any refused record, so nothing of the input is echoed back. */
export const PROJECT_RECORD_ERROR = 'The project record does not match the schema.';
/** Largest graph_data plus metadata accepted, in bytes. */
export const PROJECT_RECORD_MAX_BYTES = 20 * 1024 * 1024;

const timestamp = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

/** The accepted record; unknown keys are refused (strict). */
export const projectRecordSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
  created_at: timestamp,
  updated_at: timestamp,
  graph_data: z.unknown(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

/** db:save-project: validated shape, size cap, fixed error text. */
export function saveProjectRecord(db: Database.Database, input: unknown): { success: true } | { success: false; error: string } {
  const parsed = projectRecordSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: PROJECT_RECORD_ERROR };
  const project = parsed.data;
  let graph: string;
  let metadata: string;
  try {
    graph = JSON.stringify(project.graph_data ?? null);
    metadata = JSON.stringify(project.metadata ?? {});
  } catch {
    return { success: false, error: PROJECT_RECORD_ERROR };
  }
  if (Buffer.byteLength(graph) + Buffer.byteLength(metadata) > PROJECT_RECORD_MAX_BYTES) return { success: false, error: PROJECT_RECORD_ERROR };
  db.prepare(`
    INSERT OR REPLACE INTO projects (id, name, created_at, updated_at, graph_data, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(project.id, project.name, project.created_at, project.updated_at, graph, metadata);
  return { success: true };
}

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
