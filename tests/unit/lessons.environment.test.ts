/**
 * The group "Start and a reliable setup" (sets/environment.ts), the lessons of level 0: every lesson has every word in
 * both languages, meets the template of standard 2, can be done from an empty canvas, stands first in the list and on
 * the base path before "How ComfyUI works", uses only the read-checks the app can really answer, and never claims a
 * run or a result the person did not give. They teach installing and updating, which the app never does itself, so
 * their honesty about who did what is the point of this test.
 */
import { describe, expect, it } from 'vitest';
import { lessonOutcomes, lessonProgress, type LessonGraph } from '../../src/shared/lessons/engine';
import { LESSONS, LESSON_PATH, lessonById, nextLesson } from '../../src/shared/lessons/lessons';
import { trackPath } from '../../src/shared/lessons/navigation';
import { levelOf, LESSON_PROGRAMME } from '../../src/shared/lessons/programme';
import { ENVIRONMENT_GROUP, ENVIRONMENT_LESSONS, FIRST_PACK_CLASSES } from '../../src/shared/lessons/sets/environment';
import { ENVIRONMENT_EN } from '../../src/shared/lessons/sets/environment.texts.en';
import { ENVIRONMENT_RU } from '../../src/shared/lessons/sets/environment.texts.ru';
import { lessonStandardProblems, lessonWordsProblems } from '../../src/shared/lessons/schema';
import { answerAll, isPersonStep, readVerdict } from '../../src/shared/lessons/steps';
import { lessonShapes, tryLesson } from '../../src/shared/lessons/share/tryLesson';
import { builtinLessonDoc } from '../../src/shared/lessons/share/builtin';
import { checkLessonDoc } from '../../src/shared/lessons/share/mine';

const IDS = ['choose-setup', 'first-run', 'model-library', 'first-pack', 'snapshots'];

describe('the lessons of “Start and a reliable setup”', () => {
  it('stand in their own group, first in the list, at level 0 of the base track and core', () => {
    expect(ENVIRONMENT_GROUP.title).toEqual({ en: 'Start and a reliable setup', ru: 'Старт и надёжная среда' });
    expect(ENVIRONMENT_LESSONS.map((lesson) => lesson.id)).toEqual(IDS);
    expect(LESSONS.slice(0, IDS.length).map((lesson) => lesson.id)).toEqual(IDS);
    for (const id of IDS) {
      expect(LESSON_PATH[id].group.id).toBe('environment');
      expect(LESSON_PROGRAMME[id]).toEqual({ level: 0, tracks: ['base'], priority: 'core' });
    }
  });

  it('come before “How ComfyUI works” on the base path and in the list', () => {
    const base = trackPath('base').map((lesson) => lesson.id);
    for (const id of IDS) expect(base.indexOf(id), id).toBeLessThan(base.indexOf('comfy-basics'));
    expect(nextLesson('snapshots')?.id).toBe('comfy-basics');
    expect(levelOf('comfy-basics')).toBe(1);
  });

  for (const lesson of ENVIRONMENT_LESSONS) {
    it(`${lesson.id}: every word in both languages, and the whole template of standard 2`, () => {
      const words = { en: ENVIRONMENT_EN[lesson.id], ru: ENVIRONMENT_RU[lesson.id] };
      expect(lesson.standard).toBe(2);
      expect(Object.keys(words.en.steps).sort()).toEqual(Object.keys(words.ru.steps).sort());
      expect(Object.keys(words.en.steps).sort()).toEqual(lesson.steps.map((step) => step.id).sort());
      expect(lessonWordsProblems(lesson, words)).toEqual([]);
      expect(lessonStandardProblems(lesson, words)).toEqual([]);
      for (const language of ['en', 'ru'] as const) {
        expect(words[language].meta!.mistakes!.length, language).toBeGreaterThanOrEqual(3);
        // The app reads ComfyUI and never changes it, and the lesson says so.
        expect(words[language].meta!.notChecked, language).toMatch(language === 'en' ? /does not run|runs nothing|run anything/ : /не запускает|ничего не запускает/);
      }
      for (const step of lesson.steps) {
        for (const criterion of step.rubric ?? []) expect(words.ru.steps[step.id].criteria![criterion.id].title).not.toBe(words.en.steps[step.id].criteria![criterion.id].title);
        for (const question of step.quiz ?? []) expect(words.ru.steps[step.id].questions![question.id].text).not.toBe(words.en.steps[step.id].questions![question.id].text);
      }
    });
  }

  it('can be done from an empty canvas', () => {
    for (const lesson of ENVIRONMENT_LESSONS) {
      const doc = builtinLessonDoc(lesson.id)!;
      expect(checkLessonDoc(doc, builtinLessonDoc), lesson.id).toEqual({ ok: true });
    }
  });

  it('check only what the app reads: a ComfyUI read, a model file, the first pack\'s nodes, the workflow', () => {
    const kinds = new Set(ENVIRONMENT_LESSONS.flatMap((lesson) => lesson.steps.flatMap((step) => [
      ...(step.readCheck ?? []).map((condition) => condition.kind),
      ...(step.checklist ?? []).flatMap((item) => (item.check ? [item.check.kind] : [])),
    ])));
    expect([...kinds].sort()).toEqual(['comfy-read', 'model-file', 'node-class', 'workflow-complete', 'workflow-from']);
    // The pack's node classes as ComfyUI-Custom-Scripts registers them.
    const pack = { kind: 'node-class' as const, classes: FIRST_PACK_CLASSES };
    const empty: LessonGraph = { nodes: [], links: [] };
    expect(readVerdict(pack, empty, { catalogRead: true, installed: (name) => name === 'ShowText|pysssss' })).toBe('holds');
    expect(readVerdict(pack, empty, { catalogRead: true, installed: () => false })).toBe('fails');
    expect(readVerdict(pack, empty, { catalogRead: false })).toBe('unknown');
  });

  it('never claims a run the person did not tick', () => {
    for (const lesson of ENVIRONMENT_LESSONS.filter((item) => item.outcomes?.includes('run'))) {
      const read = new Set(lesson.steps.filter((step) => step.read).map((step) => step.id));
      const runIds = new Set(lesson.steps.flatMap((step) => (step.checklist ?? []).filter((item) => item.run).map((item) => `${step.id}/${item.id}`)));
      expect(runIds.size, lesson.id).toBeGreaterThan(0);
      // Every answer given but the run ticks.
      const answers = Object.fromEntries(lesson.steps.filter(isPersonStep).map((step) => {
        const all = answerAll(step);
        return [step.id, Object.fromEntries(Object.entries(all).filter(([item]) => !runIds.has(`${step.id}/${item}`)))];
      }));
      let last: LessonGraph | null = null;
      expect(tryLesson(lesson, lessonShapes([lesson]), { observe: (graph) => { last = graph; } }).ok, lesson.id).toBe(true);
      const graph = last!;
      const progress = lessonProgress(lesson, graph, {}, read, answers);
      expect(lessonOutcomes(lesson, progress, answers, graph, {}).find((item) => item.outcome === 'run')?.state, lesson.id).toBe('open');
    }
  });
});
