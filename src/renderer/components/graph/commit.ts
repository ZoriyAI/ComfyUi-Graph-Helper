import type { GraphMutation } from '../../../shared/commands/types';
import { SUBGRAPH_INPUT_NODE_ID, SUBGRAPH_OUTPUT_NODE_ID } from '../../../shared/graph/subgraphs';
import { translateKnownError } from '../../../shared/i18n';
import { i18n } from '../../i18n';
import { submitManual } from '../../services/commands/projection';
import { showToast } from '../../ui/toastStore';
import { useGraphStore } from '../../state/graphState';
import { useCanvasStore } from './canvasStore';

const translate = (key: string, options?: Record<string, unknown>) => String(i18n.t(key, options ?? {}));

/** Tell the person an edit did not land; the projection that came back is already on the canvas. */
export function reportRefusal(result: { status?: unknown; result?: unknown } | null | undefined): void {
  if (!result || (result.status !== 'conflict' && result.status !== 'rejected')) return;
  const detail = result.result as { error?: unknown } | null | undefined;
  const reason = typeof detail?.error === 'string' ? translateKnownError(translate, detail.error) : null;
  showToast({
    id: 'canvas-edit-refused',
    tone: 'warn',
    title: translate('canvas.editRefused'),
    description: reason ?? (result.status === 'conflict' ? translate('canvas.editConflict') : null),
    duration: 5000,
  });
}

/** True when a refused edit came back with a reason the person can read (reportRefusal then says it). */
export function hasRefusalReason(result: { status?: unknown; result?: unknown } | null | undefined): boolean {
  if (!result || (result.status !== 'conflict' && result.status !== 'rejected')) return false;
  return typeof (result.result as { error?: unknown } | null | undefined)?.error === 'string';
}

type InnerEdit = Extract<GraphMutation, { type: 'edit-in-subgraph' }>['edit'];

const BOUNDARY = new Set([SUBGRAPH_INPUT_NODE_ID, SUBGRAPH_OUTPUT_NODE_ID]);

/**
 * While a subgraph definition is open, a canvas edit is about that definition, not the root canvas: inner node
 * ids are their own id space, and the root may hold a node with the same id. A new node or subgraph instance
 * goes into the open definition; an edit of its inner nodes, links or slot links is sent as `edit-in-subgraph`,
 * so the engine saves it in the definition (undoable, in the revision history, and in the exported workflow).
 * Anything else (slot changes, renaming the definition, undo) goes out unchanged.
 */
export function scopedToLevel(payload: GraphMutation): GraphMutation {
  const graph = useGraphStore.getState();
  const definitionId = graph.activeSubgraphId;
  if (!definitionId) return payload;
  const definition = graph.subgraphs.find((item) => item.id === definitionId && !item.opaque);
  if (!definition) return payload;
  const nodeIds = new Set(definition.nodes.map((node) => String(node.id)));
  const edgeIds = new Set(definition.edges.map((edge) => String(edge.id)));
  const endpoint = (id: string) => nodeIds.has(id) || BOUNDARY.has(id);
  let edit: InnerEdit | null = null;
  if ((payload.type === 'move-node' || payload.type === 'set-parameter' || payload.type === 'remove-node' || payload.type === 'rename-node') && nodeIds.has(payload.nodeId)) edit = payload;
  else if (payload.type === 'collapse-node' && payload.nodeIds.every((id) => nodeIds.has(id))) edit = payload;
  else if (payload.type === 'move-nodes' && payload.moves.every((move) => nodeIds.has(move.nodeId))) edit = payload;
  else if (payload.type === 'connect' && endpoint(payload.source) && endpoint(payload.target)) edit = payload;
  else if ((payload.type === 'remove-edge' || payload.type === 'retarget-edge') && edgeIds.has(payload.edgeId)) edit = payload;
  else if (payload.type === 'add-node' || payload.type === 'insert-subgraph') edit = payload;
  return edit ? { type: 'edit-in-subgraph', definitionId, edit } : payload;
}

/**
 * Every canvas edit goes through here (the library too): submitManual with a fresh action id, refused while a replay is
 * showing (the replay is read-only), and marked so its projection does not start a build reveal.
 * A refusal or conflict is shown as a toast; submitManual has already put the engine's projection back.
 */
export function commitManual(payload: GraphMutation, prefix = 'manual', options: { level?: 'shown' | 'root' } = {}): Promise<unknown> {
  const canvas = useCanvasStore.getState();
  if (canvas.replay) return Promise.resolve(null);
  canvas.beginManual();
  // Lessons follow the main canvas: they pass level 'root', so their edits never land in an open subgraph.
  return submitManual(`${prefix}-${crypto.randomUUID()}`, options.level === 'root' ? payload : scopedToLevel(payload))
    .then((result) => {
      reportRefusal(result);
      return result;
    })
    .catch(() => null)
    .finally(() => useCanvasStore.getState().endManual());
}
