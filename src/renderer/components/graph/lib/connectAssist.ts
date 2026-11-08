import { portsCompatible } from '../../../../shared/graph/linkTypes';

export interface AssistPort {
  id: string;
  name: string;
  dataType: string;
}

export interface AssistNode {
  id: string;
  position: { x: number; y: number };
  data: { inputs?: AssistPort[]; outputs?: AssistPort[] };
}

export interface AssistEdge {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/** The port the person asked "what connects here" about. */
export interface ConnectFrom {
  nodeId: string;
  handle: string;
  direction: 'input' | 'output';
  dataType: string;
}

export interface Candidate {
  nodeId: string;
  handle: string;
  direction: 'input' | 'output';
  /** True when the candidate input already has a link (connecting would replace it). */
  taken: boolean;
}

export interface ConnectPlan {
  /** Ports that can take the connection, keyed `${nodeId}:${handle}`. */
  compatible: Set<string>;
  /** Nodes with no compatible port: dimmed while the assist is on. */
  dimmed: Set<string>;
  /** Nearest free compatible port, else nearest taken one. */
  best: Candidate | null;
}

export function portKey(nodeId: string, handle: string): string {
  return `${nodeId}:${handle}`;
}

/**
 * Compatible ports elsewhere on the canvas for a focused port, by ComfyUI's isValidConnection rule.
 * An output pairs with inputs of other nodes; an input pairs with outputs of other nodes.
 */
export function connectCandidates(from: ConnectFrom, nodes: AssistNode[], edges: AssistEdge[]): ConnectPlan {
  const origin = nodes.find((node) => node.id === from.nodeId);
  const compatible = new Set<string>();
  const dimmed = new Set<string>();
  const candidates: Array<Candidate & { distance: number }> = [];
  const takenInputs = new Set(edges.map((edge) => portKey(edge.target, String(edge.targetHandle ?? ''))));
  for (const node of nodes) {
    if (node.id === from.nodeId) continue;
    const ports = from.direction === 'output' ? node.data.inputs ?? [] : node.data.outputs ?? [];
    let any = false;
    for (const port of ports) {
      const ok = from.direction === 'output'
        ? portsCompatible(from.dataType, port.dataType)
        : portsCompatible(port.dataType, from.dataType);
      if (!ok) continue;
      any = true;
      compatible.add(portKey(node.id, port.id));
      const dx = node.position.x - (origin?.position.x ?? 0);
      const dy = node.position.y - (origin?.position.y ?? 0);
      // An input already fed by a link is a worse suggestion than a free one, whatever the distance.
      const taken = from.direction === 'output' && takenInputs.has(portKey(node.id, port.id));
      candidates.push({
        nodeId: node.id,
        handle: port.id,
        direction: from.direction === 'output' ? 'input' : 'output',
        taken,
        distance: Math.hypot(dx, dy),
      });
    }
    if (!any) dimmed.add(node.id);
  }
  candidates.sort((left, right) => Number(left.taken) - Number(right.taken) || left.distance - right.distance
    || left.nodeId.localeCompare(right.nodeId) || left.handle.localeCompare(right.handle));
  const first = candidates[0];
  return { compatible, dimmed, best: first ? { nodeId: first.nodeId, handle: first.handle, direction: first.direction, taken: first.taken } : null };
}

/** The connect mutation for a suggestion, oriented output → input whichever side the person started on. */
export function connectMutation(from: ConnectFrom, to: Candidate): { type: 'connect'; source: string; target: string; sourceHandle: string; targetHandle: string } {
  return from.direction === 'output'
    ? { type: 'connect', source: from.nodeId, sourceHandle: from.handle, target: to.nodeId, targetHandle: to.handle }
    : { type: 'connect', source: to.nodeId, sourceHandle: to.handle, target: from.nodeId, targetHandle: from.handle };
}
