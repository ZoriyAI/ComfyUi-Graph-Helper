import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { readCatalog, upsertObjectInfo } from '../../src/main/catalog/repository';
import { checkGraph } from '../../src/main/knowledge/repository';
import { defaultParameters, parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import type { GraphMutation } from '../../src/shared/commands/types';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { exportWorkflow, widgetsFromParameters } from '../../src/shared/workflow/codec';

/** A trimmed ComfyUI object_info: the shapes core nodes really use. */
const OBJECT_INFO = {
  CheckpointLoaderSimple: {
    input: { required: { ckpt_name: [['sd_xl_base_1.0.safetensors', 'juggernautXL_v9.safetensors'], { tooltip: 'x' }] } },
    input_order: { required: ['ckpt_name'] },
    output: ['MODEL', 'CLIP', 'VAE'],
    python_module: 'nodes',
  },
  KSampler: {
    input: {
      required: {
        model: ['MODEL'],
        seed: ['INT', { default: 0, min: 0, max: 0xffffffffffff, control_after_generate: true }],
        steps: ['INT', { default: 20, min: 1 }],
        cfg: ['FLOAT', { default: 8.0, step: 0.1 }],
        sampler_name: [['euler', 'dpmpp_2m']],
        scheduler: ['COMBO', { options: ['normal', 'karras'], default: 'karras' }],
        positive: ['CONDITIONING'],
        negative: ['CONDITIONING'],
        latent_image: ['LATENT'],
        denoise: ['FLOAT', { default: 1.0 }],
      },
    },
    input_order: { required: ['model', 'seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'positive', 'negative', 'latent_image', 'denoise'] },
    output: ['LATENT'],
    python_module: 'nodes',
  },
  KSamplerAdvanced: {
    input: { required: { noise_seed: ['INT'], end_at_step: ['INT', { default: 10000 }], add_noise: [['enable', 'disable']] } },
    input_order: { required: ['noise_seed', 'end_at_step', 'add_noise'] },
    output: ['LATENT'],
    python_module: 'nodes',
  },
  Widgets: {
    input: {
      required: {
        flag: ['BOOLEAN'],
        on: ['BOOLEAN', { default: true }],
        text: ['STRING', { multiline: true }],
        prefix: ['STRING', { default: 'ComfyUI' }],
        strength: ['FLOAT', { control_after_generate: true }],
        pick: [['a', 'b'], { control_after_generate: 'increment' }],
        empty: [[]],
        linked: ['INT', { forceInput: true }],
      },
    },
    input_order: { required: ['flag', 'on', 'text', 'prefix', 'strength', 'pick', 'empty', 'linked'] },
    output: ['STRING'],
    python_module: 'nodes',
  },
  LoadImage: {
    input: { required: { image: [['example.png', 'portrait.jpg'], { image_upload: true }] } },
    input_order: { required: ['image'] },
    output: ['IMAGE', 'MASK'],
    python_module: 'nodes',
  },
};

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  upsertObjectInfo(db, parseObjectInfo(OBJECT_INFO));
  return db;
}

function commit(db: Database.Database, actionId: string, payload: GraphMutation) {
  const current = readProjection(db, DESKTOP_PROJECT_ID)!;
  const result = commitCommand(db, {
    projectId: DESKTOP_PROJECT_ID,
    actionId,
    expectedRevisionId: current.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload,
  });
  expect(result.status).toBe('applied');
  return result;
}

function nodeOf(db: Database.Database, nodeId: string): Record<string, any> {
  const nodes = readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.nodes as Array<Record<string, any>>;
  return nodes.find((node) => node.id === nodeId)!;
}

describe('widget defaults from object_info', () => {
  it('records explicit defaults, the first combo option, frontend fallbacks and control defaults', () => {
    const parsed = parseObjectInfo(OBJECT_INFO);
    const inputs = (classType: string) => Object.fromEntries(parsed.nodes.find((node) => node.classType === classType)!.inputs.map((input) => [input.name, input]));
    const ckpt = inputs('CheckpointLoaderSimple');
    expect(ckpt.ckpt_name.default).toBe('sd_xl_base_1.0.safetensors');
    expect(ckpt.ckpt_name.options).toEqual(['sd_xl_base_1.0.safetensors', 'juggernautXL_v9.safetensors']);
    const sampler = inputs('KSampler');
    expect(sampler.model.default).toBeUndefined();
    expect(sampler.seed).toMatchObject({ default: 0, controlDefault: 'randomize' });
    expect(sampler.steps.default).toBe(20);
    expect(sampler.cfg.default).toBe(8);
    expect(sampler.sampler_name.default).toBe('euler');
    expect(sampler.scheduler).toMatchObject({ default: 'karras', options: ['normal', 'karras'] });
    expect(sampler.steps.controlDefault).toBeUndefined();
    // Implicit seed control on noise_seed; INT without a default starts at 0.
    expect(inputs('KSamplerAdvanced').noise_seed).toMatchObject({ default: 0, controlDefault: 'randomize' });
    const widgets = inputs('Widgets');
    expect(widgets.flag.default).toBe(false);
    expect(widgets.on.default).toBe(true);
    expect(widgets.text.default).toBe('');
    expect(widgets.prefix.default).toBe('ComfyUI');
    expect(widgets.strength).toMatchObject({ default: 0, controlDefault: 'fixed' });
    expect(widgets.pick).toMatchObject({ default: 'a', controlDefault: 'increment' });
    expect(widgets.empty.default).toBeUndefined();
    expect(widgets.linked.default).toBeUndefined();
    expect(widgets.linked.widget).toBe(false);
  });

  it('keeps defaults inside inputs_json and reads them back', () => {
    const db = openDb();
    const catalog = readCatalog(db);
    const sampler = catalog.nodes.find((node) => node.classType === 'KSampler')!;
    expect(sampler.inputs.find((input) => input.name === 'seed')).toEqual({
      name: 'seed', type: 'INT', widget: true, required: true, default: 0, controlDefault: 'randomize', min: 0, max: 0xffffffffffff,
    });
    expect(defaultParameters(sampler)).toEqual({ seed: 0, steps: 20, cfg: 8, sampler_name: 'euler', scheduler: 'karras', denoise: 1 });
    db.close();
  });

  it('fills unset slots with defaults, control and upload slots included, and reports what has none', () => {
    const catalog = readCatalog(openDb());
    expect(widgetsFromParameters('KSampler', { steps: 30 }, catalog)).toEqual({
      ok: true,
      values: [0, 'randomize', 30, 8, 'euler', 'karras', 1],
      unset: [],
    });
    expect(widgetsFromParameters('LoadImage', {}, catalog)).toEqual({ ok: true, values: ['example.png', 'image'], unset: [] });
    expect(widgetsFromParameters('Widgets', { text: null }, catalog)).toEqual({
      ok: true,
      values: [false, true, '', 'ComfyUI', 0, 'fixed', 'a', 'increment', '', null],
      unset: ['empty'],
    });
  });

  it('exports defaults for a node with no parameters, fills nulls, and lists unset widgets', () => {
    const catalog = readCatalog(openDb());
    const snapshot = {
      nodes: [
        { id: '1', type: 'comfy', position: { x: 0, y: 0 }, data: { comfyType: 'KSampler', title: 'KSampler', parameters: {}, inputs: [], outputs: [] } },
        {
          id: '2',
          type: 'comfy',
          position: { x: 0, y: 0 },
          data: {
            comfyType: 'CheckpointLoaderSimple',
            parameters: {},
            inputs: [],
            outputs: [],
            comfy: { id: 2, type: 'CheckpointLoaderSimple', widgets_values: [null] },
          },
        },
        { id: '3', type: 'comfy', position: { x: 0, y: 0 }, data: { comfyType: 'Widgets', parameters: {}, inputs: [], outputs: [] } },
      ],
      edges: [],
      document: null,
    };
    const exported = exportWorkflow(snapshot as never, '2026-11-09T00:00:00.000Z', catalog);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const nodes = exported.workflow.nodes as Array<{ type: string; widgets_values: unknown[] }>;
    expect(nodes[0].widgets_values).toEqual([0, 'randomize', 20, 8, 'euler', 'karras', 1]);
    expect(nodes[1].widgets_values).toEqual(['sd_xl_base_1.0.safetensors']);
    expect(nodes[2].widgets_values).toContain(null);
    expect(exported.unsetWidgets).toEqual([{ nodeId: '3', classType: 'Widgets', name: 'empty' }]);
  });

  it('seeds a new node with defaults, keeps explicit values, and exports no null', () => {
    const db = openDb();
    commit(db, 'add-sampler', { type: 'add-node', nodeType: 'KSampler', parameters: { steps: 4 } });
    commit(db, 'add-loader', { type: 'add-node', nodeType: 'CheckpointLoaderSimple' });
    const sampler = nodeOf(db, '1');
    expect(sampler.data.parameters).toEqual({ seed: 0, steps: 4, cfg: 8, sampler_name: 'euler', scheduler: 'karras', denoise: 1 });
    expect(sampler.data.comfy.widgets_values).toEqual([0, 'randomize', 4, 8, 'euler', 'karras', 1]);
    expect(nodeOf(db, '2').data.parameters).toEqual({ ckpt_name: 'sd_xl_base_1.0.safetensors' });
    const exported = exportWorkflow(readProjection(db, DESKTOP_PROJECT_ID)!.snapshot as never, 'now', readCatalog(db));
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    for (const node of exported.workflow.nodes as Array<{ widgets_values: unknown[] }>) expect(node.widgets_values).not.toContain(null);
    expect(exported.unsetWidgets).toEqual([]);
    db.close();
  });

  it('keeps imported widgets_values exactly as the file had them', () => {
    const db = openDb();
    const document = {
      version: 1,
      state: { lastNodeId: 1, lastLinkId: 0 },
      nodes: [{ id: 1, type: 'KSampler', pos: [0, 0], size: [200, 80], flags: {}, order: 0, mode: 0, properties: {}, widgets_values: [7, 'fixed', 12, 3.5, 'dpmpp_2m', 'normal', 0.5] }],
      links: [],
      groups: [],
      extra: {},
    };
    commit(db, 'import', { type: 'import-workflow', document });
    const node = nodeOf(db, '1');
    expect(node.data.comfy.widgets_values).toEqual([7, 'fixed', 12, 3.5, 'dpmpp_2m', 'normal', 0.5]);
    expect(node.data.parameters).toEqual({});
    const exported = exportWorkflow(readProjection(db, DESKTOP_PROJECT_ID)!.snapshot as never, 'now', readCatalog(db));
    expect(exported.ok && (exported.workflow.nodes as Array<{ widgets_values: unknown[] }>)[0].widgets_values).toEqual([7, 'fixed', 12, 3.5, 'dpmpp_2m', 'normal', 0.5]);
    db.close();
  });

  it('graph check reports widgets with no value and no default, and not those fed by a link', () => {
    const db = openDb();
    commit(db, 'add-widgets', { type: 'add-node', nodeType: 'Widgets' });
    commit(db, 'add-sampler', { type: 'add-node', nodeType: 'KSampler' });
    const report = checkGraph(db, DESKTOP_PROJECT_ID);
    expect(report.unsetWidgets).toEqual([{ nodeId: '1', classType: 'Widgets', name: 'empty' }]);
    expect(report.ok).toBe(false);
    commit(db, 'set-empty', { type: 'set-parameter', nodeId: '1', key: 'empty', value: 'chosen' });
    expect(checkGraph(db, DESKTOP_PROJECT_ID).unsetWidgets).toEqual([]);
    db.close();
  });
});
