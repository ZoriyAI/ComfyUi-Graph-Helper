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
  imageCheckpoint: { kind: 'imageCheckpoint', notFamilies: VIDEO, example: 'juggernautXL_v9.safetensors' },
  wanT2vHigh: { kind: 'wanT2vHigh', families: ['wan2.2'], marks: [['high']], notMarks: ['low', 'i2v'], example: 'wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors' },
  wanT2vLow: { kind: 'wanT2vLow', families: ['wan2.2'], marks: [['low']], notMarks: ['high', 'i2v'], example: 'wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors' },
  wanI2vHigh: { kind: 'wanI2vHigh', families: ['wan2.2'], marks: [['high']], notMarks: ['low', 't2v'], example: 'wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors' },
  wanI2vLow: { kind: 'wanI2vLow', families: ['wan2.2'], marks: [['low']], notMarks: ['high', 't2v'], example: 'wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors' },
  /** Either half of Wan 2.2, from text or from a picture: the pack's graph takes both. */
  wanHigh: { kind: 'wanHigh', families: ['wan2.2'], marks: [['high']], notMarks: ['low'], example: 'Wan2_2-T2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors' },
  wanLow: { kind: 'wanLow', families: ['wan2.2'], marks: [['low']], notMarks: ['high'], example: 'Wan2_2-T2V-A14B-LOW_fp8_e4m3fn_scaled_KJ.safetensors' },
  /** Wan 2.1 picture to video, 14B: the base of the talking lessons and UniAnimate. */
  wan21I2v: { kind: 'wan21I2v', families: ['wan2.1'], marks: [['i2v']], notMarks: ['t2v'], example: 'wan2.1_i2v_480p_14B_fp8_scaled.safetensors' },
  wanAnimate: { kind: 'wanAnimate', families: WAN, marks: [['animate']], example: 'Wan2_2-Animate-14B_fp8_e4m3fn_scaled_KJ.safetensors' },
  recam: { kind: 'recam', families: WAN, marks: [['recam']], example: 'Wan2_1_kwai_recammaster_1_3B_step20000_bf16.safetensors' },
  ovi: { kind: 'ovi', marks: [['ovi']], notMarks: ['audio'], example: 'Wan2_2-Ovi-960x960-10s_fp8_e4m3fn_scaled_KJ.safetensors' },
  oviAudio: { kind: 'oviAudio', marks: [['ovi'], ['audio']], example: 'Wan2_2-Ovi-audio_model_bf16.safetensors' },
  /** The text encoder of Wan: umt5-xxl, in ComfyUI's form or the pack's. */
  umt5: { kind: 'umt5', marks: [['umt5']], example: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors' },
  wan21Vae: { kind: 'wan21Vae', marks: [['wan21']], example: 'wan_2.1_vae.safetensors' },
  wan22Vae: { kind: 'wan22Vae', marks: [['wan22']], example: 'Wan2_2_VAE_bf16.safetensors' },
  clipVisionH: { kind: 'clipVisionH', marks: [['clipvisionh', 'vith', 'vithuge']], example: 'clip_vision_h.safetensors' },
  /** A LoRA for Wan on the path of the first model: a `high` file, or one LoRA without a pair. */
  wanLoraHigh: { kind: 'wanLoraHigh', families: WAN, notMarks: ['lownoise', 'low'], example: 'my_style_wan22_high_noise.safetensors' },
  wanLoraLow: { kind: 'wanLoraLow', families: WAN, notMarks: ['highnoise', 'high'], example: 'my_style_wan22_low_noise.safetensors' },
  fastLoraHigh: { kind: 'fastLoraHigh', families: WAN, marks: [['lightx2v', 'lightning', '4step', 'distill', 'causvid', 'fastwan']], notMarks: ['low'], example: 'wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors' },
  fastLoraLow: { kind: 'fastLoraLow', families: WAN, marks: [['lightx2v', 'lightning', '4step', 'distill', 'causvid', 'fastwan']], notMarks: ['high'], example: 'wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors' },
  vaceHigh: { kind: 'vaceHigh', marks: [['vace'], ['high']], notMarks: ['low'], example: 'Wan2_2_Fun_VACE_module_A14B_HIGH_fp8_e4m3fn_scaled_KJ.safetensors' },
  vaceLow: { kind: 'vaceLow', marks: [['vace'], ['low']], notMarks: ['high'], example: 'Wan2_2_Fun_VACE_module_A14B_LOW_fp8_e4m3fn_scaled_KJ.safetensors' },
  vitpose: { kind: 'vitpose', marks: [['vitpose']], example: 'vitpose-l-wholebody.onnx' },
  yolo: { kind: 'yolo', marks: [['yolo']], example: 'yolov10m.onnx' },
  talkModule: { kind: 'talkModule', marks: [['infinitetalk', 'multitalk']], example: 'Wan2_1-InfiniteTalk_Single_fp8_e4m3fn_scaled_KJ.safetensors' },
  talkModuleMulti: { kind: 'talkModuleMulti', marks: [['multi']], example: 'Wan2_1-InfiniteTalk_Multi_fp8_e4m3fn_scaled_KJ.safetensors' },
  wav2vec: { kind: 'wav2vec', marks: [['wav2vec']], example: 'chinese-wav2vec2-base-fp16.safetensors' },
  fantasyModule: { kind: 'fantasyModule', marks: [['fantasy']], example: 'fantasytalking_fp16.safetensors' },
  uniLora: { kind: 'uniLora', marks: [['unianimate']], example: 'UniAnimate-Wan2.1-14B-Lora-12000-fp16.safetensors' },
  mmaudioVae: { kind: 'mmaudioVae', marks: [['mmaudio']], notMarks: ['vocoder'], example: 'mmaudio_vae_16k_fp32.safetensors' },
  mmaudioVocoder: { kind: 'mmaudioVocoder', marks: [['vocoder', 'bigvgan']], example: 'mmaudio_vocoder_bigvgan_best_netG_fp32.safetensors' },
} satisfies Record<string, FileWant>;

export type FileKind = keyof typeof FILES;
