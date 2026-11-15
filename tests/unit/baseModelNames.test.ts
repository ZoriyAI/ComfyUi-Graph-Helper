/**
 * Protects how a model's base family (SDXL, SD 1.5, Flux, Pony, Wan and others) is read from its file name, and when
 * two families count as compatible. The app warns a person when a LoRA does not fit the checkpoint it is loaded with,
 * so a wrong guess here gives a false warning or hides a real mismatch.
 */
import { describe, expect, it } from 'vitest';
import { familiesCompatible, familyFromText, inferBaseModel, parameterSizeOf } from '../../src/shared/knowledge/baseModel';

describe('base model from release-style file names', () => {
  it.each([
    ['juggernautXL_v9.safetensors', 'sdxl'],
    ['RealVisXL_V5.0.safetensors', 'sdxl'],
    ['animagine-xl-3.1.safetensors', 'sdxl'],
    ['v1-5-pruned-emaonly.safetensors', 'sd15'],
    ['v1.5-pruned.ckpt', 'sd15'],
    ['sd15_lineart.safetensors', 'sd15'],
    ['v2-1_768-ema-pruned.safetensors', 'sd2'],
    ['768-v-ema.ckpt', 'sd2'],
    ['krea-flux-lora.safetensors', 'flux1'],
    ['flux1-krea-dev.safetensors', 'flux1'],
    ['krea2_base.safetensors', 'krea'],
    ['ponyDiffusionV6XL.safetensors', 'pony'],
    ['waiIllustriousXL_v14.safetensors', 'illustrious'],
    ['xlabs_flux_realism.safetensors', 'flux1'],
  ])('%s is %s', (name, family) => {
    expect(familyFromText(name)).toBe(family);
    expect(inferBaseModel({ filename: `loras/${name}` }).family).toBe(family);
  });

  it('does not read a plain version or a word containing xl as a family', () => {
    expect(familyFromText('style_v1.5.safetensors')).toBe('unknown');
    expect(familyFromText('pixel_art_v2.safetensors')).toBe('unknown');
    expect(familyFromText('axle_detail.safetensors')).toBe('unknown');
  });

  it('keeps Wan LoRAs of different parameter sizes apart', () => {
    expect(parameterSizeOf('wan2.2_ti2v_5B_fp16.safetensors')).toBe('5');
    expect(parameterSizeOf('Wan2_1-T2V-14B_lora.safetensors')).toBe('14');
    expect(parameterSizeOf('wan2.1_t2v_1.3B_fp16.safetensors')).toBe('1.3');
    expect(parameterSizeOf('wan_style.safetensors')).toBeNull();
    expect(familiesCompatible('wan2.2', 'wan2.2', { left: 'wan22_5b_style.safetensors', right: 'wan2.2_t2v_high_noise_14B_fp8.safetensors' })).toBe(false);
    expect(familiesCompatible('wan2.1', 'wan2.2', { left: 'wan21_14b_lora.safetensors', right: 'wan2.2_t2v_14B.safetensors' })).toBe(true);
    expect(familiesCompatible('wan2.2', 'wan2.2', { left: 'wan_style.safetensors', right: 'wan2.2_ti2v_5B.safetensors' })).toBe(true);
    expect(familiesCompatible('wan2.2', 'wan2.2')).toBe(true);
    expect(familiesCompatible('sdxl', 'flux1')).toBe(false);
    // Pony is trained on SDXL, so its LoRAs and checkpoints mix.
    expect(familiesCompatible('pony', 'sdxl')).toBe(true);
  });
});
