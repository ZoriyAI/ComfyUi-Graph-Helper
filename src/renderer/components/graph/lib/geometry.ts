import type { GraphMutation } from '../../../../shared/commands/types';
import type { Proposal } from '../../../../shared/contracts/proposals';
import type { GroupRecord } from '../../../../shared/graph/subgraphs';

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
  data?: { parameters?: Record<string, unknown>; title?: string; comfyType?: string };
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

/** Where an add-node ghost sits: its proposed position, else to the right of everything on the canvas. */
export function ghostNodePosition(payload: Extract<GraphMutation, { type: 'add-node' }>, nodes: PositionedNode[], order = 0): { x: number; y: number } {
  if (typeof payload.x === 'number' && typeof payload.y === 'number') return { x: payload.x, y: payload.y };
  const bounds = boundsOf(nodes.map(nodeRect));
  if (!bounds) return { x: 0, y: order * (DEFAULT_NODE_SIZE.height + 32) };
  return { x: bounds.x + bounds.width + 80, y: bounds.y + order * (DEFAULT_NODE_SIZE.height + 32) };
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
