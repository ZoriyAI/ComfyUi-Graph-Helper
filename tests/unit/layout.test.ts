/**
 * Graph layout geometry (shared/graph/layout.ts, used by the commit and placement in main, Arrange, the ghost layer
 * and the canvas node sizes): the layered left-to-right layout, the search for a free spot for a new node, the size
 * estimate of a node card, and the run mode and note text read from an imported node. A person's graph must come out
 * readable after Arrange, and no new or arranged node may land on top of another.
 */
import { describe, expect, it } from 'vitest';
import {
  estimateNodeSize,
  findFreeSlot,
  layoutGraph,
  NODE_BOX,
  nodeRunMode,
  noteTextOf,
  rectsOverlap,
  sizeHintsOfClass,
  type LayoutEdge,
  type LayoutNode,
  type Rect,
} from '../../src/shared/graph/layout';

const node = (id: string, height = 100, width = 240, y?: number): LayoutNode => ({ id, width, height, ...(y === undefined ? {} : { y }) });
const edge = (source: string, target: string): LayoutEdge => ({ source, target });

/** The placed rectangle of every node, for the overlap check. */
function rects(nodes: LayoutNode[], placed: Map<string, { x: number; y: number }>): Array<Rect & { id: string }> {
  return nodes.map((item) => ({ id: item.id, ...placed.get(item.id)!, width: item.width, height: item.height }));
}

/** Fails if any two rectangles intersect, or any rectangle intersects an obstacle. */
function assertNoOverlap(list: Rect[], obstacles: Rect[] = []): void {
  for (let a = 0; a < list.length; a += 1) {
    for (let b = a + 1; b < list.length; b += 1) expect(rectsOverlap(list[a], list[b]), `${JSON.stringify(list[a])} vs ${JSON.stringify(list[b])}`).toBe(false);
    for (const obstacle of obstacles) expect(rectsOverlap(list[a], obstacle)).toBe(false);
  }
}

/** A small seeded generator so the property test is the same on every run. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('layoutGraph', () => {
  it('lays a chain out left to right on one line', () => {
    const nodes = [node('a'), node('b'), node('c')];
    const placed = layoutGraph(nodes, [edge('a', 'b'), edge('b', 'c')], { gapX: 100 });
    // Each step is the node width (240) plus the gap.
    expect(placed.get('a')).toEqual({ x: 0, y: 0 });
    expect(placed.get('b')).toEqual({ x: 340, y: 0 });
    expect(placed.get('c')).toEqual({ x: 680, y: 0 });
  });

  it('puts a diamond in three layers with the join centred between the branches', () => {
    const nodes = [node('top'), node('left'), node('right'), node('join')];
    const placed = layoutGraph(nodes, [edge('top', 'left'), edge('top', 'right'), edge('left', 'join'), edge('right', 'join')]);
    const left = placed.get('left')!;
    const right = placed.get('right')!;
    expect(left.x).toBe(right.x);
    expect(placed.get('join')!.x).toBeGreaterThan(left.x);
    expect(placed.get('top')!.x).toBeLessThan(left.x);
    const centre = (left.y + right.y + 100) / 2;
    expect(Math.abs(placed.get('join')!.y + 50 - centre)).toBeLessThanOrEqual(1);
    expect(Math.abs(placed.get('top')!.y + 50 - centre)).toBeLessThanOrEqual(1);
    assertNoOverlap(rects(nodes, placed));
  });

  it('stacks a fan-out in one column, centred on its source', () => {
    const nodes = [node('src'), node('a'), node('b'), node('c')];
    const placed = layoutGraph(nodes, [edge('src', 'a'), edge('src', 'b'), edge('src', 'c')], { gapY: 40 });
    const column = ['a', 'b', 'c'].map((id) => placed.get(id)!);
    expect(new Set(column.map((point) => point.x)).size).toBe(1);
    expect(column.map((point) => point.y)).toEqual([0, 140, 280]);
    expect(placed.get('src')!.y).toBe(140);
  });

  it('survives a cycle and still flows left to right', () => {
    const nodes = [node('a'), node('b'), node('c')];
    const placed = layoutGraph(nodes, [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')]);
    expect(placed.size).toBe(3);
    expect(placed.get('a')!.x).toBeLessThan(placed.get('b')!.x);
    expect(placed.get('b')!.x).toBeLessThan(placed.get('c')!.x);
    assertNoOverlap(rects(nodes, placed));
  });

  it('stacks disconnected parts below one another', () => {
    const nodes = [node('a'), node('b'), node('lonely', 80), node('c'), node('d')];
    const placed = layoutGraph(nodes, [edge('a', 'b'), edge('c', 'd')], { componentGap: 80 });
    expect(placed.get('a')!.y).toBe(0);
    expect(placed.get('lonely')).toEqual({ x: 0, y: 180 });
    expect(placed.get('c')).toEqual({ x: 0, y: 340 });
    assertNoOverlap(rects(nodes, placed));
  });

  it('puts a source next to its first consumer', () => {
    // loader → encode → sampler, and a latent that only feeds the sampler.
    const nodes = [node('loader'), node('encode'), node('latent'), node('sampler')];
    const placed = layoutGraph(nodes, [edge('loader', 'encode'), edge('encode', 'sampler'), edge('latent', 'sampler')]);
    expect(placed.get('latent')!.x).toBe(placed.get('encode')!.x);
  });

  it('is deterministic', () => {
    const nodes = [node('a', 120), node('b', 80), node('c', 200), node('d'), node('e', 60)];
    const edges = [edge('a', 'c'), edge('b', 'c'), edge('c', 'd'), edge('a', 'e'), edge('e', 'd')];
    const first = layoutGraph(nodes, edges, { origin: { x: 10, y: 20 } });
    const second = layoutGraph(nodes.map((item) => ({ ...item })), edges.map((item) => ({ ...item })), { origin: { x: 10, y: 20 } });
    expect([...second.entries()]).toEqual([...first.entries()]);
  });

  it('starts at the origin and keeps clear of obstacles', () => {
    const nodes = [node('a'), node('b')];
    const obstacles: Rect[] = [{ x: 0, y: 0, width: 300, height: 300 }];
    const placed = layoutGraph(nodes, [edge('a', 'b')], { origin: { x: 0, y: 0 }, obstacles, componentGap: 40 });
    assertNoOverlap(rects(nodes, placed), obstacles);
    const free = layoutGraph(nodes, [edge('a', 'b')], { origin: { x: 500, y: 70 } });
    expect(free.get('a')).toEqual({ x: 500, y: 70 });
  });

  it('never lets two laid-out nodes (or a node and an obstacle) intersect', () => {
    const next = random(7);
    for (let round = 0; round < 60; round += 1) {
      const count = 1 + Math.floor(next() * 24);
      const nodes = Array.from({ length: count }, (_, index) => node(`n${index}`, 40 + Math.floor(next() * 300), 120 + Math.floor(next() * 220), Math.floor(next() * 800)));
      const edges: LayoutEdge[] = [];
      const edgeCount = Math.floor(next() * count * 1.6);
      for (let index = 0; index < edgeCount; index += 1) {
        edges.push(edge(`n${Math.floor(next() * count)}`, `n${Math.floor(next() * count)}`));
      }
      const obstacles: Rect[] = Array.from({ length: Math.floor(next() * 5) }, () => ({
        x: Math.floor(next() * 1200) - 200, y: Math.floor(next() * 1200) - 200, width: 100 + Math.floor(next() * 300), height: 60 + Math.floor(next() * 300),
      }));
      const placed = layoutGraph(nodes, edges, { origin: { x: Math.floor(next() * 400), y: Math.floor(next() * 400) }, obstacles });
      expect(placed.size).toBe(count);
      assertNoOverlap(rects(nodes, placed), obstacles);
    }
  });
});

describe('findFreeSlot', () => {
  it('keeps the preferred spot when it is free', () => {
    expect(findFreeSlot([{ x: 0, y: 0, width: 100, height: 100 }], { x: 300, y: 0 }, { width: 100, height: 100 }, 20)).toEqual({ x: 300, y: 0 });
  });

  it('moves to the nearest free spot next to what is in the way', () => {
    const taken: Rect[] = [{ x: 0, y: 0, width: 240, height: 120 }];
    const spot = findFreeSlot(taken, { x: 10, y: 10 }, { width: 240, height: 120 }, 24);
    expect(rectsOverlap({ ...spot, width: 240, height: 120 }, taken[0], 24)).toBe(false);
    // Below (y 144, 134 away) is nearer than to the right (x 264, 254 away).
    expect(spot).toEqual({ x: 10, y: 144 });
  });

  it('finds a hole between nodes', () => {
    const taken: Rect[] = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 300, y: 0, width: 100, height: 100 },
      { x: 0, y: 300, width: 100, height: 100 },
      { x: 300, y: 300, width: 100, height: 100 },
    ];
    expect(findFreeSlot(taken, { x: 150, y: 150 }, { width: 100, height: 100 }, 20)).toEqual({ x: 150, y: 150 });
    const crowded = [...taken, { x: 140, y: 140, width: 120, height: 120 }];
    const spot = findFreeSlot(crowded, { x: 150, y: 150 }, { width: 100, height: 100 }, 20);
    for (const rect of crowded) expect(rectsOverlap({ ...spot, width: 100, height: 100 }, rect, 20)).toBe(false);
  });

  it('copes with many rects', () => {
    const grid: Rect[] = [];
    for (let row = 0; row < 20; row += 1) for (let col = 0; col < 20; col += 1) grid.push({ x: col * 260, y: row * 140, width: 240, height: 120 });
    const spot = findFreeSlot(grid, { x: 1000, y: 1000 }, { width: 240, height: 120 }, 20);
    for (const rect of grid) expect(rectsOverlap({ ...spot, width: 240, height: 120 }, rect, 20)).toBe(false);
  });
});

describe('estimateNodeSize', () => {
  const sampler = {
    inputs: [
      { name: 'model', dataType: 'MODEL' },
      { name: 'positive', dataType: 'CONDITIONING' },
      { name: 'seed', dataType: 'INT' },
      { name: 'steps', dataType: 'INT' },
    ],
    outputs: [{ name: 'LATENT' }],
    parameters: { seed: 1, steps: 20, 'seed::control_after_generate': 'randomize' },
  };

  it('is the card as the canvas draws it: header, ports, fields, bottom', () => {
    expect(estimateNodeSize(null)).toEqual({ width: 240, height: 65 });
    // Two link inputs and an output: two lists. Two fields; the control slot of the seed rides with its field.
    expect(estimateNodeSize(sampler).height).toBe(55 + (4 + 2 * 28) + (4 + 28) + (9 + 2 * 30) + 10);
  });

  it('follows the catalog on which inputs are fields, and gives a multi-line text its box', () => {
    const prompt = { inputs: [{ name: 'clip', dataType: 'CLIP' }, { name: 'text', dataType: 'STRING' }], outputs: [{ name: 'CONDITIONING' }], parameters: {} };
    // Without the catalog and without a value, `text` is taken for a link input.
    expect(estimateNodeSize(prompt).height).toBe(55 + (4 + 2 * 28) + (4 + 28) + 10);
    const hints = { inputs: [{ name: 'clip', widget: false }, { name: 'text', widget: true, multiline: true }] };
    expect(estimateNodeSize(prompt, hints).height).toBe(55 + (4 + 28) + (4 + 28) + (9 + 30 + 41) + 10);
    // The size measured on the canvas for this very node.
    expect(estimateNodeSize(prompt, hints).height).toBe(209);
  });

  it('counts a value with no input of its name as a field, once', () => {
    const before = estimateNodeSize(sampler).height;
    expect(estimateNodeSize({ ...sampler, parameters: { ...sampler.parameters, cfg: 7 } }).height - before).toBe(30);
  });

  it('adds a note under the fields, and the subgraph line under a card with a title of its own', () => {
    const plain = estimateNodeSize(sampler).height;
    expect(estimateNodeSize({ ...sampler, annotations: ['short'] }).height).toBe(plain + 20 + 18);
    const card = { inputs: [{ name: 'samples', dataType: 'LATENT' }], outputs: [{ name: 'IMAGE' }], kind: 'subgraph-instance', comfyType: 'uuid-1', title: 'uuid-1' };
    const bare = estimateNodeSize(card).height;
    expect(bare).toBe(55 + (4 + 28) + (4 + 28) + 10);
    expect(estimateNodeSize({ ...card, title: 'My upscale' }).height).toBe(bare + 26);
    // A card titled with the subgraph's own name does not repeat it.
    expect(estimateNodeSize({ ...card, title: 'Upscale' }, { subgraphName: 'Upscale' }).height).toBe(bare);
  });

  it('counts the "after run" row under a seed when the catalog gives the field one', () => {
    const detail = {
      inputs: [
        { name: 'model', widget: false },
        { name: 'positive', widget: false },
        { name: 'seed', widget: true, spec: { control: 'randomize' } },
        { name: 'steps', widget: true, spec: {} },
      ],
      widgetOrder: ['seed', 'seed::control_after_generate', 'steps'],
    };
    const hints = sizeHintsOfClass(detail);
    expect(hints.inputs?.map((input) => Boolean(input.afterRun))).toEqual([false, false, true, false]);
    expect(estimateNodeSize(sampler, hints).height).toBe(estimateNodeSize(sampler).height + NODE_BOX.field);
    // No slot in the widget order: ComfyUI keeps no choice for it, so the card draws no row.
    expect(sizeHintsOfClass({ ...detail, widgetOrder: ['seed', 'steps'] }).inputs?.[2].afterRun).toBeUndefined();
  });

  it('gives a Primitive with no value yet the line that says so', () => {
    const empty = { comfyType: 'PrimitiveNode', inputs: [], outputs: [{ name: 'INT' }] };
    expect(estimateNodeSize(empty).height).toBe(55 + (4 + 28) + 10 + NODE_BOX.primitiveEmpty);
    const held = { ...empty, comfy: { widgets_values: [5, 'fixed'] } };
    expect(estimateNodeSize(held).height).toBe(55 + (4 + 28) + 10 + (9 + 2 * 30));
  });
});

describe('imported run modes and notes', () => {
  it('reads bypassed and muted from the saved ComfyUI mode', () => {
    expect(nodeRunMode({ comfy: { mode: 4 } })).toBe('bypassed');
    expect(nodeRunMode({ comfy: { mode: 2 } })).toBe('muted');
    expect(nodeRunMode({ comfy: { mode: 0 } })).toBeNull();
    expect(nodeRunMode({})).toBeNull();
  });

  it('draws a note text box and counts it in the node size', () => {
    const note = { comfyType: 'Note', inputs: [], outputs: [], parameters: {}, comfy: { widgets_values: ['Use the high-noise model first.'] } };
    expect(noteTextOf(note)).toBe('Use the high-noise model first.');
    expect(noteTextOf({ ...note, comfyType: 'KSampler' })).toBe('');
    expect(noteTextOf({ ...note, comfy: { widgets_values: [''] } })).toBe('');
    expect(estimateNodeSize(note).height).toBe(NODE_BOX.header + NODE_BOX.bottom + NODE_BOX.noteText);
    // An empty note still shows the box the person writes into (nodes/NoteText.tsx).
    expect(estimateNodeSize({ ...note, comfy: { widgets_values: [] } }).height).toBe(NODE_BOX.header + NODE_BOX.bottom + NODE_BOX.noteText);
  });
});
