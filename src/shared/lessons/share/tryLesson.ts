/**
 * "Can this lesson be done from an empty canvas?" The app plays the person: it starts from nothing, does what each
 * step lacks the way "Do this for me" would (add the node, make the link, set the number), decides what only a
 * person decides (which file, what words) with a stand-in, and reads the step through, until the lesson ends or a
 * step cannot be done. The engine itself (../engine.ts) judges every step, so a lesson that passes here is one the
 * engine lets a person finish. A step the person answers (a checklist, a rubric, a quiz, a read-check) is answered the
 * way a person who did everything would answer it (steps.ts answerAll).
 *
 * Who uses it: the lesson editor before it saves (it names the step that cannot be done), the import (a refused
 * file says which step is impossible), the assistant's draftLesson tool before the person sees a draft, and the
 * unit tests (the round trip of every built-in lesson).
 *
 * Classes come either from the catalog of the person's ComfyUI (catalogShapes) or, when that is not read, from the
 * lesson itself (lessonShapes): every input and output the lesson names, so the lesson is tried against its own
 * promises. Pure: no DOM, no IPC.
 */

import { familyOfFile, fileMiss } from '../files';
import { fixFor, lessonProgress, type FieldTest, type Lesson, type LessonFacts, type LessonGraph, type LessonNode, type Missing } from '../engine';
import { answerAll, isPersonStep, type StepAnswers } from '../steps';

/** What a class offers to a lesson that is being tried: inputs with the value a new node starts with, outputs. */
export interface ClassShape {
  inputs: Array<{ name: string; type: string; value?: unknown; options?: readonly unknown[] }>;
  outputs: Array<{ name: string; type: string }>;
}

/** A class's shape, or null when the class is not there. */
export type ClassShapes = (classType: string) => ClassShape | null;

/** How a try ended: the lesson finished in so many actions, or the step that could not be done and why. */
export type TryResult =
  | { ok: true; actions: number }
  | {
    ok: false;
    /** The lesson whose step cannot be done: the one tried, or a lesson it continues. */
    lessonId: string;
    step: number;
    stepId: string;
    /** no-class: no class of a role is there; stuck: the step asks for something no action can give; too-long: it never ends. */
    why: 'no-class' | 'stuck' | 'too-long';
    missing: Missing | null;
  };

/** A canvas the app builds on while it tries a lesson. */
export class TryCanvas implements LessonGraph {
  nodes: LessonNode[] = [];
  links: LessonGraph['links'] = [];
  private next = 1;

  constructor(private readonly shapes: ClassShapes) {}

  add(classType: string): LessonNode | null {
    const shape = this.shapes(classType);
    if (!shape) return null;
    const node: LessonNode = {
      id: String(this.next),
      classType,
      inputs: shape.inputs.map((input, index) => ({ id: `in-${index}`, name: input.name, type: input.type })),
      outputs: shape.outputs.map((output, index) => ({ id: `out-${index}`, name: output.name, type: output.type })),
      values: Object.fromEntries(shape.inputs.filter((input) => input.value !== undefined).map((input) => [input.name, input.value])),
    };
    this.next += 1;
    this.nodes.push(node);
    return node;
  }

  /** An input takes one link: a new one replaces the old, as in ComfyUI. */
  connect(from: string, fromPort: string, to: string, toPort: string): void {
    this.links = this.links.filter((link) => !(link.to === to && link.toPort === toPort));
    this.links.push({ from, fromPort, to, toPort });
  }

  node(id: string): LessonNode | undefined {
    return this.nodes.find((node) => node.id === id);
  }

  options(nodeId: string, field: string): readonly unknown[] {
    const node = this.node(nodeId);
    return node ? this.shapes(node.classType)?.inputs.find((input) => input.name === field)?.options ?? [] : [];
  }

  /** A copy that later actions do not change. */
  snapshot(): LessonGraph {
    return JSON.parse(JSON.stringify({ nodes: this.nodes, links: this.links })) as LessonGraph;
  }
}

/** The sentences a stand-in person writes, as many as a text rule asks characters for. */
const SENTENCES = ['A quiet lake at dawn.', 'Mist drifts slowly over the water.', 'The camera glides forward at walking pace.', 'Soft morning light, calm and clear.'];

/** What a negative description lists, as long as a rule asks. */
function FAULTS(minChars: number): string {
  const words = ['blurry', 'low quality', 'extra fingers', 'watermark', 'text', 'jpeg artifacts', 'deformed hands', 'oversaturated'];
  let out = '';
  for (const word of words) {
    if (out.length >= Math.max(minChars, 5)) break;
    out = out ? `${out}, ${word}` : word;
  }
  return out;
}

function textOf(minChars: number): string {
  let out = '';
  while (out.length < minChars) out = `${out} ${SENTENCES[Math.floor(out.length / 20) % SENTENCES.length]}`.trim();
  return out || SENTENCES[0];
}

/** A weight for a weighted rule: inside the range and other than 1. */
function weightIn(test: Extract<FieldTest, { kind: 'weighted' }>): number | null {
  const candidates = [1.2, 1.1, 0.8, 0.9, test.max, test.min, (test.min + test.max) / 2];
  return candidates.find((weight) => weight >= test.min && weight <= test.max && weight !== 1) ?? null;
}

const empty = (value: unknown) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

/**
 * What only the person decides, decided by a stand-in: the first file in the list, a few plain sentences, a
 * weight, a trigger word. False when nothing a person could do helps.
 */
function decide(canvas: TryCanvas, missing: Missing, facts: LessonFacts): boolean {
  if (missing.kind !== 'field' || missing.absent) return false;
  const node = canvas.node(missing.nodeId);
  if (!node) return false;
  const now = node.values[missing.field];
  const options = canvas.options(missing.nodeId, missing.field).filter((option) => typeof option === 'string' || typeof option === 'number');
  const test = missing.test;
  switch (test.kind) {
    case 'chosen':
      node.values[missing.field] = options[0] ?? 'chosen.safetensors';
      return true;
    case 'differs': {
      const other = missing.other;
      // The field it must differ from is empty too: that one is given a file first, so there is something to differ from.
      const holder = other ? canvas.node(other.nodeId) : undefined;
      if (holder && empty(holder.values[test.field])) holder.values[test.field] = options[0] ?? `${test.field}-${holder.id}.safetensors`;
      const taken = holder?.values[test.field];
      node.values[missing.field] = options.find((option) => String(option) !== String(taken)) ?? `${missing.field}-${missing.nodeId}-other.safetensors`;
      return true;
    }
    case 'text': {
      const held = typeof now === 'string' ? now.trim() : '';
      const marks = test.has ?? [];
      // A text that must not be a copy of another (the negative description of the positive one) is a list of faults.
      const copyOf = test.notCopyOf ? canvas.nodes.find((item) => item.values[test.notCopyOf!.field] !== undefined && item.id !== node.id)?.values[test.notCopyOf.field] : undefined;
      const fresh = test.notCopyOf || missing.role.toLowerCase().includes('negative') ? FAULTS(test.minChars) : textOf(test.minChars);
      const base = held.length >= test.minChars && held !== copyOf ? held : fresh;
      node.values[missing.field] = marks.length > 0 ? `${base} ${marks.join(' Hello there. ')}` : base;
      return true;
    }
    case 'weighted': {
      const weight = weightIn(test);
      if (weight === null) return false;
      // Weights above the range are taken out first: the rule holds only when none is left.
      const held = typeof now === 'string' ? now.replace(/\(([^():]+):[\d.]+\)/g, '$1') : '';
      node.values[missing.field] = `${held}${held ? ', ' : ''}(soft light:${weight})`;
      return true;
    }
    case 'has-trigger': {
      const words: string[] = [];
      for (const source of test.of) {
        const holders = 'role' in source ? [] : canvas.nodes.filter((item) => item.classType === source.classType);
        for (const holder of holders) {
          const file = holder.values[source.field];
          if (typeof file === 'string') words.push(...(facts.triggers?.[file] ?? []));
        }
      }
      for (const file of Object.keys(facts.triggers ?? {})) words.push(...(facts.triggers?.[file] ?? []));
      const word = words.find((item) => item.trim() !== '');
      if (!word) return false;
      node.values[missing.field] = `${typeof now === 'string' ? now : ''}, ${word}`;
      return true;
    }
    case 'file': {
      // A file of the kind the step names: one in the list that fits, else the name a model page gives as example.
      const fits = options.find((option): option is string => typeof option === 'string' && fileMiss(option, test.want, facts.families?.[option]) === null);
      node.values[missing.field] = fits ?? test.want.example;
      return true;
    }
    case 'sameFamily': {
      const holder = missing.other ? canvas.node(missing.other.nodeId) : undefined;
      const theirs = holder?.values[test.field];
      if (typeof theirs !== 'string' || theirs === '') return false;
      const family = familyOfFile(theirs, facts.families?.[theirs]);
      const fits = options.find((option): option is string => typeof option === 'string' && familyOfFile(option, facts.families?.[option]) === family);
      // A stand-in named after the file it goes with is read as the same family.
      node.values[missing.field] = fits ?? `${theirs.replace(/\.[a-z0-9]+$/i, '')}_companion.safetensors`;
      return true;
    }
    case 'less': {
      const holder = missing.other ? canvas.node(missing.other.nodeId) : undefined;
      if (!holder) return false;
      if (!Number.isFinite(Number(holder.values[test.field])) || empty(holder.values[test.field])) holder.values[test.field] = 20;
      node.values[missing.field] = Math.max(0, Math.floor(Number(holder.values[test.field]) / 2));
      return true;
    }
    case 'size': {
      // A square at the size the family was trained at: 512 for SD 1.5, a megapixel otherwise.
      const holder = Object.values(canvas.nodes).find((item) => item.id === missing.other?.nodeId);
      const file = holder?.values[test.of.field];
      const side = typeof file === 'string' && familyOfFile(file, facts.families?.[file]) === 'sd15' ? 512 : 1024;
      node.values.width = side;
      node.values.height = side;
      return true;
    }
    case 'aspect': {
      const holder = missing.other ? canvas.node(missing.other.nodeId) : undefined;
      // A frame or a picture whose size the canvas does not know (a loaded image) gets a plain one first.
      if (!(Number(node.values.height) > 0)) node.values.height = 480;
      if (holder && !(Number(holder.values.width) > 0 && Number(holder.values.height) > 0)) {
        holder.values.width = Number(node.values.width) > 0 ? node.values.width : 832;
        holder.values.height = Number(node.values.height) > 0 ? node.values.height : 480;
      }
      const ratio = Number(holder?.values.width) / Number(holder?.values.height);
      const height = Number(node.values.height);
      if (!Number.isFinite(ratio) || !Number.isFinite(height) || ratio <= 0 || height <= 0) return false;
      node.values.width = Math.round((height * ratio) / 8) * 8;
      return true;
    }
    case 'same': {
      const other = missing.other;
      if (!other) return false;
      const holder = canvas.node(other.nodeId);
      if (!holder) return false;
      // Both empty: the pair is given one value; the other field's own rule, if any, moves both on later.
      if (empty(other.value)) holder.values[test.field] = 1;
      node.values[missing.field] = holder.values[test.field] as never;
      return true;
    }
    default:
      return false;
  }
}

/** What a caller may add to a try: facts about files, the lessons it continues, a hook for tests. */
export interface TryOptions {
  facts?: LessonFacts;
  /** Lessons whose graph this one starts from, first to last: they are done first, on the same canvas. */
  before?: Lesson[];
  /** Sees the canvas before every action, with the steps read so far (the round-trip test compares two lessons there). */
  observe?: (graph: LessonGraph, read: ReadonlySet<string>, lesson: Lesson) => void;
  /** At most this many actions per step on average before the lesson counts as never ending. */
  actionsPerStep?: number;
}

/** Plays a lesson from an empty canvas to its end; see the header. */
export function tryLesson(lesson: Lesson, shapes: ClassShapes, options: TryOptions = {}): TryResult {
  const canvas = new TryCanvas(shapes);
  const facts = options.facts ?? {};
  let total = 0;
  for (const current of [...(options.before ?? []), lesson]) {
    const result = carryOut(current, canvas, shapes, facts, options);
    if (!result.ok) return result;
    total += result.actions;
  }
  return { ok: true, actions: total };
}

function carryOut(lesson: Lesson, canvas: TryCanvas, shapes: ClassShapes, facts: LessonFacts, options: TryOptions): TryResult {
  const read = new Set<string>();
  const answers: Record<string, StepAnswers> = {};
  const limit = Math.max(40, lesson.steps.length * (options.actionsPerStep ?? 40));
  const installed = (classType: string) => shapes(classType) !== null;
  const seen = new Set<string>();
  for (let actions = 0; actions < limit; actions += 1) {
    options.observe?.(canvas.snapshot(), new Set(read), lesson);
    const progress = lessonProgress(lesson, canvas, facts, read, answers);
    if (progress.current >= lesson.steps.length) return { ok: true, actions };
    const step = lesson.steps[progress.current];
    const failure = (why: 'no-class' | 'stuck' | 'too-long', missing: Missing | null): TryResult => ({ ok: false, lessonId: lesson.id, step: progress.current, stepId: step.id, why, missing });
    if (step.read) {
      read.add(step.id);
      continue;
    }
    if (isPersonStep(step)) {
      // Answered once: a step that is still not done after that can never be (a pass level nobody reaches).
      if (answers[step.id]) return failure('stuck', null);
      answers[step.id] = answerAll(step);
      continue;
    }
    const missing = progress.missing[0];
    // A step that does not hold and lacks nothing nameable: its rules contradict each other.
    if (!missing) return failure('stuck', null);
    // A state seen before: what was done did not help, or two rules undo each other (set 20, set 5, set 20...).
    const key = `${progress.current}|${JSON.stringify(missing)}|${JSON.stringify(canvas.nodes.map((node) => node.values))}|${JSON.stringify(canvas.links)}`;
    if (seen.has(key)) return failure('stuck', missing);
    seen.add(key);
    const fix = fixFor(missing, canvas, installed, (nodeId, field) => canvas.options(nodeId, field), facts);
    if (fix?.kind === 'add-node') {
      if (!canvas.add(fix.classType)) return failure('no-class', missing);
    } else if (fix?.kind === 'connect') {
      canvas.connect(fix.from, fix.fromPort, fix.to, fix.toPort);
    } else if (fix?.kind === 'set-field') {
      const node = canvas.node(fix.nodeId);
      if (!node) return failure('stuck', missing);
      node.values[fix.field] = fix.value;
    } else if (missing.kind === 'node') {
      return failure('no-class', missing);
    } else if (!decide(canvas, missing, facts)) {
      return failure('stuck', missing);
    }
  }
  const progress = lessonProgress(lesson, canvas, facts, read, answers);
  const step = lesson.steps[Math.min(progress.current, lesson.steps.length - 1)];
  return { ok: false, lessonId: lesson.id, step: progress.current, stepId: step.id, why: 'too-long', missing: progress.missing[0] ?? null };
}

/**
 * The classes as the lessons themselves describe them: every input a link goes into or a field rule reads, every
 * output a link starts from. A lesson tried against these is tried against its own promises; the catalog of a real
 * ComfyUI (catalogShapes) then says whether this ComfyUI keeps them.
 */
export function lessonShapes(lessons: readonly Lesson[]): ClassShapes {
  const shapes = new Map<string, { inputs: Map<string, string>; outputs: Map<string, string> }>();
  const shapeOf = (classType: string) => {
    let shape = shapes.get(classType);
    if (!shape) {
      shape = { inputs: new Map(), outputs: new Map() };
      shapes.set(classType, shape);
    }
    return shape;
  };
  for (const lesson of lessons) {
    const classes = new Map<string, string[]>();
    for (const step of lesson.steps) for (const spec of step.roles ?? []) classes.set(spec.role, spec.classes);
    for (const [, list] of classes) for (const classType of list) shapeOf(classType);
    for (const step of lesson.steps) {
      for (const spec of step.links ?? []) {
        for (const classType of classes.get(spec.from) ?? []) shapeOf(classType).outputs.set(spec.output, spec.output);
        for (const classType of classes.get(spec.to) ?? []) shapeOf(classType).inputs.set(spec.input, spec.output);
      }
      for (const spec of step.fields ?? []) {
        for (const classType of classes.get(spec.role) ?? []) shapeOf(classType).inputs.set(spec.field, 'FIELD');
        const test = spec.test;
        if (test.kind === 'same' || test.kind === 'differs') for (const classType of classes.get(test.role) ?? []) shapeOf(classType).inputs.set(test.field, 'FIELD');
        if (test.kind === 'has-trigger') {
          for (const source of test.of) {
            if ('role' in source) for (const classType of classes.get(source.role) ?? []) shapeOf(classType).inputs.set(source.field, 'FIELD');
            else shapeOf(source.classType).inputs.set(source.field, 'FIELD');
          }
        }
      }
    }
  }
  return (classType) => {
    const shape = shapes.get(classType);
    return shape ? { inputs: [...shape.inputs].map(([name, type]) => ({ name, type })), outputs: [...shape.outputs].map(([name, type]) => ({ name, type })) } : null;
  };
}

/** What the catalog knows of a class, in the shape tryLesson takes. */
export interface CatalogClass {
  inputs: Array<{ name: string; type: string; spec?: { default?: unknown; options?: readonly unknown[] } }>;
  outputs: Array<{ name: string; type: string }>;
}

/** The classes of the person's ComfyUI, from the catalog; a class it has not read is not there. */
export function catalogShapes(classOf: (classType: string) => CatalogClass | null | undefined): ClassShapes {
  return (classType) => {
    const detail = classOf(classType);
    if (!detail) return null;
    return {
      inputs: detail.inputs.map((input) => ({ name: input.name, type: input.type, value: input.spec?.default, options: input.spec?.options })),
      outputs: detail.outputs.map((output) => ({ name: output.name, type: output.type })),
    };
  };
}
