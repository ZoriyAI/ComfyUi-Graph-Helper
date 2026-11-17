/**
 * The lesson file is untrusted data from anyone: these tests hand the reader hostile and broken files (huge, deep,
 * wrong types, path tricks in ids, markup and control characters in texts, rules that cannot hold together) and
 * check that each one is refused with a reason the window can say, or kept as plain inert text.
 */

import { describe, expect, it } from 'vitest';
import {
  LESSON_FILE_FORMAT,
  LESSON_FILE_VERSION,
  LESSON_LIMITS,
  engineLesson,
  jsonDepth,
  lessonFileName,
  readLessonFile,
  readLessonFileText,
} from '../../src/shared/lessons/share/format';
import { lessonShapes, tryLesson } from '../../src/shared/lessons/share/tryLesson';
import { sampleDoc } from '../fixtures/lessons/sampleLesson';

const file = (lessons: unknown[], extra: Record<string, unknown> = {}) => ({ format: LESSON_FILE_FORMAT, version: LESSON_FILE_VERSION, lessons, ...extra });

describe('reading a lesson file', () => {
  it('reads a lesson that holds together, and the engine lesson carries only what the engine reads', () => {
    const read = readLessonFile(file([sampleDoc()]));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const lesson = engineLesson(read.file.lessons[0], 'my:my-first');
    expect(lesson.id).toBe('my:my-first');
    expect(lesson.steps[2]).toEqual({ id: 'sampler', roles: [{ role: 'sampler', classes: ['KSampler'] }], links: [{ from: 'checkpoint', output: 'MODEL', to: 'sampler', input: 'model' }], fields: [{ role: 'sampler', field: 'steps', test: { kind: 'between', min: 10, max: 30, prefer: 20 } }] });
    expect(tryLesson(lesson, lessonShapes([lesson]))).toMatchObject({ ok: true });
  });

  it('refuses what is not a lesson file, and a file from a newer version says so', () => {
    expect(readLessonFileText('not json at all')).toEqual({ ok: false, problem: { code: 'not-json' } });
    expect(readLessonFileText('{"nodes": [], "links": []}')).toEqual({ ok: false, problem: { code: 'not-lesson' } });
    expect(readLessonFile([1, 2, 3])).toEqual({ ok: false, problem: { code: 'not-lesson' } });
    expect(readLessonFile(null)).toEqual({ ok: false, problem: { code: 'not-lesson' } });
    expect(readLessonFile(file([sampleDoc()], { version: 7 }))).toEqual({ ok: false, problem: { code: 'newer-version', version: 7 } });
  });

  it('refuses a huge file before it is parsed, and a deep one before the parser walks into it', () => {
    expect(readLessonFileText(' '.repeat(LESSON_LIMITS.fileBytes + 1))).toEqual({ ok: false, problem: { code: 'too-large' } });
    expect(readLessonFileText('я'.repeat(LESSON_LIMITS.fileBytes / 2 + 1))).toEqual({ ok: false, problem: { code: 'too-large' } });
    const deep = `${'['.repeat(100_000)}${']'.repeat(100_000)}`;
    expect(readLessonFileText(deep)).toEqual({ ok: false, problem: { code: 'too-deep' } });
    // Brackets inside strings are text, not depth.
    expect(jsonDepth('{"a": "[[[[[[[[[[[[[[[[[[[[[[[[[[[\\"]]]"}')).toBe(1);
  });

  it('keeps a separate byte limit for one lesson inside a larger course file', () => {
    // Refuse an oversized object before schema validation, even within an otherwise bounded collection.
    const large = { ...sampleDoc(), oversized: 'я'.repeat(LESSON_LIMITS.lessonBytes / 2 + 1) };
    expect(new TextEncoder().encode(JSON.stringify(large)).byteLength).toBeGreaterThan(LESSON_LIMITS.lessonBytes);
    expect(new TextEncoder().encode(JSON.stringify(file([large]))).byteLength).toBeLessThan(LESSON_LIMITS.fileBytes);
    expect(readLessonFile(file([large]))).toEqual({ ok: false, problem: { code: 'too-large' } });
  });

  it('refuses too many lessons, steps, roles and too long texts', () => {
    const many = Array.from({ length: LESSON_LIMITS.lessons + 1 }, (_, index) => sampleDoc({ id: `l-${index}` }));
    expect(readLessonFile(file(many))).toMatchObject({ ok: false, problem: { code: 'invalid', at: 'lessons' } });
    const long = sampleDoc();
    long.texts.en!.steps.intro.body = 'x'.repeat(LESSON_LIMITS.body + 1);
    expect(readLessonFile(file([long]))).toMatchObject({ ok: false, problem: { code: 'invalid', lesson: 'my-first' } });
    const steps = sampleDoc();
    steps.steps = Array.from({ length: LESSON_LIMITS.steps + 1 }, (_, index) => ({ id: `s-${index}`, read: true as const }));
    expect(readLessonFile(file([steps]))).toMatchObject({ ok: false, problem: { code: 'invalid', lesson: 'my-first', at: 'lessons.0.steps' } });
  });

  it('refuses wrong types and keys it does not know', () => {
    const wrong = (patch: (doc: any) => void) => {
      const doc: any = sampleDoc();
      patch(doc);
      return readLessonFile(file([doc]));
    };
    expect(wrong((doc) => { doc.steps = 'all of them'; })).toMatchObject({ ok: false, problem: { code: 'invalid' } });
    expect(wrong((doc) => { doc.steps[1].roles[0].classes = 'KSampler'; })).toMatchObject({ ok: false, problem: { code: 'invalid', step: 'loader' } });
    expect(wrong((doc) => { doc.steps[2].fields[0].test = { kind: 'between', min: '1', max: 2 }; })).toMatchObject({ ok: false, problem: { code: 'invalid' } });
    expect(wrong((doc) => { doc.steps[2].fields[0].test = { kind: 'run-this', code: 'process.exit()' }; })).toMatchObject({ ok: false, problem: { code: 'invalid' } });
    expect(wrong((doc) => { doc.steps[2].fields[0].test = { kind: 'between', min: 1, max: 2, check: '() => true' }; })).toMatchObject({ ok: false, problem: { code: 'invalid' } });
    expect(wrong((doc) => { doc.onOpen = 'fetch("http://example.invalid")'; })).toMatchObject({ ok: false, problem: { code: 'invalid' } });
    expect(wrong((doc) => { doc.steps[2].fields[0].test = { kind: 'between', min: 1, max: Number.POSITIVE_INFINITY }; })).toMatchObject({ ok: false });
    expect(wrong((doc) => { doc.adult = 'yes'; })).toMatchObject({ ok: false, problem: { code: 'invalid', at: 'lessons.0.adult' } });
  });

  it('refuses path tricks in ids: a lesson id is never a path', () => {
    for (const id of ['../../etc/passwd', 'a/b', 'a\\b', '.hidden', 'Upper', 'name.json', '', 'x'.repeat(LESSON_LIMITS.id + 1), 'con:']) {
      expect(readLessonFile(file([sampleDoc({ id })])), id).toMatchObject({ ok: false, problem: { code: 'invalid' } });
    }
    expect(lessonFileName('../../x/y')).toBe('x-y.lesson.json');
    expect(lessonFileName('')).toBe('lesson.lesson.json');
  });

  it('keeps markup in texts as plain text, and refuses control characters and hidden direction marks', () => {
    const markup = sampleDoc();
    markup.texts.en!.steps.intro.body = '<script>alert(1)</script> <img src=x onerror=alert(1)> [open](javascript:alert(1)) [site](https://example.invalid)';
    const read = readLessonFile(file([markup]));
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.file.lessons[0].texts.en!.steps.intro.body).toContain('<script>');
    const control = sampleDoc();
    control.texts.en!.title = 'Hidden\u0000title';
    expect(readLessonFile(file([control]))).toMatchObject({ ok: false, problem: { code: 'invalid' } });
    const bidi = sampleDoc();
    bidi.texts.en!.steps.loader.body = 'Choose ‮elif.exe';
    expect(readLessonFile(file([bidi]))).toMatchObject({ ok: false, problem: { code: 'invalid' } });
  });

  it('refuses a lesson whose parts do not hold together, naming the lesson and the step', () => {
    expect(readLessonFile(file([sampleDoc(), sampleDoc()]))).toEqual({ ok: false, problem: { code: 'duplicate-lesson', lesson: 'my-first' } });
    expect(readLessonFile(file([sampleDoc({ texts: {} })]))).toEqual({ ok: false, problem: { code: 'no-words', lesson: 'my-first' } });
    const noWords = sampleDoc();
    delete (noWords.texts.en!.steps as Record<string, unknown>).sampler;
    expect(readLessonFile(file([noWords]))).toEqual({ ok: false, problem: { code: 'missing-words', lesson: 'my-first', step: 'sampler', language: 'en' } });
    const unknown = sampleDoc();
    unknown.steps[2].links![0].from = 'nobody';
    expect(readLessonFile(file([unknown]))).toEqual({ ok: false, problem: { code: 'unknown-role', lesson: 'my-first', step: 'sampler', role: 'nobody' } });
    const twice = sampleDoc();
    twice.steps[2].roles![0].role = 'checkpoint';
    twice.steps[2].links![0].to = 'checkpoint';
    twice.steps[2].fields![0].role = 'checkpoint';
    expect(readLessonFile(file([twice]))).toEqual({ ok: false, problem: { code: 'role-twice', lesson: 'my-first', step: 'sampler', role: 'checkpoint' } });
    const range = sampleDoc();
    range.steps[2].fields![0].test = { kind: 'between', min: 30, max: 10 };
    expect(readLessonFile(file([range]))).toEqual({ ok: false, problem: { code: 'bad-range', lesson: 'my-first', step: 'sampler', field: 'steps' } });
    const prefer = sampleDoc();
    prefer.steps[2].fields![0].test = { kind: 'between', min: 10, max: 30, prefer: 99 };
    expect(readLessonFile(file([prefer]))).toMatchObject({ ok: false, problem: { code: 'bad-range' } });
    const reading = sampleDoc({ steps: [{ id: 'intro', read: true }], texts: { en: { title: 'Only words', result: '', steps: { intro: { title: 'Hi', body: '' } } } } });
    expect(readLessonFile(file([reading]))).toEqual({ ok: false, problem: { code: 'nothing-to-do', lesson: 'my-first' } });
  });

  it('holds a file to the kinds of model file the app knows and the reasons the app has written', () => {
    const known = sampleDoc();
    known.steps[1].fields![0].test = { kind: 'file', want: { kind: 'imageCheckpoint', notFamilies: ['wan2.1', 'wan2.2', 'ltx2', 'hunyuan'], folder: 'checkpoints', example: 'juggernautXL_v9.safetensors' } };
    expect(readLessonFile(file([known])).ok).toBe(true);
    const invented = sampleDoc();
    invented.steps[1].fields![0].test = { kind: 'file', want: { kind: 'anythingGoes', folder: 'checkpoints', example: 'x.safetensors' } };
    expect(readLessonFile(file([invented]))).toMatchObject({ ok: false, problem: { code: 'unknown-file-kind', step: 'loader' } });
    const changed = sampleDoc();
    changed.steps[1].fields![0].test = { kind: 'file', want: { kind: 'imageCheckpoint', folder: '../../etc', example: 'x' } };
    expect(readLessonFile(file([changed]))).toMatchObject({ ok: false, problem: { code: 'invalid' } });
    const reason = sampleDoc();
    reason.steps[2].fields![0].why = 'myOwnSentence';
    expect(readLessonFile(file([reason]))).toMatchObject({ ok: false, problem: { code: 'rules', lesson: 'my-first' } });
  });

  it('reads a lesson in one language only', () => {
    const russian = sampleDoc();
    russian.texts = { ru: { title: 'Первый урок', result: 'Загрузчик и сэмплер.', steps: { intro: { title: 'О чём', body: 'Соединим две ноды.' }, loader: { title: 'Загрузчик', body: 'Добавьте {checkpoint}.' }, sampler: { title: 'Сэмплер', body: 'Добавьте {sampler}.' } } } };
    expect(readLessonFile(file([russian])).ok).toBe(true);
  });
});

describe('trying a lesson from an empty canvas', () => {
  it('names the step that cannot be done', () => {
    const doc = sampleDoc();
    // A field rule that asks for a field no class of the lesson has, with an exact value nobody can set.
    doc.steps[2].fields!.push({ role: 'sampler', field: 'steps', test: { kind: 'equals', value: 5 } });
    const lesson = engineLesson(doc, 'my:x');
    const result = tryLesson(lesson, lessonShapes([lesson]));
    expect(result).toMatchObject({ ok: false, stepId: 'sampler', why: 'stuck' });
  });

  it('says when a class is not there', () => {
    const lesson = engineLesson(sampleDoc(), 'my:x');
    const result = tryLesson(lesson, (classType) => (classType === 'KSampler' ? null : lessonShapes([lesson])(classType)));
    expect(result).toMatchObject({ ok: false, stepId: 'sampler', why: 'no-class' });
  });
});
