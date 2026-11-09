import { i18n, applyLanguage } from '../i18n';
import { describeNote, type WorkflowNote } from '../components/shell/notices';
import { showToast } from '../ui/toastStore';
import { applyProjection, useProjectionStore } from '../services/commands/projection';
import { getChatService } from '../services/llm/chatService';
import { useUiStore } from '../state/uiState';
import { useDockStore } from '../state/dockState';
import { useGraphStore } from '../state/graphState';
import { checkFindingCount, useKnowledgeStore } from '../state/knowledgeState';
import { useCanvasStore } from '../components/graph/canvasStore';
import { commitManual } from '../components/graph/commit';
import { askAbout } from '../components/graph/askAbout';
import { nodeRef } from '../components/graph/lib/selection';
import type { GraphNode } from '../types/graph';
import type { NonSecretSettings } from '../../shared/config/schema';
import type { Translator } from '../../shared/i18n';
import { SETTINGS_CHANGED } from './events';

export { SETTINGS_CHANGED };

/**
 * The work behind the commands. App, the canvas context menu and the registry call these, so each action
 * exists once.
 */
const translate: Translator = (key, options) => (options ? String(i18n.t(key, options)) : String(i18n.t(key)));

export function notify(note: WorkflowNote): void {
  showToast(describeNote(note, translate));
}

function markCurrentSaved(): void {
  useUiStore.getState().markSaved(useProjectionStore.getState().revSeq);
}

function rejectedReason(result: unknown, fallback: string): string {
  return result && typeof result === 'object' && 'error' in result ? String((result as { error: unknown }).error) : fallback;
}

// ── File ─────────────────────────────────────────────────────────────────────────────────────────────

export async function importWorkflowFile(): Promise<void> {
  const result = await window.electronAPI.importWorkflow();
  if (!result || result.status === 'cancelled') return;
  if (result.projection) applyProjection(result.projection);
  if (result.status === 'rejected') {
    notify({ kind: 'error', code: rejectedReason(result.result, 'Import was rejected.') });
    return;
  }
  const report = result.result && typeof result.result === 'object' ? result.result as { formatVersion?: number; missingNodes?: string[]; missingModels?: Array<{ directory: string; name: string }> } : {};
  notify({
    kind: 'imported',
    version: String(report.formatVersion ?? '—'),
    missingNodes: report.missingNodes ?? [],
    missingModels: (report.missingModels ?? []).map((model) => `${model.directory}/${model.name}`),
  });
}

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
    findings = checkFindingCount(report);
  } catch {
    findings = 0;
  }
  if (findings > 0) {
    useUiStore.getState().setDialog('export-guard');
    return;
  }
  await exportWorkflowNow();
}

/** Writes the workflow file without a check: the export guard's "Export anyway". */
export async function exportWorkflowNow(): Promise<void> {
  const result = await window.electronAPI.exportWorkflow();
  if (!result.ok && result.canceled) return;
  notify(result.ok ? { kind: 'exported' } : { kind: 'error', code: result.error || 'Export failed.' });
}

export async function openProjectFile(): Promise<void> {
  const result = await window.electronAPI.openProject();
  if (!result || result.status === 'cancelled') return;
  if (result.projection) applyProjection(result.projection);
  if (result.status === 'rejected') {
    notify({ kind: 'error', code: rejectedReason(result.result, 'The native project file is not valid.') });
    return;
  }
  markCurrentSaved();
  notify({ kind: 'opened-project' });
}

export async function saveProjectFile(): Promise<void> {
  const result = await window.electronAPI.saveProjectFile();
  if (!result.ok && result.canceled) return;
  if (result.ok) markCurrentSaved();
  notify(result.ok ? { kind: 'saved-project' } : { kind: 'error', code: result.error || 'The project file could not be written.' });
}

/** An empty ComfyUI workflow: what File ▸ New starts from. */
export const EMPTY_WORKFLOW = { last_node_id: 0, last_link_id: 0, nodes: [], links: [], groups: [], config: {}, extra: {}, version: 0.4 };

/**
 * Starts an empty project. It is a commit like any other, so the previous graph stays in the revision
 * history (Graph ▸ Replay). Asks first when there are unsaved changes.
 */
export function requestNewProject(): void {
  const ui = useUiStore.getState();
  const projection = useProjectionStore.getState();
  const dirty = ui.savedRevSeq !== null && projection.revSeq !== ui.savedRevSeq;
  const empty = useGraphStore.getState().nodes.length === 0;
  if (dirty && !empty) {
    ui.setDialog('new-project');
    return;
  }
  void startNewProject();
}

export async function startNewProject(): Promise<void> {
  useUiStore.getState().setDialog(null);
  useCanvasStore.getState().setReplay(null);
  useUiStore.getState().stopTour();
  if (useGraphStore.getState().activeSubgraphId) useGraphStore.getState().exitSubgraph(0);
  await commitManual({ type: 'import-workflow', document: EMPTY_WORKFLOW }, 'new-project');
  markCurrentSaved();
}

// ── Graph ────────────────────────────────────────────────────────────────────────────────────────────

/** True when manual edits can commit: the root graph is on screen and no replay is showing. */
export function canEditGraph(): boolean {
  return !useCanvasStore.getState().replay && useGraphStore.getState().activeSubgraphId === null;
}

export function selectedNodes(): GraphNode[] {
  return useGraphStore.getState().nodes.filter((node) => node.selected);
}

export function selectedEdgeIds(): string[] {
  return useGraphStore.getState().edges.filter((edge) => edge.selected).map((edge) => edge.id);
}

export function selectAllNodes(): void {
  const graph = useGraphStore.getState();
  graph.setNodes(graph.nodes.map((node) => (node.selected ? node : { ...node, selected: true })));
}

/** Removes the selected nodes and links, one commit each so every step stays in the history. */
export async function deleteSelection(): Promise<void> {
  const nodes = selectedNodes().map((node) => node.id);
  const removed = new Set(nodes);
  const edges = useGraphStore.getState().edges.filter((edge) => edge.selected && !removed.has(edge.source) && !removed.has(edge.target));
  for (const nodeId of nodes) await commitManual({ type: 'remove-node', nodeId });
  for (const edge of edges) await commitManual({ type: 'remove-edge', edgeId: edge.id });
}

export function createSubgraph(nodeIds: string[]): Promise<unknown> {
  return commitManual({ type: 'create-subgraph', name: translate('contextMenu.subgraphName'), nodeIds, inputs: [], outputs: [] });
}

export function dissolveSubgraph(nodeId: string): Promise<unknown> {
  return commitManual({ type: 'dissolve-subgraph', nodeId });
}

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

export function checkGraph(): void {
  useDockStore.getState().show('check');
  void useKnowledgeStore.getState().runCheck().catch(() => undefined);
}

// ── Assistant ────────────────────────────────────────────────────────────────────────────────────────

export function focusChat(): void {
  useDockStore.getState().show('assistant');
  // The dock may have been hidden; wait a frame for the panel to be on screen.
  window.requestAnimationFrame(() => {
    document.querySelector<HTMLTextAreaElement>('.composer-field textarea')?.focus();
  });
}

export function askAboutSelection(): void {
  const node = selectedNodes()[0];
  if (!node) return;
  const name = String(node.data.title || node.data.comfyType);
  const instance = node.data.kind === 'subgraph-instance';
  useDockStore.getState().show('assistant');
  askAbout(nodeRef(node), translate(instance ? 'contextMenu.askSubgraph' : 'contextMenu.askWhat', { name }));
}

export async function pauseRun(): Promise<void> {
  await getChatService().pause().catch(() => undefined);
}

export async function resumeRun(): Promise<void> {
  await getChatService().resume().catch(() => undefined);
}

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
  if (!base) return;
  const result = await window.electronAPI.saveSettings({ ...base, ...patch });
  if (result.ok) window.dispatchEvent(new CustomEvent<NonSecretSettings>(SETTINGS_CHANGED, { detail: result.values }));
}
