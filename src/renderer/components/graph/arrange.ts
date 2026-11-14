import type { GraphMutation } from '../../../shared/commands/types';
import { boundsOfRects, layoutGraph, LAYOUT_GAPS } from '../../../shared/graph/layout';
import { canvasHandle } from '../../commands/canvasHandle';
import { commitManual } from './commit';
import { glideMs } from './lib/glide';
import { layoutRect } from './lib/nodeSizes';
import { levelEdges, levelNodes } from './lib/level';
import { useGraphStore } from '../../state/graphState';
import type { PositionedNode } from './lib/geometry';

type Moves = Extract<GraphMutation, { type: 'move-nodes' }>['moves'];

/**
 * «Разложить граф»: where each node goes. Two or more selected nodes are arranged among themselves around the
 * rest (which stays put); otherwise the whole graph. Sizes are React Flow's measurements at a readable zoom.
 * Returns only nodes that move.
 */
/** The margin a group draws around its members (lib/geometry groupRect), and room for its title. */
export const GROUP_PAD = 24;
export const GROUP_TITLE = 36;

interface Box { x: number; y: number; width: number; height: number }

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * After an arrangement no node lands inside a group it does not belong to (in ComfyUI a group holds what lies
 * inside its frame, so a stranger there would join it on export). A stranger that the arrangement moves is pushed
 * below the group frame; nodes the arrangement leaves alone stay. Returns the corrected places.
 */
export function clearGroups(rects: Map<string, Box>, groups: Array<{ nodeIds: string[] }>, movable: Set<string>, gap = LAYOUT_GAPS.gapY): Map<string, Box> {
  const out = new Map([...rects].map(([id, rect]) => [id, { ...rect }]));
  for (let round = 0; round < 8; round += 1) {
    let changed = false;
    for (const group of groups) {
      const members = group.nodeIds.map((id) => out.get(id)).filter((rect): rect is Box => Boolean(rect));
      if (members.length === 0) continue;
      const bounds = boundsOfRects(members)!;
      const frame = { x: bounds.x - GROUP_PAD, y: bounds.y - GROUP_PAD - GROUP_TITLE, width: bounds.width + GROUP_PAD * 2, height: bounds.height + GROUP_PAD * 2 + GROUP_TITLE };
      for (const [id, rect] of out) {
        if (group.nodeIds.includes(id) || !movable.has(id) || !overlaps(rect, frame)) continue;
        rect.y = frame.y + frame.height + gap;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return out;
}

export function arrangeMoves(nodes: Array<PositionedNode & { selected?: boolean }>, edges: Array<{ source: string; target: string }>, groups: Array<{ nodeIds: string[] }> = []): Moves {
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
  // Every node's final rectangle (those not arranged keep theirs), then strangers moved out of group frames.
  const finalRects = new Map(nodes.map((node) => {
    const rect = layoutRect(node);
    const next = placed.get(node.id);
    return [node.id, next ? { ...rect, x: next.x, y: next.y } : rect] as const;
  }));
  const cleared = clearGroups(finalRects, groups, ids);
  const moves: Moves = [];
  for (const node of ordered) {
    const next = cleared.get(node.id);
    if (!next) continue;
    if (Math.abs(node.position.x - next.x) < 0.5 && Math.abs(node.position.y - next.y) < 0.5) continue;
    moves.push({ nodeId: node.id, x: next.x, y: next.y });
  }
  return moves;
}

/** Arranges the graph on screen (or the selection) as one undoable commit, then fits the view once the nodes have glided. */
export async function arrangeGraph(): Promise<void> {
  // The level on screen: the root graph, or the inner nodes of the open subgraph (one commit there too).
  // Groups live on the main canvas; inside a subgraph there are none.
  const groups = useGraphStore.getState().activeSubgraphId ? [] : useGraphStore.getState().groups;
  const moves = arrangeMoves(levelNodes(), levelEdges(), groups);
  if (moves.length > 0) await commitManual({ type: 'move-nodes', moves }, 'arrange');
  // Fit after the glide (instant when motion is reduced or off), and after React Flow drew the last frame.
  window.setTimeout(() => window.requestAnimationFrame(() => canvasHandle()?.fit()), moves.length > 0 ? glideMs() + 40 : 0);
}
