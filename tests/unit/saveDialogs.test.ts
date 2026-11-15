/**
 * Every save dialog of the app asks before it replaces a file. On Linux (GTK) Electron's save dialog replaces an
 * existing file silently unless the call sets `showOverwriteConfirmation`, so each call in main must set it. The
 * test reads the sources: a new save dialog without it fails here. A person must never lose a file by picking
 * its name in a save dialog by mistake.
 */
import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sources(full) : /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** The text of each `showSaveDialog(` call up to its closing parenthesis. */
function saveDialogCalls(text: string): string[] {
  const calls: string[] = [];
  for (let at = text.indexOf('showSaveDialog('); at >= 0; at = text.indexOf('showSaveDialog(', at + 1)) {
    let depth = 0;
    let end = at + 'showSaveDialog'.length;
    for (; end < text.length; end += 1) {
      if (text[end] === '(') depth += 1;
      else if (text[end] === ')' && --depth === 0) break;
    }
    calls.push(text.slice(at, end + 1));
  }
  return calls;
}

describe('save dialogs', () => {
  it('ask before replacing an existing file, everywhere in main', () => {
    const root = path.join(__dirname, '..', '..', 'src', 'main');
    const found = sources(root).flatMap((file) => saveDialogCalls(fs.readFileSync(file, 'utf8')).map((call) => ({ file: path.relative(root, file), call })));
    expect(found.length).toBeGreaterThanOrEqual(4);
    expect(found.filter(({ call }) => !call.includes("'showOverwriteConfirmation'")).map(({ file }) => file)).toEqual([]);
  });
});
