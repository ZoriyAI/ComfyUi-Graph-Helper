import type { ModelSummary } from '../../../shared/contracts';
import { i18n } from '../../i18n';
import { useGraphStore } from '../../state/graphState';
import { useUiStore } from '../../state/uiState';
import { showToast } from '../../ui/toastStore';
import { commitManual } from '../graph/commit';
import { loaderFieldFor, loaderForModel } from '../graph/lib/modelLoaders';
import { placeNewNode } from '../graph/placeNode';

/**
 * Puts a model file to work on the canvas: a new loader node with the file chosen (from the card or a drop),
 * or the file put into the loader the person selected. Every path goes through the manual command path,
 * selects what changed and says in one toast what happened.
 */

type ModelRef = Pick<ModelSummary, 'directory' | 'name'>;

const tr = (key: string, options?: Record<string, unknown>) => String(i18n.t(key, options ?? {}));

function selectNode(nodeId: string): void {
  useGraphStore.setState((state) => ({ nodes: state.nodes.map((node) => ({ ...node, selected: node.id === nodeId })) }));
  useUiStore.getState().setSelection([{ kind: 'node', id: nodeId }]);
}

function appliedNodeId(result: unknown): string | null {
  const response = result as { status?: unknown; result?: { nodeId?: unknown } } | null;
  if (response?.status !== 'applied') return null;
  return typeof response.result?.nodeId === 'string' ? response.result.nodeId : null;
}

/** The loader's display name from the synced catalog ("Load LoRA"), or its class name. */
async function loaderTitle(nodeType: string): Promise<string> {
  try {
    const detail = await window.electronAPI.nodeTypeDetail(nodeType);
    return detail?.displayName || nodeType;
  } catch {
    return nodeType;
  }
}

/** True when a loader can be added now: the root graph is showing (not a subgraph definition or a replay). */
export function canAddToCanvas(): boolean {
  return useGraphStore.getState().activeSubgraphId === null;
}

/**
 * Adds the loader for a model file with the file already chosen, at `at` (a drop) or the centre of the view.
 * Returns the new node id, or null when nothing was added (the toast says why).
 */
export async function addModelLoader(model: ModelRef, at?: { x: number; y: number }): Promise<string | null> {
  const loader = loaderForModel(model.directory, model.name);
  if (!loader) {
    showToast({ id: 'model-place', tone: 'warn', title: tr('library.card.noLoader', { folder: model.directory }), duration: 6000 });
    return null;
  }
  if (!canAddToCanvas()) {
    showToast({ id: 'model-place', tone: 'warn', title: tr('library.card.inSubgraph'), duration: 6000 });
    return null;
  }
  // A drop point, else the centre of the view; either way moved to the nearest spot where it covers nothing.
  const title = await loaderTitle(loader.nodeType);
  const position = await placeNewNode(at ?? null, { classType: loader.nodeType, parameters: loader.parameters });
  const result = await commitManual({
    type: 'add-node',
    nodeType: loader.nodeType,
    ...(title !== loader.nodeType ? { title } : {}),
    x: Math.round(position.x),
    y: Math.round(position.y),
    parameters: loader.parameters,
  }, 'library-model');
  const nodeId = appliedNodeId(result);
  if (!nodeId) {
    showToast({ id: 'model-place', tone: 'error', title: tr('library.card.addFailed') });
    return null;
  }
  selectNode(nodeId);
  showToast({ id: 'model-place', tone: 'success', title: tr('library.card.added', { node: title, name: model.name }), duration: 5000 });
  return nodeId;
}

export interface SelectedLoader {
  nodeId: string;
  title: string;
  field: string;
}

/**
 * The one node selected on the root canvas, when it takes files from the model's folder, and the field that
 * takes them. The field list comes from the synced catalog (widget fields only) and the node's own values.
 */
export async function selectedLoaderFor(model: ModelRef, nodeId: string): Promise<SelectedLoader | null> {
  const node = useGraphStore.getState().nodes.find((item) => item.id === nodeId);
  if (!node || node.data.kind === 'subgraph-instance') return null;
  const classType = node.data.comfyType;
  let fields = Object.keys(node.data.parameters ?? {});
  try {
    const detail = await window.electronAPI.nodeTypeDetail(classType);
    if (detail) fields = [...new Set([...detail.inputs.filter((input) => input.widget).map((input) => input.name), ...fields])];
  } catch {
    // The node's own values still name its fields.
  }
  const field = loaderFieldFor(classType, fields, model.directory);
  return field ? { nodeId, title: node.data.title || classType, field } : null;
}

/** Puts the file into the selected loader's field. */
export async function putModelIntoNode(model: ModelRef, target: SelectedLoader): Promise<boolean> {
  const result = await commitManual({ type: 'set-parameter', nodeId: target.nodeId, key: target.field, value: model.name }, 'library-model');
  const ok = (result as { status?: unknown } | null)?.status === 'applied';
  showToast(ok
    ? { id: 'model-place', tone: 'success', title: tr('library.card.replaced', { node: target.title, name: model.name }), duration: 5000 }
    : { id: 'model-place', tone: 'error', title: tr('library.card.replaceFailed') });
  if (ok) selectNode(target.nodeId);
  return ok;
}
