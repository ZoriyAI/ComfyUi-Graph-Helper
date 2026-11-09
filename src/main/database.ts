import Database from 'better-sqlite3';
import { app } from 'electron';
import { closeStaleRuns, ensureWorkspace } from './commands/commit';
import { databasePath } from '../shared/database-path';
import { migrate } from './settings/migrate';

let db: Database.Database | null = null;

export function openDatabase(dbPath: string): Database.Database {
  const opened = new Database(dbPath);
  opened.pragma('journal_mode = WAL');
  migrate(opened);
  return opened;
}

export function initDatabase(): void {
  const userDataDir = app.getPath('userData');
  const dbPath = databasePath(userDataDir);
  console.log('[Database] Opening', dbPath);
  db = openDatabase(dbPath);
  ensureWorkspace(db);
  // No turn survives a restart: runs left open by the previous session would block or confuse the next one.
  closeStaleRuns(db);
  console.log('[Database] Schema ready');
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    console.log('[Database] Closing');
    db.close();
    db = null;
  }
}
