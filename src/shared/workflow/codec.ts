import type { CatalogView } from '../catalog/types';
import type { ComponentRecord, ProcessMeta } from '../components/model';
import { EMPTY_PROCESS } from '../components/model';

export const WORKFLOW_FORMAT_V1 = 1;
export const WORKFLOW_FORMAT_V04 = 0.4;

export type WorkflowFormat = typeof WORKFLOW_FORMAT_V1 | typeof WORKFLOW_FORMAT_V04;

export interface WorkflowDocumentState {
  formatVersion: WorkflowFormat;
  raw: Record<string, unknown>;
}

export interface GraphSnapshot {
  nodes: Array<Record<string, any>>;
  edges: Array<Record<string, any>>;
  document: WorkflowDocumentState | null;
  components?: ComponentRecord[];
  process?: ProcessMeta;
}

/** Keys this app owns. Comfy export drops them at every depth and never writes them. */
export const APP_OWNED_EXPORT_KEYS = new Set([
  'graphHelper',
  'componentRecords',
  'appComponents',
  'comfyGraphHelper',
  'processMeta',
]);

export function omitAppOwned(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => omitAppOwned(item));
  if (!value || typeof value !== 'object') return value;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (APP_OWNED_EXPORT_KEYS.has(key)) continue;
    next[key] = omitAppOwned(child);
  }
  return next;
}

export type { CatalogView } from '../catalog/types';

export interface MissingReport {
  missingNodes: string[];
  missingModels: Array<{ directory: string; name: string }>;
}

export type WorkflowKind = 'ui-v1' | 'ui-v0.4' | 'api-prompt' | 'unknown';

export function classifyWorkflow(document: unknown): WorkflowKind {
  if (!document || typeof document !== 'object' || Array.isArray(document)) return 'unknown';
  const record = document as Record<string, unknown>;
  if (isApiPrompt(record)) return 'api-prompt';
  if (!Array.isArray(record.nodes)) return 'unknown';
  if (record.version === WORKFLOW_FORMAT_V1 && record.state && typeof record.state === 'object') return 'ui-v1';
  if (record.version === WORKFLOW_FORMAT_V04) return linksLookLikeTuples(record.links) ? 'ui-v0.4' : 'unknown';
  if (record.version == null && linksLookLikeTuples(record.links)) return 'ui-v0.4';
  return 'unknown';
}

function linksLookLikeTuples(links: unknown): boolean {
  if (links == null) return true;
  if (!Array.isArray(links)) return false;
  return links.every((link) => Array.isArray(link));
}

function isApiPrompt(record: Record<string, unknown>): boolean {
  if (Array.isArray(record.nodes) || 'version' in record) return false;
  const values = Object.values(record);
  if (values.length === 0) return false;
  return values.every((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const node = value as Record<string, unknown>;
    return typeof node.class_type === 'string' && node.inputs !== undefined && typeof node.inputs === 'object';
  });
}

function readPos(pos: unknown): { x: number; y: number } {
  if (Array.isArray(pos)) return { x: numberOrZero(pos[0]), y: numberOrZero(pos[1]) };
  if (pos && typeof pos === 'object') {
    const record = pos as Record<string, unknown>;
    if ('0' in record && '1' in record) return { x: numberOrZero(record['0']), y: numberOrZero(record['1']) };
    if (typeof record.x === 'number' && typeof record.y === 'number') return { x: record.x, y: record.y };
  }
  return { x: 0, y: 0 };
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function writePos(original: unknown, position: { x: number; y: number }): unknown {
  if (Array.isArray(original)) {
    const copy = original.slice();
    copy[0] = position.x;
    copy[1] = position.y;
    return copy;
  }
  if (original && typeof original === 'object') {
    const record = { ...(original as Record<string, unknown>) };
    if ('x' in record && 'y' in record && !('0' in record)) {
      record.x = position.x;
      record.y = position.y;
      return record;
    }
    record['0'] = position.x;
    record['1'] = position.y;
    return record;
  }
  return [position.x, position.y];
}

function dataTypeOf(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? 'unknown');
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return 'unknown';
}

function portsFrom(slots: unknown, kind: 'in' | 'out'): Array<{ id: string; name: string; dataType: string; optional: boolean }> {
  if (!Array.isArray(slots)) return [];
  return slots.map((slot, index) => {
    const record = slot && typeof slot === 'object' ? (slot as Record<string, unknown>) : {};
    const slotIndex = record.slot_index ?? index;
    return {
      id: `${kind}-${String(slotIndex)}`,
      name: typeof record.name === 'string' ? record.name : `${kind}-${index}`,
      dataType: dataTypeOf(record.type),
      optional: false,
    };
  });
}

function parametersFrom(widgets: unknown): Record<string, unknown> {
  if (widgets && typeof widgets === 'object' && !Array.isArray(widgets)) {
    return { ...(widgets as Record<string, unknown>) };
  }
  return {};
}

interface NormalLink {
  id: number | string;
  originId: string;
  originSlot: string;
  targetId: string;
  targetSlot: string;
  dataType: string;
  raw: unknown;
}

function readLink(link: unknown): NormalLink | null {
  if (Array.isArray(link) && link.length >= 6) {
    return {
      id: link[0] as number | string,
      originId: String(link[1]),
      originSlot: String(link[2]),
      targetId: String(link[3]),
      targetSlot: String(link[4]),
      dataType: dataTypeOf(link[5]),
      raw: link,
    };
  }
  if (link && typeof link === 'object' && !Array.isArray(link)) {
    const record = link as Record<string, unknown>;
    if (record.origin_id == null || record.target_id == null || record.id == null) return null;
    return {
      id: record.id as number | string,
      originId: String(record.origin_id),
      originSlot: String(record.origin_slot),
      targetId: String(record.target_id),
      targetSlot: String(record.target_slot),
      dataType: dataTypeOf(record.type),
      raw: link,
    };
  }
  return null;
}

export function projectWorkflow(document: unknown): { snapshot: GraphSnapshot } | { error: string } {
  const kind = classifyWorkflow(document);
  if (kind === 'api-prompt') return { error: 'API prompt is not a canvas workflow.' };
  if (kind === 'unknown') return { error: 'Workflow JSON is not UI format 1 or legacy 0.4.' };
  const raw = document as Record<string, unknown>;
  const formatVersion = kind === 'ui-v1' ? WORKFLOW_FORMAT_V1 : WORKFLOW_FORMAT_V04;
  const nodes = (raw.nodes as unknown[]).map((item) => {
    const source = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const inputs = portsFrom(source.inputs, 'in');
    const outputs = portsFrom(source.outputs, 'out');
    return {
      id: String(source.id),
      type: 'comfy',
      position: readPos(source.pos),
      data: {
        comfyType: String(source.type),
        title: typeof source.title === 'string' ? source.title : String(source.type),
        inputs,
        outputs,
        parameters: parametersFrom(source.widgets_values),
        annotations: [],
        comfy: source,
      },
    };
  });
  const edges = (Array.isArray(raw.links) ? raw.links : []).flatMap((link) => {
    const normal = readLink(link);
    if (!normal) return [];
    return [{
      id: `link-${String(normal.id)}`,
      source: normal.originId,
      target: normal.targetId,
      sourceHandle: `out-${normal.originSlot}`,
      targetHandle: `in-${normal.targetSlot}`,
      data: { dataType: normal.dataType, comfyLink: normal.raw },
    }];
  });
  return {
    snapshot: {
      nodes,
      edges,
      document: { formatVersion, raw },
      components: [],
      process: { ...EMPTY_PROCESS },
    },
  };
}

export function numericSlot(handle: unknown): number | null {
  const text = String(handle ?? '');
  const match = /^(?:in|out)-(.*)$/.exec(text);
  const body = match ? match[1] : text;
  return /^\d+$/.test(body) ? Number(body) : null;
}

export function collectNumericIds(values: unknown[]): number[] {
  return values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

export function monotonicCounter(stored: unknown, current: number[]): number {
  const base = typeof stored === 'number' && Number.isFinite(stored) ? stored : 0;
  return current.reduce((max, value) => Math.max(max, value), base);
}

export function nextLinkId(snapshot: GraphSnapshot): number {
  const raw = snapshot.document?.raw;
  const state = raw?.state && typeof raw.state === 'object' ? (raw.state as Record<string, unknown>) : {};
  const fromLinks = Array.isArray(raw?.links)
    ? raw.links.flatMap((link) => {
        if (Array.isArray(link) && typeof link[0] === 'number') return [link[0]];
        if (link && typeof link === 'object' && !Array.isArray(link) && typeof (link as { id?: unknown }).id === 'number') {
          return [(link as { id: number }).id];
        }
        return [];
      })
    : [];
  const fromEdges = snapshot.edges.flatMap((edge) => {
    const ids: number[] = [];
    if (typeof edge.data?.linkId === 'number') ids.push(edge.data.linkId);
    const stored = edge.data?.comfyLink;
    if (Array.isArray(stored) && typeof stored[0] === 'number') ids.push(stored[0]);
    if (stored && typeof stored === 'object' && !Array.isArray(stored) && typeof stored.id === 'number') ids.push(stored.id);
    if (typeof edge.id === 'string' && /^link-\d+$/.test(edge.id)) ids.push(Number(edge.id.slice(5)));
    return ids;
  });
  return monotonicCounter(state.lastLinkId, [typeof raw?.last_link_id === 'number' ? raw.last_link_id : 0, ...fromLinks, ...fromEdges]) + 1;
}

export function rememberLinkId(document: WorkflowDocumentState, linkId: number): WorkflowDocumentState {
  const raw = { ...document.raw };
  if (document.formatVersion === WORKFLOW_FORMAT_V1) {
    const state = raw.state && typeof raw.state === 'object' ? { ...(raw.state as Record<string, unknown>) } : {};
    state.lastLinkId = monotonicCounter(state.lastLinkId, [linkId]);
    raw.state = state;
    return { formatVersion: document.formatVersion, raw };
  }
  raw.last_link_id = monotonicCounter(raw.last_link_id, [linkId]);
  return { formatVersion: document.formatVersion, raw };
}

function slotNumber(handle: unknown): number | string {
  const text = String(handle ?? '');
  const match = /^(?:in|out)-(.*)$/.exec(text);
  const body = match ? match[1] : text;
  return /^-?\d+$/.test(body) ? Number(body) : body;
}

function coerceId(id: unknown, sample: unknown): string | number {
  if (typeof sample === 'number' && /^\d+$/.test(String(id))) return Number(id);
  return String(id);
}

function edgeToLink(edge: Record<string, any>, formatVersion: WorkflowFormat): unknown {
  const stored = edge.data?.comfyLink;
  const originSlot = slotNumber(edge.sourceHandle);
  const targetSlot = slotNumber(edge.targetHandle);
  if (Array.isArray(stored)) {
    const copy = stored.slice();
    copy[1] = coerceId(edge.source, stored[1]);
    copy[2] = originSlot;
    copy[3] = coerceId(edge.target, stored[3]);
    copy[4] = targetSlot;
    if (formatVersion === WORKFLOW_FORMAT_V04) return copy;
    return tupleToObject(copy);
  }
  if (stored && typeof stored === 'object') {
    const record = { ...(stored as Record<string, unknown>) };
    record.origin_id = coerceId(edge.source, record.origin_id);
    record.origin_slot = originSlot;
    record.target_id = coerceId(edge.target, record.target_id);
    record.target_slot = targetSlot;
    if (formatVersion === WORKFLOW_FORMAT_V1) return record;
    return [
      record.id,
      record.origin_id,
      record.origin_slot,
      record.target_id,
      record.target_slot,
      record.type,
    ];
  }
  const parsed = typeof edge.data?.linkId === 'number'
    ? edge.data.linkId
    : typeof edge.id === 'string' && /^link-\d+$/.test(edge.id)
      ? Number(edge.id.slice(5))
      : null;
  const numericId = parsed ?? 0;
  const origin = typeof originSlot === 'number' ? originSlot : 0;
  const target = typeof targetSlot === 'number' ? targetSlot : 0;
  const linkType = typeof edge.data?.dataType === 'string' ? edge.data.dataType : '';
  if (formatVersion === WORKFLOW_FORMAT_V04) {
    return [numericId, coerceId(edge.source, null), origin, coerceId(edge.target, null), target, linkType];
  }
  return {
    id: numericId,
    origin_id: /^\d+$/.test(String(edge.source)) ? Number(edge.source) : edge.source,
    origin_slot: origin,
    target_id: /^\d+$/.test(String(edge.target)) ? Number(edge.target) : edge.target,
    target_slot: target,
    type: linkType,
  };
}

function tupleToObject(tuple: unknown[]): Record<string, unknown> {
  return {
    id: tuple[0],
    origin_id: tuple[1],
    origin_slot: tuple[2],
    target_id: tuple[3],
    target_slot: tuple[4],
    type: tuple[5],
  };
}

function linkEnds(link: unknown): { id: unknown; originId: unknown; originSlot: unknown; targetId: unknown; targetSlot: unknown } | null {
  const normal = readLink(link);
  if (!normal) return null;
  return {
    id: normal.id,
    originId: normal.originId,
    originSlot: normal.originSlot,
    targetId: normal.targetId,
    targetSlot: normal.targetSlot,
  };
}

function syncSlots(node: Record<string, unknown>, links: unknown[]): void {
  const ends = links.map(linkEnds).filter((item): item is NonNullable<typeof item> => item !== null);
  const id = String(node.id);
  if (Array.isArray(node.inputs)) {
    node.inputs = node.inputs.map((input, index) => {
      if (!input || typeof input !== 'object') return input;
      const record = { ...(input as Record<string, unknown>) };
      const slot = String(record.slot_index ?? index);
      const match = ends.find((link) => link.targetId === id && link.targetSlot === slot);
      if ('link' in record || match) record.link = match ? match.id : null;
      return record;
    });
  }
  if (Array.isArray(node.outputs)) {
    node.outputs = node.outputs.map((output, index) => {
      if (!output || typeof output !== 'object') return output;
      const record = { ...(output as Record<string, unknown>) };
      const slot = String(record.slot_index ?? index);
      if ('links' in record || ends.some((link) => link.originId === id)) {
        record.links = ends.filter((link) => link.originId === id && link.originSlot === slot).map((link) => link.id);
      }
      return record;
    });
  }
}

function exportedNode(node: Record<string, any>): Record<string, unknown> {
  const source: Record<string, unknown> = node.data?.comfy && typeof node.data.comfy === 'object'
    ? { ...(node.data.comfy as Record<string, unknown>) }
    : {
        id: node.id,
        type: node.data?.comfyType,
        pos: [node.position?.x ?? 0, node.position?.y ?? 0],
        size: [200, 80],
        flags: {},
        order: 0,
        mode: 0,
        properties: {},
      };
  source.pos = writePos(source.pos, { x: node.position?.x ?? 0, y: node.position?.y ?? 0 });
  if (node.data?.comfy?.widgets_values !== undefined) {
    source.widgets_values = node.data.comfy.widgets_values;
  }
  return source;
}

export function exportWorkflow(snapshot: GraphSnapshot, exportedAt: string): { ok: true; workflow: Record<string, unknown> } | { ok: false; error: string } {
  const formatVersion = snapshot.document?.formatVersion ?? WORKFLOW_FORMAT_V1;
  const raw = snapshot.document?.raw ? { ...snapshot.document.raw } : {};
  const links = snapshot.edges.map((edge) => edgeToLink(edge, formatVersion));
  const exportedNodes = snapshot.nodes.map((node) => {
    const next = exportedNode(node);
    syncSlots(next, links);
    return next;
  });
  const workflow: Record<string, unknown> = {
    ...raw,
    version: formatVersion,
    nodes: exportedNodes,
    links,
  };
  const numericNodeIds = collectNumericIds(exportedNodes.map((node) => node.id));
  const numericLinkIds = collectNumericIds(links.map((link) => (Array.isArray(link) ? link[0] : (link as { id?: unknown }).id)));
  if (formatVersion === WORKFLOW_FORMAT_V1) {
    const state = raw.state && typeof raw.state === 'object' ? { ...(raw.state as Record<string, unknown>) } : {};
    state.lastNodeId = monotonicCounter(state.lastNodeId, numericNodeIds);
    state.lastLinkId = monotonicCounter(state.lastLinkId, numericLinkIds);
    workflow.state = state;
  } else {
    workflow.last_node_id = monotonicCounter(raw.last_node_id, numericNodeIds);
    workflow.last_link_id = monotonicCounter(raw.last_link_id, numericLinkIds);
  }
  const extra = raw.extra && typeof raw.extra === 'object' ? { ...(raw.extra as Record<string, unknown>) } : {};
  if (extra.info && typeof extra.info === 'object') {
    extra.info = { ...(extra.info as Record<string, unknown>), modified: exportedAt };
  }
  workflow.extra = extra;
  return { ok: true, workflow: omitAppOwned(workflow) as Record<string, unknown> };
}

export function missingDeps(document: unknown, catalog: CatalogView): MissingReport {
  const record = document && typeof document === 'object' ? (document as Record<string, unknown>) : {};
  const types = new Set<string>();
  const modelRows: unknown[] = Array.isArray(record.models) ? [...record.models] : [];
  for (const node of workflowNodes(record)) {
    if (typeof node.type === 'string') types.add(node.type);
    const properties = node.properties;
    if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
      const models = (properties as { models?: unknown }).models;
      if (Array.isArray(models)) modelRows.push(...models);
    }
  }
  const knownNodes = new Set(catalog.nodeTypes);
  const missingNodes = [...types].filter((type) => !knownNodes.has(type)).sort();
  const knownModels = new Set(catalog.models.map((model) => `${model.directory}/${model.name}`));
  const seen = new Set<string>();
  const missingModels = modelRows.flatMap((model) => {
    if (!model || typeof model !== 'object') return [];
    const row = model as { directory?: unknown; name?: unknown };
    if (typeof row.directory !== 'string' || typeof row.name !== 'string') return [];
    const key = `${row.directory}/${row.name}`;
    if (knownModels.has(key) || seen.has(key)) return [];
    seen.add(key);
    return [{ directory: row.directory, name: row.name }];
  });
  return { missingNodes, missingModels };
}

function workflowNodes(record: Record<string, unknown>): Array<{ type?: unknown; properties?: unknown }> {
  const found: Array<{ type?: unknown; properties?: unknown }> = [];
  const take = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const node of list) {
      if (node && typeof node === 'object') found.push(node as { type?: unknown; properties?: unknown });
    }
  };
  take(record.nodes);
  const definitions = record.definitions;
  const subgraphs = definitions && typeof definitions === 'object' && !Array.isArray(definitions)
    ? (definitions as { subgraphs?: unknown }).subgraphs
    : undefined;
  if (Array.isArray(subgraphs)) {
    for (const subgraph of subgraphs) {
      if (subgraph && typeof subgraph === 'object') take((subgraph as { nodes?: unknown }).nodes);
    }
  }
  return found;
}

export function toApiPrompt(snapshot: GraphSnapshot): Record<string, { class_type: string; inputs: Record<string, unknown> }> {
  const prompt: Record<string, { class_type: string; inputs: Record<string, unknown> }> = {};
  for (const node of snapshot.nodes) {
    const inputs: Record<string, unknown> = { ...(node.data?.parameters ?? {}) };
    for (const edge of snapshot.edges) {
      if (edge.target !== node.id) continue;
      const port = (node.data?.inputs ?? []).find((item: { id: string; name: string }) => item.id === edge.targetHandle);
      const name = port?.name || String(edge.targetHandle);
      inputs[name] = [edge.source, slotNumber(edge.sourceHandle)];
    }
    prompt[String(node.id)] = { class_type: String(node.data?.comfyType ?? ''), inputs };
  }
  return prompt;
}

export function patchWidgets(comfy: Record<string, unknown>, key: string, value: unknown, widgetIndex?: number): void {
  const widgets = comfy.widgets_values;
  if (Array.isArray(widgets) && widgetIndex !== undefined) {
    const copy = widgets.slice();
    copy[widgetIndex] = value;
    comfy.widgets_values = copy;
    return;
  }
  if (widgets && typeof widgets === 'object' && !Array.isArray(widgets)) {
    comfy.widgets_values = { ...(widgets as Record<string, unknown>), [key]: value };
  }
}
