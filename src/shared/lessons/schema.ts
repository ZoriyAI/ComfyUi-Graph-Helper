import { otherRoles, type FieldSpec, type Lesson, type LinkSpec } from './engine';
import { FILES } from './files';

/**
 * What every lesson must hold to be safe to add, checked before any lesson runs (tests/unit/lessonSchema.test.ts)
 * and before a lesson file is kept (share/format.ts lessonDocProblem).
 *
 * Each problem is a code with the names it is about, never a sentence: the window says it in the person's language
 * (catalog lessonFiles.problem.rule.*), and lessonProblems gives an author or the assistant one English sentence
 * per problem instead of a lesson that silently never finishes.
 */

/** The kinds of problem a lesson can have; the catalog has one sentence for each, in both languages. */
export const LESSON_RULE_CODES = [
  'bad-id', 'same-id', 'no-steps', 'step-twice', 'read-asks', 'asks-nothing', 'role-twice', 'role-no-class', 'link-role',
  'field-role', 'compare-role', 'range-backwards', 'prefer-outside', 'frames', 'file-kind', 'reason', 'after',
] as const;
export type LessonRuleCode = (typeof LESSON_RULE_CODES)[number];

/** One problem: its code and the names (or the number) it is about. `name` is a reason id or a lesson id. */
export interface LessonRuleProblem {
  code: LessonRuleCode;
  step?: string;
  role?: string;
  field?: string;
  value?: number;
  name?: string;
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
    if (step.read && asks > 0) out.push({ code: 'read-asks', step: step.id });
    if (!step.read && asks === 0) out.push({ code: 'asks-nothing', step: step.id });
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
  return out;
}

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
    }
  })();
  return `${lessonId}: ${text}`;
}

/** Every problem of a lesson as an English sentence (lessonRuleText). */
export function lessonProblems(lesson: Lesson, all: readonly Lesson[], after: Readonly<Record<string, string[]>>, reasons: ReadonlySet<string>): string[] {
  return lessonRuleProblems(lesson, all, after, reasons).map((problem) => lessonRuleText(lesson.id, problem));
}
