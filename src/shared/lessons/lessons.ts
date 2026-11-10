import type { FieldSpec, FieldTest, Lesson, LinkSpec, RoleSpec } from './engine';

/**
 * The lessons, as what must be on the canvas after each step. The words of a lesson (what to do and why) are in
 * texts.ru.ts and texts.en.ts under the same lesson and step ids; a test holds the two together.
 *
 * Classes, inputs and outputs are ComfyUI's own (nodes.py and comfy_extras): the loaders, CLIP Text Encode, the
 * samplers, VAE Decode, and for video the Wan nodes and Create Video / Save Video. A lesson is offered only when
 * the person's ComfyUI has every class it names with the inputs it names (engine.ts lessonGaps), so a ComfyUI
 * where a node is built differently gets "this lesson does not fit" instead of wrong instructions.
 *
 * Video follows the two-pass Wan 2.2 graph: a high-noise model lays out the motion in the first sampler, a
 * low-noise model finishes the detail in the second. Numbers are the ones ComfyUI's own Wan 2.2 templates use.
 */

const node = (role: string, ...classes: string[]): RoleSpec => ({ role, classes });
const link = (from: string, output: string, to: string, input: string, via?: string[]): LinkSpec => (via ? { from, output, to, input, via } : { from, output, to, input });
const field = (role: string, name: string, test: FieldTest): FieldSpec => ({ role, field: name, test });
const chosen: FieldTest = { kind: 'chosen' };
const equals = (value: string | number | boolean): FieldTest => ({ kind: 'equals', value });
const between = (min: number, max: number): FieldTest => ({ kind: 'between', min, max });

/** A LoRA loader on the way from a model to where the model is used does not break the way. */
const LORA = ['LoraLoaderModelOnly'];
/** The same for a model that comes out of a checkpoint: its LoRA loader may carry the text reader along. */
const LORA_ANY = ['LoraLoader', 'LoraLoaderModelOnly'];
/** What may stand between a checkpoint's text reader and a text: a LoRA loader, the choice of its last layer. */
const CLIP_VIA = ['LoraLoader', 'CLIPSetLastLayer'];

const image: Lesson = {
  id: 'image',
  steps: [
    { id: 'intro', read: true },
    { id: 'model', roles: [node('checkpoint', 'CheckpointLoaderSimple')], fields: [field('checkpoint', 'ckpt_name', chosen)] },
    { id: 'prompts', roles: [node('positive', 'CLIPTextEncode'), node('negative', 'CLIPTextEncode')] },
    { id: 'prompts-clip', links: [link('checkpoint', 'CLIP', 'positive', 'clip', CLIP_VIA), link('checkpoint', 'CLIP', 'negative', 'clip', CLIP_VIA)] },
    { id: 'prompt-text', fields: [field('positive', 'text', { kind: 'text', minChars: 3 })] },
    { id: 'latent', roles: [node('latent', 'EmptyLatentImage')] },
    { id: 'sampler', roles: [node('sampler', 'KSampler')] },
    {
      id: 'sampler-links',
      links: [
        link('checkpoint', 'MODEL', 'sampler', 'model', LORA_ANY),
        link('positive', 'CONDITIONING', 'sampler', 'positive'),
        link('negative', 'CONDITIONING', 'sampler', 'negative'),
        link('latent', 'LATENT', 'sampler', 'latent_image'),
      ],
    },
    { id: 'decode', roles: [node('decode', 'VAEDecode')], links: [link('sampler', 'LATENT', 'decode', 'samples'), link('checkpoint', 'VAE', 'decode', 'vae')] },
    { id: 'save', roles: [node('save', 'SaveImage')], links: [link('decode', 'IMAGE', 'save', 'images')] },
    { id: 'run', read: true },
  ],
};

/**
 * How a description is read and steered. The knowledge is in the steps that explain; the steps to do are short
 * and stand right after what they practise, so a graph that already holds them skips the doing, never the reading.
 */
const prompt: Lesson = {
  id: 'prompt',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'graph',
      roles: [node('positive', 'CLIPTextEncode'), node('negative', 'CLIPTextEncode'), node('sampler', 'KSampler')],
      links: [link('positive', 'CONDITIONING', 'sampler', 'positive'), link('negative', 'CONDITIONING', 'sampler', 'negative')],
    },
    { id: 'readers', read: true },
    { id: 'order', read: true },
    { id: 'write', fields: [field('positive', 'text', { kind: 'text', minChars: 40 })] },
    { id: 'weights', read: true },
    { id: 'weigh', fields: [field('positive', 'text', { kind: 'weighted', min: 0.5, max: 1.5 })] },
    { id: 'negative', read: true },
    { id: 'negative-text', fields: [field('negative', 'text', { kind: 'text', minChars: 5 })] },
    { id: 'cfg', read: true },
    { id: 'seed', read: true },
    { id: 'problems', read: true },
    { id: 'check', read: true },
  ],
};

/**
 * A second model redraws the picture of the first. The first pass is named whole, its saver included, so that
 * every node the second pass needs is a new one: what is already wired stays as it is.
 */
const refine: Lesson = {
  id: 'refine',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'graph',
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
        link('checkpoint', 'MODEL', 'sampler', 'model', LORA_ANY),
        link('positive', 'CONDITIONING', 'sampler', 'positive'),
        link('negative', 'CONDITIONING', 'sampler', 'negative'),
        link('sampler', 'LATENT', 'decode', 'samples'),
        link('decode', 'IMAGE', 'save', 'images'),
      ],
    },
    {
      id: 'second-model',
      roles: [node('checkpointB', 'CheckpointLoaderSimple')],
      fields: [field('checkpointB', 'ckpt_name', { kind: 'differs', role: 'checkpoint', field: 'ckpt_name' })],
    },
    {
      id: 'second-texts',
      roles: [node('positiveB', 'CLIPTextEncode'), node('negativeB', 'CLIPTextEncode')],
      links: [link('checkpointB', 'CLIP', 'positiveB', 'clip', CLIP_VIA), link('checkpointB', 'CLIP', 'negativeB', 'clip', CLIP_VIA)],
      fields: [field('positiveB', 'text', { kind: 'text', minChars: 3 })],
    },
    { id: 'encode', roles: [node('encode', 'VAEEncode')], links: [link('decode', 'IMAGE', 'encode', 'pixels'), link('checkpointB', 'VAE', 'encode', 'vae')] },
    {
      id: 'second-sampler',
      roles: [node('samplerB', 'KSampler')],
      links: [
        link('checkpointB', 'MODEL', 'samplerB', 'model', LORA_ANY),
        link('positiveB', 'CONDITIONING', 'samplerB', 'positive'),
        link('negativeB', 'CONDITIONING', 'samplerB', 'negative'),
        link('encode', 'LATENT', 'samplerB', 'latent_image'),
      ],
    },
    { id: 'denoise', fields: [field('samplerB', 'denoise', between(0.2, 0.5))] },
    {
      id: 'out',
      roles: [node('decodeB', 'VAEDecode'), node('saveB', 'SaveImage', 'PreviewImage')],
      links: [link('samplerB', 'LATENT', 'decodeB', 'samples'), link('checkpointB', 'VAE', 'decodeB', 'vae'), link('decodeB', 'IMAGE', 'saveB', 'images')],
    },
    { id: 'same-family', read: true },
    { id: 'loras', read: true },
    { id: 'run', read: true },
  ],
};

/** The loaders of a two-pass Wan graph: two diffusion models, the text encoder, the VAE. */
const videoModels = [
  {
    id: 'models',
    roles: [node('high', 'UNETLoader'), node('low', 'UNETLoader')],
    fields: [field('high', 'unet_name', chosen), field('low', 'unet_name', { kind: 'differs', role: 'high', field: 'unet_name' })],
  },
  { id: 'text-encoder', roles: [node('clip', 'CLIPLoader')], fields: [field('clip', 'clip_name', chosen), field('clip', 'type', equals('wan'))] },
  { id: 'vae', roles: [node('vae', 'VAELoader')], fields: [field('vae', 'vae_name', chosen)] },
  {
    id: 'prompts',
    roles: [node('positive', 'CLIPTextEncode'), node('negative', 'CLIPTextEncode')],
    links: [link('clip', 'CLIP', 'positive', 'clip'), link('clip', 'CLIP', 'negative', 'clip')],
    fields: [field('positive', 'text', { kind: 'text', minChars: 3 })],
  },
  {
    id: 'shift',
    roles: [node('shiftHigh', 'ModelSamplingSD3'), node('shiftLow', 'ModelSamplingSD3')],
    links: [link('high', 'MODEL', 'shiftHigh', 'model', LORA), link('low', 'MODEL', 'shiftLow', 'model', LORA)],
    fields: [field('shiftHigh', 'shift', between(5, 8)), field('shiftLow', 'shift', between(5, 8))],
  },
];

/**
 * The settings that split the work between the two samplers: the first adds the noise and stops part way, handing
 * over what noise is left; the second adds none and goes on from the very step the first stopped at.
 */
const twoPassSettings = [
  {
    id: 'first-settings',
    fields: [
      field('first', 'add_noise', equals('enable')),
      field('first', 'cfg', between(1, 4)),
      field('first', 'start_at_step', equals(0)),
      field('first', 'end_at_step', between(1, 15)),
      field('first', 'return_with_leftover_noise', equals('enable')),
    ],
  },
  {
    id: 'second-settings',
    fields: [
      field('second', 'add_noise', equals('disable')),
      field('second', 'steps', { kind: 'same', role: 'first', field: 'steps' }),
      field('second', 'cfg', between(1, 4)),
      field('second', 'start_at_step', { kind: 'same', role: 'first', field: 'end_at_step' }),
      field('second', 'return_with_leftover_noise', equals('disable')),
    ],
  },
];

const videoOut = [
  { id: 'decode', roles: [node('decode', 'VAEDecode')], links: [link('second', 'LATENT', 'decode', 'samples'), link('vae', 'VAE', 'decode', 'vae')] },
  {
    id: 'save',
    roles: [node('video', 'CreateVideo'), node('save', 'SaveVideo')],
    links: [link('decode', 'IMAGE', 'video', 'images'), link('video', 'VIDEO', 'save', 'video')],
    fields: [field('video', 'fps', equals(16))],
  },
];

const videoText: Lesson = {
  id: 'video-text',
  steps: [
    { id: 'intro', read: true },
    ...videoModels,
    { id: 'latent', roles: [node('latent', 'EmptyHunyuanLatentVideo')], fields: [field('latent', 'length', between(49, 121))] },
    {
      id: 'first-pass',
      roles: [node('first', 'KSamplerAdvanced')],
      links: [
        link('shiftHigh', 'MODEL', 'first', 'model', LORA),
        link('positive', 'CONDITIONING', 'first', 'positive'),
        link('negative', 'CONDITIONING', 'first', 'negative'),
        link('latent', 'LATENT', 'first', 'latent_image'),
      ],
    },
    {
      id: 'second-pass',
      roles: [node('second', 'KSamplerAdvanced')],
      links: [
        link('shiftLow', 'MODEL', 'second', 'model', LORA),
        link('positive', 'CONDITIONING', 'second', 'positive'),
        link('negative', 'CONDITIONING', 'second', 'negative'),
        link('first', 'LATENT', 'second', 'latent_image'),
      ],
    },
    ...twoPassSettings,
    ...videoOut,
    { id: 'run', read: true },
  ],
};

const videoImage: Lesson = {
  id: 'video-image',
  steps: [
    { id: 'intro', read: true },
    ...videoModels,
    { id: 'picture', roles: [node('picture', 'LoadImage')], fields: [field('picture', 'image', chosen)] },
    {
      id: 'start',
      roles: [node('start', 'WanImageToVideo')],
      links: [
        link('positive', 'CONDITIONING', 'start', 'positive'),
        link('negative', 'CONDITIONING', 'start', 'negative'),
        link('vae', 'VAE', 'start', 'vae'),
        link('picture', 'IMAGE', 'start', 'start_image'),
      ],
      fields: [field('start', 'length', between(49, 121))],
    },
    {
      id: 'first-pass',
      roles: [node('first', 'KSamplerAdvanced')],
      links: [
        link('shiftHigh', 'MODEL', 'first', 'model', LORA),
        link('start', 'positive', 'first', 'positive'),
        link('start', 'negative', 'first', 'negative'),
        link('start', 'latent', 'first', 'latent_image'),
      ],
    },
    {
      id: 'second-pass',
      roles: [node('second', 'KSamplerAdvanced')],
      links: [
        link('shiftLow', 'MODEL', 'second', 'model', LORA),
        link('start', 'positive', 'second', 'positive'),
        link('start', 'negative', 'second', 'negative'),
        link('first', 'LATENT', 'second', 'latent_image'),
      ],
    },
    ...twoPassSettings,
    ...videoOut,
    { id: 'run', read: true },
  ],
};

/** A LoRA loader in each of the two model paths, wherever else LoRA loaders sit in them. */
const loraInBothPaths = {
  roles: [node('loraHigh', 'LoraLoaderModelOnly'), node('loraLow', 'LoraLoaderModelOnly')],
  links: [
    link('high', 'MODEL', 'loraHigh', 'model', LORA),
    link('loraHigh', 'MODEL', 'shiftHigh', 'model', LORA),
    link('low', 'MODEL', 'loraLow', 'model', LORA),
    link('loraLow', 'MODEL', 'shiftLow', 'model', LORA),
  ],
};

const videoGraphAtHand = {
  roles: [node('high', 'UNETLoader'), node('low', 'UNETLoader'), node('shiftHigh', 'ModelSamplingSD3'), node('shiftLow', 'ModelSamplingSD3')],
};

/** The prompt that says what is wanted: the text node whose output reaches an input named positive. */
const promptInUse = {
  roles: [node('positive', 'CLIPTextEncode'), node('wants', 'WanImageToVideo', 'KSamplerAdvanced', 'KSampler')],
  links: [link('positive', 'CONDITIONING', 'wants', 'positive')],
};

/** The same for a lesson that is about video alone: on a canvas that also draws pictures it is the clip's text. */
const videoPromptInUse = {
  roles: [node('positive', 'CLIPTextEncode'), node('wants', 'WanImageToVideo', 'KSamplerAdvanced')],
  links: [link('positive', 'CONDITIONING', 'wants', 'positive')],
};

const triggerInPrompt = field('positive', 'text', { kind: 'has-trigger', of: [{ role: 'loraHigh', field: 'lora_name' }, { role: 'loraLow', field: 'lora_name' }] });

/**
 * The same for whatever LoRA loaders are on the canvas, in a lesson that does not ask for one: a graph that takes
 * its subject from a further-trained pair of models has no LoRA and no words to check.
 */
const triggerOfAnyLora = field('positive', 'text', { kind: 'has-trigger', of: [{ classType: 'LoraLoaderModelOnly', field: 'lora_name' }] });

const lora: Lesson = {
  id: 'lora',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...videoGraphAtHand },
    { id: 'add', roles: loraInBothPaths.roles },
    { id: 'wire', links: loraInBothPaths.links },
    { id: 'files', read: true },
    { id: 'trigger-words', read: true },
    { id: 'trigger', roles: promptInUse.roles, links: promptInUse.links, fields: [triggerInPrompt] },
    { id: 'result', read: true },
  ],
};

const videoFast: Lesson = {
  id: 'video-fast',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...videoGraphAtHand },
    { id: 'loras', ...loraInBothPaths },
    { id: 'files', read: true },
    {
      id: 'samplers',
      roles: [node('first', 'KSamplerAdvanced'), node('second', 'KSamplerAdvanced')],
      links: [link('shiftHigh', 'MODEL', 'first', 'model', LORA), link('shiftLow', 'MODEL', 'second', 'model', LORA), link('first', 'LATENT', 'second', 'latent_image')],
    },
    {
      id: 'steps',
      fields: [
        field('first', 'steps', equals(4)),
        field('second', 'steps', equals(4)),
        field('first', 'end_at_step', equals(2)),
        field('second', 'start_at_step', equals(2)),
      ],
    },
    { id: 'cfg', fields: [field('first', 'cfg', equals(1)), field('second', 'cfg', equals(1))] },
    { id: 'result', read: true },
  ],
};

const promptVideo: Lesson = {
  id: 'prompt-video',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...videoPromptInUse },
    { id: 'structure', read: true },
    { id: 'write', fields: [field('positive', 'text', { kind: 'text', minChars: 80 })] },
    { id: 'action', read: true },
    { id: 'camera', read: true },
    { id: 'picture', read: true },
    { id: 'negative', read: true },
    { id: 'problems', read: true },
    { id: 'check', read: true },
  ],
};

/**
 * A picture model draws the first frame of a clip. The video graph is named first, texts and decoder included:
 * those nodes are the video's, and the picture model gets nodes of its own next to them.
 */
const twoModels: Lesson = {
  id: 'two-models',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'video-graph',
      roles: [
        node('clip', 'CLIPLoader'),
        node('vae', 'VAELoader'),
        node('positive', 'CLIPTextEncode'),
        node('negative', 'CLIPTextEncode'),
        node('start', 'WanImageToVideo'),
        node('decode', 'VAEDecode'),
      ],
      links: [
        link('clip', 'CLIP', 'positive', 'clip'),
        link('clip', 'CLIP', 'negative', 'clip'),
        link('positive', 'CONDITIONING', 'start', 'positive'),
        link('negative', 'CONDITIONING', 'start', 'negative'),
        link('vae', 'VAE', 'start', 'vae'),
        link('vae', 'VAE', 'decode', 'vae'),
      ],
    },
    { id: 'image-model', roles: [node('checkpoint', 'CheckpointLoaderSimple')], fields: [field('checkpoint', 'ckpt_name', chosen)] },
    {
      id: 'image-texts',
      roles: [node('imagePositive', 'CLIPTextEncode'), node('imageNegative', 'CLIPTextEncode')],
      links: [link('checkpoint', 'CLIP', 'imagePositive', 'clip', CLIP_VIA), link('checkpoint', 'CLIP', 'imageNegative', 'clip', CLIP_VIA)],
      fields: [field('imagePositive', 'text', { kind: 'text', minChars: 3 })],
    },
    {
      id: 'image-sampler',
      roles: [node('imageLatent', 'EmptyLatentImage'), node('imageSampler', 'KSampler')],
      links: [
        link('checkpoint', 'MODEL', 'imageSampler', 'model', LORA_ANY),
        link('imagePositive', 'CONDITIONING', 'imageSampler', 'positive'),
        link('imageNegative', 'CONDITIONING', 'imageSampler', 'negative'),
        link('imageLatent', 'LATENT', 'imageSampler', 'latent_image'),
      ],
    },
    { id: 'size', read: true },
    {
      id: 'bridge',
      roles: [node('imageDecode', 'VAEDecode')],
      links: [
        link('imageSampler', 'LATENT', 'imageDecode', 'samples'),
        link('checkpoint', 'VAE', 'imageDecode', 'vae'),
        link('imageDecode', 'IMAGE', 'start', 'start_image'),
      ],
    },
    { id: 'look', roles: [node('frame', 'SaveImage', 'PreviewImage')], links: [link('imageDecode', 'IMAGE', 'frame', 'images')] },
    { id: 'descriptions', read: true },
    { id: 'loras', read: true },
    { id: 'memory', read: true },
    { id: 'approaches', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * What changes for adult content is knowledge, not the graph: which model, which LoRA, how to describe. The subject
 * comes from a further-trained pair of models or from a LoRA, so the lesson asks for neither: it checks that the
 * video graph is there and that the words of a LoRA, when one is on the canvas, are in the description. Putting a
 * LoRA in is practised, and checked, in its own lesson.
 */
const adult: Lesson = {
  id: 'adult',
  steps: [
    { id: 'rules', read: true },
    { id: 'levers', read: true },
    { id: 'model', read: true },
    { id: 'graph', ...videoGraphAtHand },
    { id: 'tuned', read: true },
    { id: 'lora', read: true },
    { id: 'prompt', read: true },
    { id: 'trigger', roles: promptInUse.roles, links: promptInUse.links, fields: [triggerOfAnyLora] },
    { id: 'defects', read: true },
    { id: 'helper', read: true },
  ],
};

/** In the order a person meets them. */
export const LESSONS: readonly Lesson[] = [image, prompt, refine, videoText, promptVideo, videoImage, lora, videoFast, twoModels, adult];

/** Lessons that stand on the graph of another: said in the list, not enforced. */
export const LESSON_AFTER: Readonly<Record<string, string[]>> = {
  prompt: ['image'],
  refine: ['image'],
  'prompt-video': ['video-text'],
  'video-image': ['video-text'],
  lora: ['video-text'],
  'video-fast': ['lora'],
  'two-models': ['video-image'],
  adult: ['video-text'],
};

export function lessonById(id: string): Lesson | null {
  return LESSONS.find((lesson) => lesson.id === id) ?? null;
}
