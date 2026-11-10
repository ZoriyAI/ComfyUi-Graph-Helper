import { describe, expect, it } from 'vitest';
import { arrangeMoves } from '../../src/renderer/components/graph/arrange';
import { easeInOut, lerpPoint, movedFrom } from '../../src/renderer/components/graph/lib/glide';
import { freeSpotFor, viewCentreSpot, NEW_NODE_SIZE } from '../../src/renderer/components/graph/lib/geometry';
import { layoutRect, nextOverview, rememberSizes, setOverviewLevel, titleScale } from '../../src/renderer/components/graph/lib/nodeSizes';
import { rectsOverlap } from '../../src/shared/graph/layout';

const at = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({ id, position: { x, y }, measured: { width: 240, height: 120 }, ...extra });

describe('manual placement', () => {
  it('keeps a free drop point and moves one that would cover a node', () => {
    const nodes = [at('a', 0, 0)];
    expect(freeSpotFor(nodes, { x: 600, y: 0 })).toEqual({ x: 600, y: 0 });
    const spot = freeSpotFor(nodes, { x: 30, y: 30 });
    expect(rectsOverlap({ ...spot, ...NEW_NODE_SIZE }, { x: 0, y: 0, width: 240, height: 120 })).toBe(false);
  });

  it('centres a new node in the view', () => {
    expect(viewCentreSpot({ x: 0, y: 0, zoom: 1, width: 1000, height: 800 })).toEqual({ x: 500 - NEW_NODE_SIZE.width / 2, y: 400 - NEW_NODE_SIZE.height / 2 });
    expect(viewCentreSpot({ x: -100, y: 0, zoom: 2, width: 1000, height: 800 })).toEqual({ x: 300 - NEW_NODE_SIZE.width / 2, y: 200 - NEW_NODE_SIZE.height / 2 });
    expect(viewCentreSpot(null)).toBeNull();
  });
});

describe('arrange the graph', () => {
  const edges = [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }];

  it('lays out the whole graph left to right when fewer than two nodes are selected', () => {
    const nodes = [at('c', 0, 0), at('b', 10, 10, { selected: true }), at('a', 20, 20)];
    const moves = new Map(arrangeMoves(nodes, edges).map((move) => [move.nodeId, move]));
    const x = (id: string) => moves.get(id)?.x ?? nodes.find((node) => node.id === id)!.position.x;
    expect(x('a')).toBeLessThan(x('b'));
    expect(x('b')).toBeLessThan(x('c'));
  });

  it('arranges only the selection, around the nodes that stay', () => {
    const nodes = [at('a', 0, 0, { selected: true }), at('b', 0, 0, { selected: true }), at('c', 300, 0)];
    const moves = arrangeMoves(nodes, edges);
    expect(moves.map((move) => move.nodeId).sort()).toEqual(['a', 'b']);
    const placed = nodes.map((node) => {
      const move = moves.find((item) => item.nodeId === node.id);
      return { x: move?.x ?? node.position.x, y: move?.y ?? node.position.y, width: 240, height: 120 };
    });
    for (let i = 0; i < placed.length; i += 1) for (let j = i + 1; j < placed.length; j += 1) expect(rectsOverlap(placed[i], placed[j])).toBe(false);
  });

  it('uses sizes measured at a readable zoom while the overview has collapsed the nodes', () => {
    setOverviewLevel(false);
    rememberSizes([at('tall', 0, 0, { measured: { width: 240, height: 400 } })]);
    setOverviewLevel(true);
    rememberSizes([at('tall', 0, 0, { measured: { width: 240, height: 60 } })]);
    expect(layoutRect(at('tall', 0, 0, { measured: { width: 240, height: 60 } })).height).toBe(400);
    setOverviewLevel(false);
  });
});

describe('overview level and glide', () => {
  it('switches with hysteresis', () => {
    expect(nextOverview(false, 0.5)).toBe(true);
    expect(nextOverview(false, 0.58)).toBe(false);
    expect(nextOverview(true, 0.58)).toBe(true);
    expect(nextOverview(true, 0.7)).toBe(false);
    expect(titleScale(0.4)).toBe(2.5);
    expect(titleScale(0.1)).toBe(3);
    expect(titleScale(1.5)).toBe(1);
  });

  it('eases and finds what moved', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBe(0.5);
    expect(lerpPoint({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5)).toEqual({ x: 5, y: 10 });
    const shown = new Map([['a', { x: 0, y: 0 }], ['b', { x: 5, y: 5 }]]);
    const moved = movedFrom(shown, [{ id: 'a', position: { x: 0.2, y: 0 } }, { id: 'b', position: { x: 50, y: 5 } }, { id: 'new', position: { x: 1, y: 1 } }]);
    expect([...moved.keys()]).toEqual(['b']);
  });
});
