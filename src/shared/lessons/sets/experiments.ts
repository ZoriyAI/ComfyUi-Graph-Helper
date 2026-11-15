/**
 * The group "Experiments and quality": the first lessons of the new standard (standard 2), written as the one end to
 * end example the programme of version 1.1 asked for. They use every kind of step: a checklist done outside the app
 * (some items checked by the app itself), canvas steps, a read-check, a rubric, a quiz and a transfer task. Their words
 * are in experiments.texts.en.ts and experiments.texts.ru.ts under the same lesson and step ids.
 *
 * Who uses it: lessons.ts joins them into LESSONS; the lesson panel runs them like any lesson.
 *
 * The facts the steps rest on, each confirmed in the app's own knowledge (knowledge/coreKnowledge.*.ts) or in the
 * official ComfyUI documentation:
 * - KSampler: `seed` is "the random seed used for creating the noise"; `cfg` starts at 8.0; `steps`, `sampler_name`,
 *   `scheduler` and `denoise` are its other settings (docs.comfy.org, built-in nodes, KSampler).
 * - `control_after_generate` under `seed`: randomize, increment, decrement or fixed after each run (coreKnowledge).
 * - ComfyUI reuses results: a run with nothing changed ends at once (coreKnowledge, "queue"). So a true repeat is made
 *   after ComfyUI was restarted.
 * - Save Image writes to the output folder; a folder can be given in `filename_prefix` (docs.comfy.org, the note on the
 *   deprecated dataset saver: "the target folder can be specified in the filename prefix").
 * - ComfyUI prints "Prompt executed in … seconds" for every run (ComfyUI main.py).
 * - A picture saved by Save Image carries its workflow: the app opens a workflow from such a picture (files/openFile.ts).
 */
import type { FieldSpec, FieldTest, Lesson, LinkSpec, RoleSpec } from '../engine';
import { FILES } from '../files';
import type { LessonGroup } from './image-models';

const node = (role: string, ...classes: string[]): RoleSpec => ({ role, classes });
const link = (from: string, output: string, to: string, input: string, via?: string[]): LinkSpec => (via ? { from, output, to, input, via } : { from, output, to, input });
const field = (role: string, name: string, test: FieldTest, why?: string): FieldSpec => (why ? { role, field: name, test, why } : { role, field: name, test });
const same = (role: string, name: string): FieldTest => ({ kind: 'same', role, field: name });

/** What may stand between a checkpoint and its sampler: LoRA loaders. */
const LORA_ANY = ['LoraLoader', 'LoraLoaderModelOnly'];
/** What may stand between a checkpoint's text reader and a prompt. */
const CLIP_VIA = ['LoraLoader', 'CLIPSetLastLayer'];

/** The group of the new programme's module "Experiments and quality". */
export const EXPERIMENTS_GROUP: LessonGroup = { id: 'experiments', title: { en: 'Experiments and quality', ru: 'Эксперименты и качество' } };

/** The date both lessons were last checked against the versions they name. */
const CHECKED_ON = '2026-11-15';
/** What both lessons were written against. */
const VERSIONS = ['ComfyUI core nodes: Load Checkpoint, CLIP Text Encode, Empty Latent Image, KSampler, VAE Decode, Save Image'];

/**
 * A second variant of the picture: its own sampler, decoder and saver, fed by the same model, prompts and blank as
 * the first. `suffix` names its roles (samplerB, decodeB, saveB).
 */
function variant(suffix: string): { roles: RoleSpec[]; links: LinkSpec[] } {
  const sampler = `sampler${suffix}`;
  const decode = `decode${suffix}`;
  const save = `save${suffix}`;
  return {
    roles: [node(sampler, 'KSampler'), node(decode, 'VAEDecode'), node(save, 'SaveImage')],
    links: [
      link('checkpoint', 'MODEL', sampler, 'model', LORA_ANY),
      link('positive', 'CONDITIONING', sampler, 'positive'),
      link('negative', 'CONDITIONING', sampler, 'negative'),
      link('latent', 'LATENT', sampler, 'latent_image'),
      link(sampler, 'LATENT', decode, 'samples'),
      link('checkpoint', 'VAE', decode, 'vae'),
      link(decode, 'IMAGE', save, 'images'),
    ],
  };
}

/** Every setting of a variant's sampler but one stays as in the first sampler. */
function sameAsFirst(sampler: string, except: string): FieldSpec[] {
  return ['seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'].filter((name) => name !== except).map((name) => field(sampler, name, same('sampler', name)));
}

/** The picture graph of the first lesson with a Save Image at its end: the first variant. */
const baseGraph = {
  roles: [
    node('checkpoint', 'CheckpointLoaderSimple'),
    node('positive', 'CLIPTextEncode'),
    node('negative', 'CLIPTextEncode'),
    node('latent', 'EmptyLatentImage'),
    node('sampler', 'KSampler'),
    node('decode', 'VAEDecode'),
    node('save', 'SaveImage'),
  ],
  links: [
    link('checkpoint', 'CLIP', 'positive', 'clip', CLIP_VIA),
    link('checkpoint', 'CLIP', 'negative', 'clip', CLIP_VIA),
    link('checkpoint', 'MODEL', 'sampler', 'model', LORA_ANY),
    link('positive', 'CONDITIONING', 'sampler', 'positive'),
    link('negative', 'CONDITIONING', 'sampler', 'negative'),
    link('latent', 'LATENT', 'sampler', 'latent_image'),
    link('sampler', 'LATENT', 'decode', 'samples'),
    link('checkpoint', 'VAE', 'decode', 'vae'),
    link('decode', 'IMAGE', 'save', 'images'),
  ],
  fields: [
    field('checkpoint', 'ckpt_name', { kind: 'file', want: FILES.imageCheckpoint }),
    field('positive', 'text', { kind: 'text', minChars: 3, words: 2 }),
  ],
};

/**
 * N20 of the programme: a controlled experiment. Two variants from one model, one prompt, one blank and one seed,
 * apart in one setting only (cfg); run, repeated after a restart, assessed; then the same method on another setting
 * without help.
 */
const oneFactor: Lesson = {
  id: 'one-factor',
  standard: 2,
  outcomes: ['structure', 'run', 'result'],
  meta: { prerequisites: ['image', 'sampler-fields'], versions: VERSIONS, checkedOn: CHECKED_ON },
  steps: [
    { id: 'intro', read: true },
    {
      id: 'ready',
      checklist: [
        { id: 'comfy', check: { kind: 'comfy-read' } },
        { id: 'model', check: { kind: 'model-file', folder: 'checkpoints' } },
        { id: 'question' },
      ],
    },
    { id: 'graph', ...baseGraph },
    { id: 'seed', read: true },
    { id: 'second', ...variant('B') },
    {
      id: 'factor',
      fields: [
        field('sampler', 'cfg', { kind: 'between', min: 3, max: 5, prefer: 4 }, 'ex.cfgLow'),
        field('samplerB', 'cfg', { kind: 'between', min: 7, max: 9, prefer: 8 }, 'ex.cfgHigh'),
        ...sameAsFirst('samplerB', 'cfg'),
      ],
    },
    {
      id: 'names',
      fields: [
        field('save', 'filename_prefix', { kind: 'text', minChars: 3 }),
        field('saveB', 'filename_prefix', { kind: 'differs', role: 'save', field: 'filename_prefix' }),
      ],
    },
    { id: 'complete', readCheck: [{ kind: 'workflow-complete' }] },
    {
      id: 'run',
      checklist: [
        { id: 'export' },
        { id: 'ran', run: true },
        { id: 'fixed' },
        { id: 'repeat', run: true },
      ],
    },
    {
      id: 'assess',
      rubric: [
        { id: 'difference', levels: ['no', 'partly', 'yes'] },
        { id: 'repeat', levels: ['no', 'nearly', 'yes'] },
        { id: 'conclusion', levels: ['no', 'partly', 'yes'] },
      ],
    },
    {
      id: 'recall',
      quiz: [
        { id: 'two-changes', choices: ['cfg', 'seed', 'unknown'], answer: 'unknown' },
        { id: 'same-seed', choices: ['faster', 'same-noise', 'required'], answer: 'same-noise' },
        { id: 'cache', choices: ['new', 'cached', 'error'], answer: 'cached' },
      ],
    },
    {
      id: 'transfer',
      transfer: true,
      roles: [node('samplerC', 'KSampler'), node('decodeC', 'VAEDecode'), node('saveC', 'SaveImage')],
      links: variant('C').links,
      fields: [
        ...sameAsFirst('samplerC', 'sampler_name'),
        field('samplerC', 'sampler_name', { kind: 'differs', role: 'sampler', field: 'sampler_name' }),
      ],
    },
  ],
};

/**
 * N22 of the programme: a quality rubric and a blind comparison. The criteria are written before the run, the two
 * variants are saved under names that do not tell them apart, scored blind, and only then compared with time noted.
 */
const blindCompare: Lesson = {
  id: 'blind-compare',
  standard: 2,
  outcomes: ['structure', 'run', 'result'],
  meta: { prerequisites: ['one-factor'], versions: VERSIONS, checkedOn: CHECKED_ON },
  steps: [
    { id: 'intro', read: true },
    { id: 'criteria', checklist: [{ id: 'task' }, { id: 'criteria' }, { id: 'cost', optional: true }] },
    { id: 'graph', ...baseGraph },
    {
      id: 'second',
      ...variant('B'),
      fields: sameAsFirst('samplerB', 'cfg'),
    },
    {
      id: 'blind-names',
      fields: [
        field('save', 'filename_prefix', { kind: 'text', minChars: 7, has: ['blind/'] }),
        field('saveB', 'filename_prefix', { kind: 'text', minChars: 7, has: ['blind/'] }),
        field('saveB', 'filename_prefix', { kind: 'differs', role: 'save', field: 'filename_prefix' }),
      ],
    },
    { id: 'shuffle', read: true },
    { id: 'run', checklist: [{ id: 'ran', run: true }, { id: 'shuffled' }, { id: 'time' }] },
    {
      id: 'score',
      rubric: [
        { id: 'subject', levels: ['no', 'partly', 'yes'] },
        { id: 'defects', levels: ['many', 'few', 'none'] },
        { id: 'task', levels: ['no', 'partly', 'yes'] },
        { id: 'blind', levels: ['no', 'yes'], pass: 'yes' },
      ],
    },
    { id: 'picture', readCheck: [{ kind: 'workflow-from', from: 'picture' }] },
    {
      id: 'recall',
      quiz: [
        { id: 'before', choices: ['before', 'after', 'any'], answer: 'before' },
        { id: 'why-blind', choices: ['speed', 'bias', 'rules'], answer: 'bias' },
        { id: 'tie', choices: ['prettier', 'cheaper', 'random'], answer: 'cheaper' },
      ],
    },
    { id: 'transfer', transfer: true, checklist: [{ id: 'pair' }, { id: 'three' }, { id: 'table' }] },
  ],
};

/** The lessons of the group, in the order a person meets them. */
export const EXPERIMENT_LESSONS: Lesson[] = [oneFactor, blindCompare];

/** The group of each lesson and the lessons it goes on from. */
export const EXPERIMENT_PATH: Record<string, { group: LessonGroup; follows: string[] }> = {
  'one-factor': { group: EXPERIMENTS_GROUP, follows: ['sampler-fields'] },
  'blind-compare': { group: EXPERIMENTS_GROUP, follows: ['one-factor'] },
};

/** The graph each lesson starts from. */
export const EXPERIMENT_AFTER: Record<string, string[]> = {
  'one-factor': ['image'],
  'blind-compare': ['one-factor'],
};
