import type Database from 'better-sqlite3';

const V1_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

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

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  theme TEXT NOT NULL,
  motion TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  comfy_origin TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  project_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL,
  base_revision_id TEXT NOT NULL,
  expected_revision_id TEXT NOT NULL,
  PRIMARY KEY (project_id, run_id)
);

CREATE TABLE IF NOT EXISTS applied_commands (
  project_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  run_id TEXT,
  actor TEXT NOT NULL,
  payload_canonical TEXT NOT NULL,
  result_json TEXT NOT NULL,
  result_revision_id TEXT,
  PRIMARY KEY (project_id, action_id)
);

CREATE TABLE IF NOT EXISTS secret_records (
  name TEXT PRIMARY KEY,
  ciphertext BLOB NOT NULL
);
`;

export function schemaVersion(db: Database.Database): number {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    .get();
  if (!table) return 0;
  const row = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as
    | { version: number | null }
    | undefined;
  return row?.version ?? 0;
}

export function tableNames(db: Database.Database): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{
      name: string;
    }>
  ).map((row) => row.name);
}

function columnNames(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name);
}

function applyVersion3(db: Database.Database): void {
  if (!columnNames(db, 'graph_revisions').includes('document')) {
    db.exec("ALTER TABLE graph_revisions ADD COLUMN document TEXT NOT NULL DEFAULT '{}'");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS node_catalog (
      class_type TEXT PRIMARY KEY,
      pack TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS model_catalog (
      directory TEXT NOT NULL,
      name TEXT NOT NULL,
      PRIMARY KEY (directory, name)
    );
  `);
}

function applyVersion2(db: Database.Database): void {
  if (!columnNames(db, 'projects').includes('current_revision_id')) {
    db.exec('ALTER TABLE projects ADD COLUMN current_revision_id TEXT');
  }
  if (!columnNames(db, 'graph_revisions').includes('rev_seq')) {
    db.exec('ALTER TABLE graph_revisions ADD COLUMN rev_seq INTEGER NOT NULL DEFAULT 0');
  }
}

/**
 * Version 0 has no schema_migrations table.
 * Version 1 adds settings, runs, applied_commands, and secret_records.
 * Version 2 adds the current revision pointer and monotonic rev_seq.
 * Version 3 stores the workflow document and the local node/model catalog.
 */
export function migrate(db: Database.Database, options?: { failBeforeVersionStamp?: boolean }): void {
  const version = schemaVersion(db);
  if (version > 3) {
    throw new Error(`Unsupported schema version ${version}`);
  }
  if (version < 1) {
    const apply = db.transaction(() => {
      db.exec(V1_SQL);
      if (options?.failBeforeVersionStamp) {
        throw new Error('migration failed before version stamp');
      }
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 1) {
    const apply = db.transaction(() => {
      applyVersion2(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (2, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 2) {
    const apply = db.transaction(() => {
      applyVersion3(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (3, ?)').run(Date.now());
    });
    apply.immediate();
  }
}
