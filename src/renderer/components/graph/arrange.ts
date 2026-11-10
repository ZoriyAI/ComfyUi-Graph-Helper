import type { GraphMutation } from '../../../shared/commands/types';
import { boundsOfRects, layoutGraph, LAYOUT_GAPS } from '../../../shared/graph/layout';
import { useGraphStore } from '../../state/graphState';
import { canvasHandle } from '../../commands/canvasHandle';
import { commitManual } from './commit';
import { glideMs } from './lib/glide';
import { layoutRect } from './lib/nodeSizes';
import type { PositionedNode } from './lib/geometry';

type Moves = Extract<GraphMutation, { type: 'move-nodes' }>['moves'];

/**
 * «Разложить граф»: where each node goes. Two or more selected nodes are arranged among themselves around the
 * rest (which stays put); otherwise the whole graph. Sizes are React Flow's measurements at a readable zoom.
 * Returns only nodes that move.
 */
export function arrangeMoves(nodes: Array<PositionedNode & { selected?: boolean }>, edges: Array<{ source: string; target: string }>): Moves {
  const selected = nodes.filter((node) => node.selected);
  const target = selected.length >= 2 ? selected : nodes;
  if (target.length === 0) return [];
  const ids = new Set(target.map((node) => node.id));
  const rects = new Map(target.map((node) => [node.id, layoutRect(node)]));
  // Seed the order with the current picture so the arrangement keeps what the person had in mind.
  const ordered = [...target].sort((a, b) => (rects.get(a.id)!.x - rects.get(b.id)!.x) || (rects.get(a.id)!.y - rects.get(b.id)!.y) || a.id.localeCompare(b.id));
  const start = boundsOfRects([...rects.values()])!;
  const placed = layoutGraph(
    ordered.map((node) => ({ id: node.id, ...rects.get(node.id)! })),
    edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
    {
      origin: { x: Math.round(start.x), y: Math.round(start.y) },
      obstacles: nodes.filter((node) => !ids.has(node.id)).map((node) => layoutRect(node)),
      gapX: LAYOUT_GAPS.gapX,
      gapY: LAYOUT_GAPS.gapY,
    },
  );
  const moves: Moves = [];
  for (const node of ordered) {
    const next = placed.get(node.id);
    if (!next) continue;
    if (Math.abs(node.position.x - next.x) < 0.5 && Math.abs(node.position.y - next.y) < 0.5) continue;
    moves.push({ nodeId: node.id, x: next.x, y: next.y });
  }
  return moves;
}

/** Arranges the graph (or the selection) as one undoable commit, then fits the view once the nodes have glided. */
export async function arrangeGraph(): Promise<void> {
  const graph = useGraphStore.getState();
  const moves = arrangeMoves(graph.nodes, graph.edges);
  if (moves.length > 0) await commitManual({ type: 'move-nodes', moves }, 'arrange');
  // Fit after the glide (instant when motion is reduced or off), and after React Flow drew the last frame.
  window.setTimeout(() => window.requestAnimationFrame(() => canvasHandle()?.fit()), moves.length > 0 ? glideMs() + 40 : 0);
}
