/**
 * The names the product had before 1.0 stay out of everything a person or a package manager sees. This reads every
 * tracked file and fails on any old spelling (src/shared/legacyNames.ts OLD_NAME_PATTERN), except in:
 * - the frozen release notes of 0.x (docs/releases/v0.*.md): history, released under the old name;
 * - the upgrade code that must spell the old name to find what 0.x left behind, and its tests;
 * - the dated research notes in docs/research: history, written while the repository still had its old name.
 * The repository itself was renamed (PROJECT_URL is now .../nodewise-studio), so its old path counts as an old name
 * like any other: a stray link to the old address fails here, even though GitHub still redirects it.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { OLD_NAME_PATTERN } from '../../src/shared/legacyNames';
import { PROJECT_URL } from '../../src/main/identity';

const root = path.join(__dirname, '..', '..');

/** Files allowed to spell an old name, each with the reason. */
const ALLOWED: Array<[RegExp, string]> = [
  [/^docs\/releases\/v0\.[^/]*\.md$/, 'release notes of 0.x, kept as they were released'],
  [/^docs\/research\/[^/]*\.md$/, 'dated research notes, kept as they were written'],
  [/^src\/shared\/legacyNames\.ts$/, 'the one place the upgrade code reads the old names from'],
  [/^resources\/linux\/portable\/install\.sh$/, 'removes a 0.9 copy installed under the old name (shell cannot import)'],
  [/^tests\/unit\/oldNames\.test\.ts$/, 'this check'],
];

function oldNameLines(file: string, text: string): string[] {
  const lines: string[] = [];
  text.split('\n').forEach((line, index) => {
    if (OLD_NAME_PATTERN.test(line)) lines.push(`${file}:${index + 1}: ${line.trim().slice(0, 160)}`);
  });
  return lines;
}

describe('old product names', () => {
  it('are found in any spelling, the old repository address included', () => {
    for (const text of ['Graph Helper for ComfyUI', 'graph helper', 'x.graph-helper.json', '/usr/bin/comfyui-graph-builder', 'GraphHelperForComfyUI/1.0', 'CozyGraph', 'cozygraph_1.0_amd64.deb']) {
      expect(oldNameLines('a.md', text), text).toHaveLength(1);
    }
    // The repository's address before its rename, in any letter case: GitHub still redirects it, but it is not ours.
    for (const text of ['https://github.com/ZoriyAI/ComfyUi-Graph-Helper/issues', 'git clone https://github.com/zoriyai/comfyui-graph-helper.git']) {
      expect(oldNameLines('a.md', text), text).toHaveLength(1);
    }
    const repository = PROJECT_URL.replace('https://github.com/', '');
    expect(oldNameLines('a.md', `see ${PROJECT_URL}/issues and [badge](https://img.shields.io/github/v/release/${repository})`)).toEqual([]);
    expect(oldNameLines('a.md', 'NodeWise Studio, nodewise-studio, a graph that helps')).toEqual([]);
  });

  it('appear in no tracked file outside the release notes of 0.x and the upgrade code', () => {
    const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
    expect(files.length).toBeGreaterThan(100);
    const found: string[] = [];
    for (const file of files) {
      if (ALLOWED.some(([pattern]) => pattern.test(file))) continue;
      const full = path.join(root, file);
      let buffer: Buffer;
      try {
        buffer = fs.readFileSync(full);
      } catch {
        continue; // Deleted in the working tree.
      }
      if (buffer.includes(0)) continue; // Pictures and other binary files.
      found.push(...oldNameLines(file, buffer.toString('utf8')));
    }
    expect(found).toEqual([]);
  });
});
