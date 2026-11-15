import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { normalServerFolder, pathStyle } from '../../shared/mcp/serverPaths';
import type { ParsedObjectInfo } from '../../shared/catalog/objectInfo';
import type { CatalogInput, CatalogModel, CatalogNode, CatalogOutput, CatalogView } from '../../shared/catalog/types';
import type { McpModelFile, McpNodeClass } from '../../shared/mcp/catalogSource';
import { inferBaseModel } from '../../shared/knowledge/baseModel';
import { kindFromDirectory } from '../../shared/knowledge/modelKind';
import type { ModelNotes } from '../../shared/knowledge/sidecar';

/** Opaque, main-only source identity: endpoint paths/query credentials never enter stored keys. */
export function catalogSourceKey(parts: readonly string[], installationId: string | null = null): string {
  return createHash('sha256').update(JSON.stringify([parts, installationId])).digest('hex');
}

export function normalizedMcpEndpoint(value: string): string {
  const url = new URL(value);
  url.hash = '';
  return url.href;
}

/** A missing installation id is weaker evidence, not a change of installation. */
export function sourceWithInstallation(db: Database.Database, parts: readonly string[], installationId: string | null): string {
  const connection = catalogSourceKey(parts);
  const previous = db.prepare("SELECT value FROM sync_state WHERE key = 'catalog_source_connection'").get() as { value: string } | undefined;
  const known = previous?.value === connection
    ? (db.prepare("SELECT value FROM sync_state WHERE key = 'catalog_source_installation'").get() as { value: string } | undefined)?.value ?? null : null;
  return catalogSourceKey(parts, installationId ?? known);
}

/** Clear only catalog data on a source change (including an untracked legacy source), inside publication. */
export function acceptCatalogSource(db: Database.Database, sourceKey: string): void {
  const previous = db.prepare("SELECT value FROM sync_state WHERE key = 'catalog_source_key'").get() as { value: string } | undefined;
  if (previous?.value !== sourceKey) {
    db.exec('DELETE FROM model_catalog; DELETE FROM node_catalog; DELETE FROM node_packs');
    ensureCatalog(db);
    db.prepare("DELETE FROM sync_state WHERE key IN ('enrich_failures', 'server_identity', 'comfy_model_roots', 'comfy_read_origin', 'catalog_source_connection', 'catalog_source_installation')").run();
  }
  db.prepare("INSERT INTO sync_state (key, value) VALUES ('catalog_source_key', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(sourceKey);
}

/** Revision changes with accepted catalog facts; progress and unsuccessful collection leave it alone. */
export function bumpCatalogRevision(db: Database.Database): void {
  db.prepare("INSERT INTO sync_state (key, value) VALUES ('catalog_revision', '1') ON CONFLICT(key) DO UPDATE SET value = CAST(COALESCE(CAST(value AS INTEGER), 0) + 1 AS TEXT)").run();
}

function comparableRoot(value: string | null | undefined): string | null {
  const root = normalServerFolder(value);
  return root && pathStyle(root) === 'windows' ? root.replace(/\\/g, '/').toLowerCase() : root;
}

export const SEEDED_NODE_TYPES = [
  'CheckpointLoaderSimple',
  'CLIPTextEncode',
  'KSampler',
  'VAEDecode',
  'SaveImage',
  'LoadImage',
] as const;

export function ensureCatalog(db: Database.Database): void {
  const insert = db.prepare('INSERT OR IGNORE INTO node_catalog (class_type, pack) VALUES (?, ?)');
  const write = db.transaction(() => {
    for (const classType of SEEDED_NODE_TYPES) insert.run(classType, 'core');
  });
  write.immediate();
}

export function readCatalog(db: Database.Database): CatalogView {
  const rows = db.prepare(
    'SELECT class_type, pack, python_module, inputs_json, outputs_json, widget_order_json, display_name, category FROM node_catalog ORDER BY class_type',
  ).all() as CatalogRow[];
  const nodes = rows.map((row) => nodeFromRow(row));
  const models = (db.prepare('SELECT directory, name, size_bytes FROM model_catalog ORDER BY directory, name').all() as Array<{
    directory: string;
    name: string;
    size_bytes: number | null;
  }>).map((row): CatalogModel => (row.size_bytes == null ? { directory: row.directory, name: row.name } : { directory: row.directory, name: row.name, sizeBytes: row.size_bytes }));
  return { nodeTypes: nodes.map((node) => node.classType), models, nodes };
}

type CatalogRow = {
  class_type: string;
  pack: string;
  python_module: string;
  inputs_json: string;
  outputs_json: string;
  widget_order_json: string;
  display_name: string;
  category: string;
};

/**
 * Stores node classes an MCP server listed. Inputs, outputs, and widget order already in the row are kept,
 * because the class list does not carry them; a later object_info read fills them.
 */
export function upsertNodeClasses(db: Database.Database, classes: McpNodeClass[], syncedAt: number | null = null): number {
  const upsert = db.prepare(`
    INSERT INTO node_catalog (class_type, pack, python_module, display_name, category, pack_name, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(class_type) DO UPDATE SET
      pack = excluded.pack,
      python_module = excluded.python_module,
      display_name = excluded.display_name,
      category = excluded.category,
      pack_name = excluded.pack_name,
      synced_at = COALESCE(excluded.synced_at, node_catalog.synced_at)
  `);
  const write = db.transaction(() => {
    for (const item of classes) {
      upsert.run(item.classType, item.module, item.module, item.displayName, item.category, packNameFromModule(item.module), syncedAt);
    }
  });
  write.immediate();
  return classes.length;
}

/**
 * The pack a Python module belongs to. ComfyUI loads custom packs as `custom_nodes.<folder>[.sub]`;
 * everything else (nodes, comfy_extras.*, comfy_api_nodes.*) ships with ComfyUI itself.
 */
export function packNameFromModule(module: string): string {
  const match = /^custom_nodes[./\\]([^./\\]+)/.exec(module);
  return match ? match[1] : 'core';
}

/** What a listing may say of the files next to a model. A file without the fields came from a listing that cannot tell. */
type ListedSideFiles = { sidecarFile?: string | null; sidecarSig?: string | null; previewFile?: string | null; previewSig?: string | null };

/**
 * Stores model files an MCP server listed, with the size and root folder when it reported them. A listing that
 * names every file of a folder also says which description and preview lie next to a model; that is stored as it
 * is, gone files included. A listing of model files only (the older tool) leaves what is stored alone.
 */
export function upsertModelFiles(
  db: Database.Database,
  files: Array<McpModelFile & { rootPath?: string | null } & ListedSideFiles>,
  syncedAt: number | null = null,
  options: { sourceKey?: string } = {},
): number {
  const upsert = db.prepare(`
    INSERT INTO model_catalog (directory, name, size_bytes, root_path, synced_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(directory, name) DO UPDATE SET
      size_bytes = COALESCE(excluded.size_bytes, model_catalog.size_bytes),
      root_path = COALESCE(excluded.root_path, model_catalog.root_path),
      synced_at = COALESCE(excluded.synced_at, model_catalog.synced_at)
  `);
  const oldIdentity = db.prepare('SELECT size_bytes, root_path FROM model_catalog WHERE directory = ? AND name = ?');
  const invalidate = db.prepare(`UPDATE model_catalog SET enriched_at = NULL, sha256 = NULL,
    base_model = 'unknown', base_model_evidence = 'none', trigger_words = '[]', description = '',
    source_url = NULL, metadata_json = '{}', notes_json = '{}', sidecar_read_sig = NULL,
    sidecar_file = NULL, sidecar_sig = NULL, preview_file = NULL, preview_sig = NULL,
    web_source = NULL, web_url = NULL, web_notes_json = '{}', web_preview_url = NULL,
    web_checked_at = NULL, web_status = NULL, web_error = NULL, web_family = NULL
    WHERE directory = ? AND name = ?`);
  const sides = db.prepare('UPDATE model_catalog SET sidecar_file = ?, sidecar_sig = ? WHERE directory = ? AND name = ?');
  const preview = db.prepare('UPDATE model_catalog SET preview_file = ?, preview_sig = ? WHERE directory = ? AND name = ?');
  const write = db.transaction(() => {
    if (options.sourceKey) acceptCatalogSource(db, options.sourceKey);
    for (const file of files) {
      const old = oldIdentity.get(file.directory, file.name) as { size_bytes: number | null; root_path: string | null } | undefined;
      const oldRoot = comparableRoot(old?.root_path);
      const newRoot = comparableRoot(file.rootPath);
      if (old && ((old.size_bytes != null && file.sizeBytes != null && old.size_bytes !== file.sizeBytes)
        || (oldRoot != null && newRoot != null && oldRoot !== newRoot))) invalidate.run(file.directory, file.name);
      upsert.run(file.directory, file.name, file.sizeBytes, normalServerFolder(file.rootPath), syncedAt);
      if (file.sidecarFile !== undefined) sides.run(file.sidecarFile, file.sidecarSig ?? null, file.directory, file.name);
      if (file.previewFile !== undefined) preview.run(file.previewFile, file.previewSig ?? null, file.directory, file.name);
    }
  });
  write.immediate();
  return files.length;
}

/**
 * Fills kind and base model from the folder and file name for every model that metadata enrichment
 * has not reached yet. Enriched rows keep what the header and sidecar proved.
 */
export function inferModelsFromNames(db: Database.Database): number {
  const rows = db.prepare('SELECT directory, name FROM model_catalog WHERE enriched_at IS NULL').all() as Array<{ directory: string; name: string }>;
  const update = db.prepare(`UPDATE model_catalog SET kind = ?, ${FAMILY_OR_WEB} WHERE directory = ? AND name = ?`);
  const write = db.transaction(() => {
    for (const row of rows) {
      const guess = inferBaseModel({ filename: row.name });
      update.run(kindFromDirectory(row.directory), ...familyArgs(guess.family, guess.evidence), row.directory, row.name);
    }
  });
  write.immediate();
  return rows.length;
}

export interface NodePackRow {
  name: string;
  version: string | null;
  commitSha: string | null;
  installedState: string;
  importState: string;
  classCount: number | null;
}

/**
 * Stores the pack list. After a complete listing a pack the server no longer lists is gone from ComfyUI too,
 * so it is dropped; after an incomplete one (echoed cursor, page cap) packs are only added or updated.
 * A listing with a failed page never reaches this function. What a pack said about itself (migration v13) stays
 * with its row: it is read again only when the pack's version or commit changes (see packsDueForInfo).
 */
export function replaceNodePacks(db: Database.Database, packs: NodePackRow[], syncedAt: number, complete = true): number {
  const upsert = db.prepare(`
    INSERT INTO node_packs (name, version, commit_sha, installed_state, import_state, class_count, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET version = excluded.version, commit_sha = excluded.commit_sha,
      installed_state = excluded.installed_state, import_state = excluded.import_state,
      class_count = excluded.class_count, synced_at = excluded.synced_at
  `);
  const write = db.transaction(() => {
    for (const pack of packs) {
      upsert.run(pack.name, pack.version, pack.commitSha, pack.installedState, pack.importState, pack.classCount, syncedAt);
    }
    if (complete) db.prepare('DELETE FROM node_packs WHERE synced_at IS NULL OR synced_at <> ?').run(syncedAt);
  });
  write.immediate();
  return packs.length;
}

/**
 * The version and commit a pack was read at. Its files are read again only when this changes, which is when the
 * pack was updated; a pack that names neither is read once.
 */
export function packInfoSig(pack: { version: string | null; commitSha: string | null }): string {
  return `${pack.version ?? ''}@${pack.commitSha ?? ''}`;
}

/** Packs whose own files were never read, or were read at another version or commit, by name. */
export function packsDueForInfo(db: Database.Database): NodePackRow[] {
  const rows = db.prepare(
    'SELECT name, version, commit_sha, installed_state, import_state, class_count, info_sig, info_read_at FROM node_packs ORDER BY name',
  ).all() as Array<{
    name: string; version: string | null; commit_sha: string | null; installed_state: string; import_state: string;
    class_count: number | null; info_sig: string | null; info_read_at: number | null;
  }>;
  return rows
    .filter((row) => row.info_read_at == null || row.info_sig !== packInfoSig({ version: row.version, commitSha: row.commit_sha }))
    .map((row) => ({
      name: row.name, version: row.version, commitSha: row.commit_sha, installedState: row.installed_state, importState: row.import_state, classCount: row.class_count,
    }));
}

/** Stores what a pack's own files said, with the version and commit they were read at. */
export function writePackInfo(
  db: Database.Database,
  name: string,
  info: { description: string; repositoryUrl: string | null; readmeSummary: string },
  sig: string,
  readAt: number,
): void {
  db.prepare('UPDATE node_packs SET description = ?, repository_url = ?, readme_summary = ?, info_sig = ?, info_read_at = ? WHERE name = ?')
    .run(info.description || null, info.repositoryUrl, info.readmeSummary || null, sig, readAt, name);
}

/**
 * After a complete class listing: drops classes an earlier sync stored that this run did not see.
 * Rows never synced (seeded or imported from a file) have no synced_at and stay.
 */
export function removeStaleNodeClasses(db: Database.Database, runStartedAt: number): number {
  return db.prepare('DELETE FROM node_catalog WHERE synced_at IS NOT NULL AND synced_at < ?').run(runStartedAt).changes;
}

/** After a complete model listing: drops model files an earlier sync stored that this run did not see. */
export function removeStaleModelFiles(db: Database.Database, runStartedAt: number): number {
  return db.prepare('DELETE FROM model_catalog WHERE synced_at IS NOT NULL AND synced_at < ?').run(runStartedAt).changes;
}

/** The same for a listing of some folders only (a server that lists checkpoints only): other folders stay. */
export function removeStaleModelFilesIn(db: Database.Database, runStartedAt: number, directories: readonly string[]): number {
  if (directories.length === 0) return 0;
  return db.prepare(`DELETE FROM model_catalog WHERE synced_at IS NOT NULL AND synced_at < ? AND directory IN (${directories.map(() => '?').join(', ')})`)
    .run(runStartedAt, ...directories).changes;
}

/**
 * SQL that sets the family to the one given, unless that is 'unknown' and Civitai named one when the file was
 * looked up: then that one stays, with 'web' as where it came from. What the file itself says always wins over
 * what the internet said. Three `?`: the family, the family again, the evidence (see familyArgs).
 */
const FAMILY_OR_WEB = `base_model = CASE WHEN ? = 'unknown' AND web_family IS NOT NULL THEN web_family ELSE ? END,
  base_model_evidence = CASE WHEN ? = 'unknown' AND web_family IS NOT NULL THEN 'web' ELSE ? END`;

function familyArgs(family: string, evidence: string): string[] {
  return [family, family, family, evidence];
}

export interface ModelEnrichment {
  kind: string;
  baseModel: string;
  baseModelEvidence: string;
  triggerWords: string[];
  description: string;
  sourceUrl: string | null;
  metadata: Record<string, string>;
  enrichedAt: number;
  /** The file's SHA-256 when a description gave it; absent or null leaves the stored one. */
  sha256?: string | null;
  /**
   * What the description file next to the model says beyond these facts, with the listing signature of the file
   * it was read from (null: there is none). Left out, the stored notes stay as they are.
   */
  sidecar?: { notes: ModelNotes; readSig: string | null };
}

export function writeModelEnrichment(db: Database.Database, directory: string, name: string, value: ModelEnrichment): void {
  const write = db.transaction(() => {
    db.prepare(`
      UPDATE model_catalog SET kind = ?, ${FAMILY_OR_WEB}, trigger_words = ?, description = ?,
        source_url = ?, metadata_json = ?, enriched_at = ?, sha256 = COALESCE(?, sha256)
      WHERE directory = ? AND name = ?
    `).run(
      value.kind,
      ...familyArgs(value.baseModel, value.baseModelEvidence),
      JSON.stringify(value.triggerWords),
      value.description,
      value.sourceUrl,
      JSON.stringify(value.metadata),
      value.enrichedAt,
      value.sha256 ?? null,
      directory,
      name,
    );
    if (value.sidecar) {
      db.prepare('UPDATE model_catalog SET notes_json = ?, sidecar_read_sig = ? WHERE directory = ? AND name = ?')
        .run(JSON.stringify(value.sidecar.notes), value.sidecar.readSig, directory, name);
    }
  });
  write.immediate();
}

/** The notes of a model's description file alone, when the facts read from the model itself stay as they are. */
export function writeModelNotes(db: Database.Database, directory: string, name: string, notes: ModelNotes, readSig: string | null, sha256: string | null = null): void {
  db.prepare('UPDATE model_catalog SET notes_json = ?, sidecar_read_sig = ?, sha256 = COALESCE(?, sha256) WHERE directory = ? AND name = ?')
    .run(JSON.stringify(notes), readSig, sha256, directory, name);
}

export interface CatalogTotals {
  nodeClasses: number;
  detailedClasses: number;
  packs: number;
  models: number;
  enrichedModels: number;
}

export function catalogTotals(db: Database.Database): CatalogTotals {
  const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return {
    // The seeded placeholder rows (ensureCatalog) are not synced classes: before a sync or an object_info import
    // they have neither synced_at nor inputs, and the count stays 0.
    nodeClasses: count("SELECT COUNT(*) AS n FROM node_catalog WHERE synced_at IS NOT NULL OR inputs_json NOT IN ('[]', '')"),
    detailedClasses: count("SELECT COUNT(*) AS n FROM node_catalog WHERE inputs_json NOT IN ('[]', '')"),
    packs: count('SELECT COUNT(*) AS n FROM node_packs'),
    models: count('SELECT COUNT(*) AS n FROM model_catalog'),
    // Files whose header or sidecar actually said something. Reading a file that had no metadata is not enrichment.
    enrichedModels: count(`SELECT COUNT(*) AS n FROM model_catalog WHERE enriched_at IS NOT NULL AND (
      metadata_json NOT IN ('{}', '') OR trigger_words NOT IN ('[]', '') OR base_model_evidence IN ('metadata', 'sidecar'))`),
  };
}

/**
 * Display name, category, and description from object_info only overwrite stored text when present,
 * so a class list read through MCP is not blanked by an object_info without those fields.
 */
export function upsertObjectInfo(
  db: Database.Database,
  parsed: ParsedObjectInfo,
  syncedAt: number | null = null,
): { nodes: number; models: number; skipped: string[] } {
  const seed = db.prepare('INSERT OR IGNORE INTO node_catalog (class_type, pack) VALUES (?, ?)');
  const upsert = db.prepare(`
    INSERT INTO node_catalog (class_type, pack, python_module, inputs_json, outputs_json, widget_order_json,
      display_name, category, description, output_node, pack_name, synced_at, flags)
    VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, ''), COALESCE(?, ''), COALESCE(?, ''), ?, ?, ?, ?)
    ON CONFLICT(class_type) DO UPDATE SET
      pack = excluded.pack,
      python_module = excluded.python_module,
      inputs_json = excluded.inputs_json,
      outputs_json = excluded.outputs_json,
      widget_order_json = excluded.widget_order_json,
      display_name = CASE WHEN excluded.display_name <> '' THEN excluded.display_name ELSE node_catalog.display_name END,
      category = CASE WHEN excluded.category <> '' THEN excluded.category ELSE node_catalog.category END,
      description = CASE WHEN excluded.description <> '' THEN excluded.description ELSE node_catalog.description END,
      output_node = excluded.output_node,
      flags = excluded.flags,
      pack_name = excluded.pack_name,
      synced_at = COALESCE(excluded.synced_at, node_catalog.synced_at)
  `);
  const model = db.prepare('INSERT OR IGNORE INTO model_catalog (directory, name) VALUES (?, ?)');
  const write = db.transaction(() => {
    for (const classType of SEEDED_NODE_TYPES) seed.run(classType, 'core');
    for (const node of parsed.nodes) {
      upsert.run(
        node.classType,
        node.pack,
        node.pythonModule,
        JSON.stringify(node.inputs),
        JSON.stringify(node.outputs),
        serializeWidgetOrder(node),
        node.displayName ?? null,
        node.category ?? null,
        node.description ?? null,
        node.outputNode ? 1 : 0,
        packNameFromModule(node.pythonModule),
        syncedAt,
        // Editing package: marks the node search and the canvas show (migration 18).
        [node.apiNode ? 'api' : '', node.deprecated ? 'deprecated' : '', node.experimental ? 'experimental' : ''].filter(Boolean).join(' '),
      );
    }
    for (const row of parsed.models) model.run(row.directory, row.name);
  });
  write.immediate();
  return { nodes: parsed.nodes.length, models: parsed.models.length, skipped: parsed.skipped };
}

function serializeWidgetOrder(node: { widgetOrder: string[]; widgetOrderReliable?: boolean }): string {
  if (node.widgetOrderReliable === false) return JSON.stringify({ reliable: false, order: [] });
  return JSON.stringify(node.widgetOrder);
}

function nodeFromRow(row: CatalogRow): CatalogNode {
  return {
    classType: row.class_type,
    pack: row.pack,
    pythonModule: typeof row.python_module === 'string' ? row.python_module : 'nodes',
    displayName: typeof row.display_name === 'string' ? row.display_name : '',
    category: typeof row.category === 'string' ? row.category : '',
    inputs: parseInputs(row.inputs_json),
    outputs: parseOutputs(row.outputs_json),
    ...parseWidgetOrder(row.widget_order_json),
  };
}

function parseWidgetOrder(text: string): { widgetOrder: string[]; widgetOrderReliable: boolean } {
  try {
    const value = JSON.parse(text);
    if (Array.isArray(value)) {
      return { widgetOrder: value.filter((item): item is string => typeof item === 'string'), widgetOrderReliable: true };
    }
    if (value && typeof value === 'object' && (value as { reliable?: unknown }).reliable === false) {
      return { widgetOrder: [], widgetOrderReliable: false };
    }
  } catch {
    return { widgetOrder: [], widgetOrderReliable: true };
  }
  return { widgetOrder: [], widgetOrderReliable: true };
}

/** The stored inputs_json of one class as catalog inputs (defaults and field metadata included). */
export function catalogInputsFromJson(text: string): CatalogInput[] {
  return parseInputs(text);
}

function parseInputs(text: string): CatalogInput[] {
  return parseArray(text).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.name !== 'string' || typeof row.type !== 'string') return [];
    const input: CatalogInput = { name: row.name, type: row.type, widget: row.widget === true };
    if (typeof row.required === 'boolean') input.required = row.required;
    // Defaults and field metadata live inside inputs_json; rows stored before they existed simply have none,
    // and a re-sync fills them. No schema migration is needed.
    if (typeof row.tooltip === 'string' && row.tooltip !== '') input.tooltip = row.tooltip;
    if (!input.widget) return [input];
    if (row.default !== undefined) input.default = row.default;
    if (Array.isArray(row.options)) input.options = row.options.filter((option): option is string => typeof option === 'string');
    if (typeof row.controlDefault === 'string') input.controlDefault = row.controlDefault;
    if (typeof row.widgetType === 'string' && row.widgetType !== '') input.widgetType = row.widgetType;
    for (const key of ['min', 'max', 'step'] as const) {
      const value = row[key];
      if (typeof value === 'number' && Number.isFinite(value)) input[key] = value;
    }
    if (row.multiline === true) input.multiline = true;
    if (row.multiSelect === true) input.multiSelect = true;
    if (row.mediaUpload === true) input.mediaUpload = true;
    return [input];
  });
}

function parseOutputs(text: string): CatalogOutput[] {
  return parseArray(text).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { name?: unknown; type?: unknown };
    if (typeof row.name !== 'string' || typeof row.type !== 'string') return [];
    return [{ name: row.name, type: row.type }];
  });
}

function parseArray(text: string): unknown[] {
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
