import type { FieldSpec, FieldTest, Lesson, LinkSpec, RoleSpec } from '../engine';

/**
 * Lessons on the families of picture models and how each one is loaded: a checkpoint that holds everything
 * (SD 1.5, SDXL and the families trained further from it, SD 3.5) against separate files for the diffusion model,
 * the text encoder(s) and the VAE (Flux.1, Flux.2 Klein, Z-Image, Qwen-Image), a quantised GGUF model, and how
 * the sampler settings of a family are chosen.
 *
 * Every graph here is the graph of an official ComfyUI workflow template (or, for GGUF, of the pack's own
 * instructions), with the template's numbers; the comment over each lesson names its source. Classes, inputs and
 * outputs are ComfyUI's own (nodes.py, comfy_extras/nodes_flux.py, nodes_sd3.py, nodes_model_advanced.py,
 * nodes_custom_sampler.py) and ComfyUI-GGUF's (nodes.py).
 *
 * The number a step's text names is the `prefer` of its rule: "Do this for me" sets what the text says.
 */

const node = (role: string, ...classes: string[]): RoleSpec => ({ role, classes });
const link = (from: string, output: string, to: string, input: string, via?: string[]): LinkSpec => (via ? { from, output, to, input, via } : { from, output, to, input });
const field = (role: string, name: string, test: FieldTest): FieldSpec => ({ role, field: name, test });
const chosen: FieldTest = { kind: 'chosen' };
const equals = (value: string | number | boolean): FieldTest => ({ kind: 'equals', value });
const between = (min: number, max: number, prefer: number): FieldTest => ({ kind: 'between', min, max, prefer });
const text = (minChars: number, has?: string[]): FieldTest => (has ? { kind: 'text', minChars, has } : { kind: 'text', minChars });

/** What may stand between a diffusion model and its sampler: a LoRA, the shift of the family. */
const MODEL_VIA = ['LoraLoaderModelOnly', 'ModelSamplingAuraFlow', 'ModelSamplingFlux', 'ModelSamplingSD3'];
/** The same for a model out of a checkpoint, whose LoRA loader carries the text encoder along. */
const CHECKPOINT_VIA = ['LoraLoader', 'LoraLoaderModelOnly', 'ModelSamplingSD3'];
/** What may stand between a checkpoint's text encoder and a text: a LoRA loader, the choice of its last layer. */
const CLIP_VIA = ['LoraLoader', 'CLIPSetLastLayer'];
/** Flux's own guidance number sits between the description and the sampler. */
const GUIDANCE_VIA = ['FluxGuidance'];

/**
 * The picture graph of a checkpoint, named whole: the lessons that change its settings stand on it. The same
 * roles as the lesson "A first picture from text", so a canvas from that lesson counts.
 */
const checkpointGraph = {
  roles: [
    node('checkpoint', 'CheckpointLoaderSimple'),
    node('positive', 'CLIPTextEncode'),
    node('negative', 'CLIPTextEncode'),
    node('latent', 'EmptyLatentImage'),
    node('sampler', 'KSampler'),
    node('decode', 'VAEDecode'),
    node('save', 'SaveImage', 'PreviewImage'),
  ],
  links: [
    link('checkpoint', 'CLIP', 'positive', 'clip', CLIP_VIA),
    link('checkpoint', 'CLIP', 'negative', 'clip', CLIP_VIA),
    link('checkpoint', 'MODEL', 'sampler', 'model', CHECKPOINT_VIA),
    link('positive', 'CONDITIONING', 'sampler', 'positive'),
    link('negative', 'CONDITIONING', 'sampler', 'negative'),
    link('latent', 'LATENT', 'sampler', 'latent_image'),
    link('sampler', 'LATENT', 'decode', 'samples'),
    link('checkpoint', 'VAE', 'decode', 'vae'),
    link('decode', 'IMAGE', 'save', 'images'),
  ],
};

/** The end of every picture graph: unfold the result into pixels with the family's VAE, and save it. */
const pictureOut = (vae: string, output = 'VAE', sampler = 'sampler', samples = 'LATENT') => [
  { id: 'decode', roles: [node('decode', 'VAEDecode')], links: [link(sampler, samples, 'decode', 'samples'), link(vae, output, 'decode', 'vae')] },
  { id: 'save', roles: [node('save', 'SaveImage', 'PreviewImage')], links: [link('decode', 'IMAGE', 'save', 'images')] },
];

/**
 * Flux.1 from separate files. Source: templates flux_dev_full_text_to_image, flux_schnell_full_text_to_image and
 * flux1_krea_dev (UNETLoader, DualCLIPLoader type flux with clip_l and t5xxl, VAELoader ae.safetensors,
 * CLIPTextEncode, ConditioningZeroOut into negative, EmptySD3LatentImage 1024x1024, KSampler 20 steps, cfg 1,
 * euler, simple). FluxGuidance between the description and the sampler: flux_kontext_dev_basic and
 * flux_canny_model_example; 3.5 is ComfyUI's own default for Flux (comfy/model_base.py) and that of
 * flux_redux_model_example.
 */
const flux: Lesson = {
  id: 'flux',
  steps: [
    { id: 'intro', read: true },
    { id: 'files', read: true },
    { id: 'model', roles: [node('unet', 'UNETLoader')], fields: [field('unet', 'unet_name', chosen)] },
    {
      id: 'text-encoders',
      roles: [node('clip', 'DualCLIPLoader')],
      fields: [field('clip', 'clip_name1', chosen), field('clip', 'clip_name2', { kind: 'differs', role: 'clip', field: 'clip_name1' }), field('clip', 'type', equals('flux'))],
    },
    { id: 'vae', roles: [node('vae', 'VAELoader')], fields: [field('vae', 'vae_name', chosen)] },
    { id: 'prompt', roles: [node('positive', 'CLIPTextEncode')], links: [link('clip', 'CLIP', 'positive', 'clip')], fields: [field('positive', 'text', text(20))] },
    { id: 'negative', roles: [node('zero', 'ConditioningZeroOut')], links: [link('positive', 'CONDITIONING', 'zero', 'conditioning')] },
    { id: 'latent', roles: [node('latent', 'EmptySD3LatentImage')], fields: [field('latent', 'width', between(512, 2048, 1024)), field('latent', 'height', between(512, 2048, 1024))] },
    {
      id: 'sampler',
      roles: [node('sampler', 'KSampler')],
      links: [
        link('unet', 'MODEL', 'sampler', 'model', MODEL_VIA),
        link('positive', 'CONDITIONING', 'sampler', 'positive', GUIDANCE_VIA),
        link('zero', 'CONDITIONING', 'sampler', 'negative'),
        link('latent', 'LATENT', 'sampler', 'latent_image'),
      ],
    },
    {
      id: 'settings',
      fields: [
        field('sampler', 'steps', between(4, 30, 20)),
        field('sampler', 'cfg', equals(1)),
        field('sampler', 'sampler_name', equals('euler')),
        field('sampler', 'scheduler', equals('simple')),
      ],
    },
    {
      id: 'guidance',
      roles: [node('guidance', 'FluxGuidance')],
      links: [link('positive', 'CONDITIONING', 'guidance', 'conditioning'), link('guidance', 'CONDITIONING', 'sampler', 'positive')],
      fields: [field('guidance', 'guidance', between(1.5, 5, 3.5))],
    },
    ...pictureOut('vae'),
    { id: 'run', read: true },
  ],
};

/**
 * Z-Image Turbo, a distilled model: few steps and CFG 1. Source: template image_z_image_turbo (and its Int8 twin):
 * UNETLoader z_image_turbo_bf16, CLIPLoader qwen_3_4b type lumina2, VAELoader ae.safetensors,
 * ModelSamplingAuraFlow shift 3, CLIPTextEncode, ConditioningZeroOut into negative, EmptySD3LatentImage 1024x1024,
 * KSampler 8 steps, cfg 1, res_multistep, simple.
 */
const zimageTurbo: Lesson = {
  id: 'zimage-turbo',
  steps: [
    { id: 'intro', read: true },
    { id: 'files', read: true },
    { id: 'model', roles: [node('unet', 'UNETLoader')], fields: [field('unet', 'unet_name', chosen)] },
    { id: 'text-encoder', roles: [node('clip', 'CLIPLoader')], fields: [field('clip', 'clip_name', chosen), field('clip', 'type', equals('lumina2'))] },
    { id: 'vae', roles: [node('vae', 'VAELoader')], fields: [field('vae', 'vae_name', chosen)] },
    {
      id: 'shift',
      roles: [node('shift', 'ModelSamplingAuraFlow')],
      links: [link('unet', 'MODEL', 'shift', 'model', ['LoraLoaderModelOnly'])],
      fields: [field('shift', 'shift', between(2, 6, 3))],
    },
    { id: 'prompt', roles: [node('positive', 'CLIPTextEncode')], links: [link('clip', 'CLIP', 'positive', 'clip')], fields: [field('positive', 'text', text(20))] },
    { id: 'negative', roles: [node('zero', 'ConditioningZeroOut')], links: [link('positive', 'CONDITIONING', 'zero', 'conditioning')] },
    { id: 'latent', roles: [node('latent', 'EmptySD3LatentImage')], fields: [field('latent', 'width', between(512, 2048, 1024)), field('latent', 'height', between(512, 2048, 1024))] },
    {
      id: 'sampler',
      roles: [node('sampler', 'KSampler')],
      links: [
        link('shift', 'MODEL', 'sampler', 'model', ['LoraLoaderModelOnly']),
        link('positive', 'CONDITIONING', 'sampler', 'positive'),
        link('zero', 'CONDITIONING', 'sampler', 'negative'),
        link('latent', 'LATENT', 'sampler', 'latent_image'),
      ],
    },
    {
      id: 'settings',
      fields: [
        field('sampler', 'steps', between(4, 12, 8)),
        field('sampler', 'cfg', equals(1)),
        field('sampler', 'sampler_name', equals('res_multistep')),
        field('sampler', 'scheduler', equals('simple')),
      ],
    },
    ...pictureOut('vae'),
    { id: 'run', read: true },
  ],
};

/**
 * Qwen-Image, one large text encoder and a negative that works. Source: template image_qwen_image (UNETLoader
 * qwen_image, CLIPLoader qwen_2.5_vl_7b type qwen_image, VAELoader qwen_image_vae, ModelSamplingAuraFlow 3.1,
 * two CLIPTextEncode, EmptySD3LatentImage 1328x1328, KSampler euler simple; 20 steps and cfg 4 without the
 * Lightning LoRA, 8 steps and cfg 1 with it, the LoRA between the model and the shift); image_qwen_Image_2512.
 */
const qwenImage: Lesson = {
  id: 'qwen-image',
  steps: [
    { id: 'intro', read: true },
    { id: 'files', read: true },
    { id: 'model', roles: [node('unet', 'UNETLoader')], fields: [field('unet', 'unet_name', chosen)] },
    { id: 'text-encoder', roles: [node('clip', 'CLIPLoader')], fields: [field('clip', 'clip_name', chosen), field('clip', 'type', equals('qwen_image'))] },
    { id: 'vae', roles: [node('vae', 'VAELoader')], fields: [field('vae', 'vae_name', chosen)] },
    {
      id: 'shift',
      roles: [node('shift', 'ModelSamplingAuraFlow')],
      links: [link('unet', 'MODEL', 'shift', 'model', ['LoraLoaderModelOnly'])],
      fields: [field('shift', 'shift', between(2, 5, 3.1))],
    },
    {
      id: 'prompts',
      roles: [node('positive', 'CLIPTextEncode'), node('negative', 'CLIPTextEncode')],
      links: [link('clip', 'CLIP', 'positive', 'clip'), link('clip', 'CLIP', 'negative', 'clip')],
      fields: [field('positive', 'text', text(40))],
    },
    { id: 'latent', roles: [node('latent', 'EmptySD3LatentImage')], fields: [field('latent', 'width', between(1104, 1664, 1328)), field('latent', 'height', between(1104, 1664, 1328))] },
    {
      id: 'sampler',
      roles: [node('sampler', 'KSampler')],
      links: [
        link('shift', 'MODEL', 'sampler', 'model', ['LoraLoaderModelOnly']),
        link('positive', 'CONDITIONING', 'sampler', 'positive'),
        link('negative', 'CONDITIONING', 'sampler', 'negative'),
        link('latent', 'LATENT', 'sampler', 'latent_image'),
      ],
    },
    {
      id: 'settings',
      fields: [
        field('sampler', 'steps', between(15, 50, 20)),
        field('sampler', 'cfg', between(2.5, 5, 4)),
        field('sampler', 'sampler_name', equals('euler')),
        field('sampler', 'scheduler', equals('simple')),
      ],
    },
    ...pictureOut('vae'),
    { id: 'lightning', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * Flux.2 [Klein], built from the parts of an assembled sampler. Source: template image_flux2_klein_text_to_image,
 * its first subgraph (FLUX.2 Klein 4B base): UNETLoader flux-2-klein-base-4b, CLIPLoader qwen_3_4b type flux2,
 * VAELoader flux2-vae, two CLIPTextEncode into CFGGuider cfg 5, EmptyFlux2LatentImage 1024x1024, Flux2Scheduler
 * 20 steps with the same width and height, KSamplerSelect euler, RandomNoise, SamplerCustomAdvanced. The distilled
 * 4B in the same template: 4 steps, cfg 1, ConditioningZeroOut as the negative.
 */
const flux2Klein: Lesson = {
  id: 'flux2-klein',
  steps: [
    { id: 'intro', read: true },
    { id: 'files', read: true },
    { id: 'model', roles: [node('unet', 'UNETLoader')], fields: [field('unet', 'unet_name', chosen)] },
    { id: 'text-encoder', roles: [node('clip', 'CLIPLoader')], fields: [field('clip', 'clip_name', chosen), field('clip', 'type', equals('flux2'))] },
    { id: 'vae', roles: [node('vae', 'VAELoader')], fields: [field('vae', 'vae_name', chosen)] },
    {
      id: 'prompts',
      roles: [node('positive', 'CLIPTextEncode'), node('negative', 'CLIPTextEncode')],
      links: [link('clip', 'CLIP', 'positive', 'clip'), link('clip', 'CLIP', 'negative', 'clip')],
      fields: [field('positive', 'text', text(20))],
    },
    {
      id: 'guider',
      roles: [node('guider', 'CFGGuider')],
      links: [link('unet', 'MODEL', 'guider', 'model', ['LoraLoaderModelOnly']), link('positive', 'CONDITIONING', 'guider', 'positive'), link('negative', 'CONDITIONING', 'guider', 'negative')],
      fields: [field('guider', 'cfg', between(3, 6, 5))],
    },
    { id: 'latent', roles: [node('latent', 'EmptyFlux2LatentImage')], fields: [field('latent', 'width', between(512, 2048, 1024)), field('latent', 'height', between(512, 2048, 1024))] },
    {
      id: 'schedule',
      roles: [node('schedule', 'Flux2Scheduler')],
      fields: [
        field('schedule', 'steps', between(10, 50, 20)),
        field('schedule', 'width', { kind: 'same', role: 'latent', field: 'width' }),
        field('schedule', 'height', { kind: 'same', role: 'latent', field: 'height' }),
      ],
    },
    { id: 'method', roles: [node('method', 'KSamplerSelect'), node('noise', 'RandomNoise')], fields: [field('method', 'sampler_name', equals('euler'))] },
    {
      id: 'sampler',
      roles: [node('sampler', 'SamplerCustomAdvanced')],
      links: [
        link('noise', 'NOISE', 'sampler', 'noise'),
        link('guider', 'GUIDER', 'sampler', 'guider'),
        link('method', 'SAMPLER', 'sampler', 'sampler'),
        link('schedule', 'SIGMAS', 'sampler', 'sigmas'),
        link('latent', 'LATENT', 'sampler', 'latent_image'),
      ],
    },
    ...pictureOut('vae', 'VAE', 'sampler', 'output'),
    { id: 'distilled', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * A quantised diffusion model through ComfyUI-GGUF. Source: the pack's README ("use your own workflow and replace
 * the stock Load Diffusion Model with the Unet Loader (GGUF) node"; the files go to models/unet, and the loader also
 * lists models/diffusion_models, nodes.py) on the graph of the Flux.1 or Z-Image Turbo lesson.
 */
const gguf: Lesson = {
  id: 'gguf',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'graph',
      roles: [node('positive', 'CLIPTextEncode'), node('sampler', 'KSampler'), node('decode', 'VAEDecode'), node('save', 'SaveImage', 'PreviewImage')],
      links: [link('positive', 'CONDITIONING', 'sampler', 'positive', GUIDANCE_VIA), link('sampler', 'LATENT', 'decode', 'samples'), link('decode', 'IMAGE', 'save', 'images')],
    },
    { id: 'quants', read: true },
    {
      id: 'loader',
      roles: [node('gguf', 'UnetLoaderGGUF', 'UnetLoaderGGUFAdvanced')],
      links: [link('gguf', 'MODEL', 'sampler', 'model', MODEL_VIA)],
      fields: [field('gguf', 'unet_name', chosen)],
    },
    { id: 'old-loader', read: true },
    { id: 'encoder', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * SDXL with its own size and settings. Source: template image_sdxl_simple (CheckpointLoaderSimple
 * sd_xl_base_1.0, EmptyLatentImage 1024x1024, KSampler 25 steps, cfg 7, dpmpp_2m, karras, a negative text); the
 * refiner: sdxl_simple_example and sdxl_refiner_prompt_example.
 */
const sdxl: Lesson = {
  id: 'sdxl',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...checkpointGraph },
    { id: 'model', fields: [field('checkpoint', 'ckpt_name', chosen)] },
    { id: 'size', fields: [field('latent', 'width', between(640, 1536, 1024)), field('latent', 'height', between(640, 1536, 1024))] },
    {
      id: 'settings',
      fields: [
        field('sampler', 'steps', between(20, 40, 25)),
        field('sampler', 'cfg', between(4, 9, 7)),
        field('sampler', 'sampler_name', equals('dpmpp_2m')),
        field('sampler', 'scheduler', equals('karras')),
      ],
    },
    { id: 'texts', fields: [field('positive', 'text', text(20)), field('negative', 'text', text(5))] },
    { id: 'two-fields', read: true },
    { id: 'refiner', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * Pony and Illustrious / NoobAI: SDXL trained further on tags. Loaded like SDXL (template image_sdxl_simple); what
 * changes is knowledge: tags, the quality words of the model's page, a portrait size from the SDXL list, and
 * "clip skip", which ComfyUI's SDXL text encoder already applies (comfy/sdxl_clip.py reads the second-to-last
 * layer of both CLIP models).
 */
const tags: Lesson = {
  id: 'tags',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...checkpointGraph },
    { id: 'model', fields: [field('checkpoint', 'ckpt_name', chosen)] },
    { id: 'quality', read: true },
    { id: 'tags', fields: [field('positive', 'text', text(30, [',']))] },
    { id: 'negative', fields: [field('negative', 'text', text(15, [',']))] },
    { id: 'size', fields: [field('latent', 'width', between(768, 896, 832)), field('latent', 'height', between(1152, 1344, 1216))] },
    {
      id: 'settings',
      fields: [field('sampler', 'steps', between(20, 35, 28)), field('sampler', 'cfg', between(4, 7.5, 6)), field('sampler', 'sampler_name', equals('euler_ancestral'))],
    },
    { id: 'clip-skip', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * Which loader takes which file. Each loader lists only its own folder (folder_paths.py: checkpoints;
 * diffusion_models with unet; text_encoders with clip; vae), so a file that is missing from a list lies in another
 * folder or is another kind of file. The four loaders are the ones of the templates above.
 */
const loaders: Lesson = {
  id: 'loaders',
  steps: [
    { id: 'intro', read: true },
    { id: 'checkpoint', roles: [node('checkpoint', 'CheckpointLoaderSimple')], fields: [field('checkpoint', 'ckpt_name', chosen)] },
    { id: 'diffusion', roles: [node('unet', 'UNETLoader')], fields: [field('unet', 'unet_name', chosen)] },
    { id: 'encoder', roles: [node('clip', 'CLIPLoader')], fields: [field('clip', 'clip_name', chosen), field('clip', 'type', chosen)] },
    { id: 'vae', roles: [node('vae', 'VAELoader')], fields: [field('vae', 'vae_name', chosen)] },
    { id: 'tell', read: true },
    { id: 'others', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * Choosing a sampler and a scheduler: two samplers on one model, one description and one blank, with the same seed,
 * steps, cfg and scheduler and another sampling method, side by side. Each branch is the graph of the first picture
 * (template default.json, archived; image_sdxl_simple).
 */
const samplers: Lesson = {
  id: 'samplers',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...checkpointGraph },
    {
      id: 'second',
      roles: [node('samplerB', 'KSampler')],
      links: [
        link('checkpoint', 'MODEL', 'samplerB', 'model', CHECKPOINT_VIA),
        link('positive', 'CONDITIONING', 'samplerB', 'positive'),
        link('negative', 'CONDITIONING', 'samplerB', 'negative'),
        link('latent', 'LATENT', 'samplerB', 'latent_image'),
      ],
    },
    {
      id: 'same',
      fields: [
        field('samplerB', 'seed', { kind: 'same', role: 'sampler', field: 'seed' }),
        field('samplerB', 'steps', { kind: 'same', role: 'sampler', field: 'steps' }),
        field('samplerB', 'cfg', { kind: 'same', role: 'sampler', field: 'cfg' }),
        field('samplerB', 'scheduler', { kind: 'same', role: 'sampler', field: 'scheduler' }),
      ],
    },
    { id: 'other', fields: [field('samplerB', 'sampler_name', { kind: 'differs', role: 'sampler', field: 'sampler_name' })] },
    {
      id: 'out',
      roles: [node('decodeB', 'VAEDecode'), node('saveB', 'PreviewImage', 'SaveImage')],
      links: [link('samplerB', 'LATENT', 'decodeB', 'samples'), link('checkpoint', 'VAE', 'decodeB', 'vae'), link('decodeB', 'IMAGE', 'saveB', 'images')],
    },
    { id: 'fixed', read: true },
    { id: 'schedulers', read: true },
    { id: 'guide', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * SD 3.5 from one checkpoint. Source: template sd3.5_simple_example (CheckpointLoaderSimple
 * sd3.5_large_fp8_scaled, which holds the three text encoders and the VAE; two CLIPTextEncode, EmptySD3LatentImage
 * 1024x1024, KSampler 20 steps, cfg 4, euler, sgm_uniform).
 */
const sd35: Lesson = {
  id: 'sd35',
  steps: [
    { id: 'intro', read: true },
    { id: 'files', read: true },
    { id: 'model', roles: [node('checkpoint', 'CheckpointLoaderSimple')], fields: [field('checkpoint', 'ckpt_name', chosen)] },
    {
      id: 'prompts',
      roles: [node('positive', 'CLIPTextEncode'), node('negative', 'CLIPTextEncode')],
      links: [link('checkpoint', 'CLIP', 'positive', 'clip', CLIP_VIA), link('checkpoint', 'CLIP', 'negative', 'clip', CLIP_VIA)],
      fields: [field('positive', 'text', text(20))],
    },
    { id: 'latent', roles: [node('latent', 'EmptySD3LatentImage')], fields: [field('latent', 'width', between(512, 1536, 1024)), field('latent', 'height', between(512, 1536, 1024))] },
    {
      id: 'sampler',
      roles: [node('sampler', 'KSampler')],
      links: [
        link('checkpoint', 'MODEL', 'sampler', 'model', CHECKPOINT_VIA),
        link('positive', 'CONDITIONING', 'sampler', 'positive'),
        link('negative', 'CONDITIONING', 'sampler', 'negative'),
        link('latent', 'LATENT', 'sampler', 'latent_image'),
      ],
    },
    {
      id: 'settings',
      fields: [
        field('sampler', 'steps', between(20, 40, 20)),
        field('sampler', 'cfg', between(3, 5.5, 4)),
        field('sampler', 'sampler_name', equals('euler')),
        field('sampler', 'scheduler', equals('sgm_uniform')),
      ],
    },
    ...pictureOut('checkpoint'),
    { id: 'shift', read: true },
    { id: 'run', read: true },
  ],
};

/** In the order a person meets them: the classic checkpoint first, then the separate files, then the tools. */
export const IMAGE_MODEL_LESSONS: readonly Lesson[] = [sdxl, tags, samplers, loaders, flux, zimageTurbo, qwenImage, flux2Klein, sd35, gguf];

/** Lessons of this set that stand on the graph of another. */
export const IMAGE_MODEL_AFTER: Readonly<Record<string, string[]>> = {
  sdxl: ['image'],
  tags: ['sdxl'],
  samplers: ['image'],
  gguf: ['flux', 'zimage-turbo'],
};

/** A group of the lesson list: its id and its title in both languages. */
export interface LessonGroup {
  id: string;
  title: { ru: string; en: string };
}

export const IMAGE_MODELS_GROUP: LessonGroup = { id: 'images-models', title: { ru: 'Картинки: модели', en: 'Pictures: models' } };

/**
 * Where each lesson of the set stands on the learning path: its group, and the lessons it goes on from (as
 * knowledge; the graph it stands on, if any, is IMAGE_MODEL_AFTER).
 */
export const IMAGE_MODEL_PATH: Readonly<Record<string, { group: LessonGroup; follows: string[] }>> = {
  sdxl: { group: IMAGE_MODELS_GROUP, follows: ['image'] },
  tags: { group: IMAGE_MODELS_GROUP, follows: ['sdxl', 'prompt'] },
  samplers: { group: IMAGE_MODELS_GROUP, follows: ['image'] },
  loaders: { group: IMAGE_MODELS_GROUP, follows: ['image'] },
  flux: { group: IMAGE_MODELS_GROUP, follows: ['loaders'] },
  'zimage-turbo': { group: IMAGE_MODELS_GROUP, follows: ['loaders'] },
  'qwen-image': { group: IMAGE_MODELS_GROUP, follows: ['zimage-turbo'] },
  'flux2-klein': { group: IMAGE_MODELS_GROUP, follows: ['flux'] },
  sd35: { group: IMAGE_MODELS_GROUP, follows: ['sdxl'] },
  gguf: { group: IMAGE_MODELS_GROUP, follows: ['flux', 'zimage-turbo'] },
};
