/**
 * How large a graph the app opens. A workflow or project file from anywhere is opened only up to this size: a file
 * with tens of thousands of nodes made the window unusable at every later start (the canvas could not draw it).
 * The biggest of 1335 real workflows looked at has 603 nodes and 1187 links, so the limit leaves real files well
 * inside it. Measured on a loaded 4-core machine, the canvas took 17 s to draw 1000 nodes and almost two minutes
 * for 3000. Nodes and links inside subgraph definitions count too.
 */
export const GRAPH_NODE_LIMIT = 1500;
export const GRAPH_LINK_LIMIT = 3000;

/** The fixed sentence main sends back for a graph over the limit; the window translates it (i18n translatePattern). */
export const GRAPH_TOO_LARGE = /^The graph is too large to open: (\d+) nodes, (\d+) links\.$/;

export function graphTooLargeError(nodes: number, links: number): string {
  return `The graph is too large to open: ${nodes} nodes, ${links} links.`;
}

interface Countable {
  nodes?: unknown;
  edges?: unknown;
  subgraphs?: unknown;
}

function length(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/** Nodes and links of a snapshot, those inside subgraph definitions included. */
export function graphSize(snapshot: Countable | null | undefined): { nodes: number; links: number } {
  let nodes = length(snapshot?.nodes);
  let links = length(snapshot?.edges);
  if (Array.isArray(snapshot?.subgraphs)) {
    for (const definition of snapshot!.subgraphs as unknown[]) {
      if (!definition || typeof definition !== 'object') continue;
      const record = definition as Record<string, unknown>;
      nodes += length(record.nodes);
      links += length(record.edges);
      // A definition the app keeps verbatim still holds its nodes and links in its raw form.
      const raw = record.raw && typeof record.raw === 'object' ? record.raw as Record<string, unknown> : null;
      if (record.opaque === true && raw) {
        nodes += length(raw.nodes);
        links += length(raw.links);
      }
    }
  }
  return { nodes, links };
}

/** The refusal sentence for a snapshot over the limit, or null when it fits. */
export function graphLimitError(snapshot: Countable | null | undefined): string | null {
  const size = graphSize(snapshot);
  return size.nodes > GRAPH_NODE_LIMIT || size.links > GRAPH_LINK_LIMIT ? graphTooLargeError(size.nodes, size.links) : null;
}
