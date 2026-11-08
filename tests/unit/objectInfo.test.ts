import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { readCatalog, upsertObjectInfo, SEEDED_NODE_TYPES } from '../../src/main/catalog/repository';
import { migrate } from '../../src/main/settings/migrate';
import {
  assertObjectInfoSize,
  MAX_OBJECT_INFO_BYTES,
  ObjectInfoError,
  parseObjectInfo,
} from '../../src/shared/catalog/objectInfo';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { missingDeps } from '../../src/shared/workflow/codec';

const snapshot = {
  CheckpointLoaderSimple: {
    input: {
      required: {
        ckpt_name: [['known.safetensors', ''], { tooltip: 'The name of the checkpoint (model) to load.' }],
      },
    },
    input_order: { required: ['ckpt_name'] },
    output: ['MODEL', 'CLIP', 'VAE'],
    output_name: ['MODEL', 'CLIP', 'VAE'],
    name: 'CheckpointLoaderSimple',
    display_name: 'Load Checkpoint',
    description: '',
    python_module: 'nodes',
    category: 'loaders',
    output_node: false,
  },
  KSampler: {
    input: {
      required: {
        model: ['MODEL'],
        seed: ['INT', { default: 0, control_after_generate: true }],
        steps: ['INT', { default: 20 }],
        sampler_name: [['euler', 'ddim']],
      },
    },
    input_order: { required: ['model', 'seed', 'steps', 'sampler_name'] },
    output: ['LATENT'],
    output_name: ['LATENT'],
    name: 'KSampler',
    display_name: 'KSampler',
    description: '',
    python_module: 'nodes',
    category: 'sampling',
    output_node: false,
  },
  VAELoader: {
    input: {
      required: {
        vae_name: ['COMBO', { options: ['vae.safetensors'] }],
      },
    },
    input_order: { required: ['vae_name'] },
    output: ['VAE'],
    name: 'VAELoader',
    display_name: 'Load VAE',
    description: '',
    python_module: 'custom_nodes.example',
    category: 'loaders',
    output_node: false,
  },
};

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

describe('object_info catalog', () => {
  it('parses combo widgets, widget slots, and core model folders', () => {
    const parsed = parseObjectInfo(snapshot);
    const sampler = parsed.nodes.find((node) => node.classType === 'KSampler');
    expect(sampler?.widgetOrder).toEqual(['seed', 'seed::control_after_generate', 'steps', 'sampler_name']);
    expect(sampler?.inputs.find((input) => input.name === 'model')).toEqual({ name: 'model', type: 'MODEL', widget: false });
    expect(parsed.models).toEqual([
      { directory: 'checkpoints', name: 'known.safetensors' },
      { directory: 'vae', name: 'vae.safetensors' },
    ]);
    expect(parsed.nodes.find((node) => node.classType === 'VAELoader')?.pythonModule).toBe('custom_nodes.example');
  });

  it('rejects a non-object snapshot and a file past the size cap', () => {
    expect(() => parseObjectInfo([])).toThrow(ObjectInfoError);
    expect(() => parseObjectInfo({ KSampler: null })).toThrow(/not object_info/);
    expect(() => assertObjectInfoSize(MAX_OBJECT_INFO_BYTES + 1)).toThrow(/too large/);
    expect(() => assertObjectInfoSize(MAX_OBJECT_INFO_BYTES)).not.toThrow();
  });

  it('upserts guidance without dropping seed types that are absent from the file', () => {
    const db = openDb();
    const parsed = parseObjectInfo(snapshot);
    expect(upsertObjectInfo(db, parsed)).toEqual({ nodes: 3, models: 2, skipped: [] });
    const catalog = readCatalog(db);
    for (const classType of SEEDED_NODE_TYPES) {
      expect(catalog.nodeTypes).toContain(classType);
    }
    expect(catalog.nodes.find((node) => node.classType === 'SaveImage')).toMatchObject({ pack: 'core', widgetOrder: [] });
    expect(catalog.nodes.find((node) => node.classType === 'CheckpointLoaderSimple')?.outputs).toEqual([
      { name: 'MODEL', type: 'MODEL' },
      { name: 'CLIP', type: 'CLIP' },
      { name: 'VAE', type: 'VAE' },
    ]);
    expect(catalog.models).toEqual([
      { directory: 'checkpoints', name: 'known.safetensors' },
      { directory: 'vae', name: 'vae.safetensors' },
    ]);
    db.close();
  });

  it('resolves set-parameter by widget name and still rejects an unknown array key', () => {
    const db = openDb();
    upsertObjectInfo(db, parseObjectInfo(snapshot));
    const current = readProjection(db, DESKTOP_PROJECT_ID)!;
    const imported = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'import-sampler',
      expectedRevisionId: current.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: {
        type: 'import-workflow',
        document: {
          version: 1,
          state: { lastNodeId: 1, lastLinkId: 0 },
          nodes: [{
            id: 1,
            type: 'KSampler',
            pos: [0, 0],
            size: [10, 10],
            flags: {},
            order: 0,
            mode: 0,
            properties: {},
            widgets_values: [1, 'fixed', 20, 'euler'],
          }],
          links: [],
        },
      },
    });
    expect(imported.status).toBe('applied');
    const changed = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'param-steps',
      expectedRevisionId: imported.projection!.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'set-parameter', nodeId: '1', key: 'steps', value: 30 },
    });
    expect(changed.status).toBe('applied');
    const node = readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.nodes[0] as {
      data: { parameters: Record<string, unknown>; comfy: { widgets_values: unknown[] } };
    };
    expect(node.data.parameters.steps).toBe(30);
    expect(node.data.comfy.widgets_values).toEqual([1, 'fixed', 30, 'euler']);
    const rejected = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'param-missing',
      expectedRevisionId: changed.projection!.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'set-parameter', nodeId: '1', key: 'cfg', value: 7 },
    });
    expect(rejected.status).toBe('rejected');
    expect(rejected.result).toEqual({ error: 'widgetIndex is required when widgets_values is an array.' });
    db.close();
  });

  it('reports subgraph node types and properties.models against the catalog', () => {
    const db = openDb();
    upsertObjectInfo(db, parseObjectInfo(snapshot));
    const report = missingDeps({
      version: 1,
      state: { lastNodeId: 2, lastLinkId: 0 },
      nodes: [{
        id: 1,
        type: 'CheckpointLoaderSimple',
        properties: {
          models: [
            { name: 'known.safetensors', url: 'https://example.com/known', directory: 'checkpoints' },
            { name: 'missing.safetensors', url: 'https://example.com/missing', directory: 'checkpoints' },
          ],
        },
      }],
      definitions: {
        subgraphs: [{
          id: 'sg',
          nodes: [
            { id: 2, type: 'VAELoader', properties: {} },
            {
              id: 3,
              type: 'NotInCatalog',
              properties: {
                models: [{ name: 'missing.safetensors', url: 'https://example.com/missing', directory: 'checkpoints' }],
              },
            },
          ],
        }],
      },
      links: [],
    }, readCatalog(db));
    expect(report.missingNodes).toEqual(['NotInCatalog']);
    expect(report.missingModels).toEqual([{ directory: 'checkpoints', name: 'missing.safetensors' }]);
    db.close();
  });

  it('adds the frontend control slot for an implicit seed and a string control mode', () => {
    const parsed = parseObjectInfo({
      SeedNode: {
        input: { required: { seed: ['INT', { default: 0 }], steps: ['INT'] } },
        input_order: { required: ['seed', 'steps'] },
        output: ['LATENT'],
        python_module: 'nodes',
      },
      NoiseNode: {
        input: { required: { noise_seed: ['INT', { control_after_generate: 'fixed' }], cfg: ['FLOAT'] } },
        input_order: { required: ['noise_seed', 'cfg'] },
        output: ['LATENT'],
        python_module: 'nodes',
      },
    });
    expect(parsed.nodes.find((node) => node.classType === 'SeedNode')?.widgetOrder).toEqual([
      'seed',
      'seed::control_after_generate',
      'steps',
    ]);
    expect(parsed.nodes.find((node) => node.classType === 'NoiseNode')?.widgetOrder).toEqual([
      'noise_seed',
      'noise_seed::control_after_generate',
      'cfg',
    ]);
  });

  it('rejects a named write when widgets_values is shorter than the catalog order and leaves the node unchanged', () => {
    const db = openDb();
    upsertObjectInfo(db, parseObjectInfo({
      SeedNode: {
        input: { required: { seed: ['INT', { default: 0 }], steps: ['INT'] } },
        input_order: { required: ['seed', 'steps'] },
        output: ['LATENT'],
        python_module: 'nodes',
      },
      NoiseNode: {
        input: { required: { noise_seed: ['INT', { control_after_generate: 'fixed' }], cfg: ['FLOAT'] } },
        input_order: { required: ['noise_seed', 'cfg'] },
        output: ['LATENT'],
        python_module: 'nodes',
      },
      ColorNode: {
        input: { required: { tint: ['COLOR'], strength: ['INT'] } },
        input_order: { required: ['tint', 'strength'] },
        output: ['IMAGE'],
        python_module: 'nodes',
      },
    }));
    const cases = [
      { type: 'SeedNode', key: 'steps', widgets: [1, 20] },
      { type: 'NoiseNode', key: 'cfg', widgets: [5, 8] },
      { type: 'ColorNode', key: 'strength', widgets: ['#ff0000', 1] },
    ];
    let expected = readProjection(db, DESKTOP_PROJECT_ID)!.currentRevisionId;
    for (const [index, item] of cases.entries()) {
      const imported = commitCommand(db, {
        projectId: DESKTOP_PROJECT_ID,
        actionId: `import-mismatch-${index}`,
        expectedRevisionId: expected,
        actor: 'manual',
        runId: null,
        payload: {
          type: 'import-workflow',
          document: {
            version: 1,
            state: { lastNodeId: 1, lastLinkId: 0 },
            nodes: [{
              id: 1,
              type: item.type,
              pos: [0, 0],
              size: [1, 1],
              flags: {},
              order: 0,
              mode: 0,
              properties: {},
              widgets_values: item.widgets,
            }],
            links: [],
          },
        },
      });
      expect(imported.status).toBe('applied');
      const before = JSON.stringify(readProjection(db, DESKTOP_PROJECT_ID));
      const rejected = commitCommand(db, {
        projectId: DESKTOP_PROJECT_ID,
        actionId: `param-mismatch-${index}`,
        expectedRevisionId: imported.projection!.currentRevisionId,
        actor: 'manual',
        runId: null,
        payload: { type: 'set-parameter', nodeId: '1', key: item.key, value: 99 },
      });
      expect(rejected.status).toBe('rejected');
      expect(rejected.result).toEqual({ error: 'Catalog widget order does not match widgets_values.' });
      expect(JSON.stringify(readProjection(db, DESKTOP_PROJECT_ID))).toBe(before);
      expected = imported.projection!.currentRevisionId;
    }
    const color = readCatalog(db).nodes.find((node) => node.classType === 'ColorNode');
    expect(color?.widgetOrderReliable).toBe(false);
    expect(color?.widgetOrder).toEqual([]);
    db.close();
  });

  it('rejects a payload widgetIndex that disagrees with the catalog slot', () => {
    const db = openDb();
    upsertObjectInfo(db, parseObjectInfo(snapshot));
    const current = readProjection(db, DESKTOP_PROJECT_ID)!;
    const imported = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'import-disagree',
      expectedRevisionId: current.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: {
        type: 'import-workflow',
        document: {
          version: 1,
          state: { lastNodeId: 1, lastLinkId: 0 },
          nodes: [{
            id: 1,
            type: 'KSampler',
            pos: [0, 0],
            size: [1, 1],
            flags: {},
            order: 0,
            mode: 0,
            properties: {},
            widgets_values: [1, 'fixed', 20, 'euler'],
          }],
          links: [],
        },
      },
    });
    const before = JSON.stringify(readProjection(db, DESKTOP_PROJECT_ID));
    const rejected = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'param-disagree',
      expectedRevisionId: imported.projection!.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'set-parameter', nodeId: '1', key: 'steps', value: 99, widgetIndex: 0 },
    });
    expect(rejected.status).toBe('rejected');
    expect(rejected.result).toEqual({ error: 'widgetIndex does not match the catalog widget order.' });
    const outside = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'param-outside',
      expectedRevisionId: imported.projection!.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'set-parameter', nodeId: '1', key: 'steps', value: 99, widgetIndex: 9 },
    });
    expect(outside.status).toBe('rejected');
    expect(outside.result).toEqual({ error: 'widgetIndex is outside widgets_values.' });
    expect(JSON.stringify(readProjection(db, DESKTOP_PROJECT_ID))).toBe(before);
    db.close();
  });

  it('keeps a combo-list output and skips one broken node def', () => {
    const db = openDb();
    const parsed = parseObjectInfo({
      ComboOut: {
        input: { required: {} },
        output: [['a.safetensors', 'b.safetensors']],
        python_module: 'nodes',
      },
      Broken: null,
    });
    expect(parsed.skipped).toEqual(['Broken']);
    expect(parsed.nodes[0].outputs).toEqual([{ name: 'COMBO', type: 'COMBO' }]);
    const saved = upsertObjectInfo(db, parsed);
    expect(saved.skipped).toEqual(['Broken']);
    const catalog = readCatalog(db);
    expect(catalog.nodeTypes).toContain('ComboOut');
    expect(catalog.nodeTypes).not.toContain('Broken');
    for (const classType of SEEDED_NODE_TYPES) expect(catalog.nodeTypes).toContain(classType);
    db.close();
  });
});
