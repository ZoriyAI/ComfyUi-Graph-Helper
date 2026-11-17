import { hasDynamicInputs, resolvedNode } from '../catalog/dynamicInputs';
import { definitionWidgetPairs } from './promotedWidgets';
/**
 * The ComfyUI workflow codec: reads a workflow file (UI format 1 or the older 0.4) into the app's graph snapshot
 * (canvas nodes and edges, subgraph definitions, groups, and a stored copy of the rest of the file), and writes the
 * snapshot back as a workflow ComfyUI opens. The rule is lossless round trips: whatever the app does not edit is
 * written back as the file had it. Main imports, commits and exports with it (main/ipc.ts, main/commands); the
 * renderer reads its helpers (services/commands/projection.ts, state/graphState.ts, commands/actions.ts).
 */
import { slotDefault } from '../catalog/objectInfo';
import type { CatalogNode, CatalogView } from '../catalog/types';
import type { ComponentRecord, ProcessMeta } from '../components/model';
import { EMPTY_PROCESS } from '../components/model';
import {
  SUBGRAPH_INPUT_NODE_ID,
  SUBGRAPH_INSTANCE_KIND,
  SUBGRAPH_OUTPUT_NODE_ID,
  instancePorts,
  groupHasFixedBounds,
  type GroupRecord,
  type SubgraphDefinition,
  type SubgraphSlot,
} from '../graph/subgraphs';

// The two workflow formats of ComfyUI's frontend: `version: 1` with object links, and 0.4 with link arrays.
export const WORKFLOW_FORMAT_V1 = 1;
export const WORKFLOW_FORMAT_V04 = 0.4;

/** A workflow format this codec reads and writes. */
export type WorkflowFormat = typeof WORKFLOW_FORMAT_V1 | typeof WORKFLOW_FORMAT_V04;

/** The id counters of an empty format-1 workflow. */
export function emptyWorkflowState(): Record<string, number> {
  return { lastNodeId: 0, lastLinkId: 0, lastGroupId: 0, lastRerouteId: 0 };
}

/**
 * The empty ComfyUI workflow every graph starts from: a fresh profile and File > New project alike. One shape,
 * so the two cannot drift into different formats (subgraphs need format 1).
 */
export function emptyWorkflow(): Record<string, unknown> {
  return { version: WORKFLOW_FORMAT_V1, state: emptyWorkflowState(), nodes: [], links: [], groups: [], config: {}, extra: {} };
}

/** The stored copy of a workflow file: its format and everything but the canvas content (see storedRaw). */
export interface WorkflowDocumentState {
  formatVersion: WorkflowFormat;
  raw: Record<string, unknown>;
}

/** The graph as one revision stores it: canvas nodes and edges plus the document and the app's own records. */
export interface GraphSnapshot {
  nodes: Array<Record<string, any>>;
  edges: Array<Record<string, any>>;
  document: WorkflowDocumentState | null;
  components?: ComponentRecord[];
  process?: ProcessMeta;
  /** Modelled native subgraph definitions. Undefined only on snapshots written before they were modelled. */
  subgraphs?: SubgraphDefinition[];
  /** Root-canvas groups. Undefined only on snapshots written before they were modelled. */
  groups?: GroupRecord[];
}

/** Keys this app owns. Comfy export drops them at every depth and never writes them. */
export const APP_OWNED_EXPORT_KEYS = new Set([
  'graphHelper',
  'componentRecords',
  'appComponents',
  'comfyGraphHelper',
  'processMeta',
]);

/** A deep copy of `value` without the app-owned keys, so an exported workflow carries none of the app's data. */
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

/** Node classes and model files a workflow needs that the catalog does not list. */
export interface MissingReport {
  missingNodes: string[];
  missingModels: Array<{ directory: string; name: string }>;
}

/** What a JSON document is: a UI workflow of either format, an API prompt, or something else. */
export type WorkflowKind = 'ui-v1' | 'ui-v0.4' | 'api-prompt' | 'unknown';

/** Tells the kind of a parsed JSON document without changing it. */
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

/** True when every link is an array, as 0.4 writes them; no links at all counts too. */
function linksLookLikeTuples(links: unknown): boolean {
  if (links == null) return true;
  if (!Array.isArray(links)) return false;
  return links.every((link) => Array.isArray(link));
}

/** True for an API prompt: an object of nodes, each with class_type and inputs, and no `nodes` or `version`. */
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

/** A node position from a file: [x, y], {0: x, 1: y} or {x, y}; anything else is 0,0. */
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

/** The new position in the same shape the file used, so an export changes nothing else. */
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

/** A link of either format in one shape, with the original kept in `raw`. */
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

/** A file node as a canvas node; the whole native record stays in `data.comfy` for a lossless export. */
function projectNode(item: unknown): Record<string, any> {
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
}

/**
 * Remember, on every imported node, which link ids of the file were real links touching it. Export uses it to
 * tell a link the app removed (drop it from the slot) from a stale id ComfyUI left in the file (keep it).
 */
function markImportedLinks(nodes: Array<Record<string, any>>, edges: Array<Record<string, any>>): void {
  const touching = new Map<string, string[]>();
  for (const edge of edges) {
    const id = linkIdOf(edge);
    if (id === null) continue;
    for (const end of [String(edge.source), String(edge.target)]) touching.set(end, [...(touching.get(end) ?? []), id]);
  }
  for (const node of nodes) node.data = { ...node.data, importedLinks: touching.get(String(node.id)) ?? [] };
}

/** The file's link id an edge stands for, or null for an edge the app made. */
function linkIdOf(edge: Record<string, any>): string | null {
  const stored = edge.data?.comfyLink;
  if (Array.isArray(stored) && stored[0] != null) return String(stored[0]);
  if (isPlainRecord(stored) && stored.id != null) return String(stored.id);
  if (typeof edge.data?.linkId === 'number') return String(edge.data.linkId);
  return typeof edge.id === 'string' && edge.id.startsWith('link-') ? edge.id.slice(5) : null;
}

function projectLinks(links: unknown): Array<Record<string, any>> {
  return (Array.isArray(links) ? links : []).flatMap((link) => {
    const normal = readLink(link);
    if (!normal) return [];
    return [{
      id: `link-${String(normal.id)}`,
      source: normal.originId,
      target: normal.targetId,
      sourceHandle: `out-${normal.originSlot}`,
      targetHandle: `in-${normal.targetSlot}`,
      // `imported` marks a link that came from the file, as opposed to one the app made.
      data: { dataType: normal.dataType, comfyLink: normal.raw, imported: true },
    }];
  });
}

/** A UI workflow as a fresh snapshot; an API prompt or an unknown document gives a fixed error sentence. */
export function projectWorkflow(document: unknown): { snapshot: GraphSnapshot } | { error: string } {
  const kind = classifyWorkflow(document);
  if (kind === 'api-prompt') return { error: 'API prompt is not a canvas workflow.' };
  if (kind === 'unknown') return { error: 'Workflow JSON is not UI format 1 or legacy 0.4.' };
  const raw = document as Record<string, unknown>;
  const formatVersion = kind === 'ui-v1' ? WORKFLOW_FORMAT_V1 : WORKFLOW_FORMAT_V04;
  const nodes = (raw.nodes as unknown[]).map(projectNode);
  const edges = projectLinks(raw.links);
  markImportedLinks(nodes, edges);
  const lifted = liftSubgraphsAndGroups(raw, nodes);
  return {
    snapshot: {
      nodes,
      edges,
      document: { formatVersion, raw: storedRaw(raw) },
      components: [],
      process: { ...EMPTY_PROCESS },
      subgraphs: lifted.subgraphs,
      groups: lifted.groups,
    },
  };
}

/**
 * The stored document keeps everything of the native file except its canvas content: `nodes` and `links`
 * become empty placeholders (their presence keeps the key order on export), because the live canvas is the
 * snapshot's nodes and edges. A stale copy would make missing-node checks report removed nodes.
 */
export function storedRaw(raw: Record<string, unknown>): Record<string, unknown> {
  const next = { ...raw };
  if ('nodes' in next) next.nodes = [];
  if ('links' in next) next.links = next.links === null ? null : [];
  return next;
}

/** The slot number of a handle ('in-2', 'out-0' or '2'), or null when it is not a number. */
export function numericSlot(handle: unknown): number | null {
  const text = String(handle ?? '');
  const match = /^(?:in|out)-(.*)$/.exec(text);
  const body = match ? match[1] : text;
  return /^\d+$/.test(body) ? Number(body) : null;
}

/** The finite numbers among `values`. */
export function collectNumericIds(values: unknown[]): number[] {
  return values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

function counterValue(stored: unknown): number {
  if (typeof stored === 'number' && Number.isFinite(stored)) return stored;
  // Some saved workflows hold a counter as a numeric string ("364"); ComfyUI accepts both.
  if (typeof stored === 'string' && /^\d+$/.test(stored)) return Number(stored);
  return 0;
}

/** A counter that never goes down: the stored value or the highest id in use, whichever is larger. */
export function monotonicCounter(stored: unknown, current: number[]): number {
  return current.reduce((max, value) => Math.max(max, value), counterValue(stored));
}

/** Like monotonicCounter, but a counter that does not move keeps the exact value the file had. */
function exportedCounter(stored: unknown, current: number[]): unknown {
  const next = monotonicCounter(stored, current);
  const readable = (typeof stored === 'number' && Number.isFinite(stored)) || (typeof stored === 'string' && /^\d+$/.test(stored));
  return readable && next === counterValue(stored) ? stored : next;
}

/** The next free link id: above the stored counter and every link id on the canvas and inside definitions. */
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
  const allEdges = [...snapshot.edges, ...(snapshot.subgraphs ?? []).flatMap((definition) => definition.edges)];
  const fromEdges = allEdges.flatMap((edge) => {
    const ids: number[] = [];
    if (typeof edge.data?.linkId === 'number') ids.push(edge.data.linkId);
    const stored = edge.data?.comfyLink;
    if (Array.isArray(stored) && typeof stored[0] === 'number') ids.push(stored[0]);
    if (stored && typeof stored === 'object' && !Array.isArray(stored) && typeof stored.id === 'number') ids.push(stored.id);
    if (typeof edge.id === 'string' && /^link-\d+$/.test(edge.id)) ids.push(Number(edge.id.slice(5)));
    return ids;
  });
  return monotonicCounter(state.lastLinkId, [counterValue(raw?.last_link_id), ...fromLinks, ...fromEdges]) + 1;
}

/** The document with its link counter raised to at least `linkId`, in the counter field of its format. */
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

/** The slot of a handle as the file writes it: a number when it is one, else the text as it is. */
function slotNumber(handle: unknown): number | string {
  const text = String(handle ?? '');
  const match = /^(?:in|out)-(.*)$/.exec(text);
  const body = match ? match[1] : text;
  return /^-?\d+$/.test(body) ? Number(body) : body;
}

/** A node id written back with the type the file used for it (numbers stay numbers). */
function coerceId(id: unknown, sample: unknown): string | number {
  // Negative ids are the subgraph boundary nodes (-10 input, -20 output) inside a definition.
  if (typeof sample === 'number' && /^-?\d+$/.test(String(id))) return Number(id);
  return String(id);
}

/** An edge as a link record of `formatVersion`, starting from the file's own record when it has one. */
export function edgeToLink(edge: Record<string, any>, formatVersion: WorkflowFormat): unknown {
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
    origin_id: /^-?\d+$/.test(String(edge.source)) ? Number(edge.source) : edge.source,
    origin_slot: origin,
    target_id: /^-?\d+$/.test(String(edge.target)) ? Number(edge.target) : edge.target,
    target_slot: target,
    type: linkType,
  };
}

/** A 0.4 link array as a format-1 link object. */
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

type LinkEndsView = NonNullable<ReturnType<typeof linkEnds>>;

/** The links export writes, indexed by id and by the slot they start or end at. */
interface LinkIndex {
  byId: Map<string, LinkEndsView>;
  byOrigin: Map<string, unknown[]>;
  byTarget: Map<string, unknown[]>;
  /** Ids of links the app made, or imported links whose ends the app changed (rerouted). */
  changed: Set<string>;
}

function sameEnds(a: LinkEndsView, b: LinkEndsView): boolean {
  return String(a.originId) === String(b.originId)
    && String(a.originSlot) === String(b.originSlot)
    && String(a.targetId) === String(b.targetId)
    && String(a.targetSlot) === String(b.targetSlot);
}

/** Indexes the links to export and marks those the app made or moved (by comparing with the imported ends). */
function indexLinks(links: unknown[], edges: Array<Record<string, any>>): LinkIndex {
  const byId = new Map<string, LinkEndsView>();
  const byOrigin = new Map<string, unknown[]>();
  const byTarget = new Map<string, unknown[]>();
  const changed = new Set<string>();
  links.forEach((link, position) => {
    const ends = linkEnds(link);
    if (!ends) return;
    const key = String(ends.id);
    byId.set(key, ends);
    const origin = `${String(ends.originId)}:${String(ends.originSlot)}`;
    const target = `${String(ends.targetId)}:${String(ends.targetSlot)}`;
    byOrigin.set(origin, [...(byOrigin.get(origin) ?? []), ends.id]);
    byTarget.set(target, [...(byTarget.get(target) ?? []), ends.id]);
    const edge = edges[position];
    const before = edge?.data?.imported === true ? linkEnds(edge.data.comfyLink) : null;
    if (!before || !sameEnds(before, ends)) changed.add(key);
  });
  return { byId, byOrigin, byTarget, changed };
}

function sameIds(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => String(value) === String(b[index]));
}

/**
 * The link ids a slot listed in the file that still belong there. The file's own list is kept as it was
 * (order, stale ids, `null`): a link of the file the app did not touch stays where the file listed it, and an
 * id that was never a real link of the file (a stale id ComfyUI left behind) stays. A link the app removed, or
 * rerouted away from this slot, is dropped. `imported` holds the link ids the file really had around this node;
 * it tells a removed link from a stale id. Without it (a node the app created, or a snapshot stored before it
 * was recorded) only links that end here now are kept.
 */
function keptSlotLinks(
  base: unknown[],
  index: LinkIndex,
  imported: ReadonlySet<string> | null,
  endsHere: (ends: LinkEndsView) => boolean,
): unknown[] {
  return base.filter((id) => {
    const now = index.byId.get(String(id));
    if (!now) return imported !== null && !imported.has(String(id));
    return imported !== null && !index.changed.has(String(id)) ? true : endsHere(now);
  });
}

/**
 * A slot that holds a list (an output, a subgraph input): the kept ids, then the links the app made or rerouted
 * that start here. A link of the file the list does not name stays unnamed: ComfyUI follows the slot lists, and
 * such a link is usually a leftover in the file's link table.
 */
function mergeSlotLinks(
  base: unknown[],
  here: unknown[],
  index: LinkIndex,
  imported: ReadonlySet<string> | null,
  endsHere: (ends: LinkEndsView) => boolean,
): unknown[] {
  const kept = keptSlotLinks(base, index, imported, endsHere);
  const keptKeys = new Set(kept.map((id) => String(id)));
  const fresh = here.filter((id) => (imported === null || index.changed.has(String(id))) && !keptKeys.has(String(id)));
  return [...kept, ...fresh];
}

/** The one link an input slot holds: one the app connected here, else what the file had, else the table's. */
function inputLink(
  base: unknown[],
  here: unknown[],
  index: LinkIndex,
  imported: ReadonlySet<string> | null,
  endsHere: (ends: LinkEndsView) => boolean,
): unknown {
  const fresh = here.filter((id) => imported === null || index.changed.has(String(id)));
  if (fresh.length > 0) return fresh[fresh.length - 1];
  const kept = keptSlotLinks(base, index, imported, endsHere);
  if (kept.length > 0) return kept[kept.length - 1];
  return here.length > 0 ? here[here.length - 1] : null;
}

/** Rewrites a node's slot link lists (`link`, `links`) to match the links being exported. */
function syncSlots(node: Record<string, unknown>, index: LinkIndex, importedLinks?: unknown): void {
  const id = String(node.id);
  const imported = Array.isArray(importedLinks) ? new Set(importedLinks.map((item) => String(item))) : null;
  if (Array.isArray(node.inputs)) {
    node.inputs = node.inputs.map((input, position) => {
      if (!input || typeof input !== 'object') return input;
      const record = input as Record<string, unknown>;
      const slot = String(record.slot_index ?? position);
      const base = record.link == null ? [] : [record.link];
      const here = index.byTarget.get(`${id}:${slot}`) ?? [];
      const next = inputLink(base, here, index, imported, (ends) => String(ends.targetId) === id && String(ends.targetSlot) === slot);
      if (sameIds(base, next === null ? [] : [next]) || (!('link' in record) && next === null)) return input;
      return { ...record, link: next };
    });
  }
  if (Array.isArray(node.outputs)) {
    node.outputs = node.outputs.map((output, position) => {
      if (!output || typeof output !== 'object') return output;
      const record = output as Record<string, unknown>;
      const slot = String(record.slot_index ?? position);
      const base = Array.isArray(record.links) ? record.links : [];
      const here = index.byOrigin.get(`${id}:${slot}`) ?? [];
      const merged = mergeSlotLinks(base, here, index, imported, (ends) => String(ends.originId) === id && String(ends.originSlot) === slot);
      // `links: null` on an unconnected output stays null.
      if (sameIds(base, merged)) return output;
      return { ...record, links: merged };
    });
  }
}

/** The refusal when field values cannot be placed because the class's widget order is unknown. */
export const WIDGET_ORDER_UNRELIABLE = 'Catalog widget order is not reliable, so those values are not exported.';

/** A widgets_values slot that has neither a value nor a catalog default; export writes null there. */
export interface UnsetWidget {
  nodeId: string;
  classType: string;
  name: string;
}

function isUnset(value: unknown): boolean {
  return value === undefined || value === null;
}

/** The catalog spec whose widget order can place values, or undefined when it cannot. */
function reliableSpec(catalog: CatalogView, classType: string): CatalogNode | undefined {
  const spec = catalog.nodes.find((item) => item.classType === classType);
  return spec && spec.widgetOrderReliable !== false ? spec : undefined;
}

/**
 * Place parameter values into a widgets_values array. Unknown or unreliable order is a refusal, not a guess.
 * A slot the parameters leave unset takes the catalog default (objectInfo.ts slotDefault); only a slot with no
 * default stays null, and its name is listed in `unset`.
 */
export function widgetsFromParameters(
  classType: string,
  parameters: Record<string, unknown>,
  catalog: CatalogView,
): { ok: true; values: unknown[]; unset: string[] } | { ok: false; error: string } {
  const declared = catalog.nodes.find((item) => item.classType === classType);
  const spec = declared && hasDynamicInputs(declared) ? resolvedNode(declared, { parameters }) : declared;
  const keys = Object.keys(parameters);
  if (!spec || spec.widgetOrderReliable === false) {
    return keys.length === 0 ? { ok: true, values: [], unset: [] } : { ok: false, error: WIDGET_ORDER_UNRELIABLE };
  }
  if (keys.some((key) => !spec.widgetOrder.includes(key))) {
    return { ok: false, error: WIDGET_ORDER_UNRELIABLE };
  }
  const unset: string[] = [];
  const values = spec.widgetOrder.map((name) => {
    if (!isUnset(parameters[name])) return parameters[name];
    const fallback = slotDefault(spec, name);
    if (fallback.known) return fallback.value;
    unset.push(name);
    return null;
  });
  return { ok: true, values, unset };
}

/**
 * Fill the null slots of a stored widgets_values array with catalog defaults. Values that are set are never
 * changed, so an imported workflow keeps every value it carried. Only an array laid out exactly like the catalog
 * order is touched; anything else is returned as it was, with no slot reported.
 */
export function fillWidgetDefaults(
  classType: string,
  widgets: unknown,
  catalog: CatalogView | undefined,
): { values: unknown; unset: string[] } {
  const declared = catalog ? reliableSpec(catalog, classType) : undefined;
  const spec = declared && hasDynamicInputs(declared) ? resolvedNode(declared, { widgets }) : declared;
  if (!spec || spec.widgetOrderReliable === false || !Array.isArray(widgets) || widgets.length !== spec.widgetOrder.length) return { values: widgets, unset: [] };
  const unset: string[] = [];
  const values = widgets.map((value, index) => {
    if (!isUnset(value)) return value;
    const name = spec.widgetOrder[index];
    const fallback = slotDefault(spec, name);
    if (fallback.known) return fallback.value;
    unset.push(name);
    return null;
  });
  return { values, unset };
}

/**
 * The widgets_values export writes for one canvas node, and the slots that stay null because nothing set them
 * and the catalog has no default. Undefined values mean export writes no widgets_values for the node.
 */
export function exportedWidgets(
  node: Record<string, any>,
  catalog: CatalogView | undefined,
): { ok: true; values: unknown[] | undefined; unset: string[] } | { ok: false; error: string } {
  const classType = String(node.data?.comfyType ?? '');
  const stored = node.data?.comfy?.widgets_values;
  if (stored !== undefined) {
    const filled = fillWidgetDefaults(classType, stored, catalog);
    return { ok: true, values: filled.values as unknown[], unset: filled.unset };
  }
  const parameters = node.data?.parameters;
  const record = parameters && typeof parameters === 'object' && !Array.isArray(parameters)
    ? parameters as Record<string, unknown>
    : {};
  const declared = catalog ? reliableSpec(catalog, classType) : undefined;
  const spec = declared && hasDynamicInputs(declared) ? resolvedNode(declared, { parameters: record }) : declared;
  if (Object.keys(record).length === 0 && (!spec || spec.widgetOrder.length === 0)) return { ok: true, values: undefined, unset: [] };
  if (!catalog) return { ok: false, error: WIDGET_ORDER_UNRELIABLE };
  const placed = widgetsFromParameters(classType, record, catalog);
  if (!placed.ok) return placed;
  return { ok: true, values: placed.values, unset: placed.unset };
}

/** Collects unset widgets while exportWorkflow runs; export is synchronous, so one slot is enough. */
let unsetCollector: UnsetWidget[] | null = null;

/**
 * One canvas node as a file node: the native record it came from with the app's changes applied (position, id,
 * field values), or a new record with slots for a node the app made. When field values cannot be placed the export
 * is refused (ExportRefused); `lenient` writes the node without them instead.
 */
function exportedNode(node: Record<string, any>, catalog?: CatalogView, lenient = false): Record<string, unknown> {
  const hasComfy = node.data?.comfy && typeof node.data.comfy === 'object';
  const source: Record<string, unknown> = hasComfy
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
  // A numeric id is written as a number, unless the file wrote this same id as a string ("5"): then it stays.
  if (/^-?\d+$/.test(String(node.id)) && !(hasComfy && String(source.id) === String(node.id))) source.id = Number(node.id);
  if (!hasComfy) {
    const title = typeof node.data?.title === 'string' && node.data.title !== '' ? node.data.title : node.data?.comfyType;
    if (typeof title === 'string' && title !== '') source.title = title;
  }
  if (!Array.isArray(node.data?.importedLinks)) addCreatedSlots(source, node, catalog);
  const placed = exportedWidgets(node, catalog);
  if (!placed.ok) {
    if (lenient) return source;
    throw new ExportRefused(placed.error);
  }
  if (placed.values !== undefined) source.widgets_values = placed.values;
  if (unsetCollector && placed.unset.length > 0) {
    const classType = String(node.data?.comfyType ?? '');
    for (const name of placed.unset) unsetCollector.push({ nodeId: String(source.id ?? node.id), classType, name });
  }
  return source;
}

/**
 * A node the app created has no native `inputs`/`outputs` yet. ComfyUI draws a link only when the target
 * node's `inputs[slot].link` holds its id, so without them the node opens unconnected. Sockets come first,
 * then widget inputs with `widget: { name }`, as ComfyUI_frontend litegraphService.addInputs lays them out
 * (the same order as the canvas ports). Imported nodes are never touched here.
 */
function addCreatedSlots(source: Record<string, unknown>, node: Record<string, any>, catalog: CatalogView | undefined): void {
  const ports = (value: unknown) => (Array.isArray(value) ? value as Array<{ name?: unknown; dataType?: unknown }> : []);
  const declared = catalog?.nodes.find((item) => item.classType === String(node.data?.comfyType ?? ''));
  const spec = declared && hasDynamicInputs(declared) ? resolvedNode(declared, { parameters: node.data?.parameters, widgets: source.widgets_values }) : declared;
  const widgetNames = new Set((spec?.inputs ?? []).filter((input) => input.widget).map((input) => input.name));
  if (!Array.isArray(source.inputs)) {
    source.inputs = ports(node.data?.inputs).map((port) => {
      const name = typeof port.name === 'string' ? port.name : '';
      const slot: Record<string, unknown> = { name, type: typeof port.dataType === 'string' ? port.dataType : '*', link: null };
      if (widgetNames.has(name)) slot.widget = { name };
      return slot;
    });
  }
  if (!Array.isArray(source.outputs)) {
    source.outputs = ports(node.data?.outputs).map((port, index) => ({
      name: typeof port.name === 'string' ? port.name : '',
      type: typeof port.dataType === 'string' ? port.dataType : '*',
      links: [],
      slot_index: index,
    }));
  }
  const properties = isPlainRecord(source.properties) ? { ...source.properties } : {};
  if (properties['Node name for S&R'] === undefined && typeof source.type === 'string' && !node.data?.subgraphId) {
    properties['Node name for S&R'] = source.type;
  }
  source.properties = properties;
}

class ExportRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportRefused';
  }
}

/**
 * The ComfyUI workflow for a snapshot. Unset widgets take their catalog default; `unsetWidgets` lists the slots
 * written as null because neither a value nor a default exists, so the UI can warn before the file is used.
 */
export function exportWorkflow(
  source: GraphSnapshot,
  exportedAt: string,
  catalog?: CatalogView,
): { ok: true; workflow: Record<string, unknown>; unsetWidgets: UnsetWidget[] } | { ok: false; error: string } {
  const formatVersion = source.document?.formatVersion ?? WORKFLOW_FORMAT_V1;
  const raw = source.document?.raw ? { ...source.document.raw } : {};
  const rootState = isPlainRecord(raw.state) ? raw.state : {};
  const renumbered = renumberNodeIds(source.nodes, source.edges, counterOf(formatVersion === WORKFLOW_FORMAT_V1 ? rootState.lastNodeId : raw.last_node_id));
  const snapshot: GraphSnapshot = {
    ...source,
    nodes: renumbered.nodes,
    edges: renumbered.edges,
    groups: source.groups?.map((group) => (
      group.nodeIds.some((id) => renumbered.map.has(id)) ? { ...group, nodeIds: group.nodeIds.map((id) => renumbered.map.get(id) ?? id) } : group
    )),
  };
  const links = snapshot.edges.map((edge) => edgeToLink(edge, formatVersion));
  const index = indexLinks(links, snapshot.edges);
  let exportedNodes: Array<Record<string, unknown>>;
  const workflow: Record<string, unknown> = { ...raw };
  const unsetWidgets: UnsetWidget[] = [];
  unsetCollector = unsetWidgets;
  try {
    exportedNodes = snapshot.nodes.map((node) => {
      const next = exportedNode(node, catalog);
      syncSlots(next, index, node.data?.importedLinks);
      return next;
    });
    writeSubgraphsAndGroups(workflow, raw, snapshot, catalog, false);
  } catch (error) {
    if (error instanceof ExportRefused) return { ok: false, error: error.message };
    throw error;
  } finally {
    unsetCollector = null;
  }
  workflow.version = formatVersion;
  workflow.nodes = exportedNodes;
  workflow.links = links.length === 0 && raw.links === null ? null : links;
  const numericNodeIds = collectNumericIds(exportedNodes.map((node) => node.id));
  const numericLinkIds = collectNumericIds(links.map((link) => (Array.isArray(link) ? link[0] : (link as { id?: unknown }).id)));
  if (formatVersion === WORKFLOW_FORMAT_V1) {
    const state = raw.state && typeof raw.state === 'object' ? { ...(raw.state as Record<string, unknown>) } : {};
    state.lastNodeId = exportedCounter(state.lastNodeId, numericNodeIds);
    state.lastLinkId = exportedCounter(state.lastLinkId, numericLinkIds);
    const groupIds = collectNumericIds(((workflow.groups as unknown[] | undefined) ?? []).map((group) => (group as { id?: unknown })?.id));
    if (groupIds.length > 0) state.lastGroupId = monotonicCounter(state.lastGroupId, groupIds);
    workflow.state = state;
  } else {
    workflow.last_node_id = exportedCounter(raw.last_node_id, numericNodeIds);
    workflow.last_link_id = exportedCounter(raw.last_link_id, numericLinkIds);
  }
  if (isPlainRecord(raw.extra)) {
    const extra = { ...raw.extra };
    if (isPlainRecord(extra.info)) extra.info = { ...extra.info, modified: exportedAt };
    workflow.extra = extra;
  } else if (!source.document) {
    // A graph built in the app gets an empty `extra`; a file that had none (or a non-object one) keeps what it had.
    workflow.extra = {};
  }
  return { ok: true, workflow: omitAppOwned(workflow) as Record<string, unknown>, unsetWidgets };
}

function counterOf(value: unknown): number {
  return counterValue(value);
}

/**
 * Give every node whose id is not a number (canvases from before numeric ids) the next free number, in node
 * order, so export is deterministic and ComfyUI gets numeric ids. Edges and their native links follow.
 */
export function renumberNodeIds(
  nodes: Array<Record<string, any>>,
  edges: Array<Record<string, any>>,
  counter: number,
): { nodes: Array<Record<string, any>>; edges: Array<Record<string, any>>; map: Map<string, string> } {
  const map = new Map<string, string>();
  let next = nodes.reduce((max, node) => (/^-?\d+$/.test(String(node.id)) ? Math.max(max, Number(node.id)) : max), counter);
  for (const node of nodes) {
    const id = String(node.id);
    if (/^-?\d+$/.test(id) || map.has(id)) continue;
    next += 1;
    map.set(id, String(next));
  }
  if (map.size === 0) return { nodes, edges, map };
  const renamed = nodes.map((node) => {
    const id = map.get(String(node.id));
    if (!id) return node;
    const comfy = isPlainRecord(node.data?.comfy) ? { ...node.data.comfy, id: Number(id) } : node.data?.comfy;
    return { ...node, id, data: { ...node.data, ...(comfy ? { comfy } : {}) } };
  });
  const relinked = edges.map((edge) => {
    const source = map.get(String(edge.source));
    const target = map.get(String(edge.target));
    if (!source && !target) return edge;
    let comfyLink = edge.data?.comfyLink;
    if (Array.isArray(comfyLink)) {
      comfyLink = comfyLink.slice();
      if (source) comfyLink[1] = Number(source);
      if (target) comfyLink[3] = Number(target);
    } else if (isPlainRecord(comfyLink)) {
      comfyLink = { ...comfyLink, ...(source ? { origin_id: Number(source) } : {}), ...(target ? { target_id: Number(target) } : {}) };
    }
    return {
      ...edge,
      source: source ?? edge.source,
      target: target ?? edge.target,
      ...(edge.data ? { data: { ...edge.data, ...(comfyLink !== undefined ? { comfyLink } : {}) } } : {}),
    };
  });
  return { nodes: renamed, edges: relinked, map };
}

/** Node types the ComfyUI frontend implements itself; they never appear in object_info. */
export const FRONTEND_NODE_TYPES: ReadonlySet<string> = new Set(['Note', 'MarkdownNote', 'Reroute', 'PrimitiveNode']);

/** Ids of every subgraph definition in a native document, nested lists included. */
export function documentDefinitionIds(document: unknown): Set<string> {
  const ids = new Set<string>();
  const walk = (container: unknown) => {
    if (!isPlainRecord(container) || !Array.isArray(container.subgraphs)) return;
    for (const item of container.subgraphs) {
      if (!isPlainRecord(item)) continue;
      if (typeof item.id === 'string' && item.id.length > 0) ids.add(item.id);
      walk(item.definitions);
    }
  };
  if (isPlainRecord(document)) walk(document.definitions);
  return ids;
}

/** Nodes inside the subgraph definitions of a native document, nested lists included. */
export function documentDefinitionNodes(document: unknown): Array<Record<string, unknown>> {
  const found: Array<Record<string, unknown>> = [];
  const walk = (container: unknown) => {
    if (!isPlainRecord(container) || !Array.isArray(container.subgraphs)) return;
    for (const item of container.subgraphs) {
      if (!isPlainRecord(item)) continue;
      if (Array.isArray(item.nodes)) for (const node of item.nodes) if (isPlainRecord(node)) found.push(node);
      walk(item.definitions);
    }
  };
  if (isPlainRecord(document)) walk(document.definitions);
  return found;
}

/** Browser-only nodes of a node pack: there when any class of that pack is in the catalog. */
const FRONTEND_PACK_NODES: Record<string, RegExp> = { SetNode: /kjnodes/i, GetNode: /kjnodes/i };

/** The name inside a legacy group-node type (`workflow>Name`, older files `workflow/Name`), else null. */
export function groupNodeName(type: string): string | null {
  const match = /^workflow[>/](.+)$/.exec(type);
  return match ? match[1] : null;
}

function groupNodeDefinitions(document: unknown): Record<string, unknown> {
  if (!isPlainRecord(document) || !isPlainRecord(document.extra) || !isPlainRecord(document.extra.groupNodes)) return {};
  return document.extra.groupNodes;
}

/** Names of the legacy group nodes a document defines in `extra.groupNodes`. */
export function documentGroupNodeNames(document: unknown): Set<string> {
  return new Set(Object.keys(groupNodeDefinitions(document)));
}

/** Nodes inside the legacy group nodes of a document; they are what ComfyUI runs for a group node. */
export function documentGroupNodeContents(document: unknown): Array<Record<string, unknown>> {
  return Object.values(groupNodeDefinitions(document)).flatMap((group) => (
    isPlainRecord(group) && Array.isArray(group.nodes) ? group.nodes.filter(isPlainRecord) : []
  ));
}

/**
 * A node type a missing-node check must not report: frontend-only, an instance of a definition in the document,
 * a legacy group node the document defines (its contents are checked instead), or a browser-only node of a
 * pack that is in the catalog (SetNode/GetNode of KJNodes).
 */
export function isLocalNodeType(
  type: string,
  definitionIds: ReadonlySet<string>,
  context?: { groupNodes?: ReadonlySet<string>; catalog?: CatalogView },
): boolean {
  if (FRONTEND_NODE_TYPES.has(type) || definitionIds.has(type)) return true;
  const group = groupNodeName(type);
  if (group !== null && context?.groupNodes?.has(group)) return true;
  const pack = FRONTEND_PACK_NODES[type];
  return !!pack && !!context?.catalog?.nodes.some((node) => pack.test(`${node.pack} ${node.pythonModule}`));
}

/**
 * What the canvas does not show yet although export keeps it, counted for the import notice: a legacy group node
 * is one unknown node. (Bypassed and muted nodes carry their mark and Note / MarkdownNote their text on the card:
 * renderer/components/graph/nodes/NodeCard.tsx reads them from `data.comfy`.)
 */
export interface ShownDifferently {
  groupNodes: number;
}

/** Counts what the canvas shows differently from ComfyUI in a document, subgraph contents included. */
export function shownDifferently(document: unknown): ShownDifferently {
  const nodes = isPlainRecord(document) && Array.isArray(document.nodes) ? document.nodes.filter(isPlainRecord) : [];
  const inner = documentDefinitionNodes(document);
  const all = [...nodes, ...inner];
  const typeOf = (node: Record<string, unknown>) => (typeof node.type === 'string' ? node.type : '');
  return {
    groupNodes: all.filter((node) => groupNodeName(typeOf(node)) !== null).length,
  };
}

/**
 * The node classes and the model files (from `models` lists of the file and its nodes) a workflow names that the
 * catalog does not have. Subgraph definitions, group node contents and editor-only nodes are not counted as missing.
 */
export function missingDeps(document: unknown, catalog: CatalogView): MissingReport {
  const record = document && typeof document === 'object' ? (document as Record<string, unknown>) : {};
  const types = new Set<string>();
  const local = documentDefinitionIds(record);
  const context = { groupNodes: documentGroupNodeNames(record), catalog };
  const modelRows: unknown[] = Array.isArray(record.models) ? [...record.models] : [];
  for (const node of workflowNodes(record)) {
    if (typeof node.type === 'string' && !isLocalNodeType(node.type, local, context)) types.add(node.type);
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
  take(documentDefinitionNodes(record));
  take(documentGroupNodeContents(record));
  return found;
}

/** Writes one field value into a node's saved widgets_values: by index into an array, by name into an object. */
export function patchWidgets(comfy: Record<string, unknown>, key: string, value: unknown, widgetIndex?: number, nativeKey = key): void {
  const widgets = comfy.widgets_values;
  if (Array.isArray(widgets) && widgetIndex !== undefined) {
    const copy = widgets.slice();
    copy[widgetIndex] = value;
    comfy.widgets_values = copy;
    if (isPlainRecord(comfy.widgets_values_named)) comfy.widgets_values_named = { ...comfy.widgets_values_named, [nativeKey]: value };
    return;
  }
  if (widgets && typeof widgets === 'object' && !Array.isArray(widgets)) {
    comfy.widgets_values = { ...(widgets as Record<string, unknown>), [key]: value };
    if (isPlainRecord(comfy.widgets_values_named)) comfy.widgets_values_named = { ...comfy.widgets_values_named, [nativeKey]: value };
  }
}

// ---------------------------------------------------------------------------------------------
// Native subgraphs and groups.
//
// Assumptions, taken from the ComfyUI_frontend workflow schema (zSubgraphDefinition, zSubgraphIO,
// zExportedSubgraphIONode) and not checked against a running frontend by our tests:
// - `definitions.subgraphs[]` entries are workflow-1 graphs (version, state, nodes, links as objects, groups,
//   config, extra) plus `id` (uuid), `revision`, `name`, `inputNode`/`outputNode` ({id, bounding}),
//   `inputs[]`/`outputs[]` ({id, name, type, linkIds}), `widgets[]`, and optionally their own `definitions`.
// - Inside a definition, a link with origin_id -10 starts at subgraph input slot `origin_slot`;
//   a link with target_id -20 ends at subgraph output slot `target_slot`.
// - An instance node has `type = definition.id` and one input/output per boundary slot, in slot order.
// - The frontend flattens nested definitions into the root list on save. We keep the placement we imported
//   and add new definitions to the root list.
// - Groups are `{id?, title, bounding: [x, y, w, h], color?, font_size?, flags?}`. Membership is not native:
//   a node belongs to a group when its position lies inside the bounding.
// What our tests prove: these shapes survive our own import → edit → export, unknown fields included.
// ---------------------------------------------------------------------------------------------

// Keys of a definition the snapshot models itself; the stored copy keeps them only as empty placeholders.
const DEFINITION_HEAVY_KEYS = ['nodes', 'links', 'inputs', 'outputs'] as const;
// LiteGraph's title bar heights and a group's inner padding, in canvas pixels, for group bounds.
const NODE_TITLE_HEIGHT = 30;
const GROUP_TITLE_HEIGHT = 34;
const GROUP_PADDING = 10;
const DEFAULT_NODE_SIZE: [number, number] = [200, 80];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** A fresh slot uuid, as ComfyUI's frontend makes them. */
function newSlotId(): string {
  return globalThis.crypto.randomUUID();
}

/** The boundary slots of a definition, with the fields the app does not model kept in `raw`. */
function slotsFrom(value: unknown, kind: 'input' | 'output'): SubgraphSlot[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const record = isPlainRecord(item) ? item : {};
    const { id, name, type, linkIds, ...rest } = record;
    return {
      // ComfyUI_frontend requires a slot id; one that is missing is minted here and exported from now on.
      id: typeof id === 'string' && id.length > 0 ? id : newSlotId(),
      name: typeof name === 'string' ? name : `${kind}-${index}`,
      type: dataTypeOf(type),
      raw: rest,
      ...(Array.isArray(linkIds) ? { linkIds: linkIds.slice() } : {}),
    };
  });
}

/** One file definition as a modelled SubgraphDefinition, its inner graph projected like the root canvas. */
function liftDefinition(item: Record<string, unknown>, nestedIn: string | null): SubgraphDefinition {
  const raw: Record<string, unknown> = { ...item };
  // Heavy keys become empty placeholders: their presence still tells export to write them.
  for (const key of DEFINITION_HEAVY_KEYS) if (key in raw) raw[key] = [];
  if (isPlainRecord(raw.definitions) && Array.isArray(raw.definitions.subgraphs)) {
    raw.definitions = { ...raw.definitions, subgraphs: [] };
  }
  const id = String(item.id);
  const nodes = Array.isArray(item.nodes) ? item.nodes.map(projectNode) : [];
  const edges = projectLinks(item.links);
  markImportedLinks(nodes, edges);
  return {
    id,
    name: typeof item.name === 'string' && item.name.length > 0 ? item.name : id,
    inputs: slotsFrom(item.inputs, 'input'),
    outputs: slotsFrom(item.outputs, 'output'),
    nodes,
    edges,
    groups: liftGroups(item.groups, nodes),
    importedLinks: edges.flatMap((edge) => {
      const linkId = linkIdOf(edge);
      return linkId === null ? [] : [linkId];
    }),
    nestedIn,
    raw,
  };
}

/** Lift `definitions.subgraphs` (with nested lists) and `groups` out of a native workflow document. */
export function liftSubgraphsAndGroups(
  raw: Record<string, unknown>,
  nodes: Array<Record<string, any>>,
): { subgraphs: SubgraphDefinition[]; groups: GroupRecord[] } {
  const subgraphs: SubgraphDefinition[] = [];
  const seen = new Set<string>();
  let opaque = 0;
  const walk = (container: unknown, parent: string | null) => {
    if (!isPlainRecord(container) || !Array.isArray(container.subgraphs)) return;
    for (const item of container.subgraphs) {
      if (!isPlainRecord(item)) continue;
      if (typeof item.id !== 'string' || item.id.length === 0 || seen.has(item.id)) {
        // Unidentified or repeated: keep it verbatim where it was, never invent an id for export.
        subgraphs.push({ id: `opaque-${opaque++}`, name: '', inputs: [], outputs: [], nodes: [], edges: [], nestedIn: parent, opaque: true, raw: item });
        continue;
      }
      seen.add(item.id);
      subgraphs.push(liftDefinition(item, parent));
      walk(item.definitions, item.id);
    }
  };
  walk(raw.definitions, null);
  markInstances(nodes, subgraphs);
  for (const definition of subgraphs) markInstances(definition.nodes, subgraphs);
  return { subgraphs, groups: liftGroups(raw.groups, nodes) };
}

/** Give nodes whose class type is a modelled definition the instance markers and definition-derived ports. */
export function markInstances(nodes: Array<Record<string, any>>, subgraphs: SubgraphDefinition[]): void {
  for (const node of nodes) {
    const definition = subgraphs.find((item) => !item.opaque && item.id === node.data?.comfyType);
    if (!definition) continue;
    const ports = instancePorts(definition);
    node.data = { ...node.data, kind: SUBGRAPH_INSTANCE_KIND, subgraphId: definition.id, inputs: ports.inputs, outputs: ports.outputs };
    const native = node.data.comfy;
    if (!Array.isArray(native?.properties?.proxyWidgets)) node.data.promotedWidgets = definitionWidgetPairs(definition.raw);
    if (!definition.instanceDefaults && (Array.isArray(native?.properties?.proxyWidgets) || node.data.promotedWidgets?.length)) {
      definition.instanceDefaults = Object.fromEntries(['inputs', 'outputs', 'properties', 'widgets_values', 'widgets_values_named', 'size'].filter((key) => native[key] !== undefined).map((key) => [key, structuredClone(native[key])]));
    }
  }
}

function readBounding(value: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(value) || value.length < 4) return undefined;
  const numbers = value.slice(0, 4).map((item) => (typeof item === 'number' && Number.isFinite(item) ? item : NaN));
  return numbers.some(Number.isNaN) ? undefined : [numbers[0], numbers[1], numbers[2], numbers[3]];
}

function positionInside(position: { x: number; y: number } | undefined, bounding: [number, number, number, number]): boolean {
  if (!position) return false;
  const [x, y, w, h] = bounding;
  return position.x >= x && position.x <= x + w && position.y >= y && position.y <= y + h;
}

/** A node belongs to a group when its centre lies inside the group rectangle (as LiteGraph decides). */
function centreInside(node: Record<string, any>, bounding: [number, number, number, number]): boolean {
  if (!node.position) return false;
  const [w, h] = nodeSize(node);
  return positionInside({ x: (node.position.x ?? 0) + w / 2, y: (node.position.y ?? 0) + h / 2 }, bounding);
}

export function liftGroups(value: unknown, nodes: Array<Record<string, any>>): GroupRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!isPlainRecord(item)) return [];
    const bounding = readBounding(item.bounding);
    const group: GroupRecord = {
      id: item.id != null ? String(item.id) : `imported-${index}`,
      title: typeof item.title === 'string' ? item.title : '',
      nodeIds: bounding ? nodes.filter((node) => centreInside(node, bounding)).map((node) => String(node.id)) : [],
      raw: item,
    };
    if (bounding) group.bounding = bounding;
    const mode = isPlainRecord(item.flags) ? item.flags.nodewise_bounds_mode : undefined;
    if (mode === 'manual' || mode === 'auto') group.boundsMode = mode;
    if (typeof item.color === 'string') group.color = item.color;
    return [group];
  });
}

/** A node's saved size, or a default when the file has none. */
function nodeSize(node: Record<string, any>): [number, number] {
  const size = node.data?.comfy?.size;
  if (Array.isArray(size) && typeof size[0] === 'number' && typeof size[1] === 'number') return [size[0], size[1]];
  if (isPlainRecord(size) && typeof size['0'] === 'number' && typeof size['1'] === 'number') return [size['0'] as number, size['1'] as number];
  return DEFAULT_NODE_SIZE;
}

/** A group rectangle around member nodes, with room for the node and group title bars (LiteGraph defaults). */
export function groupBounding(members: Array<Record<string, any>>): [number, number, number, number] {
  if (members.length === 0) return [0, 0, 0, 0];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of members) {
    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;
    const [w, h] = nodeSize(node);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  const top = minY - NODE_TITLE_HEIGHT - GROUP_TITLE_HEIGHT - GROUP_PADDING;
  return [minX - GROUP_PADDING, top, maxX - minX + GROUP_PADDING * 2, maxY - top + GROUP_PADDING];
}

export function exportGroup(group: GroupRecord, nodes: Array<Record<string, any>>): Record<string, unknown> {
  const members = nodes.filter((node) => group.nodeIds.includes(String(node.id)));
  const stored = group.bounding;
  const bounding = stored && (groupHasFixedBounds(group) || (group.boundsMode !== 'auto' && members.every((node) => centreInside(node, stored))))
    ? stored
    : members.length > 0 ? groupBounding(members) : stored ?? [0, 0, 0, 0];
  const out: Record<string, unknown> = { ...(group.raw ?? {}) };
  if (!group.raw) out.id = /^\d+$/.test(group.id) ? Number(group.id) : group.id;
  out.title = group.title;
  out.bounding = [...bounding];
  if (group.boundsMode) out.flags = { ...(isPlainRecord(out.flags) ? out.flags : {}), nodewise_bounds_mode: group.boundsMode };
  if (group.color !== undefined) out.color = group.color;
  else delete out.color;
  return out;
}

/** Ids of the inner links that start at a boundary input slot or end at a boundary output slot. */
function boundaryLinkIds(links: unknown[], side: 'input' | 'output', slot: number): Array<number | string> {
  return links.flatMap((link) => {
    const normal = readLink(link);
    if (!normal) return [];
    if (side === 'input' && normal.originId === SUBGRAPH_INPUT_NODE_ID && normal.originSlot === String(slot)) return [normal.id];
    if (side === 'output' && normal.targetId === SUBGRAPH_OUTPUT_NODE_ID && normal.targetSlot === String(slot)) return [normal.id];
    return [];
  });
}

function exportSlots(
  slots: SubgraphSlot[],
  links: unknown[],
  side: 'input' | 'output',
  index: LinkIndex,
  imported: ReadonlySet<string> | null,
): Array<Record<string, unknown>> {
  return slots.map((slot, position) => {
    const here = boundaryLinkIds(links, side, position);
    const endsHere = (ends: LinkEndsView) => (side === 'input'
      ? String(ends.originId) === SUBGRAPH_INPUT_NODE_ID && String(ends.originSlot) === String(position)
      : String(ends.targetId) === SUBGRAPH_OUTPUT_NODE_ID && String(ends.targetSlot) === String(position));
    // The ids the file listed survive in their order (stale ones too); only the app's changes apply.
    const linkIds = Array.isArray(slot.linkIds) ? mergeSlotLinks(slot.linkIds, here, index, imported, endsHere) : here;
    return { ...(slot.raw ?? {}), id: slot.id, name: slot.name, type: slot.type, linkIds };
  });
}

/** One definition as the file writes it; an opaque one goes back exactly as it was read. */
function exportDefinition(
  definition: SubgraphDefinition,
  all: SubgraphDefinition[],
  catalog: CatalogView | undefined,
  lenient: boolean,
): Record<string, unknown> {
  if (definition.opaque) return definition.raw;
  const raw = definition.raw;
  const renumbered = renumberNodeIds(definition.nodes, definition.edges, counterOf(isPlainRecord(raw.state) ? raw.state.lastNodeId : 0));
  const links = renumbered.edges.map((edge) => edgeToLink(edge, WORKFLOW_FORMAT_V1));
  const index = indexLinks(links, renumbered.edges);
  const nodes = renumbered.nodes.map((node) => {
    const next = exportedNode(node, catalog, lenient);
    syncSlots(next, index, node.data?.importedLinks);
    return next;
  });
  const out: Record<string, unknown> = { ...raw, id: definition.id };
  if ('name' in raw || definition.name !== definition.id) out.name = definition.name;
  const imported = Array.isArray(definition.importedLinks) ? new Set(definition.importedLinks.map((id) => String(id))) : null;
  const inputs = exportSlots(definition.inputs, links, 'input', index, imported);
  const outputs = exportSlots(definition.outputs, links, 'output', index, imported);
  if ('inputs' in raw || inputs.length > 0) out.inputs = inputs;
  if ('outputs' in raw || outputs.length > 0) out.outputs = outputs;
  if ('nodes' in raw || nodes.length > 0) out.nodes = nodes;
  if ('links' in raw || links.length > 0) out.links = links;
  if (definition.groups !== undefined && ('groups' in raw || definition.groups.length > 0)) {
    out.groups = definition.groups.map((group) => exportGroup(group, definition.nodes));
  }
  const children = all.filter((item) => item.nestedIn === definition.id).map((item) => exportDefinition(item, all, catalog, lenient));
  if (children.length > 0 || (isPlainRecord(raw.definitions) && Array.isArray(raw.definitions.subgraphs))) {
    out.definitions = { ...(isPlainRecord(raw.definitions) ? raw.definitions : {}), subgraphs: children };
  }
  if (isPlainRecord(raw.state)) {
    out.state = {
      ...raw.state,
      lastNodeId: exportedCounter(raw.state.lastNodeId, collectNumericIds(nodes.map((node) => node.id))),
      lastLinkId: exportedCounter(raw.state.lastLinkId, collectNumericIds(links.map((link) => (link as { id?: unknown }).id))),
      lastGroupId: exportedCounter(raw.state.lastGroupId, collectNumericIds((definition.groups ?? []).map((group) => group.id))),
    };
  }
  return out;
}

/** Root-level definitions: those imported at root, plus any whose recorded parent is gone. */
function rootDefinitions(subgraphs: SubgraphDefinition[]): SubgraphDefinition[] {
  const parents = new Set(subgraphs.filter((item) => !item.opaque).map((item) => item.id));
  return subgraphs.filter((item) => item.nestedIn === null || !parents.has(item.nestedIn));
}

/** Writes the definitions (nested in their parents) and the root groups into the exported document. */
function writeSubgraphsAndGroups(
  target: Record<string, unknown>,
  raw: Record<string, unknown>,
  snapshot: GraphSnapshot,
  catalog: CatalogView | undefined,
  lenient: boolean,
): void {
  if (snapshot.subgraphs !== undefined) {
    const roots = rootDefinitions(snapshot.subgraphs).map((item) => exportDefinition(item, snapshot.subgraphs!, catalog, lenient));
    const existing = isPlainRecord(raw.definitions) ? raw.definitions : null;
    if (roots.length > 0 || (existing && Array.isArray(existing.subgraphs))) {
      target.definitions = { ...(existing ?? {}), subgraphs: roots };
    }
  }
  if (snapshot.groups !== undefined && (snapshot.groups.length > 0 || Array.isArray(raw.groups))) {
    target.groups = snapshot.groups.map((group) => exportGroup(group, snapshot.nodes));
  }
}

/**
 * Keep `document.raw.definitions` and `document.raw.groups` a native mirror of the modelled subgraphs and groups,
 * so readers of the raw document (the inspector census, missing-node checks) see what the model holds.
 * The mirror never refuses: nodes whose widget order is unknown are written without widgets_values.
 */
export function mirrorDocument(snapshot: GraphSnapshot): WorkflowDocumentState | null {
  if (snapshot.subgraphs === undefined && snapshot.groups === undefined) {
    return snapshot.document ? { formatVersion: snapshot.document.formatVersion, raw: storedRaw(snapshot.document.raw) } : null;
  }
  const hasModel = modelledCount(snapshot) > 0;
  if (!snapshot.document && !hasModel) return null;
  const document = snapshot.document ?? { formatVersion: WORKFLOW_FORMAT_V1, raw: {} };
  const raw = storedRaw(document.raw);
  writeSubgraphsAndGroups(raw, document.raw, snapshot, undefined, true);
  return { formatVersion: document.formatVersion, raw };
}

function modelledCount(snapshot: GraphSnapshot): number {
  return (snapshot.subgraphs ?? []).filter((item) => !item.opaque).length;
}

/** Next numeric node id, never lower than the stored counter or any id on the canvas or inside a definition. */
export function nextNodeId(snapshot: GraphSnapshot): number {
  const raw = snapshot.document?.raw;
  const state = isPlainRecord(raw?.state) ? raw!.state as Record<string, unknown> : {};
  const ids = [
    ...snapshot.nodes.map((node) => node.id),
    ...(snapshot.subgraphs ?? []).flatMap((definition) => definition.nodes.map((node) => node.id)),
  ].flatMap((id) => (/^\d+$/.test(String(id)) ? [Number(id)] : []));
  return monotonicCounter(state.lastNodeId, [counterValue(raw?.last_node_id), ...ids]) + 1;
}

/** The document with its node counter raised to at least `nodeId`, in the counter field of its format. */
export function rememberNodeId(document: WorkflowDocumentState, nodeId: number): WorkflowDocumentState {
  const raw = { ...document.raw };
  if (document.formatVersion === WORKFLOW_FORMAT_V1) {
    const state = isPlainRecord(raw.state) ? { ...raw.state } : {};
    state.lastNodeId = monotonicCounter(state.lastNodeId, [nodeId]);
    raw.state = state;
  } else {
    raw.last_node_id = monotonicCounter(raw.last_node_id, [nodeId]);
  }
  return { formatVersion: document.formatVersion, raw };
}

/** A new edge with a native link record in the document's format. Definitions always use format 1 links. */
export function makeEdge(
  linkId: number,
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
  dataType: string,
  formatVersion: WorkflowFormat,
): Record<string, any> {
  const id = (value: string) => (/^-?\d+$/.test(value) ? Number(value) : value);
  const originSlot = numericSlot(sourceHandle) ?? 0;
  const targetSlot = numericSlot(targetHandle) ?? 0;
  const comfyLink = formatVersion === WORKFLOW_FORMAT_V04
    ? [linkId, id(source), originSlot, id(target), targetSlot, dataType]
    : { id: linkId, origin_id: id(source), origin_slot: originSlot, target_id: id(target), target_slot: targetSlot, type: dataType };
  return {
    id: `link-${linkId}`,
    source,
    target,
    sourceHandle,
    targetHandle,
    data: { dataType, linkId, comfyLink },
  };
}
