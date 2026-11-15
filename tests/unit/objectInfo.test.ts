/**
 * Parsing ComfyUI's object_info into the node catalog (src/shared/catalog/objectInfo, stored by
 * src/main/catalog/repository) and using its widget order to change a field by name (the set-parameter command):
 * combo and model folders, the hidden "control after generate" slots the ComfyUI frontend adds, size limits,
 * broken entries, and refusal whenever the stored values and the catalog order disagree.
 * Why: a value written into the wrong slot of widgets_values silently breaks the person's workflow in ComfyUI,
 * so a write happens only when the slot is certain.
 */
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { readCatalog, upsertObjectInfo, SEEDED_NODE_TYPES } from '../../src/main/catalog/repository';
import { migrate } from '../../src/main/settings/migrate';
import {
  assertObjectInfoSize,
  ObjectInfoError,
  parseObjectInfo,
} from '../../src/shared/catalog/objectInfo';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { missingDeps } from '../../src/shared/workflow/codec';

/** A small object_info: one core loader, KSampler with a seed, and a custom-pack loader using the COMBO form. */
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

/** A migrated in-memory database with the desktop workspace ready. */
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
    expect(sampler?.inputs.find((input) => input.name === 'model')).toEqual({ name: 'model', type: 'MODEL', widget: false, required: true });
    expect(parsed.models).toEqual([
      { directory: 'checkpoints', name: 'known.safetensors' },
      { directory: 'vae', name: 'vae.safetensors' },
    ]);
    expect(parsed.nodes.find((node) => node.classType === 'VAELoader')?.pythonModule).toBe('custom_nodes.example');
  });

  it('rejects a non-object snapshot and a nonsense size, but never caps a real size', () => {
    // A real object_info of a large install is tens of MB; the cap is several times that (parsing holds the app).
    expect(() => parseObjectInfo([])).toThrow(ObjectInfoError);
    expect(() => parseObjectInfo({ KSampler: null })).toThrow(/not object_info/);
    expect(() => assertObjectInfoSize(Number.NaN)).toThrow(ObjectInfoError);
    expect(() => assertObjectInfoSize(-1)).toThrow(ObjectInfoError);
    expect(() => assertObjectInfoSize(100 * 1024 * 1024)).not.toThrow();
    // Far above any real install: a broken or hostile answer is stopped instead of freezing the app.
    expect(() => assertObjectInfoSize(200 * 1024 * 1024)).toThrow(ObjectInfoError);
    expect(() => assertObjectInfoSize(2 * 1024 * 1024 * 1024)).toThrow(ObjectInfoError);
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
    // COLOR is a widget whose slot count is not known, so the whole order of that class is marked unreliable.
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

  it('writes a named widget at the frontend slot for seed control and combo control', () => {
    const db = openDb();
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
      ChoiceNode: {
        input: {
          required: {
            choice: [['a', 'b'], { control_after_generate: true }],
            count: ['INT', { default: 1 }],
          },
        },
        input_order: { required: ['choice', 'count'] },
        output: ['LATENT'],
        python_module: 'nodes',
      },
      AmountNode: {
        input: { required: { cfg: ['FLOAT', { control_after_generate: true }] } },
        output: ['FLOAT'],
        python_module: 'nodes',
      },
    });
    // A combo with control_after_generate gets two hidden slots in the frontend: the mode and a filter list.
    expect(parsed.nodes.find((node) => node.classType === 'ChoiceNode')?.widgetOrder).toEqual([
      'choice',
      'choice::control_after_generate',
      'choice::control_filter_list',
      'count',
    ]);
    expect(parsed.nodes.find((node) => node.classType === 'AmountNode')?.widgetOrder).toEqual([
      'cfg',
      'cfg::control_after_generate',
    ]);
    upsertObjectInfo(db, parsed);
    const current = readProjection(db, DESKTOP_PROJECT_ID)!;
    const cases = [
      {
        type: 'SeedNode',
        key: 'steps',
        widgets: [1, 'randomize', 20],
        next: [1, 'randomize', 99],
      },
      {
        type: 'NoiseNode',
        key: 'cfg',
        widgets: [5, 'fixed', 8],
        next: [5, 'fixed', 99],
      },
      {
        type: 'ChoiceNode',
        key: 'choice',
        widgets: ['a', 'randomize', '', 1],
        next: ['b', 'randomize', '', 1],
        value: 'b',
      },
    ];
    let expected = current.currentRevisionId;
    for (const [index, item] of cases.entries()) {
      const imported = commitCommand(db, {
        projectId: DESKTOP_PROJECT_ID,
        actionId: `import-layout-${index}`,
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
      const changed = commitCommand(db, {
        projectId: DESKTOP_PROJECT_ID,
        actionId: `param-layout-${index}`,
        expectedRevisionId: imported.projection!.currentRevisionId,
        actor: 'manual',
        runId: null,
        payload: { type: 'set-parameter', nodeId: '1', key: item.key, value: item.value ?? 99 },
      });
      expect(changed.status).toBe('applied');
      const node = (readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.nodes as Array<Record<string, any>>)[0];
      expect(node.data.comfy.widgets_values).toEqual(item.next);
      expected = changed.projection!.currentRevisionId;
    }
    db.close();
  });

  it('does not invent a control slot for STRING or BOOLEAN, and does not write the wrong index', () => {
    const db = openDb();
    const parsed = parseObjectInfo({
      TextNode: {
        input: {
          required: {
            text: ['STRING', { control_after_generate: true }],
            enabled: ['BOOLEAN', { control_after_generate: 'randomize' }],
          },
        },
        input_order: { required: ['text', 'enabled'] },
        output: ['STRING'],
        python_module: 'nodes',
      },
      MixedNode: {
        input: {
          required: {
            choice: [['a', 'b'], { control_after_generate: true }],
            text: ['STRING', { control_after_generate: true }],
          },
        },
        input_order: { required: ['choice', 'text'] },
        output: ['STRING'],
        python_module: 'nodes',
      },
    });
    expect(parsed.nodes.find((node) => node.classType === 'TextNode')?.widgetOrder).toEqual(['text', 'enabled']);
    expect(parsed.nodes.find((node) => node.classType === 'MixedNode')?.widgetOrder).toEqual([
      'choice',
      'choice::control_after_generate',
      'choice::control_filter_list',
      'text',
    ]);
    upsertObjectInfo(db, parsed);
    let expected = readProjection(db, DESKTOP_PROJECT_ID)!.currentRevisionId;
    const phantom = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'import-phantom',
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
            type: 'TextNode',
            pos: [0, 0],
            size: [1, 1],
            flags: {},
            order: 0,
            mode: 0,
            properties: {},
            widgets_values: ['hello', 'randomize', true],
          }],
          links: [],
        },
      },
    });
    expect(phantom.status).toBe('applied');
    const beforePhantom = JSON.stringify(readProjection(db, DESKTOP_PROJECT_ID));
    const rejected = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'param-phantom',
      expectedRevisionId: phantom.projection!.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'set-parameter', nodeId: '1', key: 'text', value: 99 },
    });
    expect(rejected.status).toBe('rejected');
    expect(rejected.result).toEqual({ error: 'Catalog widget order does not match widgets_values.' });
    expect(JSON.stringify(readProjection(db, DESKTOP_PROJECT_ID))).toBe(beforePhantom);

    expected = phantom.projection!.currentRevisionId;
    const mixed = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'import-mixed',
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
            type: 'MixedNode',
            pos: [0, 0],
            size: [1, 1],
            flags: {},
            order: 0,
            mode: 0,
            properties: {},
            widgets_values: ['a', 'randomize', '', 'hi'],
          }],
          links: [],
        },
      },
    });
    expect(mixed.status).toBe('applied');
    const written = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'param-text',
      expectedRevisionId: mixed.projection!.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'set-parameter', nodeId: '1', key: 'text', value: 99 },
    });
    expect(written.status).toBe('applied');
    const node = (readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.nodes as Array<Record<string, any>>)[0];
    expect(node.data.comfy.widgets_values).toEqual(['a', 'randomize', '', 99]);
    db.close();
  });

  it('treats widgetType as the widget constructor, including an implicit INT seed', () => {
    const db = openDb();
    const parsed = parseObjectInfo({
      SeedAlias: {
        input: {
          required: {
            seed: ['MY_SEED', { widgetType: 'INT' }],
            steps: ['INT'],
          },
        },
        input_order: { required: ['seed', 'steps'] },
        output: ['LATENT'],
        python_module: 'nodes',
      },
      ColorAlias: {
        input: { required: { tint: ['CUSTOM', { widgetType: 'COLOR' }], strength: ['INT'] } },
        input_order: { required: ['tint', 'strength'] },
        output: ['IMAGE'],
        python_module: 'nodes',
      },
    });
    const alias = parsed.nodes.find((node) => node.classType === 'SeedAlias');
    expect(alias?.inputs.find((input) => input.name === 'seed')).toEqual({ name: 'seed', type: 'MY_SEED', widget: true, required: true, default: 0, controlDefault: 'randomize', widgetType: 'INT' });
    expect(alias?.widgetOrder).toEqual(['seed', 'seed::control_after_generate', 'steps']);
    expect(alias?.widgetOrderReliable).not.toBe(false);
    const color = parsed.nodes.find((node) => node.classType === 'ColorAlias');
    expect(color?.widgetOrderReliable).toBe(false);
    expect(color?.widgetOrder).toEqual([]);
    upsertObjectInfo(db, parsed);
    const current = readProjection(db, DESKTOP_PROJECT_ID)!;
    const imported = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'import-alias',
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
            type: 'SeedAlias',
            pos: [0, 0],
            size: [1, 1],
            flags: {},
            order: 0,
            mode: 0,
            properties: {},
            widgets_values: [1, 'randomize', 20],
          }],
          links: [],
        },
      },
    });
    expect(imported.status).toBe('applied');
    const changed = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'param-alias-steps',
      expectedRevisionId: imported.projection!.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'set-parameter', nodeId: '1', key: 'steps', value: 99 },
    });
    expect(changed.status).toBe('applied');
    const node = (readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.nodes as Array<Record<string, any>>)[0];
    expect(node.data.comfy.widgets_values).toEqual([1, 'randomize', 99]);
    db.close();
  });
});
