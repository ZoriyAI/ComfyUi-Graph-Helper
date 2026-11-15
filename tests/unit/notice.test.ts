/**
 * The statement of copyright, authorship and priority (NOTICE.md, NOTICE.ru.md) and the short COPYRIGHT file stay
 * present and complete: they name the holder and the year, link the LICENSE, and the dated record in each NOTICE has a
 * row for every release that has notes in docs/releases (a versioned notes file, or a line of the 0.x summary). A new
 * release without its row fails here, so the record cannot go stale without anyone noticing.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');

/** Every version that has release notes: vX.Y.Z(.ru).md files, and the `- **X.Y.Z**:` lines of the 0.x summary. */
function releasedVersions(): string[] {
  const dir = path.join(ROOT, 'docs', 'releases');
  const versions = new Set<string>();
  for (const name of fs.readdirSync(dir)) {
    const match = /^v(\d+\.\d+\.\d+)(?:\.ru)?\.md$/.exec(name);
    if (match) versions.add(match[1]);
  }
  for (const match of read('docs/releases/0.x.md').matchAll(/^- \*\*(\d+\.\d+\.\d+)\*\*:/gm)) versions.add(match[1]);
  return [...versions];
}

describe('copyright, authorship and priority', () => {
  for (const [file, holder] of [['NOTICE.md', 'Aleksey Ponomarenko'], ['NOTICE.ru.md', 'Алексей Пономаренко']] as const) {
    it(`${file} names the holder and the year, and links the LICENSE`, () => {
      const text = read(file);
      expect(text).toContain(`Copyright © 2026 ${holder} (ZoriyAI)`);
      expect(text).toContain('](LICENSE)');
    });

    it(`${file} has a row in its record of dates for every release with notes`, () => {
      const text = read(file);
      const versions = releasedVersions();
      expect(versions).toContain('0.9.0');
      expect(versions.length).toBeGreaterThan(10);
      const missing = versions.filter((version) => !text.includes(`| ${version} | \`v${version}\` |`));
      expect(missing).toEqual([]);
    });
  }

  it('COPYRIGHT names the product, the holder, the year, the licence and points to LICENSE and NOTICE.md', () => {
    const text = read('COPYRIGHT');
    const lines = text.trim().split('\n');
    expect(lines[0]).toBe('NodeWise Studio');
    expect(lines.length).toBeGreaterThanOrEqual(6);
    expect(lines.length).toBeLessThanOrEqual(10);
    expect(text).toContain('Copyright (c) 2026 Aleksey Ponomarenko (ZoriyAI');
    expect(text).toContain('Commons Clause');
    expect(text).toContain('LICENSE');
    expect(text).toContain('NOTICE.md');
  });
});
