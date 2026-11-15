import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * The front page of the repository: every relative link and picture in README.md and README.ru.md leads to a file
 * that exists.
 * Links to the repository's own GitHub pages (`../../releases`, `../../issues`, …) and absolute addresses are not
 * files and are left out; code spans and fenced blocks are not links.
 */
const ROOT = path.join(__dirname, '..', '..');

function relativeLinks(text: string): string[] {
  const plain = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  // Markdown links and pictures `](target)`, and the pictures of the gallery table `src="target"`.
  return [...plain.matchAll(/\]\(([^)\s]+)\)|\bsrc="([^"]+)"/g)]
    .map((match) => (match[1] ?? match[2]).split('#')[0])
    .filter((target) => target && !/^[a-z]+:/i.test(target) && !target.startsWith('../../'));
}

describe('README links', () => {
  for (const file of ['README.md', 'README.ru.md']) {
    it(`${file}: every relative link and picture resolves to a file`, () => {
      const links = relativeLinks(fs.readFileSync(path.join(ROOT, file), 'utf8'));
      expect(links.length).toBeGreaterThan(10);
      const broken = links.filter((target) => !fs.existsSync(path.join(ROOT, target)));
      expect(broken).toEqual([]);
    });
  }

  it('shows the screenshots of its own language', () => {
    const en = relativeLinks(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')).filter((target) => target.endsWith('.png'));
    const ru = relativeLinks(fs.readFileSync(path.join(ROOT, 'README.ru.md'), 'utf8')).filter((target) => target.endsWith('.png'));
    expect(en.length).toBeGreaterThanOrEqual(5);
    expect(en.filter((target) => target.includes('/ru/'))).toEqual([]);
    expect(ru.filter((target) => target.includes('/en/'))).toEqual([]);
  });

  it('the English page links to English pages and the Russian page to Russian ones', () => {
    const en = relativeLinks(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8'));
    const ru = relativeLinks(fs.readFileSync(path.join(ROOT, 'README.ru.md'), 'utf8'));
    expect(en.filter((target) => target.endsWith('.ru.md') && target !== 'README.ru.md')).toEqual([]);
    expect(ru.filter((target) => target.startsWith('docs/wiki/') && !target.endsWith('.ru.md'))).toEqual([]);
  });
});
