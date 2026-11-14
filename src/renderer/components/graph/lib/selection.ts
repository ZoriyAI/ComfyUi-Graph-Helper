import { inSubgraph, objectKey, type ObjectRef } from '../../../../shared/contracts/objects';

interface SelectableNode {
  id: string;
  selected?: boolean;
  data?: { comfyType?: unknown; kind?: unknown; subgraphId?: unknown };
}

interface SelectableEdge {
  id: string;
  selected?: boolean;
}

/**
 * `subgraphId`: the subgraph definition open on the canvas (null or omitted: the main canvas). Node numbers inside a
 * definition repeat those of the main canvas, so a ref made there names its definition (ObjectRef.subgraphId).
 */
export function nodeRef(node: SelectableNode, subgraphId?: string | null): ObjectRef {
  const classType = typeof node.data?.comfyType === 'string' ? node.data.comfyType : undefined;
  return inSubgraph({ kind: 'node', id: node.id, ...(classType ? { classType } : {}) }, subgraphId);
}

export function portRef(nodeId: string, handle: string, direction: 'input' | 'output', portName?: string, subgraphId?: string | null): ObjectRef {
  return inSubgraph({ kind: 'port', id: `${nodeId}:${handle}`, nodeId, portName: portName ?? handle, direction }, subgraphId);
}

export function edgeRef(edgeId: string, subgraphId?: string | null): ObjectRef {
  return inSubgraph({ kind: 'edge', id: edgeId }, subgraphId);
}

/** The canvas selection as ObjectRefs for uiState: nodes first, then edges, then an optional focused port. */
export function selectionRefs(nodes: SelectableNode[], edges: SelectableEdge[], port?: ObjectRef | null, subgraphId?: string | null): ObjectRef[] {
  const refs: ObjectRef[] = [
    ...nodes.filter((node) => node.selected).map((node) => nodeRef(node, subgraphId)),
    ...edges.filter((edge) => edge.selected).map((edge) => edgeRef(edge.id, subgraphId)),
  ];
  if (port) refs.push(inSubgraph(port, subgraphId));
  return refs;
}

export function sameRefs(left: ObjectRef[], right: ObjectRef[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((ref, index) => objectKey(ref) === objectKey(right[index]));
}
