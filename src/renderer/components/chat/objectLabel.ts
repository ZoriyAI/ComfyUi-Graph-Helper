import type { ObjectRef } from '../../../shared/contracts';

/** The parts of the graph a label needs; graphState nodes and edges fit this shape. */
export interface LabelGraph {
  nodes: ReadonlyArray<{ id: string; data: { title?: string; comfyType?: string; inputs?: ReadonlyArray<{ id: string; name: string }>; outputs?: ReadonlyArray<{ id: string; name: string }> } }>;
  edges?: ReadonlyArray<{ id: string; source: string; target: string }>;
}

function nodeName(graph: LabelGraph, nodeId: string | undefined): string | undefined {
  if (!nodeId) return undefined;
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node) return undefined;
  return node.data.title || node.data.comfyType || node.id;
}

/**
 * A short human name for an object: the node title, "Node · input", "A → B", the model file name.
 * `processName` is the translated name of the whole graph.
 */
export function objectLabel(ref: ObjectRef, graph: LabelGraph, processName: string): string {
  switch (ref.kind) {
    case 'node':
      return nodeName(graph, ref.id) ?? ref.classType ?? ref.id;
    case 'port': {
      const owner = graph.nodes.find((item) => item.id === ref.nodeId);
      const ports = ref.direction === 'output' ? owner?.data.outputs : owner?.data.inputs;
      const port = ports?.find((item) => item.id === ref.portName || item.name === ref.portName);
      const portName = port?.name ?? ref.portName ?? ref.id;
      const ownerName = nodeName(graph, ref.nodeId);
      return ownerName ? `${ownerName} · ${portName}` : portName;
    }
    case 'edge': {
      const edge = graph.edges?.find((item) => item.id === ref.id);
      if (!edge) return ref.id;
      return `${nodeName(graph, edge.source) ?? edge.source} → ${nodeName(graph, edge.target) ?? edge.target}`;
    }
    case 'nodeClass':
      return ref.classType ?? ref.id;
    case 'model':
      return ref.name ?? ref.id.split('/').pop() ?? ref.id;
    case 'process':
      return processName;
    default:
      return ref.name ?? ref.id;
  }
}
