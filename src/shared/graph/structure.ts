import { SUBGRAPH_INPUT_NODE_ID, SUBGRAPH_OUTPUT_NODE_ID, type SubgraphDefinition } from './subgraphs';

interface Node { id?: unknown; data?: { inputs?: unknown; outputs?: unknown } }
interface Edge { source?: unknown; target?: unknown; sourceHandle?: unknown; targetHandle?: unknown }
/** Resolve real side/handle membership; boundary pseudo-nodes exist only inside their definition. */
export function endpointPort(nodes: readonly Node[], nodeId: unknown, side: 'inputs' | 'outputs', handle: unknown, definition?: SubgraphDefinition): { dataType?: unknown } | undefined {
  if (typeof handle !== 'string' || !new RegExp(`^${side === 'inputs' ? 'in' : 'out'}-\\d+$`).test(handle)) return undefined;
  if (String(nodeId) === SUBGRAPH_INPUT_NODE_ID || String(nodeId) === SUBGRAPH_OUTPUT_NODE_ID) {
    if (!definition) return undefined;
    const slots = String(nodeId) === SUBGRAPH_INPUT_NODE_ID && side === 'outputs' ? definition.inputs
      : String(nodeId) === SUBGRAPH_OUTPUT_NODE_ID && side === 'inputs' ? definition.outputs : [];
    const slot = slots[Number(handle.split('-')[1])];
    return slot ? { dataType: slot.type } : undefined;
  }
  const node = nodes.find((item) => String(item.id) === String(nodeId));
  const ports = node?.data?.[side];
  return Array.isArray(ports) ? ports.find((port) => port?.id === handle) : undefined;
}
export function validEdgeEndpoints(nodes: readonly Node[], edge: Edge, definition?: SubgraphDefinition): boolean {
  return Boolean(endpointPort(nodes, edge.source, 'outputs', edge.sourceHandle, definition)
    && endpointPort(nodes, edge.target, 'inputs', edge.targetHandle, definition));
}
