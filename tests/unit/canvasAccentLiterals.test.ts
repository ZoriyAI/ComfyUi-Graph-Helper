import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * The canvas paints the action colour from the accent tokens, so Preferences ▸ Appearance can change it. A literal
 * cyan (#65d9ed, rgb 101 217 237) in its CSS or TSX would stay cyan under a violet or mint accent. A literal is
 * allowed only as the fallback of a `var(--token, …)`.
 */
const ROOT = path.join(__dirname, '../../src/renderer/components/graph');
const ACCENT = /#65d9ed|#8ae6f4|rgba?\(\s*101\s*,\s*217\s*,\s*237/i;

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return /\.(css|tsx?)$/.test(entry.name) ? [full] : [];
  });
}

/** The text with every `var(--name, fallback)` replaced by `var(--name)`, nested parentheses included. */
function withoutFallbacks(text: string): string {
  let out = '';
  let index = 0;
  while (index < text.length) {
    const at = text.indexOf('var(--', index);
    if (at < 0) {
      out += text.slice(index);
      break;
    }
    out += text.slice(index, at);
    let depth = 0;
    let end = at;
    for (; end < text.length; end += 1) {
      if (text[end] === '(') depth += 1;
      else if (text[end] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const inner = text.slice(at, end + 1);
    const comma = inner.indexOf(',');
    out += comma < 0 ? inner : `${inner.slice(0, comma)})`;
    index = end + 1;
  }
  return out;
}

describe('canvas colours come from the accent tokens', () => {
  it('has no literal accent outside a var() fallback in the canvas CSS and TSX', () => {
    const found = files(ROOT).flatMap((file) => {
      const text = withoutFallbacks(fs.readFileSync(file, 'utf8'));
      return text.split('\n').filter((line) => ACCENT.test(line)).map((line) => `${path.relative(ROOT, file)}: ${line.trim()}`);
    });
    expect(found).toEqual([]);
  });

  it('strips fallbacks, nested ones too, and nothing else', () => {
    expect(withoutFallbacks('a: var(--accent, #65d9ed); b: var(--x, color-mix(in srgb, #65d9ed 40%, red));')).toBe('a: var(--accent); b: var(--x);');
    expect(ACCENT.test(withoutFallbacks('stroke: rgba(101, 217, 237, 0.5)'))).toBe(true);
  });
});
