/**
 * "My lessons": the lessons a person keeps in their profile, beside the built-in ones. Each one was made here
 * (the lesson editor), came from a file (import), or was drafted by the assistant and accepted by the person.
 *
 * Who uses it: the store in main (src/main/lessons/store.ts) that keeps them as files in the profile folder, the
 * Lessons panel that lists them in their own group and runs them, and the assistant's draft card.
 *
 * Why a namespace: a lesson of a person never replaces a built-in lesson. Its id in the app is `my:` and its own
 * id, so `image` from a file is `my:image` and the built-in `image` stays what it is. The id inside the file stays
 * the plain one, so a lesson exported again reads back the same.
 */

import { z } from 'zod';
import type { Lesson } from '../engine';
import { lessonById } from '../lessons';
import { lessonWords } from '../texts';
import { engineLesson, lessonDocProblem, lessonFileVersion, readLessonFile, LESSON_FILE_FORMAT, LESSON_FILE_VERSION, LESSON_LIMITS, type LessonDoc, type LessonFileProblem } from './format';
import { lessonShapes, tryLesson, type ClassShapes, type TryResult } from './tryLesson';

/** Where a lesson of the person came from: made in the editor, imported from a file, drafted by the assistant. */
export type LessonOrigin = 'made' | 'file' | 'assistant';
/** Every origin, in a fixed order. */
export const LESSON_ORIGINS: readonly LessonOrigin[] = ['made', 'file', 'assistant'];

/** The prefix of the app id of a person's lesson. */
export const MY_LESSON_PREFIX = 'my:';
/** The group of the person's lessons in the list. */
export const MY_LESSONS_GROUP = { id: 'mine', title: { en: 'My lessons', ru: 'Мои уроки' } } as const;
/** How many lessons a profile keeps; an import past it is refused. */
export const MY_LESSONS_MAX = 500;

/** One lesson as the profile keeps it. */
export interface MyLesson {
  /** The app id: `my:` and the lesson's own id. */
  id: string;
  origin: LessonOrigin;
  /** When it was added or last saved (ms since 1970). */
  savedAt: number;
  /** The person marked it as adult content: it stays behind the "Adult content (18+)" switch even if the file did not say so. */
  adultMark: boolean;
  /** The name of the file it came from (the base name only), for the mark "from a file". */
  fileName?: string;
  doc: LessonDoc;
}

/** The app id of a person's lesson: `my:` and its own id, so it never takes the place of a built-in lesson. */
export function myLessonId(docId: string): string {
  return `${MY_LESSON_PREFIX}${docId}`;
}

/** Whether an app id names a person's lesson rather than a built-in one. */
export function isMyLessonId(id: string): boolean {
  return id.startsWith(MY_LESSON_PREFIX);
}

/** The lesson's own id from the app id, or null for an id that is not a person's lesson. */
export function docIdOf(id: string): string | null {
  return isMyLessonId(id) ? id.slice(MY_LESSON_PREFIX.length) : null;
}

/** Whether a person's lesson stays behind the "Adult content (18+)" switch. */
export function isAdultMine(lesson: MyLesson): boolean {
  return lesson.doc.adult === true || lesson.adultMark;
}

/** The steps as the engine takes them, under the app id. */
export function myEngineLesson(lesson: MyLesson): Lesson {
  return engineLesson(lesson.doc, lesson.id);
}

/** A file name a person gave, without folders, control characters or more than 120 characters; shown, never opened. */
export function safeFileName(name: unknown): string | undefined {
  if (typeof name !== 'string') return undefined;
  const base = name.split(/[\\/]/).pop() ?? '';
  const clean = base.replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, '').trim().slice(0, 120);
  return clean || undefined;
}

const storedSchema = z.object({
  format: z.literal(`${LESSON_FILE_FORMAT}/mine`),
  // A record written by version 1.0 says 1; a lesson that uses the steps of version 1.1 says 2.
  version: z.union([z.literal(1), z.literal(2)]),
  origin: z.enum(['made', 'file', 'assistant']),
  savedAt: z.number().int().min(0),
  adultMark: z.boolean(),
  fileName: z.string().max(120).optional(),
  lesson: z.unknown(),
}).strict();

/** The record a profile file holds: the lesson document and what the app knows about it. */
export function storedRecord(lesson: MyLesson): Record<string, unknown> {
  return {
    format: `${LESSON_FILE_FORMAT}/mine`,
    version: lessonFileVersion([lesson.doc]),
    origin: lesson.origin,
    savedAt: lesson.savedAt,
    adultMark: lesson.adultMark,
    ...(lesson.fileName ? { fileName: lesson.fileName } : {}),
    lesson: lesson.doc,
  };
}

/**
 * Reads a profile record back. A file in the profile can be changed by hand, so it is checked as strictly as an
 * import: the lesson inside goes through the same reader.
 */
export function readStoredRecord(value: unknown): MyLesson | null {
  const parsed = storedSchema.safeParse(value);
  if (!parsed.success) return null;
  const read = readLessonFile({ format: LESSON_FILE_FORMAT, version: LESSON_FILE_VERSION, lessons: [parsed.data.lesson] });
  if (!read.ok) return null;
  const doc = read.file.lessons[0];
  return {
    id: myLessonId(doc.id),
    origin: parsed.data.origin,
    savedAt: parsed.data.savedAt,
    adultMark: parsed.data.adultMark,
    ...(parsed.data.fileName ? { fileName: safeFileName(parsed.data.fileName) } : {}),
    doc,
  };
}

/**
 * The lessons a lesson of the person starts from, first to last: another lesson of the same pack or of the
 * person (by its own id), else a built-in lesson of that id. Lessons it cannot find are left out: they are a hint.
 */
export function chainOf(doc: LessonDoc, find: (docId: string) => LessonDoc | null, seen: ReadonlySet<string> = new Set()): Lesson[] {
  const first = doc.continues?.[0];
  if (!first || seen.has(first) || seen.size > 8) return [];
  const trail = new Set([...seen, doc.id]);
  const mine = find(first);
  if (mine) return [...chainOf(mine, find, trail), engineLesson(mine, myLessonId(mine.id))];
  const builtin = lessonById(first);
  return builtin ? [builtin] : [];
}

/** The titles of a lesson and of one of its steps, per language, so a refusal names them in words. */
export type StepNames = Partial<Record<'en' | 'ru', { lesson: string; step: string }>>;

/** A try that failed: the lesson and step that cannot be done, why, and their titles. */
export type FailedTry = Extract<TryResult, { ok: false }> & { names?: StepNames };

/** The verdict on one lesson before it is kept: its parts hold together, and it can be done from an empty canvas. */
export type LessonCheck = { ok: true } | { ok: false; problem: LessonFileProblem } | { ok: false; tried: FailedTry };

/** The titles of the lesson a failed try is about (this one, one it continues, or a built-in one) and of its step. */
function namesOf(tried: Extract<TryResult, { ok: false }>, doc: LessonDoc, find: (docId: string) => LessonDoc | null): StepNames {
  const own = docIdOf(tried.lessonId);
  const source = own === doc.id ? doc : own ? find(own) : null;
  const names: StepNames = {};
  for (const language of ['en', 'ru'] as const) {
    const words = source ? source.texts[language] : lessonWords(language, tried.lessonId);
    if (words) names[language] = { lesson: words.title, step: words.steps[tried.stepId]?.title ?? tried.stepId };
  }
  return names;
}

/**
 * Checks one lesson before it is kept. `shapes` are the classes of the person's ComfyUI when the catalog is read;
 * without them the lesson is tried against its own promises (every port it names exists).
 */
export function checkLessonDoc(doc: LessonDoc, find: (docId: string) => LessonDoc | null = () => null, shapes?: ClassShapes): LessonCheck {
  const problem = lessonDocProblem(doc);
  if (problem) return { ok: false, problem };
  const lesson = engineLesson(doc, myLessonId(doc.id));
  const before = chainOf(doc, find);
  const tried = tryLesson(lesson, shapes ?? lessonShapes([...before, lesson]), { before });
  return tried.ok ? { ok: true } : { ok: false, tried: { ...tried, names: namesOf(tried, doc, find) } };
}

/** The answer to an import (or a save, or an accepted draft): what came in, what replaced an earlier lesson of the same id, or why nothing did. */
export type LessonImportOutcome =
  | { ok: true; added: string[]; replaced: string[] }
  | { ok: false; problem: LessonFileProblem }
  | { ok: false; tried: FailedTry }
  | { ok: false; full: true }
  | { ok: false; canceled: true }
  | { ok: false; error: string };

/** The answer to an export through the save dialog. */
export type LessonExportOutcome = { ok: true } | { ok: false; canceled: true } | { ok: false; error: string } | { ok: false; problem: LessonFileProblem };

/** A lesson the assistant drafted, waiting for the person to accept or reject it. */
export interface LessonDraft {
  id: string;
  /** Saved for review across restarts; false when chat storage is disabled. */
  persistent?: boolean;
  doc: LessonDoc;
  createdAt: number;
  /** How the draft was tried before it was shown: with the catalog of this ComfyUI, or only with the lesson's own promises. */
  triedWith: 'catalog' | 'lesson';
}

/** The answer to accepting or rejecting a draft. */
export type LessonDraftResolution = LessonImportOutcome | { ok: true; rejected: true } | { ok: false; gone: true };

/** Whether there is room for `adding` more lessons beside `kept`. */
export function roomFor(kept: number, adding: number): boolean {
  return kept + adding <= MY_LESSONS_MAX && adding <= LESSON_LIMITS.lessons;
}
