/**
 * "My lessons" in the profile: imported and own lessons are kept as files, survive a restart (a fresh read of the
 * folder), can be removed, never replace a built-in lesson, and a file in the folder that was changed by hand or
 * placed there as a link is not taken for a lesson.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fault = vi.hoisted(() => ({ target: '' }));
vi.mock('fs', async (original) => {
  const real = await original<typeof import('fs')>();
  return { ...real, renameSync: (from: fs.PathLike, to: fs.PathLike) => {
    if (String(to) === fault.target) {
      fault.target = '';
      throw Object.assign(new Error('Write refused'), { code: 'ENOSPC' });
    }
    return real.renameSync(from, to);
  } };
});
import { importLessonText, listMyLessons, markMyLessonAdult, removeMyLesson, writeMyLesson } from '../../src/main/lessons/store';
import { LESSON_FILE_FORMAT, LESSON_FILE_VERSION } from '../../src/shared/lessons/share/format';
import { isAdultMine, myEngineLesson, MY_LESSONS_MAX } from '../../src/shared/lessons/share/mine';
import { builtinLessonDoc } from '../../src/shared/lessons/share/builtin';
import { lessonById } from '../../src/shared/lessons/lessons';
import { sampleDoc } from '../fixtures/lessons/sampleLesson';

const folders: string[] = [];
function folder(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lessons-'));
  folders.push(dir);
  return path.join(dir, 'lessons');
}
afterEach(() => {
  fault.target = '';
  for (const dir of folders.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const text = (lessons: unknown[]) => JSON.stringify({ format: LESSON_FILE_FORMAT, version: LESSON_FILE_VERSION, lessons });

describe('my lessons in the profile', () => {
  it.each(['replacement', 'addition', 'committed'])('recovers the whole pack after the process exits at %s', (phase) => {
    const dir = folder();
    importLessonText(dir, text([sampleDoc()]), { origin: 'file', now: 1 });
    listMyLessons(dir);
    const before = fs.readFileSync(path.join(dir, 'my-first.lesson.json'));
    const docs = [sampleDoc(), sampleDoc({ id: 'second' }), sampleDoc({ id: 'third' })];
    docs[0].texts.en!.title = 'Changed';
    // A real child exits during the source store's rename, leaving exactly the files a crash leaves.
    const script = `
      const fs = require('fs'), ts = require('typescript');
      require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
      const folder = process.argv[1], phase = process.argv[2];
      const rename = fs.renameSync;
      fs.renameSync = (from, to) => {
        rename(from, to);
        if (phase === 'replacement' && String(to).endsWith('/my-first.lesson.json') || phase === 'addition' && String(to).endsWith('/second.lesson.json') || phase === 'committed' && String(to).endsWith('/.import-journal.json') && JSON.parse(fs.readFileSync(to, 'utf8')).state === 'committed') process.exit(91);
      };
      require(process.argv[3]).importDocs(folder, JSON.parse(process.argv[4]), { origin: 'file', now: 2 });
    `;
    const child = spawnSync(process.execPath, ['-e', script, dir, phase, path.resolve('src/main/lessons/store.ts'), JSON.stringify(docs)], { encoding: 'utf8' });
    expect(child.status, child.stderr).toBe(91);
    const listed = listMyLessons(dir);
    if (phase === 'committed') {
      expect(listed).toHaveLength(3);
      expect(listed.find((item) => item.id === 'my:my-first')!.doc.texts.en!.title).toBe('Changed');
    } else {
      expect(fs.readFileSync(path.join(dir, 'my-first.lesson.json'))).toEqual(before);
      expect(listed.map((item) => item.id)).toEqual(['my:my-first']);
    }
    expect(fs.readdirSync(dir).every((name) => name.endsWith('.lesson.json'))).toBe(true);
    expect(listMyLessons(dir)).toEqual(listed);
  });

  it.each([2, 3])('restores original bytes and removes additions after write %s fails', (at) => {
    const dir = folder();
    importLessonText(dir, text([sampleDoc()]), { origin: 'file', now: 1 });
    const first = path.join(dir, 'my-first.lesson.json');
    const before = fs.readFileSync(first);
    const docs = [sampleDoc(), sampleDoc({ id: 'second' }), sampleDoc({ id: 'third' })];
    docs[0].texts.en!.title = 'Changed';
    fault.target = path.join(dir, `${docs[at - 1].id}.lesson.json`);
    expect(importLessonText(dir, text(docs), { origin: 'file', now: 2 })).toEqual({ ok: false, error: 'The disk is full.' });
    expect(fs.readFileSync(first)).toEqual(before);
    expect(listMyLessons(dir).map((lesson) => lesson.id)).toEqual(['my:my-first']);
    expect(fs.readdirSync(dir)).toEqual(['my-first.lesson.json']);
  });

  it('leaves replacements untouched when another target is a directory', () => {
    const dir = folder();
    importLessonText(dir, text([sampleDoc()]), { origin: 'file' });
    const before = fs.readFileSync(path.join(dir, 'my-first.lesson.json'));
    fs.mkdirSync(path.join(dir, 'blocked.lesson.json'));
    const changed = sampleDoc();
    changed.texts.en!.title = 'Changed';
    expect(importLessonText(dir, text([changed, sampleDoc({ id: 'blocked' })]), { origin: 'file' })).toMatchObject({ ok: false, error: expect.any(String) });
    expect(fs.readFileSync(path.join(dir, 'my-first.lesson.json'))).toEqual(before);
    expect(fs.statSync(path.join(dir, 'blocked.lesson.json')).isDirectory()).toBe(true);
  });

  it('imports, lists after a restart, replaces by id, and removes', () => {
    const dir = folder();
    expect(importLessonText(dir, text([sampleDoc()]), { origin: 'file', fileName: '/home/someone/Downloads/first.lesson.json', now: 1 })).toEqual({ ok: true, added: ['my:my-first'], replaced: [] });
    const listed = listMyLessons(dir);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: 'my:my-first', origin: 'file', fileName: 'first.lesson.json', adultMark: false, savedAt: 1 });
    expect(myEngineLesson(listed[0]).id).toBe('my:my-first');
    // Only this user reads the folder and the file.
    expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
    expect(fs.statSync(path.join(dir, 'my-first.lesson.json')).mode & 0o777).toBe(0o600);
    const changed = sampleDoc();
    changed.texts.en!.title = 'A changed lesson';
    expect(importLessonText(dir, text([changed]), { origin: 'file', now: 2 })).toEqual({ ok: true, added: [], replaced: ['my:my-first'] });
    expect(listMyLessons(dir)[0].doc.texts.en!.title).toBe('A changed lesson');
    expect(removeMyLesson(dir, 'my:my-first')).toBe(true);
    expect(removeMyLesson(dir, 'my:my-first')).toBe(false);
    expect(listMyLessons(dir)).toEqual([]);
  });

  it('never replaces a built-in lesson: a file with a built-in id becomes a lesson of its own', () => {
    const dir = folder();
    const image = builtinLessonDoc('image')!;
    image.texts.en!.title = 'Not the real first lesson';
    const outcome = importLessonText(dir, text([image]), { origin: 'file' });
    expect(outcome).toEqual({ ok: true, added: ['my:image'], replaced: [] });
    expect(lessonById('image')!.id).toBe('image');
    expect(lessonById('my:image')).toBeNull();
    expect(removeMyLesson(dir, 'image')).toBe(false);
  });

  it('refuses the whole file when one lesson in it cannot be done, and keeps nothing of it', () => {
    const dir = folder();
    const broken = sampleDoc({ id: 'broken' });
    broken.steps[2].fields!.push({ role: 'sampler', field: 'steps', test: { kind: 'equals', value: 5 } });
    const outcome = importLessonText(dir, text([sampleDoc(), broken]), { origin: 'file' });
    expect(outcome).toMatchObject({ ok: false, tried: { stepId: 'sampler', why: 'stuck' } });
    expect(listMyLessons(dir)).toEqual([]);
  });

  it('keeps a pack whose lessons continue each other', () => {
    const dir = folder();
    const second = sampleDoc({ id: 'my-second', continues: ['my-first'] });
    expect(importLessonText(dir, text([sampleDoc(), second]), { origin: 'file' })).toMatchObject({ ok: true, added: ['my:my-first', 'my:my-second'] });
  });

  it('keeps the adult mark of the person and the flag of the file', () => {
    const dir = folder();
    importLessonText(dir, text([sampleDoc()]), { origin: 'made' });
    expect(isAdultMine(listMyLessons(dir)[0])).toBe(false);
    expect(markMyLessonAdult(dir, 'my:my-first', true)).toBe(true);
    expect(isAdultMine(listMyLessons(dir)[0])).toBe(true);
    // Imported again, the person's mark stays.
    importLessonText(dir, text([sampleDoc()]), { origin: 'file' });
    expect(listMyLessons(dir)[0].adultMark).toBe(true);
    expect(markMyLessonAdult(dir, 'my:nobody', true)).toBe(false);
    importLessonText(dir, text([sampleDoc({ id: 'flagged', adult: true })]), { origin: 'file' });
    expect(isAdultMine(listMyLessons(dir).find((item) => item.id === 'my:flagged')!)).toBe(true);
  });

  it('does not take a hand-changed file, a renamed file or a link for a lesson', () => {
    const dir = folder();
    importLessonText(dir, text([sampleDoc()]), { origin: 'file' });
    const file = path.join(dir, 'my-first.lesson.json');
    // A copy under another name would shadow another lesson: not listed.
    fs.copyFileSync(file, path.join(dir, 'other.lesson.json'));
    // A link could point anywhere: not followed.
    fs.symlinkSync(file, path.join(dir, 'linked.lesson.json'));
    // A file changed by hand to carry something the format does not allow.
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(path.join(dir, 'hand.lesson.json'), JSON.stringify({ ...record, lesson: { ...record.lesson, id: 'hand', run: 'rm -rf /' } }));
    fs.writeFileSync(path.join(dir, 'garbage.lesson.json'), '{{{{');
    expect(listMyLessons(dir).map((item) => item.id)).toEqual(['my:my-first']);
  });

  it('refuses a file past the number of lessons a profile keeps', () => {
    const dir = folder();
    for (let index = 0; index < MY_LESSONS_MAX; index += 1) writeMyLesson(dir, { id: `my:l-${index}`, origin: 'made', savedAt: index, adultMark: false, doc: sampleDoc({ id: `l-${index}` }) });
    expect(importLessonText(dir, text([sampleDoc()]), { origin: 'file' })).toEqual({ ok: false, full: true });
  }, 30_000);

  it('says why a file is refused', () => {
    const dir = folder();
    expect(importLessonText(dir, 'nope', { origin: 'file' })).toEqual({ ok: false, problem: { code: 'not-json' } });
    expect(importLessonText(dir, text([{ ...sampleDoc(), id: '../escape' }]), { origin: 'file' })).toMatchObject({ ok: false, problem: { code: 'invalid' } });
    expect(fs.existsSync(path.join(path.dirname(dir), 'escape.lesson.json'))).toBe(false);
  });
});
