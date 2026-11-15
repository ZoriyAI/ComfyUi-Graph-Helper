/**
 * Version 2 of the lesson file (share/format.ts): the steps a person answers, transfer tasks, outcomes, the standard,
 * the place in the programme and the template's metadata travel in a file and come back the same; a file of version 1
 * still opens; a lesson that needs nothing of version 2 is still written as version 1, so version 1.0 of the app can
 * open it; a record of My lessons written by 1.0 still reads; the lesson editor keeps these steps and adds a
 * self-check. A lesson someone shares must arrive whole, and an old file must never stop opening.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { builtinLessonDoc, builtinGroupFile } from '../../src/shared/lessons/share/builtin';
import { LESSON_FILE_FORMAT, engineLesson, lessonFileOf, lessonFileVersion, readLessonFile, readLessonFileText, type LessonDoc } from '../../src/shared/lessons/share/format';
import { checkLessonDoc, readStoredRecord, storedRecord, type MyLesson } from '../../src/shared/lessons/share/mine';
import { checklistLines, checklistStep, docFromDraft, draftFromDoc } from '../../src/shared/lessons/share/authoring';
import { importLessonText, listMyLessons } from '../../src/main/lessons/store';
import { lessonById } from '../../src/shared/lessons/lessons';

/** A small lesson of the person with every kind of step of version 2, in both languages. */
function sampleV2(): LessonDoc {
  const steps = {
    intro: { title: 'Why', body: 'What this lesson is about.' },
    ready: { title: 'Ready', body: 'Tick these.', items: { comfy: { label: 'ComfyUI is read.' }, note: { label: 'I wrote my question.', how: 'On paper.' } } },
    model: { title: 'Model', body: 'Add {checkpoint} and choose a file in `ckpt_name`.' },
    check: { title: 'Check', body: 'The app looks.' },
    run: { title: 'Run', body: 'Run it in ComfyUI.', items: { ran: { label: 'I ran it.' } } },
    score: { title: 'Score', body: 'Score it.', criteria: { fit: { title: 'It fits.', levels: { no: 'No', yes: 'Yes' }, tryNext: 'Try again.' } } },
    quiz: { title: 'Quiz', body: 'One question.', questions: { q: { text: 'Which?', choices: { a: 'A', b: 'B' }, explain: 'B, because.' } } },
    own: { title: 'Your own', body: 'Do it alone.', items: { did: { label: 'I did it.' } } },
  };
  const meta = { skill: 'One skill.', requires: ['A ComfyUI.'], mistakes: [{ sign: 'a', fix: 'b' }, { sign: 'c', fix: 'd' }, { sign: 'e', fix: 'f' }], provenance: 'Made by hand.', notChecked: 'The pictures.' };
  return {
    id: 'v2-sample',
    standard: 2,
    outcomes: ['structure', 'run', 'result'],
    level: 2,
    tracks: ['base'],
    priority: 'core',
    meta: { prerequisites: ['image'], versions: ['ComfyUI core nodes'], checkedOn: '2026-11-15' },
    // Copies: a test that takes words out of one language must not take them out of the other.
    texts: { en: { title: 'A sample', result: 'Everything of version 2.', steps, meta }, ru: JSON.parse(JSON.stringify({ title: 'Пример', result: 'Всё из версии 2.', steps, meta })) },
    steps: [
      { id: 'intro', read: true },
      { id: 'ready', checklist: [{ id: 'comfy', check: { kind: 'comfy-read' } }, { id: 'note' }] },
      { id: 'model', roles: [{ role: 'checkpoint', classes: ['CheckpointLoaderSimple'] }], fields: [{ role: 'checkpoint', field: 'ckpt_name', test: { kind: 'chosen' } }] },
      { id: 'check', readCheck: [{ kind: 'workflow-size', min: 1, max: 30 }, { kind: 'node-class', classes: ['KSampler'] }] },
      { id: 'run', checklist: [{ id: 'ran', run: true }] },
      { id: 'score', rubric: [{ id: 'fit', levels: ['no', 'yes'], pass: 'yes' }] },
      { id: 'quiz', quiz: [{ id: 'q', choices: ['a', 'b'], answer: 'b' }] },
      { id: 'own', transfer: true, checklist: [{ id: 'did' }] },
    ],
  };
}

describe('lesson files of version 2', () => {
  it('carries every new kind of step, the outcomes, the place and the metadata, and reads them back the same', () => {
    const file = lessonFileOf([sampleV2()]);
    expect(file.version).toBe(2);
    const read = readLessonFileText(JSON.stringify(file));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.file.lessons[0]).toEqual(sampleV2());
    const lesson = engineLesson(read.file.lessons[0], 'my:v2-sample');
    expect(lesson.standard).toBe(2);
    expect(lesson.outcomes).toEqual(['structure', 'run', 'result']);
    expect(lesson.steps.map((step) => Object.keys(step).filter((key) => key !== 'id'))).toEqual([
      ['read'], ['checklist'], ['roles', 'fields'], ['readCheck'], ['checklist'], ['rubric'], ['quiz'], ['checklist', 'transfer'],
    ]);
    expect(checkLessonDoc(read.file.lessons[0])).toEqual({ ok: true });
  });

  it('still opens a file of version 1, and writes version 1 for a lesson that needs nothing new', () => {
    const old = { format: LESSON_FILE_FORMAT, version: 1, lessons: [{ id: 'old', texts: { en: { title: 'Old', result: 'An old file.', steps: { intro: { title: 'Intro', body: 'Read.' }, model: { title: 'Model', body: 'Add it.' } } } }, steps: [{ id: 'intro', read: true }, { id: 'model', roles: [{ role: 'checkpoint', classes: ['CheckpointLoaderSimple'] }] }] }] };
    const read = readLessonFile(old);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(lessonFileVersion(read.file.lessons)).toBe(1);
    expect(lessonFileOf(read.file.lessons).version).toBe(1);
    // One lesson of version 2 in a pack makes the pack version 2.
    expect(lessonFileOf([...read.file.lessons, sampleV2()]).version).toBe(2);
    expect(readLessonFile({ ...old, version: 3 })).toEqual({ ok: false, problem: { code: 'newer-version', version: 3 } });
  });

  it('refuses a step of version 2 without its words or with broken parts, naming the rule', () => {
    const noLabel = sampleV2();
    delete (noLabel.texts.ru!.steps.ready as { items?: unknown }).items;
    expect(readLessonFile(lessonFileOf([noLabel]))).toMatchObject({ ok: false, problem: { code: 'rules', lesson: 'v2-sample', rule: { code: 'words-item', step: 'ready', name: 'comfy', language: 'ru' } } });
    const badPass = sampleV2();
    badPass.steps[5].rubric![0].pass = 'maybe';
    expect(readLessonFile(lessonFileOf([badPass]))).toMatchObject({ ok: false, problem: { code: 'rules', rule: { code: 'pass-level' } } });
    const notStandard = sampleV2();
    delete notStandard.texts.en!.meta;
    expect(readLessonFile(lessonFileOf([notStandard]))).toMatchObject({ ok: false, problem: { code: 'rules', rule: { code: 'standard-skill', language: 'en' } } });
    // A condition the app does not know is not data it can check: refused.
    const unknown = JSON.parse(JSON.stringify(sampleV2())) as Record<string, unknown> & { steps: Array<Record<string, unknown>> };
    unknown.steps[3].readCheck = [{ kind: 'run-the-workflow' }];
    expect(readLessonFile(lessonFileOf([unknown as unknown as LessonDoc]))).toMatchObject({ ok: false, problem: { code: 'invalid' } });
  });

  it('exports the built-in lessons with their place in the programme, and the sample lessons whole', () => {
    const doc = builtinLessonDoc('one-factor')!;
    expect(doc).toMatchObject({ standard: 2, level: 2, tracks: ['base', 'image'], priority: 'core', outcomes: ['structure', 'run', 'result'] });
    expect(doc.texts.ru!.steps.assess.criteria!.difference.levels.partly).toBe('Отчасти');
    expect(doc.texts.en!.meta!.mistakes!.length).toBeGreaterThanOrEqual(3);
    const pack = builtinGroupFile('experiments')!;
    expect(pack.version).toBe(2);
    const read = readLessonFileText(JSON.stringify(pack));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.file.lessons.map((lesson) => lesson.id)).toEqual(['one-factor', 'blind-compare', 'model-card']);
    expect(engineLesson(read.file.lessons[0], 'one-factor').steps).toEqual(lessonById('one-factor')!.steps);
  });
});

describe('My lessons with version 2', () => {
  it('reads a record written by version 1.0, and writes the version a lesson needs', () => {
    const old = builtinLessonDoc('refine')!;
    const plain: LessonDoc = { id: 'old-refine', texts: old.texts, steps: old.steps };
    const record = { format: `${LESSON_FILE_FORMAT}/mine`, version: 1, origin: 'file', savedAt: 1, adultMark: false, lesson: plain };
    expect(readStoredRecord(record)?.doc.id).toBe('old-refine');
    const mine: MyLesson = { id: 'my:v2-sample', origin: 'made', savedAt: 2, adultMark: false, doc: sampleV2() };
    expect(storedRecord(mine).version).toBe(2);
    expect(storedRecord({ ...mine, doc: plain }).version).toBe(1);
    expect(readStoredRecord(storedRecord(mine))?.doc).toEqual(sampleV2());
  });

  it('imports a file of version 2 into the profile and lists it after a restart', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'lessons-v2-'));
    try {
      const outcome = importLessonText(folder, JSON.stringify(lessonFileOf([sampleV2()])), { origin: 'file', now: 5 });
      expect(outcome).toEqual({ ok: true, added: ['my:v2-sample'], replaced: [] });
      expect(listMyLessons(folder).map((lesson) => lesson.doc)).toEqual([sampleV2()]);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });

  it('keeps the steps a person answers through the editor, and adds a self-check from lines', () => {
    const doc = sampleV2();
    expect(docFromDraft(draftFromDoc(doc, 'en'))).toMatchObject({
      id: doc.id,
      standard: 2,
      level: 2,
      steps: doc.steps,
      texts: { en: { steps: { ready: doc.texts.en!.steps.ready, score: doc.texts.en!.steps.score }, meta: doc.texts.en!.meta } },
    });
    const step = checklistStep('self-check-9', 'Check yourself', 'Tick.', ['I ran it.', '', '  I saved it.  ']);
    expect(step.extra).toEqual({ checklist: [{ id: 'item-1' }, { id: 'item-2' }] });
    expect(checklistLines(step)).toEqual(['I ran it.', 'I saved it.']);
    const model = draftFromDoc(builtinLessonDoc('image')!, 'en');
    const made = docFromDraft({ ...model, id: 'image-check', steps: [...model.steps, step] });
    expect(made.steps.at(-1)).toEqual({ id: 'self-check-9', checklist: [{ id: 'item-1' }, { id: 'item-2' }] });
    expect(checkLessonDoc(made)).toEqual({ ok: true });
  });
});

describe('the example of the lesson file format page', () => {
  for (const page of ['Lesson-File-Format.md', 'Lesson-File-Format.ru.md']) {
    it(`${page}: the example of version 2 opens as it is, and can be done`, () => {
      const text = fs.readFileSync(path.join(__dirname, '../../docs/wiki/lessons', page), 'utf8');
      const block = /```json\n([\s\S]*?)\n```/.exec(text);
      expect(block, 'a json example').not.toBeNull();
      const read = readLessonFileText(block![1]);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.file.version).toBe(2);
      expect(lessonFileVersion(read.file.lessons)).toBe(2);
      for (const doc of read.file.lessons) expect(checkLessonDoc(doc)).toEqual({ ok: true });
    });
  }
});
