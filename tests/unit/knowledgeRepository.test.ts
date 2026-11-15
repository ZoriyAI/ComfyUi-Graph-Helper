import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import {
  inferModelsFromNames,
  upsertModelFiles,
  upsertNodeClasses,
  upsertObjectInfo,
  writeModelEnrichment,
  writeModelNotes,
} from '../../src/main/catalog/repository';
import { EMPTY_NOTES } from '../../src/shared/knowledge/sidecar';
import {
  catalogCounts,
  checkGraph,
  listExplanations,
  modelDetail,
  nodeClassDetail,
  saveExplanation,
  searchModels,
  searchNodeClasses,
} from '../../src/main/knowledge/repository';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';

const OBJECT_INFO = {
  CheckpointLoaderSimple: {
    input: { required: { ckpt_name: [['sd_xl_base_1.0.safetensors']] } },
    input_order: { required: ['ckpt_name'] },
    output: ['MODEL', 'CLIP', 'VAE'],
    output_name: ['MODEL', 'CLIP', 'VAE'],
    display_name: 'Load Checkpoint',
    category: 'loaders',
    description: 'Loads a diffusion model checkpoint.',
    python_module: 'nodes',
  },
  LoraLoader: {
    input: {
      required: {
        model: ['MODEL'],
        clip: ['CLIP'],
        lora_name: [['aidmaWomanBodyTattoo-FLUX-V0.1.safetensors', 'Band_Shirt_Crop_Top_SDXL.safetensors']],
        strength_model: ['FLOAT', { default: 1 }],
        strength_clip: ['FLOAT', { default: 1 }],
      },
    },
    input_order: { required: ['model', 'clip', 'lora_name', 'strength_model', 'strength_clip'] },
    output: ['MODEL', 'CLIP'],
    output_name: ['MODEL', 'CLIP'],
    display_name: 'Load LoRA',
    category: 'loaders',
    python_module: 'nodes',
  },
  KSampler: {
    input: {
      required: {
        model: ['MODEL'],
        positive: ['CONDITIONING'],
        negative: ['CONDITIONING'],
        latent_image: ['LATENT'],
        seed: ['INT', { default: 0, control_after_generate: true }],
      },
      optional: { extra: ['LATENT'] },
    },
    input_order: { required: ['model', 'positive', 'negative', 'latent_image', 'seed'], optional: ['extra'] },
    output: ['LATENT'],
    output_name: ['LATENT'],
    display_name: 'KSampler',
    category: 'sampling',
    python_module: 'nodes',
  },
  VAELoader: {
    input: { required: { vae_name: [['ae.safetensors']] } },
    output: ['VAE'],
    display_name: 'Load VAE',
    category: 'loaders',
    python_module: 'nodes',
  },
  SaveImage: {
    input: { required: { images: ['IMAGE'] } },
    output: [],
    output_node: true,
    display_name: 'Save Image',
    category: 'image',
    python_module: 'nodes',
  },
  VHS_LoadVideo: {
    input: { required: { video: ['STRING'] } },
    output: ['IMAGE'],
    display_name: 'Load Video (Upload)',
    category: 'Video Helper Suite/loaders',
    python_module: 'custom_nodes.comfyui-videohelpersuite',
  },
};

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  upsertObjectInfo(db, parseObjectInfo(OBJECT_INFO), 1000);
  return db;
}

describe('knowledge repository: node classes', () => {
  it('ranks prefix over whole word over substring and filters by category', () => {
    const db = openDb();
    upsertNodeClasses(db, [{ classType: 'PowerLoraLoaderX', module: 'custom_nodes.rgthree-comfy', displayName: 'Power Lora Loader', category: 'rgthree' }]);
    expect(searchNodeClasses(db, { query: 'lora' }).map((item) => item.classType)).toEqual(['LoraLoader', 'PowerLoraLoaderX']);
    // Prefix hits first (ties: shorter class type), then the substring hit inside "Power Lora Loader".
    expect(searchNodeClasses(db, { query: 'LOAD' }).map((item) => item.classType)).toEqual([
      'LoadImage', 'VAELoader', 'LoraLoader', 'VHS_LoadVideo', 'CheckpointLoaderSimple', 'PowerLoraLoaderX',
    ]);
    expect(searchNodeClasses(db, { query: 'video' }).map((item) => item.classType)).toEqual(['VHS_LoadVideo']);
    expect(searchNodeClasses(db, { query: 'helper' })[0]).toMatchObject({ classType: 'VHS_LoadVideo', pack: 'comfyui-videohelpersuite', detailed: true });
    expect(searchNodeClasses(db, { query: '', category: 'video helper suite' }).map((item) => item.classType)).toEqual(['VHS_LoadVideo']);
    expect(searchNodeClasses(db, { query: '', category: 'loaders' }).map((item) => item.classType)).toEqual(['VAELoader', 'LoraLoader', 'CheckpointLoaderSimple']);
    expect(searchNodeClasses(db, { query: '', limit: 2 })).toHaveLength(2);
    expect(searchNodeClasses(db, { query: 'zzz' })).toEqual([]);
    expect(searchNodeClasses(db, { query: 'power' })[0]).toMatchObject({ pack: 'rgthree-comfy', detailed: false });
    // Ten synced classes and the four editor nodes (Note, Markdown Note, Reroute, Primitive) the app always offers.
    expect(searchNodeClasses(db, { query: '' })).toHaveLength(14);
    expect(searchNodeClasses(db, { query: '', limit: 10000 })).toHaveLength(14);
    expect(() => searchNodeClasses(db, { query: 'x', limit: 10001 })).toThrow();
    upsertNodeClasses(db, Array.from({ length: 40 }, (_, index) => ({ classType: `Bulk${index}`, module: 'nodes', displayName: '', category: 'bulk' })));
    expect(searchNodeClasses(db, { query: '' })).toHaveLength(30);
    expect(searchNodeClasses(db, { query: '', limit: 10000 })).toHaveLength(54);
    db.close();
  });

  it('returns full class detail with required flags, description, and output node', () => {
    const db = openDb();
    const sampler = nodeClassDetail(db, 'KSampler');
    expect(sampler?.inputs.find((input) => input.name === 'extra')).toEqual({ name: 'extra', type: 'LATENT', widget: false, required: false });
    expect(sampler?.inputs.find((input) => input.name === 'model')).toEqual({ name: 'model', type: 'MODEL', widget: false, required: true });
    expect(sampler).toMatchObject({ pack: 'core', category: 'sampling', outputNode: false, syncedAt: 1000, widgetOrderReliable: true });
    expect(sampler?.widgetOrder).toEqual(['seed', 'seed::control_after_generate']);
    expect(nodeClassDetail(db, 'SaveImage')).toMatchObject({ outputNode: true, outputs: [] });
    expect(nodeClassDetail(db, 'CheckpointLoaderSimple')?.description).toBe('Loads a diffusion model checkpoint.');
    expect(nodeClassDetail(db, 'Nope')).toBeNull();
    db.close();
  });
});

describe('knowledge repository: models', () => {
  it('filters by directory, family, kind, and name and maps enrichment', () => {
    const db = openDb();
    upsertModelFiles(db, [
      { directory: 'loras', name: 'Band_Shirt_Crop_Top_SDXL.safetensors', sizeBytes: 10, rootPath: '/m/loras' },
      { directory: 'loras', name: 'Z-Image-Turbo-Realism-LoRA.safetensors', sizeBytes: 20, rootPath: '/m/loras' },
      { directory: 'checkpoints', name: 'sd_xl_base_1.0.safetensors', sizeBytes: 30 },
    ], 5);
    inferModelsFromNames(db);
    expect(searchModels(db, { query: '', kind: 'lora' }).map((item) => item.name)).toEqual([
      'aidmaWomanBodyTattoo-FLUX-V0.1.safetensors',
      'Band_Shirt_Crop_Top_SDXL.safetensors',
      'Z-Image-Turbo-Realism-LoRA.safetensors',
    ]);
    expect(searchModels(db, { query: '', baseModel: 'sdxl' }).map((item) => item.directory)).toEqual(['checkpoints', 'loras']);
    expect(searchModels(db, { query: 'realism', directory: 'loras' })).toEqual([
      { directory: 'loras', name: 'Z-Image-Turbo-Realism-LoRA.safetensors', kind: 'lora', baseModel: 'zimage', sizeBytes: 20, enriched: false, title: '', preview: null, mature: false },
    ]);
    writeModelEnrichment(db, 'loras', 'Z-Image-Turbo-Realism-LoRA.safetensors', {
      kind: 'lora',
      baseModel: 'zimage',
      baseModelEvidence: 'metadata',
      triggerWords: ['realism'],
      description: 'Adds realism.',
      sourceUrl: 'https://civitai.com/models/1?modelVersionId=2',
      metadata: { ss_base_model_version: 'zimage' },
      enrichedAt: 9,
    });
    expect(modelDetail(db, 'loras', 'Z-Image-Turbo-Realism-LoRA.safetensors')).toEqual({
      directory: 'loras',
      name: 'Z-Image-Turbo-Realism-LoRA.safetensors',
      kind: 'lora',
      baseModel: 'zimage',
      sizeBytes: 20,
      enriched: true,
      title: '',
      preview: null,
      mature: false,
      baseModelEvidence: 'metadata',
      triggerWords: ['realism'],
      description: 'Adds realism.',
      sourceUrl: 'https://civitai.com/models/1?modelVersionId=2',
      metadata: { ss_base_model_version: 'zimage' },
      notes: EMPTY_NOTES,
      rootPath: '/m/loras',
      sha256: null,
      syncedAt: 5,
      enrichedAt: 9,
      // Never looked up on the internet; its description came from Civitai, so there is nothing to ask there.
      web: { status: null, checkedAt: null, error: null, found: null },
      civitaiKnown: true,
    });
    expect(modelDetail(db, 'loras', 'missing.safetensors')).toBeNull();

    // What the description file next to the model says: the author's name finds a file whose own name says
    // nothing of it, the preview is named by its kind, and the notes come back as they were read.
    const notes = { ...EMPTY_NOTES, title: 'Soft Film Look', tags: ['style', 'analog'], usage: { ...EMPTY_NOTES.usage, strength: 0.8 }, mature: true, previewRating: 8 };
    upsertModelFiles(db, [{ directory: 'loras', name: 'Z-Image-Turbo-Realism-LoRA.safetensors', sizeBytes: 20, rootPath: '/m/loras', sidecarFile: 'Z-Image-Turbo-Realism-LoRA.metadata.json', sidecarSig: 'x:1', previewFile: 'Z-Image-Turbo-Realism-LoRA.mp4', previewSig: 'y:2' }], 6);
    writeModelNotes(db, 'loras', 'Z-Image-Turbo-Realism-LoRA.safetensors', notes, 'x:1');
    expect(searchModels(db, { query: 'soft film' }).map((item) => item.name)).toEqual(['Z-Image-Turbo-Realism-LoRA.safetensors']);
    expect(searchModels(db, { query: 'analog' })[0]).toMatchObject({ title: 'Soft Film Look', preview: 'video', mature: true });
    expect(modelDetail(db, 'loras', 'Z-Image-Turbo-Realism-LoRA.safetensors')).toMatchObject({ title: 'Soft Film Look', preview: 'video', mature: true, notes, triggerWords: ['realism'] });
    // A listing that cannot tell what lies next to a file leaves what is stored alone; one that can, and finds nothing, clears it.
    upsertModelFiles(db, [{ directory: 'loras', name: 'Z-Image-Turbo-Realism-LoRA.safetensors', sizeBytes: 20 }], 7);
    expect(modelDetail(db, 'loras', 'Z-Image-Turbo-Realism-LoRA.safetensors')!.preview).toBe('video');
    upsertModelFiles(db, [{ directory: 'loras', name: 'Z-Image-Turbo-Realism-LoRA.safetensors', sizeBytes: 20, sidecarFile: null, sidecarSig: null, previewFile: null, previewSig: null }], 8);
    expect(modelDetail(db, 'loras', 'Z-Image-Turbo-Realism-LoRA.safetensors')!.preview).toBeNull();
    writeModelNotes(db, 'loras', 'Z-Image-Turbo-Realism-LoRA.safetensors', EMPTY_NOTES, null);
    expect(searchModels(db, { query: '', limit: 10000 })).toHaveLength(5);
    expect(catalogCounts(db)).toEqual({
      // Seeded placeholder rows that no sync or object_info filled are not counted.
      nodeClasses: 6,
      detailedClasses: 6,
      packs: 0,
      models: 5,
      enrichedModels: 1,
      byKind: [{ kind: 'lora', count: 3 }, { kind: 'checkpoint', count: 1 }, { kind: 'vae', count: 1 }],
      byFamily: [
        { kind: 'checkpoint', baseModel: 'sdxl', count: 1 },
        { kind: 'lora', baseModel: 'flux1', count: 1 },
        { kind: 'lora', baseModel: 'sdxl', count: 1 },
        { kind: 'lora', baseModel: 'zimage', count: 1 },
        { kind: 'vae', baseModel: 'unknown', count: 1 },
      ],
    });
    db.close();
  });
});

describe('knowledge repository: explanations', () => {
  it('saves project and global explanations and lists them by owner', () => {
    const db = openDb();
    const port = { kind: 'port' as const, id: 'model', nodeId: '3', portName: 'model', direction: 'input' as const };
    const local = saveExplanation(db, {
      projectId: DESKTOP_PROJECT_ID,
      owner: port,
      aspect: 'what',
      text: 'The diffusion model the sampler denoises with.',
      provenance: 'fact',
      sourceUrl: null,
      revisionId: 'rev-1',
      createdBy: 'ai',
    });
    expect(local.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(local.owner).toEqual(port);
    const global = saveExplanation(db, {
      projectId: null,
      owner: { kind: 'nodeClass', id: 'KSampler', classType: 'KSampler' },
      aspect: 'why',
      text: 'Denoises a latent.',
      provenance: 'web',
      sourceUrl: 'https://docs.comfy.org/',
      revisionId: null,
      createdBy: 'sync',
    });
    saveExplanation(db, { ...global, projectId: 'other-project', text: 'Other project note', provenance: 'user', sourceUrl: null, createdBy: 'user' } as never);
    expect(listExplanations(db, { projectId: DESKTOP_PROJECT_ID }).map((item) => item.text)).toEqual([
      'The diffusion model the sampler denoises with.',
      'Denoises a latent.',
    ]);
    expect(listExplanations(db, { projectId: null }).map((item) => item.id)).toEqual([global.id]);
    expect(listExplanations(db, { owner: port }).map((item) => item.id)).toEqual([local.id]);
    expect(listExplanations(db, { owner: { kind: 'nodeClass', id: 'KSampler' } })).toHaveLength(2);
    const row = db.prepare('SELECT owner_kind, owner_id FROM explanations WHERE id = ?').get(local.id);
    expect(row).toEqual({ owner_kind: 'port', owner_id: '3:input:model' });
    expect(() => saveExplanation(db, { ...global, sourceUrl: 'javascript:alert(1)' })).toThrow();
    expect(() => saveExplanation(db, { ...global, text: '' })).toThrow();
    db.close();
  });
});

function importWorkflow(db: Database.Database, document: Record<string, unknown>) {
  const current = readProjection(db, DESKTOP_PROJECT_ID)!;
  const result = commitCommand(db, {
    projectId: DESKTOP_PROJECT_ID,
    actionId: 'import-check',
    expectedRevisionId: current.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload: { type: 'import-workflow', document },
  });
  expect(result.status).toBe('applied');
}

function node(id: number, type: string, inputs: Array<[string, string, number | null]>, outputs: string[], widgets: unknown[] = []) {
  return {
    id,
    type,
    pos: [id * 100, 0],
    size: [100, 50],
    flags: {},
    order: id,
    mode: 0,
    properties: {},
    inputs: inputs.map(([name, type, link]) => ({ name, type, link })),
    outputs: outputs.map((type, slot) => ({ name: type, type, slot_index: slot, links: [] })),
    widgets_values: widgets,
  };
}

describe('knowledge repository: graph check', () => {
  it('reports missing classes and models, type and base-model mismatches, and unconnected inputs', () => {
    const db = openDb();
    upsertModelFiles(db, [
      { directory: 'loras', name: 'aidmaWomanBodyTattoo-FLUX-V0.1.safetensors', sizeBytes: 1 },
      { directory: 'checkpoints', name: 'sd_xl_base_1.0.safetensors', sizeBytes: 1 },
    ]);
    inferModelsFromNames(db);
    importWorkflow(db, {
      version: 1,
      state: { lastNodeId: 7, lastLinkId: 4 },
      nodes: [
        node(1, 'CheckpointLoaderSimple', [], ['MODEL', 'CLIP', 'VAE'], ['sd_xl_base_1.0.safetensors']),
        node(2, 'LoraLoader', [['model', 'MODEL', 1], ['clip', 'CLIP', 2]], ['MODEL', 'CLIP'], ['aidmaWomanBodyTattoo-FLUX-V0.1.safetensors', 1, 1]),
        node(3, 'KSampler', [['model', 'MODEL', 3], ['positive', 'CONDITIONING', 4], ['negative', 'CONDITIONING', null], ['latent_image', 'LATENT', null]], ['LATENT'], [1, 'fixed']),
        node(4, 'MysteryNode', [], ['IMAGE']),
        node(5, 'Note', [], []),
        node(6, 'VAELoader', [], ['VAE'], ['gone.safetensors']),
      ],
      links: [
        [1, 1, 0, 2, 0, 'MODEL'],
        [2, 1, 1, 2, 1, 'CLIP'],
        [3, 2, 0, 3, 0, 'MODEL'],
        [4, 1, 2, 3, 1, 'VAE'],
      ],
    });
    const report = checkGraph(db, DESKTOP_PROJECT_ID);
    expect(report.ok).toBe(false);
    expect(report.missingNodes).toEqual([{ nodeId: '4', classType: 'MysteryNode' }]);
    expect(report.unknownNodeTypes).toEqual(['MysteryNode']);
    expect(report.missingModels).toEqual([{ nodeId: '6', directory: 'vae', name: 'gone.safetensors' }]);
    expect(report.typeMismatches).toEqual([{ edgeId: 'link-4', source: '1', target: '3', sourceType: 'VAE', targetType: 'CONDITIONING' }]);
    expect(report.baseModelMismatches).toEqual([{
      nodeId: '2',
      model: 'aidmaWomanBodyTattoo-FLUX-V0.1.safetensors',
      modelBase: 'flux1',
      otherNodeId: '1',
      otherModel: 'sd_xl_base_1.0.safetensors',
      otherBase: 'sdxl',
    }]);
    expect(report.unconnectedRequiredInputs).toEqual([
      { nodeId: '3', input: 'negative', type: 'CONDITIONING' },
      { nodeId: '3', input: 'latent_image', type: 'LATENT' },
    ]);
    db.close();
  });

  it('is ok for an empty graph and refuses an unknown project', () => {
    const db = openDb();
    expect(checkGraph(db, DESKTOP_PROJECT_ID)).toEqual({
      ok: true,
      missingNodes: [],
      missingModels: [],
      typeMismatches: [],
      baseModelMismatches: [],
      unconnectedRequiredInputs: [],
      unknownNodeTypes: [],
      unsetWidgets: [],
      cycles: [],
      brokenEdges: [],
      invalidParameters: [],
      promptNotes: [],
      noOutputNode: null,
      valuesOutOfRange: [],
      valuesNotInList: [],
    });
    expect(() => checkGraph(db, 'nope')).toThrow(/not found/);
    db.close();
  });
});
