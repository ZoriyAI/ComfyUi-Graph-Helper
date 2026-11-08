import type Database from 'better-sqlite3';
import type { ParsedObjectInfo } from '../../shared/catalog/objectInfo';
import type { CatalogInput, CatalogNode, CatalogOutput, CatalogView } from '../../shared/catalog/types';

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
    'SELECT class_type, pack, python_module, inputs_json, outputs_json, widget_order_json FROM node_catalog ORDER BY class_type',
  ).all() as Array<{
    class_type: string;
    pack: string;
    python_module: string;
    inputs_json: string;
    outputs_json: string;
    widget_order_json: string;
  }>;
  const nodes = rows.map((row) => nodeFromRow(row));
  const models = db.prepare('SELECT directory, name FROM model_catalog ORDER BY directory, name').all() as Array<{
    directory: string;
    name: string;
  }>;
  return { nodeTypes: nodes.map((node) => node.classType), models, nodes };
}

export function upsertObjectInfo(db: Database.Database, parsed: ParsedObjectInfo): { nodes: number; models: number } {
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
        JSON.stringify(node.widgetOrder),
      );
    }
    for (const row of parsed.models) model.run(row.directory, row.name);
  });
  write.immediate();
  return { nodes: parsed.nodes.length, models: parsed.models.length };
}

function nodeFromRow(row: {
  class_type: string;
  pack: string;
  python_module: string;
  inputs_json: string;
  outputs_json: string;
  widget_order_json: string;
}): CatalogNode {
  return {
    classType: row.class_type,
    pack: row.pack,
    pythonModule: typeof row.python_module === 'string' ? row.python_module : 'nodes',
    inputs: parseInputs(row.inputs_json),
    outputs: parseOutputs(row.outputs_json),
    widgetOrder: parseNames(row.widget_order_json),
  };
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

function parseNames(text: string): string[] {
  return parseArray(text).filter((item): item is string => typeof item === 'string');
}

function parseArray(text: string): unknown[] {
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
