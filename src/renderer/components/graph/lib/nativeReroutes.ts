/**
 * The native reroute points of the links on the canvas (ComfyUI's link midpoints: `reroutes` and the links'
 * `parentId`, or extra.reroutes / extra.linkExtensions). The command engine saves edits; a gesture preview is
 * shared by every branch until release. Used by TypedEdge and NativeRerouteLayer.
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import { useGraphStore } from '../../../state/graphState';
import { reroutePaths, type ReroutePoint } from '../../../../shared/workflow/comfyLook';
import { nativeEdgeLinkId, nativeReroutePosition, nativeRerouteRecords } from '../../../../shared/workflow/nativeReroutes';
import { originIsCurrent, type EditOrigin } from './editOrigin';

export const useReroutePreview = create<{ value: (ReroutePoint & { origin: EditOrigin }) | null }>(() => ({ value: null }));

/**
 * One computed table for the last raw workflow and edge list: every edge asks for its points on every store change,
 * and the store keeps the same objects until the graph really changes.
 */
let cacheKey: { raw: unknown; edges: unknown } | null = null;
let cache = new Map<string, ReroutePoint[]>();

/** Reroute points of every link, keyed by edge id (`link-<native link id>`). */
function pointsByEdge(raw: unknown, edges: ReadonlyArray<{ id: string; data?: Record<string, unknown> }>): Map<string, ReroutePoint[]> {
  if (cacheKey && cacheKey.raw === raw && cacheKey.edges === edges) return cache;
  const links = edges.map((edge) => {
    const stored = edge.data?.comfyLink as Record<string, unknown> | unknown[] | undefined;
    const id = nativeEdgeLinkId(edge);
    const parentId = stored && !Array.isArray(stored) ? stored.parentId : undefined;
    return { id, parentId };
  });
  const byLink = reroutePaths(raw, links);
  const next = new Map<string, ReroutePoint[]>();
  for (const edge of edges) { const points = byLink.get(nativeEdgeLinkId(edge)); if (points) next.set(edge.id, points); }
  cacheKey = { raw, edges };
  cache = next;
  return next;
}

/** The reroute points of one link of the level on screen (the main canvas or the open subgraph), start to end. */
export function useReroutePoints(edgeId: string): ReroutePoint[] | undefined {
  const points = useGraphStore((state) => {
    if (!state.activeSubgraphId) return pointsByEdge(state.document?.raw, state.edges as never).get(edgeId);
    const definition = state.subgraphs.find((item) => item.id === state.activeSubgraphId);
    return definition && !definition.opaque ? pointsByEdge(definition.raw, definition.edges as never).get(edgeId) : undefined;
  });
  const preview = useReroutePreview(state => state.value && points?.some(point => point.id === state.value!.id) ? state.value : null);
  return useMemo(() => preview && originIsCurrent(preview.origin)
    ? points?.map(point => point.id === preview.id ? { ...point, x: preview.x, y: preview.y } : point) : points, [points, preview]);
}

/** Each point is rendered once even when several links share it. */
export function useNativeReroutes(): ReroutePoint[] {
  const raw = useGraphStore(state => state.activeSubgraphId ? state.subgraphs.find(item => item.id === state.activeSubgraphId)?.raw : state.document?.raw);
  return useMemo(() => nativeRerouteRecords(raw).flatMap(point => {
    const position = nativeReroutePosition(point); return position ? [{ id: String(point.id), ...position }] : [];
  }), [raw]);
}

/** A link drawn through its reroute points: a gentle curve from each point to the next, left to right. */
export function pathThrough(points: Array<{ x: number; y: number }>): string {
  let path = `M ${points[0].x},${points[0].y}`;
  for (let at = 1; at < points.length; at += 1) {
    const a = points[at - 1];
    const b = points[at];
    // Handles reach half the gap, at least 24 units, so a short or backward hop still leaves and enters horizontally.
    const dx = Math.max(Math.abs(b.x - a.x) / 2, 24);
    path += ` C ${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
  }
  return path;
}
