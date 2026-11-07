import Database from 'better-sqlite3';
import { app } from 'electron';
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
  console.log('[Database] Schema version 1 ready');
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
