/**
 * The canvas and the catalog, as the app holds them, seen the way a lesson needs them (lessons/lessonModel.ts, used
 * by LessonPanel and lesson authoring). The lesson engine judges this view, so a value missed from an imported node
 * or a link counted twice would tell a person a step is not done when it is, or the other way round.
 */
import { describe, expect, it } from 'vitest';
import { classPortsOf, modelFilesOf, lessonClasses, lessonGraphOf, nodeNameOf } from '../../src/renderer/components/lessons/lessonModel';
import { lessonGaps, lessonProgress } from '../../src/shared/lessons/engine';
import { LESSONS, lessonById } from '../../src/shared/lessons/lessons';
import type { NodeClassDetail } from '../../src/shared/contracts/knowledge';
import type { GraphEdge, GraphNode } from '../../src/renderer/types/graph';

const detail = (classType: string, displayName: string, inputs: NodeClassDetail['inputs'], outputs: NodeClassDetail['outputs'], widgetOrder: string[] = []): NodeClassDetail => ({
  classType, displayName, category: '', pack: 'core', detailed: inputs.length + outputs.length > 0, description: '', inputs, outputs, widgetOrder, widgetOrderReliable: true, outputNode: false, syncedAt: 1,
});

const DETAILS: Record<string, NodeClassDetail | null> = {
  CheckpointLoaderSimple: detail('CheckpointLoaderSimple', 'Load Checkpoint', [{ name: 'ckpt_name', type: 'COMBO', widget: true, required: true }], [{ name: 'MODEL', type: 'MODEL' }, { name: 'CLIP', type: 'CLIP' }, { name: 'VAE', type: 'VAE' }], ['ckpt_name']),
  CLIPTextEncode: detail('CLIPTextEncode', 'CLIP Text Encode (Prompt)', [{ name: 'text', type: 'STRING', widget: true, required: true }, { name: 'clip', type: 'CLIP', widget: false, required: true }], [{ name: 'CONDITIONING', type: 'CONDITIONING' }], ['text']),
  // A core class before ComfyUI is read: a name without ports.
  KSampler: detail('KSampler', 'KSampler', [], []),
  Missing: null,
};

/** A canvas node of a class above, link inputs first and then widget inputs, as the canvas numbers its ports. */
function node(id: string, comfyType: string, extra: Partial<GraphNode['data']> = {}): GraphNode {
  const known = DETAILS[comfyType];
  const sockets = (known?.inputs ?? []).filter((input) => !input.widget);
  const widgets = (known?.inputs ?? []).filter((input) => input.widget);
  return {
    id,
    type: 'comfy',
    position: { x: 0, y: 0 },
    data: {
      comfyType,
      inputs: [...sockets, ...widgets].map((input, index) => ({ id: `in-${index}`, name: input.name, dataType: input.type, optional: false })),
      outputs: (known?.outputs ?? []).map((output, index) => ({ id: `out-${index}`, name: output.name, dataType: output.type, optional: false })),
      parameters: {},
      ...extra,
    },
  };
}

const edge = (id: string, source: string, sourceHandle: string, target: string, targetHandle: string): GraphEdge => ({ id, source, sourceHandle, target, targetHandle, data: { dataType: '' } });

describe('the canvas as a lesson sees it', () => {
  it('takes classes, ports, links and the values of fields, from parameters or from an imported node\'s widget values', () => {
    const nodes = [
      node('1', 'CheckpointLoaderSimple', { parameters: { ckpt_name: 'a.safetensors' } }),
      node('2', 'CLIPTextEncode', { parameters: { text: 'a lake', 'text::control': 'x' } }),
      // An imported node: its value is in the widget values ComfyUI saved, in the catalog's widget order.
      node('3', 'CLIPTextEncode', { comfy: { widgets_values: ['from the file'] } } as Partial<GraphNode['data']>),
      // A subgraph card is not a node of any class a lesson names.
      node('4', 'uuid', { kind: 'subgraph-instance' }),
    ];
    const edges = [edge('e1', '1', 'out-1', '2', 'in-0'), edge('e2', '1', 'out-1', '4', 'in-0'), { ...edge('e3', '1', 'out-1', '3', 'in-0'), targetHandle: null } as unknown as GraphEdge];
    const graph = lessonGraphOf(nodes, edges, DETAILS);
    expect(graph.nodes.map((item) => [item.id, item.classType])).toEqual([['1', 'CheckpointLoaderSimple'], ['2', 'CLIPTextEncode'], ['3', 'CLIPTextEncode']]);
    expect(graph.nodes[0].values).toEqual({ ckpt_name: 'a.safetensors' });
    expect(graph.nodes[1].values).toEqual({ text: 'a lake' });
    expect(graph.nodes[2].values).toEqual({ text: 'from the file' });
    expect(graph.nodes[1].inputs).toEqual([{ id: 'in-0', name: 'clip', type: 'CLIP' }, { id: 'in-1', name: 'text', type: 'STRING' }]);
    // A link to a node that is not in the lesson's graph, or without a port, is not a link.
    expect(graph.links).toEqual([{ from: '1', fromPort: 'out-1', to: '2', toPort: 'in-0' }]);
  });

  it('follows a lesson on that graph', () => {
    const lesson = lessonById('image')!;
    const nodes = [node('1', 'CheckpointLoaderSimple', { parameters: { ckpt_name: 'a.safetensors' } }), node('2', 'CLIPTextEncode'), node('3', 'CLIPTextEncode')];
    const read = new Set(['intro']);
    const before = lessonProgress(lesson, lessonGraphOf(nodes, [], DETAILS), {}, read);
    expect(lesson.steps[before.current].id).toBe('prompts-clip');
    const linked = lessonProgress(lesson, lessonGraphOf(nodes, [edge('a', '1', 'out-1', '2', 'in-0'), edge('b', '1', 'out-1', '3', 'in-0')], DETAILS), {}, read);
    expect(lesson.steps[linked.current].id).toBe('prompt-text');
  });
});

describe('the catalog as a lesson sees it', () => {
  it('knows a class only once ComfyUI has told its ports', () => {
    const ports = classPortsOf(DETAILS);
    expect(ports('CheckpointLoaderSimple')).toEqual({ inputs: ['ckpt_name'], outputs: [{ name: 'MODEL', type: 'MODEL' }, { name: 'CLIP', type: 'CLIP' }, { name: 'VAE', type: 'VAE' }] });
    expect(ports('KSampler')).toBeNull();
    expect(ports('Missing')).toBeNull();
    expect(ports('NeverAsked')).toBeNull();
    // So the picture lesson does not fit yet: the sampler and the rest are not read.
    expect(lessonGaps(lessonById('image')!, ports).some((gap) => gap.kind === 'class' && gap.classes.includes('KSampler'))).toBe(true);
  });

  it('names a node the way the library does, and falls back to the class', () => {
    const lesson = lessonById('image')!;
    expect(nodeNameOf(lesson, 'checkpoint', DETAILS)).toBe('Load Checkpoint');
    expect(nodeNameOf(lesson, 'positive', DETAILS)).toBe('CLIP Text Encode (Prompt)');
    // Known by name only, or not at all: the class itself.
    expect(nodeNameOf(lesson, 'sampler', DETAILS)).toBe('KSampler');
    expect(nodeNameOf(lesson, 'decode', DETAILS)).toBe('VAEDecode');
    expect(nodeNameOf(lesson, 'nobody', DETAILS)).toBeNull();
  });

  it('asks the catalog about every class a lesson names', () => {
    const classes = lessonClasses();
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) for (const spec of step.roles ?? []) for (const classType of spec.classes) expect(classes).toContain(classType);
    }
    expect(new Set(classes).size).toBe(classes.length);
    expect(classes).toEqual(expect.arrayContaining(['WanImageToVideo', 'EmptyHunyuanLatentVideo', 'CreateVideo', 'SaveVideo', 'LoraLoaderModelOnly']));
  });
});

it('reads Wrapper LoRA trigger sources from lesson rules even without a folder annotation', () => {
  const graph = { nodes: [{ id: 'lora', classType: 'WanVideoLoraSelect', values: { lora: 'style.safetensors' }, inputs: [], outputs: [] }], links: [] } as any;
  expect(modelFilesOf(graph, {})).toEqual([{ directory: 'loras', name: 'style.safetensors' }]);
});
it('does not treat pending or failed metadata as proof that a LoRA needs no trigger words', () => {
  const lesson = { id: 'trigger-check', steps: [{ id: 'trigger', roles: [{ role: 'prompt', classes: ['Text'] }], fields: [{ role: 'prompt', field: 'text', test: { kind: 'has-trigger', of: [{ classType: 'WanVideoLoraSelect', field: 'lora' }] } }] }] } as any;
  const graph = { nodes: [{ id: 'lora', classType: 'WanVideoLoraSelect', values: { lora: 'style.safetensors' }, inputs: [], outputs: [] }, { id: 'text', classType: 'Text', values: { text: 'a mountain scene' }, inputs: [], outputs: [] }], links: [] } as any;
  for (const status of ['pending', 'unavailable'] as const) {
    expect(lessonProgress(lesson, graph, { triggers: {}, triggerStatus: { 'style.safetensors': status } }, new Set()).missing[0]).toMatchObject({ why: { kind: 'metadata' } });
  }
  expect(lessonProgress(lesson, graph, { triggers: { 'style.safetensors': [] }, triggerStatus: { 'style.safetensors': 'ready' } }, new Set()).current).toBe(1);
  const facts = { triggers: { 'style.safetensors': ['neon rain'] }, triggerStatus: { 'style.safetensors': 'ready' as const } };
  expect(lessonProgress(lesson, graph, facts, new Set()).current).toBe(0);
  graph.nodes[1].values.text = 'a mountain scene in neon rain';
  expect(lessonProgress(lesson, graph, facts, new Set()).current).toBe(1);
});
