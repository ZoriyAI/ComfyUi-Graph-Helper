/**
 * The group "Experiments and quality" (sets/experiments.ts), the first lessons of the new standard: both lessons have
 * every word in both languages, meet the template of standard 2, use every kind of step, can be done from an empty
 * canvas, hold a person to one change at a time on the canvas, and say plainly what the app does not check. They are
 * the example the next writers copy, so they must be right.
 */
import { describe, expect, it } from 'vitest';
import { lessonOutcomes, lessonProgress, type LessonGraph } from '../../src/shared/lessons/engine';
import { LESSON_PATH, lessonById } from '../../src/shared/lessons/lessons';
import { EXPERIMENT_LESSONS, EXPERIMENTS_GROUP } from '../../src/shared/lessons/sets/experiments';
import { EXPERIMENTS_EN } from '../../src/shared/lessons/sets/experiments.texts.en';
import { EXPERIMENTS_RU } from '../../src/shared/lessons/sets/experiments.texts.ru';
import { lessonStandardProblems, lessonWordsProblems } from '../../src/shared/lessons/schema';
import { answerAll, isPersonStep, stepKind, TICK } from '../../src/shared/lessons/steps';
import { lessonShapes, tryLesson, TryCanvas } from '../../src/shared/lessons/share/tryLesson';
import { builtinLessonDoc } from '../../src/shared/lessons/share/builtin';
import { checkLessonDoc } from '../../src/shared/lessons/share/mine';

describe('the lessons of “Experiments and quality”', () => {
  it('stand in their own group, named as the module of the programme', () => {
    expect(EXPERIMENTS_GROUP.title).toEqual({ en: 'Experiments and quality', ru: 'Эксперименты и качество' });
    for (const lesson of EXPERIMENT_LESSONS) expect(LESSON_PATH[lesson.id].group.id).toBe('experiments');
  });

  for (const lesson of EXPERIMENT_LESSONS) {
    it(`${lesson.id}: every word in both languages, and the whole template of standard 2`, () => {
      const words = { en: EXPERIMENTS_EN[lesson.id], ru: EXPERIMENTS_RU[lesson.id] };
      expect(lesson.standard).toBe(2);
      expect(Object.keys(words.en.steps).sort()).toEqual(Object.keys(words.ru.steps).sort());
      expect(lessonWordsProblems(lesson, words)).toEqual([]);
      expect(lessonStandardProblems(lesson, words)).toEqual([]);
      for (const language of ['en', 'ru'] as const) {
        expect(words[language].meta!.mistakes!.length, language).toBeGreaterThanOrEqual(3);
        // A step says where the app stops: it does not run ComfyUI and does not judge a picture.
        expect(words[language].meta!.notChecked, language).toMatch(language === 'en' ? /does not run|runs nothing/ : /не запускает|ничего не запускает/);
      }
      // No level, criterion or choice is the same words in both languages by mistake (a missing translation).
      for (const step of lesson.steps) {
        for (const criterion of step.rubric ?? []) expect(words.ru.steps[step.id].criteria![criterion.id].title).not.toBe(words.en.steps[step.id].criteria![criterion.id].title);
        for (const question of step.quiz ?? []) expect(words.ru.steps[step.id].questions![question.id].text).not.toBe(words.en.steps[step.id].questions![question.id].text);
      }
    });
  }

  it('together use every kind of step: checklist, canvas, read-check, rubric, quiz and a transfer task on the canvas and as a checklist', () => {
    const kinds = new Set(EXPERIMENT_LESSONS.flatMap((lesson) => lesson.steps.map(stepKind)));
    expect([...kinds].sort()).toEqual(['canvas', 'checklist', 'quiz', 'read', 'read-check', 'rubric']);
    const transfers = EXPERIMENT_LESSONS.flatMap((lesson) => lesson.steps.filter((step) => step.transfer).map(stepKind));
    expect(transfers.sort()).toEqual(['canvas', 'checklist']);
    for (const lesson of EXPERIMENT_LESSONS) expect(lesson.outcomes).toEqual(['structure', 'run', 'result']);
  });

  it('can be done from an empty canvas, after the lessons whose graph they start from', () => {
    for (const lesson of EXPERIMENT_LESSONS) {
      const doc = builtinLessonDoc(lesson.id)!;
      expect(checkLessonDoc(doc, builtinLessonDoc), lesson.id).toEqual({ ok: true });
    }
    const chain = [lessonById('image')!, lessonById('one-factor')!];
    expect(tryLesson(lessonById('blind-compare')!, lessonShapes([...chain, lessonById('blind-compare')!]), { before: chain }).ok).toBe(true);
  });
});

describe('one change at a time, on the canvas', () => {
  const lesson = lessonById('one-factor')!;
  /** The canvas a person has at the end of the lesson, built the way the app's try builds it. */
  function finished(): TryCanvas {
    const before = [lessonById('image')!];
    const shapes = lessonShapes([...before, lesson]);
    const canvas = new TryCanvas(shapes);
    // Played to the end by the try itself, on a canvas we can then change.
    const result = tryLesson(lesson, shapes, { before, observe: (graph) => { canvas.nodes = graph.nodes; canvas.links = graph.links; } });
    expect(result.ok).toBe(true);
    return canvas;
  }
  const read = new Set(lesson.steps.filter((step) => step.read).map((step) => step.id));
  const answers = Object.fromEntries(lesson.steps.filter(isPersonStep).map((step) => [step.id, answerAll(step)]));

  it('goes back to the step "One difference" when a second setting differs too', () => {
    const canvas = finished();
    const at = (graph: LessonGraph) => lesson.steps[lessonProgress(lesson, graph, {}, read, answers).current]?.id ?? 'end';
    // The observed canvas is the one before the last action; the try ends one action later, so finish it here.
    const samplers = canvas.nodes.filter((node) => node.classType === 'KSampler');
    expect(samplers.length).toBeGreaterThanOrEqual(2);
    const [first, second] = samplers;
    second.values.seed = Number(first.values.seed ?? 0) + 1;
    expect(at(canvas)).toBe('factor');
    const progress = lessonProgress(lesson, canvas, {}, read, answers);
    expect(progress.missing.map((item) => (item.kind === 'field' ? item.field : item.kind))).toEqual(['seed']);
  });

  it('ends with the structure checked by the app and the run and the result on the person\'s word', () => {
    const shapes = lessonShapes([lessonById('image')!, lesson]);
    let last: LessonGraph | null = null;
    expect(tryLesson(lesson, shapes, { before: [lessonById('image')!], observe: (graph) => { last = graph; } }).ok).toBe(true);
    // Without a run tick nothing claims a run.
    const noRun = { ...answers, run: { export: TICK, fixed: TICK } };
    const graph = last!;
    const progress = lessonProgress(lesson, graph, {}, read, noRun);
    expect(lessonOutcomes(lesson, progress, noRun, graph, {}).find((item) => item.outcome === 'run')?.state).toBe('open');
  });
});
