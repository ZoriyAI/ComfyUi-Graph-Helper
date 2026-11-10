import type { Explanation, Provenance } from '../../../../shared/contracts/knowledge';
import { DESCRIPTION_MODES, type DescriptionsMode } from '../../../../shared/config/preferences';

export { DESCRIPTION_MODES, descriptionsModeOf, type DescriptionsMode } from '../../../../shared/config/preferences';

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
export function selectDescription(sources: DescriptionSources, options: { preferOwn?: boolean } = {}): DescriptionContent | null {
  const own = fromExplanations(sources.own, 'node');
  if (own) return own;
  const purpose = sources.purpose?.trim();
  const component: DescriptionContent | null = purpose
    ? { scope: 'component', primary: { text: purpose, provenance: 'inference', aspect: 'what' }, why: null, explained: false }
    : null;
  // In "own" mode what the project wrote for this node (its component purpose) speaks before class knowledge,
  // so the card that is always on shows the node's own text and does not change on hover.
  if (options.preferOwn && component) return component;
  const shared = fromExplanations(sources.shared, 'nodeClass');
  if (shared) return shared;
  const catalog = sources.catalog?.trim();
  if (catalog) return { scope: 'catalog', primary: { text: catalog, provenance: 'fact', aspect: 'what' }, why: null, explained: false };
  return component;
}

/** True when the text belongs to this node (its own explanation or its component purpose), not to its class. */
export function ownsDescription(content: DescriptionContent | null): boolean {
  return content?.scope === 'node' || content?.scope === 'component';
}

/** The toolbar cycle: own → all → off → own. */
export function nextDescriptionsMode(mode: DescriptionsMode): DescriptionsMode {
  return DESCRIPTION_MODES[(DESCRIPTION_MODES.indexOf(mode) + 1) % DESCRIPTION_MODES.length];
}

/** Why a card is asked for right now, whatever the mode says about cards that are always on. */
export interface DescriptionDemand {
  selected?: boolean;
  /** The pointer rested on the node (or its card) for the hover delay. */
  hovered?: boolean;
  /** The node has keyboard focus. */
  focused?: boolean;
  /** The node is the current tour step. */
  tour?: boolean;
  /** The live build just revealed the node. */
  revealed?: boolean;
  /** The person expanded the card (or opened it from its dot). */
  pinned?: boolean;
  editing?: boolean;
}

export function demanded(demand: DescriptionDemand): boolean {
  return Boolean(demand.selected || demand.hovered || demand.focused || demand.tour || demand.revealed || demand.pinned || demand.editing);
}

/**
 * What a node shows under it:
 * - 'card' — the description card;
 * - 'dot' — a small knowledge dot ("there is something to read"; a click opens the card);
 * - 'none' — nothing (nothing is known about the node).
 * all: a card wherever there is content. own: a card for the node's own text; class knowledge (seeds, class
 * explanations, the catalog) only on demand, a dot otherwise. off: dots only, except a card the person opened
 * from its dot or is editing. A tour step without any content still gets a card for its text (except off,
 * where the tour's own callout speaks).
 */
export function descriptionVisibility(input: {
  mode: DescriptionsMode;
  content: DescriptionContent | null;
  demand: DescriptionDemand;
  /** The tour has text for the node even when nothing is stored. */
  fallback?: boolean;
}): 'card' | 'dot' | 'none' {
  const { mode, content, demand } = input;
  if (demand.editing) return 'card';
  if (!content) return mode !== 'off' && demand.tour && input.fallback ? 'card' : 'none';
  if (mode === 'off') return demand.pinned ? 'card' : 'dot';
  if (mode === 'all') return 'card';
  return ownsDescription(content) || demanded(demand) ? 'card' : 'dot';
}

/** A rectangle in flow coordinates. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CardSide = 'bottom' | 'right' | 'left' | 'top';

/** Where a card goes: a side of its node, full or compact (one truncated line); null means "only a dot". */
export interface CardPlacement {
  side: CardSide;
  compact: boolean;
  /** True when no free place was found and this is the least covering one (only for a card that was asked for). */
  covers?: boolean;
}

/**
 * A card is drawn at the canvas zoom, like the node it belongs to, between these limits: under the lower one the
 * canvas is a map of named blocks and cards are dots; over the upper one a card would only get bigger, not clearer.
 */
export const CARD_MIN_SCALE = 0.55;
export const CARD_MAX_SCALE = 1.25;
/** A card the person asked for (a hover, a selection, the tour, an edit) is never drawn smaller than this. */
export const CARD_READABLE_SCALE = 0.9;

/**
 * How large a card is drawn at a canvas zoom. A card nobody asked for follows the zoom, so it covers the same
 * part of the graph at every zoom and the room the layout left under its node stays enough for it. A card the
 * person asked for stays readable when the canvas is small.
 */
export function cardScale(zoom: number, asked: boolean): number {
  const natural = Math.min(CARD_MAX_SCALE, Math.max(CARD_MIN_SCALE, zoom > 0 ? zoom : 1));
  return asked ? Math.max(natural, CARD_READABLE_SCALE) : natural;
}

/** Gap between a node and its card under or above it, in the card's own pixels (NodeToolbar's offset at scale 1). */
export const CARD_GAP = 8;
/** Gap beside a node: wide enough to clear the node's own port handles. */
export const CARD_SIDE_GAP = 14;
/** How far port handles reach out of a node's box, in flow units; other nodes' boxes grow by this sideways. */
export const HANDLE_REACH = 8;
const SIDES: CardSide[] = ['bottom', 'right', 'left', 'top'];

/**
 * The flow-space rectangle a card of `size` screen pixels covers on `side` of `node` at `zoom`, the way
 * NodeToolbar lays it out: centred under / above, top-aligned beside. `scale` is the scale the card is drawn at
 * (cardScale): the gap to the node is drawn at it too.
 */
export function cardRect(node: Box, side: CardSide, size: { width: number; height: number }, zoom: number, scale = 1): Box {
  const z = zoom > 0 ? zoom : 1;
  const width = size.width / z;
  const height = size.height / z;
  const gap = (CARD_GAP * scale) / z;
  const sideGap = (CARD_SIDE_GAP * scale) / z;
  switch (side) {
    case 'bottom':
      return { x: node.x + (node.width - width) / 2, y: node.y + node.height + gap, width, height };
    case 'top':
      return { x: node.x + (node.width - width) / 2, y: node.y - gap - height, width, height };
    case 'right':
      return { x: node.x + node.width + sideGap, y: node.y, width, height };
    case 'left':
      return { x: node.x - sideGap - width, y: node.y, width, height };
  }
}

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** The box another node blocks: its own box plus the port handles sticking out on its left and right. */
function blocked(box: Box): Box {
  return { x: box.x - HANDLE_REACH, y: box.y, width: box.width + HANDLE_REACH * 2, height: box.height };
}

/** The area of `rect` that lies outside `bounds`. */
function outside(rect: Box, bounds: Box): number {
  return rect.width * rect.height - overlap(rect, bounds);
}

function coveredBy(rect: Box, others: Box[]): number {
  let total = 0;
  for (const other of others) total += overlap(rect, blocked(other));
  return total;
}

/**
 * Overlap avoidance for one card. Tries under the node, then right, then left, then above, at full size; then a
 * compact one-line card (about the node's width) in the same order. A card nobody asked for gets null (a dot) when even that would cover
 * another node or its ports. A card that was asked for (`required`: selected, hovered, tour…) always gets a
 * place: the first free one, else the one that covers least (it is drawn above other cards).
 */
export function placeCard(input: {
  node: Box;
  others: Box[];
  zoom: number;
  /** The card's size in screen pixels. */
  size: { width: number; height: number };
  /** The compact form's size in screen pixels; null when the card cannot shrink (expanded, editing). */
  compactSize: { width: number; height: number } | null;
  required: boolean;
  /** Sides to try, in order (the tour keeps the top for its callout). */
  sides?: CardSide[];
  /** The visible part of the canvas: a card asked for must not land outside it (or under the floating toolbar). */
  bounds?: Box | null;
  /** The scale the card is drawn at (cardScale); the sizes above are already at it. */
  scale?: number;
}): CardPlacement | null {
  const { node, others, zoom, size, compactSize, required, bounds } = input;
  const scale = input.scale ?? 1;
  const sides = input.sides ?? SIDES;
  const covered = (rect: Box, list: Box[]) => coveredBy(rect, list) + (bounds ? outside(rect, bounds) : 0);
  let best: { placement: CardPlacement; cost: number } | null = null;
  const consider = (placement: CardPlacement, cost: number) => {
    if (!best || cost < best.cost) best = { placement, cost };
  };
  for (const side of sides) {
    const cost = covered(cardRect(node, side, size, zoom, scale), others);
    if (cost === 0) return { side, compact: false };
    consider({ side, compact: false }, cost);
  }
  if (compactSize) {
    for (const side of sides) {
      const cost = covered(cardRect(node, side, compactSize, zoom, scale), others);
      if (cost === 0) return { side, compact: true };
      consider({ side, compact: true }, cost);
    }
  }
  if (!required) return null;
  const fallback = (best as { placement: CardPlacement } | null)?.placement ?? { side: 'bottom' as const, compact: false };
  return { ...fallback, covers: true };
}

/** Other nodes that a card of at most `reach` flow units around `node` could touch (a cheap first cut). */
export function neighbourBoxes(node: Box, boxes: Box[], reach: number): Box[] {
  const area = { x: node.x - reach, y: node.y - reach, width: node.width + reach * 2, height: node.height + reach * 2 };
  return boxes.filter((box) => box !== node && overlap(area, blocked(box)) > 0);
}

/** The first line of a text, for the collapsed card. */
export function firstLine(text: string): string {
  const line = text.split(/\r?\n/).find((item) => item.trim() !== '') ?? '';
  return line.trim();
}
