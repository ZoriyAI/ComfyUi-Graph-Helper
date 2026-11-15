/**
 * Where a node added by hand lands: the drop point or the view's centre, moved to the nearest free spot. The add-node
 * search, drops on the canvas, the context menu, the library, lessons, the menu bar and the editing commands all
 * place through it, so a new node never covers another one whichever way it was added.
 */
import { useCanvasStore } from './canvasStore';
import { freeSpotFor, viewCentreSpot, NEW_NODE_SIZE, type PositionedNode } from './lib/geometry';
import { layoutRect, newNodeSize, sizeHintsOf } from './lib/nodeSizes';
import { useNodeInfoStore } from './nodeInfo';
import { levelObstacles } from './lib/level';

/** What is about to be added: enough to know how large the canvas will draw it. */
export interface NewNode {
  /** A node class: the catalog gives its ports and fields. */
  classType?: string;
  parameters?: Record<string, unknown>;
  /** A size worked out by the caller (a subgraph is sized by its own ports). */
  size?: { width: number; height: number };
}

/**
 * The one place a manually added node gets its position: the drop point (or a spot the caller chose), else the
 * centre of the view, moved to the nearest spot where it covers no node and keeps its distance from each.
 * The new node is given the size it will be drawn at, and the nodes around it the sizes they have on the canvas
 * (React Flow's measurements; what they measured when last seen whole, if the canvas is zoomed out to its map).
 */
export async function placeNewNode(at: { x: number; y: number } | null, what: NewNode = {}): Promise<{ x: number; y: number }> {
  const info = useNodeInfoStore.getState();
  const detail = what.classType ? await info.request(what.classType) : null;
  const size = what.size ?? (what.classType ? newNodeSize(what.classType, detail, what) : NEW_NODE_SIZE);
  // Read after the wait: the graph is whatever is on the canvas now (inside an open subgraph, its inner nodes and slot edges).
  const nodes = levelObstacles() as unknown as PositionedNode[];
  const details = useNodeInfoStore.getState().details;
  const preferred = at ?? viewCentreSpot(useCanvasStore.getState().viewport, size) ?? { x: 0, y: 0 };
  return freeSpotFor(nodes, preferred, size, (node) => layoutRect(node, sizeHintsOf(node.data?.comfyType ? details[node.data.comfyType] : null)));
}
