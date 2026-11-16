/** Preserves native ComfyUI node appearance and widget presentation when projecting a workflow. */
import type { SubgraphDefinition } from '../graph/subgraphs';
/**
 * How an imported ComfyUI node looks, read from what the file saved on it (`data.comfy`): its size, whether it is
 * collapsed, its colours, the fields a subgraph copy promotes, the editor-only nodes (Reroute, Primitive, notes,
 * Set / Get) and the view the file was saved with. Pure and shared: the canvas draws with it, and the size
 * estimate (shared/graph/layout.ts) works with the same numbers, so a node is placed at the size it is drawn.
 * Nothing here writes: what the file holds goes back to ComfyUI as it was (codec.ts keeps `data.comfy`).
 * Read by the canvas nodes (renderer/components/graph/nodes), the Properties panel and the look menu.
 */

import { groupNodeName } from './codec';

/** Selected image, including native positional and named widget values imported without catalog metadata. */
export function imageSourceName(data: { comfyType?: unknown; parameters?: unknown; comfy?: unknown } | null | undefined): string | null {
  if (data?.comfyType !== 'LoadImage') return null;
  const parameters = data.parameters && typeof data.parameters === 'object' ? data.parameters as Record<string, unknown> : {};
  const comfy = data.comfy && typeof data.comfy === 'object' ? data.comfy as { widgets_values?: unknown } : {};
  const values = comfy.widgets_values;
  const saved = Array.isArray(values) ? values[0] : values && typeof values === 'object' ? (values as Record<string, unknown>).image : undefined;
  const name = parameters.image ?? saved;
  return typeof name === 'string' && name.length > 0 ? name : null;
}
/** A width and height in canvas pixels. */
export interface Box {
  width: number;
  height: number;
}

/** The node data fields read here; anything may be missing on a node from a file. */
type NodeData = { comfyType?: unknown; title?: unknown; comfy?: unknown; importedLinks?: unknown; kind?: unknown } | null | undefined;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function comfyOf(data: NodeData): Record<string, unknown> | null {
  return record(data?.comfy);
}

/** The card sizes a node from a file can take (px). The file's width is kept inside these bounds. */
export const FILE_BOX = {
  minWidth: 200,
  maxWidth: 1200,
  /** ComfyUI's title bar: `size[1]` in the file is the body under it. */
  comfyTitle: 30,
  /** A collapsed node: one title row. */
  collapsedHeight: 36,
  collapsedMinWidth: 96,
  collapsedMaxWidth: 260,
  /** Per title character, and the room for the frame, the expand mark and the padding. */
  collapsedChar: 7.5,
  collapsedChrome: 52,
} as const;

/** A Reroute is drawn as a small dot with an input and an output (fixed size, as in ComfyUI). */
export const REROUTE_BOX: Box = { width: 56, height: 28 };

/** `size` as the file saved it ([w, h] or {0: w, 1: h}), or null. */
export function savedSize(data: NodeData): Box | null {
  const size = comfyOf(data)?.size;
  const pair = Array.isArray(size) ? [size[0], size[1]] : record(size) ? [record(size)!['0'], record(size)!['1']] : null;
  if (!pair || typeof pair[0] !== 'number' || typeof pair[1] !== 'number' || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1])) return null;
  return { width: pair[0], height: pair[1] };
}

/** A node read from a file (its link ids were recorded on import); a node made in the app keeps the app's own size. */
export function fromFile(data: NodeData): boolean {
  return Array.isArray(data?.importedLinks);
}

/**
 * The card box the file asks for: the width it saved (inside FILE_BOX), and as the least height the box ComfyUI drew
 * (body plus title bar). Null for a node made in the app, or when the file saved no size.
 */
export function fileBox(data: NodeData): { width: number; minHeight: number } | null {
  if (!fromFile(data)) return null;
  const size = savedSize(data);
  if (!size) return null;
  const width = Math.round(Math.min(FILE_BOX.maxWidth, Math.max(FILE_BOX.minWidth, size.width)));
  return { width, minHeight: Math.max(0, Math.round(size.height + FILE_BOX.comfyTitle)) };
}

/** `flags.collapsed` as the file saved it. */
export function isCollapsed(data: NodeData): boolean {
  return record(comfyOf(data)?.flags)?.collapsed === true;
}

/** The width of a collapsed card: its title, within bounds. */
export function collapsedWidth(title: string): number {
  const raw = Math.round(title.length * FILE_BOX.collapsedChar + FILE_BOX.collapsedChrome);
  return Math.min(FILE_BOX.collapsedMaxWidth, Math.max(FILE_BOX.collapsedMinWidth, raw));
}

/** The title a collapsed card shows: the node's own title, else its class. */
export function shownTitle(data: NodeData): string {
  if (typeof data?.title === 'string' && data.title !== '') return data.title;
  return typeof data?.comfyType === 'string' ? data.comfyType : '';
}

/** The comfy flags with `collapsed` set or cleared; the other flags stay as they were. */
export function withCollapsed(flags: unknown, collapsed: boolean): Record<string, unknown> {
  const next = { ...(record(flags) ?? {}) };
  if (collapsed) next.collapsed = true;
  else delete next.collapsed;
  return next;
}

// ── Editor-only nodes ─────────────────────────────────────────────────────────────────────────────

/** The editor-only node kinds, with SetNode and GetNode (added by a node pack, run in the editor only). */
export type EditorKind = 'reroute' | 'primitive' | 'note' | 'markdown' | 'set' | 'get';

const EDITOR_KINDS: Record<string, EditorKind> = {
  Reroute: 'reroute',
  PrimitiveNode: 'primitive',
  Note: 'note',
  MarkdownNote: 'markdown',
  SetNode: 'set',
  GetNode: 'get',
};

/** The kind of a node that only the ComfyUI editor knows (never in object_info), else null. */
export function editorKind(classType: unknown): EditorKind | null {
  return typeof classType === 'string' ? EDITOR_KINDS[classType] ?? null : null;
}

/** The saved widget values of a node, as an array (an object of values in its key order). */
export function savedValues(data: NodeData): unknown[] {
  const widgets = comfyOf(data)?.widgets_values;
  if (Array.isArray(widgets)) return widgets;
  const values = record(widgets);
  return values ? Object.values(values) : [];
}

/** The name a SetNode stores under, or a GetNode reads (widgets_values[0]). */
export function constantName(data: NodeData): string {
  const first = savedValues(data)[0];
  return typeof first === 'string' ? first : '';
}

/** Set / Get pairs: the SetNode ids by constant name, and the GetNode ids by name. */
export function setGetPairs(nodes: ReadonlyArray<{ id: string; data?: NodeData }>): { sets: Map<string, string>; gets: Map<string, string[]> } {
  const sets = new Map<string, string>();
  const gets = new Map<string, string[]>();
  for (const node of nodes) {
    const kind = editorKind(node.data?.comfyType);
    if (kind !== 'set' && kind !== 'get') continue;
    const name = constantName(node.data);
    if (!name) continue;
    if (kind === 'set') {
      if (!sets.has(name)) sets.set(name, node.id);
    } else {
      gets.set(name, [...(gets.get(name) ?? []), node.id]);
    }
  }
  return { sets, gets };
}

/** The node ids related to one Set or Get: for a Get its Set, for a Set its Gets. */
export function partnersOf(nodeId: string, nodes: ReadonlyArray<{ id: string; data?: NodeData }>): string[] {
  const node = nodes.find((item) => item.id === nodeId);
  const kind = editorKind(node?.data?.comfyType);
  if (!node || (kind !== 'set' && kind !== 'get')) return [];
  const name = constantName(node.data);
  if (!name) return [];
  const pairs = setGetPairs(nodes);
  if (kind === 'get') {
    const set = pairs.sets.get(name);
    return set ? [set] : [];
  }
  return pairs.gets.get(name) ?? [];
}

/** The "after each run" values ComfyUI offers (control_after_generate). */
export const RUN_CONTROLS = ['fixed', 'increment', 'decrement', 'randomize'] as const;

/** True for one of the RUN_CONTROLS values. */
export function isRunControl(value: unknown): value is typeof RUN_CONTROLS[number] {
  return typeof value === 'string' && (RUN_CONTROLS as readonly string[]).includes(value);
}

/** The field a Primitive feeds: its output's `widget.name`, and the output type. */
export function primitiveTarget(data: NodeData): { widget: string | null; dataType: string } {
  const outputs = comfyOf(data)?.outputs;
  const first = Array.isArray(outputs) ? record(outputs[0]) : null;
  const widget = record(first?.widget)?.name;
  return { widget: typeof widget === 'string' ? widget : null, dataType: typeof first?.type === 'string' ? first.type : '' };
}

/**
 * Whether the person's ComfyUI has a node's class: 'missing' only once ComfyUI was read (the catalog holds classes)
 * and the class came back unknown. Editor-only nodes (Reroute, Primitive, notes, Set / Get), subgraph copies and
 * legacy group nodes are never "missing": no sync can find them, and ComfyUI does not need them installed.
 */
export type ClassPresence = 'known' | 'missing' | 'unknown';

/** Whether the class is known, missing or not yet known (see ClassPresence). */
export function classPresence(classType: string, detail: unknown, catalogRead: boolean, instance: boolean): ClassPresence {
  if (instance || editorKind(classType) || groupNodeName(classType) !== null) return 'known';
  if (detail === undefined) return 'unknown';
  if (detail) return 'known';
  return catalogRead ? 'missing' : 'unknown';
}

// ── Subgraph copies: promoted fields ─────────────────────────────────────────────────────────────

/** One field a subgraph copy shows on itself although it belongs to a node inside. */
export interface PromotedField {
  /** Position in the file's list; also the index of the value in the copy's own widgets_values. */
  index: number;
  /** The inner node the field belongs to; '-1' is the copy's own field (a subgraph input with a widget). */
  nodeId: string;
  name: string;
}

/** The promoted-field list (`properties.proxyWidgets`) a subgraph copy saved. */
export function promotedFields(data: NodeData): PromotedField[] {
  const list = record(comfyOf(data)?.properties)?.proxyWidgets;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry, index) => {
    if (!Array.isArray(entry) || entry.length < 2 || typeof entry[1] !== 'string') return [];
    return [{ index, nodeId: String(entry[0]), name: entry[1] }];
  });
}

/** The value the copy itself holds for a promoted field: widgets_values[index] when it is there and set. */
export function ownPromotedValue(data: NodeData, field: PromotedField): { held: boolean; value: unknown } {
  const widgets = comfyOf(data)?.widgets_values;
  if (!Array.isArray(widgets) || field.index >= widgets.length) return { held: false, value: undefined };
  const value = widgets[field.index];
  return value === null || value === undefined ? { held: false, value: undefined } : { held: true, value };
}

// ── Colours ───────────────────────────────────────────────────────────────────────────────────────

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** The colours the file gave the node (`color` the title bar, `bgcolor` the body), when they are plain hex. */
export function fileColors(data: NodeData): { color?: string; bgcolor?: string } {
  const comfy = comfyOf(data);
  const out: { color?: string; bgcolor?: string } = {};
  if (typeof comfy?.color === 'string' && HEX.test(comfy.color)) out.color = comfy.color;
  if (typeof comfy?.bgcolor === 'string' && HEX.test(comfy.bgcolor)) out.bgcolor = comfy.bgcolor;
  return out;
}

/** A group colour the canvas can use as is: plain hex only. */
export function safeHex(value: unknown): string | undefined {
  return typeof value === 'string' && HEX.test(value) ? value : undefined;
}

// ── Port types ────────────────────────────────────────────────────────────────────────────────────

/** Longest type shown whole beside a port; a longer one keeps its end and says it was cut. */
export const PORT_TYPE_CHARS = 14;

/**
 * A long port type shortened honestly: the leading word parts go, an ellipsis says so, the end stays
 * (WANVIDIMAGE_CLIPEMBEDS → …CLIPEMBEDS). The full type goes in the tooltip.
 */
export function shortPortType(type: string): string {
  if (type.length <= PORT_TYPE_CHARS) return type;
  const parts = type.split('_');
  for (let at = 1; at < parts.length; at += 1) {
    const tail = parts.slice(at).join('_');
    if (tail.length <= PORT_TYPE_CHARS - 1 && tail.length >= 3) return `…${tail}`;
  }
  return `…${type.slice(type.length - (PORT_TYPE_CHARS - 1))}`;
}

/** A field value that is an object (service data a node keeps for itself), not something a person types. */
export function isServiceData(value: unknown): boolean {
  return value !== null && typeof value === 'object';
}

// ── The view the file was saved with ──────────────────────────────────────────────────────────────

/** `extra.ds` of a workflow: LiteGraph draws a point at (pos + offset) * scale. */
export function savedView(raw: unknown): { x: number; y: number; zoom: number } | null {
  const ds = record(record(record(raw)?.extra)?.ds);
  if (!ds) return null;
  const scale = ds.scale;
  const offset = ds.offset;
  const pair = Array.isArray(offset) ? [offset[0], offset[1]] : record(offset) ? [record(offset)!['0'] ?? record(offset)!.x, record(offset)!['1'] ?? record(offset)!.y] : null;
  if (typeof scale !== 'number' || !(scale > 0) || !Number.isFinite(scale) || !pair) return null;
  if (typeof pair[0] !== 'number' || typeof pair[1] !== 'number' || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1])) return null;
  return { x: pair[0] * scale, y: pair[1] * scale, zoom: scale };
}

// ── Native reroute points of links ────────────────────────────────────────────────────────────────

/** One reroute point of a link, by its id and position. */
export interface ReroutePoint {
  id: string;
  x: number;
  y: number;
}

/**
 * The reroute points a link passes through, in order from its start to its end. A workflow keeps them either at the
 * top level (`reroutes`, links with `parentId`, format 1) or in `extra.reroutes` and `extra.linkExtensions` (0.4).
 * A link's `parentId` names the reroute nearest its end; each reroute names the one before it.
 */
export function reroutePaths(raw: unknown, links: ReadonlyArray<{ id: string; parentId?: unknown }> = []): Map<string, ReroutePoint[]> {
  const doc = record(raw);
  const extra = record(doc?.extra);
  const list = Array.isArray(doc?.reroutes) ? doc!.reroutes as unknown[] : Array.isArray(extra?.reroutes) ? extra!.reroutes as unknown[] : [];
  const byId = new Map<string, { x: number; y: number; parent: string | null }>();
  for (const item of list) {
    const reroute = record(item);
    if (!reroute || reroute.id == null) continue;
    const pos = reroute.pos;
    const x = Array.isArray(pos) ? pos[0] : record(pos)?.['0'];
    const y = Array.isArray(pos) ? pos[1] : record(pos)?.['1'];
    if (typeof x !== 'number' || typeof y !== 'number') continue;
    byId.set(String(reroute.id), { x, y, parent: reroute.parentId == null ? null : String(reroute.parentId) });
  }
  const parents = new Map<string, string>();
  for (const item of Array.isArray(extra?.linkExtensions) ? extra!.linkExtensions as unknown[] : []) {
    const extension = record(item);
    if (extension && extension.id != null && extension.parentId != null) parents.set(String(extension.id), String(extension.parentId));
  }
  for (const link of links) if (link.parentId != null) parents.set(link.id, String(link.parentId));
  const out = new Map<string, ReroutePoint[]>();
  if (byId.size === 0) return out;
  for (const [linkId, first] of parents) {
    const chain: ReroutePoint[] = [];
    const seen = new Set<string>();
    let at: string | null = first;
    while (at !== null && byId.has(at) && !seen.has(at)) {
      seen.add(at);
      const point: { x: number; y: number; parent: string | null } = byId.get(at)!;
      chain.unshift({ id: at, x: point.x, y: point.y });
      at = point.parent;
    }
    if (chain.length > 0) out.set(linkId, chain);
  }
  return out;
}

// ── Nodes that cover each other ───────────────────────────────────────────────────────────────────

/** A node's box with its id and top-left position. */
export interface PlacedBox extends Box {
  id: string;
  x: number;
  y: number;
}

/** Room kept between nodes the import moves apart. */
export const SPREAD_GAP = 16;

/**
 * Moves nodes down until none covers another, keeping the author's columns (x never changes) and order (a node
 * never passes one that was above it). Nodes are taken top to bottom; each one that covers a node already placed
 * goes just below it. Returns only the nodes that moved, with their new top-left.
 */
export function spreadApart(boxes: ReadonlyArray<PlacedBox>, gap = SPREAD_GAP): Map<string, { x: number; y: number }> {
  const order = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : 1));
  const placed: PlacedBox[] = [];
  const moved = new Map<string, { x: number; y: number }>();
  for (const box of order) {
    let y = box.y;
    for (let guard = 0; guard <= placed.length; guard += 1) {
      const hit = placed.find((other) => box.x < other.x + other.width && box.x + box.width > other.x && y < other.y + other.height && y + box.height > other.y);
      if (!hit) break;
      y = hit.y + hit.height + gap;
    }
    if (y !== box.y) moved.set(box.id, { x: box.x, y: Math.round(y) });
    placed.push({ ...box, y });
  }
  return moved;
}

/** How many pairs of boxes cover each other. */
export function overlapCount(boxes: ReadonlyArray<PlacedBox>): number {
  let count = 0;
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) count += 1;
    }
  }
  return count;
}

/** A promoted inner widget can be backed by a renamed boundary input, as official blueprints do. */
export function promotedInputSlot(field: PromotedField, definition: SubgraphDefinition | undefined): number {
  if (!definition) return -1;
  if (field.nodeId === '-1') return definition.inputs.findIndex((slot) => slot.name === field.name);
  const inner = definition.nodes.find((node) => String(node.id) === field.nodeId);
  const port = inner?.data?.inputs?.find((input: { name: string }) => input.name === field.name);
  if (!port) return -1;
  const edge = definition.edges.find((link) => String(link.source) === '-10' && String(link.target) === field.nodeId && link.targetHandle === port.id);
  const match = edge ? /^out-(\d+)$/.exec(String(edge.sourceHandle)) : null;
  return match ? Number(match[1]) : -1;
}
