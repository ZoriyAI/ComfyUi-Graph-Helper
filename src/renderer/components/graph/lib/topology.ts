/**
 * Graph topology helpers for the guided tour and the step-by-step build.
 * Pure: no React, no stores, so tests drive them directly.
 */
export interface TopoNode {
  id: string;
  position?: { x: number; y: number };
}

export interface TopoEdge {
  source: string;
  target: string;
}

function byPosition(nodes: Map<string, TopoNode>) {
  return (left: string, right: string) => {
    const a = nodes.get(left)?.position ?? { x: 0, y: 0 };
    const b = nodes.get(right)?.position ?? { x: 0, y: 0 };
    if (a.x !== b.x) return a.x - b.x;
    if (a.y !== b.y) return a.y - b.y;
    return left.localeCompare(right);
  };
}

/**
 * Kahn's order from loaders (no incoming edges) to outputs. Ties break left-to-right, then top-to-bottom,
 * then by id, so the same graph always gives the same tour. Nodes on a cycle come last, in position order.
 */
export function topologicalOrder(nodes: TopoNode[], edges: TopoEdge[]): string[] {
  const lookup = new Map(nodes.map((node) => [node.id, node]));
  const indegree = new Map<string, number>(nodes.map((node) => [node.id, 0]));
  const next = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (!lookup.has(edge.source) || !lookup.has(edge.target) || edge.source === edge.target) continue;
    next.get(edge.source)!.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }
  const compare = byPosition(lookup);
  const ready = [...indegree.entries()].filter(([, count]) => count === 0).map(([id]) => id).sort(compare);
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const target of next.get(id) ?? []) {
      const left = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, left);
      if (left === 0) {
        ready.push(target);
        ready.sort(compare);
      }
    }
  }
  if (order.length < nodes.length) {
    const seen = new Set(order);
    order.push(...nodes.map((node) => node.id).filter((id) => !seen.has(id)).sort(compare));
  }
  return order;
}

/** Edges that end at `nodeId`: what the tour pulses into the current step. */
export function incomingEdgeIds(nodeId: string, edges: Array<TopoEdge & { id: string }>): string[] {
  return edges.filter((edge) => edge.target === nodeId).map((edge) => edge.id);
}
