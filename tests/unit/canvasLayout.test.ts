/**
 * Protects where new and suggested nodes go and how big the layout thinks they are (components/graph/lib geometry,
 * nodeSizes, autoFit, the ghost layer and Arrange): a new node gets the height its class is drawn at, a spot is
 * chosen with that height, a ghost reserves the room of the node that lands, and the overview level switches with
 * hysteresis. Without these, a node or a suggestion lands on top of the person's other nodes.
 */
import { describe, expect, it } from 'vitest';
import { arrangeMoves } from '../../src/renderer/components/graph/arrange';
import { easeInOut, lerpPoint, movedFrom } from '../../src/renderer/components/graph/lib/glide';
import { freeSpotFor, ghostNodePosition, ghostSpotFree, viewCentreSpot, GHOST_SIZE, NEW_NODE_GAP, NEW_NODE_SIZE } from '../../src/renderer/components/graph/lib/geometry';
import { layoutRect, newNodeSize, nextOverview, OVERVIEW_EXIT, rememberSizes, setOverviewLevel, sizeHintsOf, titleScale } from '../../src/renderer/components/graph/lib/nodeSizes';
import { AUTO_FIT_MIN_ZOOM, autoFitFloor, focusNode } from '../../src/renderer/components/graph/lib/autoFit';
import { ghostRoom, insertRoom } from '../../src/renderer/components/graph/layers/GhostLayer';
import type { NodeClassDetail } from '../../src/shared/contracts/knowledge';
import { NODE_BOX, rectsOverlap } from '../../src/shared/graph/layout';

/** KSampler as a catalog gives it: four link inputs, six fields, one output. Drawn 402 px tall. */
const SAMPLER: NodeClassDetail = {
  classType: 'KSampler',
  displayName: 'KSampler',
  category: 'sampling',
  pack: 'core',
  detailed: true,
  description: '',
  inputs: [
    { name: 'model', type: 'MODEL', widget: false, required: true },
    { name: 'seed', type: 'INT', widget: true, required: true },
    { name: 'steps', type: 'INT', widget: true, required: true },
    { name: 'cfg', type: 'FLOAT', widget: true, required: true },
    { name: 'sampler_name', type: 'COMBO', widget: true, required: true },
    { name: 'scheduler', type: 'COMBO', widget: true, required: true },
    { name: 'positive', type: 'CONDITIONING', widget: false, required: true },
    { name: 'negative', type: 'CONDITIONING', widget: false, required: true },
    { name: 'latent_image', type: 'LATENT', widget: false, required: true },
    { name: 'denoise', type: 'FLOAT', widget: true, required: true },
  ],
  outputs: [{ name: 'LATENT', type: 'LATENT' }],
  widgetOrder: ['seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'],
  widgetOrderReliable: true,
  outputNode: false,
  syncedAt: 1,
};
const PROMPT: NodeClassDetail = {
  ...SAMPLER,
  classType: 'CLIPTextEncode',
  displayName: 'CLIP Text Encode (Prompt)',
  inputs: [
    { name: 'text', type: 'STRING', widget: true, required: true, spec: { kind: 'string', multiline: true } },
    { name: 'clip', type: 'CLIP', widget: false, required: true },
  ],
  outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING' }],
  widgetOrder: ['text'],
};

/** A canvas node at a position, measured 240 by 120 unless `extra` says otherwise. */
const at = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({ id, position: { x, y }, measured: { width: 240, height: 120 }, ...extra });

describe('manual placement', () => {
  it('keeps a free drop point and moves one that would cover a node', () => {
    const nodes = [at('a', 0, 0)];
    expect(freeSpotFor(nodes, { x: 600, y: 0 })).toEqual({ x: 600, y: 0 });
    const spot = freeSpotFor(nodes, { x: 30, y: 30 });
    expect(rectsOverlap({ ...spot, ...NEW_NODE_SIZE }, { x: 0, y: 0, width: 240, height: 120 })).toBe(false);
  });

  it('gives a new node the size its class is drawn at', () => {
    // The heights the canvas draws these two at (tests/e2e/node-size.test.ts measures them).
    expect(newNodeSize('KSampler', SAMPLER)).toEqual({ width: 240, height: 370 });
    expect(newNodeSize('CLIPTextEncode', PROMPT)).toEqual({ width: 240, height: 177 });
    // Before ComfyUI is read a core class is a name without ports; main then gives the node the ports the app
    // ships for it (four link inputs and an output for the sampler: 181 px on the canvas).
    const unread: NodeClassDetail = { ...SAMPLER, detailed: false, inputs: [], outputs: [], widgetOrder: [] };
    expect(newNodeSize('KSampler', unread)).toEqual({ width: 240, height: 181 });
    expect(newNodeSize('KSampler', null)).toEqual({ width: 240, height: 181 });
    // A class nobody knows: one output. The file a model loader comes with is a field.
    expect(newNodeSize('SomethingNew', null)).toEqual({ width: 240, height: 55 + (4 + 28) + 10 });
    expect(newNodeSize('SomethingNew', null, { parameters: { ckpt_name: 'a.safetensors' } }).height).toBe(55 + (4 + 28) + (9 + 30) + 10);
    // A Note has no ports, but placement still reserves its text editor.
    expect(newNodeSize('Note', { ...unread, classType: 'Note', pack: 'some-pack' })).toEqual({ width: 240, height: 163 });
    // The widget order rides along: a node from a file keeps its values in widgets_values by it.
    expect(sizeHintsOf(PROMPT)).toEqual({ inputs: [{ name: 'text', widget: true, multiline: true }, { name: 'clip', widget: false, multiline: false }], widgetOrder: PROMPT.widgetOrder });
    expect(sizeHintsOf(null)).toBeNull();
  });

  it('keeps a tall node clear of the node below it: the spot is chosen with the real height', () => {
    // A node 280 px under the point the person chose. A box 200 px tall would fit with its 72 px gap; the sampler
    // (402 px) does not.
    const nodes = [at('below', 0, 280)];
    const sampler = newNodeSize('KSampler', SAMPLER);
    expect(freeSpotFor(nodes, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    const spot = freeSpotFor(nodes, { x: 0, y: 0 }, sampler);
    expect(rectsOverlap({ ...spot, ...sampler }, { x: 0, y: 280, width: 240, height: 120 }, NEW_NODE_GAP - 1)).toBe(false);
    // Room for a collapsed description card (34 px and its 8 px gap) between any two nodes.
    expect(NEW_NODE_GAP).toBeGreaterThanOrEqual(34 + 8 + 8);
  });

  it('sizes a node first seen on the map of the canvas by its ports and fields, not by the small block drawn there', () => {
    setOverviewLevel(true);
    const folded = at('new', 0, 0, { measured: { width: 240, height: 48 }, data: { inputs: [{ name: 'model', dataType: 'MODEL' }], outputs: [{ name: 'LATENT' }], parameters: { steps: 20 } } });
    expect(layoutRect(folded).height).toBe(55 + (4 + 28) + (9 + 30) + 10);
    setOverviewLevel(false);
    expect(layoutRect(folded).height).toBe(48);
  });

  it('sizes a node the canvas has not measured yet by its ports and fields, so the next node is not put on it', () => {
    setOverviewLevel(false);
    const data = { inputs: [{ name: 'model', dataType: 'MODEL' }], outputs: [{ name: 'LATENT' }], parameters: { steps: 20 } };
    // Header, one input row, one output row, one field row and the bottom padding, in pixels.
    const whole = 55 + (4 + 28) + (9 + 30) + 10;
    // Added a moment ago: no measurement, and nothing remembered of it.
    expect(layoutRect(at('just-added', 0, 0, { data, measured: undefined })).height).toBe(whole);
    // Once the canvas has measured it, the measurement is the size.
    expect(layoutRect(at('just-added', 0, 0, { data, measured: { width: 240, height: 171 } })).height).toBe(171);
    // A second node asked for under the first one keeps the gap from the real bottom of the first.
    const first = at('first', 0, 0, { data, measured: undefined });
    const spot = freeSpotFor([first], { x: 0, y: 130 }, { width: 240, height: 100 }, (node) => layoutRect(node));
    expect(rectsOverlap({ ...spot, width: 240, height: 100 }, { x: 0, y: 0, width: 240, height: whole }, NEW_NODE_GAP - 1)).toBe(false);
    // A description written later makes its box taller by less than the gap kept under a node.
    expect(NODE_BOX.textGrowth).toBeLessThanOrEqual(NEW_NODE_GAP - 16);
  });

  it('centres a new node in the view', () => {
    expect(viewCentreSpot({ x: 0, y: 0, zoom: 1, width: 1000, height: 800 })).toEqual({ x: 500 - NEW_NODE_SIZE.width / 2, y: 400 - NEW_NODE_SIZE.height / 2 });
    expect(viewCentreSpot({ x: -100, y: 0, zoom: 2, width: 1000, height: 800 })).toEqual({ x: 300 - NEW_NODE_SIZE.width / 2, y: 200 - NEW_NODE_SIZE.height / 2 });
    expect(viewCentreSpot(null)).toBeNull();
  });
});

describe('a suggested node', () => {
  const payload = { type: 'add-node' as const, nodeType: 'KSampler', x: 0, y: 0 };

  it('takes the room of the node that lands there once it is accepted', () => {
    // The catalog has not answered yet: a size that suits most nodes.
    expect(ghostRoom(payload, undefined, false)).toEqual(GHOST_SIZE);
    // The ghost's own card shows link inputs only; the node that lands has its six fields too.
    expect(ghostRoom(payload, SAMPLER, false)).toEqual({ width: 240, height: 370 });
    // The catalog does not have the class: the node lands with the ports the app ships for it.
    expect(ghostRoom(payload, null, false)).toEqual({ width: 240, height: 181 });
    // A small class: the ghost with its flag, note and buttons is the taller of the two.
    const small: NodeClassDetail = { ...SAMPLER, classType: 'PreviewImage', inputs: [{ name: 'images', type: 'IMAGE', widget: false, required: true }], outputs: [] };
    const lands = newNodeSize('PreviewImage', small).height;
    expect(lands).toBe(97);
    expect(ghostRoom({ ...payload, nodeType: 'PreviewImage' }, small, true).height).toBe(26 + lands + 65 + 30);
  });

  it('a suggested subgraph takes the room of its card with its ports', () => {
    expect(insertRoom(undefined, undefined, false)).toEqual(GHOST_SIZE);
    const definition = { name: 'Upscale', inputs: [{ name: 'image', type: 'IMAGE' }], outputs: [{ name: 'IMAGE', type: 'IMAGE' }] } as Parameters<typeof insertRoom>[0];
    // The card: header, one input, one output, bottom; over it the flag, under it the buttons.
    const card = 55 + (4 + 28) + 10;
    expect(insertRoom(definition, undefined, false)).toEqual({ width: 240, height: 26 + card + 30 });
    // A title of its own adds the line that names the subgraph; a note adds its block.
    expect(insertRoom(definition, 'Second upscale', true).height).toBe(26 + card + 26 + 65 + 30);
  });

  it('moves off a spot where the landing node would cover the node below', () => {
    const nodes = [at('below', 0, 260)];
    const room = ghostRoom(payload, SAMPLER, false);
    // With the room of a small node the proposed spot looks free; with the sampler's it is not.
    expect(ghostNodePosition(payload, nodes)).toEqual({ x: 0, y: 0 });
    const spot = ghostNodePosition(payload, nodes, 0, room);
    expect(rectsOverlap({ ...spot, ...room }, { x: 0, y: 260, width: 240, height: 120 })).toBe(false);
    expect(ghostSpotFree({ x: 0, y: 0 }, nodes)).toBe(true);
    expect(ghostSpotFree({ x: 0, y: 0 }, nodes, room)).toBe(false);
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
  it('switches with hysteresis while the person zooms, by the line alone after a fit', () => {
    expect(nextOverview(false, 0.45)).toBe(true);
    expect(nextOverview(false, 0.53)).toBe(false);
    expect(nextOverview(true, 0.53)).toBe(true);
    expect(nextOverview(true, 0.6)).toBe(false);
    // The app's own camera move: the same zoom always shows the same level.
    expect(nextOverview(true, 0.53, false)).toBe(false);
    expect(nextOverview(false, 0.45, false)).toBe(true);
    expect(titleScale(0.4)).toBe(2.5);
    expect(titleScale(0.1)).toBe(2.5);
    expect(titleScale(1.5)).toBe(1);
  });

  it('keeps an automatic fit readable', () => {
    expect(autoFitFloor(4)).toBe(OVERVIEW_EXIT);
    expect(autoFitFloor(13)).toBe(AUTO_FIT_MIN_ZOOM);
    const nodes = [{ id: 'a', type: 'comfy' }, { id: 'b', type: 'comfy' }, { id: 'out', type: 'boundary' }];
    expect(focusNode(nodes)?.id).toBe('b');
    expect(focusNode(nodes.map((node) => ({ ...node, selected: node.id === 'a' })))?.id).toBe('a');
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
