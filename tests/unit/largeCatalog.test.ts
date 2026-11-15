/**
 * A large ComfyUI install, thousands of classes and model files, must not stall the app: object_info is parsed and
 * stored in one transaction within seconds (main/catalog/repository.ts, run when the catalog is read over MCP or straight from ComfyUI), and the node library
 * groups those rows and renders only a screenful (library/libraryModel.ts, used by NodeLibrary and VirtualList).
 * Time budgets are loose here; npm run test:perf holds them tighter.
 */
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { readCatalog, upsertObjectInfo } from '../../src/main/catalog/repository';
import { migrate } from '../../src/main/settings/migrate';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { flattenGroups, groupByCategory, windowRange } from '../../src/renderer/components/library/libraryModel';
import type { NodeClassSummary } from '../../src/shared/contracts';
import { expectWithinBudget } from '../support/perf';

/** A synthetic object_info the size of a large install: 3300 classes, ~2000 model files, 316 LoRAs. */
function syntheticObjectInfo(classes: number) {
  const checkpoints = Array.from({ length: 1200 }, (_, index) => `checkpoints/model_${index}.safetensors`);
  const loras = Array.from({ length: 316 }, (_, index) => `lora_${index}.safetensors`);
  const vaes = Array.from({ length: 484 }, (_, index) => `vae_${index}.safetensors`);
  const document: Record<string, unknown> = {
    CheckpointLoaderSimple: {
      input: { required: { ckpt_name: [checkpoints, {}] } }, input_order: { required: ['ckpt_name'] },
      output: ['MODEL', 'CLIP', 'VAE'], output_name: ['MODEL', 'CLIP', 'VAE'], name: 'CheckpointLoaderSimple',
      display_name: 'Load Checkpoint', description: '', python_module: 'nodes', category: 'loaders', output_node: false,
    },
    LoraLoader: {
      input: { required: { model: ['MODEL'], clip: ['CLIP'], lora_name: [loras], strength_model: ['FLOAT', { default: 1, min: -100, max: 100, step: 0.01 }] } },
      input_order: { required: ['model', 'clip', 'lora_name', 'strength_model'] },
      output: ['MODEL', 'CLIP'], name: 'LoraLoader', display_name: 'Load LoRA', description: '', python_module: 'nodes', category: 'loaders', output_node: false,
    },
    VAELoader: {
      input: { required: { vae_name: [vaes] } }, input_order: { required: ['vae_name'] },
      output: ['VAE'], name: 'VAELoader', display_name: 'Load VAE', description: '', python_module: 'nodes', category: 'loaders', output_node: false,
    },
  };
  for (let index = 0; index < classes - 3; index += 1) {
    const pack = `pack_${index % 180}`;
    document[`Custom_${index}`] = {
      input: {
        required: {
          image: ['IMAGE'],
          strength: ['FLOAT', { default: 0.5, min: 0, max: 1, step: 0.01, tooltip: 'How strong the effect is.' }],
          steps: ['INT', { default: 20, min: 1, max: 1000 }],
          mode: [['fast', 'balanced', 'quality', 'extreme']],
          seed: ['INT', { default: 0, control_after_generate: true }],
          prompt: ['STRING', { multiline: true, default: '' }],
        },
        optional: { mask: ['MASK'], latent: ['LATENT'] },
      },
      input_order: { required: ['image', 'strength', 'steps', 'mode', 'seed', 'prompt'], optional: ['mask', 'latent'] },
      output: ['IMAGE', 'MASK'], output_name: ['IMAGE', 'MASK'], name: `Custom_${index}`,
      display_name: `Custom node ${index}`, description: 'A synthetic node for the size test.',
      python_module: `custom_nodes.${pack}`, category: `${pack}/group_${index % 7}`, output_node: index % 50 === 0,
    };
  }
  return document;
}

describe('large catalog', () => {
  it('parses and stores a 3300-class object_info in one transaction within a few seconds', () => {
    const text = JSON.stringify(syntheticObjectInfo(3300));
    const db = new Database(':memory:');
    migrate(db);
    const started = performance.now();
    const parsed = parseObjectInfo(JSON.parse(text));
    const stored = upsertObjectInfo(db, parsed);
    const elapsed = performance.now() - started;
    console.log(`LARGE_CATALOG ${(text.length / (1024 * 1024)).toFixed(1)} MiB classes=${stored.nodes} models=${stored.models} parse+upsert=${elapsed.toFixed(0)} ms`);
    expect(stored.nodes).toBe(3300);
    expect(stored.models).toBe(2000);
    // A loose guard (npm run test:perf): the real read on a quiet machine is well under a second.
    expectWithinBudget('parse and store 3300 classes', elapsed, 3000);
    const catalog = readCatalog(db);
    expect(catalog.nodes.length).toBeGreaterThanOrEqual(3300);
    expect(catalog.models.filter((model) => model.directory === 'loras')).toHaveLength(316);
    db.close();
  });

  it('runs the upsert as a single write transaction (a second run updates in place)', () => {
    const db = new Database(':memory:');
    migrate(db);
    const parsed = parseObjectInfo(syntheticObjectInfo(500));
    // Count prepared statements by wrapping prepare on this one database.
    let statements = 0;
    const prepare = db.prepare.bind(db);
    (db as unknown as { prepare: typeof db.prepare }).prepare = ((sql: string) => {
      statements += 1;
      return prepare(sql);
    }) as typeof db.prepare;
    upsertObjectInfo(db, parsed);
    // Statements are prepared once, not per row.
    expect(statements).toBeLessThan(10);
    upsertObjectInfo(db, parsed);
    expect((db.prepare('SELECT COUNT(*) AS n FROM node_catalog').get() as { n: number }).n).toBeGreaterThanOrEqual(500);
    db.close();
  });

  it('groups and windows 3300 library rows quickly', () => {
    const nodes: NodeClassSummary[] = Array.from({ length: 3300 }, (_, index) => ({
      classType: `Custom_${index}`, displayName: `Custom node ${index}`, category: index % 11 === 0 ? '' : `pack_${index % 180}/sub`, pack: '', detailed: true,
    }));
    const started = performance.now();
    const groups = groupByCategory(nodes, { ranked: false, uncategorized: 'Other' });
    const rows = flattenGroups(groups, new Set());
    const elapsed = performance.now() - started;
    // 180 packs plus "Other" for the rows with no category.
    expect(groups.length).toBe(181);
    expect(groups[groups.length - 1].category).toBe('Other');
    expect(rows.length).toBe(3300 + groups.length);
    expect(groups.reduce((sum, group) => sum + group.items.length, 0)).toBe(3300);
    expectWithinBudget('group 3300 library rows', elapsed, 500);
    // Only a screenful is rendered, wherever the list is scrolled.
    // Scrolled to row 3000 of 40 px rows in an 800 px viewport: the visible rows plus a small overscan margin.
    const range = windowRange(40 * 3000, 800, 40, rows.length);
    expect(range.end - range.start).toBeLessThanOrEqual(Math.ceil(800 / 40) + 1 + 12);
    expect(range.total).toBe(rows.length * 40);
    const collapsed = flattenGroups(groups, new Set(groups.map((group) => group.category)));
    expect(collapsed).toHaveLength(groups.length);
  });
});
