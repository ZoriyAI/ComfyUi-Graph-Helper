import type { BaseModelFamily } from '../contracts/knowledge';
import { familyFromText } from '../knowledge/baseModel';

/**
 * What kind of model file a lesson step asks for, and how a file on the canvas is held to it. A lesson that only
 * asked "is something chosen" counted the first file of the list, whatever it was: a picture model as the second
 * half of a video model, a VAE of another family. A file is judged by what the app already knows of it: the family
 * its metadata names (when the catalog has read it) or its name gives away, and the marks a name carries by the
 * convention every model page follows (`t2v` and `i2v`, `high_noise` and `low_noise`, `umt5`, `wan_2.1_vae`).
 *
 * A file whose family nothing tells is not held to a family: a fine-tune named "myModel" may well be right. It is
 * still held to the marks a step names, because the step's own text names them.
 */

export interface FileWant {
  /**
   * What the file must be, as an id: the sentence that says it is `lessons.fileKind.<kind>` in the catalog, so a
   * wrong file is told in the person's words ("the low_noise half of Wan 2.2 text to video").
   */
  kind: string;
  /** Families the file may be of. A file of another known family is the wrong one. */
  families?: BaseModelFamily[];
  /** Families the file may not be of (a video model where a picture checkpoint is asked for). */
  notFamilies?: BaseModelFamily[];
  /** Every group must be met: the name holds at least one mark of the group. */
  marks?: string[][];
  /** The name holds none of these. */
  notMarks?: string[];
  /** A name of this kind, as the model pages give it: for tests, and for the documentation of the format. */
  example: string;
  /** The folder under ComfyUI's `models` the file is put into. */
  folder: string;
  /** The file ends so (".gguf"): a loader of quantised models lists only such files. */
  ext?: string;
}

/** Why a file is not the one asked for. */
export type FileMiss =
  | { kind: 'family'; family: BaseModelFamily }
  | { kind: 'mark'; marks: string[] }
  | { kind: 'not-mark'; mark: string };

/**
 * A name as letters and digits only, lower case: `Wan2_2-I2V-A14B-HIGH_fp8.safetensors` and
 * `wan2.2_i2v_high_noise_14B` both read `wan22i2v...high...`. Marks are looked for inside it.
 */
export function compactName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  return base.replace(/\.(safetensors|sft|ckpt|pt|pth|bin|gguf|onnx)$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** The family a file is of: what its metadata says when the app has read it, else what its name says. */
export function familyOfFile(name: string, known?: BaseModelFamily | null): BaseModelFamily {
  if (known && known !== 'unknown') return known;
  return familyFromText(name.split(/[\\/]/).pop() ?? name);
}

/** Null when the file is of the kind asked for; otherwise the first reason it is not. */
export function fileMiss(name: string, want: FileWant, known?: BaseModelFamily | null): FileMiss | null {
  if (want.ext && !name.toLowerCase().endsWith(want.ext)) return { kind: 'mark', marks: [want.ext] };
  const family = familyOfFile(name, known);
  if (family !== 'unknown') {
    if (want.families && !want.families.includes(family)) return { kind: 'family', family };
    if (want.notFamilies?.includes(family)) return { kind: 'family', family };
  }
  const compact = compactName(name);
  for (const mark of want.notMarks ?? []) if (compact.includes(mark)) return { kind: 'not-mark', mark };
  for (const group of want.marks ?? []) if (!group.some((mark) => compact.includes(mark))) return { kind: 'mark', marks: group };
  return null;
}

const WAN: BaseModelFamily[] = ['wan2.1', 'wan2.2'];
const VIDEO: BaseModelFamily[] = ['wan2.1', 'wan2.2', 'ltx2', 'hunyuan'];

/** The kinds of file the lessons ask for. Marks are written as `compactName` reads names. */
export const FILES = {
  /** A picture checkpoint: anything but a video model. */
  imageCheckpoint: { kind: 'imageCheckpoint', notFamilies: VIDEO, folder: 'checkpoints', example: 'juggernautXL_v9.safetensors' },
  wanT2vHigh: { kind: 'wanT2vHigh', families: ['wan2.2'], marks: [['high']], notMarks: ['low', 'i2v'], folder: 'diffusion_models', example: 'wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors' },
  wanT2vLow: { kind: 'wanT2vLow', families: ['wan2.2'], marks: [['low']], notMarks: ['high', 'i2v'], folder: 'diffusion_models', example: 'wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors' },
  wanI2vHigh: { kind: 'wanI2vHigh', families: ['wan2.2'], marks: [['high']], notMarks: ['low', 't2v'], folder: 'diffusion_models', example: 'wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors' },
  wanI2vLow: { kind: 'wanI2vLow', families: ['wan2.2'], marks: [['low']], notMarks: ['high', 't2v'], folder: 'diffusion_models', example: 'wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors' },
  /** Either half of Wan 2.2, from text or from a picture: the pack's graph takes both. */
  wanHigh: { kind: 'wanHigh', families: ['wan2.2'], marks: [['high']], notMarks: ['low'], folder: 'diffusion_models', example: 'Wan2_2-T2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors' },
  wanLow: { kind: 'wanLow', families: ['wan2.2'], marks: [['low']], notMarks: ['high'], folder: 'diffusion_models', example: 'Wan2_2-T2V-A14B-LOW_fp8_e4m3fn_scaled_KJ.safetensors' },
  /** Wan 2.1 picture to video, 14B: the base of the talking lessons and UniAnimate. */
  wan21I2v: { kind: 'wan21I2v', families: ['wan2.1'], marks: [['i2v']], notMarks: ['t2v'], folder: 'diffusion_models', example: 'wan2.1_i2v_480p_14B_fp8_scaled.safetensors' },
  wanAnimate: { kind: 'wanAnimate', families: WAN, marks: [['animate']], folder: 'diffusion_models', example: 'Wan2_2-Animate-14B_fp8_e4m3fn_scaled_KJ.safetensors' },
  recam: { kind: 'recam', families: WAN, marks: [['recam']], folder: 'diffusion_models', example: 'Wan2_1_kwai_recammaster_1_3B_step20000_bf16.safetensors' },
  ovi: { kind: 'ovi', marks: [['ovi']], notMarks: ['audio'], folder: 'diffusion_models', example: 'Wan2_2-Ovi-960x960-10s_fp8_e4m3fn_scaled_KJ.safetensors' },
  oviAudio: { kind: 'oviAudio', marks: [['ovi'], ['audio']], folder: 'diffusion_models', example: 'Wan2_2-Ovi-audio_model_bf16.safetensors' },
  /** The text encoder of Wan: umt5-xxl, in ComfyUI's form or the pack's. */
  umt5: { kind: 'umt5', marks: [['umt5']], folder: 'text_encoders', example: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors' },
  wan21Vae: { kind: 'wan21Vae', marks: [['wan21']], folder: 'vae', example: 'wan_2.1_vae.safetensors' },
  wan22Vae: { kind: 'wan22Vae', marks: [['wan22']], folder: 'vae', example: 'Wan2_2_VAE_bf16.safetensors' },
  clipVisionH: { kind: 'clipVisionH', marks: [['clipvisionh', 'vith', 'vithuge']], folder: 'clip_vision', example: 'clip_vision_h.safetensors' },
  /** A LoRA for Wan on the path of the first model: a `high` file, or one LoRA without a pair. */
  wanLoraHigh: { kind: 'wanLoraHigh', families: WAN, notMarks: ['lownoise', 'low'], folder: 'loras', example: 'my_style_wan22_high_noise.safetensors' },
  wanLoraLow: { kind: 'wanLoraLow', families: WAN, notMarks: ['highnoise', 'high'], folder: 'loras', example: 'my_style_wan22_low_noise.safetensors' },
  fastLoraHigh: { kind: 'fastLoraHigh', families: WAN, marks: [['lightx2v', 'lightning', '4step', 'distill', 'causvid', 'fastwan']], notMarks: ['low'], folder: 'loras', example: 'wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors' },
  fastLoraLow: { kind: 'fastLoraLow', families: WAN, marks: [['lightx2v', 'lightning', '4step', 'distill', 'causvid', 'fastwan']], notMarks: ['high'], folder: 'loras', example: 'wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors' },
  vaceHigh: { kind: 'vaceHigh', marks: [['vace'], ['high']], notMarks: ['low'], folder: 'diffusion_models', example: 'Wan2_2_Fun_VACE_module_A14B_HIGH_fp8_e4m3fn_scaled_KJ.safetensors' },
  vaceLow: { kind: 'vaceLow', marks: [['vace'], ['low']], notMarks: ['high'], folder: 'diffusion_models', example: 'Wan2_2_Fun_VACE_module_A14B_LOW_fp8_e4m3fn_scaled_KJ.safetensors' },
  vitpose: { kind: 'vitpose', marks: [['vitpose']], folder: 'detection', example: 'vitpose-l-wholebody.onnx' },
  yolo: { kind: 'yolo', marks: [['yolo']], folder: 'detection', example: 'yolov10m.onnx' },
  talkModule: { kind: 'talkModule', marks: [['infinitetalk', 'multitalk']], folder: 'diffusion_models', example: 'Wan2_1-InfiniteTalk_Single_fp8_e4m3fn_scaled_KJ.safetensors' },
  talkModuleMulti: { kind: 'talkModuleMulti', marks: [['multi']], folder: 'diffusion_models', example: 'Wan2_1-InfiniteTalk_Multi_fp8_e4m3fn_scaled_KJ.safetensors' },
  wav2vec: { kind: 'wav2vec', marks: [['wav2vec']], folder: 'wav2vec2', example: 'chinese-wav2vec2-base-fp16.safetensors' },
  fantasyModule: { kind: 'fantasyModule', marks: [['fantasy']], folder: 'diffusion_models', example: 'fantasytalking_fp16.safetensors' },
  uniLora: { kind: 'uniLora', marks: [['unianimate']], folder: 'loras', example: 'UniAnimate-Wan2.1-14B-Lora-12000-fp16.safetensors' },
  mmaudioVae: { kind: 'mmaudioVae', marks: [['mmaudio']], notMarks: ['vocoder'], folder: 'mmaudio', example: 'mmaudio_vae_16k_fp32.safetensors' },
  mmaudioVocoder: { kind: 'mmaudioVocoder', marks: [['vocoder', 'bigvgan']], folder: 'mmaudio', example: 'mmaudio_vocoder_bigvgan_best_netG_fp32.safetensors' },
  // The picture families of the image-models set (sets/image-models.ts).
  sdxlCheckpoint: { kind: 'sdxlCheckpoint', families: ['sdxl', 'pony', 'illustrious'], folder: 'checkpoints', example: 'sd_xl_base_1.0.safetensors' },
  tagCheckpoint: { kind: 'tagCheckpoint', families: ['pony', 'illustrious'], folder: 'checkpoints', example: 'ponyDiffusionV6XL.safetensors' },
  sd35Checkpoint: { kind: 'sd35Checkpoint', families: ['sd3'], marks: [['sd35', 'sd3']], folder: 'checkpoints', example: 'sd3.5_medium_incl_clips_t5xxlfp8scaled.safetensors' },
  /** A full VAE, not the small preview decoders (taesd, vae_approx) that show the steps while a picture is drawn. */
  vaeFull: { kind: 'vaeFull', notMarks: ['taesd', 'taef', 'approx'], folder: 'vae', example: 'sdxl_vae.safetensors' },
  flux1Model: { kind: 'flux1Model', families: ['flux1'], marks: [['flux']], folder: 'diffusion_models', example: 'flux1-dev-fp8.safetensors' },
  clipL: { kind: 'clipL', marks: [['clipl']], folder: 'text_encoders', example: 'clip_l.safetensors' },
  t5xxl: { kind: 't5xxl', marks: [['t5']], notMarks: ['umt5'], folder: 'text_encoders', example: 't5xxl_fp8_e4m3fn_scaled.safetensors' },
  fluxAe: { kind: 'fluxAe', marks: [['ae', 'flux']], notMarks: ['flux2', 'sdxl', 'wan', 'qwen', 'taesd', 'taef', 'approx', 'sd15', 'sd3'], folder: 'vae', example: 'ae.safetensors' },
  zimageModel: { kind: 'zimageModel', families: ['zimage'], marks: [['zimage']], folder: 'diffusion_models', example: 'z_image_turbo_bf16.safetensors' },
  qwen3Small: { kind: 'qwen3Small', marks: [['qwen34b']], folder: 'text_encoders', example: 'qwen_3_4b.safetensors' },
  qwenImageModel: { kind: 'qwenImageModel', families: ['qwen-image'], marks: [['qwenimage']], notMarks: ['edit'], folder: 'diffusion_models', example: 'qwen_image_fp8_e4m3fn.safetensors' },
  qwen25vl: { kind: 'qwen25vl', marks: [['qwen25vl']], folder: 'text_encoders', example: 'qwen_2.5_vl_7b_fp8_scaled.safetensors' },
  qwenImageVae: { kind: 'qwenImageVae', marks: [['qwenimagevae']], folder: 'vae', example: 'qwen_image_vae.safetensors' },
  kleinModel: { kind: 'kleinModel', families: ['flux2'], marks: [['klein']], folder: 'diffusion_models', example: 'flux-2-klein-base-4b-fp8.safetensors' },
  kleinEncoder: { kind: 'kleinEncoder', marks: [['qwen34b', 'qwen38b']], folder: 'text_encoders', example: 'qwen_3_8b_fp8mixed.safetensors' },
  flux2Vae: { kind: 'flux2Vae', marks: [['flux2vae']], folder: 'vae', example: 'flux2-vae.safetensors' },
  /** A quantised model for the graphs the GGUF lesson stands on: Flux.1 or Z-Image. */
  ggufModel: { kind: 'ggufModel', families: ['flux1', 'zimage'], ext: '.gguf', folder: 'diffusion_models', example: 'flux1-dev-Q4_K_S.gguf' },
} satisfies Record<string, FileWant>;

export type FileKind = keyof typeof FILES;

/** Every model file a lesson asks for, once per kind, in the order the steps ask: for the card of a lesson. */
export function filesOfLesson(lesson: { steps: ReadonlyArray<{ fields?: ReadonlyArray<{ test: { kind: string; want?: FileWant } }> }> }): FileWant[] {
  const out: FileWant[] = [];
  for (const step of lesson.steps) {
    for (const rule of step.fields ?? []) {
      const want = rule.test.kind === 'file' ? rule.test.want : undefined;
      if (want && !out.includes(want)) out.push(want);
    }
  }
  return out;
}

/**
 * Which of the kinds a lesson asks for the person already has, from the list of model files the app reads. A kind
 * with no file is told before the lesson starts, with the folder it goes into; the app downloads nothing.
 */
export function filesAtHand(wants: readonly FileWant[], names: readonly string[], families: Readonly<Record<string, BaseModelFamily>> = {}): Array<{ want: FileWant; file: string | null }> {
  return wants.map((want) => ({ want, file: names.find((name) => fileMiss(name, want, families[name]) === null) ?? null }));
}
