/**
 * The model folders already known from the catalog, for the read-only gate's file reads.
 * index.ts hands catalogModelRoots to readOnly.ts setKnownRootsSource at start. Kept in its own file so the
 * gate (readOnly.ts) does not depend on the database.
 */
import type Database from 'better-sqlite3';

/**
 * The model folders the last sync saw the server name (`root_path` of the catalog rows). The read-only gate lets
 * `workspace_files` read only inside one of these, or inside a folder named in the same session (readOnly.ts).
 */
export function catalogModelRoots(db: Database.Database): string[] {
  try {
    return (db.prepare('SELECT DISTINCT root_path FROM model_catalog WHERE root_path IS NOT NULL').all() as Array<{ root_path: string }>)
      .map((row) => row.root_path);
  } catch {
    return [];
  }
}
