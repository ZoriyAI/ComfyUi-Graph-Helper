import type Database from 'better-sqlite3';
import type { CatalogView } from '../../shared/workflow/codec';

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
  const nodeTypes = (db.prepare('SELECT class_type FROM node_catalog ORDER BY class_type').all() as Array<{ class_type: string }>).map(
    (row) => row.class_type,
  );
  const models = db.prepare('SELECT directory, name FROM model_catalog ORDER BY directory, name').all() as Array<{
    directory: string;
    name: string;
  }>;
  return { nodeTypes, models };
}
