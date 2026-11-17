/** Native link midpoints (not legacy Reroute nodes), shared by the command engine and canvas. */
import type { WorkflowDocumentState } from './codec';

export function rerouteRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function nativeRerouteRecords(raw: unknown): Record<string, unknown>[] {
  const doc = rerouteRecord(raw); const extra = rerouteRecord(doc?.extra);
  const list = Array.isArray(doc?.reroutes) ? doc.reroutes : Array.isArray(extra?.reroutes) ? extra.reroutes : [];
  return list.flatMap(value => { const point = rerouteRecord(value); return point && point.id != null ? [point] : []; });
}

export function nativeReroutePosition(point: Record<string, unknown>): { x: number; y: number } | undefined {
  const pos = point.pos;
  const x = Array.isArray(pos) ? pos[0] : rerouteRecord(pos)?.['0'];
  const y = Array.isArray(pos) ? pos[1] : rerouteRecord(pos)?.['1'];
  return typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y) ? { x, y } : undefined;
}

/** Keep the format/location already present, including untouched future fields in the raw list. */
export function writeNativeReroutes(document: WorkflowDocumentState, list: unknown[]): void {
  if (Array.isArray(document.raw.reroutes) || (document.formatVersion === 1 && !Array.isArray(rerouteRecord(document.raw.extra)?.reroutes))) document.raw.reroutes = list;
  else document.raw.extra = { ...rerouteRecord(document.raw.extra), reroutes: list };
}

export function nativeRerouteList(raw: Record<string, unknown>): unknown[] {
  const extra = rerouteRecord(raw.extra);
  return Array.isArray(raw.reroutes) ? raw.reroutes : Array.isArray(extra?.reroutes) ? extra.reroutes : [];
}

/** Local ids never repeat after Undo; older files may omit the counter but still hold points. */
export function lastNativeRerouteId(raw: unknown): number {
  const stored = rerouteRecord(rerouteRecord(raw)?.state)?.lastRerouteId;
  const ids = [stored, ...nativeRerouteRecords(raw).map(point => point.id)];
  return ids.reduce<number>((max, id) => /^\d+$/.test(String(id)) && Number.isSafeInteger(Number(id)) ? Math.max(max, Number(id)) : max, 0);
}

export function rememberNativeRerouteId(document: WorkflowDocumentState, id: number): WorkflowDocumentState {
  return { ...document, raw: { ...document.raw, state: { ...rerouteRecord(document.raw.state), lastRerouteId: Math.max(lastNativeRerouteId(document.raw), id) } } };
}

export function nativeEdgeLinkId(edge: { id: string; data?: Record<string, unknown> }): string {
  const native = edge.data?.comfyLink;
  return String((Array.isArray(native) ? native[0] : rerouteRecord(native)?.id) ?? edge.data?.linkId ?? edge.id.replace(/^link-/, ''));
}
