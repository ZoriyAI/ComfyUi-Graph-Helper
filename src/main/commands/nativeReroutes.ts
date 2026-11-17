/** Edits one native reroute chain without changing the execution graph's node/slot connections. */
import type { GraphMutation } from '../../shared/commands/types';
import { edgeToLink, type GraphSnapshot } from '../../shared/workflow/codec';
import { nativeEdgeLinkId, nativeRerouteList, nativeRerouteRecords, lastNativeRerouteId, rememberNativeRerouteId, rerouteRecord, writeNativeReroutes } from '../../shared/workflow/nativeReroutes';

type RerouteMutation = Extract<GraphMutation, { type: 'add-native-reroute' | 'move-native-reroute' | 'remove-native-reroute' }>;
export const isNativeRerouteMutation = (payload: GraphMutation): payload is RerouteMutation => ['add-native-reroute', 'move-native-reroute', 'remove-native-reroute'].includes(payload.type);
export class NativeRerouteError extends Error {}
const setParent = (record: Record<string, unknown>, parent: unknown) => { if (parent == null) delete record.parentId; else record.parentId = parent; };
const sameId = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b);

export function applyNativeReroute(snapshot: GraphSnapshot, payload: RerouteMutation): { snapshot: GraphSnapshot; result: Record<string, unknown> } {
  const work = { ...snapshot, edges: structuredClone(snapshot.edges), document: structuredClone(snapshot.document) };
  if (!work.document) throw new NativeRerouteError('Workflow was not found.');
  const doc = work.document;
  const beforeCounter = lastNativeRerouteId(doc.raw);
  const points = nativeRerouteRecords(doc.raw);
  const extra = rerouteRecord(doc.raw.extra);
  const extensions = Array.isArray(extra?.linkExtensions) ? extra.linkExtensions : [];
  const edgeParent = (edge: typeof work.edges[number]) => rerouteRecord(edge.data?.comfyLink)?.parentId
    ?? extensions.map(rerouteRecord).find(item => item && sameId(item.id, nativeEdgeLinkId(edge as { id: string; data?: Record<string, unknown> })))?.parentId;
  const setEdgeParent = (edge: typeof work.edges[number], parent: unknown) => {
    const native = edge.data?.comfyLink;
    const id = nativeEdgeLinkId(edge as { id: string; data?: Record<string, unknown> });
    const record = doc.formatVersion === 1 ? rerouteRecord(edgeToLink(edge, 1))! : rerouteRecord(native);
    if (record) setParent(record, parent);
    if (doc.formatVersion === 1) edge.data = { ...edge.data, comfyLink: record };
    else {
      // Tuple links have no parentId slot; 0.4 stores it separately.
      let extension = extensions.map(rerouteRecord).find(item => item && sameId(item.id, id));
      if (!extension && parent != null) { extension = { id: /^\d+$/.test(id) ? Number(id) : id }; extensions.push(extension); }
      if (extension) setParent(extension, parent);
      doc.raw.extra = { ...rerouteRecord(doc.raw.extra), linkExtensions: extensions };
    }
    // Some files carry both representations. Keep a pre-existing extension in agreement.
    for (const extension of extensions.map(rerouteRecord)) if (extension && sameId(extension.id, id)) setParent(extension, parent);
  };
  if (payload.type === 'add-native-reroute') {
    const edge = work.edges.find(item => item.id === payload.edgeId);
    if (!edge) throw new NativeRerouteError('Link was not found.');
    const id = lastNativeRerouteId(doc.raw) + 1;
    if (!Number.isSafeInteger(id)) throw new NativeRerouteError('Reroute id limit was reached.');
    const linkId = nativeEdgeLinkId(edge as { id: string; data?: Record<string, unknown> });
    const point: Record<string, unknown> = { id, pos: [payload.x, payload.y], linkIds: [/^\d+$/.test(linkId) ? Number(linkId) : linkId] };
    setParent(point, edgeParent(edge));
    writeNativeReroutes(doc, [...nativeRerouteList(doc.raw), point]);
    setEdgeParent(edge, id);
    work.document = rememberNativeRerouteId(doc, id);
    return { snapshot: work, result: { rerouteId: String(id), edgeId: edge.id } };
  }
  const point = points.find(item => sameId(item.id, payload.rerouteId));
  if (!point) throw new NativeRerouteError('Reroute point was not found.');
  if (payload.type === 'move-native-reroute') point.pos = [payload.x, payload.y];
  else {
    // Shared branches bypass the removed point; all node/slot ends and unknown point/link fields remain intact.
    for (const child of points) if (sameId(child.parentId, point.id)) setParent(child, point.parentId);
    for (const edge of work.edges) if (sameId(edgeParent(edge), point.id)) setEdgeParent(edge, point.parentId);
    for (const extension of extensions.map(rerouteRecord)) if (extension && sameId(extension.parentId, point.id)) setParent(extension, point.parentId);
    for (const value of Array.isArray(doc.raw.floatingLinks) ? doc.raw.floatingLinks : []) {
      const link = rerouteRecord(value); if (link && sameId(link.parentId, point.id)) setParent(link, point.parentId);
    }
    writeNativeReroutes(doc, nativeRerouteList(doc.raw).filter(item => !sameId(rerouteRecord(item)?.id, point.id)));
    work.document = rememberNativeRerouteId(doc, beforeCounter);
  }
  return { snapshot: work, result: { rerouteId: String(point.id) } };
}
