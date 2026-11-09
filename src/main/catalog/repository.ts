import type Database from 'better-sqlite3';
import type { ParsedObjectInfo } from '../../shared/catalog/objectInfo';
import type { CatalogInput, CatalogModel, CatalogNode, CatalogOutput, CatalogView } from '../../shared/catalog/types';
import type { McpModelFile, McpNodeClass } from '../../shared/mcp/catalogSource';
import { inferBaseModel } from '../../shared/knowledge/baseModel';
import { kindFromDirectory } from '../../shared/knowledge/modelKind';

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

/** Stores model files an MCP server listed, with the size and root folder when it reported them. */
export function upsertModelFiles(
  db: Database.Database,
  files: Array<McpModelFile & { rootPath?: string | null }>,
  syncedAt: number | null = null,
): number {
  const upsert = db.prepare(`
    INSERT INTO model_catalog (directory, name, size_bytes, root_path, synced_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(directory, name) DO UPDATE SET
      size_bytes = COALESCE(excluded.size_bytes, model_catalog.size_bytes),
      root_path = COALESCE(excluded.root_path, model_catalog.root_path),
      synced_at = COALESCE(excluded.synced_at, model_catalog.synced_at)
  `);
  const write = db.transaction(() => {
    for (const file of files) upsert.run(file.directory, file.name, file.sizeBytes, file.rootPath ?? null, syncedAt);
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
  const update = db.prepare('UPDATE model_catalog SET kind = ?, base_model = ?, base_model_evidence = ? WHERE directory = ? AND name = ?');
  const write = db.transaction(() => {
    for (const row of rows) {
      const guess = inferBaseModel({ filename: row.name });
      update.run(kindFromDirectory(row.directory), guess.family, guess.evidence, row.directory, row.name);
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
 * so the list is replaced; after an incomplete one (echoed cursor, page cap) packs are only added or updated.
 * A listing with a failed page never reaches this function.
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
    if (complete) db.prepare('DELETE FROM node_packs').run();
    for (const pack of packs) {
      upsert.run(pack.name, pack.version, pack.commitSha, pack.installedState, pack.importState, pack.classCount, syncedAt);
    }
  });
  write.immediate();
  return packs.length;
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

export interface ModelEnrichment {
  kind: string;
  baseModel: string;
  baseModelEvidence: string;
  triggerWords: string[];
  description: string;
  sourceUrl: string | null;
  metadata: Record<string, string>;
  enrichedAt: number;
}

export function writeModelEnrichment(db: Database.Database, directory: string, name: string, value: ModelEnrichment): void {
  db.prepare(`
    UPDATE model_catalog SET kind = ?, base_model = ?, base_model_evidence = ?, trigger_words = ?, description = ?,
      source_url = ?, metadata_json = ?, enriched_at = ?
    WHERE directory = ? AND name = ?
  `).run(
    value.kind,
    value.baseModel,
    value.baseModelEvidence,
    JSON.stringify(value.triggerWords),
    value.description,
    value.sourceUrl,
    JSON.stringify(value.metadata),
    value.enrichedAt,
    directory,
    name,
  );
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
    nodeClasses: count('SELECT COUNT(*) AS n FROM node_catalog'),
    detailedClasses: count("SELECT COUNT(*) AS n FROM node_catalog WHERE inputs_json NOT IN ('[]', '')"),
    packs: count('SELECT COUNT(*) AS n FROM node_packs'),
    models: count('SELECT COUNT(*) AS n FROM model_catalog'),
    enrichedModels: count('SELECT COUNT(*) AS n FROM model_catalog WHERE enriched_at IS NOT NULL'),
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
      display_name, category, description, output_node, pack_name, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, ''), COALESCE(?, ''), COALESCE(?, ''), ?, ?, ?)
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

function parseInputs(text: string): CatalogInput[] {
  return parseArray(text).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { name?: unknown; type?: unknown; widget?: unknown };
    if (typeof row.name !== 'string' || typeof row.type !== 'string') return [];
    return [{ name: row.name, type: row.type, widget: row.widget === true }];
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
