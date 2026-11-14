import { collapsedWidth, editorKind, FILE_BOX, fileBox, isCollapsed, promotedFields, REROUTE_BOX, savedValues, shownTitle } from '../workflow/comfyLook';

/**
 * Graph layout without dependencies: a layered left-to-right arrangement (data flows from loaders on the left to
 * the output on the right, as people read a ComfyUI graph) and a free-slot search, so no node is ever placed on
 * top of another. Pure and deterministic: the same nodes, edges and options always give the same positions.
 * Used in main (placing and tidying the helper's nodes) and in the renderer (manual adds, «Разложить граф»).
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

export interface LayoutNode extends Size {
  id: string;
  /** Current position. Only the y is read: it seeds the order inside a layer, so a tidy keeps the rough picture. */
  x?: number;
  y?: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export interface LayoutOptions {
  /** Top-left corner of the laid-out block. Default 0,0. */
  origin?: Point;
  /** Horizontal room between layers. */
  gapX?: number;
  /** Vertical room between nodes of one layer. */
  gapY?: number;
  /** Room between disconnected parts, and between the block and any obstacle. */
  componentGap?: number;
  /** Rects the layout must not cover (nodes that stay where they are). */
  obstacles?: Rect[];
  /** Barycenter sweeps (each is one pass down and one pass up). */
  sweeps?: number;
}

/** Room for a collapsed description card under a node and for edges to pass between nodes. */
export const LAYOUT_GAPS = { gapX: 96, gapY: 72, componentGap: 80 } as const;

/** Width a node gets before it is measured (the canvas node card width). */
export const ESTIMATED_NODE_WIDTH = 240;

/**
 * What the catalog says of a class, for sizing: which inputs are fields a person sets by hand, and which of those
 * are drawn as a multi-line text box. Without it an input is a field when the node holds a value under its name
 * and its type is a widget type (the canvas's own rule, renderer/components/fields/fieldModel.ts nodeLayout).
 */
export interface SizeHints {
  inputs?: ReadonlyArray<{ name: string; widget: boolean; multiline?: boolean }>;
  /** For a subgraph card: the name of the subgraph it holds, when the caller knows it. */
  subgraphName?: string;
  /** The class is not in the person's ComfyUI: the card lists the values the file saved. */
  missing?: boolean;
  /** The catalog's widget order: an imported node keeps its values in widgets_values by this order. */
  widgetOrder?: ReadonlyArray<string>;
}

const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO']);

/**
 * The node card in pixels, read off the canvas (nodes/Node.module.css) and held to it by a test that draws every
 * class of a catalog and compares (tests/e2e/node-size.test.ts): a header with one title line, a list of link
 * inputs and a list of outputs, the fields, the card's own padding and border.
 */
export const NODE_BOX = {
  /** Header: the title on one line (a long one is cut with an ellipsis, never wrapped) and the class name under it. */
  header: 55,
  /** Room above each port list (inputs, outputs). */
  list: 4,
  port: 28,
  /** Room above the fields. */
  fieldsTop: 9,
  field: 30,
  /**
   * What a multi-line text box adds to its field while it holds up to two lines. With more text the box grows by
   * at most `textGrowth` and then scrolls (fields/FieldControl.module.css); the gap kept under a node is larger
   * than that, so a description written later never brings a node onto the one below.
   */
  textBox: 41,
  textGrowth: 38,
  /** The card's bottom padding and its border. */
  bottom: 10,
  /** A note under the fields: its frame, and each line of it. */
  note: 20,
  noteLine: 18,
  noteChars: 30,
  /** The line under a subgraph card's ports that names the subgraph, when the card has a title of its own. */
  subgraphName: 26,
  /** The text box of a Note / MarkdownNote node (fixed height, it scrolls): its top margin and its height. */
  noteText: 6 + 92,
  /** The line of a Set / Get that names its constant. */
  constant: 26,
  /** The saved values of a node that is not installed: the list's top room, and each value's row. */
  savedTop: 8,
  savedValue: 20,
} as const;

/** Frontend-only ComfyUI nodes whose first widget value is their text. */
const NOTE_TYPES = new Set(['Note', 'MarkdownNote']);

/** The text a Note / MarkdownNote carries in its ComfyUI data (widgets_values[0]), or '' for any other node. */
export function noteTextOf(data: { comfyType?: unknown; comfy?: unknown } | null | undefined): string {
  if (!data || typeof data.comfyType !== 'string' || !NOTE_TYPES.has(data.comfyType)) return '';
  const comfy = data.comfy && typeof data.comfy === 'object' ? data.comfy as { widgets_values?: unknown } : null;
  const widgets = comfy?.widgets_values;
  const first = Array.isArray(widgets) ? widgets[0] : widgets && typeof widgets === 'object' ? (widgets as Record<string, unknown>).text : undefined;
  return typeof first === 'string' ? first : '';
}

/** How ComfyUI runs a node, from its saved `mode`: 2 muted (never runs), 4 bypassed (inputs passed through). */
export function nodeRunMode(data: { comfy?: unknown } | null | undefined): 'bypassed' | 'muted' | null {
  const comfy = data?.comfy && typeof data.comfy === 'object' ? data.comfy as { mode?: unknown } : null;
  if (comfy?.mode === 4) return 'bypassed';
  if (comfy?.mode === 2) return 'muted';
  return null;
}

type SizedData = {
  inputs?: unknown;
  outputs?: unknown;
  parameters?: unknown;
  annotations?: unknown;
  kind?: unknown;
  title?: unknown;
  comfyType?: unknown;
  subgraphId?: unknown;
  comfy?: unknown;
  importedLinks?: unknown;
};

/**
 * A node's size when nothing measured it: main has no DOM, and a node that is about to be added has not been
 * drawn yet. The card width, and the height the canvas gives a node with these ports, fields and note.
 * It must not come out smaller than the node is drawn: a spot chosen with a size too small puts the node on its
 * neighbour.
 */
export function estimateNodeSize(data: SizedData | null | undefined, hints?: SizeHints | null): Size {
  // What the file says of the node wins over the card's own rule (shared/workflow/comfyLook.ts, nodes/NodeCard.tsx):
  // a Reroute is a dot, a collapsed node one title row, and a node from a file keeps the file's width and at least
  // its height.
  if (editorKind(data?.comfyType) === 'reroute' && data?.kind !== 'subgraph-instance') return { ...REROUTE_BOX };
  if (isCollapsed(data)) return { width: collapsedWidth(shownTitle(data)), height: FILE_BOX.collapsedHeight };
  const box = fileBox(data);
  const own = estimateCardSize(data, hints);
  return box ? { width: box.width, height: Math.max(own.height, box.minHeight) } : own;
}

function estimateCardSize(data: SizedData | null | undefined, hints?: SizeHints | null): Size {
  const inputs = Array.isArray(data?.inputs) ? data!.inputs as Array<{ name?: unknown; dataType?: unknown }> : [];
  const outputs = Array.isArray(data?.outputs) ? data!.outputs as unknown[] : [];
  const parameters = data?.parameters && typeof data.parameters === 'object' ? data.parameters as Record<string, unknown> : {};
  const known = new Map((hints?.inputs ?? []).map((input) => [input.name, input]));
  // A value the node holds: in its parameters, or (a node from a file) in widgets_values at the catalog's place.
  const saved = data?.comfy && typeof data.comfy === 'object' ? (data.comfy as { widgets_values?: unknown }).widgets_values : undefined;
  const order = hints?.widgetOrder;
  const inFile = (name: string) => {
    if (Array.isArray(saved)) {
      const at = order ? order.indexOf(name) : -1;
      return at >= 0 && at < saved.length && saved[at] !== null && saved[at] !== undefined;
    }
    const values = saved && typeof saved === 'object' ? saved as Record<string, unknown> : null;
    return values !== null && values[name] !== null && values[name] !== undefined;
  };
  const holds = (name: string) => Object.prototype.hasOwnProperty.call(parameters, name) || inFile(name);
  let links = 0;
  let fields = 0;
  let textBoxes = 0;
  const seen = new Set<string>();
  for (const port of inputs) {
    const name = typeof port?.name === 'string' ? port.name : '';
    const spec = known.get(name);
    const widget = spec ? spec.widget : holds(name) && WIDGET_TYPES.has(String(port?.dataType ?? '').toUpperCase());
    if (!widget) {
      links += 1;
      continue;
    }
    seen.add(name);
    fields += 1;
    if (spec?.multiline) textBoxes += 1;
  }
  // A widget input the node has no port for (stored before its class was read) shows once it holds a value.
  for (const input of hints?.inputs ?? []) {
    if (!input.widget || seen.has(input.name) || !holds(input.name)) continue;
    seen.add(input.name);
    fields += 1;
    if (input.multiline) textBoxes += 1;
  }
  // A value with no input of its name is a field too; `seed::control_after_generate` rides with its field.
  for (const name of Object.keys(parameters)) {
    if (seen.has(name) || name.includes('::')) continue;
    seen.add(name);
    fields += 1;
  }
  // A subgraph copy draws the fields its author promoted (nodes/EditorNodes.tsx PromotedFields) below its
  // own fields; the copy's own promoted inputs are drawn there, not as sockets.
  let extraFields = 0;
  if (data?.kind === 'subgraph-instance') {
    const promoted = promotedFields(data);
    const own = new Set(promoted.filter((field) => field.nodeId === '-1').map((field) => field.name));
    for (const port of inputs) if (own.has(typeof port?.name === 'string' ? port.name : '') && !seen.has(String(port.name))) links -= 1;
    extraFields = promoted.length;
  }
  // A Primitive draws its value and its "after each run" switch; a node that is not installed lists its saved
  // values (one row each); a Set or Get names its constant.
  const kind = data?.kind === 'subgraph-instance' ? null : editorKind(data?.comfyType);
  if (kind === 'primitive') extraFields = Math.min(2, savedValues(data).length);
  const note = Array.isArray(data?.annotations) && typeof data!.annotations[0] === 'string' ? data!.annotations[0] as string : '';
  let height = NODE_BOX.header + NODE_BOX.bottom;
  if (links > 0) height += NODE_BOX.list + links * NODE_BOX.port;
  if (outputs.length > 0) height += NODE_BOX.list + outputs.length * NODE_BOX.port;
  if (fields > 0) height += NODE_BOX.fieldsTop + fields * NODE_BOX.field + textBoxes * NODE_BOX.textBox;
  if (extraFields > 0) height += NODE_BOX.fieldsTop + extraFields * NODE_BOX.field;
  if (kind === 'set' || kind === 'get') height += NODE_BOX.constant;
  if (hints?.missing) height += NODE_BOX.savedTop + savedValues(data).length * NODE_BOX.savedValue;
  if (note) height += NODE_BOX.note + Math.ceil((note.length + 9) / NODE_BOX.noteChars) * NODE_BOX.noteLine;
  if (noteTextOf(data)) height += NODE_BOX.noteText;
  if (data?.kind === 'subgraph-instance') {
    // A card with a title of its own names its subgraph under the ports (nodes/SubgraphNode.tsx).
    const title = typeof data.title === 'string' ? data.title : '';
    const own = title !== '' && title !== data.comfyType && title !== data.subgraphId;
    if (own && title !== hints?.subgraphName) height += NODE_BOX.subgraphName;
  }
  return { width: ESTIMATED_NODE_WIDTH, height };
}

/** True when the two rects come closer than `gap` (touching at exactly `gap` apart does not count). */
export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

/** The smallest rect around all of them, or null for none. */
export function boundsOfRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Obstacles used to generate candidate spots; the full list still validates every candidate. */
const CANDIDATE_RECTS = 64;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * The spot nearest to `preferred` where a box of `size` keeps `gap` from every rect. The nearest free spot is
 * either `preferred` itself or touches the gap line of some rect on one axis, with the other coordinate taken
 * from `preferred` or from another rect's gap line; so those combinations are the only candidates to test.
 */
export function findFreeSlot(rects: Rect[], preferred: Point, size: Size, gap = 32): Point {
  const free = (point: Point) => !rects.some((rect) => rectsOverlap({ ...point, ...size }, rect, gap));
  if (free(preferred)) return { x: preferred.x, y: preferred.y };
  const near = rects.length > CANDIDATE_RECTS
    ? [...rects].sort((a, b) => rectDistance(a, preferred) - rectDistance(b, preferred)).slice(0, CANDIDATE_RECTS)
    : rects;
  // Ceil/floor keep integer spots on the free side of the gap line.
  const xs = new Set<number>([preferred.x]);
  const ys = new Set<number>([preferred.y]);
  for (const rect of near) {
    xs.add(Math.ceil(rect.x + rect.width + gap));
    xs.add(Math.floor(rect.x - gap - size.width));
    ys.add(Math.ceil(rect.y + rect.height + gap));
    ys.add(Math.floor(rect.y - gap - size.height));
  }
  const candidates: Array<Point & { d: number }> = [];
  for (const x of xs) for (const y of ys) candidates.push({ x, y, d: distance({ x, y }, preferred) });
  // Ties go to the spot further right, then further down: new things read left to right, top to bottom.
  candidates.sort((a, b) => a.d - b.d || b.x - a.x || b.y - a.y);
  for (const candidate of candidates) {
    if (free(candidate)) return { x: candidate.x, y: candidate.y };
  }
  // Right of everything is always free.
  const all = boundsOfRects(rects);
  return { x: all ? Math.ceil(all.x + all.width + gap) : preferred.x, y: preferred.y };
}

function rectDistance(rect: Rect, point: Point): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

interface Graph {
  ids: string[];
  index: Map<string, number>;
  /** DAG edges after cycle breaking, by node index. */
  preds: number[][];
  succs: number[][];
}

/** Connected parts (edges taken both ways), each sorted by input index; parts ordered by their first node. */
function components(count: number, edges: Array<[number, number]>): number[][] {
  const parent = Array.from({ length: count }, (_, index) => index);
  const find = (value: number): number => {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== root) {
      const next = parent[value];
      parent[value] = root;
      value = next;
    }
    return root;
  };
  for (const [a, b] of edges) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }
  const groups = new Map<number, number[]>();
  for (let index = 0; index < count; index += 1) {
    const root = find(index);
    const list = groups.get(root) ?? [];
    list.push(index);
    groups.set(root, list);
  }
  return [...groups.values()].sort((a, b) => a[0] - b[0]);
}

/**
 * Edges of one part without cycles: a depth-first walk from the sources (then from any node not reached yet,
 * in input order) drops every edge that points back into the walk's current path.
 */
function acyclic(members: number[], out: number[][]): Array<[number, number]> {
  const state = new Map<number, 0 | 1 | 2>();
  const kept: Array<[number, number]> = [];
  const hasIncoming = new Set<number>();
  for (const node of members) for (const next of out[node]) hasIncoming.add(next);
  const starts = [...members.filter((node) => !hasIncoming.has(node)), ...members];
  for (const start of starts) {
    if (state.get(start)) continue;
    // Iterative DFS: [node, next child index].
    const stack: Array<[number, number]> = [[start, 0]];
    state.set(start, 1);
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const [node, at] = top;
      if (at >= out[node].length) {
        state.set(node, 2);
        stack.pop();
        continue;
      }
      top[1] += 1;
      const next = out[node][at];
      const seen = state.get(next) ?? 0;
      if (seen === 1) continue; // back edge: closes a cycle
      kept.push([node, next]);
      if (seen === 0) {
        state.set(next, 1);
        stack.push([next, 0]);
      }
    }
  }
  return kept;
}

/** Layer of each member: the longest path from a source; a source then moves right to just before its first consumer. */
function layering(members: number[], graph: Graph): Map<number, number> {
  const indegree = new Map<number, number>(members.map((node) => [node, graph.preds[node].length]));
  const ready = members.filter((node) => indegree.get(node) === 0);
  const order: number[] = [];
  while (ready.length > 0) {
    ready.sort((a, b) => a - b);
    const node = ready.shift()!;
    order.push(node);
    for (const next of graph.succs[node]) {
      const left = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, left);
      if (left === 0) ready.push(next);
    }
  }
  const layer = new Map<number, number>();
  for (const node of order) {
    let value = 0;
    for (const pred of graph.preds[node]) value = Math.max(value, (layer.get(pred) ?? 0) + 1);
    layer.set(node, value);
  }
  // A source feeding only a late node (an empty latent for the sampler) sits next to it, not in column one.
  for (const node of order) {
    if (graph.preds[node].length > 0 || graph.succs[node].length === 0) continue;
    const first = Math.min(...graph.succs[node].map((next) => layer.get(next) ?? 1));
    layer.set(node, Math.max(layer.get(node) ?? 0, first - 1));
  }
  return layer;
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Barycenter ordering: each layer sorted by the mean rank of its neighbours in the layer before (then after). */
function orderLayers(layers: number[][], graph: Graph, seed: Map<number, number>, sweeps: number): number[][] {
  const rank = new Map<number, number>();
  const ordered = layers.map((layer) => [...layer].sort((a, b) => (seed.get(a)! - seed.get(b)!) || a - b));
  const setRanks = (layer: number[]) => layer.forEach((node, at) => rank.set(node, at));
  ordered.forEach(setRanks);
  const sortBy = (layer: number[], neighbours: (node: number) => number[]) => {
    const key = new Map<number, number>();
    for (const node of layer) {
      const around = neighbours(node).filter((next) => rank.has(next)).map((next) => rank.get(next)!);
      key.set(node, mean(around) ?? rank.get(node)!);
    }
    layer.sort((a, b) => (key.get(a)! - key.get(b)!) || (rank.get(a)! - rank.get(b)!) || a - b);
    setRanks(layer);
  };
  for (let sweep = 0; sweep < sweeps; sweep += 1) {
    for (let at = 1; at < ordered.length; at += 1) sortBy(ordered[at], (node) => graph.preds[node]);
    for (let at = ordered.length - 2; at >= 0; at -= 1) sortBy(ordered[at], (node) => graph.succs[node]);
  }
  return ordered;
}

/**
 * Places one layer top to bottom in its order: each node as close to its wanted top as the one above allows,
 * then the whole layer shifted up by the mean push-down so it stays centred on what it wanted.
 */
function settle(layer: number[], wanted: Map<number, number>, heights: number[], gapY: number, top: Map<number, number>): void {
  let cursor = -Infinity;
  const pushed: number[] = [];
  for (const node of layer) {
    const want = wanted.get(node) ?? (cursor === -Infinity ? 0 : cursor);
    const y = cursor === -Infinity ? want : Math.max(want, cursor);
    pushed.push(y - want);
    top.set(node, y);
    cursor = y + heights[node] + gapY;
  }
  const shift = mean(pushed) ?? 0;
  if (shift > 0) for (const node of layer) top.set(node, top.get(node)! - shift);
}

/** One connected part laid out with its top-left at 0,0. */
function layoutPart(members: number[], graph: Graph, nodes: LayoutNode[], gapX: number, gapY: number, sweeps: number): Map<number, Point> {
  const layerOf = layering(members, graph);
  const depth = Math.max(...members.map((node) => layerOf.get(node)!)) + 1;
  const layers: number[][] = Array.from({ length: depth }, () => []);
  for (const node of members) layers[layerOf.get(node)!].push(node);
  const seed = new Map(members.map((node) => [node, typeof nodes[node].y === 'number' && Number.isFinite(nodes[node].y) ? nodes[node].y! : node]));
  const ordered = orderLayers(layers, graph, seed, sweeps);

  const heights = nodes.map((node) => node.height);
  const xs: number[] = [];
  let x = 0;
  for (const layer of ordered) {
    xs.push(x);
    x += Math.max(0, ...layer.map((node) => nodes[node].width)) + gapX;
  }

  const top = new Map<number, number>();
  const centre = (node: number) => top.get(node)! + heights[node] / 2;
  // Down: each node centred on what feeds it.
  ordered.forEach((layer, at) => {
    const wanted = new Map<number, number>();
    if (at > 0) {
      for (const node of layer) {
        const target = mean(graph.preds[node].filter((pred) => top.has(pred)).map(centre));
        if (target !== null) wanted.set(node, target - heights[node] / 2);
      }
    }
    settle(layer, wanted, heights, gapY, top);
  });
  // Up: a source (a loader, an empty latent) centred on what it feeds; other nodes stay where they are.
  for (let at = ordered.length - 1; at >= 0; at -= 1) {
    const layer = ordered[at];
    const wanted = new Map<number, number>();
    for (const node of layer) {
      const target = graph.preds[node].length === 0 ? mean(graph.succs[node].map(centre)) : null;
      wanted.set(node, target !== null ? target - heights[node] / 2 : top.get(node)!);
    }
    settle(layer, wanted, heights, gapY, top);
  }

  const minY = Math.min(...members.map((node) => top.get(node)!));
  const placed = new Map<number, Point>();
  ordered.forEach((layer, at) => {
    for (const node of layer) placed.set(node, { x: xs[at], y: top.get(node)! - minY });
  });
  return placed;
}

/**
 * Layered left-to-right layout. Returns the new top-left of every node, by id.
 * - layers: longest path from the sources, cycles broken; a source sits just before its first consumer;
 * - order inside a layer: barycenter of neighbours over a few sweeps, seeded by the current y;
 * - x: each layer as wide as its widest node plus `gapX`; y: stacked with `gapY`, centred against neighbours;
 * - disconnected parts are stacked below one another; with obstacles, each part moves to the nearest spot
 *   where its whole box covers none of them.
 */
export function layoutGraph(nodes: LayoutNode[], edges: LayoutEdge[], options: LayoutOptions = {}): Map<string, Point> {
  const gapX = options.gapX ?? LAYOUT_GAPS.gapX;
  const gapY = options.gapY ?? LAYOUT_GAPS.gapY;
  const componentGap = options.componentGap ?? LAYOUT_GAPS.componentGap;
  const origin = options.origin ?? { x: 0, y: 0 };
  const sweeps = Math.max(0, Math.floor(options.sweeps ?? 4));
  const result = new Map<string, Point>();
  if (nodes.length === 0) return result;

  const ids = nodes.map((node) => node.id);
  const index = new Map(ids.map((id, at) => [id, at]));
  const out: number[][] = ids.map(() => []);
  const pairs: Array<[number, number]> = [];
  const seen = new Set<string>();
  for (const edge of edges) {
    const a = index.get(edge.source);
    const b = index.get(edge.target);
    if (a === undefined || b === undefined || a === b) continue;
    const key = `${a}>${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out[a].push(b);
    pairs.push([a, b]);
  }
  const graph: Graph = { ids, index, preds: ids.map(() => []), succs: ids.map(() => []) };
  const parts = components(ids.length, pairs);
  for (const members of parts) {
    for (const [a, b] of acyclic(members, out)) {
      graph.succs[a].push(b);
      graph.preds[b].push(a);
    }
  }

  const blocked: Rect[] = [...(options.obstacles ?? [])];
  let cursorY = origin.y;
  for (const members of parts) {
    const local = layoutPart(members, graph, nodes, gapX, gapY, sweeps);
    const box = boundsOfRects(members.map((node) => ({ ...local.get(node)!, width: nodes[node].width, height: nodes[node].height })))!;
    const spot = findFreeSlot(blocked, { x: origin.x, y: cursorY }, { width: box.width, height: box.height }, componentGap);
    for (const node of members) {
      const at = local.get(node)!;
      result.set(ids[node], { x: Math.round(spot.x + at.x), y: Math.round(spot.y + at.y) });
    }
    blocked.push({ x: spot.x, y: spot.y, width: box.width, height: box.height });
    cursorY = spot.y + box.height + componentGap;
  }
  return result;
}
