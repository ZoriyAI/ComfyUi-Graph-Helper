/**
 * Built-in knowledge of the "foundations" domain: what a newcomer needs before and around every other lesson, and
 * the general-purpose tools of ComfyUI. Written by hand in English and Russian (foundations.en.ts, .ru.ts); this
 * file holds what does not depend on the language and the lookups the screens use.
 *
 * Sources, checked for this release:
 * - ComfyUI's own source: folder_paths.py (every folder ComfyUI registers itself), nodes.py and comfy_extras (the
 *   loaders that read each folder, the fields and their defaults), comfy/samplers.py (sampler and scheduler names),
 *   comfy/cli_args.py (the memory flags), execution.py and comfy/utils.py (the error messages, word for word).
 * - docs.comfy.org (the page of each built-in node below; partner nodes, the manager, subgraphs).
 * - The official workflow templates (which fields appear again and again and with which values).
 * - The public repositories of the packs (their README and their NODE_CLASS_MAPPINGS) for the pack entries and the
 *   folders a pack creates. A folder or a pack whose details vary between packs is said with "usually".
 *
 * Nothing here names a download link: a person takes a file from the model's official page and installs a pack
 * through ComfyUI's manager.
 *
 * Who uses it: coreKnowledge.ts reads it as one of KNOWLEDGE_SETS (nodes, packs, field notes, glossary); the error
 * dialog and the term texts of the journey (renderer/components/journey, shared/journey/comfyError.ts and terms.ts)
 * use comfyErrorNotes and glossary. folderNote, topicNote and foundationsPackId are only called by the tests today.
 */
import type { CoreTexts, KnowledgeLanguage, KnowledgeSet, KnowledgeSetDocs } from '../coreKnowledge';
import { FOUNDATIONS_EN } from './foundations.en';
import { FOUNDATIONS_RU } from './foundations.ru';

/** General-purpose nodes of ComfyUI itself. Each has a page on docs.comfy.org. */
export const FOUNDATIONS_NODE_CLASSES = [
  'VAEEncodeTiled', 'PreviewAny', 'PrimitiveInt', 'PrimitiveFloat', 'PrimitiveString', 'PrimitiveStringMultiline',
  'PrimitiveBoolean', 'ComfySwitchNode', 'TextGenerateV2', 'TextGenerate', 'StringConcatenate', 'GetImageSize', 'ComfyMathExpression',
] as const;
/** One class of FOUNDATIONS_NODE_CLASSES. */
export type FoundationsNodeClass = typeof FOUNDATIONS_NODE_CLASSES[number];

/** The docs page of each of those classes; the docs name every one of them as ComfyUI does. */
export const FOUNDATIONS_NODE_DOCS: Record<FoundationsNodeClass, string> = Object.fromEntries(
  FOUNDATIONS_NODE_CLASSES.map((classType) => [classType, `https://docs.comfy.org/built-in-nodes/${classType}`]),
) as Record<FoundationsNodeClass, string>;

/**
 * Every folder under ComfyUI/models a well-filled installation has. `core`: ComfyUI registers it itself
 * (folder_paths.py); otherwise a node pack creates and reads it. `sameAs`: ComfyUI reads the two folders as one list
 * (clip with text_encoders, unet with diffusion_models, t2i_adapter with controlnet). `readers`: the node classes of
 * ComfyUI that list the folder's files, for a core folder.
 */
export interface ModelFolderFacts {
  id: string;
  core: boolean;
  sameAs?: string;
  readers: readonly string[];
}

/** The folders and their facts (see ModelFolderFacts). */
export const MODEL_FOLDERS = [
  { id: 'checkpoints', core: true, readers: ['CheckpointLoaderSimple', 'CheckpointLoader', 'unCLIPCheckpointLoader', 'ImageOnlyCheckpointLoader'] },
  { id: 'diffusion_models', core: true, readers: ['UNETLoader'] },
  { id: 'unet', core: true, sameAs: 'diffusion_models', readers: ['UNETLoader'] },
  { id: 'loras', core: true, readers: ['LoraLoader', 'LoraLoaderModelOnly'] },
  { id: 'vae', core: true, readers: ['VAELoader'] },
  { id: 'vae_approx', core: true, readers: ['VAELoader'] },
  { id: 'text_encoders', core: true, readers: ['CLIPLoader', 'DualCLIPLoader', 'TripleCLIPLoader', 'QuadrupleCLIPLoader'] },
  { id: 'clip', core: true, sameAs: 'text_encoders', readers: ['CLIPLoader', 'DualCLIPLoader'] },
  { id: 'clip_vision', core: true, readers: ['CLIPVisionLoader'] },
  { id: 'controlnet', core: true, readers: ['ControlNetLoader', 'DiffControlNetLoader'] },
  { id: 't2i_adapter', core: true, sameAs: 'controlnet', readers: ['ControlNetLoader'] },
  { id: 'ipadapter', core: false, readers: [] },
  { id: 'style_models', core: true, readers: ['StyleModelLoader'] },
  { id: 'upscale_models', core: true, readers: ['UpscaleModelLoader'] },
  { id: 'latent_upscale_models', core: true, readers: ['LatentUpscaleModelLoader'] },
  { id: 'embeddings', core: true, readers: ['CLIPTextEncode', 'ConditioningLoader'] },
  { id: 'hypernetworks', core: true, readers: ['HypernetworkLoader'] },
  { id: 'gligen', core: true, readers: ['GLIGENLoader'] },
  { id: 'photomaker', core: true, readers: ['PhotoMakerLoader'] },
  { id: 'insightface', core: false, readers: [] },
  { id: 'facerestore_models', core: false, readers: [] },
  { id: 'facedetection', core: false, readers: [] },
  { id: 'facexlib', core: false, readers: [] },
  { id: 'sam2', core: false, readers: [] },
  { id: 'sams', core: false, readers: [] },
  { id: 'ultralytics', core: false, readers: [] },
  { id: 'yolo', core: false, readers: [] },
  { id: 'detection', core: true, readers: ['LoadMediaPipeFaceLandmarker', 'SAM3DBody_Loader'] },
  { id: 'rembg', core: false, readers: [] },
  { id: 'background_removal', core: true, readers: ['LoadBackgroundRemovalModel'] },
  { id: 'frame_interpolation', core: true, readers: ['FrameInterpolationModelLoader'] },
  { id: 'optical_flow', core: true, readers: ['OpticalFlowLoader'] },
  { id: 'cotracker', core: false, readers: [] },
  { id: 'propainter', core: false, readers: [] },
  { id: 'SEEDVR2', core: false, readers: [] },
  { id: 'audio_encoders', core: true, readers: ['AudioEncoderLoader'] },
  { id: 'mmaudio', core: false, readers: [] },
  { id: 'hunyuan_foley', core: false, readers: [] },
  { id: 'demucs', core: false, readers: [] },
  { id: 'qwen-tts', core: false, readers: [] },
  { id: 'stt', core: false, readers: [] },
  { id: 'LLM', core: false, readers: [] },
  { id: 'wd14', core: false, readers: [] },
  { id: 'classifiers', core: true, readers: [] },
  { id: 'geometry_estimation', core: true, readers: ['LoadMoGeModel', 'LoadDA3Model'] },
  { id: 'unirig', core: false, readers: [] },
  { id: 'luts', core: false, readers: [] },
  { id: 'model_patches', core: true, readers: ['ModelPatchLoader'] },
  { id: 'diffusers', core: true, readers: ['DiffusersLoader'] },
  { id: 'configs', core: true, readers: ['CheckpointLoader'] },
] as const satisfies readonly ModelFolderFacts[];
/** The id (folder name) of one of MODEL_FOLDERS. */
export type ModelFolderId = typeof MODEL_FOLDERS[number]['id'];

/** What a folder holds, which nodes read it, how large its files are, what goes wrong when a file lies elsewhere. */
export interface FolderTexts {
  what: string;
  readers: string;
  size: string;
  wrong: string;
}

/**
 * The fields a newcomer meets everywhere, and the ones the official templates use most (counted over the template
 * folder), that the picture-models and video sets do not explain already (their notes win for the fields they have:
 * seed, steps, cfg, sampler_name, scheduler, denoise of KSampler, shift, length, fps, the loader files, the tiled
 * decode and others). A key is a field name, or `Class.field` where one name means different things on different
 * nodes. FIELD_CLASSES says on which nodes each text is shown.
 */
export const FIELD_KEYS = [
  'control_after_generate', 'noise_seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise', 'width', 'height', 'batch_size',
  'strength_model', 'strength_clip', 'clip_name', 'lora_name', 'model_name', 'control_net_name', 'CLIPLoader.device', 'add_noise',
  'start_at_step', 'end_at_step', 'return_with_leftover_noise', 'filename_prefix', 'LoadImage.image', 'LoadVideo.file', 'LoadAudio.audio',
  'upscale_method', 'crop', 'megapixels', 'scale_by', 'max_shift', 'base_shift', 'ControlNetApplyAdvanced.strength', 'start_percent',
  'end_percent', 'grow_mask_by', 'value', 'PrimitiveBoolean.value', 'switch', 'on_false', 'on_true', 'prompt', 'system_prompt',
  'max_length', 'thinking', 'string_a', 'string_b', 'delimiter', 'expression',
] as const;
/** One key of FIELD_KEYS. */
export type FieldKey = typeof FIELD_KEYS[number];

/** The node classes each field text belongs to (ComfyUI's own classes, as nodes.py and comfy_extras name the fields). */
export const FIELD_CLASSES: Record<FieldKey, readonly string[]> = {
  control_after_generate: ['KSampler', 'KSamplerAdvanced', 'RandomNoise', 'PrimitiveInt'],
  noise_seed: ['SamplerCustom'],
  steps: ['KSamplerAdvanced', 'BasicScheduler'],
  cfg: ['KSamplerAdvanced', 'SamplerCustom'],
  sampler_name: ['KSamplerAdvanced'],
  scheduler: ['KSamplerAdvanced', 'BasicScheduler'],
  denoise: ['BasicScheduler'],
  width: ['EmptyHunyuanLatentVideo', 'WanImageToVideo', 'EmptyLTXVLatentVideo', 'ImageScale', 'LatentUpscale'],
  height: ['EmptyHunyuanLatentVideo', 'WanImageToVideo', 'EmptyLTXVLatentVideo', 'ImageScale', 'LatentUpscale'],
  batch_size: ['EmptySD3LatentImage', 'EmptyHunyuanLatentVideo', 'WanImageToVideo', 'EmptyLTXVLatentVideo'],
  strength_model: ['LoraLoader', 'LoraLoaderModelOnly'],
  strength_clip: ['LoraLoader'],
  clip_name: ['CLIPVisionLoader'],
  lora_name: ['LoraLoader', 'LoraLoaderModelOnly'],
  model_name: ['UpscaleModelLoader', 'LatentUpscaleModelLoader', 'FrameInterpolationModelLoader', 'LoadMoGeModel', 'LoadDA3Model'],
  control_net_name: ['ControlNetLoader', 'DiffControlNetLoader'],
  'CLIPLoader.device': ['CLIPLoader'],
  add_noise: ['KSamplerAdvanced'],
  start_at_step: ['KSamplerAdvanced'],
  end_at_step: ['KSamplerAdvanced'],
  return_with_leftover_noise: ['KSamplerAdvanced'],
  filename_prefix: ['SaveImage', 'SaveAudio'],
  'LoadImage.image': ['LoadImage'],
  'LoadVideo.file': ['LoadVideo'],
  'LoadAudio.audio': ['LoadAudio'],
  upscale_method: ['ImageScale', 'ImageScaleBy', 'LatentUpscale', 'LatentUpscaleBy', 'ImageScaleToTotalPixels'],
  crop: ['ImageScale', 'LatentUpscale'],
  megapixels: ['ImageScaleToTotalPixels'],
  scale_by: ['ImageScaleBy', 'LatentUpscaleBy'],
  max_shift: ['ModelSamplingFlux'],
  base_shift: ['ModelSamplingFlux'],
  'ControlNetApplyAdvanced.strength': ['ControlNetApplyAdvanced'],
  start_percent: ['ControlNetApplyAdvanced'],
  end_percent: ['ControlNetApplyAdvanced'],
  grow_mask_by: ['VAEEncodeForInpaint'],
  value: ['PrimitiveInt', 'PrimitiveFloat', 'PrimitiveString', 'PrimitiveStringMultiline'],
  'PrimitiveBoolean.value': ['PrimitiveBoolean'],
  switch: ['ComfySwitchNode'],
  on_false: ['ComfySwitchNode'],
  on_true: ['ComfySwitchNode'],
  prompt: ['TextGenerateV2', 'TextGenerate'],
  system_prompt: ['TextGenerateV2', 'TextGenerate'],
  max_length: ['TextGenerateV2', 'TextGenerate'],
  thinking: ['TextGenerateV2', 'TextGenerate'],
  string_a: ['StringConcatenate'],
  string_b: ['StringConcatenate'],
  delimiter: ['StringConcatenate'],
  expression: ['ComfyMathExpression'],
};

/** What a field does and what to put in it. */
export interface FieldTexts {
  what: string;
  set: string;
}

/** Longer explanations: a topic a step, a card or the help can point to. */
export const TOPIC_IDS = [
  'comfy-graph', 'queue', 'results', 'model-folders', 'node-packs', 'pack-safety', 'run-in-comfyui', 'vram', 'vram-formats',
  'vram-offload', 'vram-blockswap', 'vram-tiling', 'vram-size', 'vram-order', 'text-encoders', 'read-workflow', 'groups', 'notes',
  'reroutes', 'primitives', 'set-get', 'bypass-mute', 'subgraphs', 'partner-nodes', 'llm-in-graph',
] as const;
/** One id of TOPIC_IDS. */
export type TopicId = typeof TOPIC_IDS[number];

/** A topic in one language: its title and its body. */
export interface TopicTexts {
  title: string;
  /** Paragraphs separated by an empty line; a list with "- ". */
  body: string;
}

/**
 * The messages ComfyUI shows when a run fails, as execution.py and comfy/utils.py word them (and the two most common
 * messages of PyTorch underneath). Patterns are case-insensitive and match a piece of the message a person pastes.
 */
export const COMFY_ERRORS = [
  { id: 'native-resource-wait', pattern: /NATIVE_RESOURCE_AUTHORITY_WAIT/ },
  { id: 'vram-capacity-wait', pattern: /VRAM_CAPACITY_WAIT/ },
  { id: 'ram-capacity-wait', pattern: /RAM_CAPACITY_WAIT/ },
  { id: 'gpu-lease-busy', pattern: /GPU_LEASE_BUSY/ },
  { id: 'foreign-gpu-busy', pattern: /FOREIGN_GPU_COMPUTE_BUSY/ },
  { id: 'endpoint-refused', pattern: /ECONNREFUSED|Connection refused|Errno 111/i },
  { id: 'mcp-child-lost', pattern: /MCP[^\n]*Not connected|Not connected[^\n]*MCP|^Not connected\s*$/im },
  { id: 'oom', pattern: /out of memory|OutOfMemoryError|Allocation on device|Got an OOM/i },
  { id: 'validation-failed', pattern: /Prompt outputs failed validation/i },
  { id: 'value-not-in-list', pattern: /Value not in list/i },
  { id: 'required-input-missing', pattern: /Required input is missing/i },
  { id: 'return-type-mismatch', pattern: /Return type mismatch between linked nodes/i },
  { id: 'node-not-found', pattern: /not found\. The custom node may not be installed|has no class_type/i },
  { id: 'no-outputs', pattern: /Prompt has no outputs/i },
  { id: 'value-out-of-range', pattern: /Value \S+ (?:smaller than min|bigger than max) of/i },
  { id: 'detect-model-type', pattern: /Could not detect model type/i },
  { id: 'safetensors-corrupt', pattern: /HeaderTooLarge|safetensors file is corrupt or invalid/i },
  { id: 'safetensors-incomplete', pattern: /MetadataIncompleteBuffer|safetensors file is corrupt\/incomplete|header is incomplete/i },
  { id: 'mat-shapes', pattern: /mat1 and mat2 shapes cannot be multiplied/i },
  { id: 'size-mismatch', pattern: /size mismatch for|Error\(s\) in loading state_dict/i },
  { id: 'tensors-device', pattern: /Expected all tensors to be on the same device/i },
  { id: 'dependency-cycle', pattern: /Dependency cycle detected/i },
  { id: 'lora-keys', pattern: /lora key not loaded/i },
] as const satisfies ReadonlyArray<{ id: string; pattern: RegExp }>;
/** One id of COMFY_ERRORS. */
export type ComfyErrorId = typeof COMFY_ERRORS[number]['id'];

/** What a known error means and what to change. */
export interface ErrorTexts {
  title: string;
  meaning: string;
  fix: string;
}

/**
 * General-purpose node packs, by the name of their repository (the name the manager and the catalog show). `match`
 * also finds the pack by the folder name under custom_nodes, which may differ in letter case or a prefix.
 * ComfyUI-KJNodes and ComfyUI-GGUF are explained by the video and picture-models sets.
 */
export const FOUNDATIONS_PACKS = [
  { id: 'rgthree-comfy', match: /^rgthree[-_]?comfy$/i },
  { id: 'ComfyUI-Easy-Use', match: /^comfyui[-_]easy[-_]use$/i },
  { id: 'comfyui_essentials', match: /^comfyui[-_]essentials$/i },
  { id: 'ComfyUI-Custom-Scripts', match: /^comfyui[-_]custom[-_]scripts$/i },
  { id: 'ComfyUI-Crystools', match: /^comfyui[-_]crystools$/i },
  { id: 'cg-use-everywhere', match: /^cg[-_]use[-_]everywhere$/i },
  { id: 'ComfyUI-MultiGPU', match: /^comfyui[-_]multigpu$/i },
  { id: 'comfyui-ollama', match: /^comfyui[-_]ollama$/i },
  { id: 'comfyui_LLM_party', match: /^comfyui[-_]llm[-_]party$/i },
  { id: 'ComfyUI-QwenVL', match: /^comfyui[-_]qwenvl$/i },
  { id: 'ComfyUI-Manager', match: /^comfyui[-_]manager$/i },
  { id: 'partner-nodes', match: /^comfy[-_]api[-_]nodes$|^partner[-_]nodes$/i },
] as const;
/** One id of FOUNDATIONS_PACKS. */
export type FoundationsPackId = typeof FOUNDATIONS_PACKS[number]['id'];

/** What a pack is for, its key nodes (by the names the library shows), and what to watch for. */
export interface PackTexts {
  what: string;
  nodes: string;
  note: string;
}

/**
 * The glossary: every term a newcomer meets in the app, the lessons and the documentation. `community` is the word
 * the ComfyUI community uses in English, the one to search for.
 */
export const GLOSSARY_TERMS = [
  { id: 'comfyui', community: 'ComfyUI' },
  { id: 'node', community: 'node' },
  { id: 'link', community: 'link (wire, noodle)' },
  { id: 'canvas', community: 'canvas' },
  { id: 'graph', community: 'graph' },
  { id: 'workflow', community: 'workflow' },
  { id: 'input', community: 'input (socket, slot)' },
  { id: 'output', community: 'output' },
  { id: 'field', community: 'widget (field)' },
  { id: 'data-type', community: 'data type' },
  { id: 'queue', community: 'queue' },
  { id: 'run', community: 'Run (Queue Prompt)' },
  { id: 'output-node', community: 'output node' },
  { id: 'output-folder', community: 'output folder' },
  { id: 'input-folder', community: 'input folder' },
  { id: 'template', community: 'workflow template' },
  { id: 'node-pack', community: 'custom nodes (node pack)' },
  { id: 'manager', community: 'ComfyUI Manager' },
  { id: 'model', community: 'model' },
  { id: 'models-folder', community: 'models folder' },
  { id: 'checkpoint', community: 'checkpoint' },
  { id: 'diffusion-model', community: 'diffusion model (UNet)' },
  { id: 'text-encoder', community: 'text encoder' },
  { id: 'clip', community: 'CLIP' },
  { id: 't5', community: 'T5' },
  { id: 'vae', community: 'VAE' },
  { id: 'latent', community: 'latent' },
  { id: 'empty-latent', community: 'empty latent' },
  { id: 'sampler', community: 'sampler (KSampler)' },
  { id: 'sampler-name', community: 'sampler (sampler_name)' },
  { id: 'scheduler', community: 'scheduler' },
  { id: 'steps', community: 'steps' },
  { id: 'cfg', community: 'CFG' },
  { id: 'seed', community: 'seed' },
  { id: 'denoise', community: 'denoise' },
  { id: 'conditioning', community: 'conditioning' },
  { id: 'prompt', community: 'prompt' },
  { id: 'negative-prompt', community: 'negative prompt' },
  { id: 'prompt-weight', community: 'prompt weighting' },
  { id: 'lora', community: 'LoRA' },
  { id: 'trigger-word', community: 'trigger word' },
  { id: 'embedding', community: 'embedding (textual inversion)' },
  { id: 'controlnet', community: 'ControlNet' },
  { id: 'ip-adapter', community: 'IP-Adapter' },
  { id: 'clip-vision', community: 'CLIP Vision' },
  { id: 'upscale', community: 'upscale' },
  { id: 'upscale-model', community: 'upscale model' },
  { id: 'hires-fix', community: 'hires fix' },
  { id: 'txt2img', community: 'text to image (t2i)' },
  { id: 'img2img', community: 'image to image (i2i)' },
  { id: 'inpainting', community: 'inpainting' },
  { id: 'outpainting', community: 'outpainting' },
  { id: 'mask', community: 'mask' },
  { id: 'i2v', community: 'image to video (i2v)' },
  { id: 't2v', community: 'text to video (t2v)' },
  { id: 'frame', community: 'frame' },
  { id: 'fps', community: 'fps' },
  { id: 'shift', community: 'shift' },
  { id: 'batch', community: 'batch' },
  { id: 'family', community: 'base model (architecture)' },
  { id: 'fine-tune', community: 'fine-tune (merge)' },
  { id: 'distilled', community: 'distilled / turbo / lightning' },
  { id: 'vram', community: 'VRAM' },
  { id: 'oom', community: 'OOM (out of memory)' },
  { id: 'offload', community: 'offloading' },
  { id: 'precision', community: 'precision (fp32, fp16, bf16)' },
  { id: 'fp8', community: 'fp8' },
  { id: 'quantization', community: 'quantization' },
  { id: 'gguf', community: 'GGUF' },
  { id: 'block-swap', community: 'block swap' },
  { id: 'tiling', community: 'tiled VAE (tiling)' },
  { id: 'safetensors', community: 'safetensors' },
  { id: 'pickle', community: 'pickle (.ckpt, .pt, .pth, .bin)' },
  { id: 'group', community: 'group' },
  { id: 'note', community: 'note' },
  { id: 'reroute', community: 'reroute' },
  { id: 'primitive', community: 'primitive' },
  { id: 'set-get', community: 'Set / Get nodes' },
  { id: 'bypass', community: 'bypass' },
  { id: 'mute', community: 'mute' },
  { id: 'subgraph', community: 'subgraph' },
  { id: 'switch', community: 'switch' },
  { id: 'partner-nodes', community: 'partner nodes (API nodes)' },
  { id: 'credits', community: 'credits' },
  { id: 'llm', community: 'LLM (language model)' },
  { id: 'metadata', community: 'workflow metadata (workflow in PNG)' },
  { id: 'api-format', community: 'API format' },
  { id: 'assistant', community: 'assistant' },
  { id: 'grey-drafts', community: 'grey drafts' },
  { id: 'graph-version', community: 'graph version' },
  { id: 'mcp-server', community: 'MCP server' },
  { id: 'sync', community: 'sync' },
] as const;
/** One id of GLOSSARY_TERMS. */
export type GlossaryId = typeof GLOSSARY_TERMS[number]['id'];

/** The term as it is said in one language, and one plain sentence. */
export interface GlossaryTexts {
  term: string;
  text: string;
}

/** The whole domain in one language; foundations.en.ts and foundations.ru.ts each fill one. */
export interface FoundationsPack {
  /** Built-in nodes: what, why, connect, risk, like the core knowledge. Seeded with it (coreKnowledge.ts). */
  nodes: Record<FoundationsNodeClass, CoreTexts>;
  folders: Record<ModelFolderId, FolderTexts>;
  fields: Record<FieldKey, FieldTexts>;
  topics: Record<TopicId, TopicTexts>;
  errors: Record<ComfyErrorId, ErrorTexts>;
  packs: Record<FoundationsPackId, PackTexts>;
  glossary: Record<GlossaryId, GlossaryTexts>;
}

/** The domain by language. */
export const FOUNDATIONS: Record<KnowledgeLanguage, FoundationsPack> = { en: FOUNDATIONS_EN, ru: FOUNDATIONS_RU };

// Any interface language but Russian reads the English texts.
const languageOf = (language: string): KnowledgeLanguage => (language.toLowerCase().startsWith('ru') ? 'ru' : 'en');

/**
 * The note on a folder of the model library. `directory` is the folder as the catalog stores it ("loras",
 * "loras/style", "Clip"): the first segment decides, in any letter case.
 */
export function folderNote(directory: string, language: string): (FolderTexts & { id: ModelFolderId; core: boolean; sameAs: string | null }) | null {
  const top = directory.split(/[\\/]/)[0] ?? '';
  const facts = MODEL_FOLDERS.find((folder) => folder.id === top) ?? MODEL_FOLDERS.find((folder) => folder.id.toLowerCase() === top.toLowerCase());
  if (!facts) return null;
  const texts = FOUNDATIONS[languageOf(language)].folders[facts.id];
  return { ...texts, id: facts.id, core: facts.core, sameAs: 'sameAs' in facts ? facts.sameAs : null };
}

/** A longer explanation by its id, in the person's language. */
export function topicNote(id: TopicId, language: string): TopicTexts {
  return FOUNDATIONS[languageOf(language)].topics[id];
}

/** What each known ComfyUI message in a pasted error means and what to change, in the order they are found. */
export function comfyErrorNotes(message: string, language: string): Array<ErrorTexts & { id: ComfyErrorId }> {
  const texts = FOUNDATIONS[languageOf(language)].errors;
  return COMFY_ERRORS.filter((item) => item.pattern.test(message)).map((item) => ({ ...texts[item.id], id: item.id }));
}

/** One glossary term as the glossary lists it. */
export interface GlossaryEntry extends GlossaryTexts {
  id: GlossaryId;
  /** The English word of the community, to search for. */
  community: string;
}

/** The whole glossary in one language, sorted by the term as that language says it. */
export function glossary(language: string): GlossaryEntry[] {
  const lang = languageOf(language);
  const texts = FOUNDATIONS[lang].glossary;
  return GLOSSARY_TERMS.map((item) => ({ ...texts[item.id], id: item.id, community: item.community }))
    .sort((a, b) => a.term.localeCompare(b.term, lang));
}

/** A name the manager or the catalog uses for a pack, matched to this domain's pack id; null for another pack. */
export function foundationsPackId(name: string): FoundationsPackId | null {
  const bare = name.trim().replace(/^custom_nodes[\\/]/, '').replace(/\.git$/, '');
  return FOUNDATIONS_PACKS.find((item) => item.id.toLowerCase() === bare.toLowerCase() || item.match.test(bare))?.id ?? null;
}

/**
 * This domain as a KnowledgeSet of coreKnowledge.ts (KNOWLEDGE_SETS): its nodes (seeded with the core), its packs,
 * its field notes by class (what the field does, then what to put) and the glossary as concepts (id = glossary id).
 * Read by fieldNote, packNote and conceptNote of coreKnowledge.ts, like every other set.
 */
export function foundationsKnowledgeSet(language: KnowledgeLanguage): KnowledgeSet {
  const pack = FOUNDATIONS[language];
  const fields: Record<string, Record<string, string>> = {};
  for (const key of FIELD_KEYS) {
    const name = key.includes('.') ? key.slice(key.indexOf('.') + 1) : key;
    const texts = pack.fields[key];
    for (const classType of FIELD_CLASSES[key]) (fields[classType] ??= {})[name] = `${texts.what} ${texts.set}`;
  }
  return {
    nodes: { ...pack.nodes },
    linkTypes: {},
    families: {},
    packs: Object.fromEntries(FOUNDATIONS_PACKS.map((item) => [item.id, { what: pack.packs[item.id].what, nodes: pack.packs[item.id].nodes, risk: pack.packs[item.id].note }])),
    fields,
    concepts: Object.fromEntries(GLOSSARY_TERMS.map((item) => [item.id, { ...pack.glossary[item.id] }])),
  };
}

/** The pages on docs.comfy.org of this domain's nodes, for the seeds' sources. */
export const FOUNDATIONS_SET_DOCS: KnowledgeSetDocs = { nodes: { ...FOUNDATIONS_NODE_DOCS }, families: {} };
