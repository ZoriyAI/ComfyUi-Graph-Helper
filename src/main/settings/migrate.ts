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
 * Version 4 adds object_info guidance columns on node_catalog.
 * Version 5 adds the non-secret LLM base URL on the single settings row.
 * Version 6 adds the interface language. Existing rows default to English.
 * A profile with no settings row still uses the application default, Russian.
 * Version 7 stores app component records and process metadata on each graph revision.
 * Version 8 adds the MCP server URL on the settings row, display name and category on node_catalog,
 * and the file size on model_catalog, so a catalog read through MCP keeps what the server reports.
 */
export function migrate(db: Database.Database, options?: { failBeforeVersionStamp?: boolean }): void {
  const version = schemaVersion(db);
  if (version > 8) {
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
  if (schemaVersion(db) === 3) {
    const apply = db.transaction(() => {
      applyVersion4(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (4, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 4) {
    const apply = db.transaction(() => {
      applyVersion5(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (5, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 5) {
    const apply = db.transaction(() => {
      applyVersion6(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (6, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 6) {
    const apply = db.transaction(() => {
      applyVersion7(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (7, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 7) {
    const apply = db.transaction(() => {
      applyVersion8(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (8, ?)').run(Date.now());
    });
    apply.immediate();
  }
}

function applyVersion8(db: Database.Database): void {
  const tables = tableNames(db);
  if (tables.includes('settings') && !columnNames(db, 'settings').includes('mcp_url')) {
    db.exec("ALTER TABLE settings ADD COLUMN mcp_url TEXT NOT NULL DEFAULT ''");
  }
  if (tables.includes('node_catalog')) {
    const columns = columnNames(db, 'node_catalog');
    if (!columns.includes('display_name')) db.exec("ALTER TABLE node_catalog ADD COLUMN display_name TEXT NOT NULL DEFAULT ''");
    if (!columns.includes('category')) db.exec("ALTER TABLE node_catalog ADD COLUMN category TEXT NOT NULL DEFAULT ''");
  }
  if (tables.includes('model_catalog') && !columnNames(db, 'model_catalog').includes('size_bytes')) {
    db.exec('ALTER TABLE model_catalog ADD COLUMN size_bytes INTEGER');
  }
}

function applyVersion7(db: Database.Database): void {
  const revisions = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'graph_revisions'").get();
  if (!revisions) return;
  const columns = columnNames(db, 'graph_revisions');
  if (!columns.includes('components')) {
    db.exec("ALTER TABLE graph_revisions ADD COLUMN components TEXT NOT NULL DEFAULT '[]'");
  }
  if (!columns.includes('process_meta')) {
    db.exec("ALTER TABLE graph_revisions ADD COLUMN process_meta TEXT NOT NULL DEFAULT '{}'");
  }
}

function applyVersion4(db: Database.Database): void {
  const columns = columnNames(db, 'node_catalog');
  if (!columns.includes('python_module')) {
    db.exec("ALTER TABLE node_catalog ADD COLUMN python_module TEXT NOT NULL DEFAULT 'nodes'");
  }
  if (!columns.includes('inputs_json')) {
    db.exec("ALTER TABLE node_catalog ADD COLUMN inputs_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!columns.includes('outputs_json')) {
    db.exec("ALTER TABLE node_catalog ADD COLUMN outputs_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!columns.includes('widget_order_json')) {
    db.exec("ALTER TABLE node_catalog ADD COLUMN widget_order_json TEXT NOT NULL DEFAULT '[]'");
  }
}

function applyVersion5(db: Database.Database): void {
  const settings = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'settings'").get();
  if (!settings) return;
  if (!columnNames(db, 'settings').includes('base_url')) {
    db.exec("ALTER TABLE settings ADD COLUMN base_url TEXT NOT NULL DEFAULT ''");
  }
}

function applyVersion6(db: Database.Database): void {
  const settings = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'settings'").get();
  if (!settings) return;
  if (!columnNames(db, 'settings').includes('language')) {
    db.exec("ALTER TABLE settings ADD COLUMN language TEXT NOT NULL DEFAULT 'en'");
  }
}
