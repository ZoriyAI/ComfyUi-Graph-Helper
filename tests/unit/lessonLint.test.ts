/**
 * The writer's check (share/lint.ts and scripts/lesson-lint.js): a lesson of standard 2 that is whole passes; a lesson
 * of standard 1 passes and lists in plain words what standard 2 would still ask; a broken lesson is an error that names
 * what is wrong; the script prints the same and fails only on errors (or, with --strict, on a missing part). The people
 * who write the next lessons rely on it to know what is left before a lesson can ship.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { LESSONS } from '../../src/shared/lessons/lessons';
import { builtinLessonDoc } from '../../src/shared/lessons/share/builtin';
import { lessonFileOf } from '../../src/shared/lessons/share/format';
import { lintLessonDoc, lintLines } from '../../src/shared/lessons/share/lint';

const ROOT = path.join(__dirname, '../..');

/** Keep exercising imported legacy lessons after the built-in curriculum has been upgraded. */
function legacyDoc() {
  const doc = structuredClone(builtinLessonDoc('image')!);
  doc.standard = 1; delete doc.meta; delete doc.outcomes;
  doc.steps = doc.steps.filter((step) => !step.id.startsWith('practice-'));
  for (const words of Object.values(doc.texts)) if (words) {
    delete words.meta;
    for (const key of Object.keys(words.steps)) if (key.startsWith('practice-')) delete words.steps[key];
  }
  return doc;
}

describe('the lint of a lesson', () => {
  it('passes the lessons of standard 2 with nothing missing', () => {
    for (const lesson of LESSONS.filter((item) => item.standard === 2)) {
      expect(lintLessonDoc(builtinLessonDoc(lesson.id)!), lesson.id).toEqual({ id: lesson.id, standard: 2, errors: [], missing: [] });
    }
  });

  it('passes every built-in lesson of standard 1 and lists what standard 2 would add, in plain words', () => {
    for (const lesson of LESSONS.filter((item) => item.standard !== 2)) {
      const lint = lintLessonDoc(builtinLessonDoc(lesson.id)!);
      expect(lint.errors, lesson.id).toEqual([]);
      expect(lint.missing.length, lesson.id).toBeGreaterThan(0);
    }
    const lint = lintLessonDoc(legacyDoc());
    expect(lint.missing).toContain('image: the target skill is not written in English');
    expect(lint.missing).toContain('image: fewer than 3 expected mistakes, each with how to recognize it and what to do, in Russian');
    expect(lint.missing).toContain('image: it has no transfer task (a task done without "Do this for me"); a lesson of standard 2 has one');
    expect(lintLines(lint)[0]).toBe('image (standard 1): no errors');
  });

  it('makes every part of the template an error once a lesson says it is of standard 2', () => {
    const doc = { ...legacyDoc(), id: 'image-2', standard: 2 as const };
    const lint = lintLessonDoc(doc);
    expect(lint.missing).toEqual([]);
    expect(lint.errors[0]).toBe('image-2: the versions it was written against and the date it was checked on are missing');
    expect(lint.errors.length).toBeGreaterThan(5);
  });
});

describe('scripts/lesson-lint.js', () => {
  const run = (...args: string[]) => spawnSync(process.execPath, [path.join(ROOT, 'scripts/lesson-lint.js'), ...args], { cwd: ROOT, encoding: 'utf8', timeout: 60_000 });

  it('checks the lessons of standard 2 by default and a lesson file by its path', () => {
    const plain = run();
    expect(plain.status).toBe(0);
    expect(plain.stdout).toContain('one-factor (standard 2): no errors');
    expect(plain.stdout).toContain('blind-compare (standard 2): no errors');
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'lesson-lint-'));
    try {
      const broken = { ...builtinLessonDoc('one-factor')!, id: 'broken-one' };
      delete broken.texts.en!.meta;
      const file = path.join(folder, 'broken.lesson.json');
      fs.writeFileSync(file, JSON.stringify(lessonFileOf([broken])));
      // The reader refuses the file, and the script says why.
      const refused = run(file);
      expect(refused.status).toBe(1);
      expect(refused.stdout).toContain('not a lesson file the app reads');
      const strict = run('--strict', 'image');
      expect(strict.status).toBe(0);
      const legacy = path.join(folder, 'legacy.lesson.json');
      fs.writeFileSync(legacy, JSON.stringify(lessonFileOf([legacyDoc()])));
      expect(run('--strict', legacy).status).toBe(1);
      expect(run(legacy).status).toBe(0);
      expect(run('image').status).toBe(0);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
});
