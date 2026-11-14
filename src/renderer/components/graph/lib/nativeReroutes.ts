import { useGraphStore } from '../../../state/graphState';
import { reroutePaths, type ReroutePoint } from '../../../../shared/workflow/comfyLook';

/**
 * The native reroute points of the links on the main canvas (ComfyUI's link midpoints: `reroutes` and the links'
 * `parentId`, or extra.reroutes / extra.linkExtensions). Read-only: the file keeps them and export writes them
 * back as they were; the canvas draws each link through its points.
 */
let cacheKey: { raw: unknown; edges: unknown } | null = null;
let cache = new Map<string, ReroutePoint[]>();

function pointsByEdge(raw: unknown, edges: ReadonlyArray<{ id: string; data?: Record<string, unknown> }>): Map<string, ReroutePoint[]> {
  if (cacheKey && cacheKey.raw === raw && cacheKey.edges === edges) return cache;
  const links = edges.map((edge) => {
    const stored = edge.data?.comfyLink as Record<string, unknown> | unknown[] | undefined;
    const id = edge.id.startsWith('link-') ? edge.id.slice(5) : edge.id;
    const parentId = stored && !Array.isArray(stored) ? stored.parentId : undefined;
    return { id, parentId };
  });
  const byLink = reroutePaths(raw, links);
  const next = new Map<string, ReroutePoint[]>();
  for (const [linkId, points] of byLink) next.set(`link-${linkId}`, points);
  cacheKey = { raw, edges };
  cache = next;
  return next;
}

/** The reroute points of one link of the level on screen (the main canvas or the open subgraph), start to end. */
export function useReroutePoints(edgeId: string): ReroutePoint[] | undefined {
  return useGraphStore((state) => {
    if (!state.activeSubgraphId) return pointsByEdge(state.document?.raw, state.edges as never).get(edgeId);
    const definition = state.subgraphs.find((item) => item.id === state.activeSubgraphId);
    return definition && !definition.opaque ? pointsByEdge(definition.raw, definition.edges as never).get(edgeId) : undefined;
  });
}

/** A link drawn through its reroute points: a gentle curve from each point to the next, left to right. */
export function pathThrough(points: Array<{ x: number; y: number }>): string {
  let path = `M ${points[0].x},${points[0].y}`;
  for (let at = 1; at < points.length; at += 1) {
    const a = points[at - 1];
    const b = points[at];
    const dx = Math.max(Math.abs(b.x - a.x) / 2, 24);
    path += ` C ${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
  }
  return path;
}
