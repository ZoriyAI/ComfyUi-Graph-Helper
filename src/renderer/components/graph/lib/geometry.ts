import type { GraphMutation } from '../../../../shared/commands/types';
import type { Proposal } from '../../../../shared/contracts/proposals';
import type { GroupRecord } from '../../../../shared/graph/subgraphs';
import { findFreeSlot } from '../../../../shared/graph/layout';

/** Size the canvas assumes for a node React Flow has not measured yet (the ComfyNode default width). */
export const DEFAULT_NODE_SIZE = { width: 240, height: 120 };
export const GROUP_PADDING = 24;
export const GROUP_TITLE = 32;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedNode {
  id: string;
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
  width?: number;
  height?: number;
  data?: { parameters?: Record<string, unknown>; title?: string; comfyType?: string; inputs?: unknown; outputs?: unknown; annotations?: unknown; kind?: unknown };
  selected?: boolean;
}

export function nodeRect(node: PositionedNode): Rect {
  return {
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width ?? node.width ?? DEFAULT_NODE_SIZE.width,
    height: node.measured?.height ?? node.height ?? DEFAULT_NODE_SIZE.height,
  };
}

export function boundsOf(rects: Rect[], padding = 0, top = padding): Rect | null {
  if (rects.length === 0) return null;
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: minX - padding, y: minY - top, width: maxX - minX + padding * 2, height: maxY - minY + padding + top };
}

/**
 * A group rectangle: around its members when any are on the canvas, else the stored native bounding,
 * else nothing (a group with no members and no bounds is not drawn).
 */
export function groupRect(group: GroupRecord, nodes: PositionedNode[]): Rect | null {
  const members = nodes.filter((node) => group.nodeIds.includes(node.id));
  if (members.length > 0) return boundsOf(members.map(nodeRect), GROUP_PADDING, GROUP_PADDING + GROUP_TITLE);
  const stored = group.bounding;
  if (stored && stored[2] > 0 && stored[3] > 0) return { x: stored[0], y: stored[1], width: stored[2], height: stored[3] };
  return null;
}

/**
 * Room a node takes when nothing is known of its class (the catalog has not read it): taller than the default, so
 * a node with a few ports and fields does not reach into the node below. A class the catalog knows is placed
 * with the size it will be drawn at (lib/nodeSizes.ts newNodeSize).
 */
export const NEW_NODE_SIZE = { width: DEFAULT_NODE_SIZE.width, height: 200 };
/** Gap kept between a newly placed node and the nodes around it: a collapsed description card fits under a node. */
export const NEW_NODE_GAP = 56;

/**
 * Where a new node goes: `preferred` (its top-left) when nothing is there, else the nearest spot where it
 * covers no node. Every manual add (drop, search, library, accepted ghost) comes through here. `rectOf` gives
 * each node's box; the default is what React Flow measured.
 */
export function freeSpotFor(
  nodes: PositionedNode[],
  preferred: { x: number; y: number },
  size: { width: number; height: number } = NEW_NODE_SIZE,
  rectOf: (node: PositionedNode) => Rect = nodeRect,
): { x: number; y: number } {
  const spot = findFreeSlot(nodes.map(rectOf), { x: Math.round(preferred.x), y: Math.round(preferred.y) }, size, NEW_NODE_GAP);
  return { x: Math.round(spot.x), y: Math.round(spot.y) };
}

/** The top-left that centres a node of `size` in the visible canvas (flow coordinates), or null without a view. */
export function viewCentreSpot(view: { x: number; y: number; zoom: number; width?: number; height?: number } | null, size = NEW_NODE_SIZE): { x: number; y: number } | null {
  if (!view || !(view.zoom > 0) || !view.width || !view.height) return null;
  return {
    x: Math.round((view.width / 2 - view.x) / view.zoom - size.width / 2),
    y: Math.round((view.height / 2 - view.y) / view.zoom - size.height / 2),
  };
}

/** Gap kept between a ghost and the nodes around it. */
export const GHOST_GAP = 32;
/**
 * Room a ghost takes when nothing is known of its class. A class the catalog knows gets the room of the ghost as
 * drawn and of the node that lands there once it is accepted (GhostLayer ghostRoom).
 */
export const GHOST_SIZE = { width: DEFAULT_NODE_SIZE.width, height: 200 };

type Box = { width: number; height: number };

function overlaps(a: Rect, b: Rect, gap: number): boolean {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

/**
 * First free slot for a ghost at column `x`, starting at `y` and moving down past whatever it would cover.
 * `order` stacks several unplaced ghosts in the same column.
 */
function freeSlot(x: number, y: number, rects: Rect[], order: number, size: Box): { x: number; y: number } {
  let top = y;
  let skipped = 0;
  for (let guard = 0; guard < 200; guard += 1) {
    const slot = { x, y: top, ...size };
    const hit = rects.find((rect) => overlaps(slot, rect, GHOST_GAP));
    if (!hit) {
      if (skipped === order) return { x, y: top };
      skipped += 1;
      top += size.height + GHOST_GAP;
      continue;
    }
    top = hit.y + hit.height + GHOST_GAP;
  }
  return { x, y: top };
}

/** Whether a ghost drawn at `spot` covers no node: a spot chosen earlier can be taken when the graph moves. */
export function ghostSpotFree(spot: { x: number; y: number }, nodes: PositionedNode[], size: Box = GHOST_SIZE): boolean {
  const ghost = { x: spot.x, y: spot.y, ...size };
  return !nodes.map(nodeRect).some((rect) => overlaps(ghost, rect, 0));
}

/**
 * Where the ghost of a suggested node (or subgraph) sits: its proposed position when that is free; otherwise in
 * free space to the right of the selected node, or to the right of the whole graph. A ghost never lands on top
 * of an existing node.
 */
export function ghostNodePosition(payload: { x?: number; y?: number }, nodes: PositionedNode[], order = 0, size: Box = GHOST_SIZE): { x: number; y: number } {
  const rects = nodes.map(nodeRect);
  if (typeof payload.x === 'number' && typeof payload.y === 'number') {
    const proposed = { x: payload.x, y: payload.y, ...size };
    if (!rects.some((rect) => overlaps(proposed, rect, 0))) return { x: payload.x, y: payload.y };
  }
  const bounds = boundsOf(rects);
  if (!bounds) return { x: 0, y: order * (size.height + GHOST_GAP) };
  const selected = nodes.find((node) => node.selected);
  if (selected) {
    const anchor = nodeRect(selected);
    return freeSlot(anchor.x + anchor.width + 80, anchor.y, rects, order, size);
  }
  return freeSlot(bounds.x + bounds.width + 80, bounds.y, rects, order, size);
}

/** The dashed outline of a create-subgraph ghost: around the nodes it would pull in. */
export function subgraphGhostRect(payload: Extract<GraphMutation, { type: 'create-subgraph' }>, nodes: PositionedNode[]): Rect | null {
  return boundsOf(nodes.filter((node) => payload.nodeIds.includes(node.id)).map(nodeRect), 16, 16 + GROUP_TITLE);
}

function short(value: unknown): string {
  if (value === undefined) return '—';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 18 ? `${text.slice(0, 17)}…` : text;
}

/** "steps: 20 → 30" for a set-parameter ghost. Values are data, shortened for the pill. */
export function parameterPill(payload: Extract<GraphMutation, { type: 'set-parameter' }>, nodes: PositionedNode[]): { nodeId: string; text: string } {
  const node = nodes.find((item) => item.id === payload.nodeId);
  const before = node?.data?.parameters?.[payload.key];
  return { nodeId: payload.nodeId, text: `${payload.key}: ${short(before)} → ${short(payload.value)}` };
}

/** Index of each add-node ghost among those without a position, so unplaced ghosts stack instead of overlapping. */
export function unplacedOrder(proposals: Proposal[]): Map<string, number> {
  const order = new Map<string, number>();
  let next = 0;
  for (const proposal of proposals) {
    const payload = proposal.payload;
    if (payload.type !== 'add-node') continue;
    if (typeof payload.x === 'number' && typeof payload.y === 'number') continue;
    order.set(proposal.id, next);
    next += 1;
  }
  return order;
}
