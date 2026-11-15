/**
 * Batching of canvas edits into undo steps. commitEdits sends a list of edits as one step; queueEdit gathers the
 * changes React Flow reports for one gesture, and queueNudge gathers arrow-key moves until the keys rest. Used by
 * CanvasFlow, clipboard.ts and commands/actions.ts. The place of an edit is captured at the gesture, so an edit
 * still waiting when the person switches graph or level lands where it was made.
 */
import type { BATCH_LABELS, GraphMutation } from '../../../../shared/commands/types';
import { commitManual, scopedToLevel } from '../commit';
import { trackCommit } from '../../../services/commands/pending';
import { useProjectionStore } from '../../../services/commands/projection';
import { useGraphStore } from '../../../state/graphState';
import { levelEdges } from './level';

/** The undo label of a batch of edits ('move', 'delete', 'cut', ...), from the shared command contract. */
export type BatchLabel = typeof BATCH_LABELS[number];
type Context = { projectId: string; graphKey: string };
/**
 * Sends edits as one undoable step: a single edit as itself, several as one batch. With `context` the edits are
 * already scoped to their level and go to the graph they were made in.
 */
export function commitEdits(edits: GraphMutation[], label: BatchLabel, prefix = 'manual', context?: Context): Promise<unknown> {
  if (edits.length === 0) return Promise.resolve(null);
  const payload = edits.length === 1 ? edits[0] : { type: 'batch' as const, label, edits: edits as unknown as Array<Record<string, unknown>> };
  return commitManual(payload, prefix, context ? { level: 'root', context } : {});
}
/** Edits gathered for one place (project, graph, level) until their timer fires. */
interface Pending {
  context: Context;
  edits: GraphMutation[];
  label: BatchLabel;
  edges: Array<{ id: string; source: string; target: string }>;
  done: () => void;
  timer: number;
}
/** Edits of one gesture: React Flow reports a multi-node drag or delete as several changes in the same tick. */
const gathered = new Map<string, Pending>();
/** Arrow-key moves: each press restarts the timer, so a run of presses becomes one undo step. */
const nudged = new Map<string, Pending>();
/** How long the arrow keys must rest before the nudges are sent. */
export const NUDGE_REST_MS = 450;
/** The place an edit is made in, captured at the gesture: the key of its queue and the graph it belongs to. */
function location(): { key: string; context: Context } {
  const { projectId, graphKey } = useProjectionStore.getState();
  return { key: JSON.stringify([projectId, graphKey, useGraphStore.getState().activeSubgraphId]), context: { projectId, graphKey } };
}
function flush(queue: Map<string, Pending>, key: string): void {
  const pending = queue.get(key);
  if (!pending) return;
  queue.delete(key);
  // Removing a node removes its links too; a separate remove-edge for such a link would name a link that is gone.
  const unwrap = (edit: GraphMutation) => edit.type === 'edit-in-subgraph' ? edit.edit : edit;
  const removed = new Set(pending.edits.flatMap((edit) => { const item = unwrap(edit); return item.type === 'remove-node' ? [item.nodeId] : []; }));
  const edits = pending.edits.filter((edit) => {
    const item = unwrap(edit);
    if (item.type !== 'remove-edge') return true;
    const edge = pending.edges.find((edge) => edge.id === item.edgeId);
    return !edge || (!removed.has(edge.source) && !removed.has(edge.target));
  });
  void commitEdits(edits, pending.label, 'manual', pending.context).finally(pending.done);
}
function enqueue(queue: Map<string, Pending>, edit: GraphMutation, label: BatchLabel, delay: number, replaceNode?: string): void {
  const { key, context } = location();
  let pending = queue.get(key);
  if (!pending) {
    let done = () => {};
    // Counted as a commit in flight from the gesture on, so code that waits for settled edits also waits for these.
    void trackCommit(() => new Promise<void>((resolve) => { done = resolve; }));
    pending = { context, edits: [], label, edges: levelEdges(), done, timer: 0 };
    queue.set(key, pending);
  }
  // A nudge keeps only the latest position of a node: one move per node, not one per key press.
  if (replaceNode) pending.edits = pending.edits.filter((item) => {
    const local = item.type === 'edit-in-subgraph' ? item.edit : item;
    return local.type !== 'move-node' || local.nodeId !== replaceNode;
  });
  pending.edits.push(scopedToLevel(edit));
  window.clearTimeout(pending.timer);
  pending.timer = window.setTimeout(() => flush(queue, key), delay);
}
/** Capture the original graph/definition at the gesture, including every member of a batched edit. */
export function queueEdit(edit: GraphMutation, label: BatchLabel): void { enqueue(gathered, edit, label, 0); }
/** Queues an arrow-key move of a node; nudges are sent together once the keys rest NUDGE_REST_MS. */
export function queueNudge(nodeId: string, x: number, y: number): void { enqueue(nudged, { type: 'move-node', nodeId, x, y }, 'move', NUDGE_REST_MS, nodeId); }
