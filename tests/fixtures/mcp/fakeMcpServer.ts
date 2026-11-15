/**
 * A fake ComfyUI MCP server for tests: Streamable HTTP, JSON responses only, plain `http`.
 * It mimics the MCP server the app was built against: the same tool names and payload shapes, a capped page size so the app's
 * paging is exercised, `comfy_api GET /object_info` refused for body capacity, and `studio_info` naming a native
 * ComfyUI URL served by a second tiny fixture (`/system_stats`, `/object_info`).
 *
 * It also lists tools that write or run (install, download, queue). Every call is recorded in `calls` so a test can
 * prove the app only used read-only tools. The bearer token is checked but never recorded.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import type { AddressInfo } from 'net';
import * as path from 'path';
import { imageModelClassDefs } from './classes/image-models';
import { VIDEO_SET_CLASSES } from './classes/video';
import { IMAGE_TECHNIQUE_PACKS, imageTechniqueClassDefs } from './classes/image-techniques';
import { FOUNDATIONS_CLASSES } from './classes/foundations';
import { SOUND_3D_FACES_CLASSES, SOUND_3D_FACES_PACKS } from './classes/sound-3d-faces';

export interface FakeMcpCall {
  /** JSON-RPC method, or the HTTP method for non-POST requests ("GET", "DELETE"). */
  method: string;
  tool?: string;
  args?: Record<string, unknown>;
  /** Whether the request carried the expected bearer token. The token itself is never stored. */
  authorized: boolean;
}

export interface FakeMcp {
  /** The MCP endpoint, e.g. http://127.0.0.1:PORT/mcp */
  url: string;
  /** The native ComfyUI fixture origin that studio_info reports. */
  comfyUrl: string;
  calls: FakeMcpCall[];
  /** HTTP requests the native ComfyUI fixture saw, as "GET /object_info". */
  comfyHits: string[];
  close: () => Promise<void>;
}

export const PROTOCOL_VERSION = '2025-11-25';
const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
/** That server caps pages; a small cap makes the app follow next_cursor. */
const PAGE_CAP = 15;

/** Tools that would write, download, install, queue or restart. The app must never call any of these. */
export const WRITE_TOOLS = [
  'install_custom_node',
  'download_model',
  'nodepacks',
  'enqueue_workflow',
  'workflow_run',
  'restart_comfyui',
  'clear_vram',
  'stage_file',
  'artifact_import_begin',
] as const;

/**
 * `workspace_files` is on that server too. It reads, and it also writes, patches, moves and trashes; the
 * fake answers `read` for the files next to a model and `hash` for a model file, and treats every other action as a
 * write that must not come.
 */
export const READ_TOOLS = ['studio_info', 'studio_capabilities', 'models', 'model_metadata', 'comfy_api', 'list_local_models', 'workspace_files'] as const;

// ---------------------------------------------------------------- catalog

interface Pack { name: string; module: string; version: string | null; commit: string | null }

export const PACKS: Pack[] = [
  { name: 'comfy-core', module: 'nodes', version: '0.3.68', commit: null },
  { name: 'ComfyUI-KJNodes', module: 'custom_nodes.ComfyUI-KJNodes', version: '1.1.7', commit: 'a1b2c3d' },
  { name: 'ComfyUI-WanVideoWrapper', module: 'custom_nodes.ComfyUI-WanVideoWrapper', version: '1.3.4', commit: 'e4f5a6b' },
  { name: 'comfyui_controlnet_aux', module: 'custom_nodes.comfyui_controlnet_aux', version: '1.1.2', commit: null },
  { name: 'rgthree-comfy', module: 'custom_nodes.rgthree-comfy', version: '1.0.0', commit: '9c8d7e6' },
  { name: 'ComfyUI-GGUF', module: 'custom_nodes.ComfyUI-GGUF', version: '1.0.0', commit: null },
  ...IMAGE_TECHNIQUE_PACKS,
  ...SOUND_3D_FACES_PACKS,
];

export const MODELS: Array<{ category: string; filename: string; size: number }> = [
  { category: 'checkpoints', filename: 'juggernautXL_v9.safetensors', size: 6_938_000_000 },
  { category: 'checkpoints', filename: 'sd_xl_base_1.0.safetensors', size: 6_938_040_000 },
  { category: 'checkpoints', filename: 'ponyDiffusionV6XL.safetensors', size: 6_938_000_100 },
  { category: 'checkpoints', filename: 'realisticVisionV60B1_v51VAE.safetensors', size: 2_132_000_000 },
  { category: 'checkpoints', filename: 'flux1-dev-fp8.safetensors', size: 17_200_000_000 },
  { category: 'checkpoints', filename: 'z_image_turbo_bf16.safetensors', size: 12_300_000_000 },
  { category: 'loras', filename: 'wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022.safetensors', size: 613_000_000 },
  { category: 'loras', filename: 'wan2.2_i2v_A14b_low_noise_lora_rank64_lightx2v_4step_1022.safetensors', size: 613_000_000 },
  { category: 'loras', filename: 'Z-Image-Turbo-Realism-LoRA.safetensors', size: 340_000_000 },
  { category: 'loras', filename: 'PastelDetailPonyV2.safetensors', size: 228_000_000 },
  { category: 'loras', filename: 'add-detail-xl.safetensors', size: 228_400_000 },
  { category: 'loras', filename: 'sdxl_lightning_8step_lora.safetensors', size: 393_000_000 },
  { category: 'loras', filename: 'Wan21_CausVid_14B_T2V_lora_rank32.safetensors', size: 320_000_000 },
  { category: 'loras', filename: 'pixel-art-xl.safetensors', size: 170_000_000 },
  { category: 'loras', filename: 'flux_realism_lora.safetensors', size: 22_000_000 },
  { category: 'loras', filename: 'mystery_style_v3.safetensors', size: 150_000_000 },
  { category: 'vae', filename: 'sdxl_vae.safetensors', size: 334_600_000 },
  { category: 'vae', filename: 'ae.safetensors', size: 335_300_000 },
  { category: 'vae', filename: 'wan_2.1_vae.safetensors', size: 254_000_000 },
  { category: 'vae', filename: 'Wan2_2_VAE_bf16.safetensors', size: 1_400_000_000 },
  { category: 'controlnet', filename: 'controlnet-union-sdxl-1.0.safetensors', size: 2_500_000_000 },
  { category: 'controlnet', filename: 'diffusers_xl_canny_full.safetensors', size: 2_500_000_100 },
  { category: 'controlnet', filename: 'control_v11p_sd15_openpose.pth', size: 1_445_000_000 },
  { category: 'controlnet', filename: 'Z-Image-Turbo-Fun-Controlnet-Union.safetensors', size: 3_100_000_000 },
  { category: 'controlnet', filename: 'xinsir_depth_sdxl.safetensors', size: 2_500_000_200 },
  { category: 'text_encoders', filename: 'qwen_3_4b.safetensors', size: 8_040_000_000 },
  { category: 'text_encoders', filename: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors', size: 6_740_000_000 },
  { category: 'diffusion_models', filename: 'wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors', size: 14_300_000_000 },
  { category: 'diffusion_models', filename: 'z_image_turbo_bf16.safetensors', size: 12_300_000_000 },
  { category: 'upscale_models', filename: '4x-UltraSharp.pth', size: 66_900_000 },
  // The files the video lessons name, of the kinds they hold a file to (src/shared/lessons/files.ts).
  { category: 'diffusion_models', filename: 'wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors', size: 14_300_000_000 },
  { category: 'diffusion_models', filename: 'wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors', size: 14_300_000_000 },
  { category: 'diffusion_models', filename: 'wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors', size: 14_300_000_000 },
  { category: 'diffusion_models', filename: 'wan2.1_i2v_480p_14B_fp8_scaled.safetensors', size: 16_400_000_000 },
  { category: 'diffusion_models', filename: 'Wan2_2-Animate-14B_fp8_e4m3fn_scaled_KJ.safetensors', size: 18_400_000_000 },
  { category: 'diffusion_models', filename: 'Wan2_1_kwai_recammaster_1_3B_step20000_bf16.safetensors', size: 3_100_000_000 },
  { category: 'diffusion_models', filename: 'Wan2_2-Ovi-960x960-10s_fp8_e4m3fn_scaled_KJ.safetensors', size: 11_000_000_000 },
  { category: 'diffusion_models', filename: 'Wan2_2-Ovi-audio_model_bf16.safetensors', size: 5_000_000_000 },
  { category: 'diffusion_models', filename: 'Wan2_2_Fun_VACE_module_A14B_HIGH_fp8_e4m3fn_scaled_KJ.safetensors', size: 3_400_000_000 },
  { category: 'diffusion_models', filename: 'Wan2_2_Fun_VACE_module_A14B_LOW_fp8_e4m3fn_scaled_KJ.safetensors', size: 3_400_000_000 },
  { category: 'diffusion_models', filename: 'Wan2_1-InfiniteTalk_Single_fp8_e4m3fn_scaled_KJ.safetensors', size: 2_600_000_000 },
  { category: 'diffusion_models', filename: 'Wan2_1-InfiniteTalk_Multi_fp8_e4m3fn_scaled_KJ.safetensors', size: 2_600_000_000 },
  { category: 'diffusion_models', filename: 'fantasytalking_fp16.safetensors', size: 1_600_000_000 },
  { category: 'loras', filename: 'UniAnimate-Wan2.1-14B-Lora-12000-fp16.safetensors', size: 1_200_000_000 },
  // Junk the real server lists too; the app must filter it out.
  { category: 'loras', filename: '.cache/huggingface/download/abc.lock', size: 0 },
  { category: 'checkpoints', filename: '.DS_Store', size: 6148 },
];

// ---------------------------------------------------------------- files next to the models

/**
 * The fingerprint the fake gives a model file: made of its path, so a test knows it without a file of gigabytes.
 * The fake of Civitai and Hugging Face (tests/fixtures/web/fakeModelWeb.ts) knows some of these.
 */
export function fakeFileHash(category: string, filename: string): string {
  return createHash('sha256').update(`/srv/comfyui/models/${category}/${filename}`).digest('hex');
}

const SIDE_DIR = path.join(__dirname, 'side');
const sideBytes = (name: string) => fs.readFileSync(path.join(SIDE_DIR, name));
const json = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2), 'utf8');

/** A Lora Manager record as that manager writes it next to a file: its own fields, the Civitai record inside. */
const PIXEL_ART_SIDECAR = {
  file_name: 'pixel-art-xl',
  model_name: 'Pixel Art XL',
  file_path: '/srv/comfyui/models/loras/pixel-art-xl.safetensors',
  size: 170_000_000,
  sha256: '4f2a7c0d9e1b6a35c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5',
  base_model: 'SDXL 1.0',
  preview_url: '/srv/comfyui/models/loras/pixel-art-xl.webp',
  preview_nsfw_level: 1,
  notes: 'Turn the strength down for portraits.',
  from_civitai: true,
  civitai: {
    id: 135931,
    modelId: 120096,
    name: 'v1.1',
    trainedWords: ['pixel art'],
    baseModel: 'SDXL 1.0',
    description: '<p>Sharper edges than v1.0.</p>',
    model: {
      name: 'Pixel Art XL',
      type: 'LORA',
      nsfw: false,
      description: '<h3>What it does</h3><p>Turns a picture into <b>pixel art</b> with a limited palette.</p><ul><li>Works at 1024 x 1024.</li><li>Downscale the result eight times for true pixels.</li></ul>',
      tags: ['style', 'pixel art', 'retro'],
    },
    images: [
      { url: 'https://example.invalid/pixel-1.jpeg', nsfwLevel: 1, type: 'image', meta: { prompt: 'pixel art, a lighthouse on a cliff, sunset, seagulls', negativePrompt: 'blurry, 3d render', steps: 8, cfgScale: 1.5, sampler: 'euler' } },
      { url: 'https://example.invalid/pixel-2.jpeg', nsfwLevel: 1, type: 'image', meta: { prompt: 'pixel art, a cat sleeping on a bookshelf, warm lamp light', steps: 8, cfgScale: 1.5, sampler: 'euler' } },
    ],
    creator: { username: 'nerijs' },
  },
  tags: ['style'],
  modelDescription: '',
  usage_tips: '{"strength": 0.9, "strength_min": 0.6, "strength_max": 1.2}',
};

/** A file whose author marked it as adult content. The words are plain; only the marks say what it is. */
const MARKED_SIDECAR = {
  file_name: 'flux_realism_lora',
  model_name: 'Night Painter',
  base_model: 'Flux.1 D',
  preview_url: '/srv/comfyui/models/loras/flux_realism_lora.png',
  preview_nsfw_level: 8,
  notes: '',
  from_civitai: true,
  civitai: {
    id: 777002,
    modelId: 777001,
    name: 'v2',
    trainedWords: ['night painter'],
    baseModel: 'Flux.1 D',
    description: null,
    model: { name: 'Night Painter', type: 'LORA', nsfw: true, description: '<p>A painterly look with deep shadows.</p>', tags: ['style', 'painterly'] },
    images: [
      { url: 'https://example.invalid/night-1.jpeg', nsfwLevel: 1, type: 'image', meta: { prompt: 'night painter, a harbour at midnight, lanterns on the water', steps: 24, cfgScale: 3.5, sampler: 'euler' } },
      { url: 'https://example.invalid/night-2.jpeg', nsfwLevel: 8, type: 'image', meta: { prompt: 'night painter, a figure in a doorway, candle light', steps: 28, cfgScale: 3.5, sampler: 'euler' } },
    ],
  },
  tags: ['style'],
  modelDescription: '',
  usage_tips: '{}',
};

/** A file that never met Civitai: the manager's record says almost nothing, and the preview is a clip. */
const LOCAL_SIDECAR = {
  file_name: 'wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022',
  // Lora Manager writes the file's fingerprint even for a file Civitai never described.
  sha256: fakeFileHash('loras', 'wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022.safetensors'),
  model_name: 'wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022',
  base_model: 'Unknown',
  preview_url: '',
  preview_nsfw_level: 0,
  notes: '',
  from_civitai: false,
  civitai: {},
  tags: [],
  modelDescription: '',
  usage_tips: '{}',
};

/** The other convention: a bare Civitai record as `.civitai.info` and a picture as `.preview.png`. */
const JUGGERNAUT_INFO = {
  id: 348913,
  modelId: 133005,
  name: 'v9 + RunDiffusionPhoto 2',
  trainedWords: [],
  baseModel: 'SDXL 1.0',
  description: null,
  model: { name: 'Juggernaut XL', type: 'Checkpoint', nsfw: false, description: '<p>A general purpose photographic SDXL checkpoint.</p>', tags: ['base model', 'photorealistic'] },
  images: [{ url: 'https://example.invalid/jugg-1.jpeg', nsfw: 'None', meta: { prompt: 'a portrait photograph of an old sailor, overcast light, 85mm', negativePrompt: 'cartoon, painting', steps: 30, cfgScale: 4.5, sampler: 'dpmpp_2m_sde' } }],
};

/** Files a model manager keeps next to the models: descriptions and previews. Listed with the models, never loaders. */
export const SIDE_FILES: Array<{ category: string; filename: string; bytes: Buffer }> = [
  { category: 'loras', filename: 'pixel-art-xl.metadata.json', bytes: json(PIXEL_ART_SIDECAR) },
  { category: 'loras', filename: 'pixel-art-xl.webp', bytes: sideBytes('still.webp') },
  { category: 'loras', filename: 'flux_realism_lora.metadata.json', bytes: json(MARKED_SIDECAR) },
  { category: 'loras', filename: 'flux_realism_lora.png', bytes: sideBytes('still.png') },
  { category: 'loras', filename: 'wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022.metadata.json', bytes: json(LOCAL_SIDECAR) },
  { category: 'loras', filename: 'wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022.mp4', bytes: sideBytes('clip.mp4') },
  { category: 'checkpoints', filename: 'juggernautXL_v9.civitai.info', bytes: json(JUGGERNAUT_INFO) },
  { category: 'checkpoints', filename: 'juggernautXL_v9.preview.png', bytes: sideBytes('still.png') },
  // Not side files of any model: the app must leave them alone.
  { category: 'loras', filename: 'readme.txt', bytes: Buffer.from('notes', 'utf8') },
  { category: 'loras', filename: 'orphan.webp', bytes: sideBytes('still.webp') },
];

const MODEL_ROOT = '/srv/comfyui/models';
const sidePathOf = (file: { category: string; filename: string }) => `${MODEL_ROOT}/${file.category}/${file.filename}`;

/** Where ComfyUI loads node packs from, as `studio_capabilities` section roots names it. */
export const CUSTOM_NODE_ROOT = '/srv/comfyui/custom_nodes';

export const KJNODES_DESCRIPTION = 'Various quality of life and masking related nodes and scripts made by combining functionality of existing nodes for ComfyUI.';
export const KJNODES_REPOSITORY = 'https://github.com/kijai/ComfyUI-KJNodes';
export const WAN_README_OPENING = 'ComfyUI wrapper nodes for WanVideo and related models. Work in progress, expect things to change.';

/**
 * The files at the top of some packs, as they are on GitHub in spirit: KJNodes says who it is in pyproject.toml
 * and has a README with badges and a picture; WanVideoWrapper has only a README; the other packs have neither.
 * Also a file deeper in a pack and a pack's code, which the app must never ask for.
 */
export const PACK_FILES: Array<{ pack: string; file: string; bytes: Buffer }> = [
  {
    pack: 'ComfyUI-KJNodes',
    file: 'pyproject.toml',
    bytes: Buffer.from([
      '[project]',
      'name = "comfyui-kjnodes"',
      `description = "${KJNODES_DESCRIPTION}"`,
      'version = "1.1.7"',
      'license = { file = "LICENSE" }',
      'dependencies = ["librosa", "numpy", "pillow>=10.3.0", "scipy", "color-matcher", "matplotlib", "huggingface_hub"]',
      '',
      '[project.urls]',
      `Repository = "${KJNODES_REPOSITORY}"`,
      '# Used by Comfy Registry https://comfyregistry.org',
      '',
      '[tool.comfy]',
      'PublisherId = "kijai"',
      'DisplayName = "KJNodes"',
      'Icon = ""',
      '',
    ].join('\n'), 'utf8'),
  },
  {
    pack: 'ComfyUI-KJNodes',
    file: 'README.md',
    bytes: Buffer.from([
      '# KJNodes for ComfyUI',
      '',
      '[![Downloads](https://img.shields.io/badge/downloads-many-blue)](https://example.invalid/stats) [![License](https://img.shields.io/badge/license-GPL-green)](LICENSE)',
      '',
      'Various quality of life and masking related -nodes and scripts made by combining functionality of existing nodes for ComfyUI.',
      '',
      'I know I\'m bad at documentation, especially this project that has grown from random practice nodes to... too many lines in one file.',
      'I have however started to add descriptions to the nodes themselves, there\'s a small ? you can click for info what the node does.',
      'This is still work in progress, like everything else.',
      '',
      '<p align="center"><img src="docs/images/overview.png" width="600"></p>',
      '',
      '# Installation',
      '1. Clone this repo into `custom_nodes` folder.',
      '2. Install dependencies: `pip install -r requirements.txt`',
      '',
    ].join('\n'), 'utf8'),
  },
  {
    pack: 'ComfyUI-WanVideoWrapper',
    file: 'README.md',
    bytes: Buffer.from([
      '# ComfyUI wrapper nodes for [WanVideo](https://github.com/Wan-Video/Wan2.1)',
      '',
      '![image](https://example.invalid/wan.png)',
      '',
      `**${WAN_README_OPENING.split(' ').slice(0, 4).join(' ')}** ${WAN_README_OPENING.split(' ').slice(4).join(' ')}`,
      '',
      '```',
      'pip install -r requirements.txt',
      '```',
      '',
    ].join('\n'), 'utf8'),
  },
  { pack: 'ComfyUI-KJNodes', file: '__init__.py', bytes: Buffer.from('NODE_CLASS_MAPPINGS = {}\n', 'utf8') },
  { pack: 'ComfyUI-KJNodes', file: 'docs/README.md', bytes: Buffer.from('# Docs\n', 'utf8') },
];

const packPathOf = (file: { pack: string; file: string }) => `${CUSTOM_NODE_ROOT}/${file.pack}/${file.file}`;

/** `workspace_files` action read, the way that server answers: exact bytes as base64, a slice at a time. */
function readWorkspaceFile(args: Record<string, unknown>) {
  const found = SIDE_FILES.find((file) => sidePathOf(file) === args.absolute_path)
    ?? PACK_FILES.find((file) => packPathOf(file) === args.absolute_path);
  if (!found) return text({ error: { code: 'ADMIN_FILE_NOT_FOUND', message: 'ADMIN_FILE_NOT_FOUND' } }, true);
  const offset = typeof args.offset === 'number' ? args.offset : 0;
  const length = Math.min(typeof args.length === 'number' ? args.length : 65536, 1048576);
  const slice = found.bytes.subarray(offset, offset + length);
  const next = offset + slice.length;
  return text({
    path: args.absolute_path,
    root: 'models',
    encoding: args.encoding ?? 'utf8',
    data_base64: slice.toString('base64'),
    offset,
    length: slice.length,
    next_offset: next,
    total: found.bytes.length,
    size_bytes: found.bytes.length,
    complete: next >= found.bytes.length,
    truncated: next < found.bytes.length,
  });
}

/**
 * `workspace_files` action hash of a model file: its SHA-256, the way that server answers (a `sha256` field
 * beside the path and size). Only for model files the fake lists; anything else is not found.
 */
function hashWorkspaceFile(args: Record<string, unknown>) {
  const found = MODELS.find((file) => `${MODEL_ROOT}/${file.category}/${file.filename}` === args.absolute_path);
  if (!found) return text({ error: { code: 'ADMIN_FILE_NOT_FOUND', message: 'ADMIN_FILE_NOT_FOUND' } }, true);
  return text({ path: args.absolute_path, root: 'models', algorithm: 'sha256', sha256: fakeFileHash(found.category, found.filename), size_bytes: found.size });
}

/** model_metadata answers for a few files; anything else gets an empty header and no sidecar. */
const METADATA: Record<string, unknown> = {
  'loras/PastelDetailPonyV2.safetensors': {
    embedded_metadata: { ss_base_model_version: 'sdxl_base_v1-0', ss_output_name: 'PastelDetailPonyV2' },
    civitai_sidecar: {
      trainedWords: ['pastel detail'],
      baseModel: 'Pony',
      description: '<p>Pony LoRA for <b>soft pastel detail</b>.</p>',
      modelId: 123456,
      modelVersionId: 654321,
    },
  },
  'loras/Z-Image-Turbo-Realism-LoRA.safetensors': {
    embedded_metadata: { ss_base_model_version: 'zimage', 'modelspec.title': 'Z-Image Turbo Realism' },
    civitai_sidecar: {
      trainedWords: ['realism', 'photo'],
      baseModel: 'ZImageTurbo',
      description: 'Adds photographic realism to Z-Image Turbo.',
      modelId: 222333,
      modelVersionId: 444555,
    },
  },
  'loras/wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022.safetensors': {
    embedded_metadata: { 'modelspec.architecture': 'wan2.2-i2v-14B/lora', 'modelspec.title': 'lightx2v 4-step high noise' },
    civitai_sidecar: null,
  },
  'loras/add-detail-xl.safetensors': {
    embedded_metadata: { ss_base_model_version: 'sdxl_base_v1-0', ss_output_name: 'add-detail-xl' },
    civitai_sidecar: null,
  },
  'checkpoints/juggernautXL_v9.safetensors': {
    embedded_metadata: { 'modelspec.architecture': 'stable-diffusion-xl-v1-base', 'modelspec.title': 'Juggernaut XL v9' },
    civitai_sidecar: { trainedWords: [], baseModel: 'SDXL 1.0', description: 'General purpose SDXL checkpoint.', modelId: 133005, modelVersionId: 348913 },
  },
};

type Spec = [string, Record<string, unknown>?] | [string[], Record<string, unknown>?];
interface ClassDef {
  classType: string;
  pack: number;
  display: string;
  category: string;
  required?: Record<string, Spec>;
  optional?: Record<string, Spec>;
  output: string[];
  outputName?: string[];
  outputNode?: boolean;
  /** What its author says the node does, as object_info carries it. */
  description?: string;
}

/** How many listed entries are real model files (no dotfiles or cache entries). */
export const modelFileCount = () => MODELS.filter((m) => !m.filename.startsWith('.') && !m.filename.includes('/.')).length;
const names = (category: string) => MODELS.filter((m) => m.category === category && !m.filename.startsWith('.') && !m.filename.includes('/.')).map((m) => m.filename);
const SAMPLERS = ['euler', 'euler_ancestral', 'dpmpp_2m', 'dpmpp_2m_sde', 'uni_pc'];
const SCHEDULERS = ['normal', 'karras', 'sgm_uniform', 'simple', 'beta'];
const IMAGES = ['example.png', 'portrait.jpg'];

export const CLASSES: ClassDef[] = [
  // comfy-core (25)
  { classType: 'CheckpointLoaderSimple', pack: 0, display: 'Load Checkpoint', category: 'loaders', required: { ckpt_name: [names('checkpoints'), { tooltip: 'The name of the checkpoint (model) to load.' }] }, output: ['MODEL', 'CLIP', 'VAE'] },
  { classType: 'VAELoader', pack: 0, display: 'Load VAE', category: 'loaders', required: { vae_name: [names('vae')] }, output: ['VAE'] },
  { classType: 'LoraLoader', pack: 0, display: 'Load LoRA', category: 'loaders', required: { model: ['MODEL'], clip: ['CLIP'], lora_name: [names('loras')], strength_model: ['FLOAT', { default: 1, min: -100, max: 100, step: 0.01 }], strength_clip: ['FLOAT', { default: 1, min: -100, max: 100, step: 0.01 }] }, output: ['MODEL', 'CLIP'] },
  { classType: 'LoraLoaderModelOnly', pack: 0, display: 'LoraLoaderModelOnly', category: 'loaders', required: { model: ['MODEL'], lora_name: [names('loras')], strength_model: ['FLOAT', { default: 1 }] }, output: ['MODEL'] },
  { classType: 'CLIPLoader', pack: 0, display: 'Load CLIP', category: 'advanced/loaders', required: { clip_name: [names('text_encoders')], type: [['stable_diffusion', 'wan', 'lumina2', 'stable_audio']] }, output: ['CLIP'] },
  { classType: 'UNETLoader', pack: 0, display: 'Load Diffusion Model', category: 'advanced/loaders', required: { unet_name: [names('diffusion_models')], weight_dtype: [['default', 'fp8_e4m3fn']] }, output: ['MODEL'] },
  { classType: 'ControlNetLoader', pack: 0, display: 'Load ControlNet Model', category: 'loaders', required: { control_net_name: [names('controlnet')] }, output: ['CONTROL_NET'] },
  { classType: 'UpscaleModelLoader', pack: 0, display: 'Load Upscale Model', category: 'loaders', required: { model_name: [names('upscale_models')] }, output: ['UPSCALE_MODEL'] },
  { classType: 'CLIPTextEncode', pack: 0, display: 'CLIP Text Encode (Prompt)', category: 'conditioning', required: { text: ['STRING', { multiline: true, dynamicPrompts: true }], clip: ['CLIP'] }, output: ['CONDITIONING'] },
  { classType: 'ConditioningCombine', pack: 0, display: 'Conditioning (Combine)', category: 'conditioning', required: { conditioning_1: ['CONDITIONING'], conditioning_2: ['CONDITIONING'] }, output: ['CONDITIONING'] },
  { classType: 'CLIPSetLastLayer', pack: 0, display: 'CLIP Set Last Layer', category: 'conditioning', required: { clip: ['CLIP'], stop_at_clip_layer: ['INT', { default: -1, min: -24, max: -1 }] }, output: ['CLIP'] },
  { classType: 'ControlNetApplyAdvanced', pack: 0, display: 'Apply ControlNet', category: 'conditioning/controlnet', required: { positive: ['CONDITIONING'], negative: ['CONDITIONING'], control_net: ['CONTROL_NET'], image: ['IMAGE'], strength: ['FLOAT', { default: 1 }], start_percent: ['FLOAT', { default: 0 }], end_percent: ['FLOAT', { default: 1 }] }, optional: { vae: ['VAE'] }, output: ['CONDITIONING', 'CONDITIONING'], outputName: ['positive', 'negative'] },
  { classType: 'KSampler', pack: 0, display: 'KSampler', category: 'sampling', required: { model: ['MODEL'], seed: ['INT', { default: 0, min: 0, max: 0xffffffffffff, control_after_generate: true }], steps: ['INT', { default: 20, min: 1, max: 10000, tooltip: 'The number of steps used in the denoising process.' }], cfg: ['FLOAT', { default: 8, min: 0, max: 100, step: 0.1, tooltip: 'The Classifier-Free Guidance scale balances creativity and adherence to the prompt. Higher values result in images more closely matching the prompt however too high values will negatively impact quality.' }], sampler_name: [SAMPLERS], scheduler: [SCHEDULERS], positive: ['CONDITIONING'], negative: ['CONDITIONING'], latent_image: ['LATENT'], denoise: ['FLOAT', { default: 1, min: 0, max: 1, step: 0.01 }] }, output: ['LATENT'] },
  { classType: 'KSamplerAdvanced', pack: 0, display: 'KSampler (Advanced)', category: 'sampling', required: { model: ['MODEL'], add_noise: [['enable', 'disable']], noise_seed: ['INT', { default: 0 }], steps: ['INT', { default: 20 }], cfg: ['FLOAT', { default: 8 }], sampler_name: [SAMPLERS], scheduler: [SCHEDULERS], positive: ['CONDITIONING'], negative: ['CONDITIONING'], latent_image: ['LATENT'], start_at_step: ['INT', { default: 0 }], end_at_step: ['INT', { default: 10000 }], return_with_leftover_noise: [['disable', 'enable']] }, output: ['LATENT'] },
  { classType: 'ModelSamplingSD3', pack: 0, display: 'ModelSamplingSD3', category: 'advanced/model', required: { model: ['MODEL'], shift: ['FLOAT', { default: 3 }] }, output: ['MODEL'] },
  { classType: 'EmptyLatentImage', pack: 0, display: 'Empty Latent Image', category: 'latent', required: { width: ['INT', { default: 512, min: 16, step: 8 }], height: ['INT', { default: 512, min: 16, step: 8 }], batch_size: ['INT', { default: 1, min: 1, max: 4096 }] }, output: ['LATENT'] },
  { classType: 'LatentUpscale', pack: 0, display: 'Upscale Latent', category: 'latent', required: { samples: ['LATENT'], upscale_method: [['nearest-exact', 'bilinear', 'bicubic']], width: ['INT', { default: 512 }], height: ['INT', { default: 512 }], crop: [['disabled', 'center']] }, output: ['LATENT'] },
  { classType: 'VAEDecode', pack: 0, display: 'VAE Decode', category: 'latent', required: { samples: ['LATENT'], vae: ['VAE'] }, output: ['IMAGE'] },
  { classType: 'VAEEncode', pack: 0, display: 'VAE Encode', category: 'latent', required: { pixels: ['IMAGE'], vae: ['VAE'] }, output: ['LATENT'] },
  { classType: 'LoadImage', pack: 0, display: 'Load Image', category: 'image', required: { image: [IMAGES, { image_upload: true }] }, output: ['IMAGE', 'MASK'] },
  { classType: 'SaveImage', pack: 0, display: 'Save Image', category: 'image', required: { images: ['IMAGE'], filename_prefix: ['STRING', { default: 'ComfyUI' }] }, output: [], outputNode: true },
  { classType: 'PreviewImage', pack: 0, display: 'Preview Image', category: 'image', required: { images: ['IMAGE'] }, output: [], outputNode: true },
  { classType: 'ImageScale', pack: 0, display: 'Upscale Image', category: 'image/upscaling', required: { image: ['IMAGE'], upscale_method: [['nearest-exact', 'bilinear', 'lanczos']], width: ['INT', { default: 512 }], height: ['INT', { default: 512 }], crop: [['disabled', 'center']] }, output: ['IMAGE'] },
  { classType: 'ImageScaleBy', pack: 0, display: 'Upscale Image By', category: 'image/upscaling', required: { image: ['IMAGE'], upscale_method: [['nearest-exact', 'bilinear', 'lanczos']], scale_by: ['FLOAT', { default: 1 }] }, output: ['IMAGE'] },
  { classType: 'ImageUpscaleWithModel', pack: 0, display: 'Upscale Image (using Model)', category: 'image/upscaling', required: { upscale_model: ['UPSCALE_MODEL'], image: ['IMAGE'] }, output: ['IMAGE'] },
  // ComfyUI-KJNodes (3)
  { classType: 'ImageResizeKJ', pack: 1, display: 'Resize Image', category: 'KJNodes/image', required: { image: ['IMAGE'], width: ['INT', { default: 512 }], height: ['INT', { default: 512 }], upscale_method: [['nearest-exact', 'lanczos']], keep_proportion: ['BOOLEAN', { default: false }], divisible_by: ['INT', { default: 2 }] }, output: ['IMAGE', 'INT', 'INT'], outputName: ['IMAGE', 'width', 'height'] },
  { classType: 'GetImageSizeAndCount', pack: 1, display: 'Get Image Size & Count', category: 'KJNodes/image', required: { image: ['IMAGE'] }, output: ['IMAGE', 'INT', 'INT', 'INT'], outputName: ['image', 'width', 'height', 'count'] },
  { classType: 'ColorMatch', pack: 1, display: 'Color Match', category: 'KJNodes/image', description: 'Transfers the colours of the reference image onto the target image.', required: { image_ref: ['IMAGE'], image_target: ['IMAGE'], method: [['mkl', 'hm', 'reinhard']] }, output: ['IMAGE'] },
  // ComfyUI-WanVideoWrapper (6), with the inputs and outputs the pack itself declares (nodes.py, nodes_model_loading.py, nodes_sampler.py)
  { classType: 'WanVideoModelLoader', pack: 2, display: 'WanVideo Model Loader', category: 'WanVideoWrapper', required: { model: [names('diffusion_models')], base_precision: [['fp32', 'bf16', 'fp16', 'fp16_fast'], { default: 'bf16' }], quantization: [['disabled', 'fp8_e4m3fn', 'fp8_e4m3fn_scaled'], { default: 'disabled' }], load_device: [['main_device', 'offload_device'], { default: 'offload_device' }] }, optional: { block_swap_args: ['BLOCKSWAPARGS'], lora: ['WANVIDLORA'], extra_model: ['VACEPATH'], fantasytalking_model: ['FANTASYTALKINGMODEL'], multitalk_model: ['MULTITALKMODEL'] }, output: ['WANVIDEOMODEL'], outputName: ['model'] },
  { classType: 'WanVideoLoraSelect', pack: 2, display: 'WanVideo Lora Select', category: 'WanVideoWrapper', required: { lora: [names('loras')], strength: ['FLOAT', { default: 1 }] }, optional: { prev_lora: ['WANVIDLORA'] }, output: ['WANVIDLORA'], outputName: ['lora'] },
  { classType: 'WanVideoVAELoader', pack: 2, display: 'WanVideo VAE Loader', category: 'WanVideoWrapper', required: { model_name: [names('vae')] }, optional: { precision: [['fp16', 'fp32', 'bf16'], { default: 'bf16' }] }, output: ['WANVAE'], outputName: ['vae'] },
  { classType: 'WanVideoTextEncode', pack: 2, display: 'WanVideo TextEncode', category: 'WanVideoWrapper', required: { positive_prompt: ['STRING', { multiline: true }], negative_prompt: ['STRING', { multiline: true }] }, optional: { t5: ['WANTEXTENCODER'], force_offload: ['BOOLEAN', { default: true }] }, output: ['WANVIDEOTEXTEMBEDS'], outputName: ['text_embeds'] },
  { classType: 'WanVideoSampler', pack: 2, display: 'WanVideo Sampler', category: 'WanVideoWrapper', required: { model: ['WANVIDEOMODEL'], image_embeds: ['WANVIDIMAGE_EMBEDS'], steps: ['INT', { default: 30, min: 1 }], cfg: ['FLOAT', { default: 6, min: 0, max: 30, step: 0.01 }], shift: ['FLOAT', { default: 5, min: 0, max: 1000, step: 0.01 }], seed: ['INT', { default: 0, min: 0 }], force_offload: ['BOOLEAN', { default: true }], scheduler: [['unipc', 'dpm++', 'euler'], { default: 'unipc' }] }, optional: { text_embeds: ['WANVIDEOTEXTEMBEDS'], samples: ['LATENT'], unianimate_poses: ['UNIANIMATE_POSE'], fantasytalking_embeds: ['FANTASYTALKING_EMBEDS'], multitalk_embeds: ['MULTITALK_EMBEDS'], start_step: ['INT', { default: 0, min: 0, max: 10000 }], end_step: ['INT', { default: -1, min: -1, max: 10000 }] }, output: ['LATENT', 'LATENT'], outputName: ['samples', 'denoised_samples'] },
  { classType: 'WanVideoDecode', pack: 2, display: 'WanVideo Decode', category: 'WanVideoWrapper', required: { vae: ['WANVAE'], samples: ['LATENT'], enable_vae_tiling: ['BOOLEAN', { default: false }] }, output: ['IMAGE'], outputName: ['images'] },
  // comfyui_controlnet_aux (3)
  { classType: 'CannyEdgePreprocessor', pack: 3, display: 'Canny Edge', category: 'ControlNet Preprocessors/Line Extractors', required: { image: ['IMAGE'], low_threshold: ['INT', { default: 100 }], high_threshold: ['INT', { default: 200 }], resolution: ['INT', { default: 512 }] }, output: ['IMAGE'] },
  { classType: 'DepthAnythingV2Preprocessor', pack: 3, display: 'Depth Anything V2 - Relative', category: 'ControlNet Preprocessors/Normal and Depth Estimators', required: { image: ['IMAGE'], ckpt_name: [['depth_anything_v2_vitl.pth']], resolution: ['INT', { default: 512 }] }, output: ['IMAGE'] },
  { classType: 'OpenposePreprocessor', pack: 3, display: 'OpenPose Pose', category: 'ControlNet Preprocessors/Faces and Poses Estimators', required: { image: ['IMAGE'], detect_hand: [['enable', 'disable']], detect_body: [['enable', 'disable']], detect_face: [['enable', 'disable']], resolution: ['INT', { default: 512 }] }, output: ['IMAGE', 'POSE_KEYPOINT'] },
  // rgthree-comfy (3)
  { classType: 'Seed (rgthree)', pack: 4, display: 'Seed (rgthree)', category: 'rgthree', required: { seed: ['INT', { default: 0 }] }, output: ['INT'], outputName: ['SEED'] },
  { classType: 'Image Comparer (rgthree)', pack: 4, display: 'Image Comparer (rgthree)', category: 'rgthree', optional: { image_a: ['IMAGE'], image_b: ['IMAGE'] }, output: [], outputNode: true },
  { classType: 'Display Any (rgthree)', pack: 4, display: 'Display Any (rgthree)', category: 'rgthree', required: { source: ['*'] }, output: [], outputNode: true },
];

/**
 * ComfyUI's own video nodes (comfy_extras/nodes_hunyuan, nodes_wan, nodes_video), served only when a test asks
 * for them with `video: true`: the lessons on video need them, and every other test counts on the list above.
 */
/**
 * Lesson sets bring their own classes, and two sets may bring the same core class. A class brought again with the
 * same required inputs and outputs is kept once (the first set's lists of choices win); one brought with other ports
 * stays twice, and the unit test tests/unit/fakeClasses.test.ts fails on it, so two sets that disagree about what
 * a class is are caught when they merge.
 */
function onceEach(defs: ClassDef[], before: readonly ClassDef[]): ClassDef[] {
  const ports = (def: ClassDef) => JSON.stringify([Object.keys(def.required).sort(), def.output]);
  const out: ClassDef[] = [];
  for (const def of defs) {
    const earlier = [...before, ...out].find((item) => item.classType === def.classType);
    if (earlier && ports(earlier) === ports(def)) continue;
    out.push(def);
  }
  return out;
}

export const VIDEO_CLASSES: ClassDef[] = onceEach([
  // VACE, Wan Animate and InfiniteTalk on WanVideoWrapper, as the pack declares them; the pose and face finders of
  // ComfyUI-WanAnimatePreprocess; ComfyUI's own video, sound and CLIP vision loaders.
  { classType: 'WanVideoVACEModelSelect', pack: 2, display: 'WanVideo VACE Module Select', category: 'WanVideoWrapper', required: { vace_model: [names('diffusion_models')] }, output: ['VACEPATH'], outputName: ['extra_model'] },
  { classType: 'WanVideoVACEEncode', pack: 2, display: 'WanVideo VACE Encode', category: 'WanVideoWrapper', required: { vae: ['WANVAE'], width: ['INT', { default: 832, min: 64, step: 8 }], height: ['INT', { default: 480, min: 64, step: 8 }], num_frames: ['INT', { default: 81, min: 1, step: 4 }], strength: ['FLOAT', { default: 1, min: 0, max: 10, step: 0.001 }], vace_start_percent: ['FLOAT', { default: 0, min: 0, max: 1, step: 0.01 }], vace_end_percent: ['FLOAT', { default: 1, min: 0, max: 1, step: 0.01 }] }, optional: { input_frames: ['IMAGE'], ref_images: ['IMAGE'], input_masks: ['MASK'], prev_vace_embeds: ['WANVIDIMAGE_EMBEDS'] }, output: ['WANVIDIMAGE_EMBEDS'], outputName: ['vace_embeds'] },
  { classType: 'WanVideoAnimateEmbeds', pack: 2, display: 'WanVideo Animate Embeds', category: 'WanVideoWrapper', required: { vae: ['WANVAE'], width: ['INT', { default: 832, min: 64, step: 8 }], height: ['INT', { default: 480, min: 64, step: 8 }], num_frames: ['INT', { default: 81, min: 1, step: 4 }], force_offload: ['BOOLEAN', { default: true }], frame_window_size: ['INT', { default: 77, min: 1 }], colormatch: [['disabled', 'mkl', 'hm', 'reinhard'], { default: 'disabled' }], pose_strength: ['FLOAT', { default: 1, min: 0, max: 10, step: 0.001 }], face_strength: ['FLOAT', { default: 1, min: 0, max: 10, step: 0.001 }] }, optional: { clip_embeds: ['WANVIDIMAGE_CLIPEMBEDS'], ref_images: ['IMAGE'], pose_images: ['IMAGE'], face_images: ['IMAGE'] }, output: ['WANVIDIMAGE_EMBEDS'], outputName: ['image_embeds'] },
  { classType: 'WanVideoClipVisionEncode', pack: 2, display: 'WanVideo ClipVision Encode', category: 'WanVideoWrapper', required: { clip_vision: ['CLIP_VISION'], image_1: ['IMAGE'], strength_1: ['FLOAT', { default: 1 }], crop: [['center', 'disabled'], { default: 'center' }] }, output: ['WANVIDIMAGE_CLIPEMBEDS'], outputName: ['image_embeds'] },
  { classType: 'Wav2VecModelLoader', pack: 2, display: 'Wav2vec2 Model Loader', category: 'WanVideoWrapper', required: { model: [['chinese-wav2vec2-base-fp16.safetensors']], base_precision: [['fp32', 'bf16', 'fp16'], { default: 'fp16' }] }, output: ['WAV2VECMODEL'], outputName: ['wav2vec_model'] },
  { classType: 'MultiTalkModelLoader', pack: 2, display: 'Multi/InfiniteTalk Model Loader', category: 'WanVideoWrapper', required: { model: [names('diffusion_models')] }, output: ['MULTITALKMODEL'], outputName: ['model'] },
  { classType: 'MultiTalkWav2VecEmbeds', pack: 2, display: 'Multi/InfiniteTalk Wav2vec2 Embeds', category: 'WanVideoWrapper', required: { wav2vec_model: ['WAV2VECMODEL'], audio_1: ['AUDIO'], normalize_loudness: ['BOOLEAN', { default: true }], num_frames: ['INT', { default: 81, min: 1 }], fps: ['FLOAT', { default: 25, min: 1, max: 60, step: 0.1 }], audio_scale: ['FLOAT', { default: 1, min: 0, max: 100, step: 0.01 }], audio_cfg_scale: ['FLOAT', { default: 1, min: 0, max: 100, step: 0.01 }], multi_audio_type: [['para', 'add'], { default: 'para' }] }, optional: { audio_2: ['AUDIO'], audio_3: ['AUDIO'], audio_4: ['AUDIO'], ref_target_masks: ['MASK'] }, output: ['MULTITALK_EMBEDS', 'AUDIO', 'INT'], outputName: ['multitalk_embeds', 'audio', 'num_frames'] },
  { classType: 'WanVideoImageToVideoMultiTalk', pack: 2, display: 'WanVideo Long I2V Multi/InfiniteTalk', category: 'WanVideoWrapper', required: { vae: ['WANVAE'], width: ['INT', { default: 832, min: 64, step: 8 }], height: ['INT', { default: 480, min: 64, step: 8 }], frame_window_size: ['INT', { default: 81, min: 1, step: 4 }], motion_frame: ['INT', { default: 25, min: 1 }] }, optional: { start_image: ['IMAGE'], clip_embeds: ['WANVIDIMAGE_CLIPEMBEDS'] }, output: ['WANVIDIMAGE_EMBEDS', 'STRING'], outputName: ['image_embeds', 'output_path'] },
  { classType: 'OnnxDetectionModelLoader', pack: 2, display: 'ONNX Detection Model Loader', category: 'WanAnimatePreprocess', required: { vitpose_model: [['vitpose-l-wholebody.onnx', 'yolov10m.onnx']], yolo_model: [['vitpose-l-wholebody.onnx', 'yolov10m.onnx']], onnx_device: [['CUDAExecutionProvider', 'CPUExecutionProvider']] }, output: ['POSEMODEL'], outputName: ['model'] },
  { classType: 'PoseAndFaceDetection', pack: 2, display: 'Pose and Face Detection', category: 'WanAnimatePreprocess', required: { model: ['POSEMODEL'], images: ['IMAGE'], width: ['INT', { default: 832 }], height: ['INT', { default: 480 }] }, output: ['POSEDATA', 'IMAGE', 'STRING', 'BBOX', 'BBOX,'], outputName: ['pose_data', 'face_images', 'key_frame_body_points', 'bboxes', 'face_bboxes'] },
  { classType: 'DrawViTPose', pack: 2, display: 'Draw ViT Pose', category: 'WanAnimatePreprocess', required: { pose_data: ['POSEDATA'], width: ['INT', { default: 832 }], height: ['INT', { default: 480 }] }, output: ['IMAGE'], outputName: ['pose_images'] },
  { classType: 'CLIPVisionLoader', pack: 0, display: 'Load CLIP Vision', category: 'loaders', required: { clip_name: [['clip_vision_h.safetensors']] }, output: ['CLIP_VISION'] },
  { classType: 'LoadVideo', pack: 0, display: 'Load Video', category: 'image/video', required: { file: [['dance.mp4', 'walk.mp4']] }, output: ['VIDEO'] },
  { classType: 'GetVideoComponents', pack: 0, display: 'Get Video Components', category: 'image/video', required: { video: ['VIDEO'] }, output: ['IMAGE', 'AUDIO', 'FLOAT'], outputName: ['images', 'audio', 'fps'] },
  { classType: 'LoadAudio', pack: 0, display: 'Load Audio', category: 'audio', required: { audio: [['voice.wav', 'voice2.wav']] }, output: ['AUDIO'] },
  // FantasyTalking, UniAnimate, ReCamMaster and Ovi of the same pack (fantasytalking/, unianimate/, recammaster/, Ovi/).
  { classType: 'DownloadAndLoadWav2VecModel', pack: 2, display: '(Down)load Wav2Vec Model', category: 'WanVideoWrapper', required: { model: [['TencentGameMate/chinese-wav2vec2-base', 'facebook/wav2vec2-base-960h']], base_precision: [['fp32', 'bf16', 'fp16'], { default: 'fp16' }], load_device: [['main_device', 'offload_device'], { default: 'main_device' }] }, output: ['WAV2VECMODEL'], outputName: ['wav2vec_model'] },
  { classType: 'FantasyTalkingModelLoader', pack: 2, display: 'FantasyTalking Model Loader', category: 'WanVideoWrapper', required: { model: [names('diffusion_models')], base_precision: [['fp32', 'bf16', 'fp16'], { default: 'fp16' }] }, output: ['FANTASYTALKINGMODEL'], outputName: ['model'] },
  { classType: 'FantasyTalkingWav2VecEmbeds', pack: 2, display: 'FantasyTalking Wav2Vec Embeds', category: 'WanVideoWrapper', required: { wav2vec_model: ['WAV2VECMODEL'], fantasytalking_model: ['FANTASYTALKINGMODEL'], audio: ['AUDIO'], num_frames: ['INT', { default: 81, min: 1, max: 1000 }], fps: ['FLOAT', { default: 23, min: 1, max: 60, step: 0.1 }], audio_scale: ['FLOAT', { default: 1, min: 0, max: 100, step: 0.1 }], audio_cfg_scale: ['FLOAT', { default: 1, min: 0, max: 100, step: 0.1 }] }, output: ['FANTASYTALKING_EMBEDS'], outputName: ['fantasytalking_embeds'] },
  { classType: 'WanVideoUniAnimateDWPoseDetector', pack: 2, display: 'WanVideo UniAnimate DWPose Detector', category: 'WanVideoWrapper', required: { pose_images: ['IMAGE'], score_threshold: ['FLOAT', { default: 0.3, min: 0, max: 1, step: 0.01 }], stick_width: ['INT', { default: 4, min: 1, max: 100 }], draw_body: ['BOOLEAN', { default: true }], body_keypoint_size: ['INT', { default: 4, min: 0, max: 100 }], draw_feet: ['BOOLEAN', { default: true }], draw_hands: ['BOOLEAN', { default: true }], hand_keypoint_size: ['INT', { default: 4, min: 0, max: 100 }], colorspace: [['RGB', 'BGR']], handle_not_detected: [['empty', 'repeat'], { default: 'empty' }], draw_head: ['BOOLEAN', { default: true }] }, optional: { reference_pose_image: ['IMAGE'] }, output: ['IMAGE', 'IMAGE'], outputName: ['poses', 'reference_pose'] },
  { classType: 'WanVideoUniAnimatePoseInput', pack: 2, display: 'WanVideo UniAnimate Pose Input', category: 'WanVideoWrapper', required: { pose_images: ['IMAGE'], strength: ['FLOAT', { default: 1, min: 0, max: 1, step: 0.01 }], start_percent: ['FLOAT', { default: 0, min: 0, max: 1, step: 0.01 }], end_percent: ['FLOAT', { default: 1, min: 0, max: 1, step: 0.01 }] }, optional: { reference_pose_image: ['IMAGE'] }, output: ['UNIANIMATE_POSE'], outputName: ['unianimate_poses'] },
  { classType: 'WanVideoEncode', pack: 2, display: 'WanVideo Encode', category: 'WanVideoWrapper', required: { vae: ['WANVAE'], image: ['IMAGE'], enable_vae_tiling: ['BOOLEAN', { default: false }], tile_x: ['INT', { default: 272, min: 64, max: 2048 }], tile_y: ['INT', { default: 272, min: 64, max: 2048 }], tile_stride_x: ['INT', { default: 144, min: 32, max: 2048, step: 32 }], tile_stride_y: ['INT', { default: 128, min: 32, max: 2048, step: 32 }] }, optional: { noise_aug_strength: ['FLOAT', { default: 0, min: 0, max: 10, step: 0.001 }], latent_strength: ['FLOAT', { default: 1, min: 0, max: 10, step: 0.001 }], mask: ['MASK'] }, output: ['LATENT'], outputName: ['samples'] },
  { classType: 'WanVideoReCamMasterDefaultCamera', pack: 2, display: 'WanVideo ReCamMaster Default Camera', category: 'WanVideoWrapper', required: { camera_type: [['pan_right', 'pan_left', 'tilt_up', 'tilt_down', 'zoom_in', 'zoom_out', 'translate_up', 'translate_down', 'arc_left', 'arc_right'], { default: 'pan_right' }], latents: ['LATENT'] }, output: ['CAMERAPOSES'], outputName: ['camera_poses'] },
  { classType: 'WanVideoReCamMasterCameraEmbed', pack: 2, display: 'WanVideo ReCamMaster Camera Embed', category: 'WanVideoWrapper', required: { camera_poses: ['CAMERAPOSES'], latents: ['LATENT'] }, output: ['WANVIDIMAGE_EMBEDS', 'CAMERAPOSES'], outputName: ['camera_embeds', 'camera_poses'] },
  { classType: 'WanVideoExtraModelSelect', pack: 2, display: 'WanVideo Extra Model Select', category: 'WanVideoWrapper', required: { extra_model: [names('diffusion_models')] }, optional: { prev_model: ['VACEPATH'] }, output: ['VACEPATH'], outputName: ['extra_model'] },
  { classType: 'WanVideoOviCFG', pack: 2, display: 'WanVideo Ovi CFG', category: 'WanVideoWrapper', required: { original_text_embeds: ['WANVIDEOTEXTEMBEDS'], ovi_audio_cfg: ['FLOAT', { default: 3, min: 0, max: 100, step: 0.01 }] }, optional: { ovi_negative_text_embeds: ['WANVIDEOTEXTEMBEDS'] }, output: ['WANVIDEOTEXTEMBEDS'], outputName: ['text_embeds'] },
  { classType: 'WanVideoEmptyMMAudioLatents', pack: 2, display: 'WanVideo Empty MMAudio Latents', category: 'WanVideoWrapper', required: { length: ['INT', { default: 157, min: 1, max: 10000 }] }, output: ['LATENT'], outputName: ['samples'] },
  { classType: 'OviMMAudioVAELoader', pack: 2, display: 'Ovi MMAudio VAE Loader', category: 'WanVideoWrapper', required: { vae: [['mmaudio_vae_16k_fp32.safetensors', 'mmaudio_vocoder_bigvgan_best_netG_fp32.safetensors']], vocoder: [['mmaudio_vae_16k_fp32.safetensors', 'mmaudio_vocoder_bigvgan_best_netG_fp32.safetensors']], precision: [['bf16', 'fp16', 'fp32'], { default: 'bf16' }] }, output: ['MMAUDIOVAE'], outputName: ['mmaudio_vae'] },
  { classType: 'WanVideoDecodeOviAudio', pack: 2, display: 'WanVideo Decode Ovi Audio', category: 'WanVideoWrapper', required: { mmaudio_vae: ['MMAUDIOVAE'], samples: ['LATENT'] }, output: ['AUDIO'], outputName: ['audio'] },
  // The rest of a WanVideoWrapper video graph: the text reader and the two kinds of start.
  { classType: 'LoadWanVideoT5TextEncoder', pack: 2, display: 'WanVideo T5 Text Encoder Loader', category: 'WanVideoWrapper', required: { model_name: [names('text_encoders')], precision: [['fp32', 'bf16'], { default: 'bf16' }] }, output: ['WANTEXTENCODER'], outputName: ['wan_t5_model'] },
  { classType: 'WanVideoEmptyEmbeds', pack: 2, display: 'WanVideo Empty Embeds', category: 'WanVideoWrapper', required: { width: ['INT', { default: 832, min: 64, step: 8 }], height: ['INT', { default: 480, min: 64, step: 8 }], num_frames: ['INT', { default: 81, min: 1, step: 4 }] }, optional: { control_embeds: ['WANVIDIMAGE_EMBEDS'], extra_latents: ['LATENT'] }, output: ['WANVIDIMAGE_EMBEDS'], outputName: ['image_embeds'] },
  { classType: 'WanVideoImageToVideoEncode', pack: 2, display: 'WanVideo ImageToVideo Encode', category: 'WanVideoWrapper', required: { width: ['INT', { default: 832, min: 64, step: 8 }], height: ['INT', { default: 480, min: 64, step: 8 }], num_frames: ['INT', { default: 81, min: 1, step: 4 }], noise_aug_strength: ['FLOAT', { default: 0, min: 0, max: 10, step: 0.001 }], start_latent_strength: ['FLOAT', { default: 1, min: 0, max: 10, step: 0.001 }], end_latent_strength: ['FLOAT', { default: 1, min: 0, max: 10, step: 0.001 }] }, optional: { vae: ['WANVAE'], clip_embeds: ['WANVIDIMAGE_CLIPEMBEDS'], start_image: ['IMAGE'], end_image: ['IMAGE'] }, output: ['WANVIDIMAGE_EMBEDS'], outputName: ['image_embeds'] },
  { classType: 'EmptyHunyuanLatentVideo', pack: 0, display: 'Empty Hunyuan Video 1.0 Latent', category: 'latent/video', required: { width: ['INT', { default: 848, min: 16, step: 16 }], height: ['INT', { default: 480, min: 16, step: 16 }], length: ['INT', { default: 25, min: 1, step: 4 }], batch_size: ['INT', { default: 1, min: 1, max: 4096 }] }, output: ['LATENT'] },
  { classType: 'WanImageToVideo', pack: 0, display: 'WanImageToVideo', category: 'conditioning/video_models', required: { positive: ['CONDITIONING'], negative: ['CONDITIONING'], vae: ['VAE'], width: ['INT', { default: 832, min: 16, step: 16 }], height: ['INT', { default: 480, min: 16, step: 16 }], length: ['INT', { default: 81, min: 1, step: 4 }], batch_size: ['INT', { default: 1, min: 1, max: 4096 }] }, optional: { clip_vision_output: ['CLIP_VISION_OUTPUT'], start_image: ['IMAGE'] }, output: ['CONDITIONING', 'CONDITIONING', 'LATENT'], outputName: ['positive', 'negative', 'latent'] },
  { classType: 'CreateVideo', pack: 0, display: 'Create Video', category: 'image/video', required: { images: ['IMAGE'], fps: ['FLOAT', { default: 30, min: 1, max: 120, step: 1 }] }, optional: { audio: ['AUDIO'] }, output: ['VIDEO'] },
  { classType: 'SaveVideo', pack: 0, display: 'Save Video', category: 'image/video', required: { video: ['VIDEO'], filename_prefix: ['STRING', { default: 'video/ComfyUI' }], format: [['auto', 'mp4']], codec: [['auto', 'h264']] }, output: [], outputNode: true },
  // The lessons on picture model families (classes/image-models.ts).
  ...imageModelClassDefs((name) => PACKS.findIndex((pack) => pack.name === name)),
  // The lessons of src/shared/lessons/sets/video.ts.
  ...VIDEO_SET_CLASSES,
  // The lessons on picture techniques (classes/image-techniques.ts).
  ...imageTechniqueClassDefs((name) => PACKS.findIndex((pack) => pack.name === name), names),
  // The general-purpose nodes of the foundations lessons (tests/fixtures/mcp/classes/foundations.ts).
  ...FOUNDATIONS_CLASSES,
  // Sound, speech, 3D, faces and characters (classes/sound-3d-faces.ts), each in its pack.
  ...SOUND_3D_FACES_CLASSES.map((def) => ({ ...def, pack: Math.max(0, PACKS.findIndex((pack) => pack.name === def.pack)) })),
], CLASSES);

/** The /object_info document the native fixture serves. */
export function objectInfoDocument(classes: readonly ClassDef[] = CLASSES): Record<string, unknown> {
  const doc: Record<string, unknown> = {};
  for (const def of classes) {
    const input: Record<string, unknown> = {};
    const order: Record<string, string[]> = {};
    if (def.required) { input.required = def.required; order.required = Object.keys(def.required); }
    if (def.optional) { input.optional = def.optional; order.optional = Object.keys(def.optional); }
    doc[def.classType] = {
      input,
      input_order: order,
      output: def.output,
      output_is_list: def.output.map(() => false),
      output_name: def.outputName ?? def.output,
      name: def.classType,
      display_name: def.display,
      description: def.description ?? '',
      python_module: PACKS[def.pack].module,
      category: def.category,
      output_node: def.outputNode ?? false,
    };
  }
  return doc;
}

function classItems(classes: readonly ClassDef[]) {
  return classes.map((def) => ({
    class_type: def.classType,
    module: PACKS[def.pack].module,
    display_name: def.display,
    category: def.category,
    external_api: false,
    import_state: 'imported',
  }));
}

function packItems(classes: readonly ClassDef[]) {
  return PACKS.map((pack, index) => ({
    name: pack.name,
    installed_state: 'installed',
    import_state: 'imported',
    version: pack.version,
    commit: pack.commit,
    imported_class_count: classes.filter((def) => def.pack === index).length,
  }));
}

/**
 * Names that stretch a layout: Chinese, Japanese and Korean node titles and file names, and Latin names longer than
 * any English one, as a German pack writes them. Served with `wideNames`, so the screen walk sees real long names.
 */
export const WIDE_CLASSES: ClassDef[] = [
  { classType: 'WideCjkUpscale', pack: 1, display: '图像放大（高清修复）超分辨率模型加载器', category: '图像/放大', required: { image: ['IMAGE'], 强度: ['FLOAT', { default: 1, min: 0, max: 4, step: 0.1 }] }, output: ['IMAGE'], outputName: ['放大后的图像'], description: '使用模型放大图像。画像を拡大します。' },
  { classType: 'WideJapanesePrompt', pack: 1, display: 'プロンプトを読み込む（日本語の長い名前のノード）', category: 'テキスト', required: { text: ['STRING', { multiline: true }] }, output: ['STRING'] },
  { classType: 'WideKoreanLoader', pack: 1, display: '한국어 이름이 아주 긴 모델 불러오기 노드', category: '로더', required: { model_name: [['한국어_인물_사진_모델.safetensors']] }, output: ['MODEL'] },
  { classType: 'WideGermanLoader', pack: 1, display: 'Bildvergrößerungsmodellladeknoten mit Kantenschärfungsvoreinstellung', category: 'image/upscaling', required: { image: ['IMAGE'], Schärfungsstärke: ['FLOAT', { default: 0.5 }] }, output: ['IMAGE'] },
];

export const WIDE_MODELS: Array<{ category: string; filename: string; size: number }> = [
  { category: 'checkpoints', filename: '动漫风格_写实人像_第二版_最终.safetensors', size: 6_938_000_000 },
  { category: 'loras', filename: 'アニメ/かわいい背景モデル_最終版_高解像度.safetensors', size: 151_000_000 },
  { category: 'checkpoints', filename: '한국어_인물_사진_모델.safetensors', size: 2_132_000_000 },
  { category: 'loras', filename: 'Hochauflösende_Landschaftsfotografie_Spezialmodell_Version_Zwei_mit_Nebel.safetensors', size: 228_000_000 },
];

function modelItems(extraLoras = 0, wideNames = false) {
  const extra = Array.from({ length: extraLoras }, (_, index) => ({
    category: 'loras', filename: `extra_lora_${String(index).padStart(3, '0')}.safetensors`, size: 100_000_000,
  }));
  // That server lists every regular file of a folder: the models, and what a manager keeps next to them.
  const side = SIDE_FILES.map((file) => ({ category: file.category, filename: file.filename, size: file.bytes.length }));
  return [...MODELS, ...(wideNames ? WIDE_MODELS : []), ...extra, ...side].map((model) => ({
    category: model.category,
    filename: model.filename,
    root_path: `${MODEL_ROOT}/${model.category}`,
    size_bytes: model.size,
    status: 'present',
  }));
}

function page<T>(items: T[], args: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const requested = typeof args.limit === 'number' ? args.limit : 50;
  const limit = Math.max(1, Math.min(PAGE_CAP, requested));
  const start = typeof args.cursor === 'string' ? Number(args.cursor.replace(/^c/, '')) || 0 : 0;
  const slice = items.slice(start, start + limit);
  const next = start + limit < items.length ? `c${start + limit}` : null;
  return { items: slice, next_cursor: next, total: items.length, ...extra, ...(next ? {} : { complete: true }) };
}

const TOOL_DEFS = [...READ_TOOLS, ...WRITE_TOOLS].map((name) => ({
  name,
  description: `Fake ${name}`,
  inputSchema: { type: 'object', properties: {}, additionalProperties: true },
}));

function text(value: unknown, isError = false) {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }], isError };
}

function callTool(name: string, args: Record<string, unknown>, comfyUrl: string, extraLoras = 0, classes: readonly ClassDef[] = CLASSES, wideNames = false) {
  switch (name) {
    case 'studio_info':
      return text({
        installation_id: 'fake-installation-0001',
        comfyui_url: comfyUrl,
        comfyui_version: '0.3.68',
        mcp_version: 'fake-1',
        paths: { models: '/srv/comfyui/models' },
      });
    case 'studio_capabilities':
      if (args.section === 'nodes' && args.kind === 'packs') return text(page(packItems(classes), args));
      if (args.section === 'nodes') return text(page(classItems(classes), args));
      if (args.section === 'roots') {
        return text({
          section: 'roots',
          roots: {
            comfyui_root: '/srv/comfyui',
            custom_node_roots: [CUSTOM_NODE_ROOT],
            model_categories: { custom_nodes: { roots: [CUSTOM_NODE_ROOT] }, loras: { roots: [`${MODEL_ROOT}/loras`] } },
          },
        });
      }
      return text({ items: ['checkpoints', 'loras', 'vae', 'controlnet'].map((category) => ({ category, root_count: 1 })), next_cursor: null, total: 4 });
    case 'models': {
      if (args.action !== 'list') return text({ error: { code: 'FAKE_NOT_IMPLEMENTED' } }, true);
      const all = modelItems(extraLoras, wideNames);
      // Like the real server: the plain listing names categories only; files are listed one category at a time.
      if (typeof args.category !== 'string') {
        const categories = [...new Set(all.map((item) => item.category))];
        return text({ items: [{ category: '.cache' }, ...categories.map((category) => ({ category }))], total: categories.length + 1, complete: true });
      }
      return text(page(all.filter((item) => item.category === args.category), args, { coverage: 'filesystem_regular_files_symlinks_not_followed' }));
    }
    case 'model_metadata': {
      const key = `${String(args.category)}/${String(args.name)}`;
      const found = METADATA[key];
      return text(found ?? { embedded_metadata: {}, civitai_sidecar: null, model_explorer: 'unavailable' });
    }
    case 'comfy_api':
      // Exactly what that server answers for /object_info and even /system_stats (isError false).
      return text({ operation_id: 'op-fake-0001', state: 'outcome_unknown', error: { code: 'COMFY_API_BODY_CAPACITY' }, resubmit: false });
    case 'list_local_models':
      return text('## checkpoints (1)\n- juggernautXL_v9.safetensors\n');
    case 'workspace_files':
      // Only a read is answered. A write, a patch, a move or a trash is the write tool the tests fail on.
      if (args.action === 'read') return readWorkspaceFile(args);
      // The fingerprint of a model file: it reads the file and changes nothing.
      if (args.action === 'hash') return hashWorkspaceFile(args);
      return text({ error: { code: 'FAKE_WRITE_TOOL_CALLED' } }, true);
    default:
      // A write tool: the fake does nothing, but the call is recorded and the test fails on it.
      return text({ error: { code: 'FAKE_WRITE_TOOL_CALLED' } }, true);
  }
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function startComfyFixture(hits: string[], classes: readonly ClassDef[] = CLASSES): { server: http.Server } {
  const info = JSON.stringify(objectInfoDocument(classes));
  const server = http.createServer((req, res) => {
    hits.push(`${req.method} ${req.url}`);
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    if (req.url === '/system_stats') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ system: { comfyui_version: '0.3.68', os: 'posix' }, devices: [{ name: 'cuda:0 Example GPU A', type: 'cuda' }] }));
      return;
    }
    if (req.url === '/object_info') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(info);
      return;
    }
    res.writeHead(404); res.end();
  });
  return { server };
}

export interface FakeMcpOptions {
  token?: string;
  /** Extra LoRA files (extra_lora_000.safetensors …) on top of MODELS, for a catalog that needs many metadata batches. */
  extraLoras?: number;
  /** Serve ComfyUI's video nodes too (Empty video latent, WanImageToVideo, Create Video, Save Video). */
  video?: boolean;
  /** studio_info names a ComfyUI address where nothing listens (ComfyUI not running). */
  comfyDown?: boolean;
  /**
   * Lists and answers every tool under this prefix, like a gateway in front of the server does
   * (`gateway_comfy-` makes `gateway_comfy-models`). A call by the bare name is then an unknown tool.
   */
  toolPrefix?: string;
  /** Add node titles and file names in Chinese, Japanese, Korean and long German (WIDE_CLASSES, WIDE_MODELS). */
  wideNames?: boolean;
}

export async function startFakeMcp(options: FakeMcpOptions = {}): Promise<FakeMcp> {
  const calls: FakeMcpCall[] = [];
  const comfyHits: string[] = [];
  const classes = [...CLASSES, ...(options.video ? VIDEO_CLASSES : []), ...(options.wideNames ? WIDE_CLASSES : [])];
  const comfy = startComfyFixture(comfyHits, classes);
  const comfyPort = await listen(comfy.server);
  if (options.comfyDown) await new Promise<void>((resolve) => comfy.server.close(() => resolve()));
  const comfyUrl = `http://127.0.0.1:${comfyPort}`;
  let sessionCounter = 0;
  const sessions = new Set<string>();

  const server = http.createServer(async (req, res) => {
    const authorized = !options.token || req.headers.authorization === `Bearer ${options.token}`;
    const path = (req.url ?? '').split('?')[0];
    if (path !== '/mcp') { res.writeHead(404); res.end(); return; }
    if (!authorized) {
      calls.push({ method: `${req.method} (unauthorized)`, authorized: false });
      res.writeHead(401, {
        'content-type': 'application/json',
        'www-authenticate': `Bearer resource_metadata="http://127.0.0.1/.well-known/oauth-protected-resource/mcp"`,
      });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    if (req.method === 'GET') {
      // No server-initiated stream.
      calls.push({ method: 'GET', authorized });
      res.writeHead(405, { allow: 'POST, DELETE' }); res.end();
      return;
    }
    if (req.method === 'DELETE') {
      calls.push({ method: 'DELETE', authorized });
      const id = req.headers['mcp-session-id'];
      if (typeof id === 'string') sessions.delete(id);
      res.writeHead(200); res.end();
      return;
    }
    if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
    let message: { jsonrpc?: string; id?: string | number; method?: string; params?: Record<string, unknown> };
    try {
      message = JSON.parse(await readBody(req));
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
      return;
    }
    const method = message.method ?? '';
    const params = message.params ?? {};
    const record: FakeMcpCall = { method, authorized };
    if (method === 'tools/call') {
      record.tool = String(params.name);
      record.args = (params.arguments as Record<string, unknown>) ?? {};
    }
    calls.push(record);

    if (message.id === undefined) {
      // A notification (notifications/initialized and friends).
      res.writeHead(202); res.end();
      return;
    }
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    let result: unknown;
    if (method === 'initialize') {
      const asked = String(params.protocolVersion ?? '');
      const sessionId = `fake-session-${++sessionCounter}`;
      sessions.add(sessionId);
      headers['mcp-session-id'] = sessionId;
      result = {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'fake-home-comfyui', version: '0.0.1' },
      };
    } else {
      const id = req.headers['mcp-session-id'];
      if (typeof id !== 'string' || !sessions.has(id)) {
        res.writeHead(404, headers);
        res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32001, message: 'Session not found' } }));
        return;
      }
      const prefix = options.toolPrefix ?? '';
      if (method === 'tools/list') result = { tools: TOOL_DEFS.map((tool) => ({ ...tool, name: `${prefix}${tool.name}` })) };
      else if (method === 'tools/call') {
        const called = String(params.name);
        result = prefix && !called.startsWith(prefix)
          ? text({ error: { code: 'FAKE_UNKNOWN_TOOL', tool: called } }, true)
          : callTool(called.slice(prefix.length), record.args ?? {}, comfyUrl, options.extraLoras ?? 0, classes, options.wideNames === true);
      }
      else if (method === 'ping') result = {};
      else {
        res.writeHead(200, headers);
        res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } }));
        return;
      }
    }
    res.writeHead(200, headers);
    res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
  });
  const port = await listen(server);
  const close = () => Promise.all([server, comfy.server].map((s) => new Promise<void>((resolve) => {
    s.closeAllConnections?.();
    if (!s.listening) {
      resolve();
      return;
    }
    s.close(() => resolve());
  }))).then(() => undefined);
  return { url: `http://127.0.0.1:${port}/mcp`, comfyUrl, calls, comfyHits, close };
}
