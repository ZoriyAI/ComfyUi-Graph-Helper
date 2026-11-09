import type { Explanation, Provenance } from '../../../../shared/contracts/knowledge';

/** Where the text of a description card comes from, in priority order. */
export type DescriptionScope = 'node' | 'nodeClass' | 'catalog' | 'component';

export interface DescriptionPart {
  text: string;
  provenance: Provenance;
  /** The aspect the text answers; catalog and component text count as "what". */
  aspect: 'what' | 'why';
}

/** What a description card shows: the "what" line (or "why" alone), and a "why" when there is one. */
export interface DescriptionContent {
  scope: DescriptionScope;
  /** The first thing the card says; its provenance is the card's badge. */
  primary: DescriptionPart;
  /** A "why" shown under the primary text when the card is expanded (never the same record as primary). */
  why: DescriptionPart | null;
  /** True when the text comes from an explanation (node or class), so "Ask" is not offered. */
  explained: boolean;
}

export interface DescriptionSources {
  /** Explanations whose owner is the node itself (newest last, as listExplanations returns them). */
  own?: Explanation[];
  /** Explanations whose owner is the node's class. */
  shared?: Explanation[];
  /** The catalog description of the class (object_info). */
  catalog?: string | null;
  /** The component record purpose written for the node. */
  purpose?: string | null;
}

function newest(list: Explanation[], aspect: 'what' | 'why'): Explanation | undefined {
  let found: Explanation | undefined;
  for (const item of list) {
    if (item.aspect !== aspect || item.text.trim() === '') continue;
    if (!found || item.createdAt >= found.createdAt) found = item;
  }
  return found;
}

function fromExplanations(list: Explanation[] | undefined, scope: 'node' | 'nodeClass'): DescriptionContent | null {
  if (!list || list.length === 0) return null;
  const what = newest(list, 'what');
  const why = newest(list, 'why');
  const head = what ?? why;
  if (!head) return null;
  const part = (item: Explanation): DescriptionPart => ({ text: item.text.trim(), provenance: item.provenance, aspect: item.aspect === 'why' ? 'why' : 'what' });
  return { scope, primary: part(head), why: what && why ? part(why) : null, explained: true };
}

/**
 * The content priority of a description card:
 * 1. explanations owned by the node (newest "what", then newest "why"),
 * 2. explanations owned by the node's class (same rule),
 * 3. the catalog description of the class (a fact from object_info),
 * 4. the component record purpose (project documentation; its author is not recorded, so it reads as an inference).
 * Returns null when nothing is known, and the canvas shows no card for the node.
 */
export function selectDescription(sources: DescriptionSources): DescriptionContent | null {
  const own = fromExplanations(sources.own, 'node');
  if (own) return own;
  const shared = fromExplanations(sources.shared, 'nodeClass');
  if (shared) return shared;
  const catalog = sources.catalog?.trim();
  if (catalog) return { scope: 'catalog', primary: { text: catalog, provenance: 'fact', aspect: 'what' }, why: null, explained: false };
  const purpose = sources.purpose?.trim();
  if (purpose) return { scope: 'component', primary: { text: purpose, provenance: 'inference', aspect: 'what' }, why: null, explained: false };
  return null;
}

/** The first line of a text, for the collapsed card. */
export function firstLine(text: string): string {
  const line = text.split(/\r?\n/).find((item) => item.trim() !== '') ?? '';
  return line.trim();
}
