import type Database from 'better-sqlite3';
import type { CatalogView } from '../../shared/catalog/types';
import type { GraphMutation } from '../../shared/commands/types';
import { defaultParameters } from '../../shared/catalog/objectInfo';
import { portsForClassType } from '../../shared/graph/ports';
import {
  boundsOfRects,
  estimateNodeSize,
  findFreeSlot,
  layoutGraph,
  LAYOUT_GAPS,
  rectsOverlap,
  type Rect,
  type Size,
} from '../../shared/graph/layout';

/**
 * Where the helper's nodes go. The model's coordinates are a hint, never trusted: a node that would land on
 * another (or comes without a position) moves to a free spot to the right of what this run has built so far,
 * and when the run closes its nodes are tidied into a layered layout around everything it did not make.
 * Main has no DOM, so sizes are estimated from ports and fields (shared/graph/layout.ts estimateNodeSize).
 */

type Node = Record<string, any>;
type AddNode = Extract<GraphMutation, { type: 'add-node' }>;
type MoveNodes = Extract<GraphMutation, { type: 'move-nodes' }>;

/** Room kept around a placed node; wide enough for a collapsed description card under it. */
export const PLACE_GAP = 40;

export function nodeRectOf(node: Node): Rect {
  const size = estimateNodeSize(node.data);
  return { x: Number(node.position?.x) || 0, y: Number(node.position?.y) || 0, ...size };
}

/** The size a node of this class will have once added: the catalog's ports and default fields. */
export function newNodeSize(payload: AddNode, catalog: CatalogView): Size {
  const ports = portsForClassType(payload.nodeType, catalog);
  const spec = catalog.nodes.find((item) => item.classType === payload.nodeType);
  const parameters = { ...defaultParameters(spec), ...(payload.parameters ?? {}) };
  return estimateNodeSize({ inputs: ports.inputs, outputs: ports.outputs, parameters });
}

/** Nodes the run has added so far (add-node and insert-subgraph commits), in the order it added them. */
export function runCreatedNodeIds(db: Database.Database, projectId: string, runId: string): string[] {
  const rows = db
    .prepare(
      `SELECT a.payload_canonical, a.result_json FROM applied_commands a
       JOIN graph_revisions r ON r.id = a.result_revision_id AND r.project_id = a.project_id
       WHERE a.project_id = ? AND a.run_id = ? ORDER BY r.rev_seq`,
    )
    .all(projectId, runId) as Array<{ payload_canonical: string; result_json: string }>;
  const ids: string[] = [];
  for (const row of rows) {
    try {
      const payload = JSON.parse(row.payload_canonical) as { type?: unknown };
      if (payload.type !== 'add-node' && payload.type !== 'insert-subgraph') continue;
      const result = JSON.parse(row.result_json) as { nodeId?: unknown };
      if (typeof result.nodeId === 'string' || typeof result.nodeId === 'number') ids.push(String(result.nodeId));
    } catch {
      // A row that does not parse names no node.
    }
  }
  return ids;
}

/**
 * The helper's add-node with a position that covers nothing. The model's x/y is kept when it is free; otherwise
 * (or when it gave none) the node goes to the nearest free spot right of the nodes this run made, or right of
 * the whole graph when the run has made none yet.
 */
export function placeHelperNode(payload: AddNode, nodes: Node[], runNodeIds: string[], catalog: CatalogView): AddNode {
  const size = newNodeSize(payload, catalog);
  const rects = nodes.map(nodeRectOf);
  const given = typeof payload.x === 'number' && Number.isFinite(payload.x) && typeof payload.y === 'number' && Number.isFinite(payload.y)
    ? { x: payload.x, y: payload.y }
    : null;
  if (given && !rects.some((rect) => rectsOverlap({ ...given, ...size }, rect, PLACE_GAP))) return payload;
  const mine = new Set(runNodeIds);
  const built = boundsOfRects(nodes.filter((node) => mine.has(String(node.id))).map(nodeRectOf));
  const everything = boundsOfRects(rects);
  const anchor = built ?? everything;
  const preferred = anchor
    ? { x: Math.round(anchor.x + anchor.width + LAYOUT_GAPS.gapX), y: Math.round(given && built ? given.y : anchor.y) }
    : given ?? { x: 0, y: 0 };
  const spot = findFreeSlot(rects, preferred, size, PLACE_GAP);
  return { ...payload, x: Math.round(spot.x), y: Math.round(spot.y) };
}

/** Moves a move-nodes commit makes: positions of named nodes; refused when one is not on the canvas. */
export function applyMoveNodes(nodes: Node[], payload: MoveNodes): { moved: string[] } | { missing: string } {
  const byId = new Map(nodes.map((node) => [String(node.id), node]));
  for (const move of payload.moves) {
    if (!byId.has(move.nodeId)) return { missing: move.nodeId };
  }
  for (const move of payload.moves) {
    const node = byId.get(move.nodeId)!;
    node.position = { x: move.x, y: move.y };
  }
  return { moved: [...new Set(payload.moves.map((move) => move.nodeId))] };
}

/**
 * The tidy at the end of a run: the run's nodes laid out with `layoutGraph`, everything else fixed as an
 * obstacle (the whole graph when the run made all of it). Returns only nodes that actually move.
 */
export function tidyMoves(nodes: Node[], edges: Node[], runNodeIds: string[]): MoveNodes['moves'] {
  const mine = new Set(runNodeIds);
  const created = nodes.filter((node) => mine.has(String(node.id)));
  if (created.length === 0) return [];
  const fixed = nodes.filter((node) => !mine.has(String(node.id)));
  const ids = new Set(created.map((node) => String(node.id)));
  // Order by the current picture (top to bottom, then left to right) so the tidy keeps what the helper meant.
  const ordered = [...created].sort((a, b) => (nodeRectOf(a).x - nodeRectOf(b).x) || (nodeRectOf(a).y - nodeRectOf(b).y) || String(a.id).localeCompare(String(b.id)));
  const start = boundsOfRects(created.map(nodeRectOf))!;
  const placed = layoutGraph(
    ordered.map((node) => ({ id: String(node.id), ...nodeRectOf(node) })),
    edges.filter((edge) => ids.has(String(edge.source)) && ids.has(String(edge.target))).map((edge) => ({ source: String(edge.source), target: String(edge.target) })),
    { origin: { x: Math.round(start.x), y: Math.round(start.y) }, obstacles: fixed.map(nodeRectOf), componentGap: PLACE_GAP * 2 },
  );
  const moves: MoveNodes['moves'] = [];
  for (const node of ordered) {
    const next = placed.get(String(node.id));
    if (!next) continue;
    const rect = nodeRectOf(node);
    if (Math.abs(rect.x - next.x) < 0.5 && Math.abs(rect.y - next.y) < 0.5) continue;
    moves.push({ nodeId: String(node.id), x: next.x, y: next.y });
  }
  return moves;
}
