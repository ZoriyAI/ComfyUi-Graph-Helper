/**
 * Where nodes the assistant adds land on the canvas, and the tidy of its nodes when a run ends.
 * Used by commands/commit.ts (helper add-node, insert-subgraph, end-of-run tidy), proposals/repository.ts (grey
 * draft nodes) and agent/interrupted.ts (runCreatedNodeIds, to count what a stopped run built). The rules follow.
 */
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
  type SizeHints,
} from '../../shared/graph/layout';

/**
 * Where the helper's nodes go. The model's coordinates are a hint, never trusted: a node that would land on
 * another (or comes without a position) moves to a free spot to the right of what this run has built so far,
 * and when the run closes its nodes are tidied into a layered layout around everything it did not make.
 * Main has no DOM, so a node's size is worked out from its ports, fields and name, the way the canvas draws it
 * (shared/graph/layout.ts estimateNodeSize, held to the canvas by tests/e2e/node-size.test.ts).
 */

type Node = Record<string, any>;
type AddNode = Extract<GraphMutation, { type: 'add-node' }>;
type MoveNodes = Extract<GraphMutation, { type: 'move-nodes' }>;
type InsertSubgraph = Extract<GraphMutation, { type: 'insert-subgraph' }>;

/** Room kept around a placed node: a collapsed description card under it, and air before the next node. */
export const PLACE_GAP = 56;

/** What the catalog knows of each class's inputs, for sizing a node the way the canvas draws it. */
export type ClassHints = (classType: unknown) => SizeHints | null;

/** Size hints by class, built lazily on the first lookup so a call that never sizes a node costs nothing. */
export function classHints(catalog: CatalogView | null | undefined): ClassHints {
  let byClass: Map<string, SizeHints> | null = null;
  return (classType) => {
    if (!catalog || typeof classType !== 'string') return null;
    if (!byClass) {
      byClass = new Map(catalog.nodes.map((node) => [
        node.classType,
        { inputs: node.inputs.map((input) => ({ name: input.name, widget: input.widget, multiline: input.multiline })) },
      ]));
    }
    return byClass.get(classType) ?? null;
  };
}

const NO_HINTS: ClassHints = () => null;

/**
 * A node's rectangle on the canvas, its size estimated as the canvas would draw it.
 * `hints` is optional so the function also serves as a plain `nodes.map(nodeRectOf)` (the array index is ignored).
 */
export function nodeRectOf(node: Node, hints?: ClassHints | number): Rect {
  const size = estimateNodeSize(node.data, (typeof hints === 'function' ? hints : NO_HINTS)(node.data?.comfyType));
  return { x: Number(node.position?.x) || 0, y: Number(node.position?.y) || 0, ...size };
}

/** The size a node of this class will have once added: the catalog's ports and default fields. */
export function newNodeSize(payload: AddNode, catalog: CatalogView): Size {
  const ports = portsForClassType(payload.nodeType, catalog);
  const spec = catalog.nodes.find((item) => item.classType === payload.nodeType);
  const parameters = { ...defaultParameters(spec), ...(payload.parameters ?? {}) };
  return estimateNodeSize({ inputs: ports.inputs, outputs: ports.outputs, parameters }, classHints(catalog)(payload.nodeType));
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
 * A spot for something the helper adds that covers nothing. The model's x/y is kept when it is free; otherwise
 * (or when it gave none) the node goes to the nearest free spot right of the nodes this run made, or right of
 * the whole graph when the run has made none yet.
 */
function helperSpot(asked: { x?: number; y?: number }, size: Size, nodes: Node[], runNodeIds: string[], hints: ClassHints): { x: number; y: number } | null {
  const rectOf = (node: Node) => nodeRectOf(node, hints);
  const rects = nodes.map(rectOf);
  const given = typeof asked.x === 'number' && Number.isFinite(asked.x) && typeof asked.y === 'number' && Number.isFinite(asked.y)
    ? { x: asked.x, y: asked.y }
    : null;
  if (given && !rects.some((rect) => rectsOverlap({ ...given, ...size }, rect, PLACE_GAP))) return null;
  const mine = new Set(runNodeIds);
  const built = boundsOfRects(nodes.filter((node) => mine.has(String(node.id))).map(rectOf));
  const everything = boundsOfRects(rects);
  const anchor = built ?? everything;
  const preferred = anchor
    ? { x: Math.round(anchor.x + anchor.width + LAYOUT_GAPS.gapX), y: Math.round(given && built ? given.y : anchor.y) }
    : given ?? { x: 0, y: 0 };
  const spot = findFreeSlot(rects, preferred, size, PLACE_GAP);
  return { x: Math.round(spot.x), y: Math.round(spot.y) };
}

/** The helper's add-node with a position that covers nothing (see helperSpot). */
export function placeHelperNode(payload: AddNode, nodes: Node[], runNodeIds: string[], catalog: CatalogView): AddNode {
  const spot = helperSpot(payload, newNodeSize(payload, catalog), nodes, runNodeIds, classHints(catalog));
  return spot ? { ...payload, ...spot } : payload;
}

/** An add-node that is not on the canvas yet (an open grey draft), as a node with the size the canvas will give it. */
function draftNode(payload: AddNode, catalog: CatalogView, index: number): Node {
  const ports = portsForClassType(payload.nodeType, catalog);
  const spec = catalog.nodes.find((item) => item.classType === payload.nodeType);
  return {
    id: `draft-${index}`,
    position: { x: Number(payload.x) || 0, y: Number(payload.y) || 0 },
    data: { comfyType: payload.nodeType, title: payload.title, inputs: ports.inputs, outputs: ports.outputs, parameters: { ...defaultParameters(spec), ...(payload.parameters ?? {}) } },
  };
}

/**
 * A grey draft of a node: where it is drawn and where it lands when accepted covers no node on the canvas
 * and no other open draft. The same rule as the helper's own nodes: the asked spot when it is free, else the
 * nearest free one.
 */
export function placeDraftNode(payload: AddNode, nodes: Node[], drafts: AddNode[], catalog: CatalogView): AddNode {
  const others = drafts.filter((draft) => typeof draft.x === 'number' && typeof draft.y === 'number').map((draft, index) => draftNode(draft, catalog, index));
  return placeHelperNode(payload, [...nodes, ...others], [], catalog);
}

/** The helper's insert-subgraph with a position that covers nothing: the card is sized by the subgraph's ports. */
export function placeHelperSubgraph(
  payload: InsertSubgraph,
  nodes: Node[],
  definitions: ReadonlyArray<{ id: string; name: string; inputs: unknown[]; outputs: unknown[] }>,
  runNodeIds: string[],
  catalog: CatalogView,
): InsertSubgraph {
  const definition = definitions.find((item) => item.id === payload.definitionId);
  if (!definition) return payload;
  const size = estimateNodeSize(
    { inputs: definition.inputs, outputs: definition.outputs, kind: 'subgraph-instance', title: payload.title || definition.name },
    { subgraphName: definition.name },
  );
  const spot = helperSpot(payload, size, nodes, runNodeIds, classHints(catalog));
  return spot ? { ...payload, ...spot } : payload;
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
export function tidyMoves(nodes: Node[], edges: Node[], runNodeIds: string[], catalog?: CatalogView | null): MoveNodes['moves'] {
  const hints = classHints(catalog);
  const rectOf = (node: Node) => nodeRectOf(node, hints);
  const mine = new Set(runNodeIds);
  const created = nodes.filter((node) => mine.has(String(node.id)));
  if (created.length === 0) return [];
  const fixed = nodes.filter((node) => !mine.has(String(node.id)));
  const ids = new Set(created.map((node) => String(node.id)));
  // Order by the current picture (left to right, then top to bottom) so the tidy keeps what the helper meant.
  const ordered = [...created].sort((a, b) => (rectOf(a).x - rectOf(b).x) || (rectOf(a).y - rectOf(b).y) || String(a.id).localeCompare(String(b.id)));
  const start = boundsOfRects(created.map(rectOf))!;
  const placed = layoutGraph(
    ordered.map((node) => ({ id: String(node.id), ...rectOf(node) })),
    edges.filter((edge) => ids.has(String(edge.source)) && ids.has(String(edge.target))).map((edge) => ({ source: String(edge.source), target: String(edge.target) })),
    { origin: { x: Math.round(start.x), y: Math.round(start.y) }, obstacles: fixed.map(rectOf), componentGap: LAYOUT_GAPS.componentGap },
  );
  const moves: MoveNodes['moves'] = [];
  for (const node of ordered) {
    const next = placed.get(String(node.id));
    if (!next) continue;
    const rect = rectOf(node);
    if (Math.abs(rect.x - next.x) < 0.5 && Math.abs(rect.y - next.y) < 0.5) continue;
    moves.push({ nodeId: String(node.id), x: next.x, y: next.y });
  }
  return moves;
}
