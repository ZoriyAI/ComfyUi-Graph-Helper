/**
 * Lessons on what people do to a picture beyond a first text-to-image graph: a picture from a picture, inpainting,
 * outpainting, upscaling and a second pass, ControlNet, LoRA, a reference picture for style, editing by words, a
 * mask by text, removing a background; and, when the packs are installed, a depth map from comfyui_controlnet_aux,
 * IP-Adapter and a face detailer from the Impact Pack.
 *
 * Each graph follows an official ComfyUI template or the pack's own example workflow (named above each lesson).
 * Class, input and output names are ComfyUI's own (nodes.py and comfy_extras) or the pack's own. The words of the
 * lessons are in image-techniques.texts.en.ts and image-techniques.texts.ru.ts under the same lesson and step ids.
 */
import type { FieldSpec, FieldTest, Lesson, LinkSpec, RoleSpec } from '../engine';
import type { LessonGroup } from './image-models';
import { PACKS_GROUP } from './video';


const node = (role: string, ...classes: string[]): RoleSpec => ({ role, classes });
const link = (from: string, output: string, to: string, input: string, via?: string[]): LinkSpec => (via ? { from, output, to, input, via } : { from, output, to, input });
const field = (role: string, name: string, test: FieldTest): FieldSpec => ({ role, field: name, test });
const chosen: FieldTest = { kind: 'chosen' };
const equals = (value: string | number | boolean): FieldTest => ({ kind: 'equals', value });
const between = (min: number, max: number, prefer: number): FieldTest => ({ kind: 'between', min, max, prefer });

/** What may stand between a checkpoint's text reader and a text node: a LoRA loader, the choice of its last layer. */
const CLIP_VIA = ['LoraLoader', 'CLIPSetLastLayer'];
/** What may stand between a model and the node that uses it: LoRA loaders and the nodes that patch the model. */
const MODEL_VIA = [
  'LoraLoader', 'LoraLoaderModelOnly', 'DifferentialDiffusion', 'ModelSamplingAuraFlow', 'ModelSamplingFlux', 'CFGNorm',
  'IPAdapterUnifiedLoader', 'IPAdapter', 'IPAdapterAdvanced', 'IPAdapterStyleComposition',
];
/** What may stand between a description and a sampler: the nodes that add a hint, a mask, an area or a picture to it. */
const COND_VIA = [
  'ControlNetApplyAdvanced', 'InpaintModelConditioning', 'ConditioningCombine', 'ConditioningSetArea', 'ConditioningSetAreaPercentage',
  'ConditioningSetMask', 'StyleModelApply', 'FluxGuidance', 'ConditioningZeroOut', 'FluxKontextMultiReferenceLatentMethod',
];
/** What may stand between a loaded picture and the node that reads it: a change of size, a frame added around it. */
const IMAGE_VIA = ['ImageScale', 'ImageScaleBy', 'ImageScaleToTotalPixels', 'FluxKontextImageScale', 'ImageResizeKJ', 'ImageResizeKJv2', 'ImagePadForOutpaint'];
/** What may stand between a mask and the node that uses it: made wider, softer, turned inside out. */
const MASK_VIA = ['GrowMask', 'FeatherMask', 'InvertMask', 'ThresholdMask'];

/**
 * The graph of "A first picture from text" as far as a later lesson needs it: the loader, the two texts, the sampler,
 * the decoder and the saver. The way from a text to the sampler may pass through the nodes this group of lessons
 * adds (ControlNet, the inpainting node), and the blank is not named: a lesson may feed the sampler another latent.
 */
const pictureGraph = {
  roles: [
    node('checkpoint', 'CheckpointLoaderSimple'),
    node('positive', 'CLIPTextEncode'),
    node('negative', 'CLIPTextEncode'),
    node('sampler', 'KSampler'),
    node('decode', 'VAEDecode'),
    node('save', 'SaveImage', 'PreviewImage'),
  ],
  links: [
    link('checkpoint', 'CLIP', 'positive', 'clip', CLIP_VIA),
    link('checkpoint', 'CLIP', 'negative', 'clip', CLIP_VIA),
    link('checkpoint', 'MODEL', 'sampler', 'model', MODEL_VIA),
    link('positive', 'CONDITIONING', 'sampler', 'positive', COND_VIA),
    link('negative', 'CONDITIONING', 'sampler', 'negative', COND_VIA),
    link('sampler', 'LATENT', 'decode', 'samples'),
    link('checkpoint', 'VAE', 'decode', 'vae'),
    link('decode', 'IMAGE', 'save', 'images'),
  ],
};

/** Picture from a picture (official template image2image, docs: tutorials/basic/image-to-image). */
const img2img: Lesson = {
  id: 'img2img',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...pictureGraph },
    { id: 'picture', roles: [node('picture', 'LoadImage')], fields: [field('picture', 'image', chosen)] },
    {
      id: 'size',
      roles: [node('scale', 'ImageScaleToTotalPixels')],
      links: [link('picture', 'IMAGE', 'scale', 'image')],
      fields: [field('scale', 'megapixels', between(0.2, 2, 1))],
    },
    { id: 'encode', roles: [node('encode', 'VAEEncode')], links: [link('scale', 'IMAGE', 'encode', 'pixels'), link('checkpoint', 'VAE', 'encode', 'vae')] },
    { id: 'latent', links: [link('encode', 'LATENT', 'sampler', 'latent_image')] },
    { id: 'denoise', fields: [field('sampler', 'denoise', between(0.3, 0.9, 0.6))] },
    { id: 'compare', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * Inpainting with a mask drawn in ComfyUI's mask editor. The wiring of the inpainting node is the one of the
 * official templates flux_fill_inpaint_example and gsc_creator_2_2 (InpaintModelConditioning between the texts and
 * the sampler, its latent into the sampler); the loader and the picture are those of inpaint_example.
 */
const inpaint: Lesson = {
  id: 'inpaint',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', roles: [...pictureGraph.roles, node('picture', 'LoadImage')], links: pictureGraph.links },
    { id: 'mask', read: true },
    { id: 'model', read: true },
    {
      id: 'condition',
      roles: [node('inpaint', 'InpaintModelConditioning')],
      links: [
        link('positive', 'CONDITIONING', 'inpaint', 'positive', COND_VIA),
        link('negative', 'CONDITIONING', 'inpaint', 'negative', COND_VIA),
        link('checkpoint', 'VAE', 'inpaint', 'vae'),
        link('picture', 'IMAGE', 'inpaint', 'pixels', IMAGE_VIA),
        link('picture', 'MASK', 'inpaint', 'mask', MASK_VIA),
      ],
    },
    {
      id: 'wire',
      links: [
        link('inpaint', 'positive', 'sampler', 'positive', COND_VIA),
        link('inpaint', 'negative', 'sampler', 'negative', COND_VIA),
        link('inpaint', 'latent', 'sampler', 'latent_image'),
      ],
    },
    { id: 'denoise', fields: [field('sampler', 'denoise', between(0.5, 1, 1))] },
    { id: 'prompt', read: true },
    { id: 'edges', read: true },
    { id: 'run', read: true },
  ],
};

/** The inpainting graph as far as a lesson that goes on from it needs it. */
const inpaintGraph = {
  roles: [
    node('checkpoint', 'CheckpointLoaderSimple'),
    node('positive', 'CLIPTextEncode'),
    node('negative', 'CLIPTextEncode'),
    node('picture', 'LoadImage'),
    node('inpaint', 'InpaintModelConditioning'),
    node('sampler', 'KSampler'),
  ],
  links: [
    link('checkpoint', 'MODEL', 'sampler', 'model', MODEL_VIA),
    link('positive', 'CONDITIONING', 'inpaint', 'positive', COND_VIA),
    link('negative', 'CONDITIONING', 'inpaint', 'negative', COND_VIA),
    link('inpaint', 'positive', 'sampler', 'positive', COND_VIA),
    link('inpaint', 'latent', 'sampler', 'latent_image'),
  ],
};

/** Outpainting: the picture gets a frame to fill (official templates inpaint_model_outpainting, flux_fill_outpaint_example). */
const outpaint: Lesson = {
  id: 'outpaint',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...inpaintGraph },
    {
      id: 'pad',
      roles: [node('pad', 'ImagePadForOutpaint')],
      links: [link('picture', 'IMAGE', 'pad', 'image', IMAGE_VIA), link('pad', 'IMAGE', 'inpaint', 'pixels'), link('pad', 'MASK', 'inpaint', 'mask', MASK_VIA)],
      fields: [field('pad', 'right', between(64, 512, 256))],
    },
    { id: 'denoise', fields: [field('sampler', 'denoise', equals(1))] },
    { id: 'prompt', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * A mask by words: ComfyUI's own SAM3 finds what the text names and gives its mask to the inpainting node
 * (official template utility_image_segment_sam3: a checkpoint of SAM3, CLIP Text Encode, SAM3 Detect).
 */
const maskText: Lesson = {
  id: 'mask-text',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...inpaintGraph },
    { id: 'model', roles: [node('segModel', 'CheckpointLoaderSimple')], fields: [field('segModel', 'ckpt_name', { kind: 'differs', role: 'checkpoint', field: 'ckpt_name' })] },
    {
      id: 'detect',
      roles: [node('segText', 'CLIPTextEncode'), node('detect', 'SAM3_Detect')],
      links: [
        link('segModel', 'CLIP', 'segText', 'clip'),
        link('segModel', 'MODEL', 'detect', 'model'),
        link('picture', 'IMAGE', 'detect', 'image', IMAGE_VIA),
        link('segText', 'CONDITIONING', 'detect', 'conditioning'),
      ],
      fields: [field('segText', 'text', { kind: 'text', minChars: 3 })],
    },
    { id: 'threshold', fields: [field('detect', 'threshold', between(0.3, 0.7, 0.5))] },
    { id: 'use', links: [link('detect', 'masks', 'inpaint', 'mask', MASK_VIA)] },
    { id: 'click', read: true },
    { id: 'run', read: true },
  ],
};

/** Removing a background with ComfyUI's own nodes (official template utility_birefnet_remove_background). */
const removeBackground: Lesson = {
  id: 'remove-background',
  steps: [
    { id: 'intro', read: true },
    { id: 'picture', roles: [node('picture', 'LoadImage')], fields: [field('picture', 'image', chosen)] },
    { id: 'model', roles: [node('bgModel', 'LoadBackgroundRemovalModel')], fields: [field('bgModel', 'bg_removal_name', chosen)] },
    {
      id: 'remove',
      roles: [node('remove', 'RemoveBackground')],
      links: [link('bgModel', 'bg_model', 'remove', 'bg_removal_model'), link('picture', 'IMAGE', 'remove', 'image', IMAGE_VIA)],
    },
    { id: 'invert', roles: [node('invert', 'InvertMask')], links: [link('remove', 'mask', 'invert', 'mask')] },
    {
      id: 'join',
      roles: [node('join', 'JoinImageWithAlpha')],
      links: [link('picture', 'IMAGE', 'join', 'image', IMAGE_VIA), link('invert', 'MASK', 'join', 'alpha')],
    },
    { id: 'save', roles: [node('save', 'SaveImage')], links: [link('join', 'IMAGE', 'save', 'images')] },
    { id: 'other', read: true },
    { id: 'run', read: true },
  ],
};

/** Upscaling by a model (official templates esrgan_example; docs: tutorials/basic/upscale). */
const upscale: Lesson = {
  id: 'upscale',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...pictureGraph },
    { id: 'loader', roles: [node('upLoader', 'UpscaleModelLoader')], fields: [field('upLoader', 'model_name', chosen)] },
    {
      id: 'upscale',
      roles: [node('upscale', 'ImageUpscaleWithModel')],
      links: [link('upLoader', 'UPSCALE_MODEL', 'upscale', 'upscale_model'), link('decode', 'IMAGE', 'upscale', 'image')],
    },
    { id: 'save', roles: [node('big', 'SaveImage')], links: [link('upscale', 'IMAGE', 'big', 'images')] },
    { id: 'models', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * A second pass over the upscaled picture, the "hires fix" (official template hiresfix_esrgan_workflow: upscale model,
 * resize, VAE Encode, a second KSampler at denoise 0.5; the latent way is hiresfix_latent_workflow).
 */
const hiresFix: Lesson = {
  id: 'hires-fix',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'graph',
      roles: [...pictureGraph.roles, node('upLoader', 'UpscaleModelLoader'), node('upscale', 'ImageUpscaleWithModel')],
      links: [...pictureGraph.links, link('upLoader', 'UPSCALE_MODEL', 'upscale', 'upscale_model'), link('decode', 'IMAGE', 'upscale', 'image')],
    },
    { id: 'shrink', roles: [node('shrink', 'ImageScale')], links: [link('upscale', 'IMAGE', 'shrink', 'image')] },
    { id: 'encode', roles: [node('encodeB', 'VAEEncode')], links: [link('shrink', 'IMAGE', 'encodeB', 'pixels'), link('checkpoint', 'VAE', 'encodeB', 'vae')] },
    {
      id: 'second',
      roles: [node('samplerB', 'KSampler')],
      links: [
        link('checkpoint', 'MODEL', 'samplerB', 'model', MODEL_VIA),
        link('positive', 'CONDITIONING', 'samplerB', 'positive', COND_VIA),
        link('negative', 'CONDITIONING', 'samplerB', 'negative', COND_VIA),
        link('encodeB', 'LATENT', 'samplerB', 'latent_image'),
      ],
    },
    { id: 'denoise', fields: [field('samplerB', 'denoise', between(0.3, 0.6, 0.5))] },
    {
      id: 'out',
      roles: [node('decodeB', 'VAEDecode'), node('saveB', 'SaveImage', 'PreviewImage')],
      links: [link('samplerB', 'LATENT', 'decodeB', 'samples'), link('checkpoint', 'VAE', 'decodeB', 'vae'), link('decodeB', 'IMAGE', 'saveB', 'images')],
    },
    { id: 'latent', read: true },
    { id: 'tiles', read: true },
    { id: 'run', read: true },
  ],
};

/** ControlNet from edges (official template controlnet_example: Canny, Load ControlNet Model, Apply ControlNet). */
const controlnet: Lesson = {
  id: 'controlnet',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...pictureGraph },
    { id: 'loader', roles: [node('cnLoader', 'ControlNetLoader')], fields: [field('cnLoader', 'control_net_name', chosen)] },
    { id: 'control', roles: [node('control', 'LoadImage')], fields: [field('control', 'image', chosen)] },
    { id: 'edges', roles: [node('canny', 'Canny')], links: [link('control', 'IMAGE', 'canny', 'image', IMAGE_VIA)] },
    {
      id: 'apply',
      roles: [node('apply', 'ControlNetApplyAdvanced')],
      links: [
        link('positive', 'CONDITIONING', 'apply', 'positive', COND_VIA),
        link('negative', 'CONDITIONING', 'apply', 'negative', COND_VIA),
        link('cnLoader', 'CONTROL_NET', 'apply', 'control_net'),
        link('canny', 'IMAGE', 'apply', 'image'),
      ],
    },
    { id: 'wire', links: [link('apply', 'positive', 'sampler', 'positive', COND_VIA), link('apply', 'negative', 'sampler', 'negative', COND_VIA)] },
    { id: 'strength', fields: [field('apply', 'strength', between(0.3, 1, 1))] },
    { id: 'timing', read: true },
    { id: 'family', read: true },
    { id: 'run', read: true },
  ],
};

/** ControlNet from a depth map made by comfyui_controlnet_aux (official template gsc_creator_2_2; the pack's node). */
const controlnetDepth: Lesson = {
  id: 'controlnet-depth',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'graph',
      roles: [node('cnLoader', 'ControlNetLoader'), node('control', 'LoadImage'), node('apply', 'ControlNetApplyAdvanced'), node('sampler', 'KSampler')],
      links: [link('cnLoader', 'CONTROL_NET', 'apply', 'control_net'), link('apply', 'positive', 'sampler', 'positive', COND_VIA)],
    },
    {
      id: 'depth',
      roles: [node('depth', 'DepthAnythingV2Preprocessor')],
      links: [link('control', 'IMAGE', 'depth', 'image', IMAGE_VIA)],
      fields: [field('depth', 'resolution', between(768, 2048, 1024))],
    },
    { id: 'wire', links: [link('depth', 'IMAGE', 'apply', 'image')] },
    { id: 'model', read: true },
    { id: 'others', read: true },
    { id: 'run', read: true },
  ],
};

/** LoRA for pictures, two in a chain (official templates lora and lora_multiple; docs: tutorials/basic/multiple-loras). */
const loraImage: Lesson = {
  id: 'lora-image',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...pictureGraph },
    {
      id: 'first',
      roles: [node('lora1', 'LoraLoader')],
      links: [
        link('checkpoint', 'MODEL', 'lora1', 'model'),
        link('checkpoint', 'CLIP', 'lora1', 'clip', ['CLIPSetLastLayer']),
        link('lora1', 'MODEL', 'sampler', 'model', MODEL_VIA),
        link('lora1', 'CLIP', 'positive', 'clip', CLIP_VIA),
        link('lora1', 'CLIP', 'negative', 'clip', CLIP_VIA),
      ],
      fields: [field('lora1', 'lora_name', chosen)],
    },
    { id: 'strengths', fields: [field('lora1', 'strength_model', between(0.3, 0.9, 0.8))] },
    {
      id: 'second',
      roles: [node('lora2', 'LoraLoader')],
      links: [
        link('lora1', 'MODEL', 'lora2', 'model'),
        link('lora1', 'CLIP', 'lora2', 'clip'),
        link('lora2', 'MODEL', 'sampler', 'model', MODEL_VIA),
        link('lora2', 'CLIP', 'positive', 'clip', CLIP_VIA),
        link('lora2', 'CLIP', 'negative', 'clip', CLIP_VIA),
      ],
      fields: [field('lora2', 'lora_name', { kind: 'differs', role: 'lora1', field: 'lora_name' }), field('lora2', 'strength_model', between(0.3, 0.8, 0.6))],
    },
    { id: 'trigger', fields: [field('positive', 'text', { kind: 'has-trigger', of: [{ role: 'lora1', field: 'lora_name' }, { role: 'lora2', field: 'lora_name' }] })] },
    { id: 'family', read: true },
    { id: 'result', read: true },
  ],
};

/**
 * Editing a picture by words with Qwen-Image-Edit 2511 (official template image_qwen_image_edit_2511: UNETLoader,
 * CLIPLoader qwen_image, VAELoader, ModelSamplingAuraFlow 3.1, FluxKontextImageScale, two TextEncodeQwenImageEditPlus,
 * VAE Encode, KSampler 40 steps cfg 4 without the speed-up LoRA).
 */
const editWords: Lesson = {
  id: 'edit-words',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'models',
      roles: [node('model', 'UNETLoader'), node('clip', 'CLIPLoader'), node('vae', 'VAELoader')],
      fields: [field('model', 'unet_name', chosen), field('clip', 'clip_name', chosen), field('clip', 'type', equals('qwen_image')), field('vae', 'vae_name', chosen)],
    },
    {
      id: 'shift',
      roles: [node('shift', 'ModelSamplingAuraFlow')],
      links: [link('model', 'MODEL', 'shift', 'model', ['LoraLoaderModelOnly'])],
      fields: [field('shift', 'shift', between(2, 4, 3.1))],
    },
    {
      id: 'picture',
      roles: [node('picture', 'LoadImage'), node('scale', 'FluxKontextImageScale')],
      links: [link('picture', 'IMAGE', 'scale', 'image')],
      fields: [field('picture', 'image', chosen)],
    },
    {
      id: 'instruction',
      roles: [node('positive', 'TextEncodeQwenImageEditPlus')],
      links: [link('clip', 'CLIP', 'positive', 'clip'), link('vae', 'VAE', 'positive', 'vae'), link('scale', 'IMAGE', 'positive', 'image1')],
      fields: [field('positive', 'prompt', { kind: 'text', minChars: 5 })],
    },
    {
      id: 'negative',
      roles: [node('negative', 'TextEncodeQwenImageEditPlus')],
      links: [link('clip', 'CLIP', 'negative', 'clip'), link('vae', 'VAE', 'negative', 'vae'), link('scale', 'IMAGE', 'negative', 'image1')],
    },
    { id: 'encode', roles: [node('encode', 'VAEEncode')], links: [link('scale', 'IMAGE', 'encode', 'pixels'), link('vae', 'VAE', 'encode', 'vae')] },
    {
      id: 'sampler',
      roles: [node('sampler', 'KSampler')],
      links: [
        link('shift', 'MODEL', 'sampler', 'model', ['CFGNorm', 'LoraLoaderModelOnly']),
        link('positive', 'CONDITIONING', 'sampler', 'positive', COND_VIA),
        link('negative', 'CONDITIONING', 'sampler', 'negative', COND_VIA),
        link('encode', 'LATENT', 'sampler', 'latent_image'),
      ],
      fields: [field('sampler', 'steps', between(4, 50, 40)), field('sampler', 'cfg', between(1, 5, 4))],
    },
    {
      id: 'out',
      roles: [node('decode', 'VAEDecode'), node('save', 'SaveImage', 'PreviewImage')],
      links: [link('sampler', 'LATENT', 'decode', 'samples'), link('vae', 'VAE', 'decode', 'vae'), link('decode', 'IMAGE', 'save', 'images')],
    },
    { id: 'words', read: true },
    { id: 'fast', read: true },
    { id: 'families', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * A reference picture for style with Flux.1 Redux: the official Flux.1 dev graph (flux_dev_full_text_to_image:
 * UNETLoader, DualCLIPLoader flux, KSampler cfg 1, ConditioningZeroOut as the negative) with the Redux chain of the
 * official template flux_redux_model_example (CLIP Vision, CLIP Vision Encode, Load Style Model, Apply Style Model),
 * which says itself that it "can be used with any Flux1 dev or schnell model workflow".
 */
const styleReference: Lesson = {
  id: 'style-reference',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'models',
      roles: [node('model', 'UNETLoader'), node('clip', 'DualCLIPLoader'), node('vae', 'VAELoader')],
      fields: [
        field('model', 'unet_name', chosen),
        field('clip', 'clip_name1', chosen),
        field('clip', 'clip_name2', { kind: 'differs', role: 'clip', field: 'clip_name1' }),
        field('clip', 'type', equals('flux')),
        field('vae', 'vae_name', chosen),
      ],
    },
    {
      id: 'prompt',
      roles: [node('positive', 'CLIPTextEncode'), node('zero', 'ConditioningZeroOut')],
      links: [link('clip', 'CLIP', 'positive', 'clip'), link('positive', 'CONDITIONING', 'zero', 'conditioning')],
      fields: [field('positive', 'text', { kind: 'text', minChars: 3 })],
    },
    {
      id: 'reference',
      roles: [node('ref', 'LoadImage'), node('visionLoader', 'CLIPVisionLoader'), node('vision', 'CLIPVisionEncode')],
      links: [link('visionLoader', 'CLIP_VISION', 'vision', 'clip_vision'), link('ref', 'IMAGE', 'vision', 'image', IMAGE_VIA)],
      fields: [field('ref', 'image', chosen), field('visionLoader', 'clip_name', chosen)],
    },
    {
      id: 'style',
      roles: [node('styleLoader', 'StyleModelLoader'), node('style', 'StyleModelApply')],
      links: [
        link('positive', 'CONDITIONING', 'style', 'conditioning', ['FluxGuidance', 'StyleModelApply']),
        link('styleLoader', 'STYLE_MODEL', 'style', 'style_model'),
        link('vision', 'CLIP_VISION_OUTPUT', 'style', 'clip_vision_output'),
      ],
      fields: [field('styleLoader', 'style_model_name', chosen)],
    },
    {
      id: 'sampler',
      roles: [node('latent', 'EmptySD3LatentImage'), node('sampler', 'KSampler')],
      links: [
        link('model', 'MODEL', 'sampler', 'model', MODEL_VIA),
        link('style', 'CONDITIONING', 'sampler', 'positive', COND_VIA),
        link('zero', 'CONDITIONING', 'sampler', 'negative'),
        link('latent', 'LATENT', 'sampler', 'latent_image'),
      ],
      fields: [field('sampler', 'cfg', equals(1))],
    },
    {
      id: 'out',
      roles: [node('decode', 'VAEDecode'), node('save', 'SaveImage', 'PreviewImage')],
      links: [link('sampler', 'LATENT', 'decode', 'samples'), link('vae', 'VAE', 'decode', 'vae'), link('decode', 'IMAGE', 'save', 'images')],
    },
    { id: 'strength', read: true },
    { id: 'run', read: true },
  ],
};

/** IP-Adapter from ComfyUI_IPAdapter_plus (the pack's example examples/ipadapter_simple.json). */
const ipadapter: Lesson = {
  id: 'ipadapter',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...pictureGraph },
    { id: 'files', read: true },
    {
      id: 'loader',
      roles: [node('ipLoader', 'IPAdapterUnifiedLoader')],
      links: [link('checkpoint', 'MODEL', 'ipLoader', 'model', ['LoraLoader', 'LoraLoaderModelOnly'])],
      fields: [field('ipLoader', 'preset', equals('PLUS (high strength)'))],
    },
    { id: 'reference', roles: [node('ref', 'LoadImage')], fields: [field('ref', 'image', chosen)] },
    {
      id: 'apply',
      roles: [node('ip', 'IPAdapter')],
      links: [
        link('ipLoader', 'model', 'ip', 'model'),
        link('ipLoader', 'ipadapter', 'ip', 'ipadapter'),
        link('ref', 'IMAGE', 'ip', 'image', IMAGE_VIA),
        link('ip', 'MODEL', 'sampler', 'model', MODEL_VIA),
      ],
    },
    { id: 'weight', fields: [field('ip', 'weight', between(0.5, 0.9, 0.8)), field('ip', 'weight_type', equals('style transfer'))] },
    { id: 'tune', read: true },
    { id: 'run', read: true },
  ],
};

/** A face detailer from ComfyUI-Impact-Pack with a detector of ComfyUI-Impact-Subpack (the pack's example 1-FaceDetailer.json). */
const detailer: Lesson = {
  id: 'detailer',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...pictureGraph },
    { id: 'detector', roles: [node('detector', 'UltralyticsDetectorProvider')], fields: [field('detector', 'model_name', chosen)] },
    {
      id: 'detailer',
      roles: [node('detailer', 'FaceDetailer')],
      links: [
        link('decode', 'IMAGE', 'detailer', 'image'),
        link('checkpoint', 'MODEL', 'detailer', 'model', MODEL_VIA),
        link('checkpoint', 'CLIP', 'detailer', 'clip', CLIP_VIA),
        link('checkpoint', 'VAE', 'detailer', 'vae'),
        link('positive', 'CONDITIONING', 'detailer', 'positive', COND_VIA),
        link('negative', 'CONDITIONING', 'detailer', 'negative', COND_VIA),
        link('detector', 'BBOX_DETECTOR', 'detailer', 'bbox_detector'),
      ],
    },
    { id: 'settings', fields: [field('detailer', 'denoise', between(0.3, 0.6, 0.5))] },
    { id: 'save', roles: [node('fixed', 'SaveImage')], links: [link('detailer', 'image', 'fixed', 'images')] },
    { id: 'hands', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * LoRA for a character: the kinds of LoRA, a third one for the body or the clothes, how to see what each one does and
 * how to keep the face. The graph is the chain of the official template lora_multiple, one loader longer; the lesson
 * goes on from "LoRA for pictures" and is the ground the separate lesson on adult LoRAs stands on.
 */
const loraCharacter: Lesson = {
  id: 'lora-character',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'graph',
      roles: [...pictureGraph.roles, node('lora1', 'LoraLoader'), node('lora2', 'LoraLoader')],
      links: [
        ...pictureGraph.links,
        link('checkpoint', 'MODEL', 'lora1', 'model'),
        link('lora1', 'MODEL', 'lora2', 'model'),
        link('lora1', 'CLIP', 'lora2', 'clip'),
      ],
    },
    { id: 'kinds', read: true },
    { id: 'tell', read: true },
    {
      id: 'third',
      roles: [node('lora3', 'LoraLoader')],
      links: [
        link('lora2', 'MODEL', 'lora3', 'model'),
        link('lora2', 'CLIP', 'lora3', 'clip'),
        link('lora3', 'MODEL', 'sampler', 'model', MODEL_VIA),
        link('lora3', 'CLIP', 'positive', 'clip', CLIP_VIA),
        link('lora3', 'CLIP', 'negative', 'clip', CLIP_VIA),
      ],
      fields: [field('lora3', 'lora_name', { kind: 'differs', role: 'lora2', field: 'lora_name' })],
    },
    { id: 'strength', fields: [field('lora3', 'strength_model', between(0.2, 0.7, 0.5))] },
    { id: 'trigger', fields: [field('positive', 'text', { kind: 'has-trigger', of: [{ role: 'lora1', field: 'lora_name' }, { role: 'lora2', field: 'lora_name' }, { role: 'lora3', field: 'lora_name' }] })] },
    { id: 'compare', read: true },
    { id: 'order', read: true },
    { id: 'face', read: true },
    { id: 'pose', read: true },
    { id: 'family', read: true },
    { id: 'run', read: true },
  ],
};

/** In the order a person meets them. */
export const IMAGE_TECHNIQUE_LESSONS: readonly Lesson[] = [
  img2img, inpaint, outpaint, maskText, upscale, hiresFix, controlnet, loraImage, loraCharacter, editWords, styleReference, removeBackground,
  controlnetDepth, ipadapter, detailer,
];

/** Lessons that stand on the graph of another (the first one named is the one built before it). */
export const IMAGE_TECHNIQUE_AFTER: Readonly<Record<string, string[]>> = {
  img2img: ['image'],
  inpaint: ['img2img'],
  outpaint: ['inpaint'],
  'mask-text': ['inpaint'],
  upscale: ['image'],
  'hires-fix': ['upscale'],
  controlnet: ['image'],
  'controlnet-depth': ['controlnet'],
  'lora-image': ['image'],
  'lora-character': ['lora-image'],
  ipadapter: ['image'],
  detailer: ['image'],
};

/** The group of the lessons on picture techniques in the lesson list. */
export const IMAGE_TECHNIQUES_GROUP: LessonGroup = { id: 'image-techniques', title: { en: 'Pictures: techniques', ru: 'Картинки: приёмы' } };

/**
 * Where each lesson of the set stands on the learning path: its group (the lessons that need a pack join the shared
 * "Packs and tools" group of the video set) and the lessons it goes on from as knowledge.
 */
export const IMAGE_TECHNIQUE_PATH: Readonly<Record<string, { group: LessonGroup; follows: string[] }>> = {
  img2img: { group: IMAGE_TECHNIQUES_GROUP, follows: ['image'] },
  inpaint: { group: IMAGE_TECHNIQUES_GROUP, follows: ['img2img'] },
  outpaint: { group: IMAGE_TECHNIQUES_GROUP, follows: ['inpaint'] },
  'mask-text': { group: IMAGE_TECHNIQUES_GROUP, follows: ['inpaint'] },
  upscale: { group: IMAGE_TECHNIQUES_GROUP, follows: ['image'] },
  'hires-fix': { group: IMAGE_TECHNIQUES_GROUP, follows: ['upscale'] },
  controlnet: { group: IMAGE_TECHNIQUES_GROUP, follows: ['image'] },
  'lora-image': { group: IMAGE_TECHNIQUES_GROUP, follows: ['image'] },
  'lora-character': { group: IMAGE_TECHNIQUES_GROUP, follows: ['lora-image'] },
  'edit-words': { group: IMAGE_TECHNIQUES_GROUP, follows: ['qwen-image'] },
  'style-reference': { group: IMAGE_TECHNIQUES_GROUP, follows: ['flux'] },
  'remove-background': { group: IMAGE_TECHNIQUES_GROUP, follows: ['image'] },
  'controlnet-depth': { group: PACKS_GROUP, follows: ['controlnet'] },
  ipadapter: { group: PACKS_GROUP, follows: ['lora-image'] },
  detailer: { group: PACKS_GROUP, follows: ['image'] },
};

/** The node pack a class of these lessons comes from, when it is not ComfyUI itself. */
export function imageTechniquePack(classType: string): string | null {
  if (/^IPAdapter/.test(classType)) return 'ComfyUI_IPAdapter_plus';
  if (classType === 'UltralyticsDetectorProvider') return 'ComfyUI-Impact-Subpack';
  if (/^(?:FaceDetailer|SAMLoader|DetailerForEach|BboxDetector|SegmDetector)/.test(classType)) return 'ComfyUI-Impact-Pack';
  if (/Preprocessor$/.test(classType) || classType === 'AIO_Preprocessor') return 'comfyui_controlnet_aux';
  return null;
}
