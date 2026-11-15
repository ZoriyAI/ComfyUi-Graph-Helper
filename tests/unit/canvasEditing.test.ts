/**
 * Protects three canvas edits: Arrange pushes a node out of a group frame it does not belong to, a link dropped on
 * empty canvas finds the right port of the node the person picks, and copy keeps only the links inside the copied
 * nodes with their own titles and stored values. Each one decides whether the person's graph looks and connects as
 * they meant.
 */
import { describe, expect, it } from 'vitest';
import { clearGroups, GROUP_PAD, GROUP_TITLE } from '../../src/renderer/components/graph/arrange';
import { linkHandleFor } from '../../src/renderer/components/graph/AddNodeSearch';
import { fragmentOf, pasteEdits } from '../../src/renderer/components/graph/lib/clipboard';
import type { NodeClassDetail } from '../../src/shared/contracts/knowledge';
import type { GraphNode } from '../../src/renderer/types/graph';

/** A node rectangle at the given point, 200 by 100. */
const box = (x: number, y: number) => ({ x, y, width: 200, height: 100 });

describe('Arrange keeps strangers out of a group', () => {
  it('pushes a node the arrangement moved below the frame of a group it does not belong to', () => {
    const rects = new Map([['a', box(0, 0)], ['b', box(0, 300)], ['c', box(0, 150)]]);
    const out = clearGroups(rects, [{ nodeIds: ['a', 'b'] }], new Set(['a', 'b', 'c']), 40);
    // Node b ends at 400; the frame adds its padding, and the pushed node keeps the 40 gap below it.
    const frameBottom = 300 + 100 + GROUP_PAD;
    expect(out.get('c')!.y).toBe(frameBottom + 40);
    expect(out.get('a')).toEqual(box(0, 0));
    expect(GROUP_TITLE).toBeGreaterThan(0);
  });

  it('leaves alone a node the arrangement does not move, and a group member', () => {
    const rects = new Map([['a', box(0, 0)], ['b', box(0, 300)], ['c', box(0, 150)]]);
    expect(clearGroups(rects, [{ nodeIds: ['a', 'b'] }], new Set(['a', 'b'])).get('c')).toEqual(box(0, 150));
  });
});

/** A catalog class detail from [name, type, isWidget] inputs and output types. */
const detail = (inputs: Array<[string, string, boolean]>, outputs: string[]): NodeClassDetail => ({
  classType: 'X', displayName: 'X', category: '', pack: 'core', detailed: true, description: '',
  inputs: inputs.map(([name, type, widget]) => ({ name, type, widget, required: true })),
  outputs: outputs.map((type) => ({ name: type, type })), widgetOrder: [], widgetOrderReliable: true, outputNode: false, syncedAt: null,
});

describe('a link dropped on empty canvas', () => {
  it('finds the port of the chosen node, numbered links first and fields after, as the engine numbers them', () => {
    const sampler = detail([['model', 'MODEL', false], ['seed', 'INT', true], ['positive', 'CONDITIONING', false], ['latent_image', 'LATENT', false]], ['LATENT']);
    expect(linkHandleFor(sampler, { nodeId: '1', handle: 'out-0', direction: 'output', dataType: 'CONDITIONING' })).toBe('in-1');
    expect(linkHandleFor(sampler, { nodeId: '1', handle: 'out-0', direction: 'output', dataType: 'INT' })).toBe('in-3');
    expect(linkHandleFor(sampler, { nodeId: '9', handle: 'in-0', direction: 'input', dataType: 'LATENT' })).toBe('out-0');
    expect(linkHandleFor(sampler, { nodeId: '9', handle: 'in-0', direction: 'input', dataType: 'IMAGE' })).toBeNull();
    expect(linkHandleFor(null, { nodeId: '9', handle: 'in-0', direction: 'input', dataType: 'IMAGE' })).toBeNull();
  });
});

describe('copy and paste', () => {
  const node = (id: string, x: number, data: Partial<GraphNode['data']>): GraphNode => ({
    id, type: 'comfy', position: { x, y: 0 }, data: { comfyType: 'CLIPTextEncode', title: 'CLIPTextEncode', inputs: [], outputs: [], parameters: {}, ...data },
  } as unknown as GraphNode);

  it('keeps the links between copied nodes only, own titles, and values stored by an imported workflow', () => {
    const text = detail([['clip', 'CLIP', false], ['text', 'STRING', true]], ['CONDITIONING']);
    text.widgetOrder = ['text'];
    const nodes = [
      node('1', 0, { comfyType: 'CheckpointLoaderSimple', title: 'CheckpointLoaderSimple' }),
      node('2', 400, { title: 'Positive', comfy: { widgets_values: ['a fox'] } } as never),
    ];
    const edges = [
      { id: 'e1', source: '1', target: '2', sourceHandle: 'out-1', targetHandle: 'in-0' },
      { id: 'e2', source: '2', target: '7', sourceHandle: 'out-0', targetHandle: 'in-1' },
    ];
    const fragment = fragmentOf(nodes, edges as never);
    expect(fragment.nodes).toEqual(nodes);
    expect((fragment.nodes[1].data.comfy as { widgets_values?: unknown[] } | undefined)?.widgets_values).toEqual(['a fox']);
    expect(fragment.nodes[1].data.title).toBe('Positive');
    expect(fragment.edges).toEqual([edges[0]]);
    expect(pasteEdits(fragment, 40)).toEqual([
      { type: 'paste-selection', nodes, edges: [edges[0]], offsetX: 40, offsetY: 40 },
    ]);
    fragment.nodes[1].data.title = 'Changed copy';
    expect(nodes[1].data.title).toBe('Positive');
  });
});
