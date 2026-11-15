/**
 * What every lesson must hold to be safe to add, checked before any lesson runs (tests/unit/lessonSchema.test.ts)
 * and before a lesson file is kept (share/format.ts lessonDocProblem). The assistant's lesson draft tool
 * (main/agent/lessonDraftTool.ts) turns a problem into a sentence with lessonRuleText.
 *
 * Each problem is a code with the names it is about, never a sentence: the window says it in the person's language
 * (catalog lessonFiles.problem.rule.*), and lessonProblems gives an author or the assistant one English sentence
 * per problem instead of a lesson that silently never finishes.
 */
import { otherRoles, outcomesOf, type FieldSpec, type Lesson, type LinkSpec } from './engine';
import { FILES } from './files';
import { stepKind } from './steps';
import type { LessonWords } from './texts';

/** The most items a checklist, criteria a rubric, questions a quiz and conditions a read-check may have. */
export const STEP_CAPS = { items: 12, criteria: 8, questions: 5, conditions: 6, levelsMin: 2, levelsMax: 4, choicesMin: 2, choicesMax: 6 } as const;
/** How many expected mistakes a lesson of the new standard names at least. */
export const STANDARD_MISTAKES = 3;


/** The kinds of problem a lesson can have; the catalog has one sentence for each, in both languages. */
export const LESSON_RULE_CODES = [
  'bad-id', 'same-id', 'no-steps', 'step-twice', 'read-asks', 'asks-nothing', 'role-twice', 'role-no-class', 'link-role',
  'field-role', 'compare-role', 'range-backwards', 'prefer-outside', 'frames', 'file-kind', 'reason', 'after',
  // The steps a person answers (steps.ts) and the outcomes a lesson declares.
  'step-kinds', 'list-size', 'item-twice', 'levels', 'pass-level', 'choices', 'transfer-kind',
  'outcome-structure', 'outcome-run', 'outcome-result', 'prerequisite', 'checked-on',
  // The words of those steps, in each language the lesson has.
  'words-item', 'words-criterion', 'words-question',
  // The template of the new standard (standard 2).
  'standard-skill', 'standard-requires', 'standard-mistakes', 'standard-versions', 'standard-provenance',
  'standard-not-checked', 'standard-quiz', 'standard-transfer',
] as const;
/** One code of LESSON_RULE_CODES. */
export type LessonRuleCode = (typeof LESSON_RULE_CODES)[number];

/**
 * One problem: its code and the names (or the number) it is about. `name` is a reason id, a lesson id, or the id of
 * an item, criterion or question; `language` the language whose words are missing.
 */
export interface LessonRuleProblem {
  code: LessonRuleCode;
  step?: string;
  role?: string;
  field?: string;
  value?: number;
  name?: string;
  language?: 'en' | 'ru';
}

/** Every problem of a lesson, in the order an author meets them. */
export function lessonRuleProblems(lesson: Lesson, all: readonly Lesson[], after: Readonly<Record<string, string[]>>, reasons: ReadonlySet<string>): LessonRuleProblem[] {
  const out: LessonRuleProblem[] = [];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(lesson.id)) out.push({ code: 'bad-id' });
  if (all.filter((item) => item.id === lesson.id).length > 1) out.push({ code: 'same-id' });
  if (lesson.steps.length === 0) out.push({ code: 'no-steps' });
  const stepIds = new Set<string>();
  const known = new Set<string>();
  for (const step of lesson.steps) {
    if (stepIds.has(step.id)) out.push({ code: 'step-twice', step: step.id });
    stepIds.add(step.id);
    const asks = (step.roles?.length ?? 0) + (step.links?.length ?? 0) + (step.fields?.length ?? 0);
    const answered = [step.checklist, step.rubric, step.quiz, step.readCheck].filter((list) => list !== undefined).length;
    if (step.read && asks > 0) out.push({ code: 'read-asks', step: step.id });
    if (!step.read && asks === 0 && answered === 0) out.push({ code: 'asks-nothing', step: step.id });
    // A step to read that asks for the canvas is said above; any mix with a step the person answers is said here.
    if (answered > 1 || (answered === 1 && (step.read || asks > 0))) out.push({ code: 'step-kinds', step: step.id });
    out.push(...personStepProblems(step));
    for (const spec of step.roles ?? []) {
      if (known.has(spec.role)) out.push({ code: 'role-twice', step: step.id, role: spec.role });
      if (spec.classes.length === 0) out.push({ code: 'role-no-class', step: step.id, role: spec.role });
      known.add(spec.role);
    }
    const links: Array<Omit<LinkSpec, 'alt'>> = (step.links ?? []).flatMap((spec) => [spec, ...(spec.alt ?? [])]);
    for (const spec of links) {
      for (const role of [spec.from, spec.to]) if (!known.has(role)) out.push({ code: 'link-role', step: step.id, role });
    }
    for (const spec of step.fields ?? []) out.push(...fieldProblems(spec, known, reasons).map((problem) => ({ ...problem, step: step.id })));
  }
  for (const before of after[lesson.id] ?? []) if (!all.some((item) => item.id === before)) out.push({ code: 'after', name: before });
  for (const before of lesson.meta?.prerequisites ?? []) if (!all.some((item) => item.id === before)) out.push({ code: 'prerequisite', name: before });
  if (lesson.meta?.checkedOn !== undefined && !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(lesson.meta.checkedOn)) out.push({ code: 'checked-on' });
  const outcomes = outcomesOf(lesson);
  // An outcome is declared only when a step can bring it: the canvas, a run tick, a rubric.
  if (lesson.outcomes?.includes('structure') && !lesson.steps.some((step) => stepKind(step) === 'canvas')) out.push({ code: 'outcome-structure' });
  if (outcomes.includes('run') && !lesson.steps.some((step) => step.checklist?.some((item) => item.run))) out.push({ code: 'outcome-run' });
  if (outcomes.includes('result') && !lesson.steps.some((step) => step.rubric)) out.push({ code: 'outcome-result' });
  return out;
}

/** The problems of a checklist, a rubric, a quiz or a read-check, and of a transfer mark. */
function personStepProblems(step: Lesson['steps'][number]): LessonRuleProblem[] {
  const out: LessonRuleProblem[] = [];
  const size = (list: readonly unknown[] | undefined, most: number) => {
    if (list !== undefined && (list.length === 0 || list.length > most)) out.push({ code: 'list-size', step: step.id, value: most });
  };
  size(step.checklist, STEP_CAPS.items);
  size(step.rubric, STEP_CAPS.criteria);
  size(step.quiz, STEP_CAPS.questions);
  size(step.readCheck, STEP_CAPS.conditions);
  const ids = [...(step.checklist ?? []), ...(step.rubric ?? []), ...(step.quiz ?? [])].map((item) => item.id);
  for (const id of new Set(ids.filter((item, index) => ids.indexOf(item) !== index))) out.push({ code: 'item-twice', step: step.id, name: id });
  for (const criterion of step.rubric ?? []) {
    const levels = new Set(criterion.levels);
    if (levels.size !== criterion.levels.length || levels.size < STEP_CAPS.levelsMin || levels.size > STEP_CAPS.levelsMax) out.push({ code: 'levels', step: step.id, name: criterion.id });
    if (criterion.pass !== undefined && !levels.has(criterion.pass)) out.push({ code: 'pass-level', step: step.id, name: criterion.id });
  }
  for (const question of step.quiz ?? []) {
    const choices = new Set(question.choices);
    if (choices.size !== question.choices.length || choices.size < STEP_CAPS.choicesMin || choices.size > STEP_CAPS.choicesMax || !choices.has(question.answer)) out.push({ code: 'choices', step: step.id, name: question.id });
  }
  const kind = stepKind(step);
  if (step.transfer && kind !== 'canvas' && kind !== 'checklist') out.push({ code: 'transfer-kind', step: step.id });
  return out;
}

/** The words a lesson has, by language; a language it does not have is left out. */
export type WordsByLanguage = Partial<Record<'en' | 'ru', LessonWords>>;

/**
 * The words the steps a person answers need in each language the lesson has: a label for every checklist item, a
 * title and a word for every level of every criterion, a question, every choice and an explanation for every
 * question. A step without its words would show ids.
 */
export function lessonWordsProblems(lesson: Lesson, words: WordsByLanguage): LessonRuleProblem[] {
  const out: LessonRuleProblem[] = [];
  for (const language of ['en', 'ru'] as const) {
    const table = words[language];
    if (!table) continue;
    for (const step of lesson.steps) {
      const said = table.steps[step.id];
      for (const item of step.checklist ?? []) {
        if (!said?.items?.[item.id]?.label?.trim()) out.push({ code: 'words-item', step: step.id, name: item.id, language });
      }
      for (const criterion of step.rubric ?? []) {
        const text = said?.criteria?.[criterion.id];
        if (!text?.title?.trim() || criterion.levels.some((level) => !text.levels?.[level]?.trim())) out.push({ code: 'words-criterion', step: step.id, name: criterion.id, language });
      }
      for (const question of step.quiz ?? []) {
        const text = said?.questions?.[question.id];
        if (!text?.text?.trim() || !text.explain?.trim() || question.choices.some((choice) => !text.choices?.[choice]?.trim())) out.push({ code: 'words-question', step: step.id, name: question.id, language });
      }
    }
  }
  return out;
}

/**
 * What a lesson of the new standard (`standard: 2`) must have beyond the rules every lesson follows: the target
 * skill, what a person needs before, the versions it was written against and the date it was checked, at least three
 * expected mistakes (each with how to recognise it and what to do), where it comes from, what the app does not check,
 * a quiz and a transfer task. A lesson of standard 1 is not held to it. scripts/lesson-lint.js prints these in plain
 * words.
 */
export function lessonStandardProblems(lesson: Lesson, words: WordsByLanguage): LessonRuleProblem[] {
  if (lesson.standard !== 2) return [];
  const out: LessonRuleProblem[] = [];
  if (!lesson.meta?.versions?.length || !lesson.meta.checkedOn) out.push({ code: 'standard-versions' });
  if (!lesson.steps.some((step) => step.quiz)) out.push({ code: 'standard-quiz' });
  if (!lesson.steps.some((step) => step.transfer)) out.push({ code: 'standard-transfer' });
  for (const language of ['en', 'ru'] as const) {
    if (!words[language]) continue;
    const meta = words[language]!.meta;
    if (!meta?.skill?.trim()) out.push({ code: 'standard-skill', language });
    if (!(meta?.requires?.some((item) => item.trim()) || lesson.meta?.prerequisites?.length)) out.push({ code: 'standard-requires', language });
    if ((meta?.mistakes ?? []).filter((item) => item.sign.trim() && item.fix.trim()).length < STANDARD_MISTAKES) out.push({ code: 'standard-mistakes', language, value: STANDARD_MISTAKES });
    if (!meta?.provenance?.trim()) out.push({ code: 'standard-provenance', language });
    if (!meta?.notChecked?.trim()) out.push({ code: 'standard-not-checked', language });
  }
  return out;
}

/** The problems of one field rule; `known` holds the roles brought by this step or an earlier one. */
function fieldProblems(spec: FieldSpec, known: ReadonlySet<string>, reasons: ReadonlySet<string>): LessonRuleProblem[] {
  const out: LessonRuleProblem[] = [];
  const field = spec.field;
  if (!known.has(spec.role)) out.push({ code: 'field-role', role: spec.role, field });
  const test = spec.test;
  // Every role a rule looks at besides its own (sameFamily, the trigger sources, the text it must not copy, the
  // size it follows too): the engine never applies a rule whose roles are not all on the canvas, so a rule naming a
  // role nobody brings would silently do nothing.
  for (const role of new Set(otherRoles(test))) {
    if (!known.has(role)) out.push({ code: 'compare-role', role, field });
  }
  if (test.kind === 'between') {
    if (test.min > test.max) out.push({ code: 'range-backwards', field });
    if (test.prefer !== undefined && (test.prefer < test.min || test.prefer > test.max)) out.push({ code: 'prefer-outside', field, value: test.prefer });
    // Video models take frame counts of the form 4n + 1 (their latent packs four frames after the first one).
    if (test.frames && test.prefer !== undefined && (test.prefer - 1) % 4 !== 0) out.push({ code: 'frames', field, value: test.prefer });
  }
  if (test.kind === 'file' && !test.want.words && !Object.values(FILES).some((want) => want === test.want)) out.push({ code: 'file-kind', field });
  if (spec.why && !reasons.has(spec.why)) out.push({ code: 'reason', field, name: spec.why });
  return out;
}

/**
 * One problem as an English sentence for an author or the assistant (never for the window, which uses the
 * catalog), starting with the lesson id.
 */
export function lessonRuleText(lessonId: string, problem: LessonRuleProblem): string {
  const { step, role, field, value, name } = problem;
  const language = problem.language === 'ru' ? 'Russian' : problem.language === 'en' ? 'English' : 'any language';
  const text = ((): string => {
    switch (problem.code) {
      case 'bad-id': return 'the id is lower case letters, digits and dashes';
      case 'same-id': return 'another lesson has the same id';
      case 'no-steps': return 'a lesson has steps';
      case 'step-twice': return `the step id "${step}" is used twice`;
      case 'read-asks': return `"${step}" is a step to read and also asks for nodes, links or fields`;
      case 'asks-nothing': return `"${step}" asks for nothing: mark it as a step to read`;
      case 'role-twice': return `"${step}" brings the role "${role}" a second time`;
      case 'role-no-class': return `"${step}": the role "${role}" names no class`;
      case 'link-role': return `"${step}": the link names the role "${role}" before any step brings it`;
      case 'field-role': return `"${step}": the field ${field} names the role "${role}" before any step brings it`;
      case 'compare-role': return `"${step}": the rule on ${field} compares with the role "${role}", which no step brings`;
      case 'range-backwards': return `"${step}": the range of ${field} runs backwards`;
      case 'prefer-outside': return `"${step}": the number ${value} for ${field} lies outside its range`;
      case 'frames': return `"${step}": the frame count ${value} is not 4n + 1`;
      case 'file-kind': return `"${step}": the file rule on ${field} uses a kind files.ts does not list`;
      case 'reason': return `"${step}": the reason "${name}" is not written`;
      case 'after': return `it goes on from "${name}", which is not a lesson`;
      case 'step-kinds': return `"${step}" is more than one kind of step: a step reads, asks for the canvas, or is a checklist, a rubric, a quiz or a read-check`;
      case 'list-size': return `"${step}": a checklist, rubric, quiz or read-check has at least one entry and at most ${value}`;
      case 'item-twice': return `"${step}": the id "${name}" is used twice`;
      case 'levels': return `"${step}": the criterion "${name}" needs two to four different levels`;
      case 'pass-level': return `"${step}": the passing level of "${name}" is not one of its levels`;
      case 'choices': return `"${step}": the question "${name}" needs two to six different choices, and its answer must be one of them`;
      case 'transfer-kind': return `"${step}": a transfer task is a canvas step or a checklist`;
      case 'outcome-structure': return 'it declares "structure checked" but has no canvas step';
      case 'outcome-run': return 'it declares "run in ComfyUI" but no checklist item is marked as run evidence';
      case 'outcome-result': return 'it declares "result assessed" but has no rubric';
      case 'prerequisite': return `it names "${name}" as a prerequisite, which is not a lesson`;
      case 'checked-on': return 'the date it was checked on is not written as YYYY-MM-DD';
      case 'words-item': return `"${step}": the item "${name}" has no label in ${language}`;
      case 'words-criterion': return `"${step}": the criterion "${name}" lacks its title or the words of a level in ${language}`;
      case 'words-question': return `"${step}": the question "${name}" lacks its text, a choice or its explanation in ${language}`;
      case 'standard-skill': return `the target skill is not written in ${language}`;
      case 'standard-requires': return `what a person needs before (prerequisites or plain requirements) is not written in ${language}`;
      case 'standard-mistakes': return `fewer than ${value} expected mistakes, each with how to recognize it and what to do, in ${language}`;
      case 'standard-versions': return 'the versions it was written against and the date it was checked on are missing';
      case 'standard-provenance': return `where the lesson comes from and its license notes are not written in ${language}`;
      case 'standard-not-checked': return `what the app does not check is not written in ${language}`;
      case 'standard-quiz': return 'it has no quiz to check yourself; a lesson of standard 2 has one';
      case 'standard-transfer': return 'it has no transfer task (a task done without "Do this for me"); a lesson of standard 2 has one';
    }
  })();
  return `${lessonId}: ${text}`;
}

/** Every problem of a lesson as an English sentence (lessonRuleText). */
export function lessonProblems(lesson: Lesson, all: readonly Lesson[], after: Readonly<Record<string, string[]>>, reasons: ReadonlySet<string>): string[] {
  return lessonRuleProblems(lesson, all, after, reasons).map((problem) => lessonRuleText(lesson.id, problem));
}
