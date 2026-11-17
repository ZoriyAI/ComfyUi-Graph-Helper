/** Own upgrade/recovery copies only. Privacy actions preserve their graphs, settings and other projects. */
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

type PrivateTable = 'secret_records' | 'chat_messages' | 'assistant_drafts';

export function databaseCopies(file: string): { files: string[]; unverified: number } {
  if (!file || file === ':memory:') return { files: [], unverified: 0 };
  const base = path.basename(file).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const own = new RegExp(`^${base}(?:\\.before-v[0-9]+\\.bak(?:\\.part)?|\\.damaged-[0-9]{8}-[0-9]{6})$`);
  try {
    return { files: fs.readdirSync(path.dirname(file)).filter(name => own.test(name)).map(name => path.join(path.dirname(file), name)), unverified: 0 };
  } catch { return { files: [], unverified: 1 }; }
}

function hasTable(db: Database.Database, table: PrivateTable): boolean {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
}

/** A link in a copy or its SQLite companions must never redirect a privacy operation to another file. */
function openCopy(file: string, readonly: boolean): Database.Database {
  for (const item of [file, `${file}-wal`, `${file}-shm`, `${file}-journal`]) {
    try {
      const stat = fs.lstatSync(item);
      if (!stat.isFile() || stat.nlink !== 1) throw new Error('Unverified database copy');
    } catch (error) {
      if (item === file || (error as { code?: string }).code !== 'ENOENT') throw error;
    }
  }
  return new Database(file, { readonly, fileMustExist: true, timeout: 1000 });
}

/** SQL identifiers and predicates come only from the fixed application callers; values are bound. */
export function erasePrivateRows(db: Database.Database, table: PrivateTable, where = '1', values: string[] = []): { records: number; compacted: boolean } {
  if (!hasTable(db, table)) return { records: 0, compacted: true };
  db.pragma('secure_delete = ON');
  const records = db.prepare(`DELETE FROM ${table} WHERE ${where}`).run(...values).changes;
  let compacted = true;
  try { db.exec('VACUUM'); } catch { compacted = false; }
  try {
    const result = db.pragma('wal_checkpoint(TRUNCATE)') as Array<{ busy: number }>;
    if (result.some(item => item.busy > 0)) compacted = false;
  } catch { compacted = false; }
  return { records, compacted };
}

export function eraseCopyRows(file: string, table: PrivateTable, where = '1', values: string[] = []): { records: number; unverified: number } {
  const copies = databaseCopies(file);
  let records = 0;
  let unverified = copies.unverified;
  for (const copy of copies.files) {
    let db: Database.Database | undefined;
    try {
      db = openCopy(copy, false);
      const result = erasePrivateRows(db, table, where, values);
      records += result.records;
      if (!result.compacted) unverified += 1;
    } catch { unverified += 1; } finally { db?.close(); }
  }
  return { records, unverified };
}

export function copySecretInventory(file: string): { files: number; unverified: number } {
  const copies = databaseCopies(file);
  let files = 0;
  let unverified = copies.unverified;
  for (const copy of copies.files) {
    let db: Database.Database | undefined;
    try {
      db = openCopy(copy, true);
      if (hasTable(db, 'secret_records') && db.prepare('SELECT 1 FROM secret_records LIMIT 1').get()) files += 1;
    } catch { unverified += 1; } finally { db?.close(); }
  }
  return { files, unverified };
}

/** Before publication, a new backup retains the project and history but no saved credentials. */
export function sanitizeNewCopy(file: string): void {
  const db = openCopy(file, false);
  try {
    if (!erasePrivateRows(db, 'secret_records').compacted) throw new Error('Database copy could not be sanitized');
  } finally { db.close(); }
}
