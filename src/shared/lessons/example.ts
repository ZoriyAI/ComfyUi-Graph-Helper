import type { CatalogView } from '../catalog/types';
import { fixFor, lessonProgress, type Lesson, type LessonGraph, type LessonNode, type Missing } from './engine';
import { isAdultLesson } from './lessons';

/**
 * A finished example graph built from a lesson's own steps.
 *
 * Who uses it: File ▸ Examples and the welcome card's "Open an example" (main/files/examples.ts builds the list and
 * opens one through the same path as File ▸ Open workflow).
 * Why it is built and not shipped: a lesson already says, step by step, which nodes go where, which links join them
 * and which values fields take. Doing every step the way "Do this for me" does, on an empty graph and against the
 * node list read from this ComfyUI, gives a graph that uses only nodes and model files the person has. No example
 * file has to be kept in step with the lessons, and an example never names a node the person cannot open.
 * What only a person can choose is filled plainly: the first model file the field offers and a short neutral prompt.
 * Adult lessons give no example.
 */

/** The prompt an example puts where a lesson asks the person to write one: plain and neutral, in English. */
export const EXAMPLE_PROMPT = 'a quiet lake at dawn, light mist over the water, a small wooden boat, soft morning light';

/** One node of the API form an example becomes: its class and its inputs (a value, or [node id, output index]). */
export interface ExampleApiNode {
  class_type: string;
  inputs: Record<string, unknown>;
}

/** How many single changes an example may take: the longest lesson needs well under a hundred. */
const MAX_CHANGES = 400;

/** The node list as the lesson engine sees one class: ports with ids the example graph can link. */
function nodeOf(id: string, classType: string, catalog: CatalogView): LessonNode | null {
  const spec = catalog.nodes.find((item) => item.classType === classType);
  if (!spec) return null;
  const values: Record<string, unknown> = {};
  for (const input of spec.inputs) {
    if (input.widget && input.default !== undefined) values[input.name] = input.default;
  }
  return {
    id,
    classType,
    // Sockets as the canvas shows them; a field the lesson links to is not a socket and stays a value.
    inputs: spec.inputs.filter((input) => !input.widget).map((input, index) => ({ id: `in-${index}`, name: input.name, type: input.type })),
    outputs: spec.outputs.map((output, index) => ({ id: `out-${index}`, name: output.name, type: output.type })),
    values,
  };
}

/** The value an example puts in a field only a person would fill: a model file, a prompt, a weight. */
function personValue(missing: Extract<Missing, { kind: 'field' }>, graph: LessonGraph, catalog: CatalogView): unknown {
  const node = graph.nodes.find((item) => item.id === missing.nodeId);
  const input = node ? catalog.nodes.find((item) => item.classType === node.classType)?.inputs.find((item) => item.name === missing.field) : undefined;
  const test = missing.test;
  if (test.kind === 'chosen') {
    if (input?.options && input.options.length > 0) return input.options[0];
    return input?.type === 'STRING' ? EXAMPLE_PROMPT : null;
  }
  if (test.kind === 'text') {
    const marks = test.has ?? [];
    let text = marks.length > 0 ? marks.map((mark) => `${mark} ${EXAMPLE_PROMPT}`).join(' ') : EXAMPLE_PROMPT;
    while (text.length < test.minChars) text = `${text}, ${EXAMPLE_PROMPT}`;
    return text;
  }
  if (test.kind === 'weighted') {
    // 1.2 when the lesson allows it; else an end of its range, never 1 (a weight of 1 changes nothing).
    const weight = test.min <= 1.2 && 1.2 <= test.max ? 1.2 : test.min !== 1 ? test.min : test.max;
    return `(light mist:${weight}), ${EXAMPLE_PROMPT}`;
  }
  if (test.kind === 'differs') {
    const taken = missing.other?.value;
    return input?.options?.find((option) => option !== taken) ?? null;
  }
  return null;
}

/**
 * The example graph of a lesson as an API-form prompt, or null when this ComfyUI cannot build it (a class it does
 * not have, a model file it does not have, a step only a person can do) or the lesson is for adults.
 */
export function exampleFromLesson(lesson: Lesson, catalog: CatalogView): Record<string, ExampleApiNode> | null {
  if (isAdultLesson(lesson.id)) return null;
  const graph: LessonGraph = { nodes: [], links: [] };
  // Steps that only explain count as read: an example has no one reading them.
  const read = new Set(lesson.steps.filter((step) => step.read).map((step) => step.id));
  const installed = (classType: string) => catalog.nodes.some((item) => item.classType === classType);
  let next = 1;
  for (let turn = 0; turn < MAX_CHANGES; turn += 1) {
    const progress = lessonProgress(lesson, graph, {}, read);
    if (progress.current >= lesson.steps.length) return toApi(graph);
    const missing = progress.missing[0];
    if (!missing) return null;
    const choices = (nodeId: string, field: string) => {
      const node = graph.nodes.find((item) => item.id === nodeId);
      return node ? catalog.nodes.find((item) => item.classType === node.classType)?.inputs.find((item) => item.name === field)?.options ?? [] : [];
    };
    const fix = fixFor(missing, graph, installed, choices);
    if (fix?.kind === 'add-node') {
      const node = nodeOf(String(next), fix.classType, catalog);
      if (!node) return null;
      next += 1;
      graph.nodes.push(node);
    } else if (fix?.kind === 'connect') {
      // One link per input, as in ComfyUI: a new one replaces what fed the input before.
      graph.links = graph.links.filter((link) => !(link.to === fix.to && link.toPort === fix.toPort));
      graph.links.push({ from: fix.from, fromPort: fix.fromPort, to: fix.to, toPort: fix.toPort });
    } else if (fix?.kind === 'set-field') {
      const node = graph.nodes.find((item) => item.id === fix.nodeId);
      if (!node) return null;
      node.values[fix.field] = fix.value;
    } else if (missing.kind === 'field' && !missing.absent) {
      const value = personValue(missing, graph, catalog);
      const node = graph.nodes.find((item) => item.id === missing.nodeId);
      if (value === null || value === undefined || !node || node.values[missing.field] === value) return null;
      node.values[missing.field] = value;
    } else {
      return null;
    }
  }
  return null;
}

/** The example graph in ComfyUI's API form, which workflow/apiPrompt.ts lays out as a canvas workflow. */
function toApi(graph: LessonGraph): Record<string, ExampleApiNode> {
  const out: Record<string, ExampleApiNode> = {};
  for (const node of graph.nodes) {
    const inputs: Record<string, unknown> = { ...node.values };
    for (const link of graph.links.filter((item) => item.to === node.id)) {
      const from = graph.nodes.find((item) => item.id === link.from);
      const input = node.inputs.find((port) => port.id === link.toPort);
      const index = from ? from.outputs.findIndex((port) => port.id === link.fromPort) : -1;
      if (from && input && index >= 0) inputs[input.name] = [from.id, index];
    }
    out[node.id] = { class_type: node.classType, inputs };
  }
  return out;
}
