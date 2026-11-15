/**
 * Protects how a workflow from a ComfyUI file keeps its look on the canvas (shared/workflow/comfyLook): saved sizes,
 * collapsed nodes, editor-only nodes such as Get/Set and Primitive, promoted subgraph fields, colours, the saved
 * camera, native reroutes, and moving covered nodes apart without reordering them. A person opening their own
 * workflow should recognise it, not get a reshuffled graph.
 */
import { describe, expect, it } from 'vitest';
import {
  classPresence,
  collapsedWidth,
  constantName,
  editorKind,
  FILE_BOX,
  fileBox,
  fileColors,
  isCollapsed,
  overlapCount,
  ownPromotedValue,
  partnersOf,
  primitiveTarget,
  promotedFields,
  REROUTE_BOX,
  reroutePaths,
  savedView,
  shortPortType,
  spreadApart,
  withCollapsed,
  type PlacedBox,
} from '../../src/shared/workflow/comfyLook';
import { estimateNodeSize } from '../../src/shared/graph/layout';
import { projectWorkflow } from '../../src/shared/workflow/codec';

/** Canvas node data for a node read from a file, keeping the raw file node in `comfy`. */
const fromFile = (comfy: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  comfyType: String(comfy.type ?? 'KSampler'),
  title: comfy.title,
  comfy,
  importedLinks: [],
  inputs: [],
  outputs: [],
  parameters: {},
  ...extra,
});

describe('sizes from the file', () => {
  it('takes the width the file saved, within bounds, and at least its height with the title bar', () => {
    expect(fileBox(fromFile({ size: [618, 300] }))).toEqual({ width: 618, minHeight: 330 });
    expect(fileBox(fromFile({ size: { 0: 120, 1: 40 } }))).toEqual({ width: FILE_BOX.minWidth, minHeight: 70 });
    expect(fileBox(fromFile({ size: [5000, 10] }))!.width).toBe(FILE_BOX.maxWidth);
  });

  it('leaves a node made in the app at the app size', () => {
    expect(fileBox({ comfyType: 'KSampler', comfy: { size: [200, 80] } })).toBeNull();
    expect(estimateNodeSize({ comfyType: 'KSampler', comfy: { size: [200, 80] }, inputs: [], outputs: [] }).width).toBe(240);
  });

  it('estimates a node from a file at the file width, and never lower than the file height', () => {
    const wide = estimateNodeSize(fromFile({ size: [618, 600] }));
    expect(wide).toEqual({ width: 618, height: 630 });
    const short = estimateNodeSize(fromFile({ size: [300, 10] }, { outputs: [{ name: 'LATENT', dataType: 'LATENT' }] }));
    expect(short.width).toBe(300);
    expect(short.height).toBe(estimateNodeSize({ outputs: [{ name: 'LATENT', dataType: 'LATENT' }] }).height);
  });

  it('estimates a collapsed node as one title row and a Reroute as a dot', () => {
    const collapsed = fromFile({ type: 'GetNode', title: 'Get_VAE', size: [210, 60], flags: { collapsed: true } });
    expect(isCollapsed(collapsed)).toBe(true);
    expect(estimateNodeSize(collapsed)).toEqual({ width: collapsedWidth('Get_VAE'), height: FILE_BOX.collapsedHeight });
    expect(estimateNodeSize(fromFile({ type: 'Reroute', size: [75, 26] }))).toEqual(REROUTE_BOX);
  });

  it('collapses and opens without touching the other flags', () => {
    expect(withCollapsed({ pinned: true }, true)).toEqual({ pinned: true, collapsed: true });
    expect(withCollapsed({ pinned: true, collapsed: true }, false)).toEqual({ pinned: true });
    expect(withCollapsed(undefined, false)).toEqual({});
  });
});

describe('editor-only nodes', () => {
  it('knows the kinds no sync can find', () => {
    expect(['Reroute', 'PrimitiveNode', 'Note', 'MarkdownNote', 'SetNode', 'GetNode'].map(editorKind)).toEqual(['reroute', 'primitive', 'note', 'markdown', 'set', 'get']);
    expect(editorKind('KSampler')).toBeNull();
  });

  it('pairs a Get with its Set by the constant name', () => {
    const nodes = [
      { id: '1', data: { comfyType: 'SetNode', comfy: { widgets_values: ['VAE'] } } },
      { id: '2', data: { comfyType: 'GetNode', comfy: { widgets_values: ['VAE'] } } },
      { id: '3', data: { comfyType: 'GetNode', comfy: { widgets_values: ['VAE'] } } },
      { id: '4', data: { comfyType: 'GetNode', comfy: { widgets_values: ['clip'] } } },
    ];
    expect(constantName(nodes[0].data)).toBe('VAE');
    expect(partnersOf('2', nodes)).toEqual(['1']);
    expect(partnersOf('1', nodes)).toEqual(['2', '3']);
    expect(partnersOf('4', nodes)).toEqual([]);
  });

  it('reads the field a Primitive feeds', () => {
    expect(primitiveTarget({ comfy: { outputs: [{ name: 'INT', type: 'INT', widget: { name: 'width' } }] } })).toEqual({ widget: 'width', dataType: 'INT' });
  });

  it('calls a class missing only once ComfyUI was read, and never an editor node, a copy or a group node', () => {
    expect(classPresence('PaletteMix', null, true, false)).toBe('missing');
    expect(classPresence('PaletteMix', null, false, false)).toBe('unknown');
    expect(classPresence('PaletteMix', undefined, true, false)).toBe('unknown');
    expect(classPresence('KSampler', { classType: 'KSampler' }, true, false)).toBe('known');
    expect(classPresence('SetNode', null, true, false)).toBe('known');
    expect(classPresence('workflow>Detailer', null, true, false)).toBe('known');
    expect(classPresence('0b4c-uuid', null, true, true)).toBe('known');
  });
});

describe('promoted fields of a subgraph copy', () => {
  const copy = { comfy: { properties: { proxyWidgets: [['182', 'text'], ['-1', 'left'], ['190', 'seed'], ['190', 'control_after_generate'], ['-1', 'unet_name']] }, widgets_values: [null, 12, null, null, 'model.safetensors'] } };
  it('reads the list in its order, with the copy\'s own values by position', () => {
    const fields = promotedFields(copy);
    expect(fields.map((field) => `${field.nodeId}:${field.name}`)).toEqual(['182:text', '-1:left', '190:seed', '190:control_after_generate', '-1:unet_name']);
    expect(ownPromotedValue(copy, fields[1])).toEqual({ held: true, value: 12 });
    expect(ownPromotedValue(copy, fields[0])).toEqual({ held: false, value: undefined });
    expect(ownPromotedValue({ comfy: { widgets_values: [] } }, fields[1]).held).toBe(false);
  });
});

describe('colours, port types and the saved view', () => {
  it('takes plain hex colours only', () => {
    expect(fileColors({ comfy: { color: '#432', bgcolor: '#653' } })).toEqual({ color: '#432', bgcolor: '#653' });
    expect(fileColors({ comfy: { color: 'red; background: url(x)' } })).toEqual({});
  });

  it('shortens a long type from its start and says so', () => {
    expect(shortPortType('LATENT')).toBe('LATENT');
    expect(shortPortType('WANVIDIMAGE_CLIPEMBEDS')).toBe('…CLIPEMBEDS');
    expect(shortPortType('WANVIDEOTEXTEMBEDS')).toBe('…DEOTEXTEMBEDS');
    expect(shortPortType('WANVIDEOTEXTEMBEDS').length).toBeLessThanOrEqual(14);
  });

  it('reads extra.ds as the camera LiteGraph had', () => {
    expect(savedView({ extra: { ds: { scale: 0.5, offset: [100, -40] } } })).toEqual({ x: 50, y: -20, zoom: 0.5 });
    expect(savedView({ extra: { ds: { scale: 0, offset: [0, 0] } } })).toBeNull();
    expect(savedView({ extra: {} })).toBeNull();
  });
});

describe('native reroute points', () => {
  it('follows a link through its reroutes, from its start to its end (0.4 extra)', () => {
    const raw = { extra: { reroutes: [{ id: 1, pos: [10, 20] }, { id: 2, parentId: 1, pos: [30, 40] }], linkExtensions: [{ id: 7, parentId: 2 }] } };
    expect(reroutePaths(raw).get('7')).toEqual([{ id: '1', x: 10, y: 20 }, { id: '2', x: 30, y: 40 }]);
  });

  it('reads format 1 reroutes and the links\' parentId', () => {
    const raw = { reroutes: [{ id: 3, pos: [1, 2] }] };
    expect(reroutePaths(raw, [{ id: '9', parentId: 3 }]).get('9')).toEqual([{ id: '3', x: 1, y: 2 }]);
    expect(reroutePaths({}, [{ id: '9', parentId: 3 }]).size).toBe(0);
  });
});

describe('moving covered nodes apart', () => {
  const box = (id: string, x: number, y: number, width = 200, height = 100): PlacedBox => ({ id, x, y, width, height });

  it('moves nothing when nothing is covered', () => {
    expect(spreadApart([box('a', 0, 0), box('b', 0, 200), box('c', 300, 0)]).size).toBe(0);
  });

  it('keeps the columns and the order, and leaves no node on another', () => {
    const boxes = [box('a', 0, 0, 200, 150), box('b', 0, 100), box('c', 0, 180), box('d', 400, 50), box('e', 400, 60)];
    const moved = spreadApart(boxes);
    const after = boxes.map((item) => ({ ...item, ...(moved.get(item.id) ?? {}) }));
    expect(overlapCount(after)).toBe(0);
    expect(after.every((item, index) => item.x === boxes[index].x)).toBe(true);
    const column = after.filter((item) => item.x === 0).sort((a, b) => a.y - b.y).map((item) => item.id);
    expect(column).toEqual(['a', 'b', 'c']);
    expect(moved.has('a')).toBe(false);
    expect(moved.has('d')).toBe(false);
  });
});

describe('the projection keeps what the look reads', () => {
  it('a node from a file carries its size, flags and colours in data.comfy and is marked as from a file', () => {
    const projected = projectWorkflow({
      version: 0.4,
      last_node_id: 1,
      last_link_id: 0,
      nodes: [{ id: 1, type: 'KSampler', pos: [0, 0], size: [400, 262], flags: { collapsed: true }, color: '#332922', bgcolor: '#593930', inputs: [], outputs: [], widgets_values: [] }],
      links: [],
    });
    if ('error' in projected) throw new Error(projected.error);
    const data = projected.snapshot.nodes[0].data;
    expect(fileBox(data)).toEqual({ width: 400, minHeight: 292 });
    expect(isCollapsed(data)).toBe(true);
    expect(fileColors(data)).toEqual({ color: '#332922', bgcolor: '#593930' });
  });
});
