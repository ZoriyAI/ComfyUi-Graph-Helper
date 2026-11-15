/**
 * The db:save-project handler: writes a project row (name, times, a graph_data blob) from the renderer.
 * Registered in ipc.ts; the preload exposes it as saveProject, though no renderer code calls it at present.
 * The graph itself is not stored here but in graph_revisions by commands/commit.ts; this is the older record.
 * Input is validated strictly and capped in size, because it comes from the renderer.
 */
import type Database from 'better-sqlite3';
import { z } from 'zod';

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
