/** What a new projection added, for the reveal animation and the step-by-step build. */
export interface Identified {
  id: string;
}

export interface EdgeLike extends Identified {
  source: string;
  target: string;
}

export interface GraphDiff {
  addedNodes: string[];
  addedEdges: string[];
}

export function diffGraph(previous: { nodes: Identified[]; edges: Identified[] }, next: { nodes: Identified[]; edges: Identified[] }): GraphDiff {
  const nodes = new Set(previous.nodes.map((node) => node.id));
  const edges = new Set(previous.edges.map((edge) => edge.id));
  return {
    addedNodes: next.nodes.map((node) => node.id).filter((id) => !nodes.has(id)),
    addedEdges: next.edges.map((edge) => edge.id).filter((id) => !edges.has(id)),
  };
}

export interface RevealStep {
  kind: 'node' | 'edge';
  id: string;
}

/**
 * Build order for one batch: each node, then the new edges that end at it once both ends are visible.
 * Edges whose ends were already on the canvas come first, since nothing else has to appear for them.
 */
export function revealSteps(diff: GraphDiff, edges: EdgeLike[]): RevealStep[] {
  const newNodes = new Set(diff.addedNodes);
  const added = new Set(diff.addedEdges);
  const newEdges = edges.filter((edge) => added.has(edge.id));
  const steps: RevealStep[] = [];
  const shown = new Set<string>();
  const placed = new Set<string>();
  let waiting = newEdges;
  const flush = () => {
    if (waiting.length === 0) return;
    const still: EdgeLike[] = [];
    for (const edge of waiting) {
      if (placed.has(edge.id)) continue;
      const sourceReady = !newNodes.has(edge.source) || shown.has(edge.source);
      const targetReady = !newNodes.has(edge.target) || shown.has(edge.target);
      if (sourceReady && targetReady) {
        steps.push({ kind: 'edge', id: edge.id });
        placed.add(edge.id);
      } else {
        still.push(edge);
      }
    }
    waiting = still;
  };
  flush();
  for (const id of diff.addedNodes) {
    steps.push({ kind: 'node', id });
    shown.add(id);
    flush();
  }
  return steps;
}

/** Nodes present in both graphs whose data changed (a parameter, a title, ports): what an agent edit touched. */
export function changedNodes(previous: Array<Identified & { data?: unknown }>, next: Array<Identified & { data?: unknown }>): string[] {
  const before = new Map(previous.map((node) => [node.id, JSON.stringify(node.data ?? null)]));
  return next.filter((node) => before.has(node.id) && before.get(node.id) !== JSON.stringify(node.data ?? null)).map((node) => node.id);
}
