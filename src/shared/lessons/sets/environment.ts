/**
 * The group "Start and a reliable setup": the five lessons of level 0 of the programme (N01 to N05 of the audit), met
 * before "How ComfyUI works". They teach a person to choose how to run ComfyUI, to install it and prove the install
 * with a first picture, to keep a model library ComfyUI finds, to install a first node pack safely, and to make an
 * update reversible. Their words are in environment.texts.en.ts and environment.texts.ru.ts under the same ids.
 *
 * Who uses it: lessons.ts joins them into LESSONS ahead of every other group; the lesson panel runs them like any lesson.
 *
 * Why the steps look like this: the app never changes ComfyUI. Installing, updating, running, the Manager and the
 * snapshots happen in ComfyUI or on the person's computer, so they are checklists the person ticks. The app checks
 * only what it already reads: that it read a ComfyUI, that a model folder lists a file, that a node class is
 * installed, that every node of a workflow is installed, that the last workflow opened came from a picture. The
 * canvas steps hold what a graph can show: the picture graph a first run made, a loader that lists a library file, a
 * text node that keeps the environment card with the control workflow.
 *
 * The facts the steps rest on, checked on 2026-11-15, with where each was confirmed:
 * - Ways to run: Comfy Desktop (Windows, macOS on Apple Silicon, Linux), Portable (Windows, NVIDIA or processor only),
 *   manual install (every system and graphics card); Desktop follows the stable release by default
 *   (docs.comfy.org/installation/system_requirements). Portable "is not recommended for regular users" and comes with
 *   Python 3.13 (ComfyUI README). comfy-cli and the manual commands: docs/wiki/start/ComfyUI.md.
 * - Comfy Cloud: the cloud version of ComfyUI, free tier and paid plans, a fixed set of node packs ("You cannot install
 *   your own node packs there"), no offline use, a limit on the time of one run (docs.comfy.org/get_started/cloud).
 * - Desktop answers at port 8000, the others at 8188 (docs/wiki/start/ComfyUI.md, First-Hour.md).
 * - Start log lines: "To see the GUI go to:" (server.py), "Python version:" and "ComfyUI version:" (main.py),
 *   "pytorch version:", "Total VRAM … MB, total RAM … MB" and "Device:" (comfy/model_management.py),
 *   "Import times for custom nodes:" with " (IMPORT FAILED)" after a pack that failed (nodes.py),
 *   "Prompt executed in … seconds" after a run (main.py). ComfyUI master, version 0.45.0.
 * - The first picture: the official tutorial uses v1-5-pruned-emaonly-fp16.safetensors in models/checkpoints; the
 *   "Missing Models" list of the right panel offers "Download"; Run or Ctrl+Enter; Save Image writes
 *   ComfyUI_00001_.png into the output folder; "Assets", tab "Generated"; R makes ComfyUI read the model folders again
 *   (docs.comfy.org/get_started/first_generation).
 * - Model folders, extra_model_paths.yaml (copied from extra_model_paths.yaml.example in the ComfyUI folder, keys
 *   base_path, checkpoints, loras, vae, is_default), a restart after editing it, Desktop's own
 *   extra_models_config.yaml to add to without overwriting, "back up the file before modification"
 *   (docs.comfy.org/development/core-concepts/models; the example file in the ComfyUI repository); the option
 *   --extra-model-paths-config (comfy/cli_args.py); sub-folders show as part of the name (knowledge/sets/foundations).
 * - The Manager: built into ComfyUI, turned on with --enable-manager after pip install -r manager_requirements.txt in
 *   Portable and manual installs, on by default in Desktop (docs.comfy.org/manager/install). New interface: search,
 *   the "Filter" between "Node Pack" and "Node", the card, "Install", a "Version" to choose, "Uninstall", "Missing"
 *   (docs.comfy.org/manager/pack-management). Legacy interface: the "Manager" button of the top bar, "Save snapshot",
 *   "Restore" that "takes effect on the next ComfyUI startup", a prompt to restart after an install
 *   (docs.comfy.org/manager/legacy-ui). Install only from trusted authors; check the start log for failed imports
 *   (docs.comfy.org/installation/install_custom_node).
 * - The first pack: ComfyUI-Custom-Scripts by pythongosssss, MIT license, in the Registry as comfyui-custom-scripts
 *   with no Python dependencies; its nodes ShowText|pysssss ("Show Text 🐍", a STRING input), MathExpression|pysssss
 *   and StringFunction|pysssss (its repository, py/show_text.py, py/math_expression.py, py/string_function.py,
 *   pyproject.toml; api.comfy.org/nodes/comfyui-custom-scripts).
 * - Text (Multiline): the core node PrimitiveStringMultiline with the field `value` (comfy_extras/nodes_primitive.py).
 *   A node whose result reaches no output node is skipped (knowledge "queue").
 * - Snapshots of Desktop: the Manage panel, tab "Snapshots", "Create Snapshot", "Export", "Export All", "Import";
 *   Desktop saves a snapshot before it updates; "Copy & Update" updates a copy; choosing "Stable" on an install ahead
 *   of it is a rollback (docs.comfy.org/installation/desktop/usage/manage).
 * - Updates: Desktop, the Manage panel, tab "Update", Stable or "Latest on GitHub"; Portable, update/
 *   update_comfyui_stable.bat (update_comfyui_and_python_dependencies.bat only when the environment is broken); manual,
 *   git pull then pip install -r requirements.txt; a manual rollback with git checkout <commit>
 *   (docs.comfy.org/installation/update_comfyui). Stable releases and "commits outside of the stable release tags may
 *   be very unstable" (ComfyUI README).
 */
import type { FieldTest, Lesson, RoleSpec } from '../engine';
import type { LessonGroup } from './image-models';

const node = (role: string, ...classes: string[]): RoleSpec => ({ role, classes });
const card = (minChars: number, words: number): FieldTest => ({ kind: 'text', minChars, words });

/** The group of the programme's module "Start and a reliable setup". */
export const ENVIRONMENT_GROUP: LessonGroup = { id: 'environment', title: { en: 'Start and a reliable setup', ru: 'Старт и надёжная среда' } };

/** The date every lesson here was last checked against the versions it names. */
const CHECKED_ON = '2026-11-15';
/** What the lessons were checked against. */
const COMFY = 'ComfyUI 0.45.0 (master on 2026-11-15) and the official documentation at docs.comfy.org on that date';
const DESKTOP = 'Comfy Desktop as docs.comfy.org describes it on 2026-11-15 (Manage panel: Update and Snapshots tabs)';

/** The text node that keeps a card (a choice, the environment, a pack) inside a workflow. */
const TEXT_NODE = 'PrimitiveStringMultiline';

/**
 * N01: choose how to run ComfyUI (Desktop, Portable, a manual install or Comfy Cloud) from the computer, the privacy,
 * the packs and the money, and write the choice down with its limits, before installing anything.
 */
const chooseSetup: Lesson = {
  id: 'choose-setup',
  standard: 2,
  outcomes: ['structure', 'result'],
  meta: { versions: [COMFY, 'Comfy Cloud as docs.comfy.org/get_started/cloud describes it on 2026-11-15'], checkedOn: CHECKED_ON },
  steps: [
    { id: 'intro', read: true },
    {
      id: 'facts',
      checklist: [{ id: 'system' }, { id: 'card' }, { id: 'disk' }, { id: 'privacy' }, { id: 'packs' }, { id: 'money' }],
    },
    { id: 'ways', read: true },
    { id: 'cloud', read: true },
    { id: 'choice', roles: [node('card', TEXT_NODE)], fields: [{ role: 'card', field: 'value', test: card(60, 10) }] },
    {
      id: 'assess',
      rubric: [
        { id: 'fits', levels: ['no', 'partly', 'yes'] },
        { id: 'limits', levels: ['no', 'partly', 'yes'] },
        { id: 'nothing-extra', levels: ['no', 'yes'], pass: 'yes' },
      ],
    },
    {
      id: 'recall',
      quiz: [
        { id: 'mac', choices: ['portable', 'desktop', 'none'], answer: 'desktop' },
        { id: 'own-pack', choices: ['cloud', 'local', 'both'], answer: 'local' },
        { id: 'offline', choices: ['cloud', 'local'], answer: 'local' },
      ],
    },
    { id: 'transfer', transfer: true, checklist: [{ id: 'person' }, { id: 'write' }, { id: 'limit' }] },
  ],
};

/**
 * N02: an install proven by a first picture, not a window that opened: the start log read, the app connected, a
 * template run, the picture opened here, and an environment card kept beside the graph that made it.
 */
const firstRun: Lesson = {
  id: 'first-run',
  standard: 2,
  outcomes: ['structure', 'run', 'result'],
  meta: { prerequisites: ['choose-setup'], versions: [COMFY, DESKTOP], checkedOn: CHECKED_ON },
  steps: [
    { id: 'intro', read: true },
    { id: 'install', checklist: [{ id: 'official' }, { id: 'started' }, { id: 'log' }] },
    { id: 'connect', readCheck: [{ kind: 'comfy-read' }] },
    { id: 'model', read: true },
    {
      id: 'run',
      checklist: [
        { id: 'template' },
        { id: 'file', check: { kind: 'model-file', folder: 'checkpoints' } },
        { id: 'ran', run: true },
        { id: 'saved', run: true },
      ],
    },
    { id: 'picture', readCheck: [{ kind: 'workflow-from', from: 'picture' }] },
    { id: 'graph', roles: [node('save', 'SaveImage')] },
    { id: 'complete', readCheck: [{ kind: 'workflow-complete' }] },
    { id: 'card', roles: [node('card', TEXT_NODE)], fields: [{ role: 'card', field: 'value', test: card(60, 10) }] },
    { id: 'keep', checklist: [{ id: 'export' }, { id: 'picture' }] },
    {
      id: 'assess',
      rubric: [
        { id: 'log', levels: ['errors', 'warnings', 'clean'] },
        { id: 'card', levels: ['no', 'partly', 'yes'] },
        { id: 'again', levels: ['no', 'yes'], pass: 'yes' },
      ],
    },
    {
      id: 'recall',
      quiz: [
        { id: 'proof', choices: ['window', 'picture', 'log'], answer: 'picture' },
        { id: 'version', choices: ['log', 'folder', 'app'], answer: 'log' },
        { id: 'empty', choices: ['broken', 'no-file', 'reinstall'], answer: 'no-file' },
      ],
    },
    { id: 'transfer', transfer: true, checklist: [{ id: 'cold' }, { id: 'compare' }, { id: 'note' }] },
  ],
};

/** The lessons of the group, in the order a person meets them. */
export const ENVIRONMENT_LESSONS: Lesson[] = [chooseSetup, firstRun];

/** The group of each lesson and the lessons it goes on from. */
export const ENVIRONMENT_PATH: Record<string, { group: LessonGroup; follows: string[] }> = {
  'choose-setup': { group: ENVIRONMENT_GROUP, follows: [] },
  'first-run': { group: ENVIRONMENT_GROUP, follows: ['choose-setup'] },
};
