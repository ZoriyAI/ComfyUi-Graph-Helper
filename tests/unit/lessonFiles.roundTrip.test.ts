/**
 * The foundation of lessons as files: every built-in lesson is written out in the lesson file format, read back,
 * and the lesson that comes back is the same lesson. "The same" is shown three ways: the steps are equal as data,
 * the words, group and order are equal, and the engine judges both the same on every canvas a person passes through
 * while doing the lesson from an empty canvas (and on that canvas with a node taken away).
 */

import { describe, expect, it } from 'vitest';
import { lessonProgress, otherRoles, type Lesson, type LessonFacts, type LessonGraph } from '../../src/shared/lessons/engine';
import { LESSONS, LESSON_AFTER, LESSON_PATH, isAdultLesson, lessonById } from '../../src/shared/lessons/lessons';
import { lessonWords } from '../../src/shared/lessons/texts';
import { allBuiltinLessonsFile, builtinGroupFile, builtinGroupIds, builtinLessonDoc } from '../../src/shared/lessons/share/builtin';
import { engineLesson, readLessonFileText, type LessonDoc } from '../../src/shared/lessons/share/format';
import { lessonShapes, tryLesson } from '../../src/shared/lessons/share/tryLesson';

/** Trigger words for the stand-in file every "choose a file" step gets, so trigger-word steps are tried for real. */
const FACTS: LessonFacts = { triggers: { 'chosen.safetensors': ['neon rain'] } };

/** The lessons whose graph a lesson stands on, first to last. */
function chain(id: string): Lesson[] {
  const before = LESSON_AFTER[id]?.[0];
  return before ? [...chain(before), lessonById(before)!] : [];
}

function roundTrip(): Map<string, LessonDoc> {
  const text = JSON.stringify(allBuiltinLessonsFile(), null, 2);
  const read = readLessonFileText(text);
  if (!read.ok) throw new Error(`the built-in lessons do not read back: ${JSON.stringify(read.problem)}`);
  return new Map(read.file.lessons.map((doc) => [doc.id, doc]));
}

describe('every built-in lesson as a lesson file', () => {
  const docs = roundTrip();

  it('writes every built-in lesson and reads all of them back', () => {
    expect(docs.size).toBe(LESSONS.length);
    expect([...docs.keys()]).toEqual(LESSONS.map((lesson) => lesson.id));
  });

  it('gives back the same steps, words, group, order and adult flag', () => {
    for (const lesson of LESSONS) {
      const doc = docs.get(lesson.id)!;
      // Equal to the lesson itself: the export leaves no rule out.
      expect(engineLesson(doc, lesson.id), lesson.id).toEqual(lesson);
      expect(doc.texts.en, lesson.id).toEqual(lessonWords('en', lesson.id));
      expect(doc.texts.ru, lesson.id).toEqual(lessonWords('ru', lesson.id));
      expect(doc.group, lesson.id).toEqual(LESSON_PATH[lesson.id].group);
      expect(doc.follows ?? [], lesson.id).toEqual(LESSON_PATH[lesson.id].follows);
      expect(doc.continues ?? [], lesson.id).toEqual(LESSON_AFTER[lesson.id] ?? []);
      expect(doc.adult === true, lesson.id).toBe(isAdultLesson(lesson.id));
      expect(doc.needs?.classes.length, lesson.id).toBeGreaterThan(0);
    }
  });

  it('has no rule that names a role its lesson never brings, so the export drops nothing', () => {
    // The engine never applies such a rule; schema.ts lessonProblems reports it, and a lesson file refuses it.
    const brought = (lesson: (typeof LESSONS)[number]) => new Set(lesson.steps.flatMap((step) => (step.roles ?? []).map((spec) => spec.role)));
    const dead = LESSONS.flatMap((lesson) => lesson.steps.flatMap((step) => (step.fields ?? [])
      .filter((spec) => ![spec.role, ...otherRoles(spec.test)].every((role) => brought(lesson).has(role)))
      .map((spec) => `${lesson.id}/${step.id}: ${spec.role}.${spec.field} (${spec.test.kind})`)));
    expect(dead).toEqual([]);
  });

  it('exports each group as a pack that reads back', () => {
    const groups = builtinGroupIds();
    expect(groups.length).toBeGreaterThan(3);
    let count = 0;
    for (const group of groups) {
      const read = readLessonFileText(JSON.stringify(builtinGroupFile(group)));
      expect(read.ok, group).toBe(true);
      if (read.ok) {
        count += read.file.lessons.length;
        expect(read.file.title?.en, group).toBeTruthy();
      }
    }
    expect(count).toBe(LESSONS.length);
    expect(builtinGroupFile('no-such-group')).toBeNull();
    expect(builtinLessonDoc('no-such-lesson')).toBeNull();
  });

  for (const lesson of LESSONS) {
    it(`${lesson.id}: the engine passes and fails the same steps on the same canvases`, () => {
      const back = engineLesson(docs.get(lesson.id)!, lesson.id);
      const before = chain(lesson.id);
      const shapes = lessonShapes([...before, lesson]);
      let compared = 0;
      const same = (graph: LessonGraph, read: ReadonlySet<string>) => {
        expect(lessonProgress(back, graph, FACTS, read), `${lesson.id} after ${compared} actions`).toEqual(lessonProgress(lesson, graph, FACTS, read));
        compared += 1;
      };
      const result = tryLesson(lesson, shapes, {
        facts: FACTS,
        before,
        observe: (graph, read, current) => {
          if (current.id !== lesson.id) return;
          same(graph, read);
          // And with the newest node taken away, so a step that held fails again in both.
          const last = graph.nodes[graph.nodes.length - 1];
          if (last) same({ nodes: graph.nodes.filter((node) => node !== last), links: graph.links.filter((link) => link.from !== last.id && link.to !== last.id) }, read);
        },
      });
      expect(result, `${lesson.id}: ${JSON.stringify(result)}`).toMatchObject({ ok: true });
      expect(compared).toBeGreaterThan(lesson.steps.length);
      // The lesson that came back can be done from an empty canvas on its own as well.
      expect(tryLesson(back, shapes, { facts: FACTS, before })).toMatchObject({ ok: true });
    });
  }
});
