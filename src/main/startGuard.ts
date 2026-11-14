import * as fs from 'fs';
import * as path from 'path';
import { writeFileAtomic } from './files/atomicWrite';

/**
 * Safe start. A graph the canvas cannot draw (a huge or broken file opened earlier) would make the window hang at
 * every start, because the graph on screen is opened again. So each time the window loads it says "drawing" here,
 * and "drawn" once the graph is on screen. When a load finds "drawing" left over from the one before, that one never
 * finished: the app asks before drawing the same graph again, and offers an empty canvas instead.
 */

export const START_STATE_FILE = 'graph-start.json';

type Mark = { state: 'drawing' | 'drawn'; revisionId: string | null; at: number };

function markFile(userData: string): string {
  return path.join(userData, START_STATE_FILE);
}

export function readStartMark(userData: string): Mark | null {
  try {
    const value = JSON.parse(fs.readFileSync(markFile(userData), 'utf8')) as Partial<Mark>;
    if (value.state !== 'drawing' && value.state !== 'drawn') return null;
    return { state: value.state, revisionId: typeof value.revisionId === 'string' ? value.revisionId : null, at: Number(value.at) || 0 };
  } catch {
    return null;
  }
}

function writeMark(userData: string, mark: Mark): void {
  try {
    writeFileAtomic(markFile(userData), JSON.stringify(mark), { mode: 0o600 });
  } catch {
    // Without the mark the next start simply draws as usual.
  }
}

/**
 * Called when the window loads, before it draws the graph. True when the previous load of the same graph never
 * said it was drawn. The mark is "drawing" from now on.
 */
export function beginDrawing(userData: string, revisionId: string | null, now = Date.now()): boolean {
  const previous = readStartMark(userData);
  const unfinished = previous?.state === 'drawing' && (previous.revisionId === null || previous.revisionId === revisionId);
  writeMark(userData, { state: 'drawing', revisionId, at: now });
  return unfinished;
}

/** The graph is on screen. */
export function finishDrawing(userData: string, revisionId: string | null, now = Date.now()): void {
  writeMark(userData, { state: 'drawn', revisionId, at: now });
}
