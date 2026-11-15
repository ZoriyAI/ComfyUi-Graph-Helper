/**
 * Keeps the code readable for whoever opens it next: every code file under src, tests and scripts starts with a
 * header comment that says what the file is, and no comment is written in Cyrillic (Russian belongs in the
 * interface texts, which are strings, not in notes to engineers). A new file without a header, or a note left
 * in Russian, fails here instead of going unnoticed.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const ROOT = path.join(__dirname, '..', '..');
const FILES = execFileSync('git', ['ls-files', '-z', 'src', 'tests', 'scripts'], { cwd: ROOT, maxBuffer: 1 << 26 })
  .toString('utf8')
  .split('\0')
  .filter((file) => /\.(ts|tsx|js|cjs|mjs)$/.test(file))
  // A file deleted in the working tree is still listed by git until the deletion is committed.
  .filter((file) => fs.existsSync(path.join(ROOT, file)));

/** A header needs this many letters to count: a bare `// @ts-nocheck` or a one-word note is not a header. */
const HEADER_LETTERS = 30;
const CYRILLIC = /[Ѐ-ӿ]/;

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  return /\.(js|cjs|mjs)$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
}

/** Every comment of a file, found through the parser so that text inside strings and templates is never taken for one. */
function commentsOf(file: string, text: string): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
  const seen = new Map<number, ts.CommentRange>();
  const take = (ranges: ts.CommentRange[] | undefined) => {
    for (const range of ranges ?? []) seen.set(range.pos, range);
  };
  const walk = (node: ts.Node) => {
    if (ts.isJSDoc(node)) return;
    take(ts.getLeadingCommentRanges(text, node.getFullStart()));
    take(ts.getTrailingCommentRanges(text, node.getEnd()));
    for (const child of node.getChildren(source)) walk(child);
  };
  walk(source);
  return [...seen.values()].map((range) => text.slice(range.pos, range.end));
}

describe('comments in the code', () => {
  it('finds the code files', () => {
    expect(FILES.length).toBeGreaterThan(500);
  });

  it('starts every code file with a header comment', () => {
    const missing = FILES.filter((file) => {
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
      // A script may start with a shebang line; the header follows it.
      const start = (ts.getShebang(text) ?? '').length;
      const header = (ts.getLeadingCommentRanges(text, start) ?? []).map((range) => text.slice(range.pos, range.end)).join('\n');
      return header.replace(/[^A-Za-z]/g, '').length < HEADER_LETTERS;
    });
    expect(missing).toEqual([]);
  });

  it('has no comment in Cyrillic', () => {
    const found = FILES.filter((file) => {
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
      // Most files have no Cyrillic at all: only those that do are parsed.
      return CYRILLIC.test(text) && commentsOf(file, text).some((comment) => CYRILLIC.test(comment));
    });
    expect(found).toEqual([]);
  });
});
