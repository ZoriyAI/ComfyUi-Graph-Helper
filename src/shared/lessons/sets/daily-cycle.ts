/**
 * The group "The daily work cycle" (module N2 of the programme of version 1.1): how a person works with ComfyUI day to
 * day, after the first picture and the reading of a workflow. A template as a starting point that stays untouched, the
 * queue and the history of runs, running only one branch and the cache, the log and a minimal failing example, and
 * the three forms a workflow travels in. All five lessons are of the new standard (standard 2). Their words are in
 * daily-cycle.texts.en.ts and daily-cycle.texts.ru.ts under the same lesson and step ids.
 *
 * Who uses it: lessons.ts joins them into LESSONS; the lesson panel runs them like any lesson.
 *
 * Why the steps are as they are: the app never runs or changes ComfyUI. Whatever happens there (opening a template,
 * pressing Run, cancelling a job, reading the log) is a checklist the person ticks; the app checks the canvas, that
 * every node is installed (workflow-complete), that a graph is small (workflow-size) and that the last workflow it
 * opened was an API-format file (workflow-from). The engine judges the steps cumulatively, so each lesson only adds
 * to its graph; the minimal example therefore starts from any graph that has a Save Image and ends with that saver
 * fed by an Empty Image, and the formats lesson checks the file it opened last only once, at its end.
 *
 * The facts the steps rest on, each confirmed in the app's own knowledge or in ComfyUI's official documentation and
 * source (checked on 2026-11-15):
 * - Templates open from the "Templates" icon of the sidebar or from the Workflow menu, "Browse Templates"
 *   (docs.comfy.org/interface/features/template; the label "Browse Templates" in ComfyUI_frontend
 *   src/locales/en/main.json). Missing models of a template: loaders turn red, a banner "N errors found" with
 *   "View details" opens the Errors tab of the right side panel, where a file can be downloaded (same page).
 *   Templates are a separate package, comfyui-workflow-templates (same page). Official templates often wrap the model
 *   part in a subgraph (knowledge/sets/foundations, "subgraphs").
 * - The menu entries "Save", "Save As", "Export" and "Export (API)" (ComfyUI_frontend main.json, menuLabels).
 * - Ctrl+D loads the default graph; Ctrl+Enter queues, Ctrl+Shift+Enter queues first, Ctrl+Alt+Enter cancels the
 *   current generation (the ComfyUI README, shortcuts).
 * - The run bar: "Run" (Shift queues at the front), the modes "Run (On Change)" and "Run (Instant)", "Cancel"; the
 *   active jobs counter opens the queue, right-click clears it (docs.comfy.org/interface/overview).
 * - "Job History" in the left sidebar, behind the setting "Docked job history/queue panel" (Comfy.Queue.QPOV2) in
 *   versions where it is not on yet; tabs "All", "Completed", "Failed"; per job "Cancel job", "Open as workflow in a
 *   new tab", "Export workflow", "Copy error message"; "Clear queue" cancels pending jobs; "Clear history"
 *   (docs.comfy.org/interface/job-history).
 * - ComfyUI caches outputs and runs only nodes that may give a different result; a node counts as changed when one of
 *   its inputs or widgets changed; output nodes are where execution starts (docs.comfy.org custom-nodes/backend
 *   server_overview; the ComfyUI README: "only the part you changed and the part that depends on it will be
 *   executed"; knowledge/sets/foundations "queue").
 * - Partial execution: select an output node, the selection toolbox shows a run icon, only the branch up to that node
 *   runs; a frontend before about 1.24 may run the whole graph (docs.comfy.org/interface/features/partial-execution).
 *   The menu label "Queue Selected Output Nodes" (ComfyUI_frontend main.json).
 * - Upscale Image By (ImageScaleBy): inputs image, upscale_method, scale_by (default 1.0, 0.01 to 8.0); Empty Image
 *   (EmptyImage): width, height, batch_size, color, output IMAGE; Preview Image keeps pictures in the temp folder
 *   (ComfyUI nodes.py; knowledge/coreKnowledge).
 * - "Prompt executed in … seconds" after every run (ComfyUI main.py, as in sets/experiments.ts).
 * - The bottom panel holds a "Logs" tab (View ▸ Bottom Panel, or the toggle Ctrl+`), and the Desktop app also a
 *   "Terminal" (docs.comfy.org/interface/bottom-panel); the Desktop app keeps log files in
 *   C:\Users\<username>\AppData\Roaming\ComfyUI\logs on Windows; a bug report holds the OS, ComfyUI, Python and
 *   PyTorch versions, the GPU and driver, the installation method, the full error text, the custom nodes and the
 *   workflow .json that reproduces it; system information is on the About page of the settings
 *   (docs.comfy.org/troubleshooting/overview).
 * - Save Image refuses a filename_prefix that leads outside the output folder: "Saving image outside the output folder
 *   is not allowed." (ComfyUI folder_paths.py get_save_image_path). A failing node prints "!!! Exception during
 *   processing !!!" and the traceback (ComfyUI execution.py).
 * - A saved picture carries `workflow` (the whole graph with layout) and `prompt` (the API form that ran) in its
 *   metadata; PNG keeps them as text entries; --disable-metadata turns it off; an editor that rewrites the file may
 *   remove it (docs.comfy.org/development/api-development/workflow-metadata). The API form is keyed by node number
 *   with `class_type` and `inputs`, without positions or notes (same page; docs/wiki/concepts/Workflow-Formats).
 * - This app opens a workflow file, an API-format file (laid out left to right) and a picture or video saved by
 *   ComfyUI with "File ▸ Open workflow…", and saves with "File ▸ Save workflow for ComfyUI…", which asks before it
 *   writes a field that looks like a key or token (docs/wiki/graph/Opening-Workflows, Saving-Workflows; catalog).
 */
import type { FieldSpec, FieldTest, Lesson, LinkSpec, RoleSpec } from '../engine';
import { FILES } from '../files';
import type { LessonGroup } from './image-models';

const node = (role: string, ...classes: string[]): RoleSpec => ({ role, classes });
const link = (from: string, output: string, to: string, input: string, via?: string[]): LinkSpec => (via ? { from, output, to, input, via } : { from, output, to, input });
const field = (role: string, name: string, test: FieldTest, why?: string): FieldSpec => (why ? { role, field: name, test, why } : { role, field: name, test });

/** What may stand between a checkpoint and its sampler: LoRA loaders. */
const LORA_ANY = ['LoraLoader', 'LoraLoaderModelOnly'];
/** What may stand between a checkpoint's text reader and a prompt. */
const CLIP_VIA = ['LoraLoader', 'CLIPSetLastLayer'];

/** The group of the programme's module "The daily work cycle". */
export const DAILY_CYCLE_GROUP: LessonGroup = { id: 'daily-cycle', title: { en: 'The daily work cycle', ru: 'Ежедневный цикл работы' } };

/** The date the lessons were last checked against the versions they name. */
const CHECKED_ON = '2026-11-15';
/** The core nodes the picture graph is made of. */
const CORE_NODES = 'ComfyUI core nodes: Load Checkpoint, CLIP Text Encode, Empty Latent Image, KSampler, VAE Decode, Save Image';
/** The interface the steps in ComfyUI were checked against. */
const FRONTEND = 'ComfyUI frontend as documented on docs.comfy.org on 2026-11-15 (interface overview, templates, job history, bottom panel, partial execution)';

/** The picture graph of the lesson "image", with a Save Image at its end. */
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

/** The checklist that opens every lesson: ComfyUI read, a picture model there, the version written down. */
const READY = {
  id: 'ready',
  checklist: [
    { id: 'comfy', check: { kind: 'comfy-read' as const } },
    { id: 'model', check: { kind: 'model-file' as const, folder: 'checkpoints' } },
    { id: 'version' },
  ],
};

/**
 * N07: a template as a documented starting point. Open it in ComfyUI, keep it untouched by saving a copy first, find
 * its inputs, outputs, models and notes, carry the copy into the app, change it for a new task, run it.
 */
const templateOwn: Lesson = {
  id: 'template-own',
  standard: 2,
  outcomes: ['structure', 'run', 'result'],
  meta: { prerequisites: ['image', 'read-workflow'], versions: [CORE_NODES, FRONTEND], checkedOn: CHECKED_ON },
  steps: [
    { id: 'intro', read: true },
    READY,
    { id: 'open', checklist: [{ id: 'browse' }, { id: 'models' }, { id: 'copy' }, { id: 'export' }] },
    { id: 'read-template', read: true },
    { id: 'graph', ...baseGraph },
    { id: 'map', checklist: [{ id: 'inputs' }, { id: 'outputs' }, { id: 'files' }, { id: 'notes' }] },
    {
      id: 'change',
      fields: [
        field('latent', 'width', { kind: 'between', min: 640, max: 1600, prefer: 768 }, 'daily.wideWidth'),
        field('latent', 'height', { kind: 'less', role: 'latent', field: 'width' }, 'daily.wide'),
        field('latent', 'batch_size', { kind: 'between', min: 2, max: 4, prefer: 2 }, 'daily.batch'),
        field('save', 'filename_prefix', { kind: 'text', minChars: 7, has: ['banner/'] }),
      ],
    },
    { id: 'complete', readCheck: [{ kind: 'workflow-complete' }] },
    { id: 'run', checklist: [{ id: 'save' }, { id: 'ran', run: true }, { id: 'untouched' }] },
    {
      id: 'assess',
      rubric: [
        { id: 'places', levels: ['no', 'partly', 'yes'] },
        { id: 'task', levels: ['no', 'partly', 'yes'] },
        { id: 'apart', levels: ['no', 'yes'], pass: 'yes' },
      ],
    },
    {
      id: 'recall',
      quiz: [
        { id: 'first', choices: ['run', 'copy', 'delete'], answer: 'copy' },
        { id: 'missing', choices: ['any-site', 'shown-link', 'rename'], answer: 'shown-link' },
        { id: 'output', choices: ['loader', 'saver', 'sampler'], answer: 'saver' },
      ],
    },
    { id: 'transfer', transfer: true, checklist: [{ id: 'other' }, { id: 'map' }, { id: 'own' }] },
  ],
};

/**
 * N08: the queue. Several jobs queued on purpose, one cancelled while waiting, the running one stopped, a finished one
 * found in the history and opened again with its settings.
 */
const queueHistory: Lesson = {
  id: 'queue-history',
  standard: 2,
  outcomes: ['structure', 'run', 'result'],
  meta: { prerequisites: ['image'], versions: [CORE_NODES, FRONTEND], checkedOn: CHECKED_ON },
  steps: [
    { id: 'intro', read: true },
    READY,
    { id: 'graph', ...baseGraph },
    { id: 'name', fields: [field('save', 'filename_prefix', { kind: 'text', minChars: 6, has: ['queue/'] })] },
    { id: 'complete', readCheck: [{ kind: 'workflow-complete' }] },
    { id: 'where', read: true },
    { id: 'queue', checklist: [{ id: 'open' }, { id: 'three', run: true }, { id: 'counter' }] },
    { id: 'cancel', checklist: [{ id: 'waiting' }, { id: 'running' }, { id: 'states' }] },
    { id: 'history', checklist: [{ id: 'find' }, { id: 'reopen' }, { id: 'file' }] },
    {
      id: 'assess',
      rubric: [
        { id: 'states', levels: ['no', 'partly', 'yes'] },
        { id: 'restore', levels: ['no', 'partly', 'yes'] },
        { id: 'blind', levels: ['often', 'once', 'never'] },
      ],
    },
    {
      id: 'recall',
      quiz: [
        { id: 'same', choices: ['new', 'cached', 'error'], answer: 'cached' },
        { id: 'clear', choices: ['all', 'pending', 'history'], answer: 'pending' },
        { id: 'urgent', choices: ['shift', 'twice', 'restart'], answer: 'shift' },
      ],
    },
    { id: 'transfer', transfer: true, checklist: [{ id: 'series' }, { id: 'drop' }, { id: 'best' }] },
  ],
};

/** The lessons of the group, in the order a person meets them. */
export const DAILY_CYCLE_LESSONS: Lesson[] = [templateOwn, queueHistory];

/** The group of each lesson and the lessons it goes on from. */
export const DAILY_CYCLE_PATH: Record<string, { group: LessonGroup; follows: string[] }> = {
  'template-own': { group: DAILY_CYCLE_GROUP, follows: ['read-workflow'] },
  'queue-history': { group: DAILY_CYCLE_GROUP, follows: ['template-own'] },
};

/**
 * The graph each lesson starts from. The minimal example starts from any graph with a Save Image and ends small, so it
 * stands on no lesson's graph: carried on from the picture graph, its end would not be small.
 */
export const DAILY_CYCLE_AFTER: Record<string, string[]> = {
  'template-own': ['image'],
  'queue-history': ['image'],
};
