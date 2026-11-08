import type Database from 'better-sqlite3';
import type { ParsedObjectInfo } from '../../shared/catalog/objectInfo';
import type { CatalogInput, CatalogModel, CatalogNode, CatalogOutput, CatalogView } from '../../shared/catalog/types';
import type { McpModelFile, McpNodeClass } from '../../shared/mcp/catalogSource';

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
export function upsertNodeClasses(db: Database.Database, classes: McpNodeClass[]): number {
  const upsert = db.prepare(`
    INSERT INTO node_catalog (class_type, pack, python_module, display_name, category)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(class_type) DO UPDATE SET
      pack = excluded.pack,
      python_module = excluded.python_module,
      display_name = excluded.display_name,
      category = excluded.category
  `);
  const write = db.transaction(() => {
    for (const item of classes) upsert.run(item.classType, item.module, item.module, item.displayName, item.category);
  });
  write.immediate();
  return classes.length;
}

/** Stores model files an MCP server listed, with the size when it reported one. */
export function upsertModelFiles(db: Database.Database, files: McpModelFile[]): number {
  const upsert = db.prepare(`
    INSERT INTO model_catalog (directory, name, size_bytes) VALUES (?, ?, ?)
    ON CONFLICT(directory, name) DO UPDATE SET size_bytes = COALESCE(excluded.size_bytes, model_catalog.size_bytes)
  `);
  const write = db.transaction(() => {
    for (const file of files) upsert.run(file.directory, file.name, file.sizeBytes);
  });
  write.immediate();
  return files.length;
}

export function upsertObjectInfo(db: Database.Database, parsed: ParsedObjectInfo): { nodes: number; models: number; skipped: string[] } {
  const seed = db.prepare('INSERT OR IGNORE INTO node_catalog (class_type, pack) VALUES (?, ?)');
  const upsert = db.prepare(`
    INSERT INTO node_catalog (class_type, pack, python_module, inputs_json, outputs_json, widget_order_json)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(class_type) DO UPDATE SET
      pack = excluded.pack,
      python_module = excluded.python_module,
      inputs_json = excluded.inputs_json,
      outputs_json = excluded.outputs_json,
      widget_order_json = excluded.widget_order_json
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
