import type { RevisionSummary } from '../../../../shared/contracts/revisions';
import { describeRevision } from '../../../state/undoState';

/** Replay of revision history: pure stepping so the player and the tests agree. */
export interface ReplayCursor {
  index: number;
  count: number;
}

export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(index)));
}

export function stepReplay(cursor: ReplayCursor, delta: number): ReplayCursor {
  return { ...cursor, index: clampIndex(cursor.index + delta, cursor.count) };
}

/** Next index while playing, or null when the last revision is showing (playback stops there). */
export function nextPlayIndex(cursor: ReplayCursor): number | null {
  if (cursor.count === 0 || cursor.index >= cursor.count - 1) return null;
  return cursor.index + 1;
}

/** Pressing play at the end starts over from the first revision. */
export function playStartIndex(cursor: ReplayCursor): number {
  return cursor.index >= cursor.count - 1 ? 0 : cursor.index;
}

/**
 * What a version of the graph was, in the words the history uses (the undo tooltip): an i18n key and its values.
 * The first version is "the start", a restore is "a return to an earlier version", and a kind of change the
 * history has no sentence for is "a change to the graph", never a command name.
 */
export function replayStepText(row: RevisionSummary | undefined): { key: string; values: Record<string, string> } {
  if (!row) return { key: 'canvas.replayOther', values: {} };
  const type = typeof row.payload?.type === 'string' ? row.payload.type : row.description ?? '';
  if (type === '' || type === 'Initial') return { key: 'canvas.replayFirst', values: {} };
  if (type === 'restore-revision' || row.restoredRevisionId) return { key: 'canvas.replayRestoreStep', values: {} };
  const described = describeRevision(row);
  if (described.key === 'undo.other') return { key: 'canvas.replayOther', values: {} };
  return described;
}
