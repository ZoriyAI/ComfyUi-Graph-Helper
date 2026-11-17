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
 *
 * Versions: 1 is the format of version 1.0 (steps to read and canvas steps). 2 adds the steps a person answers
 * (checklist, rubric, quiz, read-check), transfer tasks, outcomes, the standard, level, tracks, priority and the
 * template's metadata. Both are read. A file is written as version 1 whenever its lessons use nothing of version 2,
 * so an export of an old lesson still opens in version 1.0.
 */

import { z } from 'zod';
import type { FieldSpec, FieldTest, Lesson, LessonStep, LinkSpec } from '../engine';
import { BASE_MODEL_FAMILIES } from '../../knowledge/schemas';
import { FILES, type FileWant } from '../files';
import { REASONS_EN } from '../reasons.en';
import { STEP_CAPS, lessonRuleProblems, lessonStandardProblems, lessonWordsProblems, type LessonRuleProblem } from '../schema';
import { LESSON_OUTCOMES, type ReadCondition } from '../steps';
import { LESSON_PRIORITIES, LESSON_TRACKS } from '../programme';
import { APP_ID } from '../../productNames';

/** What the file says it is (`nodewise-studio/lessons`); any other value is not a lesson file. */
export const LESSON_FILE_FORMAT = `${APP_ID}/lessons`;
/** The highest version this app reads and writes. A higher one is refused with "made by a newer version". */
export const LESSON_FILE_VERSION = 2;
/** The versions this app reads. */
export const LESSON_FILE_VERSIONS = [1, 2] as const;

/** The caps. A built-in lesson is far below each (the longest step text is about 1100 characters). */
export const LESSON_LIMITS = {
  /** The whole file, in bytes, before it is parsed. */
  fileBytes: 16 * 1024 * 1024,
  /** Preserve the old 2M-character reader's worst-case UTF-8 capacity for one legacy lesson. */
  lessonBytes: 8 * 1024 * 1024,
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
  /** A label, a level, a choice, a line of metadata. */
  line: 600,
  mistakes: 12,
  requires: 16,
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

const fieldRef = z.object({ role, field: name }).strict();
const families = z.array(z.enum(BASE_MODEL_FAMILIES)).max(32);
const marks = z.array(z.string().min(1).max(60).regex(NAME)).max(32);

/**
 * A kind of model file (files.ts FileWant): data the engine compares file names and families with. A file may name
 * a kind the app lists (files.ts FILES) or describe one by words, as a set's table does (wantFromWords); a kind
 * without words that the app does not list has no sentence to tell a person, so it is refused.
 */
const fileWant = z.object({
  kind: z.string().min(1).max(LESSON_LIMITS.id).regex(/^[A-Za-z][A-Za-z0-9]*$/),
  families: families.optional(),
  notFamilies: families.optional(),
  marks: z.array(marks).max(32).optional(),
  notMarks: marks.optional(),
  example: text(LESSON_LIMITS.name),
  folder: z.string().max(LESSON_LIMITS.name).regex(/^[A-Za-z0-9_-]*$/),
  ext: z.string().max(16).regex(/^\.[A-Za-z0-9]+$/).optional(),
  words: z.array(text(LESSON_LIMITS.name).min(1)).max(32).optional(),
}).strict();

/** A field rule, exactly the kinds engine.ts FieldTest knows. A new kind there needs its line here (the round-trip test fails until it has one). */
const fieldTest = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('chosen') }).strict(),
  z.object({ kind: z.literal('weighted'), min: number, max: number }).strict(),
  z.object({ kind: z.literal('equals'), value: z.union([text(LESSON_LIMITS.value), number, z.boolean()]) }).strict(),
  z.object({ kind: z.literal('between'), min: number, max: number, prefer: number.optional(), frames: z.literal(true).optional() }).strict(),
  z.object({
    kind: z.literal('text'),
    minChars: z.number().int().min(0).max(LESSON_LIMITS.body),
    has: z.array(z.string().min(1).max(40).regex(NAME)).max(LESSON_LIMITS.marks).optional(),
    words: z.number().int().min(0).max(1000).optional(),
    english: z.literal(true).optional(),
    notCopyOf: fieldRef.optional(),
    noNegation: z.literal(true).optional(),
  }).strict(),
  z.object({ kind: z.literal('file'), want: fileWant }).strict(),
  z.object({ kind: z.literal('sameFamily'), role, field: name }).strict(),
  z.object({ kind: z.literal('less'), role, field: name }).strict(),
  z.object({ kind: z.literal('size'), of: fieldRef }).strict(),
  z.object({ kind: z.literal('aspect'), role }).strict(),
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

const linkBase = { from: role, output: name, to: role, input: name, via: z.array(name).max(LESSON_LIMITS.via).optional() };

/** A read-check condition, exactly the kinds steps.ts ReadCondition knows. */
const readCondition: z.ZodType<ReadCondition> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('comfy-read') }).strict(),
  z.object({ kind: z.literal('node-class'), classes: z.array(name).min(1).max(LESSON_LIMITS.classesPerRole) }).strict(),
  z.object({ kind: z.literal('model-file'), folder: z.string().min(1).max(LESSON_LIMITS.id).regex(/^[A-Za-z0-9_-]+$/), words: z.array(z.string().min(1).max(60).regex(NAME)).max(LESSON_LIMITS.marks).optional() }).strict(),
  z.object({ kind: z.literal('workflow-complete') }).strict(),
  z.object({ kind: z.literal('workflow-size'), min: z.number().int().min(0).max(10_000).optional(), max: z.number().int().min(0).max(10_000).optional() }).strict(),
  z.object({ kind: z.literal('workflow-from'), from: z.enum(['picture', 'api']) }).strict(),
  z.object({ kind: z.literal('workflow-partner'), present: z.boolean() }).strict(),
]) as z.ZodType<ReadCondition>;

const stepSchema = z.object({
  id,
  read: z.literal(true).optional(),
  roles: z.array(z.object({ role, classes: z.array(name).min(1).max(LESSON_LIMITS.classesPerRole) }).strict()).max(LESSON_LIMITS.rolesPerStep).optional(),
  links: z.array(z.object({ ...linkBase, alt: z.array(z.object(linkBase).strict()).max(LESSON_LIMITS.marks).optional() }).strict()).max(LESSON_LIMITS.linksPerStep).optional(),
  fields: z.array(z.object({
    role,
    field: name,
    test: fieldTest,
    /** The id of a reason the app has written (reasons.*.ts); a lesson file cannot bring sentences of its own there. */
    why: z.string().min(1).max(LESSON_LIMITS.id).regex(/^[A-Za-z][A-Za-z0-9.-]*$/).optional(),
    identifies: z.literal(true).optional(),
    soft: z.literal(true).optional(),
  }).strict()).max(LESSON_LIMITS.fieldsPerStep).optional(),
  // Version 2: the steps a person answers, and the transfer mark.
  checklist: z.array(z.object({ id, optional: z.literal(true).optional(), check: readCondition.optional(), run: z.literal(true).optional() }).strict()).max(STEP_CAPS.items).optional(),
  rubric: z.array(z.object({ id, levels: z.array(id).max(STEP_CAPS.levelsMax), pass: id.optional() }).strict()).max(STEP_CAPS.criteria).optional(),
  quiz: z.array(z.object({ id, choices: z.array(id).max(STEP_CAPS.choicesMax), answer: id }).strict()).max(STEP_CAPS.questions).optional(),
  readCheck: z.array(readCondition).max(STEP_CAPS.conditions).optional(),
  transfer: z.literal(true).optional(),
}).strict();

const line = text(LESSON_LIMITS.line);

/** The words of one step: its title and body, and (version 2) the words of its items, criteria or questions. */
const stepWordsSchema = z.object({
  title: text(LESSON_LIMITS.stepTitle).min(1),
  body: text(LESSON_LIMITS.body),
  items: z.record(id, z.object({ label: line.min(1), how: line.optional() }).strict()).optional(),
  criteria: z.record(id, z.object({ title: line.min(1), levels: z.record(id, line.min(1)), tryNext: line.optional() }).strict()).optional(),
  questions: z.record(id, z.object({ text: line.min(1), choices: z.record(id, line.min(1)), explain: line.min(1) }).strict()).optional(),
}).strict();

/** The words of the lesson template (version 2): skill, requirements, expected mistakes, provenance, what is not checked. */
const metaWordsSchema = z.object({
  skill: line.min(1),
  requires: z.array(line.min(1)).max(LESSON_LIMITS.requires).optional(),
  mistakes: z.array(z.object({ sign: line.min(1), fix: line.min(1) }).strict()).max(LESSON_LIMITS.mistakes).optional(),
  provenance: text(LESSON_LIMITS.result).optional(),
  notChecked: text(LESSON_LIMITS.result).optional(),
}).strict();

const wordsSchema = z.object({
  title: text(LESSON_LIMITS.title).min(1),
  result: text(LESSON_LIMITS.result),
  steps: z.record(id, stepWordsSchema),
  /** What a role's node is in this lesson (texts.ts LessonWords.roles): short labels, as many as a lesson has roles. */
  roles: z.record(role, text(LESSON_LIMITS.stepTitle).min(1))
    .refine((labels) => Object.keys(labels).length <= LESSON_LIMITS.steps * LESSON_LIMITS.rolesPerStep, { message: 'too many role labels' })
    .optional(),
  meta: metaWordsSchema.optional(),
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
  // Version 2: the standard, the outcomes, the place in the programme and the template's metadata.
  standard: z.union([z.literal(1), z.literal(2)]).optional(),
  outcomes: z.array(z.enum(LESSON_OUTCOMES)).max(LESSON_OUTCOMES.length).optional(),
  level: z.number().int().min(0).max(5).optional(),
  tracks: z.array(z.enum(LESSON_TRACKS)).max(LESSON_TRACKS.length).optional(),
  priority: z.enum(LESSON_PRIORITIES).optional(),
  meta: z.object({
    prerequisites: z.array(id).max(LESSON_LIMITS.follows).optional(),
    versions: z.array(line.min(1)).max(LESSON_LIMITS.requires).optional(),
    checkedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).strict().optional(),
}).strict();

const fileSchema = z.object({
  format: z.literal(LESSON_FILE_FORMAT),
  version: z.union([z.literal(1), z.literal(2)]),
  /** A pack's own name; a file with one lesson needs none. */
  title: titlesSchema.optional(),
  lessons: z.array(lessonSchema).min(1).max(LESSON_LIMITS.lessons),
}).strict();

/** The words of one lesson in one language, as the file holds them. */
export type LessonDocWords = z.infer<typeof wordsSchema>;
/** One lesson of a file: its rules and its words. */
export type LessonDoc = z.infer<typeof lessonSchema>;
/** A whole lesson file: one lesson or a pack of them. */
export type LessonFile = z.infer<typeof fileSchema>;
/** The languages a lesson file may carry words in. */
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
  | { code: 'nothing-to-do'; lesson: string }
  | { code: 'unknown-file-kind'; lesson: string; step: string; field: string }
  /** A rule of schema.ts lessonRuleProblems: its code and the names it is about; the window says it in words. */
  | { code: 'rules'; lesson: string; rule: LessonRuleProblem };

/** A file read back: the lessons, or the reason it was refused. */
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
  if (source.length > LESSON_LIMITS.fileBytes || new TextEncoder().encode(source).byteLength > LESSON_LIMITS.fileBytes) return { ok: false, problem: { code: 'too-large' } };
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
  try {
    const text = JSON.stringify(value);
    if (text.length > LESSON_LIMITS.fileBytes || new TextEncoder().encode(text).byteLength > LESSON_LIMITS.fileBytes) return { ok: false, problem: { code: 'too-large' } };
    if (Array.isArray(value.lessons)) for (const lesson of value.lessons) {
      if (new TextEncoder().encode(JSON.stringify(lesson)).byteLength > LESSON_LIMITS.lessonBytes) return { ok: false, problem: { code: 'too-large' } };
    }
  } catch { return { ok: false, problem: { code: 'not-json' } }; }
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

/** The reasons the app has written, by id: a lesson file may point at one of them, never bring its own. */
const REASON_IDS: ReadonlySet<string> = new Set(Object.keys(REASONS_EN));

/** Key order does not matter when a file's kind of model file is compared with the app's own. */
function sameData(a: unknown, b: unknown): boolean {
  const sorted = (value: unknown): unknown => (Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value as object).sort().map((key) => [key, sorted((value as Record<string, unknown>)[key])])) : value);
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}

/**
 * The app's own kind of file for a file's want: a want without words must be one files.ts lists, as it is, and is
 * then that very object (the engine and its schema check know the app's kinds by identity); a want of the kind
 * "named" (a set's table of words) is data of its own. Null for a want the app cannot tell a person about.
 */
export function canonicalWant(want: FileWant): FileWant | null {
  // The kind a set's table of words makes (files.ts wantFromWords): the words are what the person reads.
  if (want.kind === 'named') return { ...want, words: want.words ?? [] };
  const known = (FILES as Record<string, FileWant>)[want.kind];
  return known && sameData(known, want) ? known : null;
}

/**
 * The rules between the parts of one lesson that a schema of each part cannot say, with the codes the window
 * turns into sentences; then the engine owner's own schema check (schema.ts lessonProblems), so a file is held to
 * exactly the rules a built-in lesson is held to. Null when it holds together.
 */
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
      ...(step.links ?? []).flatMap((spec) => [spec.from, spec.to, ...(spec.alt ?? []).flatMap((alt) => [alt.from, alt.to])]),
      ...(step.fields ?? []).flatMap((spec) => [spec.role, ...testRoles(spec.test)]),
    ];
    const unknown = named.find((item) => !brought.has(item));
    if (unknown) return { code: 'unknown-role', lesson: lesson.id, step: step.id, role: unknown };
    for (const spec of step.fields ?? []) {
      const test = spec.test;
      if ((test.kind === 'between' || test.kind === 'weighted') && test.min > test.max) return { code: 'bad-range', lesson: lesson.id, step: step.id, field: spec.field };
      if (test.kind === 'between' && test.prefer !== undefined && (test.prefer < test.min || test.prefer > test.max)) return { code: 'bad-range', lesson: lesson.id, step: step.id, field: spec.field };
      if (test.kind === 'file' && !canonicalWant(test.want)) return { code: 'unknown-file-kind', lesson: lesson.id, step: step.id, field: spec.field };
    }
  }
  if (lesson.steps.every((step) => step.read)) return { code: 'nothing-to-do', lesson: lesson.id };
  const engine = engineLesson(lesson, lesson.id);
  // Prerequisites may name lessons outside this file: a hint, so only their spelling is checked (by the schema).
  const rules = lessonRuleProblems({ ...engine, meta: { ...engine.meta, prerequisites: [] } }, [engine], {}, REASON_IDS);
  if (rules.length > 0) return { code: 'rules', lesson: lesson.id, rule: rules[0] };
  const words = { ...(lesson.texts.en ? { en: lesson.texts.en } : {}), ...(lesson.texts.ru ? { ru: lesson.texts.ru } : {}) };
  const said = [...lessonWordsProblems(engine, words), ...lessonStandardProblems(engine, words)];
  if (said.length > 0) return { code: 'rules', lesson: lesson.id, rule: said[0] };
  return null;
}

/** Whether a lesson uses anything of version 2 of the format. */
function usesVersion2(lesson: LessonDoc): boolean {
  const words = [lesson.texts.en, lesson.texts.ru].filter((item): item is LessonDocWords => item !== undefined);
  return lesson.standard !== undefined || lesson.outcomes !== undefined || lesson.level !== undefined || lesson.tracks !== undefined
    || lesson.priority !== undefined || lesson.meta !== undefined
    || lesson.steps.some((step) => step.checklist || step.rubric || step.quiz || step.readCheck || step.transfer)
    || words.some((item) => item.meta !== undefined || Object.values(item.steps).some((step) => step.items || step.criteria || step.questions));
}

/** The version a file of these lessons is written as: 1 unless a lesson needs version 2. */
export function lessonFileVersion(lessons: readonly LessonDoc[]): 1 | 2 {
  return lessons.some(usesVersion2) ? 2 : 1;
}

/** The roles a field rule looks at besides its own (the same reading as the engine's otherRoles). */
function testRoles(test: FieldTest): string[] {
  if (test.kind === 'has-trigger') return test.of.flatMap((item) => ('role' in item ? [item.role] : []));
  if (test.kind === 'text') return test.notCopyOf ? [test.notCopyOf.role] : [];
  if (test.kind === 'size') return [test.of.role];
  return test.kind === 'differs' || test.kind === 'same' || test.kind === 'less' || test.kind === 'aspect' || test.kind === 'sameFamily' ? [test.role] : [];
}

/** A lesson file holding these lessons. */
export function lessonFileOf(lessons: LessonDoc[], title?: { en?: string; ru?: string }): LessonFile {
  return { format: LESSON_FILE_FORMAT, version: lessonFileVersion(lessons), ...(title && (title.en || title.ru) ? { title } : {}), lessons };
}

function copyLink(spec: Omit<LinkSpec, 'alt'>): Omit<LinkSpec, 'alt'> {
  return { from: spec.from, output: spec.output, to: spec.to, input: spec.input, ...(spec.via ? { via: [...spec.via] } : {}) };
}

/**
 * The steps of a lesson document as the engine takes them, under the id the app gives the lesson. Only the keys
 * the engine reads are copied, so the engine never sees anything else a file carried.
 */
export function engineLesson(doc: LessonDoc, appId: string): Lesson {
  return {
    id: appId,
    ...(doc.standard ? { standard: doc.standard } : {}),
    ...(doc.outcomes ? { outcomes: [...doc.outcomes] } : {}),
    ...(doc.meta ? { meta: JSON.parse(JSON.stringify(doc.meta)) as Lesson['meta'] } : {}),
    steps: doc.steps.map((step): LessonStep => ({
      id: step.id,
      ...(step.read ? { read: true as const } : {}),
      ...(step.roles ? { roles: step.roles.map((spec) => ({ role: spec.role, classes: [...spec.classes] })) } : {}),
      ...(step.links ? { links: step.links.map((spec): LinkSpec => ({ ...copyLink(spec), ...(spec.alt ? { alt: spec.alt.map(copyLink) } : {}) })) } : {}),
      ...(step.fields ? {
        fields: step.fields.map((spec): FieldSpec => ({
          role: spec.role,
          field: spec.field,
          test: copyTest(spec.test),
          ...(spec.why ? { why: spec.why } : {}),
          ...(spec.identifies ? { identifies: true as const } : {}),
          ...(spec.soft ? { soft: true as const } : {}),
        })),
      } : {}),
      // The steps a person answers are plain data: a deep copy shares nothing with the file.
      ...(step.checklist ? { checklist: JSON.parse(JSON.stringify(step.checklist)) as LessonStep['checklist'] } : {}),
      ...(step.rubric ? { rubric: JSON.parse(JSON.stringify(step.rubric)) as LessonStep['rubric'] } : {}),
      ...(step.quiz ? { quiz: JSON.parse(JSON.stringify(step.quiz)) as LessonStep['quiz'] } : {}),
      ...(step.readCheck ? { readCheck: JSON.parse(JSON.stringify(step.readCheck)) as LessonStep['readCheck'] } : {}),
      ...(step.transfer ? { transfer: true as const } : {}),
    })),
  };
}

/** A copy of a field rule that shares nothing with the file; a kind of model file becomes the app's own object. */
function copyTest(test: FieldTest): FieldTest {
  if (test.kind === 'file') {
    const known = canonicalWant(test.want);
    return { kind: 'file', want: known === test.want || !known ? JSON.parse(JSON.stringify(test.want)) as FileWant : known };
  }
  return JSON.parse(JSON.stringify(test)) as FieldTest;
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
