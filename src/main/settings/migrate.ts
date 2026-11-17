/**
 * The schema of the profile database and its step-by-step upgrades (one version per step, each in its own
 * transaction with its version stamp, so a crash leaves the database at the last whole version).
 * Called by database.ts when the database opens (after databaseSafety.ts copied the file), and by most tests to
 * build a fresh database. A database newer than SCHEMA_VERSION is refused, never downgraded.
 */
import type Database from 'better-sqlite3';

/** Version 1: the tables every later version builds on. */
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

/** The highest version stamped in schema_migrations; 0 for a new or pre-migration database. */
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

/** The app's own tables, by name (SQLite's internal tables left out). */
export function tableNames(db: Database.Database): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{
      name: string;
    }>
  ).map((row) => row.name);
}

/**
 * The columns of a table. Steps check them before ALTER TABLE so a step that ran half on an old build is safe
 * to run again. `table` is always a fixed name from this file, never input.
 */
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
 * Version 13 adds what a node pack says about itself on node_packs: the description and the repository link from
 * its pyproject.toml, the opening of its README, and the version and commit they were read at.
 * Version 14 adds what was found about a model file on the internet when the person asked for it (Civitai by the
 * file's fingerprint, Hugging Face by its name): where it came from, the link, what it says, its preview address,
 * when it was asked and how it ended, and the family it gave a file whose family was not known otherwise.
 * Version 15 lets explanations travel with the project: each revision keeps the key of the graph it shows
 * (graph_key: a new one when a workflow or a project is opened or a new project started, the restored one on undo),
 * and an explanation of an object of a graph keeps that key and the subgraph definition the object lives in (scope).
 * Rows already there belong to the graph each project has now.
 * Version 16 adds two indexes for the history: one that answers the revision list (undo, replay) without reading
 * the stored graphs, and one that finds the command that made a revision.
 * Version 17 remembers, for each graph (graph_key), the project file it was last opened from or saved to and the
 * fingerprint of the content written there (table project_files): Ctrl+S saves in place, and the unsaved mark says
 * whether what is on screen is in that file as it stands, across reloads and restarts.
 * Version 18 adds flags on node_catalog: the api, deprecated and experimental marks of a node class.
 * Version 19 caches translated model descriptions by source hash and language.
 * Version 20 preserves failed-turn markers in chat history.
 * Version 21 keeps pending assistant lessons and extension sources across restarts, scoped to their project.
 */
export const SCHEMA_VERSION = 21;

/**
 * Brings the database up to SCHEMA_VERSION (or `upTo`), one step at a time from the version it has.
 * `failBeforeVersionStamp` is a test hook proving a failed step leaves no half-applied version behind.
 */
export function migrate(db: Database.Database, options?: { failBeforeVersionStamp?: boolean; /** Tests: stop at this version. */ upTo?: number }): void {
  const version = schemaVersion(db);
  const target = Math.min(SCHEMA_VERSION, options?.upTo ?? SCHEMA_VERSION);
  if (version > SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version ${version}`);
  }
  if (version < 1 && target >= 1) {
    const apply = db.transaction(() => {
      db.exec(V1_SQL);
      if (options?.failBeforeVersionStamp) {
        throw new Error('migration failed before version stamp');
      }
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 1 && target > 1) {
    const apply = db.transaction(() => {
      applyVersion2(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (2, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 2 && target > 2) {
    const apply = db.transaction(() => {
      applyVersion3(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (3, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 3 && target > 3) {
    const apply = db.transaction(() => {
      applyVersion4(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (4, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 4 && target > 4) {
    const apply = db.transaction(() => {
      applyVersion5(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (5, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 5 && target > 5) {
    const apply = db.transaction(() => {
      applyVersion6(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (6, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 6 && target > 6) {
    const apply = db.transaction(() => {
      applyVersion7(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (7, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 7 && target > 7) {
    const apply = db.transaction(() => {
      applyVersion8(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (8, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 8 && target > 8) {
    const apply = db.transaction(() => {
      applyVersion9(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (9, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 9 && target > 9) {
    const apply = db.transaction(() => {
      applyVersion10(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (10, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 10 && target > 10) {
    const apply = db.transaction(() => {
      applyVersion11(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (11, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 11 && target > 11) {
    const apply = db.transaction(() => {
      applyVersion12(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (12, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 12 && target > 12) {
    const apply = db.transaction(() => {
      applyVersion13(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (13, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 13 && target > 13) {
    const apply = db.transaction(() => {
      applyVersion14(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (14, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 14 && target > 14) {
    const apply = db.transaction(() => {
      applyVersion15(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (15, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 15 && target > 15) {
    const apply = db.transaction(() => {
      applyVersion16(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (16, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 16 && target > 16) {
    const apply = db.transaction(() => {
      applyVersion17(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (17, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 17 && target > 17) {
    const apply = db.transaction(() => {
      applyVersion18(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (18, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 18 && target > 18) {
    const apply = db.transaction(() => {
      db.exec("CREATE TABLE IF NOT EXISTS model_text_translations (source_hash TEXT NOT NULL, language TEXT NOT NULL, fields_json TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (source_hash, language))");
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (19, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 19 && target > 19) {
    const apply = db.transaction(() => {
      if (tableNames(db).includes('chat_messages') && !columnNames(db, 'chat_messages').includes('failed')) db.exec('ALTER TABLE chat_messages ADD COLUMN failed INTEGER NOT NULL DEFAULT 0');
      if (options?.failBeforeVersionStamp) throw new Error('migration failed before version stamp');
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (20, ?)').run(Date.now());
    });
    apply.immediate();
  }
  if (schemaVersion(db) === 20 && target > 20) {
    const apply = db.transaction(() => {
      db.exec(`CREATE TABLE assistant_drafts (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('lesson', 'extension')),
        project_id TEXT NOT NULL, created_at INTEGER NOT NULL, payload TEXT NOT NULL
      ); CREATE INDEX assistant_drafts_project ON assistant_drafts (project_id, kind, created_at);`);
      if (options?.failBeforeVersionStamp) throw new Error('migration failed before version stamp');
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (21, ?)').run(Date.now());
    });
    apply.immediate();
  }
}

/**
 * Node marks for the node search and the canvas (editing package): the object_info flags api_node, deprecated and
 * experimental, kept as words ("api deprecated"), so a person sees a paid or an outdated node before adding it.
 */
function applyVersion18(db: Database.Database): void {
  if (tableNames(db).includes('node_catalog') && !columnNames(db, 'node_catalog').includes('flags')) {
    db.exec("ALTER TABLE node_catalog ADD COLUMN flags TEXT NOT NULL DEFAULT ''");
  }
}

/** The project file of each graph: where it was last opened from or saved to, and what it held (see above). */
function applyVersion17(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_files (
      project_id TEXT NOT NULL,
      graph_key TEXT NOT NULL,
      file_path TEXT NOT NULL,
      saved_digest TEXT NOT NULL,
      saved_at INTEGER NOT NULL,
      PRIMARY KEY (project_id, graph_key)
    )
  `);
}

function applyVersion16(db: Database.Database): void {
  const tables = tableNames(db);
  // Each revision row holds a whole graph (up to megabytes). The revision list reads only these columns; with
  // them in an index SQLite never walks the stored graphs, so the list stays fast however big the graphs are.
  if (tables.includes('graph_revisions')) {
    db.exec('CREATE INDEX IF NOT EXISTS idx_revisions_history ON graph_revisions(project_id, rev_seq, id, timestamp, description, source)');
  }
  if (tables.includes('applied_commands')) {
    db.exec('CREATE INDEX IF NOT EXISTS idx_commands_revision ON applied_commands(project_id, result_revision_id)');
  }
}

/** Kinds of explanation owners that are objects of one graph (shared/knowledge/projectExplanations.ts). */
const GRAPH_OWNER_KINDS_V15 = "('node', 'port', 'edge', 'group', 'subgraph', 'process')";

function applyVersion15(db: Database.Database): void {
  const tables = tableNames(db);
  if (tables.includes('graph_revisions')) addColumn(db, 'graph_revisions', 'graph_key', 'TEXT');
  if (tables.includes('explanations')) {
    addColumn(db, 'explanations', 'graph_key', 'TEXT');
    addColumn(db, 'explanations', 'scope', "TEXT NOT NULL DEFAULT ''");
    db.exec('CREATE INDEX IF NOT EXISTS idx_explanations_graph ON explanations(project_id, graph_key)');
  }
  if (!tables.includes('graph_revisions') || !tables.includes('projects')) return;
  // Each revision's graph: a replacement starts a new one, a restore takes the restored revision's, anything else
  // keeps its parent's. Revisions are walked in the order they were made, so a parent or a restored one is known.
  const restoredBy = new Map<string, string>();
  if (tables.includes('applied_commands')) {
    const commands = db.prepare('SELECT result_revision_id, result_json FROM applied_commands WHERE result_revision_id IS NOT NULL').all() as Array<{ result_revision_id: string; result_json: string }>;
    for (const command of commands) {
      try {
        const result = JSON.parse(command.result_json) as { revisionId?: unknown };
        if (typeof result?.revisionId === 'string') restoredBy.set(command.result_revision_id, result.revisionId);
      } catch {
        // Not a restore.
      }
    }
  }
  const revisions = db
    .prepare('SELECT id, project_id, parent_revision_id, description FROM graph_revisions ORDER BY project_id, rev_seq, rowid')
    .all() as Array<{ id: string; project_id: string; parent_revision_id: string | null; description: string | null }>;
  const keys = new Map<string, string>();
  const stamp = db.prepare('UPDATE graph_revisions SET graph_key = ? WHERE id = ?');
  for (const revision of revisions) {
    const first = `first:${revision.project_id}`;
    let key: string;
    if (revision.description === 'import-workflow' || revision.description === 'open-native') key = `graph-${revision.id}`;
    else if (revision.description === 'restore-revision') key = keys.get(restoredBy.get(revision.id) ?? '') ?? keys.get(revision.parent_revision_id ?? '') ?? first;
    else key = keys.get(revision.parent_revision_id ?? '') ?? first;
    keys.set(revision.id, key);
    stamp.run(key, revision.id);
  }
  if (!tables.includes('explanations')) return;
  // What is stored now was written for the graph each project shows now (a replaced graph's rows were dropped).
  const projects = db.prepare('SELECT id, current_revision_id FROM projects').all() as Array<{ id: string; current_revision_id: string | null }>;
  const adopt = db.prepare(`UPDATE explanations SET graph_key = ? WHERE project_id = ? AND graph_key IS NULL AND owner_kind IN ${GRAPH_OWNER_KINDS_V15}`);
  for (const project of projects) {
    if (!project.current_revision_id) continue;
    adopt.run(keys.get(project.current_revision_id) ?? `first:${project.id}`, project.id);
  }
}

function applyVersion13(db: Database.Database): void {
  if (!tableNames(db).includes('node_packs')) return;
  // What the pack's own files say. `info_sig` is the version and commit the files were read at, so a pack is
  // read again only when it was updated; `info_read_at` is when that read happened (null: never read).
  addColumn(db, 'node_packs', 'description', 'TEXT');
  addColumn(db, 'node_packs', 'repository_url', 'TEXT');
  addColumn(db, 'node_packs', 'readme_summary', 'TEXT');
  addColumn(db, 'node_packs', 'info_sig', 'TEXT');
  addColumn(db, 'node_packs', 'info_read_at', 'INTEGER');
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
