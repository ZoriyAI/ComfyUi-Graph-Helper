import { alg, Graph } from '@dagrejs/graphlib';

export interface CycleEdge {
  source: string;
  target: string;
}

function directedGraph(edges: readonly CycleEdge[], nodeIds?: readonly string[]): Graph {
  const graph = new Graph({ directed: true, multigraph: false });
  if (nodeIds) for (const id of nodeIds) graph.setNode(id);
  for (const edge of edges) graph.setEdge(String(edge.source), String(edge.target));
  return graph;
}

/** True when source → target closes a cycle, including a direct self-loop. */
export function createsCycle(edges: readonly CycleEdge[], source: string, target: string): boolean {
  if (source === target) return true;
  const graph = directedGraph(edges, [source, target]);
  const reached = alg.dijkstra(graph, target);
  return reached[source]?.distance < Number.POSITIVE_INFINITY;
}

/** Cyclic strongly connected components, as participating node ids (not traversal order). */
export function graphCycles(nodes: readonly string[], edges: readonly CycleEdge[]): string[][] {
  return alg.findCycles(directedGraph(edges, nodes));
}
