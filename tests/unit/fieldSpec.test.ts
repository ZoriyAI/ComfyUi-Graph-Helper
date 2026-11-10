import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { inferModelsFromNames, readCatalog, upsertModelFiles, upsertObjectInfo } from '../../src/main/catalog/repository';
import { nodeClassDetail } from '../../src/main/knowledge/repository';
import { fieldModels } from '../../src/main/knowledge/fieldModels';
import { knowledgeHandlers } from '../../src/main/knowledge/handlers';
import { SyncService } from '../../src/main/mcp/sync';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { fieldSpecOf, modelDirectoryOf, orderByFit } from '../../src/shared/catalog/fieldSpec';
import type { GraphMutation } from '../../src/shared/commands/types';
import { IPC_CHANNELS } from '../../src/shared/ipc-channels';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';

const LORAS = ['add-detail-xl.safetensors', 'PerfectBreastsPonyV2.safetensors', 'mystery_style_v3.safetensors', 'flux_realism_lora.safetensors'];

/** A trimmed object_info with the option shapes the parser has to keep. */
const OBJECT_INFO = {
  CheckpointLoaderSimple: {
    input: { required: { ckpt_name: [['sd_xl_base_1.0.safetensors'], { tooltip: 'The checkpoint to load.' }] } },
    output: ['MODEL', 'CLIP', 'VAE'],
    python_module: 'nodes',
  },
  LoraLoader: {
    input: {
      required: {
        model: ['MODEL', { tooltip: 'The diffusion model.' }],
        clip: ['CLIP'],
        lora_name: [LORAS],
        strength_model: ['FLOAT', { default: 1, min: -100, max: 100, step: 0.01 }],
      },
    },
    input_order: { required: ['model', 'clip', 'lora_name', 'strength_model'] },
    output: ['MODEL', 'CLIP'],
    python_module: 'nodes',
  },
  KSampler: {
    input: {
      required: {
        model: ['MODEL'],
        seed: ['INT', { default: 0, min: 0, max: 0xffffffffffff, control_after_generate: true, tooltip: 'The random seed.' }],
        steps: ['INT', { default: 20, min: 1, max: 10000 }],
        sampler_name: [['euler', 'dpmpp_2m']],
      },
    },
    input_order: { required: ['model', 'seed', 'steps', 'sampler_name'] },
    output: ['LATENT'],
    python_module: 'nodes',
  },
  Odd: {
    input: {
      required: {
        text: ['STRING', { multiline: true, dynamicPrompts: true }],
        flag: ['BOOLEAN', { default: true }],
        tags: ['COMBO', { options: ['a', 'b'], multi_select: true }],
        drawn: ['STRING', { widgetType: 'COMBO', options: ['x', 'y'] }],
        bad: ['INT', { min: 'zero', step: -1 }],
        own_files: [['depth_anything_v2_vitl.pth']],
      },
    },
    output: ['STRING'],
    python_module: 'nodes',
  },
};

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  upsertObjectInfo(db, parseObjectInfo(OBJECT_INFO));
  upsertModelFiles(db, [
    { directory: 'checkpoints', name: 'sd_xl_base_1.0.safetensors', sizeBytes: 6_900_000_000 },
    { directory: 'checkpoints', name: 'ponyDiffusionV6XL.safetensors', sizeBytes: 6_900_000_000 },
    ...LORAS.map((name) => ({ directory: 'loras', name, sizeBytes: 200_000_000 })),
  ]);
  inferModelsFromNames(db);
  return db;
}

function commit(db: Database.Database, payload: GraphMutation): string | undefined {
  const current = readProjection(db, DESKTOP_PROJECT_ID)!;
  const result = commitCommand(db, {
    projectId: DESKTOP_PROJECT_ID,
    actionId: crypto.randomUUID(),
    expectedRevisionId: current.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload,
  });
  expect(result.status).toBe('applied');
  return (result.result as { nodeId?: string } | undefined)?.nodeId;
}

describe('field metadata from object_info', () => {
  it('keeps min, max, step, multiline, multi_select, tooltip and the widget constructor', () => {
    const parsed = parseObjectInfo(OBJECT_INFO);
    const input = (classType: string, name: string) => parsed.nodes.find((node) => node.classType === classType)!.inputs.find((item) => item.name === name)!;
    expect(input('LoraLoader', 'strength_model')).toMatchObject({ min: -100, max: 100, step: 0.01, default: 1 });
    expect(input('LoraLoader', 'model')).toEqual({ name: 'model', type: 'MODEL', widget: false, required: true, tooltip: 'The diffusion model.' });
    expect(input('KSampler', 'seed')).toMatchObject({ min: 0, max: 0xffffffffffff, tooltip: 'The random seed.', controlDefault: 'randomize' });
    expect(input('KSampler', 'sampler_name').options).toEqual(['euler', 'dpmpp_2m']);
    expect(input('Odd', 'text')).toMatchObject({ multiline: true, default: '' });
    expect(input('Odd', 'tags')).toMatchObject({ multiSelect: true, options: ['a', 'b'] });
    expect(input('Odd', 'drawn')).toMatchObject({ type: 'STRING', widgetType: 'COMBO', options: ['x', 'y'] });
    // Wrong-typed range values are dropped, not guessed.
    expect(input('Odd', 'bad').min).toBeUndefined();
    expect(input('Odd', 'bad').step).toBeUndefined();
  });

  it('survives the catalog round trip through inputs_json', () => {
    const db = openDb();
    const stored = readCatalog(db).nodes.find((node) => node.classType === 'LoraLoader')!;
    expect(stored.inputs.find((item) => item.name === 'strength_model')).toMatchObject({ min: -100, max: 100, step: 0.01 });
    expect(stored.inputs.find((item) => item.name === 'model')?.tooltip).toBe('The diffusion model.');
    const odd = readCatalog(db).nodes.find((node) => node.classType === 'Odd')!;
    expect(odd.inputs.find((item) => item.name === 'text')?.multiline).toBe(true);
    expect(odd.inputs.find((item) => item.name === 'drawn')?.widgetType).toBe('COMBO');
    db.close();
  });

  it('reads rows stored before field metadata existed: no spec beyond the kind', () => {
    const db = openDb();
    db.prepare('UPDATE node_catalog SET inputs_json = ? WHERE class_type = ?')
      .run(JSON.stringify([{ name: 'steps', type: 'INT', widget: true, required: true, default: 20 }]), 'KSampler');
    const detail = nodeClassDetail(db, 'KSampler')!;
    expect(detail.inputs).toEqual([{ name: 'steps', type: 'INT', widget: true, required: true, spec: { kind: 'int', default: 20 } }]);
    db.close();
  });

  it('exposes a spec on widget inputs only, and marks combos of the person\'s model files', () => {
    const db = openDb();
    const lora = nodeClassDetail(db, 'LoraLoader')!;
    expect(lora.inputs.find((item) => item.name === 'model')?.spec).toBeUndefined();
    expect(lora.inputs.find((item) => item.name === 'lora_name')?.spec).toMatchObject({ kind: 'combo', modelDirectory: 'loras' });
    expect(lora.inputs.find((item) => item.name === 'strength_model')?.spec).toMatchObject({ kind: 'float', min: -100, max: 100, step: 0.01 });
    const sampler = nodeClassDetail(db, 'KSampler')!;
    expect(sampler.inputs.find((item) => item.name === 'seed')?.spec).toMatchObject({ kind: 'int', control: 'randomize', tooltip: 'The random seed.' });
    expect(sampler.inputs.find((item) => item.name === 'sampler_name')?.spec?.modelDirectory).toBeUndefined();
    const odd = nodeClassDetail(db, 'Odd')!;
    // A list of files the catalog does not hold stays a plain list, whatever the input is called.
    expect(odd.inputs.find((item) => item.name === 'own_files')?.spec).toMatchObject({ kind: 'combo' });
    expect(odd.inputs.find((item) => item.name === 'own_files')?.spec?.modelDirectory).toBeUndefined();
    expect(odd.inputs.find((item) => item.name === 'drawn')?.spec?.kind).toBe('combo');
    expect(odd.inputs.find((item) => item.name === 'flag')?.spec).toEqual({ kind: 'boolean', default: true });
    db.close();
  });
});

describe('field spec helpers', () => {
  it('turns a catalog input into a spec only when it is a widget', () => {
    expect(fieldSpecOf({ name: 'model', type: 'MODEL', widget: false })).toBeUndefined();
    expect(fieldSpecOf({ name: 'image', type: 'IMAGEUPLOAD', widget: true })).toEqual({ kind: 'other' });
  });

  it('decides a model folder by matching options, with the loader folder winning a tie', () => {
    const index = new Map([['a.safetensors', ['loras', 'checkpoints']], ['b.safetensors', ['loras']], ['sub/c.safetensors', ['checkpoints']]]);
    expect(modelDirectoryOf(['a.safetensors', 'b.safetensors'], index)).toBe('loras');
    expect(modelDirectoryOf(['a.safetensors'], index, 'checkpoints')).toBe('checkpoints');
    expect(modelDirectoryOf(['sub\\c.safetensors'], index)).toBe('checkpoints');
    expect(modelDirectoryOf(['a.safetensors', 'x', 'y'], index)).toBeUndefined();
    expect(modelDirectoryOf([], index)).toBeUndefined();
  });

  it('orders fitting files first and other families last', () => {
    const ordered = orderByFit([
      { value: 'z.safetensors', fit: 'differs' as const },
      { value: 'b.safetensors', fit: 'unknown' as const },
      { value: 'a.safetensors', fit: 'related' as const },
      { value: 'c10.safetensors', fit: 'fits' as const },
      { value: 'c9.safetensors', fit: 'fits' as const },
    ]);
    expect(ordered.map((item) => item.value)).toEqual(['c9.safetensors', 'c10.safetensors', 'a.safetensors', 'b.safetensors', 'z.safetensors']);
  });
});

describe('knowledge:field-models', () => {
  it('lists the LoRAs with family, kind, size and fit to the checkpoint upstream', () => {
    const db = openDb();
    const loader = commit(db, { type: 'add-node', nodeType: 'CheckpointLoaderSimple', parameters: { ckpt_name: 'sd_xl_base_1.0.safetensors' } })!;
    const lora = commit(db, { type: 'add-node', nodeType: 'LoraLoader' })!;
    commit(db, { type: 'connect', source: loader, target: lora, sourceHandle: 'out-0', targetHandle: 'in-0' });
    const result = fieldModels(db, { projectId: DESKTOP_PROJECT_ID, nodeId: lora, input: 'lora_name' });
    expect(result.models).toBe(true);
    expect(result.reference).toEqual({ nodeId: loader, name: 'sd_xl_base_1.0.safetensors', baseModel: 'sdxl' });
    // Pony loads on SDXL but was made for Pony: "related", after the exact fits.
    expect(result.options.map((item) => [item.value, item.baseModel, item.fit])).toEqual([
      ['add-detail-xl.safetensors', 'sdxl', 'fits'],
      ['PerfectBreastsPonyV2.safetensors', 'pony', 'related'],
      ['mystery_style_v3.safetensors', 'unknown', 'unknown'],
      ['flux_realism_lora.safetensors', 'flux1', 'differs'],
    ]);
    expect(result.options[0]).toMatchObject({ directory: 'loras', kind: 'lora', sizeBytes: 200_000_000 });
    // Not connected: nothing to measure against, every file is "unknown".
    const alone = commit(db, { type: 'add-node', nodeType: 'LoraLoader' })!;
    const free = fieldModels(db, { projectId: DESKTOP_PROJECT_ID, nodeId: alone, input: 'lora_name' });
    expect(free.reference).toBeNull();
    expect(new Set(free.options.map((item) => item.fit))).toEqual(new Set(['unknown']));
    db.close();
  });

  it('answers models:false for a field that is not a model list, and validates the request', async () => {
    const db = openDb();
    const sampler = commit(db, { type: 'add-node', nodeType: 'KSampler' })!;
    expect(fieldModels(db, { projectId: DESKTOP_PROJECT_ID, nodeId: sampler, input: 'sampler_name' })).toEqual({ models: false, reference: null, options: [] });
    expect(fieldModels(db, { projectId: DESKTOP_PROJECT_ID, nodeId: 'nope', input: 'x' }).models).toBe(false);
    const handlers = knowledgeHandlers({ db: () => db, sync: new SyncService({ token: () => null, readUrl: () => '' }) });
    await expect(handlers[IPC_CHANNELS.KNOWLEDGE_FIELD_MODELS]({ projectId: DESKTOP_PROJECT_ID, nodeId: sampler })).rejects.toThrow('Knowledge request is not valid.');
    await expect(handlers[IPC_CHANNELS.KNOWLEDGE_FIELD_MODELS]({ projectId: 'missing', nodeId: sampler, input: 'seed' })).rejects.toThrow('Project was not found.');
    expect(await handlers[IPC_CHANNELS.KNOWLEDGE_FIELD_MODELS]({ projectId: DESKTOP_PROJECT_ID, nodeId: sampler, input: 'seed' })).toMatchObject({ models: false });
    db.close();
  });
});
