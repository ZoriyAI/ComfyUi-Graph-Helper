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
 * A node's size when nothing measured it (main has no DOM): the card width, and a height from its header, its
 * port rows and its field rows. Deliberately generous: a slightly wide gap is fine, an overlap is not.
 */
export function estimateNodeSize(data: { inputs?: unknown; outputs?: unknown; parameters?: unknown } | null | undefined): Size {
  const inputs = Array.isArray(data?.inputs) ? data!.inputs as Array<{ name?: unknown }> : [];
  const outputs = Array.isArray(data?.outputs) ? data!.outputs as unknown[] : [];
  const parameters = data?.parameters && typeof data.parameters === 'object' ? Object.keys(data.parameters as object) : [];
  // A field that is also listed as an input row is counted once.
  const inputNames = new Set(inputs.map((input) => (typeof input?.name === 'string' ? input.name : '')));
  const fields = parameters.filter((name) => !inputNames.has(name)).length;
  const height = 56 + (inputs.length + outputs.length) * 24 + fields * 30 + 16;
  return { width: ESTIMATED_NODE_WIDTH, height: Math.max(96, height) };
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
