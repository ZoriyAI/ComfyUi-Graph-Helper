import { describe, expect, it } from 'vitest';
import { fieldHolds } from '../../src/shared/lessons/engine';
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

describe('one file check for every set', () => {
  const ruleOn = (lessonId: string, role: string, field: string) => lessonById(lessonId)!.steps.flatMap((step) => step.fields ?? []).find((rule) => rule.role === role && rule.field === field && rule.test.kind === 'file');
  const want = (lessonId: string, role: string, field: string) => {
    const rule = ruleOn(lessonId, role, field);
    if (!rule || rule.test.kind !== 'file') throw new Error(`no file rule on ${lessonId} ${role}.${field}`);
    return rule.test.want;
  };

  it('turns the table of the video set into file rules', () => {
    expect(fileMiss('wan2.2_ti2v_5B_fp16.safetensors', want('video-small', 'model', 'unet_name'))).toBeNull();
    expect(fileMiss('wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors', want('video-small', 'model', 'unet_name'))).toEqual({ kind: 'mark', marks: ['ti2v'] });
    expect(fileMiss('wan_2.1_vae.safetensors', want('video-small', 'vae', 'vae_name'))).toEqual({ kind: 'mark', marks: ['wan22vae'] });
  });

  it('turns the lists of the other sets into file rules', () => {
    expect(fileMiss('none', want('face-restore', 'restore', 'model'))).toEqual({ kind: 'not-mark', mark: 'none' });
    expect(fileMiss('GFPGANv1.4.pth', want('face-restore', 'restore', 'model'))).toBeNull();
    expect(fileMiss('flux1-dev-fp8.safetensors', want('character-kontext', 'model', 'unet_name'))).toEqual({ kind: 'mark', marks: ['kontext'] });
    expect(fileMiss('bbox/face_yolov8m.pt', want('detailer', 'detector', 'model_name'))).toBeNull();
    expect(fileMiss('segm/person_yolov8m-seg.pt', want('detailer', 'detector', 'model_name'))).toEqual({ kind: 'mark', marks: ['face', 'hand'] });
    expect(fileMiss('mmaudio_large_44k_v2_fp16.safetensors', want('audio-foley', 'model', 'mmaudio_model'))).toBeNull();
  });
});

describe('a LoRA or a ControlNet of the family of its checkpoint', () => {
  const pair = (lessonId: string, role: string) => lessonById(lessonId)!.steps.flatMap((step) => step.fields ?? []).find((rule) => rule.role === role && rule.test.kind === 'sameFamily');

  it('is asked for in the LoRA and ControlNet lessons, the one for adults included', () => {
    for (const [id, role] of [['lora-image', 'lora1'], ['lora-image', 'lora2'], ['lora-character', 'lora3'], ['controlnet', 'cnLoader'], ['controlnet-depth', 'cnLoader'], ['adult-lora', 'lora']]) {
      expect(pair(id, role), `${id} ${role}`).toMatchObject({ test: { kind: 'sameFamily', role: 'checkpoint', field: 'ckpt_name' }, why: 'sameFamily' });
    }
  });

  it('holds an SD 1.5 LoRA on an SDXL checkpoint wrong, a Pony LoRA on SDXL right, and an unknown file is not judged', () => {
    const lesson = lessonById('lora-image')!;
    const graph = (lora: string, checkpoint: string) => ({
      nodes: [
        { id: 'c', classType: 'CheckpointLoaderSimple', inputs: [], outputs: [], values: { ckpt_name: checkpoint } },
        { id: 'l', classType: 'LoraLoader', inputs: [], outputs: [], values: { lora_name: lora } },
      ],
      links: [],
    });
    const rule = pair('lora-image', 'lora1')!;
    const holds = (lora: string, checkpoint: string) => fieldHolds(new Map(graph(lora, checkpoint).nodes.map((node) => [node.id, node])), rule, { checkpoint: 'c', lora1: 'l' }, {});
    expect(lesson.id).toBe('lora-image');
    expect(holds('detail_tweaker_sd15.safetensors', 'juggernautXL_v9.safetensors')).toBe(false);
    expect(holds('style_pony_v2.safetensors', 'sd_xl_base_1.0.safetensors')).toBe(true);
    expect(holds('mystery.safetensors', 'juggernautXL_v9.safetensors')).toBe(true);
  });
});
