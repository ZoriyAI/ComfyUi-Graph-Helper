import type { BATCH_LABELS, GraphMutation } from '../../../../shared/commands/types';
import { commitManual } from '../commit';
import { trackCommit } from '../../../services/commands/pending';

export type BatchLabel = typeof BATCH_LABELS[number];

/**
 * Several edits as ONE history step: one edit goes out as itself, more as a `batch` revision (one undo brings all
 * of them back). The person's multi-node delete, paste, duplicate, cut and moves go through here.
 */
export function commitEdits(edits: GraphMutation[], label: BatchLabel, prefix = 'manual'): Promise<unknown> {
  if (edits.length === 0) return Promise.resolve(null);
  if (edits.length === 1) return commitManual(edits[0], prefix);
  return commitManual({ type: 'batch', label, edits: edits as unknown as Array<Record<string, unknown>> }, prefix);
}

/**
 * Edits React Flow reports in one go (a Delete of several nodes and links arrives as several change calls in the
 * same moment) are gathered for one tick and sent as one step. The gathering counts as landing, so an undo pressed
 * meanwhile waits for it.
 */
let gathered: GraphMutation[] = [];
let gatheredLabel: BatchLabel = 'delete';
let release: (() => void) | null = null;

export function queueEdit(edit: GraphMutation, label: BatchLabel): void {
  gathered.push(edit);
  gatheredLabel = label;
  if (release) return;
  void trackCommit(() => new Promise<void>((resolve) => {
    release = resolve;
    window.setTimeout(() => {
      const edits = gathered;
      const batchLabel = gatheredLabel;
      gathered = [];
      release = null;
      void commitEdits(edits, batchLabel).finally(resolve);
    }, 0);
  }));
}

/**
 * Keyboard nudges: each arrow press moves the selection a little. The presses of one burst are one step: the last
 * place of every node is sent once the keys rest for a moment.
 */
export const NUDGE_REST_MS = 450;
const nudged = new Map<string, { x: number; y: number }>();
let nudgeTimer: number | null = null;
let nudgeDone: (() => void) | null = null;

export function queueNudge(nodeId: string, x: number, y: number): void {
  nudged.set(nodeId, { x, y });
  if (nudgeTimer !== null) window.clearTimeout(nudgeTimer);
  if (!nudgeDone) void trackCommit(() => new Promise<void>((resolve) => { nudgeDone = resolve; }));
  nudgeTimer = window.setTimeout(() => {
    nudgeTimer = null;
    const moves = [...nudged.entries()].map(([id, place]) => ({ type: 'move-node' as const, nodeId: id, x: place.x, y: place.y }));
    nudged.clear();
    const done = nudgeDone;
    nudgeDone = null;
    void commitEdits(moves, 'move').finally(() => done?.());
  }, NUDGE_REST_MS);
}
