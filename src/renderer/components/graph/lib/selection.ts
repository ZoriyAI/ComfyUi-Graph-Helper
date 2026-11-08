import type { ObjectRef } from '../../../../shared/contracts/objects';

interface SelectableNode {
  id: string;
  selected?: boolean;
  data?: { comfyType?: unknown; kind?: unknown; subgraphId?: unknown };
}

interface SelectableEdge {
  id: string;
  selected?: boolean;
}

export function nodeRef(node: SelectableNode): ObjectRef {
  const classType = typeof node.data?.comfyType === 'string' ? node.data.comfyType : undefined;
  return { kind: 'node', id: node.id, ...(classType ? { classType } : {}) };
}

export function portRef(nodeId: string, handle: string, direction: 'input' | 'output', portName?: string): ObjectRef {
  return { kind: 'port', id: `${nodeId}:${handle}`, nodeId, portName: portName ?? handle, direction };
}

/** The canvas selection as ObjectRefs for uiState: nodes first, then edges, then an optional focused port. */
export function selectionRefs(nodes: SelectableNode[], edges: SelectableEdge[], port?: ObjectRef | null): ObjectRef[] {
  const refs: ObjectRef[] = [
    ...nodes.filter((node) => node.selected).map(nodeRef),
    ...edges.filter((edge) => edge.selected).map((edge): ObjectRef => ({ kind: 'edge', id: edge.id })),
  ];
  if (port) refs.push(port);
  return refs;
}

export function sameRefs(left: ObjectRef[], right: ObjectRef[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((ref, index) => ref.kind === right[index].kind && ref.id === right[index].id);
}
