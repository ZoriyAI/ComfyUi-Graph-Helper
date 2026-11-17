/**
 * The single door for manual graph edits: commitManual sends an edit to the engine, scoped to the subgraph that is
 * open, and reports a refusal in plain words. The canvas, its menus and toolbar, the Properties panel, the library,
 * lessons and the editing commands all commit through it, so every manual edit is one undo step, is refused during a
 * replay, and never starts the live-build reveal meant for the assistant's edits.
 */
import { instanceGraph, instanceParameterMutation, parameterAddress } from './lib/instanceContext';
import type { GraphMutation } from '../../../shared/commands/types';
import { SUBGRAPH_INPUT_NODE_ID, SUBGRAPH_OUTPUT_NODE_ID } from '../../../shared/graph/subgraphs';
import { translateKnownError } from '../../../shared/i18n';
import { i18n } from '../../i18n';
import { useProjectionStore, submitManual } from '../../services/commands/projection';
import { showToast } from '../../ui/toastStore';
import { useGraphStore } from '../../state/graphState';
import { useCanvasStore } from './canvasStore';
import { sayReplayLocked } from '../../commands/replayGate';

/** i18n.t with a plain string result, for code outside React components. */
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

/** An edit the engine can apply inside a subgraph definition. */
type InnerEdit = Extract<GraphMutation, { type: 'edit-in-subgraph' }>['edit'];

/** The input and output boundary pseudo-nodes of an open definition: link endpoints, not graph nodes. */
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
  // An opaque definition (one the app cannot model) has no inner ids to check against: the edit goes out unchanged.
  const definition = graph.subgraphs.find((item) => item.id === definitionId && !item.opaque);
  if (!definition) return payload;
  if (payload.type === 'set-parameter') {
    const view = instanceGraph(graph);
    if (view.owners.has(parameterAddress(payload.nodeId, payload.key))) {
      return instanceParameterMutation(view, payload.nodeId, payload.key, payload.value) ?? payload;
    }
  }
  const nodeIds = new Set(definition.nodes.map((node) => String(node.id)));
  const edgeIds = new Set(definition.edges.map((edge) => String(edge.id)));
  // A batch's "@k" names a node an earlier edit of the same batch adds: inside a definition that is an inner node.
  const endpoint = (id: string) => nodeIds.has(id) || BOUNDARY.has(id) || /^@\d+$/.test(id);
  if (payload.type === 'batch') {
    return { ...payload, edits: payload.edits.map((item) => scopedToLevel(item as GraphMutation) as unknown as Record<string, unknown>) };
  }
  let edit: InnerEdit | null = null;
  if ((payload.type === 'move-node' || payload.type === 'set-parameter' || payload.type === 'remove-node' || payload.type === 'rename-node') && nodeIds.has(payload.nodeId)) edit = payload;
  else if (payload.type === 'collapse-node' && payload.nodeIds.every((id) => nodeIds.has(id))) edit = payload;
  else if (payload.type === 'move-nodes' && payload.moves.every((move) => nodeIds.has(move.nodeId))) edit = payload;
  else if (payload.type === 'connect' && endpoint(payload.source) && endpoint(payload.target)) edit = payload;
  else if ((payload.type === 'remove-edge' || payload.type === 'retarget-edge') && edgeIds.has(payload.edgeId)) edit = payload;
  else if (payload.type === 'remove-selection' && payload.nodeIds.every((id) => nodeIds.has(id)) && payload.edgeIds.every((id) => edgeIds.has(id))) edit = payload;
  else if (payload.type === 'paste-selection') edit = { ...payload, destinationDefinitionId: definitionId };
  else if (payload.type === 'add-node' || payload.type === 'insert-subgraph' || payload.type === 'create-subgraph') edit = payload;
  // Editing commands (main/commands/editOps.ts) on the open subgraph's own nodes and links.
  else if ((payload.type === 'set-node-mode' || payload.type === 'set-node-color') && payload.nodeIds.every((id) => nodeIds.has(id))) edit = payload;
  else if ((payload.type === 'set-note-text' || payload.type === 'replace-node') && nodeIds.has(payload.nodeId)) edit = payload;
  else if (payload.type === 'insert-node-on-edge' && edgeIds.has(payload.edgeId)) edit = payload;
  // Always scope these to the displayed definition, even when a stale id is no longer present there.
  // Let main refuse it; falling back to root could edit a different group with the same local id.
  else if (payload.type === 'dissolve-subgraph' || payload.type === 'add-group' || payload.type === 'remove-group'
    || payload.type === 'rename-group' || payload.type === 'set-group-members' || payload.type === 'set-group-color'
    || payload.type === 'set-group-bounds' || payload.type === 'move-group') edit = payload;
  return edit ? { type: 'edit-in-subgraph', definitionId, edit } : payload;
}

/**
 * Every canvas edit goes through here (the library too): submitManual with a fresh action id, refused while a replay is
 * showing (the replay is read-only), and marked so its projection does not start a build reveal.
 * A refusal or conflict is shown as a toast; submitManual has already put the engine's projection back.
 */
export function commitManual(payload: GraphMutation, prefix = 'manual', options: { level?: 'shown' | 'root'; context?: { projectId: string; graphKey: string; isCurrent?: () => boolean } } = {}): Promise<unknown> {
  const canvas = useCanvasStore.getState();
  const displayed = useProjectionStore.getState();
  // An edit started in another project or graph (the person switched while it waited) is dropped, not misapplied.
  if (options.context && (options.context.projectId !== displayed.projectId || options.context.graphKey !== displayed.graphKey)) return Promise.resolve(null);
  if (canvas.replay) {
    sayReplayLocked();
    return Promise.resolve(null);
  }
  if (options.level !== 'root' && payload.type === 'set-parameter'
    && instanceGraph(useGraphStore.getState()).external.has(parameterAddress(payload.nodeId, payload.key))) {
    showToast({ id: 'external-field', tone: 'info', title: translate('lessons.externalValue') });
    return Promise.resolve(null);
  }
  canvas.beginManual();
  // An already-resolved destination may bypass level scoping (for a promoted value owned by an outer copy).
  return submitManual(`${prefix}-${crypto.randomUUID()}`, options.level === 'root' ? payload : scopedToLevel(payload), options.context)
    .then((result) => {
      reportRefusal(result);
      return result;
    })
    .catch((error: unknown) => {
      showToast({
        id: 'canvas-edit-error',
        tone: 'error',
        title: translate('canvas.editRefused'),
        description: error instanceof Error ? (translateKnownError(translate, error.message) ?? error.message) : translate('canvas.editUnexpected'),
      });
      return null;
    })
    .finally(() => useCanvasStore.getState().endManual());
}
