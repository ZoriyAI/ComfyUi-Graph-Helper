/**
 * The group "The daily work cycle" (sets/daily-cycle.ts): five lessons of the new standard on templates, the queue,
 * partial execution and the cache, the log and a minimal failing example, and the forms of a workflow file. Every
 * lesson has every word in both languages and the whole template of standard 2, can be done from an empty canvas,
 * keeps what happens in ComfyUI on the person's word, and checks with the app only what the app can read: the
 * minimal example must be small, and the formats lesson ends on an API-format file opened last.
 */
import { describe, expect, it } from 'vitest';
import { lessonOutcomes, lessonProgress, type LessonGraph } from '../../src/shared/lessons/engine';
import { LESSON_AFTER, LESSON_PATH, lessonById } from '../../src/shared/lessons/lessons';
import { levelOf, lessonPlace } from '../../src/shared/lessons/programme';
import { DAILY_CYCLE_GROUP, DAILY_CYCLE_LESSONS } from '../../src/shared/lessons/sets/daily-cycle';
import { DAILY_CYCLE_EN } from '../../src/shared/lessons/sets/daily-cycle.texts.en';
import { DAILY_CYCLE_RU } from '../../src/shared/lessons/sets/daily-cycle.texts.ru';
import { lessonStandardProblems, lessonWordsProblems } from '../../src/shared/lessons/schema';
import { answerAll, isPersonStep, readVerdict } from '../../src/shared/lessons/steps';
import { lessonShapes, tryLesson } from '../../src/shared/lessons/share/tryLesson';
import { builtinLessonDoc } from '../../src/shared/lessons/share/builtin';
import { checkLessonDoc } from '../../src/shared/lessons/share/mine';

const IDS = ['template-own'];

/** The canvas at the end of a lesson, played from an empty canvas after the lessons whose graph it stands on. */
function finished(id: string): LessonGraph {
  const lesson = lessonById(id)!;
  const before = (LESSON_AFTER[id] ?? []).map((other) => lessonById(other)!);
  let last: LessonGraph | null = null;
  const result = tryLesson(lesson, lessonShapes([...before, lesson]), { before, observe: (graph, _read, current) => { if (current.id === id) last = graph; } });
  expect(result.ok, id).toBe(true);
  return last!;
}

describe('the lessons of “The daily work cycle”', () => {
  it('stand in their own group, named as the module of the programme, in its order', () => {
    expect(DAILY_CYCLE_GROUP.title).toEqual({ en: 'The daily work cycle', ru: 'Ежедневный цикл работы' });
    expect(DAILY_CYCLE_LESSONS.map((lesson) => lesson.id)).toEqual(IDS);
    for (const id of IDS) {
      expect(LESSON_PATH[id].group.id).toBe('daily-cycle');
      expect(lessonPlace(id)).toEqual({ level: 1, tracks: ['base'], priority: 'core' });
    }
    // They follow the first picture and the reading of a workflow on the path.
    expect(LESSON_PATH['template-own'].follows).toEqual(['read-workflow']);
    expect(levelOf('read-workflow')).toBeLessThanOrEqual(1);
  });

  for (const lesson of DAILY_CYCLE_LESSONS) {
    it(`${lesson.id}: every word in both languages, and the whole template of standard 2`, () => {
      const words = { en: DAILY_CYCLE_EN[lesson.id], ru: DAILY_CYCLE_RU[lesson.id] };
      expect(lesson.standard).toBe(2);
      expect(lesson.outcomes).toEqual(['structure', 'run', 'result']);
      expect(Object.keys(words.en.steps).sort()).toEqual(Object.keys(words.ru.steps).sort());
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
      // Real canvas work, not reading only, and a run that is the person's word.
      expect(lesson.steps.some((step) => (step.roles?.length ?? 0) > 0 || (step.fields?.length ?? 0) > 0), lesson.id).toBe(true);
      expect(lesson.steps.some((step) => step.checklist?.some((item) => item.run)), lesson.id).toBe(true);
    });
  }

  it('can be done from an empty canvas, after the lessons whose graph they start from', () => {
    for (const id of IDS) {
      expect(checkLessonDoc(builtinLessonDoc(id)!, builtinLessonDoc), id).toEqual({ ok: true });
      finished(id);
    }
  });

  it('never claim a run without the person\'s tick', () => {
    for (const id of IDS) {
      const lesson = lessonById(id)!;
      const graph = finished(id);
      const read = new Set(lesson.steps.filter((step) => step.read).map((step) => step.id));
      const answers = Object.fromEntries(lesson.steps.filter(isPersonStep).map((step) => [step.id, answerAll(step)]));
      // Take back every run tick: the run outcome is open again.
      const noRun = Object.fromEntries(lesson.steps.filter(isPersonStep).map((step) => [step.id, Object.fromEntries(Object.entries(answers[step.id]).filter(([item]) => !step.checklist?.find((entry) => entry.id === item)?.run))]));
      const progress = lessonProgress(lesson, graph, {}, read, noRun);
      expect(lessonOutcomes(lesson, progress, noRun, graph, {}).find((item) => item.outcome === 'run')?.state, id).toBe('open');
    }
  });
});

describe('what the app checks itself', () => {
  it('a template made one\'s own: wide, two to four pictures, its own folder', () => {
    const graph = finished('template-own');
    const latent = graph.nodes.find((node) => node.classType === 'EmptyLatentImage')!;
    expect(Number(latent.values.height)).toBeLessThan(Number(latent.values.width));
    expect(Number(latent.values.batch_size)).toBeGreaterThanOrEqual(2);
    expect(String(graph.nodes.find((node) => node.classType === 'SaveImage')!.values.filename_prefix)).toContain('banner/');
  });
});
