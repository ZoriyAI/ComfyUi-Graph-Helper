/**
 * The node classes the video lessons of src/shared/lessons/sets/video.ts use and the fake ComfyUI does not have yet,
 * written as ComfyUI's /object_info describes them. Inputs, defaults and output names are the ones in ComfyUI's own
 * source (comfy_extras: nodes_wan, nodes_lt, nodes_lt_audio, nodes_lt_upsampler, nodes_hunyuan, nodes_kandinsky5,
 * nodes_custom_sampler, nodes_audio_encoder, nodes_frame_interpolation, nodes_mask; nodes.py) and in the packs' own
 * repositories (ComfyUI-SeedVR2_VideoUpscaler src/interfaces, ComfyUI-VideoHelperSuite videohelpersuite,
 * ComfyUI_ProPainter_Nodes propainter_nodes.py).
 *
 * Two readers: the fake MCP server serves these with `video: true`, and the unit tests of the lessons turn them into
 * their own small form with `videoSetSpecs()`.
 */

type InputSpec = [string, Record<string, unknown>?] | [string[], Record<string, unknown>?];

export interface VideoClassDef {
  classType: string;
  /** Index into the fake server's PACKS. The packs of these lessons are not among them: their classes stand under 0. */
  pack: number;
  display: string;
  category: string;
  required?: Record<string, InputSpec>;
  optional?: Record<string, InputSpec>;
  output: string[];
  outputName?: string[];
  outputNode?: boolean;
  description?: string;
}

const INT = (value: number, extra: Record<string, unknown> = {}): InputSpec => ['INT', { default: value, ...extra }];
const FLOAT = (value: number, extra: Record<string, unknown> = {}): InputSpec => ['FLOAT', { default: value, ...extra }];
const BOOL = (value: boolean): InputSpec => ['BOOLEAN', { default: value }];
const STRING = (value: string): InputSpec => ['STRING', { default: value }];
const COMBO = (options: string[], value?: string): InputSpec => (value === undefined ? [options] : [options, { default: value }]);
const WAN_SIZE = { width: INT(832, { min: 16, step: 16 }), height: INT(480, { min: 16, step: 16 }) };

export const VIDEO_SET_CLASSES: VideoClassDef[] = [
  // Wan 2.2: the small model's start, first and last frame, Fun Control, HuMo.
  {
    classType: 'Wan22ImageToVideoLatent', pack: 0, display: 'Wan22ImageToVideoLatent', category: 'conditioning/inpaint',
    required: { vae: ['VAE'], width: INT(1280, { min: 32, step: 32 }), height: INT(704, { min: 32, step: 32 }), length: INT(49, { min: 1, step: 4 }), batch_size: INT(1) },
    optional: { start_image: ['IMAGE'] },
    output: ['LATENT'],
  },
  {
    classType: 'WanFirstLastFrameToVideo', pack: 0, display: 'WanFirstLastFrameToVideo', category: 'conditioning/video_models',
    required: { positive: ['CONDITIONING'], negative: ['CONDITIONING'], vae: ['VAE'], ...WAN_SIZE, length: INT(81, { step: 4 }), batch_size: INT(1) },
    optional: { clip_vision_start_image: ['CLIP_VISION_OUTPUT'], clip_vision_end_image: ['CLIP_VISION_OUTPUT'], start_image: ['IMAGE'], end_image: ['IMAGE'] },
    output: ['CONDITIONING', 'CONDITIONING', 'LATENT'], outputName: ['positive', 'negative', 'latent'],
  },
  {
    classType: 'Wan22FunControlToVideo', pack: 0, display: 'Wan22FunControlToVideo', category: 'conditioning/video_models',
    required: { positive: ['CONDITIONING'], negative: ['CONDITIONING'], vae: ['VAE'], ...WAN_SIZE, length: INT(81, { step: 4 }), batch_size: INT(1) },
    optional: { ref_image: ['IMAGE'], control_video: ['IMAGE'] },
    output: ['CONDITIONING', 'CONDITIONING', 'LATENT'], outputName: ['positive', 'negative', 'latent'],
  },
  {
    classType: 'WanVaceToVideo', pack: 0, display: 'WanVaceToVideo', category: 'conditioning/video_models',
    required: { positive: ['CONDITIONING'], negative: ['CONDITIONING'], vae: ['VAE'], ...WAN_SIZE, length: INT(81, { step: 4 }), batch_size: INT(1), strength: FLOAT(1, { min: 0, max: 1000 }) },
    optional: { control_video: ['IMAGE'], control_masks: ['MASK'], reference_image: ['IMAGE'] },
    output: ['CONDITIONING', 'CONDITIONING', 'LATENT', 'INT'], outputName: ['positive', 'negative', 'latent', 'trim_latent'],
  },
  { classType: 'TrimVideoLatent', pack: 0, display: 'TrimVideoLatent', category: 'latent/video', required: { samples: ['LATENT'], trim_amount: INT(0) }, output: ['LATENT'] },
  { classType: 'ImageBatch', pack: 0, display: 'Batch Images', category: 'image', required: { image1: ['IMAGE'], image2: ['IMAGE'] }, output: ['IMAGE'] },
  { classType: 'AudioEncoderLoader', pack: 0, display: 'Audio Encoder Loader', category: 'loaders', required: { audio_encoder_name: COMBO(['whisper_large_v3_fp16.safetensors', 'wav2vec2_large_english_fp16.safetensors']) }, output: ['AUDIO_ENCODER'] },
  { classType: 'AudioEncoderEncode', pack: 0, display: 'Audio Encoder Encode', category: 'conditioning', required: { audio_encoder: ['AUDIO_ENCODER'], audio: ['AUDIO'] }, output: ['AUDIO_ENCODER_OUTPUT'] },
  {
    classType: 'WanHuMoImageToVideo', pack: 0, display: 'WanHuMoImageToVideo', category: 'conditioning/video_models',
    required: { positive: ['CONDITIONING'], negative: ['CONDITIONING'], vae: ['VAE'], ...WAN_SIZE, length: INT(97, { step: 4 }), batch_size: INT(1) },
    optional: { audio_encoder_output: ['AUDIO_ENCODER_OUTPUT'], ref_image: ['IMAGE'] },
    output: ['CONDITIONING', 'CONDITIONING', 'LATENT'], outputName: ['positive', 'negative', 'latent'],
  },
  // LTX-2: video and sound in one latent, two stages with a latent upscaler between them.
  {
    classType: 'LTXVConditioning', pack: 0, display: 'LTXVConditioning', category: 'conditioning/video_models',
    required: { positive: ['CONDITIONING'], negative: ['CONDITIONING'], frame_rate: FLOAT(25) },
    output: ['CONDITIONING', 'CONDITIONING'], outputName: ['positive', 'negative'],
  },
  { classType: 'EmptyLTXVLatentVideo', pack: 0, display: 'EmptyLTXVLatentVideo', category: 'latent/video/ltxv', required: { width: INT(768, { min: 64, step: 32 }), height: INT(512, { min: 64, step: 32 }), length: INT(97, { step: 8 }), batch_size: INT(1) }, output: ['LATENT'] },
  { classType: 'LTXVEmptyLatentAudio', pack: 0, display: 'Empty LTXV Latent Audio', category: 'model/latent/ltxv', required: { frames_number: INT(97), frame_rate: FLOAT(25), batch_size: INT(1), audio_vae: ['VAE'] }, output: ['LATENT'], outputName: ['Latent'] },
  { classType: 'LTXVConcatAVLatent', pack: 0, display: 'LTXVConcatAVLatent', category: 'latent/video/ltxv', required: { video_latent: ['LATENT'], audio_latent: ['LATENT'] }, output: ['LATENT'], outputName: ['latent'] },
  { classType: 'LTXVSeparateAVLatent', pack: 0, display: 'LTXVSeparateAVLatent', category: 'latent/video/ltxv', required: { av_latent: ['LATENT'] }, output: ['LATENT', 'LATENT'], outputName: ['video_latent', 'audio_latent'] },
  { classType: 'LTXVDualCFGGuider', pack: 0, display: 'LTXVDualCFGGuider', category: 'sampling/custom_sampling/guiders', required: { model: ['MODEL'], positive: ['CONDITIONING'], negative: ['CONDITIONING'], video_cfg: FLOAT(3), audio_cfg: FLOAT(7) }, output: ['GUIDER'] },
  { classType: 'LatentUpscaleModelLoader', pack: 0, display: 'Load Latent Upscale Model', category: 'loaders', required: { model_name: COMBO(['ltx-2.5-latent-spatial-upscaler-x2.safetensors']) }, output: ['LATENT_UPSCALE_MODEL'] },
  { classType: 'LTXVLatentUpsampler', pack: 0, display: 'LTXVLatentUpsampler', category: 'model/latent/ltxv', required: { samples: ['LATENT'], upscale_model: ['LATENT_UPSCALE_MODEL'], vae: ['VAE'] }, output: ['LATENT'] },
  { classType: 'LTXVAudioVAEDecode', pack: 0, display: 'LTXV Audio VAE Decode', category: 'model/latent/ltxv', required: { samples: ['LATENT'], audio_vae: ['VAE'] }, output: ['AUDIO'], outputName: ['Audio'] },
  // The custom sampler: noise, a guider, a sampler and a list of noise levels, each its own node.
  { classType: 'RandomNoise', pack: 0, display: 'RandomNoise', category: 'sampling/custom_sampling/noise', required: { noise_seed: INT(0) }, output: ['NOISE'] },
  { classType: 'KSamplerSelect', pack: 0, display: 'KSamplerSelect', category: 'sampling/custom_sampling/samplers', required: { sampler_name: COMBO(['euler', 'euler_ancestral', 'uni_pc'], 'euler') }, output: ['SAMPLER'] },
  { classType: 'ManualSigmas', pack: 0, display: 'ManualSigmas', category: 'sampling/custom_sampling/sigmas', required: { sigmas: STRING('1, 0.5') }, output: ['SIGMAS'] },
  { classType: 'BasicScheduler', pack: 0, display: 'BasicScheduler', category: 'sampling/custom_sampling/schedulers', required: { model: ['MODEL'], scheduler: COMBO(['simple', 'normal', 'beta'], 'simple'), steps: INT(20), denoise: FLOAT(1) }, output: ['SIGMAS'] },
  { classType: 'CFGGuider', pack: 0, display: 'CFGGuider', category: 'sampling/custom_sampling/guiders', required: { model: ['MODEL'], positive: ['CONDITIONING'], negative: ['CONDITIONING'], cfg: FLOAT(8) }, output: ['GUIDER'] },
  {
    classType: 'SamplerCustomAdvanced', pack: 0, display: 'SamplerCustomAdvanced', category: 'sampling/custom_sampling',
    required: { noise: ['NOISE'], guider: ['GUIDER'], sampler: ['SAMPLER'], sigmas: ['SIGMAS'], latent_image: ['LATENT'] },
    output: ['LATENT', 'LATENT'], outputName: ['output', 'denoised_output'],
  },
  {
    classType: 'VAEDecodeTiled', pack: 0, display: 'VAE Decode (Tiled)', category: 'latent',
    required: { samples: ['LATENT'], vae: ['VAE'], tile_size: INT(512, { step: 32 }), overlap: INT(64), temporal_size: INT(64, { step: 4 }), temporal_overlap: INT(8, { step: 4 }) },
    output: ['IMAGE'],
  },
  // HunyuanVideo 1.5 and Kandinsky 5.
  { classType: 'DualCLIPLoader', pack: 0, display: 'DualCLIPLoader', category: 'advanced/loaders', required: { clip_name1: COMBO(['qwen_2.5_vl_7b_fp8_scaled.safetensors', 'byt5_small_glyphxl_fp16.safetensors', 'clip_l.safetensors']), clip_name2: COMBO(['qwen_2.5_vl_7b_fp8_scaled.safetensors', 'byt5_small_glyphxl_fp16.safetensors', 'clip_l.safetensors']), type: COMBO(['sdxl', 'flux', 'hunyuan_video', 'hunyuan_video_15', 'kandinsky5', 'ltxv']) }, optional: { device: COMBO(['default', 'cpu']) }, output: ['CLIP'] },
  { classType: 'EmptyHunyuanVideo15Latent', pack: 0, display: 'Empty Hunyuan Video 1.5 Latent', category: 'model/latent/hunyuan video', required: { width: INT(848, { min: 16, step: 16 }), height: INT(480, { min: 16, step: 16 }), length: INT(25, { step: 4 }), batch_size: INT(1) }, output: ['LATENT'] },
  {
    classType: 'Kandinsky5ImageToVideo', pack: 0, display: 'Kandinsky5ImageToVideo', category: 'conditioning/video_models',
    required: { positive: ['CONDITIONING'], negative: ['CONDITIONING'], vae: ['VAE'], width: INT(768, { step: 16 }), height: INT(512, { step: 16 }), length: INT(121, { step: 4 }), batch_size: INT(1) },
    optional: { start_image: ['IMAGE'] },
    output: ['CONDITIONING', 'CONDITIONING', 'LATENT', 'LATENT'], outputName: ['positive', 'negative', 'latent', 'cond_latent'],
  },
  // Built-in frame interpolation, and a mask read from one colour of a picture.
  { classType: 'FrameInterpolationModelLoader', pack: 0, display: 'Load Frame Interpolation Model', category: 'loaders', required: { model_name: COMBO(['film_net_fp16.safetensors']) }, output: ['INTERP_MODEL'] },
  { classType: 'FrameInterpolate', pack: 0, display: 'Frame Interpolate', category: 'image/video', required: { interp_model: ['INTERP_MODEL'], images: ['IMAGE'], multiplier: INT(2, { min: 2, max: 16 }) }, output: ['IMAGE'] },
  { classType: 'ImageToMask', pack: 0, display: 'Convert Image to Mask', category: 'mask', required: { image: ['IMAGE'], channel: COMBO(['red', 'green', 'blue', 'alpha'], 'red') }, output: ['MASK'] },
  // ComfyUI-SeedVR2_VideoUpscaler.
  {
    classType: 'SeedVR2LoadDiTModel', pack: 0, display: 'SeedVR2 (Down)Load DiT Model', category: 'SEEDVR2',
    required: { model: COMBO(['seedvr2_ema_3b_fp16.safetensors', 'seedvr2_ema_7b_fp16.safetensors'], 'seedvr2_ema_3b_fp16.safetensors'), device: COMBO(['cuda:0', 'cpu'], 'cuda:0') },
    optional: { blocks_to_swap: INT(0, { min: 0, max: 36 }), swap_io_components: BOOL(false), offload_device: COMBO(['none', 'cpu'], 'none'), cache_model: BOOL(false), attention_mode: COMBO(['sdpa'], 'sdpa'), torch_compile_args: ['TORCH_COMPILE_ARGS'] },
    output: ['SEEDVR2_DIT'],
  },
  {
    classType: 'SeedVR2LoadVAEModel', pack: 0, display: 'SeedVR2 (Down)Load VAE Model', category: 'SEEDVR2',
    required: { model: COMBO(['ema_vae_fp16.safetensors'], 'ema_vae_fp16.safetensors'), device: COMBO(['cuda:0', 'cpu'], 'cuda:0') },
    optional: { encode_tiled: BOOL(false), encode_tile_size: INT(1024), encode_tile_overlap: INT(128), decode_tiled: BOOL(false), decode_tile_size: INT(1024), decode_tile_overlap: INT(128), offload_device: COMBO(['none', 'cpu'], 'none'), cache_model: BOOL(false), torch_compile_args: ['TORCH_COMPILE_ARGS'] },
    output: ['SEEDVR2_VAE'],
  },
  {
    classType: 'SeedVR2VideoUpscaler', pack: 0, display: 'SeedVR2 Video Upscaler', category: 'SEEDVR2',
    required: {
      image: ['IMAGE'], dit: ['SEEDVR2_DIT'], vae: ['SEEDVR2_VAE'], seed: INT(42), resolution: INT(1080, { step: 2 }), max_resolution: INT(0, { step: 2 }),
      batch_size: INT(5, { step: 4 }), uniform_batch_size: BOOL(false), color_correction: COMBO(['lab', 'wavelet', 'wavelet_adaptive', 'hsv', 'adain', 'none'], 'lab'),
    },
    optional: { temporal_overlap: INT(0), prepend_frames: INT(0), input_noise_scale: FLOAT(0), latent_noise_scale: FLOAT(0), offload_device: COMBO(['none', 'cpu'], 'none'), enable_debug: BOOL(false) },
    output: ['IMAGE'],
  },
  // ComfyUI-VideoHelperSuite.
  {
    classType: 'VHS_LoadVideo', pack: 0, display: 'Load Video (Upload) 🎥🅥🅗🅢', category: 'Video Helper Suite 🎥🅥🅗🅢',
    required: { video: COMBO(['dance.mp4', 'walk.mp4']), force_rate: INT(0, { min: 0, max: 60 }), custom_width: INT(0), custom_height: INT(0), frame_load_cap: INT(0), skip_first_frames: INT(0), select_every_nth: INT(1, { min: 1 }) },
    optional: { meta_batch: ['VHS_BatchManager'], vae: ['VAE'] },
    output: ['IMAGE', 'INT', 'AUDIO', 'VHS_VIDEOINFO'], outputName: ['IMAGE', 'frame_count', 'audio', 'video_info'],
  },
  {
    classType: 'VHS_VideoCombine', pack: 0, display: 'Video Combine 🎥🅥🅗🅢', category: 'Video Helper Suite 🎥🅥🅗🅢',
    required: { images: ['IMAGE'], frame_rate: FLOAT(8, { min: 1 }), loop_count: INT(0), filename_prefix: STRING('AnimateDiff'), format: COMBO(['image/gif', 'image/webp', 'video/h264-mp4', 'video/webm'], 'image/gif'), pingpong: BOOL(false), save_output: BOOL(true) },
    optional: { audio: ['AUDIO'], meta_batch: ['VHS_BatchManager'], vae: ['VAE'] },
    output: ['VHS_FILENAMES'], outputName: ['Filenames'], outputNode: true,
  },
  // ComfyUI_ProPainter_Nodes.
  {
    classType: 'ProPainterInpaint', pack: 0, display: 'ProPainter Inpainting', category: 'ProPainter',
    required: {
      image: ['IMAGE'], mask: ['MASK'], width: INT(640), height: INT(360), mask_dilates: INT(5), flow_mask_dilates: INT(8), ref_stride: INT(10), neighbor_length: INT(10),
      subvideo_length: INT(80), raft_iter: INT(20), fp16: COMBO(['enable', 'disable'], 'enable'),
    },
    output: ['IMAGE', 'MASK', 'MASK'], outputName: ['IMAGE', 'FLOW_MASK', 'MASK_DILATE'],
  },
];

/** One input as the unit tests of the lessons write it: name, data type, and the value a fresh node starts with. */
export type LessonSpec = { inputs: Array<[string, string, unknown?]>; outputs: Array<[string, string]> };

const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN']);

function lessonInput(name: string, spec: InputSpec): [string, string, unknown?] {
  const [type, options] = spec;
  if (Array.isArray(type)) return [name, 'COMBO', options?.default ?? type[0]];
  if (WIDGET_TYPES.has(type)) return [name, type, options?.default ?? (type === 'STRING' ? '' : type === 'BOOLEAN' ? false : 0)];
  return [name, type];
}

/** The same classes in the form of tests/unit/lessons.test.ts. */
export function videoSetSpecs(): Record<string, LessonSpec> {
  return Object.fromEntries(VIDEO_SET_CLASSES.map((def) => {
    const inputs = [...Object.entries(def.required ?? {}), ...Object.entries(def.optional ?? {})].map(([name, spec]) => lessonInput(name, spec));
    const names = def.outputName ?? def.output;
    return [def.classType, { inputs, outputs: def.output.map((type, index): [string, string] => [names[index] ?? type, type]) }];
  }));
}
