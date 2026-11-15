/**
 * "Still to do" in words a person can act on: what is missing, which node it is about (by its part in the lesson
 * when two nodes on the canvas share a name), what exactly is wrong with a file or a text, and why the step asks
 * for the value. Pure apart from the canvas titles and the catalog it is handed.
 *
 * Who uses it: LessonPanel.tsx (the "still to do" list and the hints of a step); tests/unit/lessonLack.test.ts and
 * lessonRoleLabels.test.ts pin the sentences.
 */
import type { TFunction } from 'i18next';
import type { NodeClassDetail } from '../../../shared/contracts/knowledge';
import { familyLabelKey } from '../../../shared/knowledge/labels';
import type { Lesson, LessonFacts, LessonGraph, Missing, Roles } from '../../../shared/lessons/engine';
import { fileMiss } from '../../../shared/lessons/files';
import { lessonReason } from '../../../shared/lessons/texts';
import { weightsOf } from '../../../shared/prompt/inspect';
import { fieldChoices, nodeNameOf, portLabel, titleOnCanvas } from './lessonModel';


/** Catalog details by class; null for a class the catalog does not have. */
type Details = Record<string, NodeClassDetail | null>;

/** What the sentences need besides the lack itself: the catalog, the lesson's view of the canvas, the language. */
export interface LackContext {
  details: Details;
  graph: LessonGraph;
  facts: LessonFacts;
  /** Which node plays which role, as the lesson sees the canvas now. */
  roles: Roles;
  language: string;
  /**
   * The lesson's own labels by role (texts.ts LessonWords.roles), in the person's language. They win over the
   * shared catalog label, which is written for the common meaning of a role's name and reads wrong in a lesson
   * that uses the name for something else.
   */
  roleLabels?: Readonly<Record<string, string>>;
}

/**
 * Nodes of one class that a step lacks, as a person meets them: a similar class on the canvas, what differs, and
 * why this step needs the one it names. Keys of `lessons.similarWhy`.
 */
export const SIMILAR: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  KSampler: { KSamplerAdvanced: 'samplerAdvanced' },
  KSamplerAdvanced: { KSampler: 'samplerPlain' },
  CheckpointLoaderSimple: { UNETLoader: 'unetNotCheckpoint' },
  UNETLoader: { CheckpointLoaderSimple: 'checkpointNotUnet' },
  CLIPLoader: { DualCLIPLoader: 'dualClip' },
};

/** A name and, when another node on the canvas has the same class, the part this one plays in the lesson. */
export function nodeLabel(t: TFunction, nodeId: string, context: LackContext): string {
  const title = titleOnCanvas(nodeId, context.details);
  const node = context.graph.nodes.find((item) => item.id === nodeId);
  if (!node) return title;
  const twins = context.graph.nodes.filter((item) => item.classType === node.classType).length;
  if (twins < 2) return title;
  const role = Object.entries(context.roles).find(([, id]) => id === nodeId)?.[0];
  const own = role ? context.roleLabels?.[role] : undefined;
  if (own) return `${title} (${own})`;
  const key = role ? `lessons.role.${role}` : '';
  const label = key ? String(t(key)) : '';
  // The same form in both languages: the name as the canvas shows it, the part in parentheses.
  return label && label !== key ? `${title} (${label})` : title;
}

/** One sentence about a reason id, without the backticks of the lesson texts. */
function reasonOf(language: string, id: string | undefined): string {
  if (!id) return '';
  const text = lessonReason(language, id);
  return text ? ` ${text.replace(/`/g, '')}` : '';
}

/** A field value as a sentence shows it; an empty value is said in words (lessons.empty). */
function shown(t: TFunction, value: unknown): string {
  if (value === undefined || value === null || value === '') return String(t('lessons.empty'));
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : JSON.stringify(value);
}

/** "word:1.2" written without the parentheses ComfyUI reads a weight in. */
const BARE_WEIGHT = /(?:^|[,;]\s*)([A-Za-z][A-Za-z ]{0,40}?:\d+(?:\.\d+)?)(?=\s*(?:,|;|$))/;
/** The first negation in a prompt ("no hat", "without people"), English or Russian, to quote it back. */
const NEGATION_FOUND = /(?:^|[\s,.;(])((?:no|not|without|never|don't|нет|без|не)\s+[A-Za-zЀ-ӿ]+)/i;

/** The sentence for a model file field that holds no file, or a file of the wrong kind or family. */
function fileText(t: TFunction, missing: Extract<Missing, { kind: 'field' }>, node: string, context: LackContext): string {
  if (missing.test.kind !== 'file') return '';
  const want = missing.test.want;
  const value = shown(t, missing.value);
  const why = missing.why?.kind === 'file' ? missing.why.miss : null;
  const problem = !why
    ? ''
    : why.kind === 'family'
      ? String(t('lessons.fileFamily', { family: String(t(familyLabelKey(why.family))) }))
      : why.kind === 'mark'
        ? String(t('lessons.fileMark', { marks: why.marks.join(', ') }))
        : String(t('lessons.fileNotMark', { mark: why.mark }));
  const kind = want.words ? String(t('lessons.fileNamed', { words: want.words.join(', ') })) : String(t(`lessons.fileKind.${want.kind}`));
  let text = typeof missing.value === 'string' && missing.value !== ''
    ? String(t('lessons.lackFile', { field: missing.field, node, value, problem, kind }))
    : `${String(t('lessons.lackChosen', { field: missing.field, node }))} ${kind}.`;
  // When the list holds no file of this kind, say so before the person looks for it.
  const choices = fieldChoices(context.graph, context.details, missing.nodeId, missing.field);
  if (choices.length > 0 && !choices.some((option) => typeof option === 'string' && fileMiss(option, want, context.facts.families?.[option]) === null)) {
    text = `${text} ${String(t('lessons.fileNone'))}`;
  }
  return text;
}

/** What a step lacks, as one sentence. */
export function lackText(t: TFunction, missing: Missing, lesson: Lesson, context: LackContext): string {
  const { details, graph, facts } = context;
  if (missing.kind === 'node') {
    const name = nodeNameOf(lesson, missing.role, details) ?? missing.classes[0];
    const taken = new Set(Object.values(context.roles));
    for (const wanted of missing.classes) {
      for (const [found, why] of Object.entries(SIMILAR[wanted] ?? {})) {
        const near = graph.nodes.find((node) => node.classType === found && !taken.has(node.id));
        if (near) return String(t('lessons.lackSimilar', { found: titleOnCanvas(near.id, details), wanted: name, why: String(t(`lessons.similarWhy.${why}`)) }));
      }
    }
    const some = graph.nodes.some((node) => missing.classes.includes(node.classType));
    return String(some ? t('lessons.lackNodeMore', { name }) : t('lessons.lackNode', { name }));
  }
  if (missing.kind === 'link') {
    const from = nodeLabel(t, missing.from.nodeId, context);
    const to = nodeLabel(t, missing.to.nodeId, context);
    if (missing.absent === 'input') return String(t('lessons.lackPort', { node: to, port: missing.input }));
    if (missing.absent === 'output') return String(t('lessons.lackPort', { node: from, port: missing.output }));
    const output = portLabel(graph, missing.from.nodeId, 'output', missing.output);
    return missing.fedBy && missing.fedBy !== missing.from.nodeId
      ? String(t('lessons.lackLinkWrong', { input: missing.input, to, other: nodeLabel(t, missing.fedBy, context), output, from }))
      : String(t('lessons.lackLink', { input: missing.input, to, output, from }));
  }
  const node = nodeLabel(t, missing.nodeId, context);
  const field = missing.field;
  if (missing.absent) return String(t('lessons.lackField', { node, field }));
  const value = shown(t, missing.value);
  const other = missing.other ? nodeLabel(t, missing.other.nodeId, context) : '';
  const why = reasonOf(context.language, missing.reason);
  switch (missing.test.kind) {
    case 'chosen':
      return String(t('lessons.lackChosen', { field, node }));
    case 'file':
      return fileText(t, missing, node, context);
    case 'equals':
      return String(t('lessons.lackEquals', { field, node, value, wanted: String(missing.test.value) })) + why;
    case 'between':
      if (missing.why?.kind === 'frames') return String(t('lessons.lackFrames', { field, node, value }));
      if (missing.untouched && missing.test.prefer !== undefined) return String(t('lessons.lackUntouched', { field, node, value, wanted: missing.test.prefer })) + why;
      return String(t('lessons.lackBetween', { field, node, value, min: missing.test.min, max: missing.test.max })) + (missing.test.prefer !== undefined ? ` ${String(t('lessons.prefer', { wanted: missing.test.prefer }))}` : '') + why;
    case 'sameFamily': {
      const family = missing.why?.kind === 'family' ? missing.why : null;
      if (!family) return String(t('lessons.lackChosen', { field, node }));
      return String(t('lessons.lackSameFamily', { field, node, value, family: String(t(familyLabelKey(family.family))), other, otherFamily: String(t(familyLabelKey(family.other))) })) + why;
    }
    case 'less':
      return String(t('lessons.lackLess', { field, node, value, otherField: missing.test.field, other: shown(t, missing.other?.value) })) + why;
    case 'size': {
      const self = graph.nodes.find((item) => item.id === missing.nodeId)?.values ?? {};
      const family = missing.why?.kind === 'size' ? missing.why.family : 'unknown';
      return String(t('lessons.lackSize', {
        width: shown(t, self.width),
        height: shown(t, self.height),
        family: String(t(familyLabelKey(family))),
        trained: String(t(family === 'sd15' ? 'lessons.trainedSd15' : 'lessons.trainedSdxl')),
      }));
    }
    case 'aspect': {
      const self = graph.nodes.find((item) => item.id === missing.nodeId)?.values ?? {};
      const clip = graph.nodes.find((item) => item.id === missing.other?.nodeId)?.values ?? {};
      return String(t('lessons.lackAspect', { node, width: shown(t, self.width), height: shown(t, self.height), other, otherWidth: shown(t, clip.width), otherHeight: shown(t, clip.height) })) + why;
    }
    case 'text': {
      const text = typeof missing.value === 'string' ? missing.value : '';
      const chars = text.trim().length;
      const miss = missing.why?.kind === 'text' ? missing.why.miss : chars > 0 ? 'short' : null;
      if (miss === 'marks') {
        const marks = (missing.test.has ?? []).filter((mark) => !text.includes(mark));
        return String(t('lessons.lackTextMark', { field, node, marks: marks.join(' ') }));
      }
      if (miss === 'words') return String(t('lessons.lackTextWords', { field, node }));
      if (miss === 'english') return String(t('lessons.lackTextEnglish', { field, node }));
      if (miss === 'copy') return String(t('lessons.lackTextCopy', { field, node }));
      if (miss === 'negation') return String(t('lessons.lackTextNegation', { field, node, found: NEGATION_FOUND.exec(text)?.[1] ?? '' }));
      return String(chars > 0 ? t('lessons.lackTextShort', { field, node, chars, min: missing.test.minChars }) : t('lessons.lackText', { field, node }));
    }
    case 'weighted': {
      const { min, max } = missing.test;
      const text = typeof missing.value === 'string' ? missing.value : '';
      const high = weightsOf(text).find((item) => item.weight > max);
      if (high) return String(t('lessons.lackWeightedHigh', { field, node, found: high.raw, min, max }));
      const bare = BARE_WEIGHT.exec(text);
      if (bare) return String(t('lessons.lackWeightBrackets', { found: bare[1].trim() }));
      return String(t('lessons.lackWeighted', { field, node, min, max }));
    }
    case 'has-trigger': {
      const words = new Set<string>();
      for (const source of missing.test.of) {
        const classes = 'role' in source
          ? lesson.steps.flatMap((step) => step.roles ?? []).find((spec) => spec.role === source.role)?.classes ?? []
          : [source.classType];
        for (const item of graph.nodes) {
          if (!classes.includes(item.classType)) continue;
          const file = item.values[source.field];
          if (typeof file === 'string') for (const word of facts.triggers?.[file] ?? []) words.add(word);
        }
      }
      return String(t('lessons.lackTrigger', { node, words: [...words].slice(0, 8) }));
    }
    case 'differs': {
      if (missing.test.kind !== 'differs') return '';
      if (missing.other && missing.other.nodeId === missing.nodeId) return String(t('lessons.lackDiffersField', { field, node, otherField: missing.test.field }));
      // A setting such as a scheduler or a file name prefix is not a file: the sentence says "value", not "file".
      if (!/\.[a-z0-9]{2,12}$/i.test(String(missing.value ?? ''))) return String(t('lessons.lackDiffersValue', { field, node, other }));
      return String(t('lessons.lackDiffers', { field, node, other }));
    }
    case 'same':
      return String(t('lessons.lackSame', { field, node, value, wanted: shown(t, missing.other?.value), other })) + why;
  }
}

/**
 * Everything a step lacks, one sentence each. Two nodes of one class that are both missing are one sentence with
 * their number; two links that each come from where the other should is one sentence: they are swapped.
 */
export function lackLines(t: TFunction, missing: Missing[], lesson: Lesson, context: LackContext): Array<{ text: string; times: number }> {
  const wanted = new Map<string, number>();
  for (const item of missing) {
    if (item.kind === 'node') wanted.set(item.classes.join('|'), (wanted.get(item.classes.join('|')) ?? 0) + 1);
  }
  const lines: string[] = [];
  const said = new Set<string>();
  const swapped = new Set<Missing>();
  for (const item of missing) {
    if (item.kind !== 'link' || swapped.has(item) || !item.fedBy) continue;
    const pair = missing.find((other) => other !== item && other.kind === 'link' && other.to.nodeId === item.to.nodeId
      && other.fedBy === item.from.nodeId && item.fedBy === other.from.nodeId);
    if (!pair || pair.kind !== 'link') continue;
    swapped.add(item);
    swapped.add(pair);
    lines.push(String(t('lessons.lackSwapped', {
      input: item.input,
      otherInput: pair.input,
      to: nodeLabel(t, item.to.nodeId, context),
      fromNow: nodeTextOf(context, item.fedBy),
      otherNow: nodeTextOf(context, pair.fedBy ?? ''),
    })));
  }
  for (const item of missing) {
    if (swapped.has(item)) continue;
    if (item.kind !== 'node') {
      lines.push(lackText(t, item, lesson, context));
      continue;
    }
    const key = item.classes.join('|');
    if (said.has(key)) continue;
    said.add(key);
    const count = wanted.get(key) ?? 1;
    if (count === 1) {
      lines.push(lackText(t, item, lesson, context));
      continue;
    }
    const name = nodeNameOf(lesson, item.role, context.details) ?? item.classes[0];
    const some = context.graph.nodes.some((node) => item.classes.includes(node.classType));
    lines.push(String(some ? t('lessons.lackNodesMore', { name, count }) : t('lessons.lackNodesNone', { name, count })));
  }
  // Two nodes of one name lack the same thing in the same words: said once, with how many times it is to be done.
  const times = new Map<string, number>();
  for (const line of lines) times.set(line, (times.get(line) ?? 0) + 1);
  return [...times].map(([text, count]) => ({ text, times: count }));
}

/** What a text node holds, short, so a person knows which of two alike nodes is meant. */
function nodeTextOf(context: LackContext, nodeId: string): string {
  const node = context.graph.nodes.find((item) => item.id === nodeId);
  const text = node ? Object.values(node.values).find((value): value is string => typeof value === 'string' && value.trim().length > 0) : undefined;
  const title = titleOnCanvas(nodeId, context.details);
  if (!text) return title;
  const short = text.trim().length > 32 ? `${text.trim().slice(0, 30)}…` : text.trim();
  return `${title}: ${short}`;
}
