import type { GraphMutation } from '../../../shared/commands/types';
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

type InnerEdit = Extract<GraphMutation, { type: 'edit-in-subgraph' }>['edit'];

/**
 * While a subgraph definition is open, a canvas or Properties edit of one of its inner nodes or links is about
 * that definition, not the root canvas: inner node ids are their own id space, and the root may hold a node with
 * the same id. Such an edit is sent as `edit-in-subgraph`, so the engine saves it in the definition (undoable,
 * in the revision history, and in the exported workflow). Anything else goes out unchanged.
 */
export function scopedToLevel(payload: GraphMutation): GraphMutation {
  const graph = useGraphStore.getState();
  const definitionId = graph.activeSubgraphId;
  if (!definitionId) return payload;
  const definition = graph.subgraphs.find((item) => item.id === definitionId && !item.opaque);
  if (!definition) return payload;
  const nodeIds = new Set(definition.nodes.map((node) => String(node.id)));
  const edgeIds = new Set(definition.edges.map((edge) => String(edge.id)));
  let edit: InnerEdit | null = null;
  if ((payload.type === 'move-node' || payload.type === 'set-parameter') && nodeIds.has(payload.nodeId)) edit = payload;
  else if (payload.type === 'connect' && nodeIds.has(payload.source) && nodeIds.has(payload.target)) edit = payload;
  else if (payload.type === 'remove-edge' && edgeIds.has(payload.edgeId)) edit = payload;
  return edit ? { type: 'edit-in-subgraph', definitionId, edit } : payload;
}

/**
 * Every canvas edit goes through here: submitManual with a fresh action id, refused while a replay is
 * showing (the replay is read-only), and marked so its projection does not start a build reveal.
 * A refusal or conflict is shown as a toast; submitManual has already put the engine's projection back.
 */
export function commitManual(payload: GraphMutation, prefix = 'manual'): Promise<unknown> {
  const canvas = useCanvasStore.getState();
  if (canvas.replay) return Promise.resolve(null);
  canvas.beginManual();
  return submitManual(`${prefix}-${crypto.randomUUID()}`, scopedToLevel(payload))
    .then((result) => {
      reportRefusal(result);
      return result;
    })
    .catch(() => null)
    .finally(() => useCanvasStore.getState().endManual());
}
