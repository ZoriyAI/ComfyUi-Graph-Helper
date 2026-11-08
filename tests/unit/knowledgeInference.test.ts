import { describe, expect, it } from 'vitest';
import { familiesCompatible, familyFromText, inferBaseModel } from '../../src/shared/knowledge/baseModel';
import { inferModelKind, kindFromDirectory } from '../../src/shared/knowledge/modelKind';

describe('base model inference', () => {
  it('reads the family from file names in a real LoRA library', () => {
    const table: Array<[string, string]> = [
      ['wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022.safetensors', 'wan2.2'],
      ['Wan21_CausVid_14B_T2V_lora_rank32.safetensors', 'wan2.1'],
      ['ltx-2.5-22b-ic-lora-restore-1.0.safetensors', 'ltx2'],
      ['Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors', 'qwen-image'],
      ['Z-Image-Turbo-Realism-LoRA.safetensors', 'zimage'],
      ['RealisticSnapshotKrea2V2.safetensors', 'krea'],
      ['PerfectBreastsPonyV2.safetensors', 'pony'],
      ['Band_Shirt_Crop_Top_SDXL.safetensors', 'sdxl'],
      ['aidmaWomanBodyTattoo-FLUX-V0.1.safetensors', 'flux1'],
      ['AF_AsphaltFury_FlamingSiren_ILL.safetensors', 'illustrious'],
      ['asian_v2_kroma.safetensors', 'chroma'],
      ['ip-adapter-faceid-plusv2_sdxl_lora.safetensors', 'sdxl'],
    ];
    for (const [filename, family] of table) {
      expect(inferBaseModel({ filename }), filename).toEqual({ family, evidence: 'filename' });
    }
  });

  it('does not guess for names that carry no family', () => {
    for (const filename of ['detail_tweaker.safetensors', 'my_style_v3.safetensors', 'billboard.safetensors', 'ltxv-2b-0.9.6.safetensors']) {
      expect(inferBaseModel({ filename }), filename).toEqual({ family: 'unknown', evidence: 'none' });
    }
    expect(inferBaseModel({})).toEqual({ family: 'unknown', evidence: 'none' });
  });

  it('prefers header metadata and lets a fine-tune name narrow it', () => {
    expect(inferBaseModel({ metadata: { ss_base_model_version: 'zimage' }, filename: 'x_sdxl.safetensors' }))
      .toEqual({ family: 'zimage', evidence: 'metadata' });
    expect(inferBaseModel({ metadata: { ss_base_model_version: 'sdxl_base_v1-0' } })).toEqual({ family: 'sdxl', evidence: 'metadata' });
    expect(inferBaseModel({ metadata: { 'modelspec.architecture': 'flux-1-dev/lora' } })).toEqual({ family: 'flux1', evidence: 'metadata' });
    expect(inferBaseModel({ metadata: { 'modelspec.architecture': 'stable-diffusion-v1/lora' } })).toEqual({ family: 'sd15', evidence: 'metadata' });
    expect(inferBaseModel({ metadata: { ss_base_model_version: 'sd_v1' } })).toEqual({ family: 'sd15', evidence: 'metadata' });
    expect(inferBaseModel({ metadata: { ss_base_model_version: 'krea2', 'modelspec.architecture': 'krea2/lora' } })).toEqual({ family: 'krea', evidence: 'metadata' });
    expect(inferBaseModel({ metadata: { ss_base_model_version: 'sdxl_base_v1-0', ss_sd_model_name: 'ponyDiffusionV6XL_v6.safetensors' } }))
      .toEqual({ family: 'pony', evidence: 'metadata' });
    expect(inferBaseModel({ metadata: { ss_base_model_version: 'sdxl_base_v1-0' }, sidecarBaseModel: 'Illustrious' }))
      .toEqual({ family: 'illustrious', evidence: 'sidecar' });
    expect(inferBaseModel({ metadata: { ss_base_model_version: 'sdxl_base_v1-0' }, sidecarBaseModel: 'Flux.1 D' }))
      .toEqual({ family: 'sdxl', evidence: 'metadata' });
  });

  it('reads Civitai sidecar labels', () => {
    const table: Array<[string, string]> = [
      ['SD 1.5', 'sd15'], ['SD 2.1', 'sd2'], ['SDXL 1.0', 'sdxl'], ['Pony', 'pony'], ['Illustrious', 'illustrious'],
      ['NoobAI', 'illustrious'], ['Flux.1 D', 'flux1'], ['Flux.1 Krea', 'flux1'], ['krea2', 'krea'], ['Flux.2 D', 'flux2'], ['Qwen', 'qwen-image'],
      ['Wan Video 2.2 I2V-A14B', 'wan2.2'], ['Wan Video 14B t2v', 'wan2.1'], ['LTXV2', 'ltx2'], ['Hunyuan Video', 'hunyuan'],
      ['ZImageTurbo', 'zimage'], ['Chroma', 'chroma'], ['SD 3.5 Large', 'sd3'], ['Kolors', 'kolors'], ['PixArt a', 'pixart'],
      ['AuraFlow', 'auraflow'], ['Stable Cascade', 'cascade'], ['Other', 'unknown'],
    ];
    for (const [label, family] of table) {
      expect(inferBaseModel({ sidecarBaseModel: label }).family, label).toBe(family);
    }
  });

  it('keeps related lineages compatible and unknown silent', () => {
    expect(familiesCompatible('sdxl', 'pony')).toBe(true);
    expect(familiesCompatible('flux1', 'krea')).toBe(false);
    expect(familiesCompatible('wan2.1', 'wan2.2')).toBe(true);
    expect(familiesCompatible('unknown', 'flux1')).toBe(true);
    expect(familiesCompatible('sdxl', 'flux1')).toBe(false);
    expect(familiesCompatible('sd15', 'sdxl')).toBe(false);
    expect(familyFromText(null)).toBe('unknown');
  });
});

describe('model kind inference', () => {
  it('maps loader folders and lets a LoRA header override the folder', () => {
    const table: Array<[string, string]> = [
      ['checkpoints', 'checkpoint'], ['loras', 'lora'], ['vae', 'vae'], ['controlnet', 'controlnet'],
      ['upscale_models', 'upscale'], ['clip', 'clip'], ['clip_vision', 'clip_vision'], ['unet', 'unet'],
      ['diffusion_models', 'unet'], ['text_encoders', 'text_encoder'], ['embeddings', 'embedding'],
      ['style_models', 'style'], ['ipadapter', 'ipadapter'], ['sams', 'other'],
    ];
    for (const [directory, kind] of table) expect(kindFromDirectory(directory), directory).toBe(kind);
    expect(inferModelKind('checkpoints', { 'modelspec.architecture': 'stable-diffusion-xl-v1-base/lora' })).toBe('lora');
    expect(inferModelKind('checkpoints', { 'modelspec.architecture': 'stable-diffusion-xl-v1-base' })).toBe('checkpoint');
    expect(inferModelKind('checkpoints', { ss_network_module: 'networks.lora' })).toBe('lora');
  });
});

describe('knowledge labels', () => {
  it('has an English and Russian label for every family, kind, evidence, provenance, and aspect', async () => {
    const { createTranslator } = await import('../../src/shared/i18n');
    const { BASE_MODEL_FAMILIES, MODEL_KINDS, PROVENANCES, EXPLANATION_ASPECTS } = await import('../../src/shared/knowledge/schemas');
    const labels = await import('../../src/shared/knowledge/labels');
    const keys = [
      ...BASE_MODEL_FAMILIES.map(labels.familyLabelKey),
      ...MODEL_KINDS.map(labels.kindLabelKey),
      ...(['metadata', 'sidecar', 'filename', 'web', 'none'] as const).map(labels.evidenceLabelKey),
      ...PROVENANCES.map(labels.provenanceLabelKey),
      ...EXPLANATION_ASPECTS.map(labels.aspectLabelKey),
      'sync.state.running', 'check.missingNodes',
    ];
    for (const language of ['en', 'ru'] as const) {
      const t = createTranslator(language);
      for (const key of keys) expect(t(key), `${language} ${key}`).not.toBe(key);
    }
    expect(createTranslator('en')(labels.familyLabelKey('wan2.1'))).toBe('Wan 2.1');
    expect(createTranslator('ru')('check.typeMismatchesItem', { sourceType: 'VAE', targetType: 'CONDITIONING' })).toContain('CONDITIONING');
  });
});
