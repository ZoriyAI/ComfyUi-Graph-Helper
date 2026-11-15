/**
 * The canvas inside a subgraph definition: its inner nodes plus the two boundary nodes that show the definition's
 * inputs and outputs, and the breadcrumb of nested definitions. Used by CanvasFlow, SubgraphBreadcrumb,
 * nodes/BoundaryNode.tsx and tour/startTour.ts.
 */
import {
  SUBGRAPH_INPUT_NODE_ID,
  SUBGRAPH_OUTPUT_NODE_ID,
  slotLabel,
  type SubgraphDefinition,
} from '../../../../shared/graph/subgraphs';
import type { BoundaryNode, GraphEdge, GraphNode, PortDefinition } from '../../../types/graph';
import { boundsOf, nodeRect, type PositionedNode } from './geometry';

/**
 * The empty slot at the end of each boundary node: a link from an inner port to it adds a subgraph slot for that
 * port (ComfyUI draws the same empty slot). Its handle id is not a slot number, so it never names a slot.
 */
export const NEW_INPUT_SLOT = 'out-new';
/** The same empty slot on the output boundary node. */
export const NEW_OUTPUT_SLOT = 'in-new';

/** The saved top-left of a boundary node in the native definition, if ComfyUI stored one. */
function bounding(raw: Record<string, unknown>, key: 'inputNode' | 'outputNode'): { x: number; y: number } | null {
  const holder = raw[key];
  if (!holder || typeof holder !== 'object') return null;
  const box = (holder as { bounding?: unknown }).bounding;
  if (!Array.isArray(box) || typeof box[0] !== 'number' || typeof box[1] !== 'number') return null;
  return { x: box[0], y: box[1] };
}

/** Inner nodes without an id or a position cannot be drawn; they are left out of the view (not out of the file). */
function isPositioned(node: Record<string, unknown>): node is Record<string, unknown> & PositionedNode {
  const position = node.position as { x?: unknown; y?: unknown } | undefined;
  return typeof node.id === 'string' && typeof position?.x === 'number' && typeof position?.y === 'number';
}

/**
 * The canvas inside a definition: its inner nodes and edges, plus the two boundary pseudo-nodes.
 * The input boundary node shows the definition's inputs as outputs (`out-<slot>`), the output boundary
 * node shows its outputs as inputs (`in-<slot>`), matching the inner edges' handles.
 */
export function definitionView(definition: SubgraphDefinition): { nodes: Array<GraphNode | BoundaryNode>; edges: GraphEdge[] } {
  const inner = definition.nodes.filter(isPositioned).map((node) => ({ ...node, type: 'comfy' }) as unknown as GraphNode);
  const edges = definition.edges.filter((edge) => typeof edge.id === 'string' && typeof edge.source === 'string' && typeof edge.target === 'string') as GraphEdge[];
  const box = boundsOf(inner.map((node) => nodeRect(node)));
  const inputPorts: PortDefinition[] = definition.inputs.map((slot, index) => ({ id: `out-${index}`, name: slotLabel(slot), dataType: slot.type, optional: false }));
  const outputPorts: PortDefinition[] = definition.outputs.map((slot, index) => ({ id: `in-${index}`, name: slotLabel(slot), dataType: slot.type, optional: false }));
  // Without saved places, the boundaries stand left and right of the inner nodes, at their vertical middle.
  const middle = box ? box.y + box.height / 2 - 40 : 0;
  const inputAt = bounding(definition.raw, 'inputNode') ?? { x: (box?.x ?? 0) - 260, y: middle };
  const outputAt = bounding(definition.raw, 'outputNode') ?? { x: (box ? box.x + box.width : 240) + 120, y: middle };
  const boundary: BoundaryNode[] = [
    {
      id: SUBGRAPH_INPUT_NODE_ID,
      type: 'boundary',
      position: inputAt,
      deletable: false,
      data: { direction: 'input', name: definition.name, ports: inputPorts, definitionId: definition.id, slotIds: definition.inputs.map((slot) => slot.id) },
    },
    {
      id: SUBGRAPH_OUTPUT_NODE_ID,
      type: 'boundary',
      position: outputAt,
      deletable: false,
      data: { direction: 'output', name: definition.name, ports: outputPorts, definitionId: definition.id, slotIds: definition.outputs.map((slot) => slot.id) },
    },
  ];
  return { nodes: [...boundary, ...inner], edges };
}

/** Breadcrumb labels for a path of definition ids. Unknown ids are skipped. */
export function breadcrumb(path: string[], subgraphs: SubgraphDefinition[]): Array<{ id: string; name: string; depth: number }> {
  const crumbs: Array<{ id: string; name: string; depth: number }> = [];
  path.forEach((id, index) => {
    const found = subgraphs.find((item) => item.id === id);
    if (found) crumbs.push({ id, name: found.name, depth: index + 1 });
  });
  return crumbs;
}
