import type Database from 'better-sqlite3';
import { z } from 'zod';

export const PROJECT_RECORD_ERROR = 'The project record does not match the schema.';
export const PROJECT_RECORD_MAX_BYTES = 20 * 1024 * 1024;

const timestamp = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

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
