/** Reroute ids belong to one graph level. Moving nodes must move their routing chains too. */
import type { SubgraphDefinition } from '../../shared/graph/subgraphs';
import type { GraphSnapshot, WorkflowDocumentState } from '../../shared/workflow/codec';
import { edgeToLink } from '../../shared/workflow/codec';
import { lastNativeRerouteId, nativeEdgeLinkId, nativeRerouteList, nativeReroutePosition, nativeRerouteRecords, rememberNativeRerouteId, rerouteRecord, writeNativeReroutes } from '../../shared/workflow/nativeReroutes';

type Edge = GraphSnapshot['edges'][number];
type Point = Record<string, unknown>;
export type RerouteSource = { edge: Edge; inner: boolean };
export class RerouteTransferError extends Error {}

function chain(raw: Record<string, unknown>, edge: Edge): Point[] {
  const extensions = rerouteRecord(raw.extra)?.linkExtensions;
  const parent = rerouteRecord(edge.data?.comfyLink)?.parentId ?? (Array.isArray(extensions)
    ? extensions.map(rerouteRecord).find(item => item && String(item.id) === nativeEdgeLinkId(edge as { id: string }))?.parentId : undefined);
  const byId = new Map(nativeRerouteRecords(raw).map(point => [String(point.id), point]));
  const seen = new Set<string>(); const result: Point[] = [];
  let id = parent;
  while (id != null && !seen.has(String(id))) {
    seen.add(String(id)); const point = byId.get(String(id)); if (!point) break;
    result.unshift(point); id = point.parentId;
  }
  return result;
}

function removeMovedLinks(document: WorkflowDocumentState, removed: Edge[], remaining: Edge[]): void {
  const raw = document.raw;
  if (!nativeRerouteList(raw).length && !Array.isArray(rerouteRecord(raw.extra)?.linkExtensions)) return;
  const counter = lastNativeRerouteId(raw);
  const ids = new Set(removed.map(edge => nativeEdgeLinkId(edge as { id: string })));
  const movedPoints = new Set(removed.flatMap(edge => chain(raw, edge).map(point => String(point.id))));
  const keptPoints = new Set(remaining.flatMap(edge => chain(raw, edge).map(point => String(point.id))));
  // Floating links and future/stale link ids stay on their original level, with their ancestors.
  const byId = new Map(nativeRerouteRecords(raw).map(point => [String(point.id), point]));
  const keepAncestors = (id: unknown) => {
    const visited = new Set<string>();
    while (id != null && !visited.has(String(id))) {
      visited.add(String(id)); keptPoints.add(String(id)); id = byId.get(String(id))?.parentId;
    }
  };
  for (const point of byId.values()) {
    if (!movedPoints.has(String(point.id)) || (Array.isArray(point.linkIds) && point.linkIds.some(id => !ids.has(String(id))))) keepAncestors(point.id);
  }
  for (const link of Array.isArray(raw.floatingLinks) ? raw.floatingLinks : []) keepAncestors(rerouteRecord(link)?.parentId);
  writeNativeReroutes(document, nativeRerouteList(raw).flatMap(value => {
    const point = rerouteRecord(value); if (!point) return [value];
    if (movedPoints.has(String(point.id)) && !keptPoints.has(String(point.id))) return [];
    return [{ ...point, ...(Array.isArray(point.linkIds) ? { linkIds: point.linkIds.filter(id => !ids.has(String(id))) } : {}) }];
  }));
  const extra = rerouteRecord(raw.extra);
  if (Array.isArray(extra?.linkExtensions)) raw.extra = { ...extra, linkExtensions: extra.linkExtensions.filter(value => !ids.has(String(rerouteRecord(value)?.id))) };
  raw.state = { ...rerouteRecord(raw.state), lastRerouteId: counter };
}

/** Chains shared with an outer edge are copied, because the two graphs have independent id spaces. */
export function wrapReroutes(work: GraphSnapshot, definition: SubgraphDefinition, innerEdges: Edge[]): void {
  if (!work.document || !innerEdges.length) return;
  const raw = work.document.raw; const ids = new Set(innerEdges.map(edge => nativeEdgeLinkId(edge as { id: string })));
  const points = new Map<string, Point>();
  for (const edge of innerEdges) {
    const path = chain(raw, edge);
    for (const point of path) {
      let copy = points.get(String(point.id));
      if (!copy) { copy = { ...structuredClone(point), linkIds: (Array.isArray(point.linkIds) ? point.linkIds : []).filter(id => ids.has(String(id))) }; points.set(String(point.id), copy); }
      const linkId = nativeEdgeLinkId(edge as { id: string });
      const links = copy.linkIds as unknown[];
      if (!links.some(id => String(id) === linkId)) links.push(/^\d+$/.test(linkId) ? Number(linkId) : linkId);
    }
    if (path.length) edge.data = { ...edge.data, comfyLink: { ...rerouteRecord(edgeToLink(edge, 1)), parentId: path.at(-1)!.id } };
  }
  if (!points.size) return;
  definition.raw.reroutes = [...points.values()];
  const extensions = rerouteRecord(raw.extra)?.linkExtensions;
  if (Array.isArray(extensions)) definition.raw.extra = { ...rerouteRecord(definition.raw.extra), linkExtensions: structuredClone(extensions.filter(value => ids.has(String(rerouteRecord(value)?.id)))) };
  definition.raw.state = { ...rerouteRecord(definition.raw.state), lastRerouteId: lastNativeRerouteId(definition.raw) };
  removeMovedLinks(work.document, innerEdges, work.edges.filter(edge => !innerEdges.includes(edge)));
}

/** Rebuild chains in execution order when the boundary disappears; never reuse another level's point id. */
export function dissolveReroutes(
  work: GraphSnapshot, definition: SubgraphDefinition, replaced: Edge[], created: Array<{ edge: Edge; sources: RerouteSource[] }>, dx: number, dy: number,
): void {
  if (!work.document) return;
  const doc = work.document; const original = structuredClone(doc.raw);
  if (!nativeRerouteList(original).length && !nativeRerouteList(definition.raw).length) return;
  let counter = lastNativeRerouteId(original);
  const copies = new Map<string, Point>();
  const extensions: Point[] = [];
  for (const item of created) {
    let parent: unknown;
    const linkId = nativeEdgeLinkId(item.edge as { id: string });
    for (const source of item.sources) {
      for (const point of chain(source.inner ? definition.raw : original, source.edge)) {
        const key = JSON.stringify([source.inner, point.id, parent ?? null]);
        let copy = copies.get(key);
        if (!copy) {
          if (!Number.isSafeInteger(counter + 1)) throw new RerouteTransferError('Reroute id limit was reached.');
          copy = { ...structuredClone(point), id: ++counter, linkIds: [] };
          delete copy.parentId;
          if (parent != null) copy.parentId = parent;
          const pos = nativeReroutePosition(point);
          if (source.inner && pos) copy.pos = [pos.x + dx, pos.y + dy];
          copies.set(key, copy);
        }
        const links = copy.linkIds as unknown[];
        if (!links.some(id => String(id) === linkId)) links.push(/^\d+$/.test(linkId) ? Number(linkId) : linkId);
        parent = copy.id;
      }
    }
    const native = { ...rerouteRecord(edgeToLink(item.edge, 1)) };
    delete native.parentId;
    if (parent != null) native.parentId = parent;
    if (doc.formatVersion === 1) item.edge.data = { ...item.edge.data, comfyLink: native };
    if (parent != null) {
      const sourceExtensions = item.sources.flatMap(source => {
        const list = rerouteRecord((source.inner ? definition.raw : original).extra)?.linkExtensions;
        const extension = Array.isArray(list) ? list.map(rerouteRecord).find(value => value && String(value.id) === nativeEdgeLinkId(source.edge as { id: string })) : undefined;
        return extension ? [extension] : [];
      });
      if (doc.formatVersion !== 1 || sourceExtensions.length) extensions.push({ ...Object.assign({}, ...sourceExtensions), id: native.id, parentId: parent });
    }
  }
  removeMovedLinks(doc, replaced, work.edges.filter(edge => !replaced.includes(edge)));
  if (extensions.length) {
    const extra = rerouteRecord(doc.raw.extra); const previous = Array.isArray(extra?.linkExtensions) ? extra.linkExtensions : [];
    doc.raw.extra = { ...extra, linkExtensions: [...previous, ...extensions] };
  }
  if (copies.size) {
    writeNativeReroutes(doc, [...nativeRerouteList(doc.raw), ...copies.values()]);
    work.document = rememberNativeRerouteId(doc, counter);
  }
}
