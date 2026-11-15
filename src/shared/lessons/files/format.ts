/**
 * The lesson file: one JSON format for a single lesson and for a pack of lessons. A person exports a lesson (their
 * own or a built-in one) into it, gives it to someone else, imports it again; the assistant drafts a lesson in it.
 *
 * Who uses it: the import and export in main (src/main/lessons), the lesson editor and "My lessons" in the Lessons
 * panel, the assistant's draftLesson tool, and the unit test that writes every built-in lesson out and reads it
 * back.
 *
 * Why it is this strict: a lesson file comes from anyone. It is pure DATA: ids, texts and the same declarative
 * checks the engine (../engine.ts) already understands. Nothing in it is code, nothing is evaluated, no address in
 * it is ever opened. Every string and every list has a cap, unknown keys are refused (a file from a newer version
 * says so instead of being half read), and the checks between parts (a link names roles the lesson brought in,
 * every step has its words) are made here, before anything is kept.
 */

import { z } from 'zod';
import type { FieldTest, Lesson, LessonStep } from '../engine';

/** What the file says it is; any other value is not a lesson file. */
export const LESSON_FILE_FORMAT = 'graph-helper-for-comfyui/lessons';
/** The version this app writes and reads. A higher one is refused with "made by a newer version". */
export const LESSON_FILE_VERSION = 1;

/** The caps. A built-in lesson is far below each (the longest step text is about 1100 characters). */
export const LESSON_LIMITS = {
  /** The whole file, in bytes, before it is parsed. */
  fileBytes: 2 * 1024 * 1024,
  /** How deep objects and arrays may nest; the format itself needs 7. */
  depth: 12,
  lessons: 200,
  steps: 100,
  rolesPerStep: 32,
  linksPerStep: 48,
  fieldsPerStep: 48,
  classesPerRole: 16,
  via: 32,
  follows: 16,
  needs: 200,
  marks: 8,
  triggerSources: 8,
  id: 64,
  role: 40,
  name: 200,
  title: 200,
  result: 600,
  stepTitle: 200,
  body: 8000,
  author: 120,
  source: 500,
  value: 2000,
} as const;

/** Lesson, step and group ids: lower-case words joined by hyphens. Never a path, never a dot. */
const ID = /^[a-z0-9][a-z0-9-]*$/;
/** A role is the word in `{role}` of a step text (texts.ts), so it follows the same pattern. */
const ROLE = /^[A-Za-z][A-Za-z0-9]*$/;
/** A ComfyUI class, input or output name: printable, no line breaks. */
const NAME = /^[^\u0000-\u001f\u007f]+$/;
/** Text a person reads: no control characters but line breaks and tabs, no direction overrides that hide words. */
const TEXT = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‪-‮⁦-⁩]*$/;

const id = z.string().min(1).max(LESSON_LIMITS.id).regex(ID);
const role = z.string().min(1).max(LESSON_LIMITS.role).regex(ROLE);
const name = z.string().min(1).max(LESSON_LIMITS.name).regex(NAME);
const text = (max: number) => z.string().max(max).regex(TEXT);
const number = z.number().finite();

/** A field rule, exactly the kinds engine.ts FieldTest knows. A new kind there needs its line here. */
const fieldTest = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('chosen') }).strict(),
  z.object({ kind: z.literal('weighted'), min: number, max: number }).strict(),
  z.object({ kind: z.literal('equals'), value: z.union([text(LESSON_LIMITS.value), number, z.boolean()]) }).strict(),
  z.object({ kind: z.literal('between'), min: number, max: number, prefer: number.optional() }).strict(),
  z.object({ kind: z.literal('text'), minChars: z.number().int().min(0).max(LESSON_LIMITS.body), has: z.array(z.string().min(1).max(40).regex(NAME)).max(LESSON_LIMITS.marks).optional() }).strict(),
  z.object({
    kind: z.literal('has-trigger'),
    of: z.array(z.union([
      z.object({ role, field: name }).strict(),
      z.object({ classType: name, field: name }).strict(),
    ])).min(1).max(LESSON_LIMITS.triggerSources),
  }).strict(),
  z.object({ kind: z.literal('differs'), role, field: name }).strict(),
  z.object({ kind: z.literal('same'), role, field: name }).strict(),
]);

const stepSchema = z.object({
  id,
  read: z.literal(true).optional(),
  roles: z.array(z.object({ role, classes: z.array(name).min(1).max(LESSON_LIMITS.classesPerRole) }).strict()).max(LESSON_LIMITS.rolesPerStep).optional(),
  links: z.array(z.object({ from: role, output: name, to: role, input: name, via: z.array(name).max(LESSON_LIMITS.via).optional() }).strict()).max(LESSON_LIMITS.linksPerStep).optional(),
  fields: z.array(z.object({ role, field: name, test: fieldTest }).strict()).max(LESSON_LIMITS.fieldsPerStep).optional(),
}).strict();

const wordsSchema = z.object({
  title: text(LESSON_LIMITS.title).min(1),
  result: text(LESSON_LIMITS.result),
  steps: z.record(id, z.object({ title: text(LESSON_LIMITS.stepTitle).min(1), body: text(LESSON_LIMITS.body) }).strict()),
}).strict();

const titlesSchema = z.object({ en: text(LESSON_LIMITS.title).min(1).optional(), ru: text(LESSON_LIMITS.title).min(1).optional() }).strict();

const lessonSchema = z.object({
  id,
  group: z.object({ id, title: titlesSchema }).strict().optional(),
  /** Lessons whose knowledge this one goes on from: a hint in the list, never a gate. */
  follows: z.array(id).max(LESSON_LIMITS.follows).optional(),
  /** Lessons whose graph this one starts from (the engine's LESSON_AFTER). */
  continues: z.array(id).max(LESSON_LIMITS.follows).optional(),
  adult: z.boolean().optional(),
  author: text(LESSON_LIMITS.author).optional(),
  /** Where the lesson comes from, as text. Shown, never opened. */
  source: text(LESSON_LIMITS.source).optional(),
  /** What it needs installed: node packs and classes. Said in the list; the engine checks the classes itself. */
  needs: z.object({ packs: z.array(name).max(LESSON_LIMITS.needs), classes: z.array(name).max(LESSON_LIMITS.needs) }).strict().optional(),
  texts: z.object({ en: wordsSchema.optional(), ru: wordsSchema.optional() }).strict(),
  steps: z.array(stepSchema).min(1).max(LESSON_LIMITS.steps),
}).strict();

const fileSchema = z.object({
  format: z.literal(LESSON_FILE_FORMAT),
  version: z.literal(LESSON_FILE_VERSION),
  /** A pack's own name; a file with one lesson needs none. */
  title: titlesSchema.optional(),
  lessons: z.array(lessonSchema).min(1).max(LESSON_LIMITS.lessons),
}).strict();

export type LessonDocWords = z.infer<typeof wordsSchema>;
export type LessonDoc = z.infer<typeof lessonSchema>;
export type LessonFile = z.infer<typeof fileSchema>;
export type LessonDocLanguage = 'en' | 'ru';

/**
 * Why a file was refused, as a code the window turns into a plain sentence (lessons.file.* in the catalog) and,
 * where it helps, the lesson and step it is about.
 */
export type LessonFileProblem =
  | { code: 'too-large' }
  | { code: 'too-deep' }
  | { code: 'not-json' }
  | { code: 'not-lesson' }
  | { code: 'newer-version'; version: number }
  | { code: 'invalid'; lesson?: string; step?: string; at: string }
  | { code: 'duplicate-lesson'; lesson: string }
  | { code: 'duplicate-step'; lesson: string; step: string }
  | { code: 'no-words'; lesson: string }
  | { code: 'missing-words'; lesson: string; step: string; language: LessonDocLanguage }
  | { code: 'unknown-role'; lesson: string; step: string; role: string }
  | { code: 'role-twice'; lesson: string; step: string; role: string }
  | { code: 'bad-range'; lesson: string; step: string; field: string }
  | { code: 'nothing-to-do'; lesson: string };

export type LessonFileRead = { ok: true; file: LessonFile } | { ok: false; problem: LessonFileProblem };

/**
 * How deep a JSON text nests, read without parsing it, so that a file of ten thousand brackets is refused before
 * the parser walks into it. Brackets inside strings do not count.
 */
export function jsonDepth(source: string, stopAt = Number.POSITIVE_INFINITY): number {
  let depth = 0;
  let deepest = 0;
  let inString = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (char === '\\') index += 1;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{' || char === '[') {
      depth += 1;
      if (depth > deepest) {
        deepest = depth;
        if (deepest > stopAt) return deepest;
      }
    } else if (char === '}' || char === ']') depth -= 1;
  }
  return deepest;
}

/** Reads a lesson file from its text: size, depth, JSON, then the format. */
export function readLessonFileText(source: string): LessonFileRead {
  // Characters, not bytes: a cap on characters is also a cap within four times as many bytes.
  if (source.length > LESSON_LIMITS.fileBytes) return { ok: false, problem: { code: 'too-large' } };
  if (jsonDepth(source, LESSON_LIMITS.depth) > LESSON_LIMITS.depth) return { ok: false, problem: { code: 'too-deep' } };
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return { ok: false, problem: { code: 'not-json' } };
  }
  return readLessonFile(parsed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads a lesson file already parsed from JSON (or handed over by the assistant as an object). */
export function readLessonFile(value: unknown): LessonFileRead {
  if (!isRecord(value) || value.format !== LESSON_FILE_FORMAT) return { ok: false, problem: { code: 'not-lesson' } };
  if (typeof value.version === 'number' && value.version > LESSON_FILE_VERSION) return { ok: false, problem: { code: 'newer-version', version: value.version } };
  const parsed = fileSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path ?? [];
    const lessonIndex = path[0] === 'lessons' && typeof path[1] === 'number' ? path[1] : null;
    const lessons = Array.isArray(value.lessons) ? value.lessons : [];
    const lesson = lessonIndex !== null && isRecord(lessons[lessonIndex]) && typeof lessons[lessonIndex].id === 'string' ? String(lessons[lessonIndex].id).slice(0, LESSON_LIMITS.id) : undefined;
    const stepIndex = path[2] === 'steps' && typeof path[3] === 'number' ? path[3] : null;
    const steps = lessonIndex !== null && isRecord(lessons[lessonIndex]) && Array.isArray(lessons[lessonIndex].steps) ? lessons[lessonIndex].steps as unknown[] : [];
    const step = stepIndex !== null && isRecord(steps[stepIndex]) && typeof steps[stepIndex].id === 'string' ? String(steps[stepIndex].id).slice(0, LESSON_LIMITS.id) : undefined;
    return { ok: false, problem: { code: 'invalid', ...(lesson ? { lesson } : {}), ...(step ? { step } : {}), at: path.map(String).join('.').slice(0, 200) } };
  }
  const file = parsed.data;
  const seen = new Set<string>();
  for (const lesson of file.lessons) {
    if (seen.has(lesson.id)) return { ok: false, problem: { code: 'duplicate-lesson', lesson: lesson.id } };
    seen.add(lesson.id);
    const problem = lessonDocProblem(lesson);
    if (problem) return { ok: false, problem };
  }
  return { ok: true, file };
}

/** The rules between the parts of one lesson that a schema of each part cannot say. Null when it holds together. */
export function lessonDocProblem(lesson: LessonDoc): LessonFileProblem | null {
  const languages = (['en', 'ru'] as const).filter((language) => lesson.texts[language]);
  if (languages.length === 0) return { code: 'no-words', lesson: lesson.id };
  const stepIds = new Set<string>();
  const brought = new Set<string>();
  for (const step of lesson.steps) {
    if (stepIds.has(step.id)) return { code: 'duplicate-step', lesson: lesson.id, step: step.id };
    stepIds.add(step.id);
    for (const language of languages) {
      if (!lesson.texts[language]!.steps[step.id]) return { code: 'missing-words', lesson: lesson.id, step: step.id, language };
    }
    for (const spec of step.roles ?? []) {
      if (brought.has(spec.role)) return { code: 'role-twice', lesson: lesson.id, step: step.id, role: spec.role };
      brought.add(spec.role);
    }
    const named = [
      ...(step.links ?? []).flatMap((spec) => [spec.from, spec.to]),
      ...(step.fields ?? []).flatMap((spec) => [spec.role, ...testRoles(spec.test)]),
    ];
    const unknown = named.find((item) => !brought.has(item));
    if (unknown) return { code: 'unknown-role', lesson: lesson.id, step: step.id, role: unknown };
    for (const spec of step.fields ?? []) {
      const test = spec.test;
      if ((test.kind === 'between' || test.kind === 'weighted') && test.min > test.max) return { code: 'bad-range', lesson: lesson.id, step: step.id, field: spec.field };
      if (test.kind === 'between' && test.prefer !== undefined && (test.prefer < test.min || test.prefer > test.max)) return { code: 'bad-range', lesson: lesson.id, step: step.id, field: spec.field };
    }
  }
  if (lesson.steps.every((step) => step.read)) return { code: 'nothing-to-do', lesson: lesson.id };
  return null;
}

/** The roles a field rule looks at besides its own (the same reading as the engine's). */
function testRoles(test: FieldTest): string[] {
  if (test.kind === 'has-trigger') return test.of.flatMap((item) => ('role' in item ? [item.role] : []));
  return test.kind === 'differs' || test.kind === 'same' ? [test.role] : [];
}

/** A lesson file holding these lessons. */
export function lessonFileOf(lessons: LessonDoc[], title?: { en?: string; ru?: string }): LessonFile {
  return { format: LESSON_FILE_FORMAT, version: LESSON_FILE_VERSION, ...(title && (title.en || title.ru) ? { title } : {}), lessons };
}

/**
 * The steps of a lesson document as the engine takes them, under the id the app gives the lesson. Only the keys
 * the engine reads are copied, so the engine never sees anything else a file carried.
 */
export function engineLesson(doc: LessonDoc, appId: string): Lesson {
  return {
    id: appId,
    steps: doc.steps.map((step): LessonStep => ({
      id: step.id,
      ...(step.read ? { read: true as const } : {}),
      ...(step.roles ? { roles: step.roles.map((spec) => ({ role: spec.role, classes: [...spec.classes] })) } : {}),
      ...(step.links ? { links: step.links.map((spec) => ({ from: spec.from, output: spec.output, to: spec.to, input: spec.input, ...(spec.via ? { via: [...spec.via] } : {}) })) } : {}),
      ...(step.fields ? { fields: step.fields.map((spec) => ({ role: spec.role, field: spec.field, test: copyTest(spec.test) })) } : {}),
    })),
  };
}

function copyTest(test: FieldTest): FieldTest {
  switch (test.kind) {
    case 'chosen':
      return { kind: 'chosen' };
    case 'weighted':
      return { kind: 'weighted', min: test.min, max: test.max };
    case 'equals':
      return { kind: 'equals', value: test.value };
    case 'between':
      return test.prefer === undefined ? { kind: 'between', min: test.min, max: test.max } : { kind: 'between', min: test.min, max: test.max, prefer: test.prefer };
    case 'text':
      return test.has ? { kind: 'text', minChars: test.minChars, has: [...test.has] } : { kind: 'text', minChars: test.minChars };
    case 'has-trigger':
      return { kind: 'has-trigger', of: test.of.map((item) => ('role' in item ? { role: item.role, field: item.field } : { classType: item.classType, field: item.field })) };
    case 'differs':
      return { kind: 'differs', role: test.role, field: test.field };
    case 'same':
      return { kind: 'same', role: test.role, field: test.field };
  }
}

/** The words of a lesson document in a language, falling back to the one it has. */
export function docWords(doc: LessonDoc, language: string): LessonDocWords {
  const wanted = language === 'ru' ? doc.texts.ru : doc.texts.en;
  return (wanted ?? doc.texts.en ?? doc.texts.ru)!;
}

/** A file name for a lesson file: the id (already safe) and the extension. */
export function lessonFileName(base: string): string {
  const safe = base.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, LESSON_LIMITS.id) || 'lesson';
  return `${safe}.lesson.json`;
}
