/**
 * The built-in lessons written out in the lesson file format (format.ts), so that a person can export any of them,
 * or a whole group, and so that the base of lessons can grow later in the same format the app reads back.
 *
 * Who uses it: the Lessons panel's export buttons, and the round-trip test that writes every built-in lesson out,
 * reads it back and checks that the engine treats both the same.
 *
 * Why nothing is lost: a built-in lesson is already pure data (roles, links, field rules; no functions), its words
 * live in texts.*.ts by lesson and step id, its group and order in LESSON_PATH and LESSON_AFTER. This module only
 * gathers those pieces into one document.
 */

import { rolesOf, type FieldSpec, type Lesson } from '../engine';
import { packOf } from '../fit';
import { LESSONS, LESSON_AFTER, LESSON_PATH, isAdultLesson, lessonById } from '../lessons';
import { lessonWords, type LessonWords } from '../texts';
import { lessonFileOf, type LessonDoc, type LessonDocWords, type LessonFile } from './format';
import { DISPLAY_NAME } from '../../productNames';

/** Who wrote a built-in lesson, as the file says it. */
export const BUILTIN_AUTHOR = DISPLAY_NAME;
/** Where a built-in lesson comes from, as text in the file. */
export const BUILTIN_SOURCE = `Built-in lesson of ${DISPLAY_NAME}`;

function wordsOf(words: LessonWords | null): LessonDocWords | undefined {
  if (!words) return undefined;
  return {
    title: words.title,
    result: words.result,
    steps: Object.fromEntries(Object.entries(words.steps).map(([step, item]) => [step, { title: item.title, body: item.body }])),
    // The lesson's own role labels travel with it, so an exported face swap still calls the face picture a face picture.
    ...(words.roles ? { roles: { ...words.roles } } : {}),
  };
}

/** The roles a field rule names: its own and the ones it compares with (engine.ts otherRoles). */
function rolesOfRule(spec: FieldSpec): string[] {
  const test = spec.test;
  const others = test.kind === 'has-trigger' ? test.of.flatMap((item) => ('role' in item ? [item.role] : []))
    : test.kind === 'text' ? (test.notCopyOf ? [test.notCopyOf.role] : [])
      : test.kind === 'size' ? [test.of.role]
        : 'role' in test && typeof test.role === 'string' ? [test.role] : [];
  return [spec.role, ...others];
}

/**
 * The lesson without the field rules that name a role the lesson never brings. The engine never applies such a
 * rule (its roles are never all matched), so leaving it out changes nothing a person meets; a lesson file refuses
 * it, because in a file it is a mistake. deadRules lists them for the lesson engine owner.
 */
export function liveLesson(lesson: Lesson): Lesson {
  const brought = new Set(rolesOf(lesson).map((spec) => spec.role));
  return {
    ...lesson,
    steps: lesson.steps.map((step) => {
      if (!step.fields) return step;
      const fields = step.fields.filter((spec) => rolesOfRule(spec).every((role) => brought.has(role)));
      if (fields.length === step.fields.length) return step;
      const { fields: _dropped, ...rest } = step;
      return fields.length > 0 ? { ...rest, fields } : rest;
    }),
  };
}

/** The built-in rules liveLesson leaves out, as "lesson/step: role.field". */
export function deadRules(): string[] {
  return LESSONS.flatMap((lesson) => {
    const brought = new Set(rolesOf(lesson).map((spec) => spec.role));
    return lesson.steps.flatMap((step) => (step.fields ?? []).filter((spec) => !rolesOfRule(spec).every((role) => brought.has(role))).map((spec) => `${lesson.id}/${step.id}: ${spec.role}.${spec.field} (${spec.test.kind})`));
  });
}

/** The node classes a lesson names and the packs (other than ComfyUI itself) they come from. */
export function lessonNeeds(classes: string[]): { packs: string[]; classes: string[] } {
  const unique = [...new Set(classes)];
  return { packs: [...new Set(unique.map(packOf).filter((pack): pack is string => pack !== null))], classes: unique };
}

/** One built-in lesson as a document of the lesson file; null for an id that is not a built-in lesson. */
export function builtinLessonDoc(id: string): LessonDoc | null {
  const lesson = lessonById(id);
  if (!lesson) return null;
  const path = LESSON_PATH[id];
  const en = wordsOf(lessonWords('en', id));
  const ru = wordsOf(lessonWords('ru', id));
  const continues = LESSON_AFTER[id] ?? [];
  return {
    id,
    ...(path ? { group: { id: path.group.id, title: { en: path.group.title.en, ru: path.group.title.ru } } } : {}),
    ...(path && path.follows.length > 0 ? { follows: [...path.follows] } : {}),
    ...(continues.length > 0 ? { continues: [...continues] } : {}),
    ...(isAdultLesson(id) ? { adult: true } : {}),
    author: BUILTIN_AUTHOR,
    source: BUILTIN_SOURCE,
    needs: lessonNeeds(rolesOf(lesson).flatMap((spec) => spec.classes)),
    texts: { ...(en ? { en } : {}), ...(ru ? { ru } : {}) },
    // A deep copy through JSON: the document never shares an object with the running lesson.
    steps: JSON.parse(JSON.stringify(liveLesson(lesson).steps)) as LessonDoc['steps'],
  };
}

/** The ids of the built-in groups, in the order of the list. */
export function builtinGroupIds(): string[] {
  return [...new Set(LESSONS.map((lesson) => LESSON_PATH[lesson.id]?.group.id).filter((id): id is string => Boolean(id)))];
}

/** A whole built-in group as one lesson file (a pack), or null for an unknown group. */
export function builtinGroupFile(groupId: string): LessonFile | null {
  const lessons = LESSONS.filter((lesson) => LESSON_PATH[lesson.id]?.group.id === groupId);
  if (lessons.length === 0) return null;
  const group = LESSON_PATH[lessons[0].id].group;
  return lessonFileOf(lessons.map((lesson) => builtinLessonDoc(lesson.id)!), { en: group.title.en, ru: group.title.ru });
}

/** Every built-in lesson in one file, in the order of the list. */
export function allBuiltinLessonsFile(): LessonFile {
  return lessonFileOf(LESSONS.map((lesson) => builtinLessonDoc(lesson.id)!), { en: 'Built-in lessons', ru: 'Встроенные уроки' });
}
