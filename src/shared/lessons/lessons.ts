import type { FieldSpec, FieldTest, Lesson, LinkSpec, RoleSpec } from './engine';
import { FOUNDATIONS_AFTER, FOUNDATIONS_FIRST, FOUNDATIONS_IN_FIRST_PICTURES, FOUNDATIONS_LESSONS, FOUNDATIONS_PATH, FOUNDATIONS_TOOLS } from './sets/foundations';
import { IMAGE_MODEL_AFTER, IMAGE_MODEL_LESSONS, IMAGE_MODEL_PATH, type LessonGroup } from './sets/image-models';
import { VIDEO_FILE_KINDS, VIDEO_GROUP, VIDEO_LESSON_AFTER, VIDEO_LESSONS, VIDEO_PATH } from './sets/video';
import { IMAGE_TECHNIQUE_AFTER, IMAGE_TECHNIQUE_LESSONS, IMAGE_TECHNIQUE_PATH } from './sets/image-techniques';
import { SOUND_3D_FACES_AFTER, SOUND_3D_FACES_LESSONS, SOUND_3D_FACES_PATH } from './sets/sound-3d-faces';
import { FILES, withFileTable, type FileKind } from './files';

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
const link = (from: string, output: string, to: string, input: string, via?: string[], alt?: LinkSpec[]): LinkSpec => ({ from, output, to, input, ...(via ? { via } : {}), ...(alt ? { alt } : {}) });
const field = (role: string, name: string, test: FieldTest, why?: string): FieldSpec => (why ? { role, field: name, test, why } : { role, field: name, test });
/** A model file of a kind files.ts knows. */
const file = (kind: FileKind): FieldTest => ({ kind: 'file', want: FILES[kind] });
/** A frame count Wan takes: 4n + 1 in the range, the text's number preferred. */
const frames = (min: number, max: number, prefer: number): FieldTest => ({ kind: 'between', min, max, prefer, frames: true });
const chosen: FieldTest = { kind: 'chosen' };
const equals = (value: string | number | boolean): FieldTest => ({ kind: 'equals', value });
const between = (min: number, max: number, prefer?: number): FieldTest => (prefer === undefined ? { kind: 'between', min, max } : { kind: 'between', min, max, prefer });

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
    { id: 'model', roles: [node('checkpoint', 'CheckpointLoaderSimple')], fields: [field('checkpoint', 'ckpt_name', file('imageCheckpoint'))] },
    { id: 'prompts', roles: [node('positive', 'CLIPTextEncode'), node('negative', 'CLIPTextEncode')] },
    { id: 'prompts-clip', links: [link('checkpoint', 'CLIP', 'positive', 'clip', CLIP_VIA), link('checkpoint', 'CLIP', 'negative', 'clip', CLIP_VIA)] },
    { id: 'prompt-text', fields: [field('positive', 'text', { kind: 'text', minChars: 3, words: 2 })] },
    {
      id: 'latent',
      roles: [node('latent', 'EmptyLatentImage')],
      // The size a model was trained at: advice while the first picture is built, not a refusal.
      fields: [{ ...field('latent', 'width', { kind: 'size', of: { role: 'checkpoint', field: 'ckpt_name' } }), soft: true }],
    },
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
    { id: 'save', roles: [node('save', 'SaveImage', 'PreviewImage')], links: [link('decode', 'IMAGE', 'save', 'images')] },
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
    { id: 'write', fields: [field('positive', 'text', { kind: 'text', minChars: 40, words: 4, noNegation: true })] },
    { id: 'weights', read: true },
    { id: 'weigh', fields: [field('positive', 'text', { kind: 'weighted', min: 0.5, max: 1.5 })] },
    { id: 'negative', read: true },
    { id: 'negative-text', fields: [field('negative', 'text', { kind: 'text', minChars: 5, notCopyOf: { role: 'positive', field: 'text' } })] },
    { id: 'cfg', read: true },
    { id: 'seed', read: true },
    { id: 'problems', read: true },
    { id: 'check', read: true },
  ],
};

/**
 * The graph of the first lesson, named whole, its saver included, for a lesson that stands on it. A LoRA loader
 * (with or without the text reader) on the way of the model does not break it.
 */
const imageGraphAtHand = {
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
};

/**
 * A second model redraws the picture of the first. The first pass is named whole, its saver included, so that
 * every node the second pass needs is a new one: what is already wired stays as it is.
 */
const refine: Lesson = {
  id: 'refine',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...imageGraphAtHand },
    {
      id: 'second-model',
      roles: [node('checkpointB', 'CheckpointLoaderSimple')],
      fields: [field('checkpointB', 'ckpt_name', { kind: 'differs', role: 'checkpoint', field: 'ckpt_name' }), field('checkpointB', 'ckpt_name', file('imageCheckpoint'))],
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
    { id: 'denoise', fields: [field('samplerB', 'denoise', between(0.2, 0.5, 0.5), 'denoise')] },
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

/**
 * The loaders of a two-pass Wan graph: two diffusion models, the text encoder, the VAE. `from` is the kind of
 * graph: text to video takes the `t2v` pair, a picture to video the `i2v` pair.
 */
const videoModels = (from: 'text' | 'picture') => [
  {
    id: 'models',
    roles: [node('high', 'UNETLoader'), node('low', 'UNETLoader')],
    fields: [
      field('high', 'unet_name', file(from === 'text' ? 'wanT2vHigh' : 'wanI2vHigh')),
      field('low', 'unet_name', { kind: 'differs', role: 'high', field: 'unet_name' }),
      field('low', 'unet_name', file(from === 'text' ? 'wanT2vLow' : 'wanI2vLow')),
    ],
  },
  { id: 'text-encoder', roles: [node('clip', 'CLIPLoader')], fields: [field('clip', 'clip_name', file('umt5')), field('clip', 'type', equals('wan'), 'clipType')] },
  { id: 'vae', roles: [node('vae', 'VAELoader')], fields: [field('vae', 'vae_name', file('wan21Vae'))] },
  {
    id: 'prompts',
    roles: [node('positive', 'CLIPTextEncode'), node('negative', 'CLIPTextEncode')],
    links: [link('clip', 'CLIP', 'positive', 'clip'), link('clip', 'CLIP', 'negative', 'clip')],
    fields: [field('positive', 'text', { kind: 'text', minChars: 3, words: 2 })],
  },
  {
    id: 'shift',
    roles: [node('shiftHigh', 'ModelSamplingSD3'), node('shiftLow', 'ModelSamplingSD3')],
    links: [link('high', 'MODEL', 'shiftHigh', 'model', LORA), link('low', 'MODEL', 'shiftLow', 'model', LORA)],
    fields: [field('shiftHigh', 'shift', between(5, 8, 8), 'shift'), field('shiftLow', 'shift', between(5, 8, 8), 'shift')],
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
      field('first', 'add_noise', equals('enable'), 'firstAddNoise'),
      field('first', 'steps', between(4, 60, 20), 'firstSteps'),
      field('first', 'cfg', between(1, 4, 3.5), 'videoCfg'),
      field('first', 'start_at_step', equals(0), 'firstStart'),
      field('first', 'end_at_step', between(1, 15, 10), 'firstEnd'),
      field('first', 'end_at_step', { kind: 'less', role: 'first', field: 'steps' }, 'firstEndBelowSteps'),
      field('first', 'return_with_leftover_noise', equals('enable'), 'leftover'),
    ],
  },
  {
    id: 'second-settings',
    fields: [
      field('second', 'add_noise', equals('disable'), 'secondAddNoise'),
      field('second', 'steps', { kind: 'same', role: 'first', field: 'steps' }, 'secondSteps'),
      field('second', 'cfg', between(1, 4, 3.5), 'videoCfg'),
      field('second', 'start_at_step', { kind: 'same', role: 'first', field: 'end_at_step' }, 'secondStart'),
      field('second', 'return_with_leftover_noise', equals('disable'), 'secondLeftover'),
    ],
  },
];

const videoOut = [
  { id: 'decode', roles: [node('decode', 'VAEDecode')], links: [link('second', 'LATENT', 'decode', 'samples'), link('vae', 'VAE', 'decode', 'vae')] },
  {
    id: 'save',
    roles: [node('video', 'CreateVideo'), node('save', 'SaveVideo')],
    links: [link('decode', 'IMAGE', 'video', 'images'), link('video', 'VIDEO', 'save', 'video')],
    fields: [field('video', 'fps', equals(16), 'fps16')],
  },
];

const videoText: Lesson = {
  id: 'video-text',
  steps: [
    { id: 'intro', read: true },
    ...videoModels('text'),
    { id: 'latent', roles: [node('latent', 'EmptyHunyuanLatentVideo')], fields: [field('latent', 'length', frames(49, 121, 81), 'frames')] },
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
    ...videoModels('picture'),
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
      fields: [field('start', 'length', frames(49, 121, 81), 'frames')],
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

/**
 * A LoRA loader in each of the two model paths, wherever else LoRA loaders sit in them. It may stand before the
 * node that shifts the noise or after it: ComfyUI applies both the same way.
 */
const SHIFT_OR_LORA = [...LORA, 'ModelSamplingSD3'];
const loraInBothPaths = {
  roles: [node('loraHigh', 'LoraLoaderModelOnly'), node('loraLow', 'LoraLoaderModelOnly')],
  links: [
    link('high', 'MODEL', 'loraHigh', 'model', SHIFT_OR_LORA),
    link('loraHigh', 'MODEL', 'shiftHigh', 'model', LORA, [link('shiftHigh', 'MODEL', 'loraHigh', 'model', LORA)]),
    link('low', 'MODEL', 'loraLow', 'model', SHIFT_OR_LORA),
    link('loraLow', 'MODEL', 'shiftLow', 'model', LORA, [link('shiftLow', 'MODEL', 'loraLow', 'model', LORA)]),
  ],
};

/**
 * The two halves of a Wan 2.2 graph, each known by its file: what is put into the path of the first model is held
 * to the first half, whichever loader was added first.
 */
const videoGraphAtHand = {
  roles: [node('high', 'UNETLoader'), node('low', 'UNETLoader'), node('shiftHigh', 'ModelSamplingSD3'), node('shiftLow', 'ModelSamplingSD3')],
  fields: [{ ...field('high', 'unet_name', file('wanHigh')), identifies: true }, { ...field('low', 'unet_name', file('wanLow')), identifies: true }] as FieldSpec[],
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
    { id: 'files', fields: [field('loraHigh', 'lora_name', file('wanLoraHigh')), field('loraLow', 'lora_name', file('wanLoraLow'))] },
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
    { id: 'files', fields: [field('loraHigh', 'lora_name', file('fastLoraHigh')), field('loraLow', 'lora_name', file('fastLoraLow'))] },
    {
      id: 'samplers',
      roles: [node('first', 'KSamplerAdvanced'), node('second', 'KSamplerAdvanced')],
      links: [link('shiftHigh', 'MODEL', 'first', 'model', LORA), link('shiftLow', 'MODEL', 'second', 'model', LORA), link('first', 'LATENT', 'second', 'latent_image')],
    },
    {
      id: 'steps',
      fields: [
        field('first', 'steps', equals(4), 'fastSteps'),
        field('second', 'steps', equals(4), 'fastSteps'),
        field('first', 'end_at_step', equals(2), 'fastSplit'),
        field('second', 'start_at_step', equals(2), 'fastSplit'),
      ],
    },
    { id: 'cfg', fields: [field('first', 'cfg', equals(1), 'fastCfg'), field('second', 'cfg', equals(1), 'fastCfg')] },
    { id: 'result', read: true },
  ],
};

const promptVideo: Lesson = {
  id: 'prompt-video',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...videoPromptInUse },
    { id: 'structure', read: true },
    { id: 'write', fields: [field('positive', 'text', { kind: 'text', minChars: 80, words: 10, english: true })] },
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
    { id: 'image-model', roles: [node('checkpoint', 'CheckpointLoaderSimple')], fields: [field('checkpoint', 'ckpt_name', file('imageCheckpoint'))] },
    {
      id: 'image-texts',
      roles: [node('imagePositive', 'CLIPTextEncode'), node('imageNegative', 'CLIPTextEncode')],
      links: [link('checkpoint', 'CLIP', 'imagePositive', 'clip', CLIP_VIA), link('checkpoint', 'CLIP', 'imageNegative', 'clip', CLIP_VIA)],
      fields: [field('imagePositive', 'text', { kind: 'text', minChars: 3, words: 2 })],
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
    { id: 'size', fields: [field('imageLatent', 'width', { kind: 'aspect', role: 'start' }, 'aspect')] },
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
 * What the pack's start nodes give a sampler, by its data type: the empty one names it `image_embeds`, VACE
 * `vace_embeds`, and each is accepted where the lesson asks for "the start of the clip".
 */
const EMBEDS = 'WANVIDIMAGE_EMBEDS';
/** Nodes that may stand between the frames of a video and VACE: what turns them into depth, a pose or lines. */
const CONTROL_VIA = [
  'DepthAnythingV2Preprocessor', 'DepthAnythingPreprocessor', 'MiDaS-DepthMapPreprocessor', 'OpenposePreprocessor', 'DWPreprocessor',
  'CannyEdgePreprocessor', 'LineArtPreprocessor', 'AnyLineArtPreprocessor_aux', 'ImageScale', 'ImageResizeKJ',
];

/**
 * Wan 2.2 in kijai's ComfyUI-WanVideoWrapper: its own loaders, one text node that holds both descriptions, one
 * embeds node that says the size and the length (or carries the start picture), and a sampler that takes the
 * noise shift itself. Its nodes do not connect to the built-in ones (WANVIDEOMODEL is not MODEL), so a graph is
 * built on one or on the other. Port names are the pack's own (nodes.py, nodes_model_loading.py, nodes_sampler.py).
 */
const wrapper: Lesson = {
  id: 'wrapper',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'models',
      roles: [node('high', 'WanVideoModelLoader'), node('low', 'WanVideoModelLoader')],
      fields: [field('high', 'model', file('wanHigh')), field('low', 'model', { kind: 'differs', role: 'high', field: 'model' }), field('low', 'model', file('wanLow'))],
    },
    { id: 'text-encoder', roles: [node('t5', 'LoadWanVideoT5TextEncoder')], fields: [field('t5', 'model_name', file('umt5'))] },
    { id: 'vae', roles: [node('vae', 'WanVideoVAELoader')], fields: [field('vae', 'model_name', file('wan21Vae'))] },
    {
      id: 'prompt',
      roles: [node('text', 'WanVideoTextEncode')],
      links: [link('t5', 'wan_t5_model', 'text', 't5')],
      fields: [field('text', 'positive_prompt', { kind: 'text', minChars: 3, words: 2 })],
    },
    {
      id: 'embeds',
      roles: [node('embeds', 'WanVideoEmptyEmbeds', 'WanVideoImageToVideoEncode', 'WanVideoVACEEncode')],
      fields: [field('embeds', 'num_frames', frames(49, 121, 81), 'frames')],
    },
    {
      id: 'first-pass',
      roles: [node('first', 'WanVideoSampler')],
      links: [link('high', 'model', 'first', 'model'), link('text', 'text_embeds', 'first', 'text_embeds'), link('embeds', EMBEDS, 'first', 'image_embeds')],
    },
    {
      id: 'second-pass',
      roles: [node('second', 'WanVideoSampler')],
      links: [
        link('low', 'model', 'second', 'model'),
        link('text', 'text_embeds', 'second', 'text_embeds'),
        link('embeds', EMBEDS, 'second', 'image_embeds'),
        link('first', 'samples', 'second', 'samples'),
      ],
    },
    {
      id: 'split',
      fields: [
        field('first', 'steps', between(4, 40, 20), 'firstSteps'),
        field('first', 'end_step', between(1, 20, 10), 'wrapperEnd'),
        field('first', 'end_step', { kind: 'less', role: 'first', field: 'steps' }, 'firstEndBelowSteps'),
        field('second', 'steps', { kind: 'same', role: 'first', field: 'steps' }, 'secondSteps'),
        field('second', 'start_step', { kind: 'same', role: 'first', field: 'end_step' }, 'secondStart'),
      ],
    },
    {
      id: 'guidance',
      fields: [
        field('first', 'cfg', between(1, 4, 3.5), 'wrapperCfg'),
        field('second', 'cfg', between(1, 4, 3.5), 'wrapperCfg'),
        field('first', 'shift', between(5, 8, 8), 'shift'),
        field('second', 'shift', between(5, 8, 8), 'shift'),
      ],
    },
    { id: 'decode', roles: [node('decode', 'WanVideoDecode')], links: [link('second', 'samples', 'decode', 'samples'), link('vae', 'vae', 'decode', 'vae')] },
    {
      id: 'save',
      roles: [node('video', 'CreateVideo'), node('save', 'SaveVideo')],
      links: [link('decode', 'IMAGE', 'video', 'images'), link('video', 'VIDEO', 'save', 'video')],
      fields: [field('video', 'fps', equals(16), 'fps16')],
    },
    { id: 'memory', read: true },
    { id: 'lora', read: true },
    {
      id: 'trigger',
      fields: [field('text', 'positive_prompt', { kind: 'has-trigger', of: [{ classType: 'WanVideoLoraSelect', field: 'lora' }] })],
    },
    { id: 'fast', read: true },
    { id: 'run', read: true },
  ],
};

/** The same graph started from a picture: the embeds node that carries it, and the picture itself. */
const wrapperImage: Lesson = {
  id: 'wrapper-image',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'graph',
      roles: [
        node('high', 'WanVideoModelLoader'),
        node('low', 'WanVideoModelLoader'),
        node('vae', 'WanVideoVAELoader'),
        node('first', 'WanVideoSampler'),
        node('second', 'WanVideoSampler'),
      ],
      links: [link('high', 'model', 'first', 'model'), link('low', 'model', 'second', 'model'), link('first', 'samples', 'second', 'samples')],
    },
    { id: 'models', fields: [field('high', 'model', file('wanI2vHigh')), field('low', 'model', file('wanI2vLow'))] },
    { id: 'picture', roles: [node('picture', 'LoadImage')], fields: [field('picture', 'image', chosen)] },
    {
      id: 'start',
      roles: [node('start', 'WanVideoImageToVideoEncode')],
      links: [link('vae', 'vae', 'start', 'vae'), link('picture', 'IMAGE', 'start', 'start_image')],
      fields: [field('start', 'num_frames', frames(49, 121, 81), 'frames')],
    },
    { id: 'wire', links: [link('start', 'image_embeds', 'first', 'image_embeds'), link('start', 'image_embeds', 'second', 'image_embeds')] },
    { id: 'motion', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * VACE on the WanVideoWrapper graph: a module added to each of the two models, a video whose frames (or a depth,
 * a pose, lines made of them) say how the clip moves, and the VACE node that gives both samplers their start.
 */
const wrapperVace: Lesson = {
  id: 'wrapper-vace',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'graph',
      roles: [
        node('high', 'WanVideoModelLoader'),
        node('low', 'WanVideoModelLoader'),
        node('vae', 'WanVideoVAELoader'),
        node('first', 'WanVideoSampler'),
        node('second', 'WanVideoSampler'),
      ],
      links: [link('high', 'model', 'first', 'model'), link('low', 'model', 'second', 'model'), link('first', 'samples', 'second', 'samples')],
    },
    {
      id: 'modules',
      roles: [node('vaceHigh', 'WanVideoVACEModelSelect'), node('vaceLow', 'WanVideoVACEModelSelect')],
      links: [link('vaceHigh', 'extra_model', 'high', 'extra_model'), link('vaceLow', 'extra_model', 'low', 'extra_model')],
      fields: [field('vaceHigh', 'vace_model', file('vaceHigh')), field('vaceLow', 'vace_model', { kind: 'differs', role: 'vaceHigh', field: 'vace_model' }), field('vaceLow', 'vace_model', file('vaceLow'))],
    },
    {
      id: 'source',
      roles: [node('source', 'LoadVideo'), node('frames', 'GetVideoComponents')],
      links: [link('source', 'VIDEO', 'frames', 'video')],
      fields: [field('source', 'file', chosen)],
    },
    { id: 'control', read: true },
    {
      id: 'encode',
      roles: [node('vace', 'WanVideoVACEEncode')],
      links: [link('vae', 'vae', 'vace', 'vae'), link('frames', 'images', 'vace', 'input_frames', CONTROL_VIA)],
      fields: [field('vace', 'num_frames', frames(49, 121, 81), 'frames'), field('vace', 'strength', between(0.5, 1.5, 1), 'vaceStrength')],
    },
    { id: 'wire', links: [link('vace', EMBEDS, 'first', 'image_embeds'), link('vace', EMBEDS, 'second', 'image_embeds')] },
    { id: 'reference', read: true },
    { id: 'tune', read: true },
    { id: 'run', read: true },
  ],
};

/** The loaders and the text every one-model WanVideoWrapper graph starts with. `model` is the kind of its model. */
const oneModelText = (modelStep: string, model: FileKind) => [
  { id: modelStep, roles: [node('model', 'WanVideoModelLoader')], fields: [field('model', 'model', file(model))] },
  {
    id: 'readers',
    roles: [node('t5', 'LoadWanVideoT5TextEncoder'), node('vae', 'WanVideoVAELoader')],
    fields: [field('t5', 'model_name', file('umt5')), field('vae', 'model_name', file('wan21Vae'))],
  },
  {
    id: 'prompt',
    roles: [node('text', 'WanVideoTextEncode')],
    links: [link('t5', 'wan_t5_model', 'text', 't5')],
    fields: [field('text', 'positive_prompt', { kind: 'text', minChars: 3, words: 2 })],
  },
];

/** The same with the picture a clip starts from, shown to the model the way Wan 2.1 "image to video" needs it. */
const oneModelStart = (modelStep: string, model: FileKind) => [
  ...oneModelText(modelStep, model),
  { id: 'picture', roles: [node('picture', 'LoadImage')], fields: [field('picture', 'image', chosen)] },
  {
    id: 'vision',
    roles: [node('clipVision', 'CLIPVisionLoader'), node('vision', 'WanVideoClipVisionEncode')],
    links: [link('clipVision', 'CLIP_VISION', 'vision', 'clip_vision'), link('picture', 'IMAGE', 'vision', 'image_1')],
    fields: [field('clipVision', 'clip_name', file('clipVisionH'))],
  },
];

/** The decoder and the saver of a one-model graph, at the frame rate its model draws. */
const oneModelEnd = (fps: number) => [
  { id: 'decode', roles: [node('decode', 'WanVideoDecode')], links: [link('sampler', 'samples', 'decode', 'samples'), link('vae', 'vae', 'decode', 'vae')] },
  {
    id: 'save',
    roles: [node('video', 'CreateVideo'), node('save', 'SaveVideo')],
    links: [link('decode', 'IMAGE', 'video', 'images'), link('video', 'VIDEO', 'save', 'video')],
    fields: [field('video', 'fps', equals(fps), `fps${fps}`)],
  },
];

/**
 * Wan 2.2 Animate on WanVideoWrapper: a person in a picture moves the way the person in a video moves. The pose
 * and the face are taken from the video by ComfyUI-WanAnimatePreprocess. One model, not a pair.
 */
const wrapperAnimate: Lesson = {
  id: 'wrapper-animate',
  steps: [
    { id: 'intro', read: true },
    ...oneModelStart('model', 'wanAnimate'),
    {
      id: 'driving',
      roles: [node('source', 'LoadVideo'), node('frames', 'GetVideoComponents')],
      links: [link('source', 'VIDEO', 'frames', 'video')],
      fields: [field('source', 'file', chosen)],
    },
    {
      id: 'detect',
      roles: [node('poseModel', 'OnnxDetectionModelLoader'), node('detect', 'PoseAndFaceDetection'), node('draw', 'DrawViTPose')],
      links: [link('poseModel', 'model', 'detect', 'model'), link('frames', 'images', 'detect', 'images'), link('detect', 'pose_data', 'draw', 'pose_data')],
      fields: [field('poseModel', 'vitpose_model', file('vitpose')), field('poseModel', 'yolo_model', file('yolo'))],
    },
    {
      id: 'embeds',
      roles: [node('animate', 'WanVideoAnimateEmbeds')],
      links: [
        link('vae', 'vae', 'animate', 'vae'),
        link('picture', 'IMAGE', 'animate', 'ref_images'),
        link('draw', 'pose_images', 'animate', 'pose_images'),
        link('detect', 'face_images', 'animate', 'face_images'),
        link('vision', 'WANVIDIMAGE_CLIPEMBEDS', 'animate', 'clip_embeds'),
      ],
      fields: [field('animate', 'num_frames', frames(49, 121, 81), 'frames')],
    },
    {
      id: 'sampler',
      roles: [node('sampler', 'WanVideoSampler')],
      links: [link('model', 'model', 'sampler', 'model'), link('text', 'text_embeds', 'sampler', 'text_embeds'), link('animate', EMBEDS, 'sampler', 'image_embeds')],
    },
    ...oneModelEnd(16),
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * InfiniteTalk on WanVideoWrapper: a portrait speaks the words of a sound file, lips in time. Wan 2.1 picture to
 * video with the InfiniteTalk module; the sound is read by a wav2vec model and goes into the clip as its track.
 */
const wrapperTalk: Lesson = {
  id: 'wrapper-talk',
  steps: [
    { id: 'intro', read: true },
    ...oneModelStart('model', 'wan21I2v'),
    { id: 'talk-model', roles: [node('talk', 'MultiTalkModelLoader')], links: [link('talk', 'model', 'model', 'multitalk_model')], fields: [field('talk', 'model', file('talkModule'))] },
    {
      id: 'voice',
      roles: [node('voice', 'LoadAudio'), node('wav2vec', 'Wav2VecModelLoader'), node('audio', 'MultiTalkWav2VecEmbeds')],
      links: [link('wav2vec', 'wav2vec_model', 'audio', 'wav2vec_model'), link('voice', 'AUDIO', 'audio', 'audio_1')],
      fields: [field('voice', 'audio', chosen), field('wav2vec', 'model', file('wav2vec')), field('audio', 'fps', equals(25), 'fps25')],
    },
    {
      id: 'start',
      roles: [node('start', 'WanVideoImageToVideoMultiTalk')],
      links: [link('vae', 'vae', 'start', 'vae'), link('picture', 'IMAGE', 'start', 'start_image'), link('vision', 'WANVIDIMAGE_CLIPEMBEDS', 'start', 'clip_embeds')],
    },
    {
      id: 'sampler',
      roles: [node('sampler', 'WanVideoSampler')],
      links: [
        link('model', 'model', 'sampler', 'model'),
        link('text', 'text_embeds', 'sampler', 'text_embeds'),
        link('start', EMBEDS, 'sampler', 'image_embeds'),
        link('audio', 'multitalk_embeds', 'sampler', 'multitalk_embeds'),
      ],
    },
    ...oneModelEnd(25),
    { id: 'sound', links: [link('audio', 'audio', 'video', 'audio')] },
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/** Nodes that may stand between a picture or the frames of a video and what reads them: a resize, a cut of the batch. */
const RESIZE_VIA = ['ImageScale', 'ImageResizeKJ', 'ImageResizeKJv2', 'ImageFromBatch', 'GetImageRangeFromBatch'];

/** The start of a clip from a picture, for the Wan 2.1 "image to video" graphs of one model. */
const pictureStart = {
  id: 'start',
  roles: [node('start', 'WanVideoImageToVideoEncode')],
  links: [link('vae', 'vae', 'start', 'vae'), link('picture', 'IMAGE', 'start', 'start_image'), link('vision', 'WANVIDIMAGE_CLIPEMBEDS', 'start', 'clip_embeds')],
  fields: [field('start', 'num_frames', frames(49, 121, 81), 'frames')],
};

/**
 * Two people speak in one clip: the graph of the InfiniteTalk lesson with a second sound file. The pack gives the
 * first voice to whoever stands in the left half of the picture and the second to the right half
 * (multitalk/multitalk_loop.py), unless masks say otherwise.
 */
const wrapperDuo: Lesson = {
  id: 'wrapper-duo',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'graph',
      roles: [node('talk', 'MultiTalkModelLoader'), node('voice', 'LoadAudio'), node('audio', 'MultiTalkWav2VecEmbeds'), node('sampler', 'WanVideoSampler')],
      links: [link('voice', 'AUDIO', 'audio', 'audio_1'), link('audio', 'multitalk_embeds', 'sampler', 'multitalk_embeds')],
    },
    { id: 'module', fields: [field('talk', 'model', file('talkModuleMulti'))] },
    { id: 'picture', read: true },
    {
      id: 'second-voice',
      roles: [node('voice2', 'LoadAudio')],
      links: [link('voice2', 'AUDIO', 'audio', 'audio_2')],
      fields: [field('voice2', 'audio', { kind: 'differs', role: 'voice', field: 'audio' })],
    },
    { id: 'order', read: true },
    { id: 'who', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * FantasyTalking on WanVideoWrapper: a portrait speaks a short sound file. Wan 2.1 picture to video with the
 * FantasyTalking module; the sound is read by wav2vec2-base-960h, which the pack's node fetches itself when the
 * graph is first run in ComfyUI.
 */
const wrapperFantasy: Lesson = {
  id: 'wrapper-fantasy',
  steps: [
    { id: 'intro', read: true },
    ...oneModelStart('model', 'wan21I2v'),
    { id: 'talk-model', roles: [node('talk', 'FantasyTalkingModelLoader')], links: [link('talk', 'model', 'model', 'fantasytalking_model')], fields: [field('talk', 'model', file('fantasyModule'))] },
    pictureStart,
    {
      id: 'voice',
      roles: [node('voice', 'LoadAudio'), node('wav2vec', 'DownloadAndLoadWav2VecModel'), node('audio', 'FantasyTalkingWav2VecEmbeds')],
      links: [
        link('wav2vec', 'wav2vec_model', 'audio', 'wav2vec_model'),
        link('talk', 'model', 'audio', 'fantasytalking_model'),
        link('voice', 'AUDIO', 'audio', 'audio'),
      ],
      fields: [
        field('voice', 'audio', chosen),
        field('wav2vec', 'model', equals('facebook/wav2vec2-base-960h'), 'wav2vecFantasy'),
        field('audio', 'fps', equals(23), 'fps23'),
        field('audio', 'num_frames', { kind: 'same', role: 'start', field: 'num_frames' }, 'sameFrames'),
      ],
    },
    {
      id: 'sampler',
      roles: [node('sampler', 'WanVideoSampler')],
      links: [
        link('model', 'model', 'sampler', 'model'),
        link('text', 'text_embeds', 'sampler', 'text_embeds'),
        link('start', EMBEDS, 'sampler', 'image_embeds'),
        link('audio', 'fantasytalking_embeds', 'sampler', 'fantasytalking_embeds'),
      ],
    },
    ...oneModelEnd(23),
    { id: 'sound', links: [link('voice', 'AUDIO', 'video', 'audio')] },
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * UniAnimate on WanVideoWrapper: a person in a picture repeats the movement of a person in a video, on Wan 2.1
 * picture to video with the UniAnimate LoRA. The skeleton is drawn by the pack's own detector, which fetches its
 * two small models itself when the graph is first run in ComfyUI.
 */
const wrapperUni: Lesson = {
  id: 'wrapper-unianimate',
  steps: [
    { id: 'intro', read: true },
    ...oneModelStart('model', 'wan21I2v'),
    { id: 'lora', roles: [node('uni', 'WanVideoLoraSelect')], links: [link('uni', 'lora', 'model', 'lora')], fields: [field('uni', 'lora', file('uniLora'))] },
    {
      id: 'driving',
      roles: [node('source', 'LoadVideo'), node('frames', 'GetVideoComponents')],
      links: [link('source', 'VIDEO', 'frames', 'video')],
      fields: [field('source', 'file', chosen)],
    },
    {
      id: 'detect',
      roles: [node('detect', 'WanVideoUniAnimateDWPoseDetector')],
      links: [link('frames', 'images', 'detect', 'pose_images', RESIZE_VIA), link('picture', 'IMAGE', 'detect', 'reference_pose_image', RESIZE_VIA)],
    },
    {
      id: 'pose',
      roles: [node('pose', 'WanVideoUniAnimatePoseInput')],
      links: [link('detect', 'poses', 'pose', 'pose_images'), link('detect', 'reference_pose', 'pose', 'reference_pose_image')],
      fields: [field('pose', 'strength', between(0.5, 1, 1), 'poseStrength')],
    },
    pictureStart,
    {
      id: 'sampler',
      roles: [node('sampler', 'WanVideoSampler')],
      links: [
        link('model', 'model', 'sampler', 'model'),
        link('text', 'text_embeds', 'sampler', 'text_embeds'),
        link('start', EMBEDS, 'sampler', 'image_embeds'),
        link('pose', 'unianimate_poses', 'sampler', 'unianimate_poses'),
      ],
    },
    ...oneModelEnd(16),
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * ReCamMaster on WanVideoWrapper: a finished video is drawn again as if the camera had moved another way. The
 * video goes in as latents; the camera's path is one of ten the pack ships (recammaster/nodes.py).
 */
const wrapperRecam: Lesson = {
  id: 'wrapper-recam',
  steps: [
    { id: 'intro', read: true },
    ...oneModelText('model', 'recam'),
    {
      id: 'source',
      roles: [node('source', 'LoadVideo'), node('frames', 'GetVideoComponents')],
      links: [link('source', 'VIDEO', 'frames', 'video')],
      fields: [field('source', 'file', chosen)],
    },
    { id: 'encode', roles: [node('encode', 'WanVideoEncode')], links: [link('vae', 'vae', 'encode', 'vae'), link('frames', 'images', 'encode', 'image', RESIZE_VIA)] },
    { id: 'camera', roles: [node('camera', 'WanVideoReCamMasterDefaultCamera')], links: [link('encode', 'samples', 'camera', 'latents')] },
    {
      id: 'embeds',
      roles: [node('recam', 'WanVideoReCamMasterCameraEmbed')],
      links: [link('camera', 'camera_poses', 'recam', 'camera_poses'), link('encode', 'samples', 'recam', 'latents')],
    },
    {
      id: 'sampler',
      roles: [node('sampler', 'WanVideoSampler')],
      links: [link('model', 'model', 'sampler', 'model'), link('text', 'text_embeds', 'sampler', 'text_embeds'), link('recam', EMBEDS, 'sampler', 'image_embeds')],
      fields: [field('sampler', 'steps', between(20, 30, 20), 'recamSteps')],
    },
    ...oneModelEnd(16),
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * Ovi on WanVideoWrapper: one run draws the clip and its sound, speech included. Two models side by side (video
 * and audio), one description with the spoken words between <S> and <E>, a second text that says what the sound
 * must not be, an empty sound of the length that fits
 * 121 frames, and a second decoder for the sound (Ovi/nodes_ovi.py and the pack's Ovi example).
 */
const wrapperOvi: Lesson = {
  id: 'wrapper-ovi',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'models',
      roles: [node('model', 'WanVideoModelLoader'), node('sound', 'WanVideoExtraModelSelect')],
      links: [link('sound', 'extra_model', 'model', 'extra_model')],
      fields: [
        field('model', 'model', file('ovi')),
        field('sound', 'extra_model', { kind: 'differs', role: 'model', field: 'model' }),
        field('sound', 'extra_model', file('oviAudio')),
        field('model', 'base_precision', equals('bf16'), 'oviPrecision'),
      ],
    },
    {
      id: 'readers',
      roles: [node('t5', 'LoadWanVideoT5TextEncoder'), node('vae', 'WanVideoVAELoader')],
      fields: [field('t5', 'model_name', file('umt5')), field('vae', 'model_name', file('wan22Vae'))],
    },
    {
      id: 'prompt',
      roles: [node('text', 'WanVideoTextEncode')],
      links: [link('t5', 'wan_t5_model', 'text', 't5')],
      fields: [field('text', 'positive_prompt', { kind: 'text', minChars: 3, words: 2 })],
    },
    { id: 'speech', fields: [field('text', 'positive_prompt', { kind: 'text', minChars: 3, has: ['<S>', '<E>'] })] },
    {
      id: 'guidance',
      roles: [node('ovi', 'WanVideoOviCFG')],
      links: [link('text', 'text_embeds', 'ovi', 'original_text_embeds')],
      fields: [field('ovi', 'ovi_audio_cfg', between(2, 4, 3), 'oviAudioCfg')],
    },
    {
      // The node reads the unwanted sound from the *positive* text of a second text node (Ovi/nodes_ovi.py takes
      // its "prompt_embeds"); with none connected it falls back to the description itself.
      id: 'sound-negative',
      roles: [node('soundNo', 'WanVideoTextEncode')],
      links: [link('t5', 'wan_t5_model', 'soundNo', 't5'), link('soundNo', 'text_embeds', 'ovi', 'ovi_negative_text_embeds')],
      fields: [field('soundNo', 'positive_prompt', { kind: 'text', minChars: 3 })],
    },
    { id: 'size', roles: [node('embeds', 'WanVideoEmptyEmbeds')], fields: [field('embeds', 'num_frames', equals(121), 'ovi121')] },
    { id: 'silence', roles: [node('silence', 'WanVideoEmptyMMAudioLatents')], fields: [field('silence', 'length', equals(157), 'ovi157')] },
    {
      id: 'sampler',
      roles: [node('sampler', 'WanVideoSampler')],
      links: [
        link('model', 'model', 'sampler', 'model'),
        link('ovi', 'text_embeds', 'sampler', 'text_embeds'),
        link('embeds', EMBEDS, 'sampler', 'image_embeds'),
        link('silence', 'samples', 'sampler', 'samples'),
      ],
      fields: [field('sampler', 'steps', between(30, 50, 50), 'oviSteps'), field('sampler', 'cfg', between(3, 5, 4), 'oviCfg')],
    },
    { id: 'decode', roles: [node('decode', 'WanVideoDecode')], links: [link('sampler', 'samples', 'decode', 'samples'), link('vae', 'vae', 'decode', 'vae')] },
    {
      id: 'sound-out',
      roles: [node('soundVae', 'OviMMAudioVAELoader'), node('soundDecode', 'WanVideoDecodeOviAudio')],
      links: [link('soundVae', 'mmaudio_vae', 'soundDecode', 'mmaudio_vae'), link('sampler', 'samples', 'soundDecode', 'samples')],
      fields: [field('soundVae', 'vae', file('mmaudioVae')), field('soundVae', 'vocoder', file('mmaudioVocoder'))],
    },
    {
      id: 'save',
      roles: [node('video', 'CreateVideo'), node('save', 'SaveVideo')],
      links: [link('decode', 'IMAGE', 'video', 'images'), link('soundDecode', 'audio', 'video', 'audio'), link('video', 'VIDEO', 'save', 'video')],
      fields: [field('video', 'fps', equals(24), 'fps24')],
    },
    { id: 'picture', read: true },
    { id: 'tips', read: true },
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
    { id: 'pair-loras', read: true },
    { id: 'anchor', read: true },
    { id: 'prompt', read: true },
    { id: 'trigger', roles: promptInUse.roles, links: promptInUse.links, fields: [triggerOfAnyLora] },
    { id: 'defects', read: true },
    { id: 'helper', read: true },
  ],
};

/**
 * The same for pictures: the graph of the first lesson, and what decides the result (the model of a family, the
 * LoRAs made for that family, the description). The words a model was trained with are its author's: the lesson
 * sends the person to the model's page and to its card in the app, and lists none itself. Like the video lesson
 * it asks for no LoRA; one that is on the canvas, with or without the text reader, is held to its words.
 */
const triggerOfAnyImageLora = field('positive', 'text', { kind: 'has-trigger', of: [{ classType: 'LoraLoader', field: 'lora_name' }, { classType: 'LoraLoaderModelOnly', field: 'lora_name' }] });

const adultImage: Lesson = {
  id: 'adult-image',
  steps: [
    { id: 'rules', read: true },
    { id: 'levers', read: true },
    { id: 'graph', ...imageGraphAtHand },
    { id: 'families', read: true },
    { id: 'readers', read: true },
    { id: 'lora', read: true },
    { id: 'trigger', fields: [triggerOfAnyImageLora] },
    { id: 'negative', read: true },
    { id: 'size', read: true },
    { id: 'defects', read: true },
    { id: 'helper', read: true },
  ],
};

/**
 * Adult LoRAs on the first picture graph, the way ComfyUI's own LoRA example wires one (Load LoRA between the
 * checkpoint and everything that takes its model and its text reader). The files and the words are the person's:
 * the lesson says where a file goes, where its page names its family and its words, how strong to make it, and how
 * two of them are balanced; it names no file and no word.
 */
const adultLora: Lesson = {
  id: 'adult-lora',
  steps: [
    { id: 'rules', read: true },
    { id: 'files', read: true },
    { id: 'graph', ...imageGraphAtHand },
    {
      id: 'add',
      roles: [node('lora', 'LoraLoader')],
      links: [
        link('checkpoint', 'MODEL', 'lora', 'model'),
        link('checkpoint', 'CLIP', 'lora', 'clip'),
        link('lora', 'MODEL', 'sampler', 'model', LORA_ANY),
        link('lora', 'CLIP', 'positive', 'clip', CLIP_VIA),
        link('lora', 'CLIP', 'negative', 'clip', CLIP_VIA),
      ],
      fields: [field('lora', 'lora_name', chosen)],
    },
    { id: 'family', read: true },
    { id: 'trigger', fields: [field('positive', 'text', { kind: 'has-trigger', of: [{ role: 'lora', field: 'lora_name' }] })] },
    { id: 'strength', read: true },
    { id: 'compare', read: true },
    { id: 'two', read: true },
    { id: 'fight', read: true },
    { id: 'helper', read: true },
  ],
};

/** In the order a person meets them. The lessons for adults are a group of their own at the end (ADULT_LESSONS). */
export const LESSONS: readonly Lesson[] = [
  ...FOUNDATIONS_FIRST,
  image, prompt,
  ...FOUNDATIONS_LESSONS,
  refine, videoText, promptVideo, videoImage, lora, videoFast,
  wrapper, wrapperImage, wrapperVace, wrapperAnimate, wrapperUni, wrapperTalk, wrapperDuo, wrapperFantasy, wrapperOvi, wrapperRecam,
  twoModels,
  ...IMAGE_MODEL_LESSONS,
  ...withFileTable(VIDEO_LESSONS, VIDEO_FILE_KINDS),
  ...IMAGE_TECHNIQUE_LESSONS,
  ...FOUNDATIONS_TOOLS,
  ...SOUND_3D_FACES_LESSONS,
  adultImage, adultLora, adult,
];

/**
 * The lessons about adult content. They are open only while the switch «Содержимое для взрослых (18+)» is on
 * (preferences: adultContentOn); while it is off the list shows them as one closed group that leads to the switch,
 * never hidden. They stand last, as one group, and are never offered as "the next lesson" after an ordinary one.
 */
/** Their group on the learning path: the last one, closed until the switch is on. */
export const ADULT_GROUP: LessonGroup = { id: 'adult', title: { ru: 'Для взрослых (18+)', en: 'For adults (18+)' } };

export const ADULT_LESSONS: ReadonlySet<string> = new Set(['adult-image', 'adult-lora', 'adult']);

export function isAdultLesson(id: string): boolean {
  return ADULT_LESSONS.has(id);
}

/** Whether a lesson can be opened: an ordinary one always, one for adults only while the switch is on. */
export function lessonOpen(id: string, adultOn: boolean): boolean {
  return lessonById(id) !== null && (adultOn || !isAdultLesson(id));
}

/** The lessons that are not for adults, in their order. */
export function ordinaryLessons(): Lesson[] {
  return LESSONS.filter((lesson) => !isAdultLesson(lesson.id));
}

/**
 * The lesson offered at the end of a lesson, the one rule the lesson panel follows. The order is the order of the
 * grouped list (LESSON_PATH groups, in the order they first appear in LESSONS). The next lesson is:
 * - of the same kind: a lesson for adults is never offered after an ordinary one, and an ordinary one after a lesson
 *   for adults; so with the switch off nothing of the closed group comes up by itself;
 * - not done yet, and one that fits this ComfyUI (`fits`; everything fits when it is not given);
 * - preferably one whose lessons it stands on are done (or are the one just finished); failing that, the next that
 *   fits and is not done.
 * Null when nothing is left to offer.
 */
export function nextLesson(id: string, fits: (lessonId: string) => boolean = () => true, done: ReadonlySet<string> = new Set()): Lesson | null {
  const groups: string[] = [];
  for (const lesson of LESSONS) {
    const group = LESSON_PATH[lesson.id]?.group.id ?? '';
    if (!groups.includes(group)) groups.push(group);
  }
  const order = groups.flatMap((group) => LESSONS.filter((lesson) => (LESSON_PATH[lesson.id]?.group.id ?? '') === group).map((lesson) => lesson.id));
  const from = order.indexOf(id);
  if (from < 0) return null;
  const adult = isAdultLesson(id);
  const later = [...order.slice(from + 1), ...order.slice(0, from)];
  const open = later.filter((candidate) => isAdultLesson(candidate) === adult && !done.has(candidate) && fits(candidate));
  const ready = (candidate: string) => [...(LESSON_AFTER[candidate] ?? []), ...(LESSON_PATH[candidate]?.follows ?? [])].every((needed) => needed === id || done.has(needed));
  const found = open.find(ready) ?? open[0];
  return found ? lessonById(found) : null;
}

/** Lessons that stand on the graph of another: said in the list, not enforced. */
export const LESSON_AFTER: Readonly<Record<string, string[]>> = {
  prompt: ['image'],
  refine: ['image'],
  'prompt-video': ['video-text'],
  'video-image': ['video-text'],
  lora: ['video-text'],
  'video-fast': ['lora'],
  'wrapper-image': ['wrapper'],
  'wrapper-vace': ['wrapper'],
  'wrapper-duo': ['wrapper-talk'],
  'two-models': ['video-image'],
  'adult-image': ['image'],
  'adult-lora': ['image'],
  adult: ['video-text'],
  ...IMAGE_MODEL_AFTER,
  ...VIDEO_LESSON_AFTER,
  ...IMAGE_TECHNIQUE_AFTER,
  ...FOUNDATIONS_AFTER,
  ...SOUND_3D_FACES_AFTER,
};

const BASICS_GROUP: LessonGroup = { id: 'basics', title: { en: 'Pictures: first steps', ru: 'Картинки: первые шаги' } };
const WRAPPER_GROUP: LessonGroup = { id: 'wrapper', title: { en: 'WanVideoWrapper', ru: 'WanVideoWrapper' } };

/** Where a lesson stands on the learning path: its group (an id and its title in both languages) and what it goes on from. */
export const LESSON_PATH: Readonly<Record<string, { group: LessonGroup; follows: string[] }>> = {
  ...FOUNDATIONS_PATH,
  ...Object.fromEntries([image, prompt, refine, ...FOUNDATIONS_LESSONS.filter((lesson) => FOUNDATIONS_IN_FIRST_PICTURES.includes(lesson.id))].map((lesson) => [lesson.id, { group: BASICS_GROUP, follows: LESSON_AFTER[lesson.id] ?? [] }])),
  ...Object.fromEntries([videoText, promptVideo, videoImage, lora, videoFast, twoModels].map((lesson) => [lesson.id, { group: VIDEO_GROUP, follows: LESSON_AFTER[lesson.id] ?? [] }])),
  ...Object.fromEntries([wrapper, wrapperImage, wrapperVace, wrapperAnimate, wrapperUni, wrapperTalk, wrapperDuo, wrapperFantasy, wrapperOvi, wrapperRecam].map((lesson) => [lesson.id, { group: WRAPPER_GROUP, follows: LESSON_AFTER[lesson.id] ?? [] }])),
  ...IMAGE_MODEL_PATH,
  ...VIDEO_PATH,
  ...IMAGE_TECHNIQUE_PATH,
  ...SOUND_3D_FACES_PATH,
  'adult-image': { group: ADULT_GROUP, follows: ['image'] },
  'adult-lora': { group: ADULT_GROUP, follows: ['image'] },
  adult: { group: ADULT_GROUP, follows: ['video-text'] },
};

export function lessonById(id: string): Lesson | null {
  return LESSONS.find((lesson) => lesson.id === id) ?? null;
}
