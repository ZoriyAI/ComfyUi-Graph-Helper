/**
 * The work behind the commands: File (open, save, export, new), Graph (selection, subgraphs, groups, check),
 * the assistant (lessons, chat, run control) and settings changed from the menu.
 *
 * Who uses it: appCommands.ts, editingCommands.ts, undo.ts, lessonCommands.ts and fileOpening.ts; also App.tsx,
 * components/shell/MenuBar.tsx and CommandDialogs.tsx, components/graph/GraphContextMenu.tsx and Onboarding.tsx,
 * and components/journey/RunInComfyDialog.tsx. Why one module: each action exists once, whichever surface runs it.
 */
import { useLessonStore } from '../state/lessonState';
import { i18n, applyLanguage } from '../i18n';
import { describeNote, type WorkflowNote } from '../components/shell/notices';
import { showToast } from '../ui/toastStore';
import { applyProjection, useProjectionStore } from '../services/commands/projection';
import { getChatService } from '../services/llm/chatService';
import { useUiStore } from '../state/uiState';
import { useDockStore } from '../state/dockState';
import { useGraphStore } from '../state/graphState';
import { useKnowledgeStore } from '../state/knowledgeState';
import { exportGuardFindings } from './exportGuard';
import { useSecretGuardStore } from './secretGuard';
import { useCanvasStore } from '../components/graph/canvasStore';
import { commitManual } from '../components/graph/commit';
import { askAbout } from '../components/graph/askAbout';
import { nodeRef } from '../components/graph/lib/selection';
import { levelEdges, levelNodes, selectOnLevel } from '../components/graph/lib/level';
import type { GraphNode } from '../types/graph';
import type { NonSecretSettings } from '../../shared/config/schema';
import type { Translator } from '../../shared/i18n';
import { emptyWorkflow } from '../../shared/workflow/codec';
import { SETTINGS_CHANGED } from './events';
import { nodeDisplayName } from '../components/graph/lib/nodeName';
import { afterWorkflowOpened } from '../components/graph/importLook';
import { graphIsDirty, refreshProjectFile } from '../services/projectFile';
import { trackCommit } from '../services/commands/pending';
import { commitEdits } from '../components/graph/lib/editBatch';
import { runSyncNow } from '../components/sync/SyncIndicator';
import { openSubgraphWizard } from '../components/graph/subgraphWizardState';
import { useOpenListsStore } from '../state/openListsState';
import { readFlag, SEEN_KEYS, useJourneyStore } from '../state/journeyState';

export { SETTINGS_CHANGED };

/** i18next's `t` in the shape shared/ code expects (it always returns a string). */
const translate: Translator = (key, options) => (options ? String(i18n.t(key, options)) : String(i18n.t(key)));

/** Shows a file or workflow message as a toast, with its buttons wired to the matching actions. */
export function notify(note: WorkflowNote): void {
  showToast(describeNote(note, translate, { openCheck: checkGraph, syncNow: () => void runSyncNow(), howToRun: () => useJourneyStore.getState().open('run') }));
}

/** The name of the workflow file last saved for ComfyUI, for the run card. */
let lastExportName = '';
export function exportedFileName(): string {
  return lastExportName;
}

/** The error text main gave with a rejected result, or `fallback`. */
function rejectedReason(result: unknown, fallback: string): string {
  return result && typeof result === 'object' && 'error' in result ? String((result as { error: unknown }).error) : fallback;
}

// ── File ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * True when the graph on screen would be lost from the canvas by replacing it and is not in a project file as it
 * stands (main/projectFiles.ts). Pristine New projects do not ask.
 */
async function replacingNeedsAsk(): Promise<boolean> {
  const state = await refreshProjectFile();
  return state ? state.dirty : graphIsDirty();
}

/** File ▸ Open workflow: asks first when the graph on screen is not in a project file as it stands. */
export async function importWorkflowFile(): Promise<void> {
  if (await replacingNeedsAsk()) {
    useUiStore.getState().askReplace('import-workflow');
    return;
  }
  await importWorkflowNow();
}

/** Open workflow without the question: the replace dialog's confirm (CommandDialogs.tsx). */
export async function importWorkflowNow(): Promise<void> {
  await finishOpen(() => window.electronAPI.importWorkflow());
}

/** What every way of opening a file answers (main/ipc/openIpc.ts). */
type OpenResult = Awaited<ReturnType<typeof window.electronAPI.openPath>>;
/** One way of opening, called only once the person may replace the graph on screen. */
type OpenCall = () => Promise<OpenResult | { status: 'cancelled'; projection: null; result: null } | null>;

/** An open waiting for the person's answer to "replace the graph on screen?". */
let queuedOpen: OpenCall | null = null;

/**
 * The one entry for every way of opening besides the two File dialogs: a dropped file, File ▸ Recent, File ▸
 * Examples, a file from the command line. Like Open workflow, it asks first when the graph on screen is not in a
 * project file as it stands, then ends in `finishOpen`.
 */
export async function openVia(call: OpenCall): Promise<void> {
  if (await replacingNeedsAsk()) {
    queuedOpen = call;
    useUiStore.getState().askReplace('open-file');
    return;
  }
  await finishOpen(call);
}

/** The replace question's "Open": runs the open that was waiting. */
export async function runQueuedOpen(): Promise<void> {
  const call = queuedOpen;
  queuedOpen = null;
  if (call) await finishOpen(call);
}

/**
 * What follows every open, whichever way the file came: the projection, then for a workflow the camera and the one
 * merged import message, for a project its file state and "Project opened"; File ▸ Recent is read again.
 */
export async function finishOpen(call: OpenCall): Promise<void> {
  useUiStore.getState().setDialog(null);
  const result = await trackCommit(call);
  if (!result || result.status === 'cancelled') return;
  const opened = 'opened' in result ? result.opened : undefined;
  const project = opened?.kind === 'project' || (!opened && call === openProjectCall);
  // Once drawn: nodes that cover each other move apart, and the camera takes the file's own view.
  if (result.status === 'applied' && !project) afterWorkflowOpened();
  if (result.projection) applyProjection(result.projection);
  void refreshRecentFiles();
  if (result.status === 'rejected') {
    notify({ kind: 'error', code: rejectedReason(result.result, project ? 'The native project file is not valid.' : 'Import was rejected.') });
    return;
  }
  await refreshProjectFile();
  if (project) {
    notify({ kind: 'opened-project' });
    return;
  }
  // Lessons: a read-check may ask whether the workflow came from a picture or an API-format file.
  if (result.status === 'applied') useLessonStore.getState().setOpenedFrom(opened?.from ?? 'json');
  const report = result.result && typeof result.result === 'object' ? result.result as { formatVersion?: number; missingNodes?: string[]; missingModels?: Array<{ directory: string; name: string }>; shownDifferently?: Record<string, number> } : {};
  notify({
    kind: 'imported',
    version: String(report.formatVersion ?? '—'),
    missingNodes: report.missingNodes ?? [],
    missingModels: (report.missingModels ?? []).map((model) => `${model.directory}/${model.name}`),
    shown: report.shownDifferently,
    // With no node list read yet every class would look missing; the toast says so and offers to sync instead.
    catalogNotRead: (useKnowledgeStore.getState().sync?.counts.nodeClasses ?? 0) === 0,
    ...(opened && opened.from !== 'json' ? { from: opened.from } : {}),
  });
}

/** A file dropped on the window: its path through the preload, then the one open path. */
export async function openDroppedFile(file: File): Promise<void> {
  const filePath = window.electronAPI.pathForFile(file);
  if (!filePath) {
    notify({ kind: 'error', code: 'This file cannot be opened here.' });
    return;
  }
  await openVia(() => window.electronAPI.openPath(filePath));
}

/** File ▸ Recent: a file from the list. */
export function openRecentFile(filePath: string): Promise<void> {
  return openVia(() => window.electronAPI.openRecent(filePath));
}

/** File ▸ Examples and the welcome card: the finished graph of a lesson, built from this ComfyUI's node list. */
export function openExampleGraph(lessonId: string): Promise<void> {
  return openVia(() => window.electronAPI.openExample(lessonId));
}

/** A file named on the command line or handed over by a second start (main keeps it until asked). */
export async function openPendingFile(): Promise<void> {
  const pending = await window.electronAPI.pendingOpen();
  if (pending) await openVia(() => window.electronAPI.openPending());
}

/** Reads File ▸ Recent and File ▸ Examples again, for the menu and the welcome card. */
export async function refreshRecentFiles(): Promise<void> {
  try {
    const [recent, examples] = await Promise.all([window.electronAPI.recentFiles(), window.electronAPI.examples()]);
    useOpenListsStore.getState().set(recent, examples);
  } catch {
    // The lists are a convenience; the menus show what they had.
  }
}

/** File ▸ Load node list from file: reads a saved catalog snapshot (nodes and models) into the app. */
export async function importCatalogSnapshot(): Promise<void> {
  const result = await window.electronAPI.importCatalog();
  if (!result || result.status === 'cancelled') return;
  if (result.status === 'rejected') {
    notify({ kind: 'error', code: result.error });
    return;
  }
  useUiStore.getState().bumpCatalog();
  notify({ kind: 'catalog', nodes: result.result.nodes, models: result.result.models, skipped: result.result.skipped.length });
}

/**
 * File ▸ Export: checks the graph first. With findings, the export guard dialog asks (Open check, Export
 * anyway, Cancel); with none, or when the check itself cannot run, the file dialog opens at once.
 */
export async function exportWorkflowFile(): Promise<void> {
  let findings = 0;
  try {
    const report = await useKnowledgeStore.getState().runCheck(useProjectionStore.getState().projectId);
    findings = exportGuardFindings(report).length;
  } catch {
    findings = 0;
  }
  if (findings > 0) {
    useUiStore.getState().setDialog('export-guard');
    return;
  }
  await exportWorkflowNow();
}

/**
 * Writes the workflow file without a check: the export guard's "Export anyway". When the graph holds a field that
 * looks like a key or token, main writes nothing and the person is asked first (secrets: their answer).
 */
export async function exportWorkflowNow(secrets?: 'omit' | 'keep'): Promise<void> {
  const result = await window.electronAPI.exportWorkflow(secrets);
  if (!result.ok && result.secrets && result.secrets.length > 0) {
    useSecretGuardStore.getState().ask('workflow', result.secrets);
    return;
  }
  if (!result.ok && result.canceled) return;
  if (!result.ok) {
    notify({ kind: 'error', code: result.error || 'Export failed.' });
    return;
  }
  const unset = result.unsetWidgets ?? [];
  notify(unset.length > 0
    ? { kind: 'exported', unset: unset.map((item) => `${item.classType} #${item.nodeId} ${item.name}`) }
    : { kind: 'exported' });
  void refreshRecentFiles();
  // The bridge to ComfyUI: how to open and run the file there, unless the person turned the card off.
  lastExportName = result.fileName ?? '';
  if (!readFlag(SEEN_KEYS.runCard)) useJourneyStore.getState().open('run');
}

/** File ▸ Open project: asks first when the graph on screen is not in a project file as it stands. */
export async function openProjectFile(): Promise<void> {
  if (await replacingNeedsAsk()) {
    useUiStore.getState().askReplace('open-project');
    return;
  }
  await openProjectNow();
}

/** The File ▸ Open project dialog, kept as one function so `finishOpen` knows a project was asked for. */
const openProjectCall: OpenCall = () => window.electronAPI.openProject();

/** Open project without the question: the replace dialog's confirm (CommandDialogs.tsx). */
export async function openProjectNow(): Promise<void> {
  await finishOpen(openProjectCall);
}

/** Whether the save the key check is asking about was a "Save as": the answer repeats it. */
let saveAsPending = false;

/**
 * File ▸ Save project (Ctrl+S): into the project's own file without a question once it has one; the first time,
 * and with `saveAs` (File ▸ Save project as…, Ctrl+Shift+S), the file dialog asks where, named after the title.
 * Either way main checks for key-like values first; the person's answer (`secrets`) repeats the same save.
 */
export async function saveProjectFile(secrets?: 'omit' | 'keep', options: { saveAs?: boolean } = {}): Promise<void> {
  const saveAs = secrets ? saveAsPending : Boolean(options.saveAs);
  saveAsPending = saveAs;
  const result = await window.electronAPI.saveProjectFile(secrets, { saveAs });
  if (!result.ok && result.secrets && result.secrets.length > 0) {
    useSecretGuardStore.getState().ask('project', result.secrets);
    return;
  }
  if (!result.ok && result.canceled) return;
  await refreshProjectFile();
  void refreshRecentFiles();
  notify(result.ok ? { kind: 'saved-project' } : { kind: 'error', code: result.error || 'The project file could not be written.' });
}

/** File ▸ Save project as… (Ctrl+Shift+S). */
export function saveProjectFileAs(): Promise<void> {
  return saveProjectFile(undefined, { saveAs: true });
}

/** An empty ComfyUI workflow: what File ▸ New starts from. The same format 1 as a fresh profile. */
export const EMPTY_WORKFLOW = emptyWorkflow();

/**
 * Starts an empty project. It is a commit like any other, so the previous graph stays in the revision
 * history (Graph ▸ Replay). Asks first when the canvas holds a graph that is not in a project file as it stands:
 * changed since it was opened or saved, or brought back by the app at start and never saved by the person.
 */
export async function requestNewProject(): Promise<void> {
  if (await replacingNeedsAsk()) {
    useUiStore.getState().askReplace('new-project');
    return;
  }
  await startNewProject();
}

/** File ▸ New without the question: closes replay, tour and subgraph, then commits the empty workflow. */
export async function startNewProject(): Promise<void> {
  useUiStore.getState().setDialog(null);
  useCanvasStore.getState().setReplay(null);
  useUiStore.getState().stopTour();
  if (useGraphStore.getState().activeSubgraphId) useGraphStore.getState().exitSubgraph(0);
  await commitManual({ type: 'import-workflow', document: EMPTY_WORKFLOW }, 'new-project');
  // The last check was about the graph that is gone: its count must not stay on the Check button.
  useKnowledgeStore.setState({ check: null });
  await refreshProjectFile();
}

// ── Graph ────────────────────────────────────────────────────────────────────────────────────────────

/** True when manual edits can commit to the root graph: the root graph is on screen and no replay is showing. */
export function canEditGraph(): boolean {
  return !useCanvasStore.getState().replay && useGraphStore.getState().activeSubgraphId === null;
}

/** True when manual edits can commit to the level on screen: the root graph or an open subgraph, not a replay. */
export function canEditLevel(): boolean {
  return !useCanvasStore.getState().replay;
}

/** Selected nodes of the level on screen (the open subgraph's inner nodes while one is open). */
export function selectedNodes(): GraphNode[] {
  return levelNodes().filter((node) => node.selected);
}

/** Ids of the selected links of the level on screen. */
export function selectedEdgeIds(): string[] {
  return levelEdges().filter((edge) => edge.selected).map((edge) => edge.id);
}

export function selectAllNodes(): void {
  selectOnLevel('all');
}

/** Removes the selected nodes and links as one revision, so one undo restores the whole selection. */
export async function deleteSelection(): Promise<void> {
  const nodes = selectedNodes().map((node) => node.id);
  const removed = new Set(nodes);
  const edges = levelEdges().filter((edge) => edge.selected && !removed.has(edge.source) && !removed.has(edge.target));
  // One step: one undo brings every removed node and link back.
  await commitEdits([
    ...nodes.map((nodeId) => ({ type: 'remove-node' as const, nodeId })),
    ...edges.map((edge) => ({ type: 'remove-edge' as const, edgeId: edge.id })),
  ], 'delete');
}

/** Graph ▸ Subgraph from selection: the nodes move into a new subgraph with a default name. One undo step. */
export function createSubgraph(nodeIds: string[]): Promise<unknown> {
  openSubgraphWizard(nodeIds);
  return Promise.resolve();
}

/** Puts a subgraph instance's inner nodes back on the root graph. */
export function dissolveSubgraph(nodeId: string): Promise<unknown> {
  return commitManual({ type: 'dissolve-subgraph', nodeId });
}

/** A group frame around these nodes, with the default group title. */
export function addGroup(nodeIds: string[]): Promise<unknown> {
  return commitManual({ type: 'add-group', title: translate('contextMenu.groupTitle'), nodeIds });
}

/** The selected subgraph instance, when exactly one is selected. */
export function selectedSubgraphInstance(): GraphNode | null {
  const nodes = selectedNodes();
  return nodes.length === 1 && nodes[0].data.kind === 'subgraph-instance' ? nodes[0] : null;
}

/** Opens the add-node search; `at` is where the node goes (flow coordinates), null for the view centre. */
export function openAddNode(at: { x: number; y: number } | null = null): void {
  useCanvasStore.getState().openAddSearch(at);
}

/** Graph ▸ Check: shows the Check panel and runs the check; a failed check leaves the panel's last state. */
export function checkGraph(): void {
  useDockStore.getState().show('check');
  void useKnowledgeStore.getState().runCheck().catch(() => undefined);
}

// ── Assistant ────────────────────────────────────────────────────────────────────────────────────────

/** The helper panel in its "Learn" mode: the lessons, or the lesson that is open. */
export function openLessons(): void {
  useDockStore.getState().show('assistant');
  useLessonStore.getState().setLearning(true);
}

/** Assistant ▸ Focus chat: shows the assistant panel and puts the cursor in the message field. */
export function focusChat(): void {
  useDockStore.getState().show('assistant');
  // The dock may have been hidden; wait a frame for the panel to be on screen.
  window.requestAnimationFrame(() => {
    document.querySelector<HTMLTextAreaElement>('.composer-field textarea')?.focus();
  });
}

/** Assistant ▸ Ask about selection: a question about the first selected node goes to the chat. */
export function askAboutSelection(): void {
  const node = selectedNodes()[0];
  if (!node) return;
  const name = nodeDisplayName(node.data);
  const instance = node.data.kind === 'subgraph-instance';
  useDockStore.getState().show('assistant');
  askAbout(nodeRef(node), translate(instance ? 'contextMenu.askSubgraph' : 'contextMenu.askWhat', { name }));
}

/** Pauses the assistant's build; a failure is silent because the status bar still shows the run. */
export async function pauseRun(): Promise<void> {
  await getChatService().pause().catch(() => undefined);
}

/** Resumes a paused build. */
export async function resumeRun(): Promise<void> {
  await getChatService().resume().catch(() => undefined);
}

/** Ends the open run in main, then stops the chat stream that drove it. */
export async function endRun(): Promise<void> {
  const projection = useProjectionStore.getState();
  const run = projection.activeRun;
  if (!run) return;
  try {
    const result = await window.electronAPI.cancelRun(projection.projectId, run.runId);
    applyProjection(result.projection);
  } catch {
    // The status bar keeps showing the run; the person can try again.
  }
  getChatService().cancel();
}

// ── Settings from the menu ───────────────────────────────────────────────────────────────────────────


/** Saves one non-secret settings change made from the menu (language, motion) and applies it at once. */
export async function saveSettingsPatch(patch: Partial<Pick<NonSecretSettings, 'language' | 'motion'>>): Promise<void> {
  const read = await window.electronAPI.getSettings();
  const base = 'values' in read && read.values ? read.values : null;
  if (patch.language) applyLanguage(patch.language);
  if (patch.motion) document.documentElement.dataset.motion = patch.motion;
  // Applied on screen even when the stored settings cannot be read; then nothing is saved.
  if (!base) return;
  const result = await window.electronAPI.saveSettings({ ...base, ...patch });
  if (result.ok) window.dispatchEvent(new CustomEvent<NonSecretSettings>(SETTINGS_CHANGED, { detail: result.values }));
}
