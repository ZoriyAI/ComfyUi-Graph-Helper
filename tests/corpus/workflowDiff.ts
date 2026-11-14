/**
 * Semantic diff between a ComfyUI workflow before and after it went through the app.
 *
 * Normalisations that are NOT reported (they cannot change what ComfyUI opens):
 * - key order inside objects;
 * - number spelling (1.0 and 1 are the same value once parsed);
 * - whitespace and indentation of the file.
 *
 * Everything else is reported as a Difference with a class. A class is the generalised path
 * (array indexes replaced by []) plus the kind of change. ACCEPTABLE_CLASSES lists the classes
 * that are deliberate and harmless, with the reason. Every other class counts as loss.
 */

export type DifferenceKind = 'missing' | 'added' | 'changed' | 'length';

export interface Difference {
  path: string;
  kind: DifferenceKind;
  cls: string;
  before?: unknown;
  after?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Containers whose inner structure is one class: a change anywhere inside counts once. */
const COLLAPSE_AFTER = [
  /^(.*\.)?nodes\[\]\.widgets_values/,
  /^(.*\.)?nodes\[\]\.properties\.[^.[]+/,
  /^extra\.[^.[]+/,
  /^(.*\.)?groups\[\]\.[^.[]+/,
  /^(.*\.)?config/,
];

export function classPath(path: string): string {
  const general = path.replace(/\[\d+\]/g, '[]');
  for (const pattern of COLLAPSE_AFTER) {
    const match = pattern.exec(general);
    if (match) return match[0];
  }
  return general;
}

export function diffJson(before: unknown, after: unknown, path = '', out: Difference[] = []): Difference[] {
  if (Object.is(before, after)) return out;
  if (typeof before === 'number' && typeof after === 'number' && before === after) return out;
  const push = (kind: DifferenceKind, at: string, a?: unknown, b?: unknown) => {
    out.push({ path: at, kind, cls: `${kind} ${classPath(at) || '(root)'}`, before: a, after: b });
  };
  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.length !== after.length) push('length', path, before.length, after.length);
    const shared = Math.min(before.length, after.length);
    for (let index = 0; index < shared; index += 1) diffJson(before[index], after[index], `${path}[${index}]`, out);
    return out;
  }
  if (isRecord(before) && isRecord(after)) {
    for (const key of Object.keys(before)) {
      const child = path ? `${path}.${key}` : key;
      if (!(key in after)) push('missing', child, before[key], undefined);
      else diffJson(before[key], after[key], child, out);
    }
    for (const key of Object.keys(after)) {
      if (!(key in before)) push('added', path ? `${path}.${key}` : key, undefined, after[key]);
    }
    return out;
  }
  push('changed', path, before, after);
  return out;
}

/** Classes that are deliberate and harmless. Key: class string. Value: why it is acceptable. */
export const ACCEPTABLE_CLASSES: Record<string, string> = {
  'changed extra.info': 'extra.info.modified is set to the export time, as ComfyUI does on save.',
  'added version': 'A legacy file with no version is written as 0.4, the format ComfyUI writes.',
  'added links': 'A legacy file with no links array gets an empty one (0.4 requires it).',
  'added last_node_id': 'A legacy file with no counters gets them (0.4 requires them).',
  'added last_link_id': 'A legacy file with no counters gets them (0.4 requires them).',
  'added nodes[].pos': 'A node with no position gets [0, 0], where ComfyUI would place it.',
};

/** Id counters may only go up: ComfyUI raises them to the highest id on load too. */
const RAISED_COUNTERS = new Set([
  'changed last_node_id',
  'changed last_link_id',
  'changed state.lastNodeId',
  'changed state.lastLinkId',
  'changed definitions.subgraphs[].state.lastNodeId',
  'changed definitions.subgraphs[].state.lastLinkId',
]);

export function isAcceptable(difference: Difference): boolean {
  if (RAISED_COUNTERS.has(difference.cls)) {
    return typeof difference.before === 'number' && typeof difference.after === 'number' && difference.after > difference.before;
  }
  return difference.cls in ACCEPTABLE_CLASSES;
}

export function lossOnly(differences: Difference[]): Difference[] {
  return differences.filter((difference) => !isAcceptable(difference));
}

export function short(value: unknown, limit = 160): string {
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch {
    text = String(value);
  }
  if (text === undefined) return 'undefined';
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}
