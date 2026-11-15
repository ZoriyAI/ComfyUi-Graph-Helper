import { describe, expect, it } from 'vitest';
import {
  classOfRole,
  fixFor,
  lessonGaps,
  lessonProgress,
  rolesOf,
  type ClassPorts,
  type Lesson,
  type LessonFacts,
  type LessonGraph,
  type LessonNode,
  type Missing,
} from '../../src/shared/lessons/engine';
import { columnsOf, lessonSpot, type FlowRect } from '../../src/shared/lessons/flow';
import { LESSONS, LESSON_AFTER, lessonById } from '../../src/shared/lessons/lessons';
import { imageModelLessonSpecs } from '../fixtures/mcp/classes/image-models';
import { videoSetSpecs } from '../fixtures/mcp/classes/video';
import { IMAGE_TECHNIQUE_LESSON_CLASSES } from '../fixtures/mcp/classes/image-techniques';
import { lessonSpecs } from '../fixtures/mcp/classes/foundations';

/**
 * ComfyUI's own nodes as far as the lessons use them: inputs with the value a fresh node starts with (link
 * inputs have none), and outputs. From nodes.py and comfy_extras (nodes_wan, nodes_video, nodes_hunyuan,
 * nodes_model_advanced).
 */
type Spec = { inputs: Array<[string, string, unknown?]>; outputs: Array<[string, string]> };
const CLASSES: Record<string, Spec> = {
  // The classes of the video set (sets/video.ts); the ones written out below take precedence.
  ...videoSetSpecs(),
  CheckpointLoaderSimple: { inputs: [['ckpt_name', 'COMBO', 'first.safetensors']], outputs: [['MODEL', 'MODEL'], ['CLIP', 'CLIP'], ['VAE', 'VAE']] },
  CLIPTextEncode: { inputs: [['text', 'STRING', ''], ['clip', 'CLIP']], outputs: [['CONDITIONING', 'CONDITIONING']] },
  EmptyLatentImage: { inputs: [['width', 'INT', 512], ['height', 'INT', 512], ['batch_size', 'INT', 1]], outputs: [['LATENT', 'LATENT']] },
  KSampler: {
    inputs: [['model', 'MODEL'], ['seed', 'INT', 0], ['steps', 'INT', 20], ['cfg', 'FLOAT', 8], ['sampler_name', 'COMBO', 'euler'], ['scheduler', 'COMBO', 'simple'], ['positive', 'CONDITIONING'], ['negative', 'CONDITIONING'], ['latent_image', 'LATENT'], ['denoise', 'FLOAT', 1]],
    outputs: [['LATENT', 'LATENT']],
  },
  VAEDecode: { inputs: [['samples', 'LATENT'], ['vae', 'VAE']], outputs: [['IMAGE', 'IMAGE']] },
  SaveImage: { inputs: [['images', 'IMAGE'], ['filename_prefix', 'STRING', 'ComfyUI']], outputs: [] },
  UNETLoader: { inputs: [['unet_name', 'COMBO', 'first.safetensors'], ['weight_dtype', 'COMBO', 'default']], outputs: [['MODEL', 'MODEL']] },
  CLIPLoader: { inputs: [['clip_name', 'COMBO', 'umt5.safetensors'], ['type', 'COMBO', 'stable_diffusion']], outputs: [['CLIP', 'CLIP']] },
  VAELoader: { inputs: [['vae_name', 'COMBO', 'vae.safetensors']], outputs: [['VAE', 'VAE']] },
  ModelSamplingSD3: { inputs: [['model', 'MODEL'], ['shift', 'FLOAT', 3]], outputs: [['MODEL', 'MODEL']] },
  EmptyHunyuanLatentVideo: { inputs: [['width', 'INT', 848], ['height', 'INT', 480], ['length', 'INT', 25], ['batch_size', 'INT', 1]], outputs: [['LATENT', 'LATENT']] },
  KSamplerAdvanced: {
    inputs: [
      ['model', 'MODEL'], ['add_noise', 'COMBO', 'enable'], ['noise_seed', 'INT', 0], ['steps', 'INT', 20], ['cfg', 'FLOAT', 8],
      ['sampler_name', 'COMBO', 'euler'], ['scheduler', 'COMBO', 'simple'], ['positive', 'CONDITIONING'], ['negative', 'CONDITIONING'],
      ['latent_image', 'LATENT'], ['start_at_step', 'INT', 0], ['end_at_step', 'INT', 10000], ['return_with_leftover_noise', 'COMBO', 'disable'],
    ],
    outputs: [['LATENT', 'LATENT']],
  },
  CreateVideo: { inputs: [['images', 'IMAGE'], ['fps', 'FLOAT', 30], ['audio', 'AUDIO']], outputs: [['VIDEO', 'VIDEO']] },
  SaveVideo: { inputs: [['video', 'VIDEO'], ['filename_prefix', 'STRING', 'video/ComfyUI'], ['format', 'COMBO', 'auto'], ['codec', 'COMBO', 'auto']], outputs: [] },
  LoadImage: { inputs: [['image', 'COMBO', 'example.png']], outputs: [['IMAGE', 'IMAGE'], ['MASK', 'MASK']] },
  WanImageToVideo: {
    inputs: [['positive', 'CONDITIONING'], ['negative', 'CONDITIONING'], ['vae', 'VAE'], ['width', 'INT', 832], ['height', 'INT', 480], ['length', 'INT', 81], ['batch_size', 'INT', 1], ['clip_vision_output', 'CLIP_VISION_OUTPUT'], ['start_image', 'IMAGE']],
    outputs: [['positive', 'CONDITIONING'], ['negative', 'CONDITIONING'], ['latent', 'LATENT']],
  },
  LoraLoaderModelOnly: { inputs: [['model', 'MODEL'], ['lora_name', 'COMBO', 'first-lora.safetensors'], ['strength_model', 'FLOAT', 1]], outputs: [['MODEL', 'MODEL']] },
  LoraLoader: {
    inputs: [['model', 'MODEL'], ['clip', 'CLIP'], ['lora_name', 'COMBO', 'first-lora.safetensors'], ['strength_model', 'FLOAT', 1], ['strength_clip', 'FLOAT', 1]],
    outputs: [['MODEL', 'MODEL'], ['CLIP', 'CLIP']],
  },
  CLIPSetLastLayer: { inputs: [['clip', 'CLIP'], ['stop_at_clip_layer', 'INT', -1]], outputs: [['CLIP', 'CLIP']] },
  VAEEncode: { inputs: [['pixels', 'IMAGE'], ['vae', 'VAE']], outputs: [['LATENT', 'LATENT']] },
  PreviewImage: { inputs: [['images', 'IMAGE']], outputs: [] },
  // ComfyUI-WanVideoWrapper, as the pack declares them.
  WanVideoModelLoader: { inputs: [['model', 'COMBO', 'wan-high.safetensors'], ['base_precision', 'COMBO', 'bf16'], ['quantization', 'COMBO', 'disabled'], ['load_device', 'COMBO', 'offload_device'], ['block_swap_args', 'BLOCKSWAPARGS'], ['lora', 'WANVIDLORA'], ['extra_model', 'VACEPATH'], ['multitalk_model', 'MULTITALKMODEL'], ['fantasytalking_model', 'FANTASYTALKINGMODEL']], outputs: [['model', 'WANVIDEOMODEL']] },
  WanVideoLoraSelect: { inputs: [['lora', 'COMBO', 'first-lora.safetensors'], ['strength', 'FLOAT', 1], ['prev_lora', 'WANVIDLORA']], outputs: [['lora', 'WANVIDLORA']] },
  LoadWanVideoT5TextEncoder: { inputs: [['model_name', 'COMBO', 'umt5.safetensors'], ['precision', 'COMBO', 'bf16']], outputs: [['wan_t5_model', 'WANTEXTENCODER']] },
  WanVideoVAELoader: { inputs: [['model_name', 'COMBO', 'wan-vae.safetensors'], ['precision', 'COMBO', 'bf16']], outputs: [['vae', 'WANVAE']] },
  WanVideoTextEncode: { inputs: [['positive_prompt', 'STRING', ''], ['negative_prompt', 'STRING', ''], ['t5', 'WANTEXTENCODER'], ['force_offload', 'BOOLEAN', true]], outputs: [['text_embeds', 'WANVIDEOTEXTEMBEDS']] },
  WanVideoEmptyEmbeds: { inputs: [['width', 'INT', 832], ['height', 'INT', 480], ['num_frames', 'INT', 81], ['control_embeds', 'WANVIDIMAGE_EMBEDS'], ['extra_latents', 'LATENT']], outputs: [['image_embeds', 'WANVIDIMAGE_EMBEDS']] },
  WanVideoImageToVideoEncode: {
    inputs: [['width', 'INT', 832], ['height', 'INT', 480], ['num_frames', 'INT', 81], ['noise_aug_strength', 'FLOAT', 0], ['start_latent_strength', 'FLOAT', 1], ['end_latent_strength', 'FLOAT', 1], ['vae', 'WANVAE'], ['clip_embeds', 'WANVIDIMAGE_CLIPEMBEDS'], ['start_image', 'IMAGE'], ['end_image', 'IMAGE']],
    outputs: [['image_embeds', 'WANVIDIMAGE_EMBEDS']],
  },
  WanVideoSampler: {
    inputs: [['model', 'WANVIDEOMODEL'], ['image_embeds', 'WANVIDIMAGE_EMBEDS'], ['steps', 'INT', 30], ['cfg', 'FLOAT', 6], ['shift', 'FLOAT', 5], ['seed', 'INT', 0], ['force_offload', 'BOOLEAN', true], ['scheduler', 'COMBO', 'unipc'], ['text_embeds', 'WANVIDEOTEXTEMBEDS'], ['samples', 'LATENT'], ['start_step', 'INT', 0], ['end_step', 'INT', -1], ['multitalk_embeds', 'MULTITALK_EMBEDS'], ['unianimate_poses', 'UNIANIMATE_POSE'], ['fantasytalking_embeds', 'FANTASYTALKING_EMBEDS']],
    outputs: [['samples', 'LATENT'], ['denoised_samples', 'LATENT']],
  },
  WanVideoDecode: { inputs: [['vae', 'WANVAE'], ['samples', 'LATENT'], ['enable_vae_tiling', 'BOOLEAN', false]], outputs: [['images', 'IMAGE']] },
  WanVideoVACEModelSelect: { inputs: [['vace_model', 'COMBO', 'vace-module.safetensors']], outputs: [['extra_model', 'VACEPATH']] },
  WanVideoVACEEncode: {
    inputs: [['vae', 'WANVAE'], ['width', 'INT', 832], ['height', 'INT', 480], ['num_frames', 'INT', 81], ['strength', 'FLOAT', 1], ['vace_start_percent', 'FLOAT', 0], ['vace_end_percent', 'FLOAT', 1], ['input_frames', 'IMAGE'], ['ref_images', 'IMAGE'], ['input_masks', 'MASK']],
    outputs: [['vace_embeds', 'WANVIDIMAGE_EMBEDS']],
  },
  WanVideoAnimateEmbeds: {
    inputs: [
      ['vae', 'WANVAE'], ['width', 'INT', 832], ['height', 'INT', 480], ['num_frames', 'INT', 81], ['frame_window_size', 'INT', 77], ['colormatch', 'COMBO', 'disabled'],
      ['pose_strength', 'FLOAT', 1], ['face_strength', 'FLOAT', 1], ['clip_embeds', 'WANVIDIMAGE_CLIPEMBEDS'], ['ref_images', 'IMAGE'], ['pose_images', 'IMAGE'], ['face_images', 'IMAGE'],
    ],
    outputs: [['image_embeds', 'WANVIDIMAGE_EMBEDS']],
  },
  WanVideoClipVisionEncode: { inputs: [['clip_vision', 'CLIP_VISION'], ['image_1', 'IMAGE'], ['strength_1', 'FLOAT', 1], ['crop', 'COMBO', 'center']], outputs: [['image_embeds', 'WANVIDIMAGE_CLIPEMBEDS']] },
  CLIPVisionLoader: { inputs: [['clip_name', 'COMBO', 'clip-vision.safetensors']], outputs: [['CLIP_VISION', 'CLIP_VISION']] },
  LoadVideo: { inputs: [['file', 'COMBO', 'clip.mp4']], outputs: [['VIDEO', 'VIDEO']] },
  GetVideoComponents: { inputs: [['video', 'VIDEO']], outputs: [['images', 'IMAGE'], ['audio', 'AUDIO'], ['fps', 'FLOAT']] },
  LoadAudio: { inputs: [['audio', 'COMBO', 'voice.wav']], outputs: [['AUDIO', 'AUDIO']] },
  OnnxDetectionModelLoader: { inputs: [['vitpose_model', 'COMBO', 'vitpose.onnx'], ['yolo_model', 'COMBO', 'vitpose.onnx'], ['onnx_device', 'COMBO', 'CUDAExecutionProvider']], outputs: [['model', 'POSEMODEL']] },
  PoseAndFaceDetection: {
    inputs: [['model', 'POSEMODEL'], ['images', 'IMAGE'], ['width', 'INT', 832], ['height', 'INT', 480]],
    outputs: [['pose_data', 'POSEDATA'], ['face_images', 'IMAGE'], ['key_frame_body_points', 'STRING'], ['bboxes', 'BBOX'], ['face_bboxes', 'BBOX,']],
  },
  DrawViTPose: { inputs: [['pose_data', 'POSEDATA'], ['width', 'INT', 832], ['height', 'INT', 480]], outputs: [['pose_images', 'IMAGE']] },
  Wav2VecModelLoader: { inputs: [['model', 'COMBO', 'wav2vec.safetensors'], ['base_precision', 'COMBO', 'fp16']], outputs: [['wav2vec_model', 'WAV2VECMODEL']] },
  MultiTalkModelLoader: { inputs: [['model', 'COMBO', 'infinitetalk.safetensors']], outputs: [['model', 'MULTITALKMODEL']] },
  MultiTalkWav2VecEmbeds: {
    inputs: [
      ['wav2vec_model', 'WAV2VECMODEL'], ['audio_1', 'AUDIO'], ['normalize_loudness', 'BOOLEAN', true], ['num_frames', 'INT', 81], ['fps', 'FLOAT', 25], ['audio_scale', 'FLOAT', 1], ['audio_cfg_scale', 'FLOAT', 1],
      ['multi_audio_type', 'COMBO', 'para'], ['audio_2', 'AUDIO'], ['audio_3', 'AUDIO'], ['audio_4', 'AUDIO'], ['ref_target_masks', 'MASK'],
    ],
    outputs: [['multitalk_embeds', 'MULTITALK_EMBEDS'], ['audio', 'AUDIO'], ['num_frames', 'INT']],
  },
  WanVideoImageToVideoMultiTalk: {
    inputs: [['vae', 'WANVAE'], ['width', 'INT', 832], ['height', 'INT', 480], ['frame_window_size', 'INT', 81], ['motion_frame', 'INT', 25], ['start_image', 'IMAGE'], ['clip_embeds', 'WANVIDIMAGE_CLIPEMBEDS']],
    outputs: [['image_embeds', 'WANVIDIMAGE_EMBEDS'], ['output_path', 'STRING']],
  },
  // FantasyTalking, UniAnimate, ReCamMaster and Ovi of the same pack (fantasytalking/, unianimate/, recammaster/, Ovi/).
  DownloadAndLoadWav2VecModel: { inputs: [['model', 'COMBO', 'TencentGameMate/chinese-wav2vec2-base'], ['base_precision', 'COMBO', 'fp16'], ['load_device', 'COMBO', 'main_device']], outputs: [['wav2vec_model', 'WAV2VECMODEL']] },
  FantasyTalkingModelLoader: { inputs: [['model', 'COMBO', 'fantasytalking.safetensors'], ['base_precision', 'COMBO', 'fp16']], outputs: [['model', 'FANTASYTALKINGMODEL']] },
  FantasyTalkingWav2VecEmbeds: {
    inputs: [['wav2vec_model', 'WAV2VECMODEL'], ['fantasytalking_model', 'FANTASYTALKINGMODEL'], ['audio', 'AUDIO'], ['num_frames', 'INT', 81], ['fps', 'FLOAT', 23], ['audio_scale', 'FLOAT', 1], ['audio_cfg_scale', 'FLOAT', 1]],
    outputs: [['fantasytalking_embeds', 'FANTASYTALKING_EMBEDS']],
  },
  WanVideoUniAnimateDWPoseDetector: {
    inputs: [['pose_images', 'IMAGE'], ['score_threshold', 'FLOAT', 0.3], ['stick_width', 'INT', 4], ['draw_body', 'BOOLEAN', true], ['reference_pose_image', 'IMAGE']],
    outputs: [['poses', 'IMAGE'], ['reference_pose', 'IMAGE']],
  },
  WanVideoUniAnimatePoseInput: {
    inputs: [['pose_images', 'IMAGE'], ['strength', 'FLOAT', 1], ['start_percent', 'FLOAT', 0], ['end_percent', 'FLOAT', 1], ['reference_pose_image', 'IMAGE']],
    outputs: [['unianimate_poses', 'UNIANIMATE_POSE']],
  },
  WanVideoEncode: {
    inputs: [['vae', 'WANVAE'], ['image', 'IMAGE'], ['enable_vae_tiling', 'BOOLEAN', false], ['tile_x', 'INT', 272], ['tile_y', 'INT', 272], ['noise_aug_strength', 'FLOAT', 0], ['latent_strength', 'FLOAT', 1], ['mask', 'MASK']],
    outputs: [['samples', 'LATENT']],
  },
  WanVideoReCamMasterDefaultCamera: { inputs: [['camera_type', 'COMBO', 'pan_right'], ['latents', 'LATENT']], outputs: [['camera_poses', 'CAMERAPOSES']] },
  WanVideoReCamMasterCameraEmbed: { inputs: [['camera_poses', 'CAMERAPOSES'], ['latents', 'LATENT']], outputs: [['camera_embeds', 'WANVIDIMAGE_EMBEDS'], ['camera_poses', 'CAMERAPOSES']] },
  WanVideoExtraModelSelect: { inputs: [['extra_model', 'COMBO', 'wan-high.safetensors'], ['prev_model', 'VACEPATH']], outputs: [['extra_model', 'VACEPATH']] },
  WanVideoOviCFG: { inputs: [['original_text_embeds', 'WANVIDEOTEXTEMBEDS'], ['ovi_audio_cfg', 'FLOAT', 3], ['ovi_negative_text_embeds', 'WANVIDEOTEXTEMBEDS']], outputs: [['text_embeds', 'WANVIDEOTEXTEMBEDS']] },
  WanVideoEmptyMMAudioLatents: { inputs: [['length', 'INT', 157]], outputs: [['samples', 'LATENT']] },
  OviMMAudioVAELoader: { inputs: [['vae', 'COMBO', 'mmaudio.safetensors'], ['vocoder', 'COMBO', 'mmaudio.safetensors'], ['precision', 'COMBO', 'bf16']], outputs: [['mmaudio_vae', 'MMAUDIOVAE']] },
  WanVideoDecodeOviAudio: { inputs: [['mmaudio_vae', 'MMAUDIOVAE'], ['samples', 'LATENT']], outputs: [['audio', 'AUDIO']] },
  // The lessons on picture model families.
  ...imageModelLessonSpecs(),
  ...IMAGE_TECHNIQUE_LESSON_CLASSES,
  // The general-purpose nodes of the foundations lessons.
  ...lessonSpecs(),
};

const ports: ClassPorts = (classType) => {
  const spec = CLASSES[classType];
  return spec ? { inputs: spec.inputs.map(([name]) => name), outputs: spec.outputs.map(([name, type]) => ({ name, type })) } : null;
};
const installed = (classType: string) => classType in CLASSES;

/** A canvas a person works on, as far as a lesson can see it. */
class Canvas implements LessonGraph {
  nodes: LessonNode[] = [];
  links: LessonGraph['links'] = [];
  private next = 1;

  add(classType: string): LessonNode {
    const spec = CLASSES[classType];
    const node: LessonNode = {
      id: String(this.next),
      classType,
      inputs: spec.inputs.map(([name, type], index) => ({ id: `in-${index}`, name, type })),
      outputs: spec.outputs.map(([name, type], index) => ({ id: `out-${index}`, name, type })),
      values: Object.fromEntries(spec.inputs.filter((input) => input.length > 2).map(([name, , value]) => [name, value])),
    };
    this.next += 1;
    this.nodes.push(node);
    return node;
  }

  /** An input takes one link: a new one replaces the old, as in ComfyUI. */
  connect(from: string, fromPort: string, to: string, toPort: string): void {
    this.links = this.links.filter((link) => !(link.to === to && link.toPort === toPort));
    this.links.push({ from, fromPort, to, toPort });
  }

  remove(id: string): void {
    this.nodes = this.nodes.filter((node) => node.id !== id);
    this.links = this.links.filter((link) => link.from !== id && link.to !== id);
  }

  node(id: string): LessonNode {
    return this.nodes.find((node) => node.id === id)!;
  }
}

const FACTS: LessonFacts = { triggers: { 'style-high.safetensors': ['neon rain'], 'style-low.safetensors': ['neon rain'] } };

/** What only the person can decide: which file, what words. */
function decide(canvas: Canvas, missing: Missing): void {
  if (missing.kind !== 'field') throw new Error(`nothing to decide for ${JSON.stringify(missing)}`);
  const node = canvas.node(missing.nodeId);
  switch (missing.test.kind) {
    case 'chosen':
      node.values[missing.field] = 'chosen.safetensors';
      return;
    case 'differs':
      node.values[missing.field] = `other-${missing.nodeId}.safetensors`;
      return;
    case 'text': {
      // As many sentences as the step asks characters for.
      const sentences = ['A quiet lake at dawn.', 'Mist drifts slowly over the water.', 'The camera glides forward at walking pace.', 'Soft morning light.'];
      let text = '';
      for (const sentence of sentences) {
        if (text.length >= missing.test.minChars) break;
        text = `${text} ${sentence}`.trim();
      }
      // Marks a model needs (Ovi's <S> and <E>) are put around the words that are spoken.
      const marks = missing.test.has ?? [];
      const held = String(node.values[missing.field] ?? '');
      node.values[missing.field] = marks.length > 0 && held.trim().length >= missing.test.minChars ? `${held} ${marks.join('Hello there.')}` : text;
      return;
    }
    case 'weighted':
      node.values[missing.field] = `${String(node.values[missing.field] ?? '')}, (soft light:1.2)`;
      return;
    case 'has-trigger':
      node.values[missing.field] = `${String(node.values[missing.field] ?? '')}, neon rain`;
      return;
    default:
      throw new Error(`the lesson fixes this itself: ${JSON.stringify(missing)}`);
  }
}

/** Does what the lesson says, one lack at a time, and returns how many actions each step took. */
function carryOut(lesson: Lesson, canvas: Canvas, facts: LessonFacts = FACTS): number[] {
  const read = new Set<string>();
  const actions: number[] = lesson.steps.map(() => 0);
  for (let guard = 0; guard < 400; guard += 1) {
    const progress = lessonProgress(lesson, canvas, facts, read);
    if (progress.current === lesson.steps.length) return actions;
    const step = lesson.steps[progress.current];
    actions[progress.current] += 1;
    if (step.read) {
      expect(progress.missing, `${lesson.id}/${step.id}: a step that explains lacks nothing`).toEqual([]);
      read.add(step.id);
      continue;
    }
    expect(progress.missing.length, `${lesson.id}/${step.id}: a step that is not done says what it lacks`).toBeGreaterThan(0);
    const missing = progress.missing[0];
    const fix = fixFor(missing, canvas, installed);
    if (!fix) decide(canvas, missing);
    else if (fix.kind === 'add-node') canvas.add(fix.classType);
    else if (fix.kind === 'connect') canvas.connect(fix.from, fix.fromPort, fix.to, fix.toPort);
    else canvas.node(fix.nodeId).values[fix.field] = fix.value;
  }
  throw new Error(`${lesson.id} did not come to its end`);
}

const done = (lesson: Lesson, canvas: Canvas, read: string[] = lesson.steps.filter((step) => step.read).map((step) => step.id)) => lessonProgress(lesson, canvas, FACTS, new Set(read));

describe('every lesson can be done by doing what it says', () => {
  for (const lesson of LESSONS) {
    it(`${lesson.id}: from an empty canvas to the end`, () => {
      const canvas = new Canvas();
      // The lessons that stand on a video graph start from the one the lesson before them leaves.
      for (const before of chain(lesson.id)) carryOut(lessonById(before)!, canvas);
      const actions = carryOut(lesson, canvas);
      expect(done(lesson, canvas).current).toBe(lesson.steps.length);
      // Every step that explains was shown once.
      lesson.steps.forEach((step, index) => {
        if (step.read) expect(actions[index], `${lesson.id}/${step.id}`).toBe(1);
      });
    });
  }

  it('fits a ComfyUI that has the nodes, and each lesson has steps to do and steps to read', () => {
    for (const lesson of LESSONS) {
      expect(lessonGaps(lesson, ports), lesson.id).toEqual([]);
      expect(lesson.steps[0].read, `${lesson.id} starts by saying what it is about`).toBe(true);
      expect(lesson.steps.some((step) => !step.read), `${lesson.id} has something to do`).toBe(true);
      expect(new Set(lesson.steps.map((step) => step.id)).size, `${lesson.id}: step ids are its own`).toBe(lesson.steps.length);
      // A role is brought in once, before anything refers to it.
      const brought = new Set<string>();
      for (const step of lesson.steps) {
        for (const spec of step.roles ?? []) {
          expect(brought.has(spec.role), `${lesson.id}/${step.id}: ${spec.role} twice`).toBe(false);
          brought.add(spec.role);
        }
        for (const spec of step.links ?? []) expect([spec.from, spec.to].every((role) => brought.has(role)), `${lesson.id}/${step.id}: link ${spec.from} → ${spec.to}`).toBe(true);
        for (const spec of step.fields ?? []) expect(brought.has(spec.role), `${lesson.id}/${step.id}: field of ${spec.role}`).toBe(true);
      }
    }
    for (const [id, before] of Object.entries(LESSON_AFTER)) {
      expect(lessonById(id), id).not.toBeNull();
      for (const other of before) expect(lessonById(other), other).not.toBeNull();
    }
  });
});

/** The lessons whose graph a lesson stands on, first to last. */
function chain(id: string): string[] {
  const before = LESSON_AFTER[id]?.[0];
  return before ? [...chain(before), before] : [];
}

describe('where a person is in a lesson is read off the graph', () => {
  const lesson = lessonById('image')!;

  it('starts at the first step and waits there until it is read', () => {
    const canvas = new Canvas();
    expect(lessonProgress(lesson, canvas, {}, new Set())).toMatchObject({ current: 0, missing: [] });
    const next = lessonProgress(lesson, canvas, {}, new Set(['intro']));
    expect(next.current).toBe(1);
    expect(next.missing).toEqual([{ kind: 'node', role: 'checkpoint', classes: ['CheckpointLoaderSimple'] }]);
  });

  it('goes back when a node the lesson stands on is deleted, and forward again when it returns', () => {
    const canvas = new Canvas();
    carryOut(lesson, canvas);
    const sampler = canvas.nodes.find((node) => node.classType === 'KSampler')!;
    canvas.remove(sampler.id);
    const back = done(lesson, canvas);
    expect(lesson.steps[back.current].id).toBe('sampler');
    carryOut(lesson, canvas);
    expect(done(lesson, canvas).current).toBe(lesson.steps.length);
  });

  it('counts a graph built in another order', () => {
    const canvas = new Canvas();
    // Everything at once, the saver first.
    for (const classType of ['SaveImage', 'VAEDecode', 'KSampler', 'EmptyLatentImage', 'CLIPTextEncode', 'CLIPTextEncode', 'CheckpointLoaderSimple']) canvas.add(classType);
    const progress = done(lesson, canvas);
    // The nodes are there; the first thing still to do is to link the checkpoint to the prompts.
    expect(lesson.steps[progress.current].id).toBe('prompts-clip');
    expect(progress.missing.every((item) => item.kind === 'link')).toBe(true);
  });

  it('says which node feeds an input when it is the wrong one', () => {
    const canvas = new Canvas();
    carryOut(lesson, canvas);
    const sampler = canvas.nodes.find((node) => node.classType === 'KSampler')!;
    const progress = done(lesson, canvas);
    const positive = canvas.node(progress.roles.positive);
    const negative = canvas.node(progress.roles.negative);
    // The person drags the empty prompt into "positive" too: the prompt with the words no longer reaches it.
    canvas.connect(negative.id, 'out-0', sampler.id, sampler.inputs.find((port) => port.name === 'positive')!.id);
    const wrong = done(lesson, canvas);
    expect(lesson.steps[wrong.current].id).toBe('sampler-links');
    expect(wrong.missing).toContainEqual({
      kind: 'link',
      from: { role: 'positive', nodeId: positive.id },
      output: 'CONDITIONING',
      to: { role: 'sampler', nodeId: sampler.id },
      input: 'positive',
      fedBy: negative.id,
      absent: null,
    });
    // Doing what it says puts it right.
    const fix = fixFor(wrong.missing[0], canvas, installed)!;
    expect(fix).toMatchObject({ kind: 'connect', from: positive.id, to: sampler.id });
  });

  it('gives each of two nodes of one class its own role, by what they are linked to', () => {
    const video = lessonById('video-text')!;
    const canvas = new Canvas();
    carryOut(video, canvas);
    const roles = done(video, canvas).roles;
    expect(new Set(Object.values(roles)).size).toBe(Object.keys(roles).length);
    // The first sampler is the one fed by the empty latent, the second the one fed by the first.
    const latentTo = canvas.links.find((link) => link.from === roles.latent)!.to;
    expect(latentTo).toBe(roles.first);
    expect(canvas.links.some((link) => link.from === roles.first && link.to === roles.second)).toBe(true);
    expect(canvas.node(roles.second).values.start_at_step).toBe(canvas.node(roles.first).values.end_at_step);
  });
});

describe('a LoRA loader on the way does not break a lesson', () => {
  it('keeps the video lesson done after LoRA loaders are put into both model paths, one or two in a row', () => {
    const video = lessonById('video-text')!;
    const canvas = new Canvas();
    carryOut(video, canvas);
    carryOut(lessonById('lora')!, canvas);
    expect(done(video, canvas).current).toBe(video.steps.length);
    // A second LoRA in the high path, between the first one and the shift node.
    const roles = done(lessonById('lora')!, canvas).roles;
    const extra = canvas.add('LoraLoaderModelOnly');
    canvas.connect(roles.loraHigh, 'out-0', extra.id, 'in-0');
    canvas.connect(extra.id, 'out-0', roles.shiftHigh, 'in-0');
    expect(done(video, canvas).current).toBe(video.steps.length);
    expect(done(lessonById('lora')!, canvas).current).toBe(lessonById('lora')!.steps.length);
  });

  it('asks for a trigger word only when the file names one', () => {
    const lesson = lessonById('lora')!;
    const canvas = new Canvas();
    carryOut(lessonById('video-text')!, canvas);
    // Without known trigger words there is nothing to check.
    carryOut(lesson, canvas, {});
    const roles = lessonProgress(lesson, canvas, {}, new Set(lesson.steps.filter((step) => step.read).map((step) => step.id))).roles;
    canvas.node(roles.loraHigh).values.lora_name = 'style-high.safetensors';
    const asks = done(lesson, canvas);
    expect(lesson.steps[asks.current].id).toBe('trigger');
    expect(asks.missing[0]).toMatchObject({ kind: 'field', field: 'text', test: { kind: 'has-trigger' } });
    canvas.node(asks.missing[0].kind === 'field' ? asks.missing[0].nodeId : '').values.text = 'a street at night, Neon Rain on glass';
    expect(done(lesson, canvas).current).toBe(lesson.steps.length);
  });
});

describe('the lesson on adult content asks for neither a LoRA nor a further-trained model', () => {
  const lesson = lessonById('adult')!;
  const read = lesson.steps.filter((step) => step.read).map((step) => step.id);

  it('is done on a plain video graph: the subject may come from the pair of models chosen in the two loaders', () => {
    const canvas = new Canvas();
    carryOut(lessonById('video-text')!, canvas);
    expect(canvas.nodes.some((node) => node.classType === 'LoraLoaderModelOnly')).toBe(false);
    // Nothing on the canvas is asked for: only the steps that explain are left.
    const before = lessonProgress(lesson, canvas, FACTS, new Set());
    expect(lesson.steps[before.current].id).toBe('rules');
    expect(done(lesson, canvas, read).current).toBe(lesson.steps.length);
    expect(rolesOf(lesson).map((spec) => spec.classes[0])).not.toContain('LoraLoaderModelOnly');
    expect(lessonGaps(lesson, (classType) => (classType === 'LoraLoaderModelOnly' ? null : ports(classType)))).toEqual([]);
  });

  it('holds a LoRA that is on the canvas to its words, wherever it stands', () => {
    const canvas = new Canvas();
    carryOut(lessonById('video-text')!, canvas);
    carryOut(lessonById('lora')!, canvas, {});
    // The files name no words: nothing to compare with.
    expect(lessonProgress(lesson, canvas, {}, new Set(read)).current).toBe(lesson.steps.length);
    const loaders = canvas.nodes.filter((node) => node.classType === 'LoraLoaderModelOnly');
    loaders[1].values.lora_name = 'style-low.safetensors';
    const asks = done(lesson, canvas, read);
    expect(lesson.steps[asks.current].id).toBe('trigger');
    expect(asks.missing).toHaveLength(1);
    expect(asks.missing[0]).toMatchObject({ kind: 'field', field: 'text', test: { kind: 'has-trigger' } });
    // Only the person can write the words.
    expect(fixFor(asks.missing[0], canvas, installed)).toBeNull();
    canvas.node(asks.missing[0].kind === 'field' ? asks.missing[0].nodeId : '').values.text = 'a street at night, neon rain on glass';
    expect(done(lesson, canvas, read).current).toBe(lesson.steps.length);
    // A LoRA node that is linked to nothing yet counts too: its file is chosen, its words are asked for.
    canvas.node(asks.missing[0].kind === 'field' ? asks.missing[0].nodeId : '').values.text = 'a street at night';
    for (const loader of loaders) canvas.links = canvas.links.filter((link) => link.from !== loader.id && link.to !== loader.id);
    expect(lesson.steps[done(lesson, canvas, read).current].id).toBe('trigger');
  });

  it('says both ways in its words, and what a model with the speed-up built in needs', async () => {
    const { lessonWords } = await import('../../src/shared/lessons/texts');
    for (const language of ['ru', 'en'] as const) {
      const steps = lessonWords(language, 'adult')!.steps;
      expect(steps.tuned.body).toContain('`unet_name`');
      expect(steps.tuned.body).toMatch(/`steps` 4/);
      expect(steps.tuned.body).toMatch(/`cfg` 1/);
      expect(steps.lora.body).toContain(lessonWords(language, 'lora')!.title);
      expect(steps.tuned.body).toContain(lessonWords(language, 'video-fast')!.title);
      // The step that checks the words says when there is nothing to check.
      expect(steps.trigger.body).toMatch(language === 'ru' ? /LoRA в графе нет/ : /has no LoRA/);
    }
  });
});

describe('a node the app adds for a lesson stands where the graph reads left to right', () => {
  const GAPS = { x: 96, y: 72 };
  const sizeOf = (classType: string) => ({ width: 240, height: 70 + 30 * CLASSES[classType].inputs.length });

  /** Carries a lesson out as carryOut does, and gives each node the app adds the spot the app would give it. */
  function build(lesson: Lesson, canvas: Canvas, rects: Map<string, FlowRect>): void {
    const read = new Set<string>();
    for (let guard = 0; guard < 400; guard += 1) {
      const progress = lessonProgress(lesson, canvas, FACTS, read);
      if (progress.current === lesson.steps.length) return;
      const step = lesson.steps[progress.current];
      if (step.read) {
        read.add(step.id);
        continue;
      }
      const missing = progress.missing[0];
      const fix = fixFor(missing, canvas, installed);
      if (!fix) decide(canvas, missing);
      else if (fix.kind === 'add-node') {
        const size = sizeOf(fix.classType);
        // The first node of a lesson goes where any new node goes; here that is the origin.
        const spot = (missing.kind === 'node' ? lessonSpot(lesson, missing.role, progress.roles, rects, size, GAPS) : null) ?? { x: 0, y: 0 };
        rects.set(canvas.add(fix.classType).id, { ...spot, ...size });
      } else if (fix.kind === 'connect') canvas.connect(fix.from, fix.fromPort, fix.to, fix.toPort);
      else canvas.node(fix.nodeId).values[fix.field] = fix.value;
    }
    throw new Error(`${lesson.id} did not come to its end`);
  }

  /** Pairs of nodes that stand closer than the room the canvas keeps around a new node. */
  function crowded(rects: Map<string, FlowRect>, room = 56): string[] {
    const all = [...rects.entries()];
    const out: string[] = [];
    all.forEach(([a, one], index) => {
      for (const [b, other] of all.slice(index + 1)) {
        if (one.x < other.x + other.width + room && one.x + one.width + room > other.x && one.y < other.y + other.height + room && one.y + one.height + room > other.y) out.push(`${a} and ${b}`);
      }
    });
    return out;
  }

  it('gives every role a column, and every link of every lesson goes to a column further right', () => {
    for (const lesson of LESSONS) {
      const columns = columnsOf(lesson);
      expect(Object.keys(columns).sort(), lesson.id).toEqual([...new Set(rolesOf(lesson).map((spec) => spec.role))].sort());
      for (const step of lesson.steps) {
        for (const link of step.links ?? []) expect(columns[link.from], `${lesson.id}: ${link.from} → ${link.to}`).toBeLessThan(columns[link.to]);
      }
    }
    expect(columnsOf(lessonById('image')!)).toEqual({ checkpoint: 0, latent: 0, positive: 1, negative: 1, sampler: 2, decode: 3, save: 4 });
    expect(columnsOf(lessonById('video-text')!)).toMatchObject({ high: 0, low: 0, clip: 0, vae: 0, shiftHigh: 1, shiftLow: 1, first: 2, second: 3, decode: 4, video: 5, save: 6 });
  });

  for (const id of ['image', 'video-text', 'video-image']) {
    it(`${id}: built by the app from an empty canvas, every link goes from left to right and no node crowds another`, () => {
      const lesson = lessonById(id)!;
      const canvas = new Canvas();
      const rects = new Map<string, FlowRect>();
      build(lesson, canvas, rects);
      expect(rects.size).toBe(rolesOf(lesson).length);
      expect(canvas.links.length).toBeGreaterThan(5);
      for (const link of canvas.links) {
        const from = rects.get(link.from)!;
        const to = rects.get(link.to)!;
        expect(from.x + from.width, `${canvas.node(link.from).classType} → ${canvas.node(link.to).classType}`).toBeLessThan(to.x);
      }
      expect(crowded(rects)).toEqual([]);
      // The two models stand one under the other, and each one's noise shift at its own height.
      if (id !== 'image') {
        const roles = done(lesson, canvas).roles;
        expect(rects.get(roles.low)!.x).toBe(rects.get(roles.high)!.x);
        expect(rects.get(roles.shiftHigh)!.y).toBe(rects.get(roles.high)!.y);
        expect(rects.get(roles.shiftLow)!.y).toBe(rects.get(roles.low)!.y);
      }
    });
  }

  it('puts the nodes of a later lesson into the graph of an earlier one without crowding it', () => {
    const canvas = new Canvas();
    const rects = new Map<string, FlowRect>();
    build(lessonById('video-text')!, canvas, rects);
    build(lessonById('lora')!, canvas, rects);
    build(lessonById('video-fast')!, canvas, rects);
    expect(canvas.nodes.filter((node) => node.classType === 'LoraLoaderModelOnly')).toHaveLength(2);
    expect(rects.size).toBe(canvas.nodes.length);
    expect(crowded(rects)).toEqual([]);
    // Each LoRA stands right of the model it takes.
    const roles = done(lessonById('lora')!, canvas).roles;
    expect(rects.get(roles.loraHigh)!.x).toBeGreaterThan(rects.get(roles.high)!.x);
    expect(rects.get(roles.loraLow)!.x).toBeGreaterThan(rects.get(roles.low)!.x);
  });

  it('builds a picture model in front of a video graph so that the picture still flows from left to right', () => {
    const canvas = new Canvas();
    const rects = new Map<string, FlowRect>();
    build(lessonById('video-image')!, canvas, rects);
    const video = new Set(canvas.nodes.map((node) => node.id));
    const lesson = lessonById('two-models')!;
    build(lesson, canvas, rects);
    expect(rects.size).toBe(canvas.nodes.length);
    expect(crowded(rects)).toEqual([]);
    const roles = done(lesson, canvas).roles;
    // Every link of the new part, the one that joins the video included, goes to the right.
    const added = canvas.links.filter((link) => !video.has(link.from));
    expect(added.length).toBeGreaterThan(7);
    for (const link of added) {
      const from = rects.get(link.from)!;
      const to = rects.get(link.to)!;
      expect(from.x + from.width, `${canvas.node(link.from).classType} → ${canvas.node(link.to).classType}`).toBeLessThan(to.x);
    }
    // The model that draws the frame stands left of everything it leads to, the video's start included.
    expect(rects.get(roles.checkpoint)!.x).toBeLessThan(rects.get(roles.imageSampler)!.x);
    expect(rects.get(roles.imageDecode)!.x + rects.get(roles.imageDecode)!.width).toBeLessThan(rects.get(roles.start)!.x);
  });

  it('builds a second pass after a first one: every link to the right, nothing crowded', () => {
    const canvas = new Canvas();
    const rects = new Map<string, FlowRect>();
    build(lessonById('image')!, canvas, rects);
    build(lessonById('refine')!, canvas, rects);
    expect(rects.size).toBe(canvas.nodes.length);
    expect(crowded(rects)).toEqual([]);
    for (const link of canvas.links) {
      const from = rects.get(link.from)!;
      const to = rects.get(link.to)!;
      expect(from.x + from.width, `${canvas.node(link.from).classType} → ${canvas.node(link.to).classType}`).toBeLessThan(to.x);
    }
  });

  it('leaves the first node of a lesson to the canvas, and a node placed by hand is not stood upon', () => {
    const lesson = lessonById('image')!;
    expect(lessonSpot(lesson, 'checkpoint', {}, new Map(), sizeOf('CheckpointLoaderSimple'), GAPS)).toBeNull();
    // The person put the model loader somewhere and a note-sized node right where the first text would go.
    const rects = new Map<string, FlowRect>([
      ['1', { x: 500, y: 300, width: 240, height: 100 }],
      ['9', { x: 836, y: 280, width: 240, height: 160 }],
    ]);
    const spot = lessonSpot(lesson, 'positive', { checkpoint: '1' }, rects, sizeOf('CLIPTextEncode'), GAPS)!;
    expect(spot).toEqual({ x: 500 + 240 + 96, y: 280 + 160 + 72 });
    // A role the lesson does not have gets no spot.
    expect(lessonSpot(lesson, 'nobody', { checkpoint: '1' }, rects, sizeOf('CLIPTextEncode'), GAPS)).toBeNull();
  });
});

describe('a lesson leaves alone what works for another part of the graph', () => {
  const textOf = (canvas: Canvas, id: string) => canvas.links.find((link) => link.to === id && link.toPort === canvas.node(id).inputs.find((port) => port.name === 'clip')!.id)?.from;

  it('gives a second image model its own nodes on a graph that also makes a video', () => {
    const canvas = new Canvas();
    for (const id of ['video-text', 'video-image', 'two-models']) carryOut(lessonById(id)!, canvas);
    const video = done(lessonById('two-models')!, canvas).roles;
    const before = { positive: textOf(canvas, video.positive), negative: textOf(canvas, video.negative), decode: canvas.links.filter((link) => link.to === video.decode).map((link) => link.from).sort() };
    const count = canvas.nodes.length;
    const refine = lessonById('refine')!;
    carryOut(refine, canvas);
    expect(done(refine, canvas).current).toBe(refine.steps.length);
    // The video's texts still take their reader from the video's own loader, and its decoder its own inputs.
    expect(textOf(canvas, video.positive)).toBe(before.positive);
    expect(textOf(canvas, video.negative)).toBe(before.negative);
    expect(canvas.links.filter((link) => link.to === video.decode).map((link) => link.from).sort()).toEqual(before.decode);
    expect(canvas.node(before.positive!).classType).toBe('CLIPLoader');
    // Two texts, a loader, an encoder, a sampler, a decoder and a saver were added: seven nodes of the second pass.
    expect(canvas.nodes.length).toBe(count + 7);
    expect(done(lessonById('two-models')!, canvas).current).toBe(lessonById('two-models')!.steps.length);
  });

  it('does not take the texts of a picture graph for a video that is started on the same canvas', () => {
    const canvas = new Canvas();
    const image = lessonById('image')!;
    carryOut(image, canvas);
    carryOut(lessonById('video-text')!, canvas);
    expect(done(image, canvas).current).toBe(image.steps.length);
    expect(canvas.nodes.filter((node) => node.classType === 'CLIPTextEncode')).toHaveLength(4);
    expect(canvas.nodes.filter((node) => node.classType === 'VAEDecode')).toHaveLength(2);
  });

  it('points at the nodes a person has just added, not at one that is wired to something else', () => {
    const canvas = new Canvas();
    carryOut(lessonById('image')!, canvas);
    const refine = lessonById('refine')!;
    const read = refine.steps.filter((step) => step.read).map((step) => step.id);
    const first = done(refine, canvas, read).roles.checkpoint;
    // A text node left over from an experiment, fed by the first model and feeding nothing.
    const spare = canvas.add('CLIPTextEncode');
    canvas.connect(first, 'out-1', spare.id, 'in-1');
    const second = canvas.add('CheckpointLoaderSimple');
    second.values.ckpt_name = 'second.safetensors';
    const fresh = [canvas.add('CLIPTextEncode'), canvas.add('CLIPTextEncode')];
    const progress = done(refine, canvas, read);
    expect(refine.steps[progress.current].id).toBe('second-texts');
    const links = progress.missing.filter((item) => item.kind === 'link');
    expect(links).toHaveLength(2);
    expect(links.map((item) => (item.kind === 'link' ? item.to.nodeId : '')).sort()).toEqual(fresh.map((node) => node.id).sort());
    expect(links.every((item) => item.kind === 'link' && item.fedBy === null)).toBe(true);
  });

  it('still sees a node of the lesson that also feeds something the lesson does not know', () => {
    const canvas = new Canvas();
    const image = lessonById('image')!;
    carryOut(image, canvas);
    const roles = done(image, canvas).roles;
    // The person looks at the picture in a preview node too, then takes the link into the decoder off by mistake.
    const preview = canvas.add('PreviewImage');
    canvas.connect(roles.decode, 'out-0', preview.id, 'in-0');
    canvas.links = canvas.links.filter((link) => !(link.to === roles.decode && link.toPort === 'in-0'));
    const progress = done(image, canvas);
    expect(image.steps[progress.current].id).toBe('decode');
    // The decoder is there and is the lesson's: what it lacks is its input, not a second decoder.
    expect(progress.missing).toHaveLength(1);
    expect(progress.missing[0]).toMatchObject({ kind: 'link', input: 'samples', fedBy: null, to: { role: 'decode', nodeId: roles.decode } });
    expect(fixFor(progress.missing[0], canvas, installed)).toMatchObject({ kind: 'connect', to: roles.decode });
  });

  it('still says which link is wrong on a node that is part of the lesson', () => {
    // The samplers of a video-from-text graph are the samplers of video-from-a-picture: there the lesson does ask
    // to move their links, to the node that puts the picture in.
    const canvas = new Canvas();
    carryOut(lessonById('video-text')!, canvas);
    const samplers = canvas.nodes.filter((node) => node.classType === 'KSamplerAdvanced').length;
    carryOut(lessonById('video-image')!, canvas);
    expect(canvas.nodes.filter((node) => node.classType === 'KSamplerAdvanced')).toHaveLength(samplers);
  });
});

describe('a LoRA loader or a clip-skip node on the way of a checkpoint does not break a lesson', () => {
  it('keeps the first picture, the description lesson and the second pass done', () => {
    const canvas = new Canvas();
    const image = lessonById('image')!;
    carryOut(image, canvas);
    const roles = done(image, canvas).roles;
    // Load LoRA takes both the model and the text reader; the texts read through it and through a clip-skip node.
    const lora = canvas.add('LoraLoader');
    const skip = canvas.add('CLIPSetLastLayer');
    canvas.connect(roles.checkpoint, 'out-0', lora.id, 'in-0');
    canvas.connect(roles.checkpoint, 'out-1', lora.id, 'in-1');
    canvas.connect(lora.id, 'out-0', roles.sampler, 'in-0');
    canvas.connect(lora.id, 'out-1', skip.id, 'in-0');
    canvas.connect(skip.id, 'out-0', roles.positive, 'in-1');
    canvas.connect(skip.id, 'out-0', roles.negative, 'in-1');
    expect(done(image, canvas).current).toBe(image.steps.length);
    for (const id of ['prompt', 'refine']) {
      const lesson = lessonById(id)!;
      carryOut(lesson, canvas);
      expect(done(lesson, canvas).current, id).toBe(lesson.steps.length);
    }
    expect(done(image, canvas).current).toBe(image.steps.length);
  });
});

describe('the lessons on descriptions', () => {
  const lesson = lessonById('prompt')!;
  const read = lesson.steps.filter((step) => step.read).map((step) => step.id);

  it('asks for a weight in the form ComfyUI reads, inside the range', () => {
    const canvas = new Canvas();
    carryOut(lessonById('image')!, canvas);
    const positive = canvas.node(done(lessonById('image')!, canvas).roles.positive);
    const at = (text: string) => {
      positive.values.text = text;
      const progress = done(lesson, canvas, read);
      return progress.current < lesson.steps.length ? lesson.steps[progress.current].id : 'end';
    };
    const long = 'portrait of a woman, red coat, night street, rain, soft light';
    expect(at('a lake')).toBe('write');
    expect(at(long)).toBe('weigh');
    // Forms of other programs are not weights here, and a weight of 1 changes nothing.
    expect(at(`${long}, [rain], <lora:style:1>, ((coat))`)).toBe('weigh');
    expect(at(`${long}, (rain:1)`)).toBe('weigh');
    expect(at(`${long}, (rain:1.9)`)).toBe('weigh');
    expect(at(`${long}, (red coat:1.2), (rain:1.9)`)).toBe('weigh');
    expect(at(`${long}, (rain:0.8)`)).toBe('negative-text');
    expect(at(`portrait of a woman, (red coat:1.2), night street, rain, soft light`)).toBe('negative-text');
    const lack = done(lesson, canvas, read).missing[0];
    expect(lack).toMatchObject({ kind: 'field', field: 'text', test: { kind: 'text', minChars: 5 } });
    // Words are the person's to write: the app offers to do none of it.
    expect(fixFor(lack, canvas, installed)).toBeNull();
    positive.values.text = long;
    expect(fixFor(done(lesson, canvas, read).missing[0], canvas, installed)).toBeNull();
  });

  it('never skips a step that explains, and skips the doing a graph already holds', () => {
    const canvas = new Canvas();
    carryOut(lessonById('image')!, canvas);
    const roles = done(lessonById('image')!, canvas).roles;
    canvas.node(roles.positive).values.text = 'portrait of a woman, (red coat:1.2), night street, rain, soft light';
    canvas.node(roles.negative).values.text = 'blurry, extra fingers';
    // Everything to do is done; all that is left is to read, one step at a time, in order.
    const seen: string[] = [];
    const marks = new Set<string>();
    for (let guard = 0; guard < 40; guard += 1) {
      const progress = lessonProgress(lesson, canvas, FACTS, marks);
      if (progress.current === lesson.steps.length) break;
      const step = lesson.steps[progress.current];
      expect(step.read, step.id).toBe(true);
      seen.push(step.id);
      marks.add(step.id);
    }
    expect(seen).toEqual(read);
    expect(read.length).toBeGreaterThan(lesson.steps.length / 2);
  });

  it('reads the description of the clip on a canvas that also draws a picture', () => {
    const canvas = new Canvas();
    for (const id of ['video-text', 'video-image', 'two-models']) carryOut(lessonById(id)!, canvas);
    const video = lessonById('prompt-video')!;
    const roles = done(lessonById('two-models')!, canvas).roles;
    canvas.node(roles.positive).values.text = 'a walk';
    canvas.node(roles.imagePositive).values.text = 'portrait of a woman in a red coat on a night street in the rain, soft light from a shop window, shallow depth of field';
    const progress = done(video, canvas, video.steps.filter((step) => step.read).map((step) => step.id));
    expect(video.steps[progress.current].id).toBe('write');
    expect(progress.missing[0]).toMatchObject({ kind: 'field', nodeId: roles.positive, field: 'text' });
  });

  it('says in its words what does not work in ComfyUI and when the second text stops acting', async () => {
    const { lessonWords } = await import('../../src/shared/lessons/texts');
    for (const language of ['ru', 'en'] as const) {
      const steps = lessonWords(language, 'prompt')!.steps;
      for (const form of ['`(red coat:1.2)`', '`<lora:name:1>`', '`BREAK`', '`AND`', '`\\(`']) expect(steps.weights.body, `${language}: ${form}`).toContain(form);
      expect(steps.cfg.body).toMatch(/`cfg` 1 /);
      expect(steps.negative.body).toContain('`no hat`');
      const video = lessonWords(language, 'prompt-video')!.steps;
      expect(video.negative.body).toContain(lessonWords(language, 'video-fast')!.title);
      expect(video.camera.body).toContain('`static shot`');
      // The lessons on combining models send the reader to each other and to the lesson on descriptions.
      const two = lessonWords(language, 'two-models')!.steps;
      expect(two.approaches.body).toContain(lessonWords(language, 'refine')!.title);
      expect(two['image-texts'].body).toContain(lessonWords(language, 'prompt')!.title);
      expect(two.loras.body).toContain(lessonWords(language, 'lora')!.title);
      expect(lessonWords(language, 'refine')!.steps.graph.body).toContain(lessonWords(language, 'two-models')!.title);
    }
  });
});

describe('the lessons on WanVideoWrapper', () => {
  it('sets the numbers the lesson speaks of when the app does a step, and the second pass starts where the first stops', () => {
    const lesson = lessonById('wrapper')!;
    const canvas = new Canvas();
    carryOut(lesson, canvas);
    const roles = done(lesson, canvas).roles;
    const first = canvas.node(roles.first).values;
    const second = canvas.node(roles.second).values;
    // The pack's sampler starts at 30 steps, which the lesson accepts; what it fixes is where the work is split.
    // So does its shift of 5, inside the range the lesson names.
    expect({ end: first.end_step, cfg: first.cfg }).toEqual({ end: 10, cfg: 3.5 });
    expect({ steps: second.steps, start: second.start_step, cfg: second.cfg }).toEqual({ steps: first.steps, start: 10, cfg: 3.5 });
    for (const values of [first, second]) expect(Number(values.shift)).toBeGreaterThanOrEqual(5);
    expect(canvas.node(roles.embeds).values.num_frames).toBe(81);
    // The pack's nodes and the built-in ones are different lessons: nothing built-in was asked for but saving.
    expect(canvas.nodes.map((item) => item.classType).filter((classType) => !classType.includes('Wan'))).toEqual(['CreateVideo', 'SaveVideo']);
  });

  it('starts the same graph from a picture, and the first lesson stays done', () => {
    const canvas = new Canvas();
    carryOut(lessonById('wrapper')!, canvas);
    const image = lessonById('wrapper-image')!;
    carryOut(image, canvas);
    expect(done(image, canvas).current).toBe(image.steps.length);
    const roles = done(image, canvas).roles;
    // Both samplers take the start that carries the picture, and the lesson before still holds.
    for (const sampler of [roles.first, roles.second]) {
      const fed = canvas.links.find((item) => item.to === sampler && item.toPort === canvas.node(sampler).inputs.find((port) => port.name === 'image_embeds')!.id)!;
      expect(canvas.node(fed.from).classType).toBe('WanVideoImageToVideoEncode');
    }
    expect(done(lessonById('wrapper')!, canvas).current).toBe(lessonById('wrapper')!.steps.length);
  });

  it('holds the description to the words of a LoRA chosen for the pack', () => {
    const lesson = lessonById('wrapper')!;
    const canvas = new Canvas();
    carryOut(lesson, canvas);
    const roles = done(lesson, canvas).roles;
    const select = canvas.add('WanVideoLoraSelect');
    select.values.lora = 'style-high.safetensors';
    canvas.connect(select.id, 'out-0', roles.high, canvas.node(roles.high).inputs.find((port) => port.name === 'lora')!.id);
    const asks = done(lesson, canvas);
    expect(lesson.steps[asks.current].id).toBe('trigger');
    expect(asks.missing[0]).toMatchObject({ kind: 'field', field: 'positive_prompt', test: { kind: 'has-trigger' } });
    canvas.node(roles.text).values.positive_prompt = 'A street at night, neon rain on glass.';
    expect(done(lesson, canvas).current).toBe(lesson.steps.length);
  });

  it('places the nodes the app adds from left to right without crowding', () => {
    const GAPS = { x: 96, y: 72 };
    const lesson = lessonById('wrapper')!;
    const canvas = new Canvas();
    const rects = new Map<string, FlowRect>();
    const read = new Set<string>();
    for (let guard = 0; guard < 400; guard += 1) {
      const progress = lessonProgress(lesson, canvas, FACTS, read);
      if (progress.current === lesson.steps.length) break;
      const step = lesson.steps[progress.current];
      if (step.read) {
        read.add(step.id);
        continue;
      }
      const missing = progress.missing[0];
      const fix = fixFor(missing, canvas, installed);
      if (!fix) decide(canvas, missing);
      else if (fix.kind === 'add-node') {
        const size = { width: 240, height: 70 + 30 * CLASSES[fix.classType].inputs.length };
        const spot = (missing.kind === 'node' ? lessonSpot(lesson, missing.role, progress.roles, rects, size, GAPS) : null) ?? { x: 0, y: 0 };
        rects.set(canvas.add(fix.classType).id, { ...spot, ...size });
      } else if (fix.kind === 'connect') canvas.connect(fix.from, fix.fromPort, fix.to, fix.toPort);
      else canvas.node(fix.nodeId).values[fix.field] = fix.value;
    }
    for (const item of canvas.links) {
      const from = rects.get(item.from)!;
      const to = rects.get(item.to)!;
      expect(from.x + from.width, `${canvas.node(item.from).classType} → ${canvas.node(item.to).classType}`).toBeLessThan(to.x);
    }
  });
});

describe('the further lessons on WanVideoWrapper', () => {
  const feeds = (canvas: Canvas, nodeId: string, input: string) => {
    const port = canvas.node(nodeId).inputs.find((item) => item.name === input)!.id;
    return canvas.links.find((item) => item.to === nodeId && item.toPort === port)?.from;
  };

  it('gives a second voice its own input and its own file, and the talking lesson stays done', () => {
    const canvas = new Canvas();
    const talk = lessonById('wrapper-talk')!;
    carryOut(talk, canvas);
    const duo = lessonById('wrapper-duo')!;
    carryOut(duo, canvas);
    const roles = done(duo, canvas).roles;
    expect(roles.voice2).not.toBe(roles.voice);
    expect(feeds(canvas, roles.audio, 'audio_1')).toBe(roles.voice);
    expect(feeds(canvas, roles.audio, 'audio_2')).toBe(roles.voice2);
    expect(canvas.node(roles.voice2).values.audio).not.toBe(canvas.node(roles.voice).values.audio);
    expect(done(talk, canvas).current).toBe(talk.steps.length);
    // The same recording in both loaders is no dialogue.
    canvas.node(roles.voice2).values.audio = canvas.node(roles.voice).values.audio;
    const asks = done(duo, canvas);
    expect(duo.steps[asks.current].id).toBe('second-voice');
    expect(asks.missing[0]).toMatchObject({ kind: 'field', field: 'audio', test: { kind: 'differs' } });
  });

  it('FantasyTalking: the speech reader it was trained with, and a sound as long as the clip', () => {
    const lesson = lessonById('wrapper-fantasy')!;
    const canvas = new Canvas();
    carryOut(lesson, canvas);
    const roles = done(lesson, canvas).roles;
    expect(canvas.node(roles.wav2vec).values.model).toBe('facebook/wav2vec2-base-960h');
    expect(canvas.node(roles.audio).values.fps).toBe(23);
    expect(canvas.node(roles.video).values.fps).toBe(23);
    // The module goes both into the model and into the node that reads the sound; the sound also into the clip.
    expect(feeds(canvas, roles.model, 'fantasytalking_model')).toBe(roles.talk);
    expect(feeds(canvas, roles.audio, 'fantasytalking_model')).toBe(roles.talk);
    expect(feeds(canvas, roles.video, 'audio')).toBe(roles.voice);
    // A longer clip asks for as much sound.
    canvas.node(roles.start).values.num_frames = 97;
    const asks = done(lesson, canvas);
    expect(lesson.steps[asks.current].id).toBe('voice');
    const fix = fixFor(asks.missing[0], canvas, installed);
    expect(fix).toMatchObject({ kind: 'set-field', field: 'num_frames', value: 97 });
  });

  it('UniAnimate: the skeleton comes from the video through a resize, and the LoRA goes into the model', () => {
    const lesson = lessonById('wrapper-unianimate')!;
    const canvas = new Canvas();
    carryOut(lesson, canvas);
    const roles = done(lesson, canvas).roles;
    expect(feeds(canvas, roles.model, 'lora')).toBe(roles.uni);
    expect(feeds(canvas, roles.sampler, 'unianimate_poses')).toBe(roles.pose);
    expect(feeds(canvas, roles.detect, 'reference_pose_image')).toBe(roles.picture);
    // A resize between the frames and the detector is the person's business, and the lesson still holds.
    CLASSES.ImageScale ??= { inputs: [['image', 'IMAGE'], ['width', 'INT', 832], ['height', 'INT', 480]], outputs: [['IMAGE', 'IMAGE']] };
    const resize = canvas.add('ImageScale');
    canvas.connect(roles.frames, 'out-0', resize.id, 'in-0');
    canvas.connect(resize.id, 'out-0', roles.detect, canvas.node(roles.detect).inputs.find((item) => item.name === 'pose_images')!.id);
    expect(done(lesson, canvas).current).toBe(lesson.steps.length);
  });

  it('ReCamMaster: the video reaches the camera and the embed as a latent, with no picture and no CLIP vision', () => {
    const lesson = lessonById('wrapper-recam')!;
    const canvas = new Canvas();
    carryOut(lesson, canvas);
    const roles = done(lesson, canvas).roles;
    expect(feeds(canvas, roles.camera, 'latents')).toBe(roles.encode);
    expect(feeds(canvas, roles.recam, 'latents')).toBe(roles.encode);
    expect(feeds(canvas, roles.sampler, 'image_embeds')).toBe(roles.recam);
    expect(canvas.nodes.map((item) => item.classType)).not.toContain('LoadImage');
    expect(canvas.nodes.map((item) => item.classType)).not.toContain('CLIPVisionLoader');
  });

  it('Ovi: the spoken words stand between the marks, and the sound is decoded apart from the frames', () => {
    const lesson = lessonById('wrapper-ovi')!;
    const canvas = new Canvas();
    carryOut(lesson, canvas);
    const roles = done(lesson, canvas).roles;
    const text = canvas.node(roles.text);
    expect(String(text.values.positive_prompt)).toMatch(/<S>.+<E>/);
    expect(canvas.node(roles.embeds).values.num_frames).toBe(121);
    expect(canvas.node(roles.silence).values.length).toBe(157);
    expect(canvas.node(roles.video).values.fps).toBe(24);
    // The sampler reads the description through the Ovi node, and gives its result to both decoders.
    expect(feeds(canvas, roles.sampler, 'text_embeds')).toBe(roles.ovi);
    // The Ovi node takes the description from one text node and the unwanted sound from another.
    expect(roles.soundNo).not.toBe(roles.text);
    expect(feeds(canvas, roles.ovi, 'original_text_embeds')).toBe(roles.text);
    expect(feeds(canvas, roles.ovi, 'ovi_negative_text_embeds')).toBe(roles.soundNo);
    expect(feeds(canvas, roles.decode, 'samples')).toBe(roles.sampler);
    expect(feeds(canvas, roles.soundDecode, 'samples')).toBe(roles.sampler);
    expect(feeds(canvas, roles.video, 'audio')).toBe(roles.soundDecode);
    expect(canvas.node(roles.soundVae).values.vocoder).not.toBe(canvas.node(roles.soundVae).values.vae);
    // A description without the marks is long enough and still not done.
    text.values.positive_prompt = 'A man in a kitchen says good morning.';
    const asks = done(lesson, canvas);
    expect(lesson.steps[asks.current].id).toBe('speech');
    expect(asks.missing[0]).toMatchObject({ kind: 'field', field: 'positive_prompt', test: { kind: 'text', has: ['<S>', '<E>'] } });
    text.values.positive_prompt = 'A man in a kitchen says <S>Good morning.<E>';
    expect(done(lesson, canvas).current).toBe(lesson.steps.length);
  });

  it('says consent before anything is built where a face or a voice is given to someone', async () => {
    const { lessonWords } = await import('../../src/shared/lessons/texts');
    for (const id of ['wrapper-animate', 'wrapper-unianimate', 'wrapper-talk', 'wrapper-duo', 'wrapper-fantasy', 'wrapper-ovi']) {
      expect(lessonById(id)!.steps[0]).toMatchObject({ id: 'intro', read: true });
      expect(lessonWords('ru', id)!.steps.intro.body, id).toMatch(/соглас/);
      expect(lessonWords('en', id)!.steps.intro.body, id).toMatch(/agree|consent/);
    }
  });
});

describe('a lesson is offered only where it fits', () => {
  it('names the class that is not installed', () => {
    const without: ClassPorts = (classType) => (classType === 'WanImageToVideo' ? null : ports(classType));
    expect(lessonGaps(lessonById('video-image')!, without)).toEqual([{ kind: 'class', role: 'start', classes: ['WanImageToVideo'] }]);
    expect(lessonGaps(lessonById('video-text')!, without)).toEqual([]);
    // The prompt in use may feed any of three classes: one of them is enough.
    expect(lessonGaps(lessonById('lora')!, without)).toEqual([]);
    expect(classOfRole(lessonById('lora')!, 'wants', without)).toBe('KSamplerAdvanced');
    expect(classOfRole(lessonById('lora')!, 'wants', ports)).toBe('WanImageToVideo');
    expect(classOfRole(lessonById('lora')!, 'nobody', ports)).toBeNull();
  });

  it('names the input a class lacks when it is built differently here', () => {
    const changed: ClassPorts = (classType) => {
      const known = ports(classType);
      return known && classType === 'CreateVideo' ? { ...known, inputs: known.inputs.filter((name) => name !== 'fps') } : known;
    };
    expect(lessonGaps(lessonById('video-text')!, changed)).toEqual([{ kind: 'port', classType: 'CreateVideo', port: 'fps', side: 'input' }]);
  });

  it('lists every role once with the step that brings it', () => {
    const roles = rolesOf(lessonById('image')!);
    expect(roles.map((item) => item.role)).toEqual(['checkpoint', 'positive', 'negative', 'latent', 'sampler', 'decode', 'save']);
    expect(roles[0].step).toBe(1);
  });
});

describe('the words of the lessons', () => {
  it('has a title and a text for every step, in both languages, and names only nodes the lesson has', async () => {
    const { lessonWords, rolesIn, withNodeNames } = await import('../../src/shared/lessons/texts');
    const unnamed: string[] = [];
    for (const language of ['ru', 'en'] as const) {
      for (const lesson of LESSONS) {
        const words = lessonWords(language, lesson.id);
        expect(words, `${language}/${lesson.id}`).not.toBeNull();
        expect(words!.title.length, `${language}/${lesson.id} title`).toBeGreaterThan(3);
        expect(words!.result.length, `${language}/${lesson.id} result`).toBeGreaterThan(10);
        // No words for a step that is not there, and none missing.
        expect(Object.keys(words!.steps).sort(), `${language}/${lesson.id}`).toEqual(lesson.steps.map((step) => step.id).sort());
        const roles = new Set(rolesOf(lesson).map((item) => item.role));
        for (const step of lesson.steps) {
          const text = words!.steps[step.id];
          expect(text.title.trim().length, `${language}/${lesson.id}/${step.id} title`).toBeGreaterThan(2);
          expect(text.body.trim().length, `${language}/${lesson.id}/${step.id} body`).toBeGreaterThan(30);
          for (const role of rolesIn(`${text.title} ${text.body}`)) expect(roles.has(role), `${language}/${lesson.id}/${step.id} names {${role}}`).toBe(true);
          // Once the names are in, nothing of the template is left for a person to see.
          const shown = withNodeNames(`${text.title}\n${text.body}`, (role) => `Node ${role}`);
          expect(shown).not.toMatch(/[{}]|undefined|\[object/);
          // A step that asks for a field names it the way the node shows it.
          for (const spec of step.fields ?? []) {
            if (!text.body.includes(`\`${spec.field}\``)) unnamed.push(`${language}/${lesson.id}/${step.id}: ${spec.field}`);
          }
        }
      }
    }
    expect(unnamed, 'fields a step asks for and does not name').toEqual([]);
    expect(lessonWords('ru', 'nope')).toBeNull();
    // Another interface language reads the English words.
    expect(lessonWords('de', 'image')).toBe(lessonWords('en', 'image'));
    expect(withNodeNames('Add {latent} and {nobody}.', (role) => (role === 'latent' ? 'Empty *Latent* Image' : null))).toBe('Add **Empty Latent Image** and **nobody**.');
  });

  it('says the same numbers in both languages', async () => {
    const { lessonWords } = await import('../../src/shared/lessons/texts');
    const numbers = (text: string) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((item) => item.replace(',', '.')).join(' ');
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        const ru = lessonWords('ru', lesson.id)!.steps[step.id];
        const en = lessonWords('en', lesson.id)!.steps[step.id];
        expect(numbers(ru.body), `${lesson.id}/${step.id}`).toBe(numbers(en.body));
        // And the same fields and values in backticks.
        const marked = (text: string) => (text.match(/`[^`]+`/g) ?? []).sort().join(' ');
        expect(marked(ru.body), `${lesson.id}/${step.id}`).toBe(marked(en.body));
      }
    }
  });

  it("names only fields that the nodes of the lesson's graph have", async () => {
    const { lessonWords } = await import('../../src/shared/lessons/texts');
    const inputsOf = (classType: string) => CLASSES[classType].inputs.map(([name]) => name);
    // A word in backticks that is an input of some node is a field; the rest are values and file names.
    // Three words are values in some lessons and fields of a pack's node in others: a precision (`fp16`, a field
    // of ProPainter), and the block swapping that WanVideoWrapper and SeedVR2 both name.
    const notFields = new Set(['fp16', 'offload_device', 'blocks_to_swap']);
    const fields = new Set(Object.keys(CLASSES).flatMap(inputsOf).filter((word) => !notFields.has(word)));
    // What a lesson's graph is made of: its own nodes, those of the lessons it stands on, and those of a lesson
    // its text sends the reader to by name. The samplers of a video graph call the seed `noise_seed`; a lesson
    // on that graph that said `seed` would send a person to a field that is not there.
    // A rule that holds the description to the words of whatever LoRA select node is on the canvas looks at that
    // class too: its fields are the lesson's business.
    const own = (id: string): string[] => [
      ...rolesOf(lessonById(id)!).map((spec) => spec.classes[0]),
      ...lessonById(id)!.steps.flatMap((step) => step.fields ?? []).flatMap((spec) => (spec.test.kind === 'has-trigger' ? spec.test.of.flatMap((source) => ('classType' in source ? [source.classType] : [])) : [])),
    ];
    const standsOn = (id: string): string[] => (LESSON_AFTER[id] ?? []).flatMap((other) => [other, ...standsOn(other)]);
    const strangers: string[] = [];
    for (const language of ['ru', 'en'] as const) {
      for (const lesson of LESSONS) {
        const said = Object.values(lessonWords(language, lesson.id)!.steps).map((step) => step.body).join('\n');
        const sentTo = LESSONS.filter((other) => other.id !== lesson.id && said.includes(lessonWords(language, other.id)!.title)).map((other) => other.id);
        const here = new Set([lesson.id, ...standsOn(lesson.id), ...sentTo].flatMap(own).flatMap(inputsOf));
        for (const [stepId, text] of Object.entries(lessonWords(language, lesson.id)!.steps)) {
          for (const marked of text.body.match(/`[^`]+`/g) ?? []) {
            const word = marked.slice(1, -1);
            if (fields.has(word) && !here.has(word)) strangers.push(`${language}/${lesson.id}/${stepId}: ${word}`);
          }
        }
      }
    }
    expect(strangers, 'fields a lesson names that no node of its graph has').toEqual([]);
  });

  it('keeps adult teaching factual with consent, age and lawful-use guidance', async () => {
    const { lessonWords } = await import('../../src/shared/lessons/texts');
    for (const language of ['ru', 'en'] as const) {
      const words = lessonWords(language, 'adult')!;
      const rules = words.steps.rules.body.toLowerCase();
      // Age, consent and law are guidance, rather than a promised app topic filter.
      expect(rules).toContain('18+');
      expect(rules).toMatch(language === 'ru' ? /закон/ : /law/);
      expect(rules).toMatch(language === 'ru' ? /согласие/ : /consent/);
      expect(lessonById('adult')!.steps[0].id).toBe('rules');
      // And the helper's privacy is said: descriptions travel with the graph.
      expect(words.steps.helper.body).toMatch(language === 'ru' ? /Приватность/ : /Privacy/);
    }
  });
});

describe('what the lessons say about their own size', () => {
  it('names the number of nodes the lesson really has', async () => {
    const { lessonWords } = await import('../../src/shared/lessons/texts');
    const count = (id: string) => rolesOf(lessonById(id)!).length;
    expect(count('image')).toBe(7);
    expect(lessonWords('en', 'image')!.result).toContain('seven nodes');
    expect(lessonWords('ru', 'image')!.result).toContain('семи нод');
    expect(count('video-text')).toBe(14);
    expect(lessonWords('en', 'video-text')!.steps.intro.body).toContain('fourteen nodes');
    expect(lessonWords('ru', 'video-text')!.steps.intro.body).toContain('четырнадцать нод');
  });
});
