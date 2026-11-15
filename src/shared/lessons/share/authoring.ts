/**
 * "Make a lesson from this graph": the graph on the canvas becomes the goal, and the app proposes the steps that
 * build it from an empty canvas, in the order a person builds: a node only after every node that feeds it, each
 * step adding one node with the links into it and the values that matter. The person then edits the title, the
 * words of each step and which values matter (the lesson editor in the Lessons panel), tries the lesson and saves it.
 *
 * Who uses it: the lesson editor (src/renderer/components/lessons/LessonEditor.tsx) and the assistant's draft tool
 * when it drafts from the current graph.
 *
 * A lesson being edited keeps the steps a person answers (a checklist, a rubric, a quiz, a read-check) and its
 * metadata as they are; the editor can also add a checklist step of its own ("a self-check": things to do outside the
 * app, one item per line).
 *
 * Why steps are derived this way: it is how the engine tests rebuild every built-in lesson from an empty canvas
 * (add the node, make the link, set the field), so a lesson made here asks for exactly what "Do this for me" and a
 * person can do. Pure: no DOM, no catalog access of its own; the caller says what it knows of each class.
 */

import type { FieldSpec, FieldTest, LessonGraph, LessonNode, LessonStep, LinkSpec } from '../engine';
import type { StepWords } from '../texts';
import { STEP_CAPS } from '../schema';
import { LESSON_LIMITS, type LessonDoc, type LessonDocWords } from './format';

/** What the caller knows of a class: the name the library shows, and the kind of each field. */
export interface ClassInfo {
  displayName: string;
  /** Field kinds by input name ('combo', 'int', 'float', 'string', 'boolean', 'other'); a field not listed is not a widget. */
  fields: Record<string, { kind: string; multiline?: boolean; modelDirectory?: string }>;
}

/** One step being written: the checks it makes, the values that may matter (on or off), and its words. */
export interface DraftStep {
  id: string;
  read?: true;
  roles: Array<{ role: string; classes: string[] }>;
  links: LinkSpec[];
  /** Every value of the node that could be a rule, and whether the person wants it to matter. */
  fields: Array<{ spec: FieldSpec; on: boolean }>;
  title: string;
  body: string;
  /** A step the person answers, kept as it is: its checklist, rubric, quiz or read-check, and a transfer mark. */
  extra?: Pick<LessonStep, 'checklist' | 'rubric' | 'quiz' | 'readCheck' | 'transfer'>;
  /** The words of its items, criteria or questions, in the editor's language. */
  extraWords?: Pick<StepWords, 'items' | 'criteria' | 'questions'>;
}

/** A lesson being written in the editor, in one language. */
export interface LessonDraftModel {
  id: string;
  language: 'en' | 'ru';
  title: string;
  result: string;
  adult: boolean;
  steps: DraftStep[];
  /** Kept from a lesson being edited, so saving changes only what the editor shows. */
  keep?: Pick<LessonDoc, 'group' | 'follows' | 'continues' | 'author' | 'source' | 'needs' | 'standard' | 'outcomes' | 'level' | 'tracks' | 'priority' | 'meta'>;
  /** The template's words of the lesson being edited (skill, mistakes...), in the editor's language. */
  metaWords?: LessonDocWords['meta'];
}

/** The most nodes a graph may have to become a lesson: one step per node, under the step cap. */
export const AUTHOR_MAX_NODES = LESSON_LIMITS.steps - 2;

const MODEL_FILE = /\.(?:safetensors|ckpt|pt|pth|bin|gguf|onnx|sft)$/i;

const WORDS = {
  en: {
    introTitle: 'What this lesson builds',
    introBody: 'In this lesson you build the graph step by step. Each step says what to add and why.',
    addTitle: (role: string) => `Add {${role}}`,
    addBody: (role: string) => `Add a {${role}} node to the canvas.`,
    link: (from: string, output: string, input: string) => `Connect the \`${output}\` output of {${from}} to its \`${input}\` input.`,
    chosen: (field: string) => `Choose a file in \`${field}\`.`,
    text: (field: string) => `Write a text in \`${field}\`.`,
    equals: (field: string, value: string) => `Set \`${field}\` to ${value}.`,
  },
  ru: {
    introTitle: 'Что строит этот урок',
    introBody: 'В этом уроке вы шаг за шагом собираете граф. Каждый шаг говорит, что добавить и зачем.',
    addTitle: (role: string) => `Добавьте {${role}}`,
    addBody: (role: string) => `Добавьте на холст ноду {${role}}.`,
    link: (from: string, output: string, input: string) => `Соедините выход \`${output}\` у {${from}} с её входом \`${input}\`.`,
    chosen: (field: string) => `Выберите файл в поле \`${field}\`.`,
    text: (field: string) => `Напишите текст в поле \`${field}\`.`,
    equals: (field: string, value: string) => `Поставьте в поле \`${field}\` значение ${value}.`,
  },
} as const;

/** A role name from a class: letters and digits, starting with a lower-case letter ("CLIPTextEncode" → "clipTextEncode"). */
export function roleNameOf(classType: string): string {
  const letters = classType.replace(/[^A-Za-z0-9]/g, '').replace(/^[0-9]+/, '') || 'node';
  const head = /^[A-Z]+(?=[A-Z][a-z])|^[A-Z]+$|^[A-Z]/.exec(letters)?.[0] ?? '';
  return `${head.toLowerCase()}${letters.slice(head.length)}`.slice(0, LESSON_LIMITS.role - 4) || 'node';
}

/** Nodes in an order a person can build them in: each after every node that feeds it; otherwise as on the canvas. */
export function buildOrder(graph: LessonGraph): LessonNode[] {
  const placed = new Set<string>();
  const out: LessonNode[] = [];
  const feeders = new Map(graph.nodes.map((node) => [node.id, new Set(graph.links.filter((link) => link.to === node.id && link.from !== node.id).map((link) => link.from))]));
  while (out.length < graph.nodes.length) {
    const next = graph.nodes.find((node) => !placed.has(node.id) && [...(feeders.get(node.id) ?? [])].every((id) => placed.has(id) || !feeders.has(id)))
      // A loop (not possible in ComfyUI, but a file may hold one): the first node left goes next.
      ?? graph.nodes.find((node) => !placed.has(node.id))!;
    placed.add(next.id);
    out.push(next);
  }
  return out;
}

function shown(value: unknown): string {
  return typeof value === 'string' ? `\`${value.slice(0, 80)}\`` : String(value);
}

/** The rule a value could become, and whether it matters by default: a model file chosen, a text written; numbers only when the person says so. */
function candidate(role: string, field: string, value: unknown, info: ClassInfo['fields'][string] | undefined): { spec: FieldSpec; on: boolean } | null {
  if (value === undefined || value === null || value === '') return null;
  const kind = info?.kind ?? typeof value;
  if (typeof value === 'string' && (info?.modelDirectory || MODEL_FILE.test(value))) return { spec: { role, field, test: { kind: 'chosen' } }, on: true };
  if (typeof value === 'string' && (kind === 'string' || info?.multiline)) {
    const length = value.trim().length;
    return length > 0 ? { spec: { role, field, test: { kind: 'text', minChars: Math.min(10, length) } }, on: info?.multiline === true } : null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (typeof value === 'string' && value.length > LESSON_LIMITS.value) return null;
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    return { spec: { role, field, test: { kind: 'equals', value } }, on: false };
  }
  return null;
}

/** The words of one step from its checks, in the editor's language. */
export function stepWords(language: 'en' | 'ru', role: string, links: LinkSpec[], fields: FieldSpec[]): { title: string; body: string } {
  const words = WORDS[language];
  const lines = [words.addBody(role), ...links.map((link) => words.link(link.from, link.output, link.input))];
  for (const spec of fields) {
    if (spec.test.kind === 'chosen') lines.push(words.chosen(spec.field));
    else if (spec.test.kind === 'text') lines.push(words.text(spec.field));
    else if (spec.test.kind === 'equals') lines.push(words.equals(spec.field, shown(spec.test.value)));
  }
  return { title: words.addTitle(role), body: lines.join('\n\n') };
}

/**
 * The proposed lesson for a graph: a step that explains, then one step per node in build order. Null when the graph
 * is empty or larger than a lesson can be.
 */
export function draftFromGraph(graph: LessonGraph, infoOf: (classType: string) => ClassInfo | null, language: 'en' | 'ru', id = 'my-lesson'): LessonDraftModel | null {
  if (graph.nodes.length === 0 || graph.nodes.length > AUTHOR_MAX_NODES) return null;
  const order = buildOrder(graph);
  const roles = new Map<string, string>();
  const used = new Set<string>();
  for (const node of order) {
    const base = roleNameOf(node.classType);
    let name = base;
    for (let index = 2; used.has(name); index += 1) name = `${base}${index}`;
    used.add(name);
    roles.set(node.id, name);
  }
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const words = WORDS[language];
  const steps: DraftStep[] = [{ id: 'intro', read: true, roles: [], links: [], fields: [], title: words.introTitle, body: words.introBody }];
  order.forEach((node, index) => {
    const role = roles.get(node.id)!;
    const info = infoOf(node.classType);
    const links: LinkSpec[] = [];
    for (const link of graph.links.filter((item) => item.to === node.id)) {
      const from = byId.get(link.from);
      const output = from?.outputs.find((port) => port.id === link.fromPort);
      const input = node.inputs.find((port) => port.id === link.toPort);
      if (!from || !output || !input || !roles.has(from.id) || from.id === node.id) continue;
      links.push({ from: roles.get(from.id)!, output: output.name, to: role, input: input.name });
    }
    const linked = new Set(links.map((link) => link.input.toLowerCase()));
    const fields = Object.entries(node.values)
      .filter(([field]) => !linked.has(field.toLowerCase()) && (!info || field in info.fields))
      .map(([field, value]) => candidate(role, field, value, info?.fields[field]))
      .filter((item): item is { spec: FieldSpec; on: boolean } => item !== null);
    const text = stepWords(language, role, links, fields.filter((item) => item.on).map((item) => item.spec));
    steps.push({ id: `step-${index + 1}`, roles: [{ role, classes: [node.classType] }], links, fields, title: text.title, body: text.body });
  });
  return { id, language, title: '', result: '', adult: false, steps };
}

/** A lesson being edited, from one of "My lessons": every rule it has matters. */
export function draftFromDoc(doc: LessonDoc, language: 'en' | 'ru'): LessonDraftModel {
  const words = doc.texts[language] ?? doc.texts.en ?? doc.texts.ru!;
  return {
    id: doc.id,
    language: doc.texts[language] ? language : doc.texts.en ? 'en' : 'ru',
    title: words.title,
    result: words.result,
    adult: doc.adult === true,
    steps: doc.steps.map((step) => {
      const said = words.steps[step.id];
      const extra = JSON.parse(JSON.stringify({ checklist: step.checklist, rubric: step.rubric, quiz: step.quiz, readCheck: step.readCheck, transfer: step.transfer })) as DraftStep['extra'];
      const extraWords = JSON.parse(JSON.stringify({ items: said?.items, criteria: said?.criteria, questions: said?.questions })) as DraftStep['extraWords'];
      return {
        id: step.id,
        ...(step.read ? { read: true as const } : {}),
        roles: (step.roles ?? []).map((spec) => ({ role: spec.role, classes: [...spec.classes] })),
        links: (step.links ?? []).map((spec) => ({ ...spec })),
        fields: (step.fields ?? []).map((spec) => ({ spec: { ...spec, test: { ...spec.test } as FieldTest }, on: true })),
        title: said?.title ?? step.id,
        body: said?.body ?? '',
        ...(extra && Object.keys(extra).length > 0 ? { extra } : {}),
        ...(extraWords && Object.keys(extraWords).length > 0 ? { extraWords } : {}),
      };
    }),
    keep: {
      group: doc.group, follows: doc.follows, continues: doc.continues, author: doc.author, source: doc.source, needs: doc.needs,
      standard: doc.standard, outcomes: doc.outcomes, level: doc.level, tracks: doc.tracks, priority: doc.priority, meta: doc.meta,
    },
    ...(words.meta ? { metaWords: JSON.parse(JSON.stringify(words.meta)) as LessonDocWords['meta'] } : {}),
  };
}

/** The lesson document the editor saves: only the values that matter become rules. */
export function docFromDraft(model: LessonDraftModel): LessonDoc {
  const keep = Object.fromEntries(Object.entries(model.keep ?? {}).filter(([, value]) => value !== undefined)) as LessonDraftModel['keep'];
  return {
    id: model.id,
    ...keep,
    ...(model.adult ? { adult: true } : {}),
    texts: {
      [model.language]: {
        title: model.title.trim(),
        result: model.result.trim(),
        steps: Object.fromEntries(model.steps.map((step) => [step.id, { title: step.title.trim(), body: step.body, ...(step.extraWords ?? {}) }])),
        ...(model.metaWords ? { meta: model.metaWords } : {}),
      },
    },
    steps: model.steps.map((step) => {
      const fields = step.fields.filter((item) => item.on).map((item) => item.spec);
      return {
        id: step.id,
        ...(step.read ? { read: true as const } : {}),
        ...(step.roles.length > 0 ? { roles: step.roles } : {}),
        ...(step.links.length > 0 ? { links: step.links } : {}),
        ...(fields.length > 0 ? { fields } : {}),
        ...(step.extra ?? {}),
      };
    }),
  };
}

/**
 * A checklist step from lines of text, one item per line (empty lines left out, at most STEP_CAPS.items): things the
 * person does outside the app and ticks. Used by the editor's "Add a self-check".
 */
export function checklistStep(id: string, title: string, body: string, lines: readonly string[]): DraftStep {
  const labels = lines.map((line) => line.trim().slice(0, LESSON_LIMITS.line)).filter((line) => line !== '').slice(0, STEP_CAPS.items);
  const items = labels.map((_label, index) => ({ id: `item-${index + 1}` }));
  return {
    id,
    roles: [],
    links: [],
    fields: [],
    title,
    body,
    extra: { checklist: items },
    extraWords: { items: Object.fromEntries(labels.map((label, index) => [`item-${index + 1}`, { label }])) },
  };
}

/** The lines of a checklist step being edited, one item per line, in the order of its items. */
export function checklistLines(step: DraftStep): string[] {
  return (step.extra?.checklist ?? []).map((item) => step.extraWords?.items?.[item.id]?.label ?? '');
}

/** A lesson id from a title: Latin letters and digits joined by hyphens, else one made from the time. */
export function lessonIdFrom(title: string, now = Date.now()): string {
  const slug = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '');
  return slug || `lesson-${now.toString(36)}`;
}
