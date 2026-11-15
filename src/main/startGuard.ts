/**
 * Safe start. A graph the canvas cannot draw (a huge or broken file opened earlier) would make the window hang at
 * every start, because the graph on screen is opened again. So each time the window loads it says "drawing" here,
 * and "drawn" once the graph is on screen. When a load finds "drawing" left over from the one before, that one never
 * finished: the app asks before drawing the same graph again, and offers an empty canvas instead.
 * The renderer reports both moments through ipc/startIpc.ts.
 */
import * as fs from 'fs';
import * as path from 'path';
import { writeFileAtomic } from './files/atomicWrite';

/** The mark's file name in the profile folder. */
export const START_STATE_FILE = 'graph-start.json';

/** The last load's state, the graph revision it drew, and when. */
type Mark = { state: 'drawing' | 'drawn'; revisionId: string | null; at: number };

/** Where the mark lives. */
function markFile(userData: string): string {
  return path.join(userData, START_STATE_FILE);
}

/** The saved mark, or null when there is none or it does not read. */
export function readStartMark(userData: string): Mark | null {
  try {
    const value = JSON.parse(fs.readFileSync(markFile(userData), 'utf8')) as Partial<Mark>;
    if (value.state !== 'drawing' && value.state !== 'drawn') return null;
    return { state: value.state, revisionId: typeof value.revisionId === 'string' ? value.revisionId : null, at: Number(value.at) || 0 };
  } catch {
    return null;
  }
}

/** Saves the mark atomically, so a crash mid-write never leaves a broken mark. */
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
  // A different revision means the graph changed since (an import, another project): no reason to warn.
  const unfinished = previous?.state === 'drawing' && (previous.revisionId === null || previous.revisionId === revisionId);
  writeMark(userData, { state: 'drawing', revisionId, at: now });
  return unfinished;
}

/** The graph is on screen. */
export function finishDrawing(userData: string, revisionId: string | null, now = Date.now()): void {
  writeMark(userData, { state: 'drawn', revisionId, at: now });
}
