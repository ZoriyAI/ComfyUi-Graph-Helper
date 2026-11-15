/**
 * Keeps docs/wiki honest (see docs/wiki/dev/Wiki-Style.md), so a reader of either language never meets a missing
 * page or a dead link:
 * - every page exists in English (`Name.md`) and Russian (`Name.ru.md`), and the first line links to the other;
 * - the second line is a breadcrumb back to Home (and to the folder index inside a folder);
 * - every relative link resolves to a file (anchors are not checked);
 * - every folder has README.md / README.ru.md that list every page of the folder;
 * - with WIKI_STRICT=1 (the truth pass before a release), no `<!-- verify: … -->` and no
 *   `<!-- skeleton: … -->` comment is left, and every lesson of the app has its page in both languages.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { LESSONS } from '../../src/shared/lessons/lessons';

const WIKI = path.join(__dirname, '..', '..', 'docs', 'wiki');
const STRICT = process.env.WIKI_STRICT === '1';

function pages(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) out.push(path.relative(WIKI, full));
    }
  };
  walk(WIKI);
  return out.sort();
}

const ALL = pages();
const english = ALL.filter((file) => !file.endsWith('.ru.md'));
const russian = ALL.filter((file) => file.endsWith('.ru.md'));
const read = (file: string) => fs.readFileSync(path.join(WIKI, file), 'utf8');

/** Relative markdown links of a page, without anchors; external and anchor-only links are left out. */
function links(text: string): string[] {
  const found: string[] = [];
  // Examples in code (fenced blocks and `inline`) are not links.
  const prose = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const match of prose.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (/^[a-z]+:/i.test(target) || target.startsWith('#')) continue;
    found.push(target.split('#')[0]);
  }
  return found;
}

describe('the wiki', () => {
  it('has pages', () => {
    expect(english.length).toBeGreaterThan(10);
  });

  it('has every page in both languages, each linking to the other on its first line', () => {
    const problems: string[] = [];
    for (const file of english) {
      const ru = file.replace(/\.md$/, '.ru.md');
      if (!fs.existsSync(path.join(WIKI, ru))) problems.push(`${file}: no Russian page`);
      else if (!read(ru).split('\n')[0].includes(`](${path.basename(file)})`)) problems.push(`${ru}: first line does not link to ${path.basename(file)}`);
      if (!read(file).split('\n')[0].includes(`](${path.basename(ru)})`)) problems.push(`${file}: first line does not link to ${path.basename(ru)}`);
    }
    for (const file of russian) {
      if (!fs.existsSync(path.join(WIKI, file.replace(/\.ru\.md$/, '.md')))) problems.push(`${file}: no English page`);
    }
    expect(problems).toEqual([]);
  });

  it('puts a breadcrumb back to Home on the second line', () => {
    const problems = ALL.filter((file) => !/^Home(\.ru)?\.md$/.test(file)).filter((file) => {
      const second = read(file).split('\n')[1] ?? '';
      return !/\]\((\.\.\/)*Home(\.ru)?\.md\)/.test(second);
    });
    expect(problems).toEqual([]);
  });

  it('has only links that resolve', () => {
    const broken: string[] = [];
    for (const file of ALL) {
      for (const target of links(read(file))) {
        if (!target) continue;
        const resolved = path.normalize(path.join(path.dirname(path.join(WIKI, file)), target));
        if (!fs.existsSync(resolved)) broken.push(`${file} → ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('lists every page of a folder in its index, in both languages', () => {
    const problems: string[] = [];
    const folders = new Set(ALL.map((file) => path.dirname(file)).filter((dir) => dir !== '.'));
    for (const folder of folders) {
      for (const [index, suffix] of [['README.md', /^(?!.*\.ru\.md$).*\.md$/], ['README.ru.md', /\.ru\.md$/]] as const) {
        const indexFile = path.join(folder, index);
        if (!fs.existsSync(path.join(WIKI, indexFile))) {
          problems.push(`${folder}: no ${index}`);
          continue;
        }
        const listed = new Set(links(read(indexFile)).map((target) => path.basename(target)));
        for (const file of ALL.filter((item) => path.dirname(item) === folder && suffix.test(item) && !/README(\.ru)?\.md$/.test(item))) {
          if (!listed.has(path.basename(file))) problems.push(`${indexFile} does not list ${path.basename(file)}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  // Lessons land before their pages while a release is being put together, so this is part of the truth pass.
  it.runIf(STRICT)('has a lesson page in both languages for every lesson of the app (WIKI_STRICT=1)', () => {
    // A lesson page names its lesson in a comment: <!-- lesson: video-text -->.
    const lessonPages = ALL.filter((file) => path.dirname(file) === 'lessons');
    const marked = (id: string, ru: boolean) =>
      lessonPages.some((file) => file.endsWith('.ru.md') === ru && read(file).includes(`<!-- lesson: ${id} -->`));
    const missing = LESSONS.flatMap((lesson) => [
      ...(marked(lesson.id, false) ? [] : [`${lesson.id}: no English page`]),
      ...(marked(lesson.id, true) ? [] : [`${lesson.id}: no Russian page`]),
    ]);
    expect(missing).toEqual([]);
  });

  it.runIf(STRICT)('has no verify or skeleton comment left (WIKI_STRICT=1)', () => {
    const left = ALL.filter((file) => /<!--\s*(verify|skeleton):/.test(read(file)));
    expect(left).toEqual([]);
  });
});
