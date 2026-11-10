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

const image: Lesson = {
  id: 'image',
  steps: [
    { id: 'intro', read: true },
    { id: 'model', roles: [node('checkpoint', 'CheckpointLoaderSimple')], fields: [field('checkpoint', 'ckpt_name', chosen)] },
    { id: 'prompts', roles: [node('positive', 'CLIPTextEncode'), node('negative', 'CLIPTextEncode')] },
    { id: 'prompts-clip', links: [link('checkpoint', 'CLIP', 'positive', 'clip'), link('checkpoint', 'CLIP', 'negative', 'clip')] },
    { id: 'prompt-text', fields: [field('positive', 'text', { kind: 'text', minChars: 3 })] },
    { id: 'latent', roles: [node('latent', 'EmptyLatentImage')] },
    { id: 'sampler', roles: [node('sampler', 'KSampler')] },
    {
      id: 'sampler-links',
      links: [
        link('checkpoint', 'MODEL', 'sampler', 'model'),
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

const triggerInPrompt = field('positive', 'text', { kind: 'has-trigger', of: [{ role: 'loraHigh', field: 'lora_name' }, { role: 'loraLow', field: 'lora_name' }] });

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

const adult: Lesson = {
  id: 'adult',
  steps: [
    { id: 'rules', read: true },
    { id: 'levers', read: true },
    { id: 'model', read: true },
    { id: 'graph', ...videoGraphAtHand },
    { id: 'lora', ...loraInBothPaths },
    { id: 'prompt', read: true },
    { id: 'trigger', roles: promptInUse.roles, links: promptInUse.links, fields: [triggerInPrompt] },
    { id: 'defects', read: true },
    { id: 'helper', read: true },
  ],
};

/** In the order a person meets them. */
export const LESSONS: readonly Lesson[] = [image, videoText, videoImage, lora, videoFast, adult];

/** Lessons that stand on the graph of another: said in the list, not enforced. */
export const LESSON_AFTER: Readonly<Record<string, string[]>> = {
  'video-image': ['video-text'],
  lora: ['video-text'],
  'video-fast': ['lora'],
  adult: ['lora'],
};

export function lessonById(id: string): Lesson | null {
  return LESSONS.find((lesson) => lesson.id === id) ?? null;
}
