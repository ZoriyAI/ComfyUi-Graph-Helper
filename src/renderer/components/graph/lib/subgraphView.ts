import {
  SUBGRAPH_INPUT_NODE_ID,
  SUBGRAPH_OUTPUT_NODE_ID,
  type SubgraphDefinition,
} from '../../../../shared/graph/subgraphs';
import type { BoundaryNode, GraphEdge, GraphNode, PortDefinition } from '../../../types/graph';
import { boundsOf, nodeRect, type PositionedNode } from './geometry';

function bounding(raw: Record<string, unknown>, key: 'inputNode' | 'outputNode'): { x: number; y: number } | null {
  const holder = raw[key];
  if (!holder || typeof holder !== 'object') return null;
  const box = (holder as { bounding?: unknown }).bounding;
  if (!Array.isArray(box) || typeof box[0] !== 'number' || typeof box[1] !== 'number') return null;
  return { x: box[0], y: box[1] };
}

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
  const inputPorts: PortDefinition[] = definition.inputs.map((slot, index) => ({ id: `out-${index}`, name: slot.name, dataType: slot.type, optional: false }));
  const outputPorts: PortDefinition[] = definition.outputs.map((slot, index) => ({ id: `in-${index}`, name: slot.name, dataType: slot.type, optional: false }));
  const middle = box ? box.y + box.height / 2 - 40 : 0;
  const inputAt = bounding(definition.raw, 'inputNode') ?? { x: (box?.x ?? 0) - 260, y: middle };
  const outputAt = bounding(definition.raw, 'outputNode') ?? { x: (box ? box.x + box.width : 240) + 120, y: middle };
  const boundary: BoundaryNode[] = [
    {
      id: SUBGRAPH_INPUT_NODE_ID,
      type: 'boundary',
      position: inputAt,
      deletable: false,
      data: { direction: 'input', name: definition.name, ports: inputPorts },
    },
    {
      id: SUBGRAPH_OUTPUT_NODE_ID,
      type: 'boundary',
      position: outputAt,
      deletable: false,
      data: { direction: 'output', name: definition.name, ports: outputPorts },
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
