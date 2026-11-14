/**
 * Lessons: a person builds a graph by hand and the app follows along. A lesson is a list of steps; each step says
 * what must be on the canvas once it is done (nodes of certain classes, links between them, values in fields).
 * Nothing here remembers what the person did: where they are in a lesson is read off the graph itself, so a node
 * deleted by mistake takes the lesson back to its step, and a graph built in another order still counts.
 *
 * A lesson names its nodes by role ("sampler", "positive"). Which node on the canvas plays which role is worked
 * out by matching: every role gets its own node of one of its classes so that all the links and field rules of
 * the steps so far hold. When the current step does not hold yet, the nearest match says what is missing, in
 * terms a person can act on: no such node, this input is fed from the wrong node, this field is 20 and should
 * be 4.
 *
 * Pure: no DOM, no catalog, no IPC. The renderer turns its graph into LessonGraph and supplies the facts.
 */

import { weightsOf } from '../prompt/inspect';

export interface LessonPort {
  id: string;
  name: string;
  type: string;
}

export interface LessonNode {
  id: string;
  classType: string;
  inputs: LessonPort[];
  outputs: LessonPort[];
  /** Field values by input name. */
  values: Record<string, unknown>;
}

export interface LessonLink {
  from: string;
  /** Output port id on `from`. */
  fromPort: string;
  to: string;
  /** Input port id on `to`. */
  toPort: string;
}

export interface LessonGraph {
  nodes: LessonNode[];
  links: LessonLink[];
}

/** A node the lesson asks for. Any of the classes fills the role; the first one installed is the one named. */
export interface RoleSpec {
  role: string;
  classes: string[];
}

/**
 * A link the lesson asks for. `output` is the name of the output or, when no output has that name, its data
 * type ("MODEL"); `input` is the name of the input.
 */
export interface LinkSpec {
  from: string;
  output: string;
  to: string;
  input: string;
  /**
   * Classes that may sit in between: a LoRA loader between a model and its sampler leaves the model reaching the
   * sampler, and the link still holds.
   */
  via?: string[];
}

/** Where a trigger-word rule finds the files whose words it asks for. */
export type TriggerSource =
  /** The node that plays this role. */
  | { role: string; field: string }
  /**
   * Every node of this class on the canvas. A lesson that does not ask for a LoRA still holds the one that is
   * there to its words; a canvas without one asks for nothing.
   */
  | { classType: string; field: string };

export type FieldTest =
  /** Something is chosen or written. */
  | { kind: 'chosen' }
  /**
   * The text holds a weight in ComfyUI's own form, `(words:1.2)`, inside the range and other than 1, and no
   * weight above the range: a person has given one thing more or less pull without breaking the picture.
   */
  | { kind: 'weighted'; min: number; max: number }
  | { kind: 'equals'; value: string | number | boolean }
  /** A number in the range. `prefer` is what "Do this for me" sets; without it, the nearer end of the range. */
  | { kind: 'between'; min: number; max: number; prefer?: number }
  /** Text of at least this many characters; with `has`, one that holds each of these marks as well. */
  | { kind: 'text'; minChars: number; has?: string[] }
  /** The text holds a trigger word of a file chosen in one of these fields (none known: nothing to check). */
  | { kind: 'has-trigger'; of: TriggerSource[] }
  /** Not the same value as that field: two loaders must not hold the same file. */
  | { kind: 'differs'; role: string; field: string }
  /** The same value as that field: the second sampler starts at the step the first one ends at. */
  | { kind: 'same'; role: string; field: string };

/** The roles a field rule looks at besides its own. */
function otherRoles(test: FieldTest): string[] {
  if (test.kind === 'has-trigger') return test.of.flatMap((item) => ('role' in item ? [item.role] : []));
  return test.kind === 'differs' || test.kind === 'same' ? [test.role] : [];
}

export interface FieldSpec {
  role: string;
  field: string;
  test: FieldTest;
}

export interface LessonStep {
  id: string;
  /** A step that only explains: done once the person has read it and said so. */
  read?: true;
  roles?: RoleSpec[];
  links?: LinkSpec[];
  fields?: FieldSpec[];
}

export interface Lesson {
  id: string;
  steps: LessonStep[];
}

/** What the engine cannot read off the graph. */
export interface LessonFacts {
  /** Trigger words by file name, as the model's own description gives them. */
  triggers?: Record<string, string[]>;
}

/** Role → node id. */
export type Roles = Record<string, string>;

/** Why the current step is not done, most basic first. */
export type Missing =
  | { kind: 'node'; role: string; classes: string[] }
  | {
    kind: 'link';
    from: { role: string; nodeId: string };
    output: string;
    to: { role: string; nodeId: string };
    input: string;
    /** The node that feeds this input now, when something else does. */
    fedBy: string | null;
    /** The node as it is on the canvas has no such port: the class differs from the one the lesson knows. */
    absent: 'output' | 'input' | null;
  }
  | {
    kind: 'field';
    role: string;
    nodeId: string;
    field: string;
    test: FieldTest;
    value: unknown;
    /** The node as it is on the canvas has no such field. */
    absent: boolean;
    /** For a rule that compares with another field: that field's node and value. */
    other: { nodeId: string; value: unknown } | null;
  };

export interface Progress {
  /** Index of the step to do now; steps.length when the lesson is finished. */
  current: number;
  /** Which node plays which role, as far as the graph says. */
  roles: Roles;
  /** What the current step still lacks; empty for a step that only explains, and at the end. */
  missing: Missing[];
}

interface Requirements {
  roles: RoleSpec[];
  links: LinkSpec[];
  fields: FieldSpec[];
}

function requirementsOf(steps: LessonStep[]): Requirements {
  const out: Requirements = { roles: [], links: [], fields: [] };
  for (const step of steps) {
    if (step.roles) out.roles.push(...step.roles);
    if (step.links) out.links.push(...step.links);
    if (step.fields) out.fields.push(...step.fields);
  }
  return out;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The outputs a link spec may start from: the one of that name, else every one of that data type. */
export function outputsFor(node: LessonNode, output: string): LessonPort[] {
  const named = node.outputs.filter((port) => same(port.name, output));
  return named.length > 0 ? named : node.outputs.filter((port) => same(port.type, output));
}

export function inputFor(node: LessonNode, input: string): LessonPort | null {
  return node.inputs.find((port) => same(port.name, input)) ?? null;
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function linkHolds(graph: LessonGraph, byId: Map<string, LessonNode>, spec: LinkSpec, roles: Roles): boolean {
  const from = byId.get(roles[spec.from]);
  const to = byId.get(roles[spec.to]);
  if (!from || !to) return false;
  const input = inputFor(to, spec.input);
  if (!input) return false;
  const outputs = new Set(outputsFor(from, spec.output).map((port) => port.id));
  // Back from the input, through nodes that only pass the data on, to the node the lesson names.
  const seen = new Set<string>();
  const queue = graph.links.filter((link) => link.to === to.id && link.toPort === input.id);
  while (queue.length > 0) {
    const link = queue.pop()!;
    if (link.from === from.id && outputs.has(link.fromPort)) return true;
    const between = byId.get(link.from);
    if (!between || seen.has(between.id) || !spec.via?.includes(between.classType)) continue;
    seen.add(between.id);
    queue.push(...graph.links.filter((item) => item.to === between.id));
  }
  return false;
}

/** Whether a field rule holds. `roles` must hold every role the rule names. */
export function fieldHolds(byId: Map<string, LessonNode>, spec: FieldSpec, roles: Roles, facts: LessonFacts): boolean {
  const node = byId.get(roles[spec.role]);
  if (!node) return false;
  const value = node.values[spec.field];
  const test = spec.test;
  switch (test.kind) {
    case 'chosen':
      return !isEmpty(value);
    case 'equals':
      return typeof test.value === 'number' ? Number(value) === test.value && !isEmpty(value) : String(value ?? '') === String(test.value);
    case 'between': {
      const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
      return Number.isFinite(number) && number >= test.min && number <= test.max;
    }
    case 'text':
      return typeof value === 'string' && value.trim().length >= test.minChars && (test.has ?? []).every((mark) => value.includes(mark));
    case 'weighted': {
      if (typeof value !== 'string') return false;
      const weights = weightsOf(value).map((item) => item.weight);
      return weights.some((weight) => weight >= test.min && weight <= test.max && weight !== 1) && weights.every((weight) => weight <= test.max);
    }
    case 'has-trigger': {
      if (typeof value !== 'string') return false;
      const words: string[] = [];
      for (const source of test.of) {
        const holders = 'role' in source ? [byId.get(roles[source.role])] : [...byId.values()].filter((item) => item.classType === source.classType);
        for (const holder of holders) {
          const file = holder?.values[source.field];
          if (typeof file === 'string') words.push(...(facts.triggers?.[file] ?? []));
        }
      }
      const known = words.map((word) => word.trim().toLowerCase()).filter(Boolean);
      // A file whose description names no trigger words asks for none.
      if (known.length === 0) return true;
      const text = value.toLowerCase();
      return known.some((word) => text.includes(word));
    }
    case 'differs': {
      const other = byId.get(roles[test.role])?.values[test.field];
      return !isEmpty(value) && !isEmpty(other) && String(value) !== String(other);
    }
    case 'same': {
      const other = byId.get(roles[test.role])?.values[test.field];
      return !isEmpty(value) && !isEmpty(other) && String(value) === String(other);
    }
  }
}

/** How many assignments a search may try before it gives up; a graph a person builds in a lesson is far below. */
const SEARCH_LIMIT = 200_000;

/**
 * Every way to give each role its own node so that all the requirements hold, up to `most` of them.
 * `fixed` roles keep their nodes.
 */
function matches(graph: LessonGraph, needs: Requirements, facts: LessonFacts, most: number, fixed: Roles = {}): Roles[] {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const found: Roles[] = [];
  const order = needs.roles.filter((spec) => !(spec.role in fixed));
  const roles: Roles = { ...fixed };
  const taken = new Set(Object.values(fixed));
  let tried = 0;
  const ready = (names: string[]) => names.every((name) => name in roles);
  const holdsSoFar = () => needs.links.every((spec) => !ready([spec.from, spec.to]) || linkHolds(graph, byId, spec, roles))
    && needs.fields.every((spec) => !ready([spec.role, ...otherRoles(spec.test)]) || fieldHolds(byId, spec, roles, facts));
  const walk = (index: number) => {
    if (found.length >= most || tried > SEARCH_LIMIT) return;
    if (index === order.length) {
      found.push({ ...roles });
      return;
    }
    const spec = order[index];
    for (const node of graph.nodes) {
      if (taken.has(node.id) || !spec.classes.includes(node.classType)) continue;
      tried += 1;
      roles[spec.role] = node.id;
      taken.add(node.id);
      if (holdsSoFar()) walk(index + 1);
      taken.delete(node.id);
      delete roles[spec.role];
      if (found.length >= most || tried > SEARCH_LIMIT) return;
    }
  };
  if (holdsSoFar()) walk(0);
  return found;
}

/** What a step lacks under an assignment of roles (roles may be missing from it). */
function missingOf(graph: LessonGraph, step: LessonStep, roles: Roles, facts: LessonFacts): Missing[] {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const out: Missing[] = [];
  for (const spec of step.roles ?? []) {
    if (!(spec.role in roles)) out.push({ kind: 'node', role: spec.role, classes: spec.classes });
  }
  for (const spec of step.links ?? []) {
    const from = byId.get(roles[spec.from]);
    const to = byId.get(roles[spec.to]);
    // A link to a node that is not there yet is said by the node.
    if (!from || !to || linkHolds(graph, byId, spec, roles)) continue;
    const input = inputFor(to, spec.input);
    const feeding = input ? graph.links.find((link) => link.to === to.id && link.toPort === input.id) : undefined;
    out.push({
      kind: 'link',
      from: { role: spec.from, nodeId: from.id },
      output: spec.output,
      to: { role: spec.to, nodeId: to.id },
      input: spec.input,
      fedBy: feeding ? feeding.from : null,
      absent: !input ? 'input' : outputsFor(from, spec.output).length === 0 ? 'output' : null,
    });
  }
  for (const spec of step.fields ?? []) {
    const node = byId.get(roles[spec.role]);
    if (!node) continue;
    if (otherRoles(spec.test).some((role) => !(role in roles))) continue;
    if (fieldHolds(byId, spec, roles, facts)) continue;
    const known = Object.prototype.hasOwnProperty.call(node.values, spec.field) || inputFor(node, spec.field) !== null;
    const compared = spec.test.kind === 'differs' || spec.test.kind === 'same' ? byId.get(roles[spec.test.role]) : undefined;
    out.push({
      kind: 'field',
      role: spec.role,
      nodeId: node.id,
      field: spec.field,
      test: spec.test,
      value: node.values[spec.field],
      absent: !known,
      other: compared && (spec.test.kind === 'differs' || spec.test.kind === 'same') ? { nodeId: compared.id, value: compared.values[spec.test.field] } : null,
    });
  }
  return out;
}

/**
 * Where the person is in a lesson. `read` holds the ids of the explaining steps they have passed.
 * The current step is the first one that does not hold; everything before it does.
 */
export function lessonProgress(lesson: Lesson, graph: LessonGraph, facts: LessonFacts, read: ReadonlySet<string>): Progress {
  let roles: Roles = {};
  for (let index = 0; index < lesson.steps.length; index += 1) {
    const step = lesson.steps[index];
    if (step.read) {
      if (read.has(step.id)) continue;
      return { current: index, roles, missing: [] };
    }
    const upTo = lesson.steps.slice(0, index + 1);
    const whole = matches(graph, requirementsOf(upTo), facts, 1);
    if (whole.length > 0) {
      roles = whole[0];
      continue;
    }
    // Not done. The nearest miss: every way the steps before hold, with this step's new roles filled in as far
    // as nodes allow, and of those the one that leaves this step lacking least. Of two that lack as much, the
    // one that asks to move fewer links that are already there.
    const before = matches(graph, requirementsOf(lesson.steps.slice(0, index)), facts, 64);
    const busy = busyElsewhere(lesson, graph);
    const brought = new Set((step.roles ?? []).map((spec) => spec.role));
    let best: { roles: Roles; missing: Missing[] } | null = null;
    for (const start of before.length > 0 ? before : [{}]) {
      // Every node of the class may play a new role, and so may none of those that work elsewhere: then the role
      // stays open and the step asks for a node of its own.
      const ways = [...fillings(graph, step.roles ?? [], start, NOTHING), ...(busy.size > 0 ? fillings(graph, step.roles ?? [], start, busy) : [])];
      for (const filled of ways) {
        const missing = missingOf(graph, step, filled, facts);
        // A node that works for another part of the graph is not taken apart: a way that moves a link of such a
        // node to give it a new role is no way. With an input still empty it is simply a node being wired.
        const tearsApart = missing.some((item) => item.kind === 'link' && item.fedBy !== null && item.fedBy !== item.from.nodeId
          && busy.has(item.to.nodeId) && brought.has(item.to.role) && !(item.to.role in start));
        if (tearsApart) continue;
        if (!best || missing.length < best.missing.length || (missing.length === best.missing.length && moved(missing) < moved(best.missing))) best = { roles: filled, missing };
      }
    }
    return { current: index, roles: best?.roles ?? roles, missing: best?.missing ?? [] };
  }
  return { current: lesson.steps.length, roles, missing: [] };
}

const NOTHING: ReadonlySet<string> = new Set();

/** How many of the lacks ask to take a link off an input that something else feeds now. */
function moved(missing: Missing[]): number {
  return missing.filter((item) => item.kind === 'link' && item.fedBy !== null && item.fedBy !== item.from.nodeId).length;
}

/**
 * The nodes that already work for a part of the graph the lesson knows nothing about: their output goes into a
 * node of a class that no role of the lesson has and no link of it may pass through. The texts of a video graph
 * feed a Wan node; a lesson about pictures has no such node, so those texts are the video's and not a pair of
 * spare text nodes. A lesson never tells a person to move a link of such a node: it asks for a node of its own.
 * A node of the lesson that also feeds something the lesson does not know (a preview next to the saver) is still
 * the lesson's: what it lacks is said as before, as long as nothing that is wired has to be taken off.
 */
function busyElsewhere(lesson: Lesson, graph: LessonGraph): Set<string> {
  const known = new Set<string>();
  for (const step of lesson.steps) {
    for (const spec of step.roles ?? []) for (const classType of spec.classes) known.add(classType);
    for (const spec of step.links ?? []) for (const classType of spec.via ?? []) known.add(classType);
  }
  const classOf = new Map(graph.nodes.map((node) => [node.id, node.classType]));
  const out = new Set<string>();
  for (const link of graph.links) {
    if (!known.has(classOf.get(link.to) ?? '')) out.add(link.from);
  }
  return out;
}

/**
 * `start` with each new role given a free node of its class where there is one, in every way (bounded). A node
 * named in `skip` is not free.
 */
function fillings(graph: LessonGraph, specs: RoleSpec[], start: Roles, skip: ReadonlySet<string>): Roles[] {
  const out: Roles[] = [];
  const roles: Roles = { ...start };
  const taken = new Set(Object.values(start));
  const walk = (index: number) => {
    if (out.length >= 256) return;
    if (index === specs.length) {
      out.push({ ...roles });
      return;
    }
    const spec = specs[index];
    if (spec.role in roles) {
      walk(index + 1);
      return;
    }
    let any = false;
    for (const node of graph.nodes) {
      if (taken.has(node.id) || skip.has(node.id) || !spec.classes.includes(node.classType)) continue;
      any = true;
      roles[spec.role] = node.id;
      taken.add(node.id);
      walk(index + 1);
      taken.delete(node.id);
      delete roles[spec.role];
    }
    // No node of the class is left for this role: it stays open, and is what the step lacks.
    if (!any) walk(index + 1);
  };
  walk(0);
  return out;
}

/** What a class offers, as the catalog knows it; null for a class the catalog does not have. */
export type ClassPorts = (classType: string) => { inputs: string[]; outputs: Array<{ name: string; type: string }> } | null;

export type LessonGap =
  /** None of the classes a role may be is installed. */
  | { kind: 'class'; role: string; classes: string[] }
  /** The installed class has no input or output of the name the lesson uses: it is built differently here. */
  | { kind: 'port'; classType: string; port: string; side: 'input' | 'output' };

/** The class that plays a role in this ComfyUI: the first of its classes that is installed. */
export function classOfRole(lesson: Lesson, role: string, ports: ClassPorts): string | null {
  for (const step of lesson.steps) {
    const spec = step.roles?.find((item) => item.role === role);
    if (spec) return spec.classes.find((classType) => ports(classType) !== null) ?? null;
  }
  return null;
}

/**
 * Whether a lesson can be done in this ComfyUI: every role has an installed class, and that class has the
 * inputs and outputs the lesson's links and fields name. An empty list means yes.
 */
export function lessonGaps(lesson: Lesson, ports: ClassPorts): LessonGap[] {
  const gaps: LessonGap[] = [];
  const classOf = new Map<string, string>();
  const said = new Set<string>();
  const say = (gap: LessonGap) => {
    const key = JSON.stringify(gap);
    if (!said.has(key)) {
      said.add(key);
      gaps.push(gap);
    }
  };
  for (const step of lesson.steps) {
    for (const spec of step.roles ?? []) {
      const installed = spec.classes.find((classType) => ports(classType) !== null);
      if (installed) classOf.set(spec.role, installed);
      else say({ kind: 'class', role: spec.role, classes: spec.classes });
    }
  }
  const has = (role: string, side: 'input' | 'output', name: string) => {
    const classType = classOf.get(role);
    const known = classType ? ports(classType) : null;
    if (!classType || !known) return;
    const there = side === 'input'
      ? known.inputs.some((item) => same(item, name))
      : known.outputs.some((item) => same(item.name, name) || same(item.type, name));
    if (!there) say({ kind: 'port', classType, port: name, side });
  };
  for (const step of lesson.steps) {
    for (const spec of step.links ?? []) {
      has(spec.from, 'output', spec.output);
      has(spec.to, 'input', spec.input);
    }
    for (const spec of step.fields ?? []) has(spec.role, 'input', spec.field);
  }
  return gaps;
}

/** One thing the app can do in the person's place, when the lesson fixes what it is. */
export type StepFix =
  | { kind: 'add-node'; classType: string }
  | { kind: 'connect'; from: string; fromPort: string; to: string; toPort: string }
  | { kind: 'set-field'; nodeId: string; field: string; value: string | number | boolean };

/**
 * The action that removes a lack, or null when only the person can (which file, what words). A field that must
 * lie in a range goes to the nearer end of it.
 */
/**
 * `choices` lists the values a field of a node on the canvas can take (the catalog's options). With it, a field that
 * must hold another file than its pair (two loaders of one model) is given the first other file there is.
 */
export function fixFor(
  missing: Missing,
  graph: LessonGraph,
  installed: (classType: string) => boolean,
  choices?: (nodeId: string, field: string) => readonly unknown[],
): StepFix | null {
  if (missing.kind === 'node') {
    const classType = missing.classes.find(installed);
    return classType ? { kind: 'add-node', classType } : null;
  }
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  if (missing.kind === 'link') {
    const from = byId.get(missing.from.nodeId);
    const to = byId.get(missing.to.nodeId);
    const output = from ? outputsFor(from, missing.output)[0] : undefined;
    const input = to ? inputFor(to, missing.input) : null;
    return from && to && output && input ? { kind: 'connect', from: from.id, fromPort: output.id, to: to.id, toPort: input.id } : null;
  }
  if (missing.absent) return null;
  if (missing.test.kind === 'equals') return { kind: 'set-field', nodeId: missing.nodeId, field: missing.field, value: missing.test.value };
  if (missing.test.kind === 'between') {
    const now = typeof missing.value === 'number' ? missing.value : Number(missing.value);
    const value = missing.test.prefer ?? (Number.isFinite(now) && now > missing.test.max ? missing.test.max : missing.test.min);
    return { kind: 'set-field', nodeId: missing.nodeId, field: missing.field, value };
  }
  if (missing.test.kind === 'differs' && choices) {
    const taken = missing.other?.value;
    const value = choices(missing.nodeId, missing.field).find((option) => option !== taken && (typeof option === 'string' || typeof option === 'number'));
    return typeof value === 'string' || typeof value === 'number' ? { kind: 'set-field', nodeId: missing.nodeId, field: missing.field, value } : null;
  }
  if (missing.test.kind === 'same') {
    const value = missing.other?.value;
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? { kind: 'set-field', nodeId: missing.nodeId, field: missing.field, value }
      : null;
  }
  return null;
}

/** Every role a lesson names, with the step that brings it in. */
export function rolesOf(lesson: Lesson): Array<RoleSpec & { step: number }> {
  return lesson.steps.flatMap((step, index) => (step.roles ?? []).map((spec) => ({ ...spec, step: index })));
}
