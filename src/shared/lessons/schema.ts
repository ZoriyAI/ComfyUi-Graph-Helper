import type { FieldSpec, Lesson, LinkSpec } from './engine';
import { FILES } from './files';

/**
 * What every lesson must hold to be safe to add, checked before any lesson runs (tests/unit/lessonSchema.test.ts).
 * An author gets one sentence per problem instead of a lesson that silently never finishes.
 */
export function lessonProblems(lesson: Lesson, all: readonly Lesson[], after: Readonly<Record<string, string[]>>, reasons: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const say = (text: string) => out.push(`${lesson.id}: ${text}`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(lesson.id)) say('the id is lower case letters, digits and dashes');
  if (all.filter((item) => item.id === lesson.id).length > 1) say('another lesson has the same id');
  if (lesson.steps.length === 0) say('a lesson has steps');
  const stepIds = new Set<string>();
  const known = new Set<string>();
  const roleClasses = new Map<string, string[]>();
  for (const step of lesson.steps) {
    if (stepIds.has(step.id)) say(`the step id "${step.id}" is used twice`);
    stepIds.add(step.id);
    const asks = (step.roles?.length ?? 0) + (step.links?.length ?? 0) + (step.fields?.length ?? 0);
    if (step.read && asks > 0) say(`"${step.id}" is a step to read and also asks for nodes, links or fields`);
    if (!step.read && asks === 0) say(`"${step.id}" asks for nothing: mark it as a step to read`);
    for (const spec of step.roles ?? []) {
      if (known.has(spec.role)) say(`"${step.id}" brings the role "${spec.role}" a second time`);
      if (spec.classes.length === 0) say(`"${step.id}": the role "${spec.role}" names no class`);
      known.add(spec.role);
      roleClasses.set(spec.role, spec.classes);
    }
    const links: Array<Omit<LinkSpec, 'alt'>> = (step.links ?? []).flatMap((spec) => [spec, ...(spec.alt ?? [])]);
    for (const spec of links) {
      for (const role of [spec.from, spec.to]) if (!known.has(role)) say(`"${step.id}": the link names the role "${role}" before any step brings it`);
    }
    for (const spec of step.fields ?? []) fieldProblems(spec, known, reasons).forEach((text) => say(`"${step.id}": ${text}`));
  }
  for (const before of after[lesson.id] ?? []) if (!all.some((item) => item.id === before)) say(`it goes on from "${before}", which is not a lesson`);
  return out;
}

function fieldProblems(spec: FieldSpec, known: ReadonlySet<string>, reasons: ReadonlySet<string>): string[] {
  const out: string[] = [];
  if (!known.has(spec.role)) out.push(`the field ${spec.field} names the role "${spec.role}" before any step brings it`);
  const test = spec.test;
  if ((test.kind === 'differs' || test.kind === 'same' || test.kind === 'less' || test.kind === 'aspect') && !known.has(test.role)) {
    out.push(`the rule on ${spec.field} compares with the role "${test.role}", which no step brings`);
  }
  if (test.kind === 'between') {
    if (test.min > test.max) out.push(`the range of ${spec.field} runs backwards`);
    if (test.prefer !== undefined && (test.prefer < test.min || test.prefer > test.max)) out.push(`the number ${test.prefer} for ${spec.field} lies outside its range`);
    if (test.frames && test.prefer !== undefined && (test.prefer - 1) % 4 !== 0) out.push(`the frame count ${test.prefer} is not 4n + 1`);
  }
  if (test.kind === 'file' && !test.want.words && !Object.values(FILES).some((want) => want === test.want)) out.push(`the file rule on ${spec.field} uses a kind files.ts does not list`);
  if (spec.why && !reasons.has(spec.why)) out.push(`the reason "${spec.why}" is not written`);
  return out;
}
