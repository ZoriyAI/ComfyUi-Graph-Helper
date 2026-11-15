/**
 * The graph check that warns about a LoRA of another model family than the base model it is loaded on
 * (src/main/knowledge/check), including custom loader classes and wrapper packs where the LoRA select feeds the
 * model loader, and how model files are found in a node's values (src/main/knowledge/loadedModels).
 * Why: a Flux LoRA on a Pony checkpoint runs without error but gives a broken picture; the tutor must catch it
 * whatever loader node the person uses.
 */
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { inferModelsFromNames, upsertModelFiles, upsertObjectInfo } from '../../src/main/catalog/repository';
import { checkGraph } from '../../src/main/knowledge/check';
import { catalogFileIndex, loadedModelFiles } from '../../src/main/knowledge/loadedModels';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import type { CatalogView } from '../../src/shared/catalog/types';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';

/** Core loaders plus two custom ones whose folders are not on the core list. */
const OBJECT_INFO = {
  CheckpointLoaderSimple: {
    input: { required: { ckpt_name: [['ponyDiffusionV6XL.safetensors', 'flux1-dev.safetensors']] } },
    input_order: { required: ['ckpt_name'] },
    output: ['MODEL', 'CLIP', 'VAE'],
    python_module: 'nodes',
  },
  // A pack's own LoRA loader: the field is "lora_name", but the class is not a core loader.
  StackedLoraLoader: {
    input: {
      required: {
        model: ['MODEL'],
        lora_name: [['PastelDetailPonyV2.safetensors', 'flux_realism_lora.safetensors']],
        strength: ['FLOAT', { default: 1 }],
      },
    },
    input_order: { required: ['model', 'lora_name', 'strength'] },
    output: ['MODEL'],
    python_module: 'custom_nodes.lora-stack',
  },
  // A wrapper pack: the LoRA select feeds the model loader instead of the other way round.
  WrapperLoraSelect: {
    input: { required: { lora: [['PastelDetailPonyV2.safetensors', 'flux_realism_lora.safetensors']] } },
    input_order: { required: ['lora'] },
    output: ['WRAPLORA'],
    python_module: 'custom_nodes.wrapper',
  },
  WrapperModelLoader: {
    input: { required: { model: [['flux1-dev.safetensors']] }, optional: { lora: ['WRAPLORA'] } },
    input_order: { required: ['model'], optional: ['lora'] },
    output: ['WRAPMODEL'],
    python_module: 'custom_nodes.wrapper',
  },
};

/** A workspace whose catalog holds the loaders above and their model files, with families guessed from names. */
function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  upsertObjectInfo(db, parseObjectInfo(OBJECT_INFO), 1000);
  upsertModelFiles(db, [
    { directory: 'checkpoints', name: 'ponyDiffusionV6XL.safetensors', sizeBytes: 1 },
    { directory: 'checkpoints', name: 'flux1-dev.safetensors', sizeBytes: 1 },
    { directory: 'diffusion_models', name: 'flux1-dev.safetensors', sizeBytes: 1 },
    { directory: 'loras', name: 'PastelDetailPonyV2.safetensors', sizeBytes: 1 },
    { directory: 'loras', name: 'flux_realism_lora.safetensors', sizeBytes: 1 },
  ]);
  inferModelsFromNames(db);
  return db;
}

/** A node in ComfyUI's saved workflow format; `inputs` are [name, type, link id or null]. */
function node(id: number, type: string, inputs: Array<[string, string, number | null]>, outputs: string[], widgets: unknown[] = []) {
  return {
    id,
    type,
    pos: [id * 200, 0],
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

/** Imports a workflow document into the desktop project the way the Import command does. */
function importWorkflow(db: Database.Database, document: Record<string, unknown>) {
  const current = readProjection(db, DESKTOP_PROJECT_ID)!;
  const result = commitCommand(db, {
    projectId: DESKTOP_PROJECT_ID,
    actionId: `import-${Math.random()}`,
    expectedRevisionId: current.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload: { type: 'import-workflow', document },
  });
  expect(result.status).toBe('applied');
}

/** A Pony checkpoint feeding the custom StackedLoraLoader that holds `lora`. */
function customChain(lora: string) {
  return {
    version: 1,
    state: { lastNodeId: 2, lastLinkId: 1 },
    nodes: [
      node(1, 'CheckpointLoaderSimple', [], ['MODEL', 'CLIP', 'VAE'], ['ponyDiffusionV6XL.safetensors']),
      node(2, 'StackedLoraLoader', [['model', 'MODEL', 1]], ['MODEL'], [lora, 1]),
    ],
    links: [[1, 1, 0, 2, 0, 'MODEL']],
  };
}

describe('graph check: LoRA family against the base model, for any loader', () => {
  it('reports a Flux LoRA in a custom LoRA loader on a Pony checkpoint', () => {
    const db = openDb();
    importWorkflow(db, customChain('flux_realism_lora.safetensors'));
    expect(checkGraph(db, DESKTOP_PROJECT_ID).baseModelMismatches).toEqual([{
      nodeId: '2',
      model: 'flux_realism_lora.safetensors',
      modelBase: 'flux1',
      otherNodeId: '1',
      otherModel: 'ponyDiffusionV6XL.safetensors',
      otherBase: 'pony',
    }]);
    db.close();
  });

  it('is quiet when the custom loader holds a LoRA of the same family', () => {
    const db = openDb();
    importWorkflow(db, customChain('PastelDetailPonyV2.safetensors'));
    expect(checkGraph(db, DESKTOP_PROJECT_ID).baseModelMismatches).toEqual([]);
    db.close();
  });

  it('follows a wrapper chain where the LoRA select feeds the model loader', () => {
    const db = openDb();
    importWorkflow(db, {
      version: 1,
      state: { lastNodeId: 2, lastLinkId: 1 },
      nodes: [
        node(1, 'WrapperLoraSelect', [], ['WRAPLORA'], ['PastelDetailPonyV2.safetensors']),
        node(2, 'WrapperModelLoader', [['lora', 'WRAPLORA', 1]], ['WRAPMODEL'], ['flux1-dev.safetensors']),
      ],
      links: [[1, 1, 0, 2, 0, 'WRAPLORA']],
    });
    const found = checkGraph(db, DESKTOP_PROJECT_ID).baseModelMismatches;
    // The model file exists in two folders; both are base folders, so both name the same Flux base.
    expect(found.map((item) => [item.nodeId, item.model, item.modelBase, item.otherNodeId, item.otherBase])).toEqual([
      ['1', 'PastelDetailPonyV2.safetensors', 'pony', '2', 'flux1'],
    ]);
    db.close();
  });
});

describe('loadedModelFiles', () => {
  const catalog: CatalogView = {
    nodeTypes: [],
    nodes: [],
    models: [
      { directory: 'loras', name: 'pony\\style.safetensors' },
      { directory: 'loras', name: 'shared.safetensors' },
      { directory: 'checkpoints', name: 'shared.safetensors' },
    ],
  };
  const files = catalogFileIndex(catalog);

  it('matches plain values of an unknown class against catalog files, whatever the separator', () => {
    const refs = loadedModelFiles({ data: { comfyType: 'SomePackLoader', comfy: { widgets_values: ['pony/style.safetensors', 0.8, 'not a file'] } } }, catalog, files);
    expect(refs).toEqual([{ directory: 'loras', name: 'pony\\style.safetensors' }]);
  });

  it('uses the field name to choose between folders when one name exists in several', () => {
    expect(loadedModelFiles({ data: { comfyType: 'X', parameters: { lora_name: 'shared.safetensors' } } }, catalog, files))
      .toEqual([{ directory: 'loras', name: 'shared.safetensors' }]);
    expect(loadedModelFiles({ data: { comfyType: 'X', parameters: { ckpt: 'shared.safetensors' } } }, catalog, files))
      .toEqual([{ directory: 'checkpoints', name: 'shared.safetensors' }]);
    expect(loadedModelFiles({ data: { comfyType: 'X', parameters: { file: 'shared.safetensors' } } }, catalog, files)).toHaveLength(2);
  });
});
