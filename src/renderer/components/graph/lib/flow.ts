/**
 * Which edges show moving pulses (layers/FlowLayer.tsx draws them on TypedEdge). CanvasFlow asks it for the canvas;
 * lessons/lessonModel.ts uses the same rule for lesson steps. Pure, so it is tested without React.
 */
import type { ObjectRef } from '../../../../shared/contracts/objects';

/** An edge as the pulse rule needs it. */
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/**
 * Edges that carry pulses right now: the explained object (focusRef), selected edges, and the edges into
 * the node a tour or a build step is showing. One set, so one animation answers one question at a time.
 */
export function flowingEdges(
  edges: FlowEdge[],
  input: { focus: ObjectRef | null; selectedEdges: string[]; stepNodeId: string | null },
): Set<string> {
  const out = new Set<string>(input.selectedEdges);
  const focus = input.focus;
  if (focus?.kind === 'edge') out.add(focus.id);
  if (focus?.kind === 'node') {
    for (const edge of edges) if (edge.source === focus.id || edge.target === focus.id) out.add(edge.id);
  }
  if (focus?.kind === 'port' && focus.nodeId) {
    // A port ref id is usually `${nodeId}:${handle}`; otherwise the port name is used as the handle.
    const handle = focus.id.startsWith(`${focus.nodeId}:`) ? focus.id.slice(focus.nodeId.length + 1) : focus.portName;
    for (const edge of edges) {
      if (focus.direction === 'output' && edge.source === focus.nodeId && edge.sourceHandle === handle) out.add(edge.id);
      if (focus.direction === 'input' && edge.target === focus.nodeId && edge.targetHandle === handle) out.add(edge.id);
    }
  }
  if (input.stepNodeId) {
    for (const edge of edges) if (edge.target === input.stepNodeId) out.add(edge.id);
  }
  // Only edges that exist on the level on screen.
  const known = new Set(edges.map((edge) => edge.id));
  return new Set([...out].filter((id) => known.has(id)));
}
