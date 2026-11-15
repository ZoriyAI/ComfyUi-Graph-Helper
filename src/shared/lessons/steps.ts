/**
 * The steps of a lesson that are not about the canvas: a checklist of things the person does outside the app, a
 * rubric to assess a result, a short quiz, and a read-check the app answers from what it already reads of ComfyUI and
 * of the open workflow. The canvas steps (roles, links, fields) and the steps to read stay in engine.ts; the engine
 * asks this module whether one of these steps is done.
 *
 * Who uses it: engine.ts lessonProgress (where the person is), lessonOutcomes (what was checked by the app and what is
 * the person's own word), the lesson panel (renderer/components/lessons/PersonStep.tsx draws these steps), the
 * lesson file format (share/format.ts), the schema rules (schema.ts) and the empty-canvas try (share/tryLesson.ts).
 *
 * Why it is this way: the app never runs anything in ComfyUI and never judges a picture. So whatever happens in
 * ComfyUI is either something the app can read anyway (a node class is installed, a model file is listed, the open
 * workflow came from a picture) or the person's own word, and every answer keeps saying which of the two it is.
 * Answers are plain ids kept with the lesson's progress (preferences `lessons.answers`), never a picture or a text.
 * Pure: no DOM, no catalog, no IPC; the panel hands the facts over (ReadFacts).
 */

import type { LessonGraph } from './engine';

/**
 * A condition the app checks from what it already reads, without any new request to ComfyUI and without running
 * anything. Each kind says what it looks at.
 */
export type ReadCondition =
  /** The app has read the node list of a ComfyUI (Sync). */
  | { kind: 'comfy-read' }
  /** One of these node classes is installed in the ComfyUI the app read. */
  | { kind: 'node-class'; classes: string[] }
  /** The last sync listed at least one model file in this folder of `models` (whose name holds every word, if any). */
  | { kind: 'model-file'; folder: string; words?: string[] }
  /** Every node class of the workflow on the main canvas is installed in the ComfyUI the app read. */
  | { kind: 'workflow-complete' }
  /** The workflow on the main canvas has at least `min` and at most `max` nodes (a small example to report a problem). */
  | { kind: 'workflow-size'; min?: number; max?: number }
  /** The workflow the app opened last came from a picture (its embedded workflow) or from an API-format file. */
  | { kind: 'workflow-from'; from: 'picture' | 'api' }
  /** The workflow on the main canvas has (or has no) partner nodes, the paid nodes that run on an outside service. */
  | { kind: 'workflow-partner'; present: boolean };

/** Every kind of ReadCondition, in a fixed order: the format, the catalog sentences and the tests go by it. */
export const READ_CONDITION_KINDS = ['comfy-read', 'node-class', 'model-file', 'workflow-complete', 'workflow-size', 'workflow-from', 'workflow-partner'] as const;

/**
 * What the app knows that a read-check looks at. Everything is optional: what is absent is not known, and a
 * condition that needs it is "unknown", never "fails".
 */
export interface ReadFacts {
  /** A node list of ComfyUI has been read. Without it nothing about ComfyUI is known. */
  catalogRead: boolean;
  /** Whether a class is installed; null when the app has not looked the class up yet. */
  installed?: (classType: string) => boolean | null;
  /** Model file names by folder ('checkpoints'), as the last sync listed them; a folder not given is not known. */
  models?: Readonly<Record<string, readonly string[]>>;
  /** Where the workflow the app opened last came from; absent when nothing was opened in this session. */
  openedFrom?: 'json' | 'picture' | 'video' | 'api' | 'example';
  /** Whether a class is a partner (paid, outside service) node; null when not known. */
  partner?: (classType: string) => boolean | null;
}

/** What a read-check says: it holds, it does not, or the app cannot tell now (not connected, not looked up yet). */
export type ReadVerdict = 'holds' | 'fails' | 'unknown';

/** Whether a condition holds, from the facts and the main canvas. */
export function readVerdict(condition: ReadCondition, graph: LessonGraph, facts: ReadFacts | undefined): ReadVerdict {
  const read = facts?.catalogRead === true;
  switch (condition.kind) {
    case 'comfy-read':
      return read ? 'holds' : 'unknown';
    case 'node-class': {
      if (!read || !facts?.installed) return 'unknown';
      const verdicts = condition.classes.map((classType) => facts.installed!(classType));
      if (verdicts.some((item) => item === true)) return 'holds';
      return verdicts.some((item) => item === null) ? 'unknown' : 'fails';
    }
    case 'model-file': {
      const files = read ? facts?.models?.[condition.folder] : undefined;
      if (!files) return 'unknown';
      const words = (condition.words ?? []).map((word) => word.toLowerCase());
      return files.some((name) => words.every((word) => name.toLowerCase().includes(word))) ? 'holds' : 'fails';
    }
    case 'workflow-complete': {
      if (graph.nodes.length === 0) return 'fails';
      if (!read || !facts?.installed) return 'unknown';
      const verdicts = [...new Set(graph.nodes.map((node) => node.classType))].map((classType) => facts.installed!(classType));
      if (verdicts.some((item) => item === false)) return 'fails';
      return verdicts.some((item) => item === null) ? 'unknown' : 'holds';
    }
    case 'workflow-size': {
      const count = graph.nodes.length;
      return (condition.min === undefined || count >= condition.min) && (condition.max === undefined || count <= condition.max) ? 'holds' : 'fails';
    }
    case 'workflow-from':
      if (!facts?.openedFrom) return 'unknown';
      return facts.openedFrom === condition.from ? 'holds' : 'fails';
    case 'workflow-partner': {
      if (!read || !facts?.partner) return 'unknown';
      const verdicts = [...new Set(graph.nodes.map((node) => node.classType))].map((classType) => facts.partner!(classType));
      const any = verdicts.some((item) => item === true);
      if (any) return condition.present ? 'holds' : 'fails';
      if (verdicts.some((item) => item === null)) return 'unknown';
      return condition.present ? 'fails' : 'holds';
    }
  }
}

/** The classes a condition looks up, so the panel can ask the catalog about them before it judges. */
export function conditionClasses(condition: ReadCondition): string[] {
  return condition.kind === 'node-class' ? condition.classes : [];
}

/** One thing to do outside the app, ticked by the person, or checked by the app when it can (`check`). */
export interface ChecklistItem {
  id: string;
  /** Not needed for the step to be done. */
  optional?: true;
  /**
   * The app checks this itself. While the check holds the item is done; while the app cannot tell (not connected),
   * the person's tick counts and is shown as their own word; while it fails, a tick does not count.
   */
  check?: ReadCondition;
  /** This item is the evidence that the workflow was run in ComfyUI (the outcome "run in ComfyUI"). */
  run?: true;
}

/** One criterion of a rubric: two to four levels, from low to high, and the lowest level that passes, if any. */
export interface RubricCriterion {
  id: string;
  levels: string[];
  /** The lowest level that passes. Without it any answer passes: the rubric only records the assessment. */
  pass?: string;
}

/** One question of a quiz: its choices and the one that is right. A wrong answer is not punished. */
export interface QuizQuestion {
  id: string;
  choices: string[];
  answer: string;
}

/** The answers of one step: item, criterion or question id → the value chosen ('yes' for a tick). */
export type StepAnswers = Readonly<Record<string, string>>;
/** The answers of a lesson by step id. */
export type LessonAnswers = Readonly<Record<string, StepAnswers>>;

/** The value of a ticked checklist item. */
export const TICK = 'yes';
/** The key and value a read-check step keeps when the person says they checked it themselves. */
export const SELF_CHECK = 'self';

/** The kinds a step can be. */
export type StepKind = 'read' | 'canvas' | 'checklist' | 'rubric' | 'quiz' | 'read-check';

/** The part of a step this module reads; engine.ts LessonStep has all of it. */
export interface PersonStepShape {
  read?: true;
  checklist?: ChecklistItem[];
  rubric?: RubricCriterion[];
  quiz?: QuizQuestion[];
  readCheck?: ReadCondition[];
  transfer?: true;
}

/** The kind of a step, by the key it carries. */
export function stepKind(step: PersonStepShape): StepKind {
  if (step.read) return 'read';
  if (step.checklist) return 'checklist';
  if (step.rubric) return 'rubric';
  if (step.quiz) return 'quiz';
  if (step.readCheck) return 'read-check';
  return 'canvas';
}

/** A step the person answers in the panel: a checklist, a rubric, a quiz or a read-check. */
export function isPersonStep(step: PersonStepShape): boolean {
  const kind = stepKind(step);
  return kind !== 'read' && kind !== 'canvas';
}

/** Where one checklist item stands: done by the app's check, done on the person's word, or open. */
export type ItemState = { done: boolean; by: 'app' | 'self' | null; verdict: ReadVerdict | null };

/** The state of one checklist item given its answer. */
export function itemState(item: ChecklistItem, answer: string | undefined, graph: LessonGraph, facts: ReadFacts | undefined): ItemState {
  const ticked = answer === TICK;
  if (!item.check) return { done: ticked, by: ticked ? 'self' : null, verdict: null };
  const verdict = readVerdict(item.check, graph, facts);
  if (verdict === 'holds') return { done: true, by: 'app', verdict };
  if (verdict === 'unknown' && ticked) return { done: true, by: 'self', verdict };
  return { done: false, by: null, verdict };
}

/** Whether a rubric answer passes its criterion (any valid level passes a criterion without `pass`). */
export function criterionPasses(criterion: RubricCriterion, answer: string | undefined): boolean {
  const at = answer === undefined ? -1 : criterion.levels.indexOf(answer);
  if (at < 0) return false;
  return criterion.pass === undefined || at >= criterion.levels.indexOf(criterion.pass);
}

/** Whether a step the person answers is done. A canvas step or a step to read is never judged here. */
export function personStepDone(step: PersonStepShape, answers: StepAnswers | undefined, graph: LessonGraph, facts: ReadFacts | undefined): boolean {
  const given = answers ?? {};
  switch (stepKind(step)) {
    case 'checklist':
      return (step.checklist ?? []).every((item) => item.optional || itemState(item, given[item.id], graph, facts).done);
    case 'rubric':
      return (step.rubric ?? []).every((criterion) => criterionPasses(criterion, given[criterion.id]));
    case 'quiz':
      return (step.quiz ?? []).every((question) => question.choices.includes(given[question.id] ?? ''));
    case 'read-check': {
      const verdicts = (step.readCheck ?? []).map((condition) => readVerdict(condition, graph, facts));
      if (verdicts.some((verdict) => verdict === 'fails')) return false;
      return verdicts.every((verdict) => verdict === 'holds') || given[SELF_CHECK] === TICK;
    }
    default:
      return false;
  }
}

/**
 * What a person who did everything would answer: every item ticked, the highest level of each criterion, the right
 * choice of each question, and "I checked it myself" for a read-check. The empty-canvas try (share/tryLesson.ts) and
 * the tests play a lesson to its end with it.
 */
export function answerAll(step: PersonStepShape): StepAnswers {
  switch (stepKind(step)) {
    case 'checklist':
      return Object.fromEntries((step.checklist ?? []).map((item) => [item.id, TICK]));
    case 'rubric':
      return Object.fromEntries((step.rubric ?? []).map((criterion) => [criterion.id, criterion.levels[criterion.levels.length - 1]]));
    case 'quiz':
      return Object.fromEntries((step.quiz ?? []).map((question) => [question.id, question.answer]));
    case 'read-check':
      return { [SELF_CHECK]: TICK };
    default:
      return {};
  }
}

/**
 * The three things a finished lesson can say: the graph was checked on the canvas (by the app), the workflow was run
 * in ComfyUI (the person's tick, or a check the app made), the result was assessed against a rubric (the person's
 * own assessment). A lesson declares which of them it has; a lesson that says nothing has only the first.
 */
export const LESSON_OUTCOMES = ['structure', 'run', 'result'] as const;
/** One of LESSON_OUTCOMES. */
export type LessonOutcome = (typeof LESSON_OUTCOMES)[number];

/** Where an outcome stands: not yet, checked by the app, or the person's own word. */
export type OutcomeState = 'open' | 'app' | 'self';
