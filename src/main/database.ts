import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'comfyui-desktop.db');
  console.log('[Database] Initializing at:', dbPath);
  
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL'); // Better performance

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      graph_data TEXT,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      graph_revision_id TEXT,
      tool_calls TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS graph_revisions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      nodes TEXT NOT NULL,
      edges TEXT NOT NULL,
      parent_revision_id TEXT,
      description TEXT,
      source TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chat_project ON chat_messages(project_id);
    CREATE INDEX IF NOT EXISTS idx_revisions_project ON graph_revisions(project_id);
  `);

  console.log('[Database] Initialized successfully');
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export function closeDatabase() {
  if (db) {
    console.log('[Database] Closing');
    db.close();
    db = null;
  }
}
