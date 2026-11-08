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
