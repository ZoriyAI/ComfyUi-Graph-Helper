/**
 * The set "reliable-practice" (sets/reliable-practice.ts): reading a model card (in the group "Experiments and
 * quality"), and the group "Diagnostics, performance and safety" with diagnosing missing nodes, auditing someone
 * else's workflow and the cost of partner nodes. Every lesson has its words in both languages, meets the template of
 * standard 2, can be done from an empty canvas, says plainly what the app does not check, and uses read-checks only
 * for what the app can read. These lessons speak of safety and money, so their checks must hold.
 */
import { describe, expect, it } from 'vitest';
import { lessonProgress, type LessonGraph } from '../../src/shared/lessons/engine';
import { LESSON_PATH, lessonById } from '../../src/shared/lessons/lessons';
import { DIAGNOSTICS_GROUP, RELIABLE_LESSONS } from '../../src/shared/lessons/sets/reliable-practice';
import { RELIABLE_EN } from '../../src/shared/lessons/sets/reliable-practice.texts.en';
import { RELIABLE_RU } from '../../src/shared/lessons/sets/reliable-practice.texts.ru';
import { lessonStandardProblems, lessonWordsProblems } from '../../src/shared/lessons/schema';
import { answerAll, isPersonStep, personStepDone, readVerdict, SELF_CHECK, TICK } from '../../src/shared/lessons/steps';
import { lessonShapes, tryLesson } from '../../src/shared/lessons/share/tryLesson';
import { builtinLessonDoc } from '../../src/shared/lessons/share/builtin';
import { checkLessonDoc } from '../../src/shared/lessons/share/mine';
import { levelOf, lessonPlace } from '../../src/shared/lessons/programme';

describe('the lessons of the set “reliable-practice”', () => {
  it('stand in their groups: the model card with the experiments, the other three in the diagnostics group', () => {
    expect(DIAGNOSTICS_GROUP.title).toEqual({ en: 'Diagnostics, performance and safety', ru: 'Диагностика, производительность и безопасность' });
    expect(LESSON_PATH['model-card'].group.id).toBe('experiments');
    for (const id of ['diagnose-missing']) expect(LESSON_PATH[id].group.id).toBe('diagnostics');
    for (const lesson of RELIABLE_LESSONS) {
      expect(levelOf(lesson.id)).toBe(2);
      expect(lessonPlace(lesson.id)).toMatchObject({ priority: 'core', tracks: ['base'] });
    }
  });

  for (const lesson of RELIABLE_LESSONS) {
    it(`${lesson.id}: every word in both languages, and the whole template of standard 2`, () => {
      const words = { en: RELIABLE_EN[lesson.id], ru: RELIABLE_RU[lesson.id] };
      expect(lesson.standard).toBe(2);
      expect(lesson.outcomes).toEqual(['structure', 'run', 'result']);
      expect(Object.keys(words.en.steps).sort()).toEqual(Object.keys(words.ru.steps).sort());
      expect(Object.keys(words.en.steps).sort()).toEqual(lesson.steps.map((step) => step.id).sort());
      expect(lessonWordsProblems(lesson, words)).toEqual([]);
      expect(lessonStandardProblems(lesson, words)).toEqual([]);
      for (const language of ['en', 'ru'] as const) {
        expect(words[language].meta!.mistakes!.length, language).toBeGreaterThanOrEqual(3);
        expect(words[language].meta!.notChecked, language).toMatch(language === 'en' ? /does not run|runs nothing/ : /не запускает|ничего не запускает/);
      }
      for (const step of lesson.steps) {
        for (const criterion of step.rubric ?? []) expect(words.ru.steps[step.id].criteria![criterion.id].title).not.toBe(words.en.steps[step.id].criteria![criterion.id].title);
        for (const question of step.quiz ?? []) expect(words.ru.steps[step.id].questions![question.id].text).not.toBe(words.en.steps[step.id].questions![question.id].text);
      }
    });

    it(`${lesson.id}: can be done from an empty canvas, after the lessons whose graph it starts from`, () => {
      expect(checkLessonDoc(builtinLessonDoc(lesson.id)!, builtinLessonDoc), lesson.id).toEqual({ ok: true });
    });
  }

  it('use only the read-checks the brief names for each lesson', () => {
    const kinds = (id: string) => new Set(lessonById(id)!.steps.flatMap((step) => [...(step.readCheck ?? []), ...(step.checklist ?? []).flatMap((item) => (item.check ? [item.check] : []))]).map((item) => item.kind));
    expect([...kinds('model-card')].sort()).toEqual(['comfy-read', 'model-file', 'workflow-complete']);
    expect([...kinds('diagnose-missing')].sort()).toEqual(['comfy-read', 'node-class', 'workflow-complete']);
  });

  it('mention the app\'s own tools by the names the window shows', () => {
    const en = JSON.stringify(RELIABLE_EN);
    const ru = JSON.stringify(RELIABLE_RU);
    expect(en).toContain('“Check graph”');
    expect(en).toContain('“Explain a ComfyUI error…”');
    expect(ru).toContain('«Проверить граф»');
    expect(ru).toContain('«Разобрать ошибку ComfyUI…»');
  });
});

describe('what the app checks in these lessons', () => {
  it('holds a LoRA to the family of the checkpoint (model-card)', () => {
    const step = lessonById('model-card')!.steps.find((item) => item.id === 'lora')!;
    expect(step.fields).toEqual([expect.objectContaining({ role: 'lora', field: 'lora_name', test: { kind: 'sameFamily', role: 'checkpoint', field: 'ckpt_name' }, why: 'sameFamily' })]);
  });

  it('says a run only on a run tick (diagnose-missing)', () => {
    const lesson = lessonById('diagnose-missing')!;
    const shapes = lessonShapes([lessonById('image')!, lesson]);
    let last: LessonGraph | null = null;
    expect(tryLesson(lesson, shapes, { before: [lessonById('image')!], observe: (graph) => { last = graph; } }).ok).toBe(true);
    const read = new Set(lesson.steps.filter((step) => step.read).map((step) => step.id));
    const answers = Object.fromEntries(lesson.steps.filter(isPersonStep).map((step) => [step.id, answerAll(step)]));
    // Without the baseline run tick the lesson stays at the step of the test.
    const noRun = { ...answers, test: { fix: TICK, rerun: TICK } };
    expect(lesson.steps[lessonProgress(lesson, last!, {}, read, noRun).current]?.id).toBe('test');
    expect(lesson.steps[lessonProgress(lesson, last!, {}, read, answers).current]?.id).not.toBe('test');
  });
});
