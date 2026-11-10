import { describe, expect, it } from 'vitest';
import type { ModelSummary } from '../../src/shared/contracts';
import {
  fittingBases,
  fittingLoras,
  inKindGroup,
  kindGroupCounts,
  kindGroupOf,
  plainDescription,
  safeModelSource,
  sortModels,
} from '../../src/renderer/components/library/libraryModel';
import { loaderFieldFor, loaderForModel, MODEL_DRAG_TYPE, modelFromDrop, NODE_DRAG_TYPE } from '../../src/renderer/components/graph/lib/modelLoaders';

function model(directory: string, name: string, kind: ModelSummary['kind'], baseModel: ModelSummary['baseModel'], sizeBytes: number | null = 1): ModelSummary {
  return { directory, name, kind, baseModel, sizeBytes, enriched: true };
}

const CATALOG: ModelSummary[] = [
  model('checkpoints', 'ponyDiffusionV6XL.safetensors', 'checkpoint', 'pony', 6_900),
  model('checkpoints', 'juggernautXL_v9.safetensors', 'checkpoint', 'sdxl', 6_800),
  model('checkpoints', 'flux1-dev.safetensors', 'checkpoint', 'flux1', 17_000),
  model('checkpoints', 'mystery.safetensors', 'checkpoint', 'unknown', 2_000),
  model('diffusion_models', 'wan2.2_i2v_14B.safetensors', 'unet', 'wan2.2', 14_000),
  model('loras', 'PerfectBreastsPonyV2.safetensors', 'lora', 'pony', 228),
  model('loras', 'flux_realism_lora.safetensors', 'lora', 'flux1', 22),
  model('loras', 'mystery_style.safetensors', 'lora', 'unknown', 150),
  model('loras', 'wan_5B_lora.safetensors', 'lora', 'wan2.2', 300),
  model('vae', 'ae.safetensors', 'vae', 'flux1', 335),
  model('controlnet', 'union.safetensors', 'controlnet', 'sdxl', 2_500),
  model('upscale_models', '4x.pth', 'upscale', 'unknown', 64),
];

describe('model list: kind chips and order', () => {
  it('groups diffusion models with checkpoints and everything uncommon under other', () => {
    expect(kindGroupOf('unet')).toBe('checkpoint');
    expect(kindGroupOf('upscale')).toBe('other');
    expect(kindGroupOf('controlnet')).toBe('controlnet');
    expect(kindGroupCounts(CATALOG)).toEqual({ all: 12, checkpoint: 5, lora: 4, vae: 1, controlnet: 1, other: 1 });
    expect(CATALOG.filter((item) => inKindGroup(item, 'lora'))).toHaveLength(4);
    expect(CATALOG.filter((item) => inKindGroup(item, 'all'))).toHaveLength(12);
  });

  it('sorts by name (case and numbers read naturally) or largest first', () => {
    const names = sortModels([model('l', 'b_v10', 'lora', 'sdxl'), model('l', 'B_v2', 'lora', 'sdxl'), model('l', 'a', 'lora', 'sdxl')], 'name').map((item) => item.name);
    expect(names).toEqual(['a', 'B_v2', 'b_v10']);
    expect(sortModels(CATALOG, 'size').slice(0, 2).map((item) => item.name)).toEqual(['flux1-dev.safetensors', 'wan2.2_i2v_14B.safetensors']);
    const unsized = sortModels([model('l', 'x', 'lora', 'sdxl', null), model('l', 'y', 'lora', 'sdxl', 5)], 'size');
    expect(unsized.map((item) => item.name)).toEqual(['y', 'x']);
  });
});

describe('model card: what fits', () => {
  it('lists the base models of the same lineage for a LoRA, never ones of unknown family', () => {
    const pony = CATALOG.find((item) => item.name.startsWith('PerfectBreasts'))!;
    // Pony LoRAs load on SDXL-lineage checkpoints too (shared/knowledge/baseModel.ts).
    expect(fittingBases(pony, CATALOG).map((item) => item.name).sort()).toEqual(['juggernautXL_v9.safetensors', 'ponyDiffusionV6XL.safetensors']);
    expect(fittingBases(CATALOG.find((item) => item.name === 'mystery_style.safetensors')!, CATALOG)).toEqual([]);
    // A 5B Wan LoRA does not fit a 14B Wan model.
    expect(fittingBases(CATALOG.find((item) => item.name === 'wan_5B_lora.safetensors')!, CATALOG)).toEqual([]);
  });

  it('counts the LoRAs that fit a checkpoint', () => {
    const flux = CATALOG.find((item) => item.name === 'flux1-dev.safetensors')!;
    expect(fittingLoras(flux, CATALOG).map((item) => item.name)).toEqual(['flux_realism_lora.safetensors']);
    expect(fittingLoras(CATALOG.find((item) => item.name === 'mystery.safetensors')!, CATALOG)).toEqual([]);
  });

  it('shows a description as plain text and only http(s) sources', () => {
    expect(plainDescription('<p>Pony LoRA for <b>body proportions</b>.</p><p>Use &amp; enjoy&#39;</p>')).toBe("Pony LoRA for body proportions.\nUse & enjoy'");
    expect(plainDescription('<script>alert(1)</script>plain')).toBe('alert(1)plain');
    expect(safeModelSource('https://civitai.com/models/1')).toBe('https://civitai.com/models/1');
    expect(safeModelSource('javascript:alert(1)')).toBeNull();
    expect(safeModelSource(null)).toBeNull();
  });
});

describe('putting a model on the canvas', () => {
  it('finds the loader field of core and custom loaders for a folder', () => {
    expect(loaderFieldFor('LoraLoader', ['lora_name', 'strength_model'], 'loras')).toBe('lora_name');
    expect(loaderFieldFor('LoraLoaderModelOnly', [], 'loras')).toBe(null);
    expect(loaderFieldFor('LoraLoader', [], 'loras')).toBe('lora_name');
    expect(loaderFieldFor('CheckpointLoaderSimple', ['ckpt_name'], 'loras')).toBeNull();
    expect(loaderFieldFor('SomePack_LoraStack', ['lora_1', 'strength_1'], 'loras')).toBe('lora_1');
    expect(loaderFieldFor('SomePack_Loader', ['ckpt', 'vae_name'], 'vae')).toBe('vae_name');
    expect(loaderFieldFor('KSampler', ['seed', 'steps'], 'loras')).toBeNull();
  });

  it('reads a model drag and gives it the core loader with the file chosen', () => {
    const payload = { [MODEL_DRAG_TYPE]: JSON.stringify({ directory: 'loras', name: 'x.safetensors' }) };
    expect(modelFromDrop((type) => payload[type] ?? '')).toEqual({ directory: 'loras', name: 'x.safetensors' });
    expect(modelFromDrop((type) => (type === NODE_DRAG_TYPE ? '{"classType":"KSampler"}' : ''))).toBeNull();
    expect(modelFromDrop(() => 'not json')).toBeNull();
    expect(loaderForModel('loras', 'x.safetensors')).toEqual({ nodeType: 'LoraLoader', parameters: { lora_name: 'x.safetensors' } });
    expect(loaderForModel('upscale_models', '4x.pth')?.nodeType).toBe('UpscaleModelLoader');
    expect(loaderForModel('ipadapter', 'a.bin')).toBeNull();
  });
});
