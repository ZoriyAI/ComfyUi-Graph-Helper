/**
 * The set "reliable-practice": four lessons of the new standard (standard 2) from the audit's modules "Models,
 * experiments and quality" and "Diagnostics, performance and safety". `model-card` (N18) joins the group of the two
 * experiment lessons (EXPERIMENTS_GROUP); `diagnose-missing` (N30), `audit-workflow` (N35) and `partner-cost` (N36)
 * open the group "Diagnostics, performance and safety". Their words are in reliable-practice.texts.en.ts and
 * reliable-practice.texts.ru.ts under the same lesson and step ids.
 *
 * Who uses it: lessons.ts joins them into LESSONS, LESSON_PATH and LESSON_AFTER; the lesson panel runs them like any
 * lesson. The app only reads ComfyUI: whatever a person does in ComfyUI (install, update, run, snapshot, Manager) is a
 * checklist item that is their own word; a read-check is used only where the app can really tell.
 *
 * The facts the steps rest on, each confirmed (checked on 2026-11-15):
 * - A checkpoint holds the diffusion model, its text encoder (CLIP) and its VAE; Load Diffusion Model loads only the
 *   diffusion model from models/diffusion_models; Load VAE and Load CLIP add the rest (knowledge/coreKnowledge.en.ts).
 * - The text encoder must be the one the family was trained with (knowledge/sets/foundations.en.ts "text-encoders");
 *   a LoRA works only with the family it was made for (reasons "sameFamily"; ComfyUI docs, troubleshooting/model-issues:
 *   "SD1.5 ControlNets only work with SD1.5 checkpoints"); "lora key not loaded" in the console when it does not fit
 *   (foundations.en.ts errors "lora-keys").
 * - fp16, bf16, fp8 and GGUF files of one model (foundations.en.ts "vram-formats").
 * - The app's model card: Family with where it is known from ("from the file metadata", "from the description next to
 *   the file", "from the file name", "from the internet"), Kind, Size, Folder, the warning on .ckpt, .pt, .pth and .bin,
 *   Find on the internet sending the fingerprint to civitai.com and the name to huggingface.co, Add to canvas
 *   (docs/wiki/interface/Model-Card.md, i18n catalog modelCard).
 * - A Hugging Face model card is the repository's README.md with a YAML block on top that holds `license` and
 *   `base_model`; the license is shown on the model page (huggingface.co/docs/hub/model-cards).
 * - Pickle formats (.ckpt, .pt, .pth, .bin) can run code when loaded; .safetensors holds only tensors
 *   (docs/wiki/concepts/Unsafe-Model-Formats.md, foundations.en.ts "pack-safety").
 * - ComfyUI logs "Import times for custom nodes:" at start, with " (IMPORT FAILED)" after a pack that failed, and
 *   "Cannot import … module for custom nodes:" with the traceback (ComfyUI nodes.py, init_external_custom_nodes and
 *   load_custom_node).
 * - "Value not in list: ckpt_name: … not in []" for a missing model; "mat1 and mat2 shapes cannot be multiplied" for
 *   parts of different families; "Error while deserializing header" for a damaged file (docs.comfy.org,
 *   troubleshooting/model-issues).
 * - Most reported problems come from custom nodes; `--disable-all-custom-nodes` starts ComfyUI without them; frontend
 *   extensions are switched off in the settings; halving custom_nodes finds the pack, after a backup of the folder;
 *   the About page in the settings gives the ComfyUI, Python and PyTorch versions (docs.comfy.org,
 *   troubleshooting/overview and troubleshooting/custom-node-issues; ComfyUI comfy/cli_args.py).
 * - ComfyUI Manager: "Install Missing Custom Nodes", "Save snapshot" and "Restore" (applied at the next start),
 *   `security_level`, `allow_git_url_install` and `allow_pip_install` off by default and only on a loopback address
 *   (github.com/Comfy-Org/ComfyUI-Manager README); the frontend names "Install Missing Custom Nodes" and the dialog
 *   "This workflow is missing models" (ComfyUI_frontend, src/locales/en/main.json, main branch).
 * - The Registry forbids eval and exec, package installs at run time and obfuscated code (docs.comfy.org,
 *   registry/standards). A pack runs with the rights of ComfyUI (foundations.en.ts "pack-safety").
 * - `--listen` defaults to 127.0.0.1; given without an address it listens on every address (comfy/cli_args.py).
 * - Partner nodes: run on the provider's hardware, need a signed-in Comfy account and prepaid credits (Settings ▸
 *   Credits), send their inputs to the provider, are switched off by
 *   `--disable-partner-nodes`; prices are in credits on the pricing page and the node badge estimates the cost; the
 *   model providers table gives commercial licensing (Cloud, Local) and data residency, many rows still "Pending"
 *   (docs.comfy.org tutorials/partner-nodes overview, pricing and model-providers; foundations.en.ts "partner-nodes").
 * - The app marks a paid node "Paid" in the node search and on the canvas (docs/wiki/graph/Adding-Nodes.md, catalog
 *   editing.marks.api); the read-check workflow-partner reads the same flag (steps.ts).
 * - The app's Check graph and Explain a ComfyUI error… (Graph menu and Help menu) (docs/wiki/interface/Graph-Menu.md,
 *   Check-Panel.md; catalog checkGraph and runGuide.errorButton).
 */
import type { FieldSpec, FieldTest, Lesson, LinkSpec, RoleSpec } from '../engine';
import { FILES } from '../files';
import { EXPERIMENTS_GROUP } from './experiments';
import type { LessonGroup } from './image-models';

const node = (role: string, ...classes: string[]): RoleSpec => ({ role, classes });
const link = (from: string, output: string, to: string, input: string, via?: string[]): LinkSpec => (via ? { from, output, to, input, via } : { from, output, to, input });
const field = (role: string, name: string, test: FieldTest, why?: string): FieldSpec => (why ? { role, field: name, test, why } : { role, field: name, test });

/** What may stand between a checkpoint and its sampler: LoRA loaders. */
const LORA_ANY = ['LoraLoader', 'LoraLoaderModelOnly'];
/** What may stand between a checkpoint's text reader and a prompt. */
const CLIP_VIA = ['LoraLoader', 'CLIPSetLastLayer'];

/** The group of the audit's module "Diagnostics, performance and safety". */
export const DIAGNOSTICS_GROUP: LessonGroup = { id: 'diagnostics', title: { en: 'Diagnostics, performance and safety', ru: 'Диагностика, производительность и безопасность' } };

/** The date every lesson of the set was last checked against the versions it names. */
const CHECKED_ON = '2026-11-15';
/** The core nodes the small picture graph uses. */
const CORE = 'ComfyUI core nodes: Load Checkpoint, CLIP Text Encode, Empty Latent Image, KSampler, VAE Decode, Save Image';
/** The interface the menu names were read from. */
const FRONTEND = 'ComfyUI frontend and ComfyUI Manager as documented on 2026-11-15 (docs.comfy.org, the main branches of their repositories)';

/**
 * The small picture graph of the first lesson with a Save Image at its end: a known-good baseline (N30), the graph
 * a model is tried in (N18) and the local alternative to a paid node (N36).
 */
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
 * N18: read what a model is before it goes into a graph. The person reads the app's model card and the model's own
 * page, writes a compatibility card with its unknowns marked, then tries the model with a LoRA of its family: the
 * app holds the LoRA to the checkpoint's family on the canvas.
 */
const modelCard: Lesson = {
  id: 'model-card',
  standard: 2,
  outcomes: ['structure', 'run', 'result'],
  meta: { prerequisites: ['image'], versions: [CORE, 'Load LoRA (LoraLoader)', FRONTEND], checkedOn: CHECKED_ON },
  steps: [
    { id: 'intro', read: true },
    {
      id: 'ready',
      checklist: [
        { id: 'comfy', check: { kind: 'comfy-read' } },
        { id: 'model', check: { kind: 'model-file', folder: 'checkpoints' } },
        { id: 'lora', check: { kind: 'model-file', folder: 'loras' } },
      ],
    },
    { id: 'card', checklist: [{ id: 'family' }, { id: 'source' }, { id: 'format' }, { id: 'online', optional: true }] },
    { id: 'parts', read: true },
    { id: 'license', checklist: [{ id: 'page' }, { id: 'license' }, { id: 'unknowns' }, { id: 'hash', optional: true }] },
    { id: 'graph', ...baseGraph },
    {
      id: 'lora',
      roles: [node('lora', 'LoraLoader')],
      links: [
        link('checkpoint', 'MODEL', 'lora', 'model'),
        link('checkpoint', 'CLIP', 'lora', 'clip'),
        link('lora', 'MODEL', 'sampler', 'model'),
        link('lora', 'CLIP', 'positive', 'clip', ['CLIPSetLastLayer']),
        link('lora', 'CLIP', 'negative', 'clip', ['CLIPSetLastLayer']),
      ],
      fields: [field('lora', 'lora_name', { kind: 'sameFamily', role: 'checkpoint', field: 'ckpt_name' }, 'sameFamily')],
    },
    { id: 'complete', readCheck: [{ kind: 'workflow-complete' }] },
    { id: 'run', checklist: [{ id: 'export' }, { id: 'ran', run: true }, { id: 'console' }] },
    {
      id: 'assess',
      rubric: [
        { id: 'card', levels: ['no', 'partly', 'yes'] },
        { id: 'unknowns', levels: ['no', 'yes'], pass: 'yes' },
        { id: 'effect', levels: ['no', 'partly', 'yes'] },
      ],
    },
    {
      id: 'recall',
      quiz: [
        { id: 'name', choices: ['proof', 'hint', 'nothing'], answer: 'hint' },
        { id: 'parts', choices: ['model', 'three', 'lora'], answer: 'three' },
        { id: 'format', choices: ['safetensors', 'ckpt', 'gguf'], answer: 'ckpt' },
      ],
    },
    { id: 'transfer', transfer: true, checklist: [{ id: 'pick' }, { id: 'parts' }, { id: 'license' }] },
  ],
};

/** The lessons of the set, in the order a person meets them. */
export const RELIABLE_LESSONS: Lesson[] = [modelCard];

/** The group of each lesson and the lessons it goes on from. */
export const RELIABLE_PATH: Record<string, { group: LessonGroup; follows: string[] }> = {
  'model-card': { group: EXPERIMENTS_GROUP, follows: ['image'] },
};

/** The graph each lesson starts from. */
export const RELIABLE_AFTER: Record<string, string[]> = {
  'model-card': ['image'],
};
