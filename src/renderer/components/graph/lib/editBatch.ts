import type { BATCH_LABELS, GraphMutation } from '../../../../shared/commands/types';
import { commitManual, scopedToLevel } from '../commit';
import { trackCommit } from '../../../services/commands/pending';
import { useProjectionStore } from '../../../services/commands/projection';
import { useGraphStore } from '../../../state/graphState';
import { levelEdges } from './level';

export type BatchLabel = typeof BATCH_LABELS[number];
type Context = { projectId: string; graphKey: string };
export function commitEdits(edits: GraphMutation[], label: BatchLabel, prefix = 'manual', context?: Context): Promise<unknown> {
  if (edits.length === 0) return Promise.resolve(null);
  const payload = edits.length === 1 ? edits[0] : { type: 'batch' as const, label, edits: edits as unknown as Array<Record<string, unknown>> };
  return commitManual(payload, prefix, context ? { level: 'root', context } : {});
}
interface Pending {
  context: Context;
  edits: GraphMutation[];
  label: BatchLabel;
  edges: Array<{ id: string; source: string; target: string }>;
  done: () => void;
  timer: number;
}
const gathered = new Map<string, Pending>();
const nudged = new Map<string, Pending>();
export const NUDGE_REST_MS = 450;
function location(): { key: string; context: Context } {
  const { projectId, graphKey } = useProjectionStore.getState();
  return { key: JSON.stringify([projectId, graphKey, useGraphStore.getState().activeSubgraphId]), context: { projectId, graphKey } };
}
function flush(queue: Map<string, Pending>, key: string): void {
  const pending = queue.get(key);
  if (!pending) return;
  queue.delete(key);
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
    void trackCommit(() => new Promise<void>((resolve) => { done = resolve; }));
    pending = { context, edits: [], label, edges: levelEdges(), done, timer: 0 };
    queue.set(key, pending);
  }
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
export function queueNudge(nodeId: string, x: number, y: number): void { enqueue(nudged, { type: 'move-node', nodeId, x, y }, 'move', NUDGE_REST_MS, nodeId); }
