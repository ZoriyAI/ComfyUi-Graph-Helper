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
 * Version 9 adds the knowledge layer: model kind, base-model family, trigger words and metadata on
 * model_catalog; description and pack on node_catalog; node_packs, explanations, proposals and sync_state.
 * Version 10 adds preferences_json on the settings row: the validated preferences model (never a secret).
 * Version 11 adds mcp_auth on the settings row: how the app presents itself to the MCP server ('', none, token, oauth).
 * Version 12 adds what a model manager keeps next to a model file: the names of its description and preview files
 * as the listing gave them, the description as last read, and the notes read from it.
 * Version 13 is taken by the node pack information added on another branch; here it is an empty step until merge.
 * Version 14 adds what was found about a model file on the internet when the person asked for it (Civitai by the
 * file's fingerprint, Hugging Face by its name): where it came from, the link, what it says, its preview address,
 * when it was asked and how it ended, and the family it gave a file whose family was not known otherwise.
 */
export function migrate(db: Database.Database, options?: { failBeforeVersionStamp?: boolean }): void {
  const version = schemaVersion(db);
  if (version > 14) {
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
  if (schemaVersion(db) === 8) {
    const apply = db.transaction(() => {
      applyVersion9(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (9, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 9) {
    const apply = db.transaction(() => {
      applyVersion10(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (10, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 10) {
    const apply = db.transaction(() => {
      applyVersion11(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (11, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 11) {
    const apply = db.transaction(() => {
      applyVersion12(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (12, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 12) {
    // Taken by node pack information; replaced on merge. Nothing to do here, only the number.
    const apply = db.transaction(() => {
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (13, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 13) {
    const apply = db.transaction(() => {
      applyVersion14(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (14, ?)').run(Date.now());
    });
    apply.immediate();
  }
}

function applyVersion14(db: Database.Database): void {
  if (!tableNames(db).includes('model_catalog')) return;
  // The file's own fingerprint goes into the `sha256` column version 9 made; these are what the internet said.
  // `web_status` is 'found', 'not-found' or 'error'; `web_error` the short code of what went wrong.
  addColumn(db, 'model_catalog', 'web_source', 'TEXT');
  addColumn(db, 'model_catalog', 'web_url', 'TEXT');
  addColumn(db, 'model_catalog', 'web_notes_json', "TEXT NOT NULL DEFAULT '{}'");
  addColumn(db, 'model_catalog', 'web_preview_url', 'TEXT');
  addColumn(db, 'model_catalog', 'web_checked_at', 'INTEGER');
  addColumn(db, 'model_catalog', 'web_status', 'TEXT');
  addColumn(db, 'model_catalog', 'web_error', 'TEXT');
  // The family Civitai named for a file whose header, description and name did not say. Kept apart, so a later
  // read of the file that does say wins, and one that still does not keeps it.
  addColumn(db, 'model_catalog', 'web_family', 'TEXT');
}

function applyVersion12(db: Database.Database): void {
  if (!tableNames(db).includes('model_catalog')) return;
  // `*_sig` is the file's name and size in the listing; `sidecar_read_sig` is the one the notes were read from,
  // so a description that appears or changes later is read again and one that is unchanged is not.
  addColumn(db, 'model_catalog', 'sidecar_file', 'TEXT');
  addColumn(db, 'model_catalog', 'sidecar_sig', 'TEXT');
  addColumn(db, 'model_catalog', 'sidecar_read_sig', 'TEXT');
  addColumn(db, 'model_catalog', 'preview_file', 'TEXT');
  addColumn(db, 'model_catalog', 'preview_sig', 'TEXT');
  addColumn(db, 'model_catalog', 'notes_json', "TEXT NOT NULL DEFAULT '{}'");
}

function applyVersion11(db: Database.Database): void {
  if (tableNames(db).includes('settings')) addColumn(db, 'settings', 'mcp_auth', "TEXT NOT NULL DEFAULT ''");
}

function applyVersion10(db: Database.Database): void {
  if (tableNames(db).includes('settings')) addColumn(db, 'settings', 'preferences_json', "TEXT NOT NULL DEFAULT '{}'");
}

function addColumn(db: Database.Database, table: string, column: string, definition: string): void {
  if (!columnNames(db, table).includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function applyVersion9(db: Database.Database): void {
  const tables = tableNames(db);
  if (tables.includes('model_catalog')) {
    addColumn(db, 'model_catalog', 'kind', "TEXT NOT NULL DEFAULT 'other'");
    addColumn(db, 'model_catalog', 'base_model', "TEXT NOT NULL DEFAULT 'unknown'");
    addColumn(db, 'model_catalog', 'base_model_evidence', "TEXT NOT NULL DEFAULT 'none'");
    addColumn(db, 'model_catalog', 'trigger_words', "TEXT NOT NULL DEFAULT '[]'");
    addColumn(db, 'model_catalog', 'description', "TEXT NOT NULL DEFAULT ''");
    addColumn(db, 'model_catalog', 'source_url', 'TEXT');
    addColumn(db, 'model_catalog', 'metadata_json', "TEXT NOT NULL DEFAULT '{}'");
    addColumn(db, 'model_catalog', 'root_path', 'TEXT');
    addColumn(db, 'model_catalog', 'sha256', 'TEXT');
    addColumn(db, 'model_catalog', 'synced_at', 'INTEGER');
    addColumn(db, 'model_catalog', 'enriched_at', 'INTEGER');
  }
  if (tables.includes('node_catalog')) {
    addColumn(db, 'node_catalog', 'description', "TEXT NOT NULL DEFAULT ''");
    addColumn(db, 'node_catalog', 'pack_name', "TEXT NOT NULL DEFAULT ''");
    addColumn(db, 'node_catalog', 'output_node', 'INTEGER NOT NULL DEFAULT 0');
    addColumn(db, 'node_catalog', 'synced_at', 'INTEGER');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS node_packs (
      name TEXT PRIMARY KEY,
      version TEXT,
      commit_sha TEXT,
      installed_state TEXT NOT NULL DEFAULT '',
      import_state TEXT NOT NULL DEFAULT '',
      class_count INTEGER,
      synced_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS explanations (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      owner_kind TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      owner_json TEXT NOT NULL DEFAULT '{}',
      aspect TEXT NOT NULL,
      text TEXT NOT NULL,
      provenance TEXT NOT NULL,
      source_url TEXT,
      revision_id TEXT,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_explanations_owner ON explanations(owner_kind, owner_id);
    CREATE INDEX IF NOT EXISTS idx_explanations_project ON explanations(project_id);
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      run_id TEXT,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      payload TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      revision_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_proposals_project_status ON proposals(project_id, status);
    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
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
