/**
 * The node classes of the lessons on sound, speech, 3D, faces and characters, as /object_info describes them.
 * Inputs, defaults and outputs are copied from the sources: ComfyUI 0.45 (comfy_extras/nodes_ace.py, nodes_audio.py,
 * nodes_hunyuan3d.py, nodes_save_3d.py, nodes_model_advanced.py, nodes_video_model.py, nodes_flux.py,
 * nodes_edit_model.py, nodes_preview_any.py, nodes.py) and the packs' own code (ComfyUI-MMAudio nodes.py,
 * ComfyUI-VideoHelperSuite videohelpersuite/, ComfyUI_Fill-ChatterBox as the ComfyUI registry lists it,
 * ComfyUI-Whisper apply_whisper.py and save_srt.py, ComfyUI-ReActor nodes.py, ComfyUI_IPAdapter_plus IPAdapterPlus.py and
 * the ComfyUI registry, ComfyUI-Impact-Pack modules/impact/impact_pack.py, ComfyUI-Impact-Subpack as the registry lists it).
 *
 * The fake server serves them with its video classes; the lesson tests read them through `lessonSpecs`. Classes the
 * picture-model and video fixtures already serve (DualCLIPLoader, FluxGuidance, ConditioningZeroOut,
 * ModelSamplingAuraFlow, the Video Helper Suite loader and combiner, FaceDetailer, SAMLoader, UltralyticsDetectorProvider
 * and the IP-Adapter and Impact packs) are not repeated here.
 */

type Spec = [string, Record<string, unknown>?] | [string[], Record<string, unknown>?];

/** One class in the fake server's shape, except that `pack` is a pack name; fakeMcpServer.ts turns it into an index. */
export interface DomainClassDef {
  classType: string;
  /** The name of the pack, as in SOUND_3D_FACES_PACKS or 'comfy-core'. */
  pack: string;
  display: string;
  category: string;
  required?: Record<string, Spec>;
  optional?: Record<string, Spec>;
  output: string[];
  outputName?: string[];
  outputNode?: boolean;
}

/** The packs these classes come from that the fake server does not list yet; it appends them to its PACKS. */
export const SOUND_3D_FACES_PACKS = [
  { name: 'ComfyUI-MMAudio', module: 'custom_nodes.ComfyUI-MMAudio', version: '1.0.3', commit: null },
  { name: 'ComfyUI_Fill-ChatterBox', module: 'custom_nodes.ComfyUI_Fill-ChatterBox', version: '1.0.4', commit: null },
  { name: 'ComfyUI-Whisper', module: 'custom_nodes.ComfyUI-Whisper', version: null, commit: null },
  { name: 'ComfyUI-ReActor', module: 'custom_nodes.ComfyUI-ReActor', version: '0.7.2', commit: null },
];

const MMAUDIO_FILES = ['apple_DFN5B-CLIP-ViT-H-14-384_fp16.safetensors', 'mmaudio_large_44k_v2_fp16.safetensors', 'mmaudio_synchformer_fp16.safetensors', 'mmaudio_vae_44k_fp16.safetensors'];
const WHISPER_MODELS = ['tiny.en', 'tiny', 'base.en', 'base', 'small.en', 'small', 'medium.en', 'medium', 'large-v1', 'large-v2', 'large-v3', 'large', 'large-v3-turbo', 'turbo'];
const CORE = 'comfy-core';

/** The sound, speech, 3D, faces and characters classes. */
export const SOUND_3D_FACES_CLASSES: DomainClassDef[] = [
  // ComfyUI itself: sound.
  {
    classType: 'TextEncodeAceStepAudio1.5', pack: CORE, display: 'TextEncodeAceStepAudio1.5', category: 'model/conditioning/ace',
    required: {
      clip: ['CLIP'], tags: ['STRING', { multiline: true }], lyrics: ['STRING', { multiline: true }], seed: ['INT', { default: 0, min: 0 }],
      bpm: ['INT', { default: 120, min: 10, max: 300 }], duration: ['FLOAT', { default: 120, min: 0, max: 2000, step: 0.1 }],
      timesignature: [['2', '3', '4', '6']], language: [['en', 'ru', 'unknown'], { default: 'en' }], keyscale: [['C major', 'E minor']],
      generate_audio_codes: ['BOOLEAN', { default: true }], cfg_scale: ['FLOAT', { default: 2 }], temperature: ['FLOAT', { default: 0.85 }],
      top_p: ['FLOAT', { default: 0.9 }], top_k: ['INT', { default: 0 }], min_p: ['FLOAT', { default: 0 }],
    },
    output: ['CONDITIONING'],
  },
  { classType: 'EmptyAceStep1.5LatentAudio', pack: CORE, display: 'Empty Ace Step 1.5 Latent Audio', category: 'model/latent/ace', required: { seconds: ['FLOAT', { default: 120, min: 1, max: 1000, step: 0.01 }], batch_size: ['INT', { default: 1, min: 1 }] }, output: ['LATENT'] },
  { classType: 'VAEDecodeAudio', pack: CORE, display: 'VAE Decode Audio', category: 'latent/audio', required: { samples: ['LATENT'], vae: ['VAE'] }, output: ['AUDIO'] },
  { classType: 'EmptyLatentAudio', pack: CORE, display: 'Empty Latent Audio', category: 'latent/audio', required: { seconds: ['FLOAT', { default: 47.6, min: 1, max: 1000, step: 0.1 }], batch_size: ['INT', { default: 1, min: 1 }] }, output: ['LATENT'] },
  { classType: 'SaveAudioAdvanced', pack: CORE, display: 'Save Audio (Advanced)', category: 'audio', required: { audio: ['AUDIO'], filename_prefix: ['STRING', { default: 'audio/ComfyUI' }], format: [['flac', 'mp3', 'opus']] }, output: ['AUDIO'], outputName: ['audio'], outputNode: true },
  { classType: 'PreviewAny', pack: CORE, display: 'Preview as Text', category: 'utilities', required: { source: ['*'] }, output: ['STRING'], outputNode: true },
  // ComfyUI itself: 3D from a picture.
  { classType: 'ImageOnlyCheckpointLoader', pack: CORE, display: 'Image Only Checkpoint Loader (img2vid model)', category: 'model/loaders', required: { ckpt_name: [['hunyuan3d-dit-v2_fp16.safetensors', 'hunyuan_3d_v2.1.safetensors']] }, output: ['MODEL', 'CLIP_VISION', 'VAE'] },
  { classType: 'CLIPVisionEncode', pack: CORE, display: 'CLIP Vision Encode', category: 'conditioning', required: { clip_vision: ['CLIP_VISION'], image: ['IMAGE'], crop: [['center', 'none']] }, output: ['CLIP_VISION_OUTPUT'] },
  { classType: 'Hunyuan3Dv2Conditioning', pack: CORE, display: 'Hunyuan3Dv2Conditioning', category: 'conditioning/video_models', required: { clip_vision_output: ['CLIP_VISION_OUTPUT'] }, output: ['CONDITIONING', 'CONDITIONING'], outputName: ['positive', 'negative'] },
  { classType: 'EmptyLatentHunyuan3Dv2', pack: CORE, display: 'Empty Hunyuan 3D v2 Latent', category: 'latent/3d', required: { resolution: ['INT', { default: 3072, min: 1, max: 8192 }], batch_size: ['INT', { default: 1, min: 1 }] }, output: ['LATENT'] },
  { classType: 'VAEDecodeHunyuan3D', pack: CORE, display: 'Hunyuan 3D VAE Decode', category: 'latent/3d', required: { samples: ['LATENT'], vae: ['VAE'], num_chunks: ['INT', { default: 8000, min: 1000, max: 500000 }], octree_resolution: ['INT', { default: 256, min: 16, max: 512 }] }, output: ['VOXEL'] },
  { classType: 'VoxelToMesh', pack: CORE, display: 'Voxel to Mesh', category: '3d', required: { voxel: ['VOXEL'], algorithm: [['surface net', 'basic']], threshold: ['FLOAT', { default: 0.6, min: -1, max: 1, step: 0.01 }] }, output: ['MESH'] },
  { classType: 'SaveGLB', pack: CORE, display: 'Save 3D Model', category: '3d', required: { mesh: ['MESH'], filename_prefix: ['STRING', { default: '3d/ComfyUI' }] }, output: [], outputNode: true },
  // ComfyUI itself: FLUX.1 Kontext.
  { classType: 'FluxKontextImageScale', pack: CORE, display: 'FluxKontextImageScale', category: 'advanced/conditioning/flux', required: { image: ['IMAGE'] }, output: ['IMAGE'] },
  { classType: 'ReferenceLatent', pack: CORE, display: 'ReferenceLatent', category: 'advanced/conditioning/edit_models', required: { conditioning: ['CONDITIONING'] }, optional: { latent: ['LATENT'] }, output: ['CONDITIONING'] },
  // ComfyUI-MMAudio.
  { classType: 'MMAudioModelLoader', pack: 'ComfyUI-MMAudio', display: 'MMAudio ModelLoader', category: 'MMAudio', required: { mmaudio_model: [MMAUDIO_FILES], base_precision: [['fp16', 'fp32', 'bf16'], { default: 'fp16' }] }, output: ['MMAUDIO_MODEL'], outputName: ['mmaudio_model'] },
  {
    classType: 'MMAudioFeatureUtilsLoader', pack: 'ComfyUI-MMAudio', display: 'MMAudio FeatureUtilsLoader', category: 'MMAudio',
    required: { vae_model: [MMAUDIO_FILES], synchformer_model: [MMAUDIO_FILES], clip_model: [MMAUDIO_FILES] },
    optional: { bigvgan_vocoder_model: ['VOCODER_MODEL'], mode: [['16k', '44k'], { default: '44k' }], precision: [['fp16', 'fp32', 'bf16'], { default: 'fp16' }] },
    output: ['MMAUDIO_FEATUREUTILS'], outputName: ['mmaudio_featureutils'],
  },
  {
    classType: 'MMAudioSampler', pack: 'ComfyUI-MMAudio', display: 'MMAudio Sampler', category: 'MMAudio',
    required: {
      mmaudio_model: ['MMAUDIO_MODEL'], feature_utils: ['MMAUDIO_FEATUREUTILS'], duration: ['FLOAT', { default: 8, step: 0.01 }], steps: ['INT', { default: 25 }],
      cfg: ['FLOAT', { default: 4.5, step: 0.1 }], seed: ['INT', { default: 0 }], prompt: ['STRING', { default: '', multiline: true }],
      negative_prompt: ['STRING', { default: '', multiline: true }], mask_away_clip: ['BOOLEAN', { default: false }], force_offload: ['BOOLEAN', { default: true }],
    },
    optional: { images: ['IMAGE'] },
    output: ['AUDIO'], outputName: ['audio'],
  },
  // ComfyUI_Fill-ChatterBox.
  {
    classType: 'FL_ChatterboxTTS', pack: 'ComfyUI_Fill-ChatterBox', display: 'FL Chatterbox TTS', category: 'ChatterBox',
    required: { text: ['STRING', { default: 'Hello, this is a test.', multiline: true }], exaggeration: ['FLOAT', { default: 0.5 }], cfg_weight: ['FLOAT', { default: 0.5 }], temperature: ['FLOAT', { default: 0.8 }], seed: ['INT', { default: 0 }] },
    optional: { audio_prompt: ['AUDIO'], use_cpu: ['BOOLEAN', { default: false }], keep_model_loaded: ['BOOLEAN', { default: false }] },
    output: ['AUDIO', 'STRING'], outputName: ['audio', 'message'],
  },
  // ComfyUI-Whisper.
  {
    classType: 'Apply Whisper', pack: 'ComfyUI-Whisper', display: 'Apply Whisper', category: 'whisper',
    required: { audio: ['AUDIO'], model: [WHISPER_MODELS] }, optional: { language: [['auto', 'English', 'Russian']], prompt: ['STRING', { default: '' }] },
    output: ['STRING', 'whisper_alignment', 'whisper_alignment'], outputName: ['text', 'segments_alignment', 'words_alignment'],
  },
  { classType: 'Save SRT', pack: 'ComfyUI-Whisper', display: 'Save SRT', category: 'whisper', required: { alignment: ['whisper_alignment'], name: ['STRING', { default: 'subtitles' }] }, output: ['STRING'], outputName: ['srt_path'] },
  // ComfyUI-ReActor.
  {
    classType: 'ReActorRestoreFace', pack: 'ComfyUI-ReActor', display: 'Restore Face 🌌 ReActor', category: '🌌 ReActor/PostProcessing',
    required: {
      image: ['IMAGE'], facedetection: [['retinaface_resnet50', 'retinaface_mobile0.25', 'YOLOv5l', 'YOLOv5n']],
      model: [['none', 'codeformer-v0.1.0.pth', 'GFPGANv1.4.pth', 'GPEN-BFR-512.onnx']],
      visibility: ['FLOAT', { default: 1, min: 0, max: 1, step: 0.05 }], codeformer_weight: ['FLOAT', { default: 0.5, min: 0, max: 1, step: 0.05 }],
    },
    output: ['IMAGE'],
  },
  {
    classType: 'ReActorFaceSwap', pack: 'ComfyUI-ReActor', display: 'ReActor 🌌 Fast Face Swap', category: '🌌 ReActor',
    required: {
      enabled: ['BOOLEAN', { default: true }], input_image: ['IMAGE'], swap_model: [['inswapper_128.onnx']],
      facedetection: [['retinaface_resnet50', 'retinaface_mobile0.25', 'YOLOv5l', 'YOLOv5n']],
      face_restore_model: [['none', 'codeformer-v0.1.0.pth', 'GFPGANv1.4.pth', 'GPEN-BFR-512.onnx']],
      face_restore_visibility: ['FLOAT', { default: 1, min: 0.1, max: 1, step: 0.05 }], codeformer_weight: ['FLOAT', { default: 0.5, min: 0, max: 1, step: 0.05 }],
      detect_gender_input: [['no', 'female', 'male'], { default: 'no' }], detect_gender_source: [['no', 'female', 'male'], { default: 'no' }],
      input_faces_index: ['STRING', { default: '0' }], source_faces_index: ['STRING', { default: '0' }], console_log_level: [['0', '1', '2'], { default: '1' }],
    },
    optional: { source_image: ['IMAGE'], face_model: ['FACE_MODEL'], face_boost: ['FACE_BOOST'] },
    output: ['IMAGE', 'FACE_MODEL', 'IMAGE'], outputName: ['SWAPPED_IMAGE', 'FACE_MODEL', 'ORIGINAL_IMAGE'],
  },
  // ComfyUI_IPAdapter_plus, the FaceID part (IPAdapterPlus.py).
  {
    classType: 'IPAdapterUnifiedLoaderFaceID', pack: 'ComfyUI_IPAdapter_plus', display: 'IPAdapter Unified Loader FaceID', category: 'ipadapter/faceid',
    required: {
      model: ['MODEL'], preset: [['FACEID', 'FACEID PLUS - SD1.5 only', 'FACEID PLUS V2', 'FACEID PORTRAIT (style transfer)', 'FACEID PORTRAIT UNNORM - SDXL only (strong)']],
      lora_strength: ['FLOAT', { default: 0.6, min: 0, max: 1, step: 0.01 }], provider: [['CPU', 'CUDA', 'ROCM', 'DirectML', 'OpenVINO', 'CoreML']],
    },
    optional: { ipadapter: ['IPADAPTER'] },
    output: ['MODEL', 'IPADAPTER'], outputName: ['MODEL', 'ipadapter'],
  },
  {
    classType: 'IPAdapterFaceID', pack: 'ComfyUI_IPAdapter_plus', display: 'IPAdapter FaceID', category: 'ipadapter/faceid',
    required: {
      model: ['MODEL'], ipadapter: ['IPADAPTER'], image: ['IMAGE'], weight: ['FLOAT', { default: 1 }], weight_faceidv2: ['FLOAT', { default: 1 }],
      weight_type: [['linear', 'ease in', 'ease out', 'ease in-out', 'reverse in-out', 'weak input']], combine_embeds: [['concat', 'add', 'subtract', 'average', 'norm average']],
      start_at: ['FLOAT', { default: 0 }], end_at: ['FLOAT', { default: 1 }], embeds_scaling: [['V only', 'K+V', 'K+V w/ C penalty', 'K+mean(V) w/ C penalty']],
    },
    optional: { image_negative: ['IMAGE'], attn_mask: ['MASK'], clip_vision: ['CLIP_VISION'], insightface: ['INSIGHTFACE'] },
    output: ['MODEL', 'IMAGE'], outputName: ['MODEL', 'face_image'],
  },
];

const PRIMITIVE = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN']);

/**
 * The same classes in the form the lesson tests use: inputs with the value a fresh node starts with (link inputs
 * have none), and outputs by name and type.
 */
export function lessonSpecs(): Record<string, { inputs: Array<[string, string, unknown?]>; outputs: Array<[string, string]> }> {
  const out: Record<string, { inputs: Array<[string, string, unknown?]>; outputs: Array<[string, string]> }> = {};
  for (const def of SOUND_3D_FACES_CLASSES) {
    const inputs: Array<[string, string, unknown?]> = [];
    for (const [name, spec] of Object.entries({ ...def.required, ...def.optional })) {
      const [type, options] = spec;
      if (Array.isArray(type)) inputs.push([name, 'COMBO', options?.default ?? type[0]]);
      else if (PRIMITIVE.has(type)) inputs.push([name, type, options?.default ?? (type === 'STRING' ? '' : type === 'BOOLEAN' ? false : 0)]);
      else inputs.push([name, type]);
    }
    const names = def.outputName ?? def.output;
    out[def.classType] = { inputs, outputs: def.output.map((type, index) => [names[index] ?? type, type]) };
  }
  return out;
}
