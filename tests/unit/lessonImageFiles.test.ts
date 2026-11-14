import { describe, expect, it } from 'vitest';
import { lessonById } from '../../src/shared/lessons/lessons';
import { FILES, fileMiss, filesOfLesson } from '../../src/shared/lessons/files';

/**
 * The files the lessons on picture model families hold a field to (sets/image-models.ts): each case its author
 * named, a right file and a wrong one, with the reason a person is told.
 */
describe('the picture-model lessons check the kind of file', () => {
  it('asks each lesson for the files its template names', () => {
    const kinds = (id: string) => filesOfLesson(lessonById(id)!).map((want) => want.kind);
    expect(kinds('sdxl')).toEqual(['sdxlCheckpoint']);
    expect(kinds('tags')).toEqual(['tagCheckpoint']);
    expect(kinds('flux')).toEqual(['flux1Model', 'clipL', 't5xxl', 'fluxAe']);
    expect(kinds('zimage-turbo')).toEqual(['zimageModel', 'qwen3Small', 'fluxAe']);
    expect(kinds('qwen-image')).toEqual(['qwenImageModel', 'qwen25vl', 'qwenImageVae']);
    expect(kinds('flux2-klein')).toEqual(['kleinModel', 'kleinEncoder', 'flux2Vae']);
    expect(kinds('sd35')).toEqual(['sd35Checkpoint']);
    expect(kinds('gguf')).toEqual(['ggufModel']);
    expect(kinds('loaders')).toEqual(['imageCheckpoint', 'vaeFull']);
  });

  it('an SD 1.5 checkpoint is not an SDXL one, and plain SDXL is not of the tag line', () => {
    expect(fileMiss('v1-5-pruned-emaonly.safetensors', FILES.sdxlCheckpoint)).toEqual({ kind: 'family', family: 'sd15' });
    expect(fileMiss('flux1-dev-fp8.safetensors', FILES.sdxlCheckpoint)).toEqual({ kind: 'family', family: 'flux1' });
    expect(fileMiss('ponyDiffusionV6XL.safetensors', FILES.sdxlCheckpoint)).toBeNull();
    expect(fileMiss('juggernautXL_v9.safetensors', FILES.tagCheckpoint)).toEqual({ kind: 'family', family: 'sdxl' });
    expect(fileMiss('noobaiXLNAIXL_vPred10.safetensors', FILES.tagCheckpoint)).toBeNull();
  });

  it('Flux.1 takes clip_l and t5xxl in their own fields and its own VAE', () => {
    expect(fileMiss('t5xxl_fp8_e4m3fn_scaled.safetensors', FILES.clipL)).toEqual({ kind: 'mark', marks: ['clipl'] });
    expect(fileMiss('clip_l.safetensors', FILES.t5xxl)).toEqual({ kind: 'mark', marks: ['t5'] });
    expect(fileMiss('umt5_xxl_fp8_e4m3fn_scaled.safetensors', FILES.t5xxl)).toEqual({ kind: 'not-mark', mark: 'umt5' });
    expect(fileMiss('ae.safetensors', FILES.fluxAe)).toBeNull();
    expect(fileMiss('sdxl_vae.safetensors', FILES.fluxAe)).toEqual({ kind: 'not-mark', mark: 'sdxl' });
    expect(fileMiss('flux2-vae.safetensors', FILES.fluxAe)).toEqual({ kind: 'not-mark', mark: 'flux2' });
    expect(fileMiss('wan2.2_t2v_high_noise_14B.safetensors', FILES.flux1Model)).toEqual({ kind: 'family', family: 'wan2.2' });
    expect(fileMiss('flux1-krea-dev_fp8_scaled.safetensors', FILES.flux1Model)).toBeNull();
  });

  it('a preview decoder is not a full VAE', () => {
    expect(fileMiss('taesdxl_decoder.safetensors', FILES.vaeFull)).toEqual({ kind: 'not-mark', mark: 'taesd' });
    expect(fileMiss('vae_approx/taef1_decoder.pth', FILES.vaeFull)).toEqual({ kind: 'not-mark', mark: 'taef' });
    expect(fileMiss('sdxl_vae.safetensors', FILES.vaeFull)).toBeNull();
  });

  it('Z-Image, Qwen-Image and Flux.2 Klein take their own encoders and VAEs', () => {
    expect(fileMiss('umt5_xxl_fp8_e4m3fn_scaled.safetensors', FILES.qwen3Small)).toEqual({ kind: 'mark', marks: ['qwen34b'] });
    expect(fileMiss('qwen_image_edit_2509_fp8.safetensors', FILES.qwenImageModel)).toEqual({ kind: 'not-mark', mark: 'edit' });
    expect(fileMiss('ae.safetensors', FILES.qwenImageVae)).toEqual({ kind: 'mark', marks: ['qwenimagevae'] });
    expect(fileMiss('qwen_3_8b_fp8mixed.safetensors', FILES.kleinEncoder)).toBeNull();
    expect(fileMiss('flux2_dev_fp8mixed.safetensors', FILES.kleinModel)).toEqual({ kind: 'mark', marks: ['klein'] });
  });

  it('a GGUF model is a .gguf of the family of the graph', () => {
    expect(fileMiss('flux1-dev-Q4_K_S.gguf', FILES.ggufModel)).toBeNull();
    expect(fileMiss('z_image_turbo-Q8_0.gguf', FILES.ggufModel)).toBeNull();
    expect(fileMiss('wan2.2_t2v_high_noise_14B_Q4_K_M.gguf', FILES.ggufModel)).toEqual({ kind: 'family', family: 'wan2.2' });
    expect(fileMiss('flux1-dev-fp8.safetensors', FILES.ggufModel)).toEqual({ kind: 'mark', marks: ['.gguf'] });
  });
});
