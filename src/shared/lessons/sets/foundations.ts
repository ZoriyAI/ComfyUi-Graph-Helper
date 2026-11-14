import type { FieldSpec, FieldTest, Lesson, LinkSpec, RoleSpec } from '../engine';
import type { LessonGroup } from './image-models';
import { PACKS_GROUP } from './video';

/**
 * The lessons of the foundations domain: what a newcomer needs before and around every other lesson. Their words
 * are in foundations.texts.ru.ts and foundations.texts.en.ts under the same lesson and step ids.
 *
 * Every graph here is one an official ComfyUI template or ComfyUI's own source confirms:
 * - comfy-basics: Load Image into Preview Image and Load Checkpoint, nodes.py (inputs and outputs), README "Only parts
 *   of the graph that have an output with all the correct inputs will be executed".
 * - sampler-fields: the KSampler of image_sdxl_simple.json (25 steps, cfg 7, dpmpp_2m, karras, denoise 1).
 * - vram: VAE Decode (Tiled) after a sampler, as in video_ltx2_3_i2v.json and utility_seedvr2_*.json (tile_size
 *   512 is its default in nodes.py); batch_size of Empty Latent Image.
 * - read-workflow: one Int node into the width and the height of the blank, as in
 *   image_ming_image_01_design_image_edit.json (PrimitiveInt into EmptyLatentImage width and height).
 * - switch: two Text (Multiline) nodes and a Boolean into If/Else Switch, its output into the text of CLIP Text
 *   Encode, as in basic_switch_node.json and audio_stable_audio_3_medium.json.
 * - llm-prompt: Load CLIP into Generate Text, the prompt into its prompt and an instruction into system_prompt,
 *   generated_text into the switch and into Preview as Text, as in llm_qwen3_text_gen.json and
 *   image_flux3_klein_t2i.json.
 */

const node = (role: string, ...classes: string[]): RoleSpec => ({ role, classes });
const link = (from: string, output: string, to: string, input: string, via?: string[]): LinkSpec => (via ? { from, output, to, input, via } : { from, output, to, input });
const field = (role: string, name: string, test: FieldTest): FieldSpec => ({ role, field: name, test });
const chosen: FieldTest = { kind: 'chosen' };
const equals = (value: string | number | boolean): FieldTest => ({ kind: 'equals', value });
const between = (min: number, max: number, prefer: number): FieldTest => ({ kind: 'between', min, max, prefer });

/** What may stand between a checkpoint and its sampler without breaking the way: LoRA loaders. */
const LORA_ANY = ['LoraLoader', 'LoraLoaderModelOnly'];

/** The picture graph of the first lesson, as far as a lesson that goes on from it needs it. */
const pictureGraph = {
  roles: [
    node('checkpoint', 'CheckpointLoaderSimple'),
    node('latent', 'EmptyLatentImage'),
    node('sampler', 'KSampler'),
    node('save', 'SaveImage', 'PreviewImage'),
  ],
  links: [link('checkpoint', 'MODEL', 'sampler', 'model', LORA_ANY), link('latent', 'LATENT', 'sampler', 'latent_image')],
};

/** The prompt that says what is wanted: the text node whose output reaches the sampler's positive input. */
const promptInUse = {
  roles: [node('positive', 'CLIPTextEncode'), node('sampler', 'KSampler')],
  links: [link('positive', 'CONDITIONING', 'sampler', 'positive')],
};

/** Before the first lesson: what ComfyUI is, three small practices, and how a graph gets from here to ComfyUI. */
const comfyBasics: Lesson = {
  id: 'comfy-basics',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', read: true },
    { id: 'find-node', roles: [node('picture', 'LoadImage')], fields: [field('picture', 'image', chosen)] },
    { id: 'output', roles: [node('look', 'PreviewImage')], links: [link('picture', 'IMAGE', 'look', 'images')] },
    { id: 'queue', read: true },
    { id: 'results', read: true },
    { id: 'folders', read: true },
    { id: 'model-file', roles: [node('model', 'CheckpointLoaderSimple')], fields: [field('model', 'ckpt_name', chosen)] },
    { id: 'packs', read: true },
    { id: 'run', read: true },
  ],
};

/** The sampler's fields on the first picture graph, with the values of ComfyUI's SDXL template. */
const samplerFields: Lesson = {
  id: 'sampler-fields',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...pictureGraph },
    { id: 'seed', read: true },
    { id: 'steps', fields: [field('sampler', 'steps', equals(25))] },
    { id: 'cfg', fields: [field('sampler', 'cfg', equals(7))] },
    { id: 'method', read: true },
    { id: 'sampler-name', fields: [field('sampler', 'sampler_name', equals('dpmpp_2m')), field('sampler', 'scheduler', equals('karras'))] },
    { id: 'denoise', fields: [field('sampler', 'denoise', equals(1))] },
    { id: 'size', read: true },
    { id: 'run', read: true },
  ],
};

/** Memory of the graphics card, practised on the first picture graph: one picture at a time, the tiled decode. */
const vram: Lesson = {
  id: 'vram',
  steps: [
    { id: 'intro', read: true },
    { id: 'error', read: true },
    { id: 'graph', ...pictureGraph },
    { id: 'batch', fields: [field('latent', 'batch_size', equals(1))] },
    { id: 'size', read: true },
    {
      id: 'tiled',
      roles: [node('tiled', 'VAEDecodeTiled')],
      links: [link('sampler', 'LATENT', 'tiled', 'samples'), link('checkpoint', 'VAE', 'tiled', 'vae')],
      fields: [field('tiled', 'tile_size', between(256, 512, 512))],
    },
    { id: 'save', links: [link('tiled', 'IMAGE', 'save', 'images')] },
    { id: 'formats', read: true },
    { id: 'offload', read: true },
    { id: 'order', read: true },
  ],
};

/** Reading someone else's workflow, with one practice on the first picture graph: one value for two fields. */
const readWorkflow: Lesson = {
  id: 'read-workflow',
  steps: [
    { id: 'intro', read: true },
    { id: 'notes', read: true },
    { id: 'groups', read: true },
    { id: 'reroutes', read: true },
    { id: 'primitives', read: true },
    { id: 'graph', roles: [node('latent', 'EmptyLatentImage')] },
    {
      id: 'size',
      roles: [node('size', 'PrimitiveInt')],
      links: [link('size', 'INT', 'latent', 'width'), link('size', 'INT', 'latent', 'height')],
      fields: [field('size', 'value', between(512, 1024, 1024))],
    },
    { id: 'set-get', read: true },
    { id: 'bypass', read: true },
    { id: 'subgraphs', read: true },
    { id: 'check', read: true },
  ],
};

/** Two versions of a prompt in one graph, chosen by one yes/no value. */
const switchLesson: Lesson = {
  id: 'switch',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', ...promptInUse },
    { id: 'texts', roles: [node('first', 'PrimitiveStringMultiline')], fields: [field('first', 'value', { kind: 'text', minChars: 10 })] },
    { id: 'second', roles: [node('second', 'PrimitiveStringMultiline')], fields: [field('second', 'value', { kind: 'differs', role: 'first', field: 'value' })] },
    {
      id: 'choice',
      roles: [node('choice', 'ComfySwitchNode')],
      links: [link('first', 'STRING', 'choice', 'on_false'), link('second', 'STRING', 'choice', 'on_true')],
    },
    { id: 'into-prompt', links: [link('choice', 'output', 'positive', 'text')] },
    { id: 'flag', roles: [node('flag', 'PrimitiveBoolean')], links: [link('flag', 'BOOLEAN', 'choice', 'switch')], fields: [field('flag', 'value', equals(true))] },
    { id: 'compare', read: true },
    { id: 'run', read: true },
  ],
};

/** A language model inside ComfyUI rewrites the prompt; the switch of the lesson before compares it with yours. */
const llmPrompt: Lesson = {
  id: 'llm-prompt',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'graph',
      roles: [node('positive', 'CLIPTextEncode'), node('choice', 'ComfySwitchNode'), node('idea', 'PrimitiveStringMultiline')],
      links: [link('choice', 'output', 'positive', 'text'), link('idea', 'STRING', 'choice', 'on_false')],
    },
    { id: 'model', roles: [node('llmClip', 'CLIPLoader')], fields: [field('llmClip', 'clip_name', chosen)] },
    {
      id: 'generate',
      roles: [node('llm', 'TextGenerateV2', 'TextGenerate')],
      links: [link('llmClip', 'CLIP', 'llm', 'clip'), link('idea', 'STRING', 'llm', 'prompt')],
      fields: [field('llm', 'max_length', between(256, 1024, 512))],
    },
    { id: 'into-switch', links: [link('llm', 'generated_text', 'choice', 'on_true')] },
    {
      id: 'instruction',
      roles: [node('instruction', 'PrimitiveStringMultiline')],
      links: [link('instruction', 'STRING', 'llm', 'system_prompt')],
      fields: [field('instruction', 'value', { kind: 'text', minChars: 30 })],
    },
    { id: 'preview', roles: [node('preview', 'PreviewAny')], links: [link('llm', 'generated_text', 'preview', 'source')] },
    { id: 'memory', read: true },
    { id: 'packs', read: true },
    { id: 'run', read: true },
  ],
};

/** The domain's lessons in the order a person meets them. The first one comes before every other lesson. */
export const FOUNDATIONS_FIRST: readonly Lesson[] = [comfyBasics];
export const FOUNDATIONS_LESSONS: readonly Lesson[] = [samplerFields, readWorkflow, vram, switchLesson, llmPrompt];

/** Lessons that stand on the graph of another. */
export const FOUNDATIONS_AFTER: Readonly<Record<string, string[]>> = {
  'sampler-fields': ['image'],
  vram: ['image'],
  'read-workflow': ['image'],
  switch: ['image'],
  'llm-prompt': ['switch'],
};

/**
 * The first group of the learning path: what a newcomer needs before and around every other lesson. The lesson list
 * orders groups by their first lesson in LESSONS, and "How ComfyUI works" is the first lesson of all.
 */
export const FOUNDATIONS_GROUP: LessonGroup = { id: 'foundations', title: { ru: 'Основы ComfyUI', en: 'ComfyUI basics' } };

/** Lessons of this set that belong to the group of the first pictures (lessons.ts puts them there). */
export const FOUNDATIONS_IN_FIRST_PICTURES: readonly string[] = ['sampler-fields'];

/**
 * Where each lesson of the domain stands on the learning path (LESSON_PATH in lessons.ts): its group and the
 * lessons it goes on from as knowledge. The graph a lesson stands on, if any, is FOUNDATIONS_AFTER. The lessons of
 * FOUNDATIONS_IN_FIRST_PICTURES are not here: lessons.ts gives them the group of the first pictures.
 */
export const FOUNDATIONS_PATH: Readonly<Record<string, { group: LessonGroup; follows: string[] }>> = {
  'comfy-basics': { group: FOUNDATIONS_GROUP, follows: [] },
  'read-workflow': { group: FOUNDATIONS_GROUP, follows: ['comfy-basics', 'image'] },
  vram: { group: FOUNDATIONS_GROUP, follows: ['image'] },
  switch: { group: PACKS_GROUP, follows: ['image'] },
  'llm-prompt': { group: PACKS_GROUP, follows: ['switch'] },
};
