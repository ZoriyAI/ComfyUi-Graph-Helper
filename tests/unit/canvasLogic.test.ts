import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { topologicalOrder, incomingEdgeIds } from '../../src/renderer/components/graph/lib/topology';
import { buildTour, firstExplanation, stepIndexOf, type TourNode } from '../../src/renderer/components/graph/tour/buildTour';
import { connectCandidates, connectMutation, portKey, type AssistNode } from '../../src/renderer/components/graph/lib/connectAssist';
import { dropToAddNode, loaderForModel, MODEL_DRAG_TYPE, NODE_DRAG_TYPE } from '../../src/renderer/components/graph/lib/modelLoaders';
import { boundsOf, ghostNodePosition, ghostSpotFree, groupRect, parameterPill, subgraphGhostRect, unplacedOrder } from '../../src/renderer/components/graph/lib/geometry';
import { clampIndex, nextPlayIndex, playStartIndex, stepReplay } from '../../src/renderer/components/graph/lib/replay';
import { changedNodes, diffGraph, revealSteps } from '../../src/renderer/components/graph/lib/graphDiff';
import { flowingEdges } from '../../src/renderer/components/graph/lib/flow';
import { breadcrumb, definitionView } from '../../src/renderer/components/graph/lib/subgraphView';
import { selectionRefs, sameRefs } from '../../src/renderer/components/graph/lib/selection';
import { categoryAccent, typeColor } from '../../src/renderer/components/graph/lib/typeColors';
import { parseDuration } from '../../src/renderer/motion/policy';
import { ILLUSTRATION_KINDS, illustrationKind, noisePoints } from '../../src/renderer/components/graph/illustrations/kinds';
import Illustration from '../../src/renderer/components/graph/illustrations/Illustration';
import { pruneSubgraphPath, useGraphStore } from '../../src/renderer/state/graphState';
import type { Proposal } from '../../src/shared/contracts/proposals';
import type { Explanation } from '../../src/shared/contracts/knowledge';
import type { SubgraphDefinition } from '../../src/shared/graph/subgraphs';

const port = (id: string, name: string, dataType: string) => ({ id, name, dataType, optional: false });

function txt2img(): { nodes: TourNode[]; edges: Array<{ id: string; source: string; target: string; sourceHandle: string; targetHandle: string }> } {
  return {
    nodes: [
      { id: 'save', position: { x: 1200, y: 0 }, data: { comfyType: 'SaveImage', inputs: [port('in-0', 'images', 'IMAGE')], outputs: [] } },
      { id: 'decode', position: { x: 900, y: 0 }, data: { comfyType: 'VAEDecode', inputs: [port('in-0', 'samples', 'LATENT'), port('in-1', 'vae', 'VAE')], outputs: [port('out-0', 'IMAGE', 'IMAGE')] } },
      { id: 'sampler', position: { x: 600, y: 0 }, data: { comfyType: 'KSampler', title: 'Sampler', inputs: [port('in-0', 'model', 'MODEL'), port('in-1', 'positive', 'CONDITIONING'), port('in-3', 'latent_image', 'LATENT')], outputs: [port('out-0', 'LATENT', 'LATENT')] } },
      { id: 'text', position: { x: 300, y: 200 }, data: { comfyType: 'CLIPTextEncode', inputs: [port('in-0', 'clip', 'CLIP')], outputs: [port('out-0', 'CONDITIONING', 'CONDITIONING')] } },
      { id: 'latent', position: { x: 300, y: 400 }, data: { comfyType: 'EmptyLatentImage', inputs: [], outputs: [port('out-0', 'LATENT', 'LATENT')] } },
      { id: 'ckpt', position: { x: 0, y: 0 }, data: { comfyType: 'CheckpointLoaderSimple', inputs: [], outputs: [port('out-0', 'MODEL', 'MODEL'), port('out-1', 'CLIP', 'CLIP'), port('out-2', 'VAE', 'VAE')] } },
    ],
    edges: [
      { id: 'e1', source: 'ckpt', target: 'sampler', sourceHandle: 'out-0', targetHandle: 'in-0' },
      { id: 'e2', source: 'ckpt', target: 'text', sourceHandle: 'out-1', targetHandle: 'in-0' },
      { id: 'e3', source: 'text', target: 'sampler', sourceHandle: 'out-0', targetHandle: 'in-1' },
      { id: 'e4', source: 'latent', target: 'sampler', sourceHandle: 'out-0', targetHandle: 'in-3' },
      { id: 'e5', source: 'sampler', target: 'decode', sourceHandle: 'out-0', targetHandle: 'in-0' },
      { id: 'e6', source: 'ckpt', target: 'decode', sourceHandle: 'out-2', targetHandle: 'in-1' },
      { id: 'e7', source: 'decode', target: 'save', sourceHandle: 'out-0', targetHandle: 'in-0' },
    ],
  };
}

describe('topological order', () => {
  it('goes from loaders to outputs and breaks ties by position', () => {
    const { nodes, edges } = txt2img();
    expect(topologicalOrder(nodes, edges)).toEqual(['ckpt', 'text', 'latent', 'sampler', 'decode', 'save']);
  });

  it('puts nodes on a cycle last and ignores dangling edges', () => {
    const order = topologicalOrder(
      [{ id: 'a', position: { x: 0, y: 0 } }, { id: 'b', position: { x: 10, y: 0 } }, { id: 'c', position: { x: 5, y: 0 } }],
      [{ source: 'b', target: 'c' }, { source: 'c', target: 'b' }, { source: 'a', target: 'ghost' }],
    );
    expect(order).toEqual(['a', 'c', 'b']);
  });

  it('lists incoming edges of a step', () => {
    expect(incomingEdgeIds('sampler', txt2img().edges)).toEqual(['e1', 'e3', 'e4']);
  });
});

describe('buildTour', () => {
  const explanation = (text: string, aspect: Explanation['aspect'] = 'what'): Explanation => ({
    id: text, projectId: null, owner: { kind: 'nodeClass', id: 'X' }, aspect, text, provenance: 'fact', sourceUrl: null, revisionId: null, createdBy: 'sync', createdAt: 1,
  });

  it('prefers node, then class explanation, then catalog description, then a neutral sentence', () => {
    const { nodes, edges } = txt2img();
    const steps = buildTour(nodes, edges, {
      byNode: { sampler: 'Turns noise into a picture.' },
      byClass: { CLIPTextEncode: 'Turns words into conditioning.' },
      catalog: { VAEDecode: { description: 'Decodes latents.', displayName: 'VAE Decode' } },
    }, (node) => `neutral ${node.id}`);
    expect(steps.map((step) => step.ref.id)).toEqual(['ckpt', 'text', 'latent', 'sampler', 'decode', 'save']);
    expect(steps[3]).toEqual({ ref: { kind: 'node', id: 'sampler', classType: 'KSampler' }, title: 'Sampler', text: 'Turns noise into a picture.' });
    expect(steps[1].text).toBe('Turns words into conditioning.');
    expect(steps[4]).toMatchObject({ title: 'VAE Decode', text: 'Decodes latents.' });
    expect(steps[5]).toMatchObject({ title: 'SaveImage', text: 'neutral save' });
    expect(stepIndexOf(steps, 'decode')).toBe(4);
  });

  it('is deterministic', () => {
    const { nodes, edges } = txt2img();
    const texts = { byNode: {}, byClass: {}, catalog: {} };
    expect(buildTour(nodes, edges, texts, () => 'n')).toEqual(buildTour([...nodes].reverse(), [...edges].reverse(), texts, () => 'n'));
  });

  it('picks the "what" explanation first', () => {
    expect(firstExplanation([explanation('why text', 'why'), explanation('what text')])).toBe('what text');
    expect(firstExplanation([explanation('  ', 'what'), explanation('risk text', 'risk')])).toBe('risk text');
    expect(firstExplanation([])).toBeUndefined();
  });
});

describe('connect assist', () => {
  // The tour's nodes carry every port id the canvas gives them; the assist reads the same shape.
  const nodes = txt2img().nodes.map((node) => ({ id: node.id, position: node.position, data: node.data })) as AssistNode[];
  const edges = txt2img().edges;

  it('lights compatible inputs for an output, prefers a free nearby one, and dims the rest', () => {
    const plan = connectCandidates({ nodeId: 'latent', handle: 'out-0', direction: 'output', dataType: 'LATENT' }, nodes, edges);
    expect([...plan.compatible].sort()).toEqual([portKey('decode', 'in-0'), portKey('sampler', 'in-3')]);
    expect(plan.dimmed.has('save')).toBe(true);
    expect(plan.dimmed.has('ckpt')).toBe(true);
    expect(plan.dimmed.has('sampler')).toBe(false);
    // Both are taken; the nearer one wins.
    expect(plan.best).toEqual({ nodeId: 'sampler', handle: 'in-3', direction: 'input', taken: true });
  });

  it('suggests outputs for an input and builds the connect mutation output → input', () => {
    const from = { nodeId: 'decode', handle: 'in-1', direction: 'input' as const, dataType: 'VAE' };
    const plan = connectCandidates(from, nodes, []);
    expect(plan.best).toEqual({ nodeId: 'ckpt', handle: 'out-2', direction: 'output', taken: false });
    expect(connectMutation(from, plan.best!)).toEqual({ type: 'connect', source: 'ckpt', sourceHandle: 'out-2', target: 'decode', targetHandle: 'in-1' });
  });

  it('treats * as compatible with anything, like ComfyUI', () => {
    const plan = connectCandidates({ nodeId: 'x', handle: 'out-0', direction: 'output', dataType: '*' }, [
      { id: 'x', position: { x: 0, y: 0 }, data: { outputs: [port('out-0', 'any', '*')] } },
      { id: 'y', position: { x: 50, y: 0 }, data: { inputs: [port('in-0', 'model', 'MODEL')] } },
    ], []);
    expect(plan.best?.nodeId).toBe('y');
  });
});

describe('library drops', () => {
  it('maps model directories to core loaders with the widget parameter', () => {
    expect(loaderForModel('checkpoints', 'sdxl.safetensors')).toEqual({ nodeType: 'CheckpointLoaderSimple', parameters: { ckpt_name: 'sdxl.safetensors' } });
    expect(loaderForModel('loras', 'a.safetensors')?.nodeType).toBe('LoraLoader');
    expect(loaderForModel('vae', 'v')?.parameters).toEqual({ vae_name: 'v' });
    expect(loaderForModel('diffusion_models', 'f')?.nodeType).toBe('UNETLoader');
    expect(loaderForModel('unet', 'f')?.nodeType).toBe('UNETLoader');
    expect(loaderForModel('controlnet', 'c')?.parameters).toEqual({ control_net_name: 'c' });
    expect(loaderForModel('upscale_models', 'u')?.nodeType).toBe('UpscaleModelLoader');
    expect(loaderForModel('text_encoders', 't')?.nodeType).toBe('CLIPLoader');
    expect(loaderForModel('clip', 't')?.nodeType).toBe('CLIPLoader');
    expect(loaderForModel('embeddings', 'e')).toBeNull();
    expect(loaderForModel('checkpoints', ' ')).toBeNull();
  });

  it('reads both drag payloads and rejects junk', () => {
    const read = (map: Record<string, string>) => (type: string) => map[type] ?? '';
    expect(dropToAddNode(read({ [NODE_DRAG_TYPE]: JSON.stringify({ classType: 'KSampler' }) }))).toEqual({ nodeType: 'KSampler', parameters: {} });
    expect(dropToAddNode(read({ [MODEL_DRAG_TYPE]: JSON.stringify({ directory: 'loras', name: 'x.safetensors' }) }))).toEqual({ nodeType: 'LoraLoader', parameters: { lora_name: 'x.safetensors' } });
    expect(dropToAddNode(read({ [NODE_DRAG_TYPE]: JSON.stringify({ classType: 'LoraLoader', title: 'Load LoRA' }) }))).toEqual({ nodeType: 'LoraLoader', parameters: {}, title: 'Load LoRA' });
    expect(dropToAddNode(read({ [NODE_DRAG_TYPE]: JSON.stringify({ classType: 'KSampler', title: 'KSampler' }) }))).toEqual({ nodeType: 'KSampler', parameters: {} });
    expect(dropToAddNode(read({ [NODE_DRAG_TYPE]: 'not json' }))).toBeNull();
    expect(dropToAddNode(read({ [MODEL_DRAG_TYPE]: JSON.stringify({ directory: 'loras' }) }))).toBeNull();
    expect(dropToAddNode(read({}))).toBeNull();
  });
});

describe('node titles', () => {
  it('lets a class name wrap between its words and leaves other titles whole', async () => {
    const { titleParts } = await import('../../src/renderer/components/graph/nodes/titleBreaks');
    expect(titleParts('CheckpointLoaderSimple')).toEqual(['Checkpoint', 'Loader', 'Simple']);
    expect(titleParts('easy_loraStackApply')).toEqual(['easy_', 'lora', 'Stack', 'Apply']);
    expect(titleParts('CLIPTextEncodeSDXL')).toEqual(['CLIPText', 'Encode', 'SDXL']);
    // Spaces wrap by themselves; short names fit.
    expect(titleParts('Load Checkpoint')).toEqual(['Load Checkpoint']);
    expect(titleParts('KSampler')).toEqual(['KSampler']);
    expect(titleParts('')).toEqual(['']);
    // The pieces always give the title back.
    for (const title of ['CheckpointLoaderSimple', 'easy_loraStackApply', 'VAEDecodeTiled', 'a_b_c_d_e_f_g_h']) {
      expect(titleParts(title).join('')).toBe(title);
    }
  });
});

describe('ghost and group geometry', () => {
  const nodes = [
    { id: 'a', position: { x: 0, y: 0 }, measured: { width: 200, height: 100 }, data: { parameters: { steps: 20 } } },
    { id: 'b', position: { x: 300, y: 50 } },
  ];

  it('places add-node ghosts at their position, else stacked right of the graph', () => {
    expect(ghostNodePosition({ x: 5, y: 600 }, nodes)).toEqual({ x: 5, y: 600 });
    expect(ghostNodePosition({}, nodes, 0)).toEqual({ x: 620, y: 0 });
    expect(ghostNodePosition({}, nodes, 1)).toEqual({ x: 620, y: 232 });
    expect(ghostNodePosition({}, [], 0)).toEqual({ x: 0, y: 0 });
  });

  it('knows when a spot a ghost took earlier has a node under it now', () => {
    // Free when it was chosen.
    expect(ghostSpotFree({ x: 620, y: 0 }, nodes)).toBe(true);
    // A build tidied the graph and a node moved there: the ghost has to find another spot.
    const moved = [...nodes, { id: 'c', position: { x: 640, y: 40 }, measured: { width: 240, height: 180 } }];
    expect(ghostSpotFree({ x: 620, y: 0 }, moved)).toBe(false);
    const next = ghostNodePosition({ x: 620, y: 0 }, moved);
    expect(ghostSpotFree(next, moved)).toBe(true);
  });

  it('never puts a ghost on top of a node', () => {
    // A proposed position on node a moves to free space right of the graph.
    expect(ghostNodePosition({ x: 5, y: 6 }, nodes)).toEqual({ x: 620, y: 0 });
    // With a selection the ghost goes right of the selected node, below anything in that column.
    const selected = [{ ...nodes[0], selected: true }, nodes[1]];
    expect(ghostNodePosition({}, selected)).toEqual({ x: 280, y: 202 });
  });

  it('numbers only unplaced add-node ghosts', () => {
    const proposal = (id: string, payload: Proposal['payload']): Proposal => ({ id, projectId: 'p', runId: null, kind: payload.type as Proposal['kind'], status: 'proposed', payload, note: '', revisionId: 'r', createdAt: 0, resolvedAt: null });
    const order = unplacedOrder([
      proposal('1', { type: 'add-node', nodeType: 'A' }),
      proposal('2', { type: 'add-node', nodeType: 'B', x: 1, y: 1 }),
      proposal('3', { type: 'remove-node', nodeId: 'a' }),
      proposal('4', { type: 'add-node', nodeType: 'C' }),
    ]);
    expect([...order.entries()]).toEqual([['1', 0], ['4', 1]]);
  });

  it('outlines create-subgraph ghosts and shows parameter pills', () => {
    expect(subgraphGhostRect({ type: 'create-subgraph', name: 'S', nodeIds: ['a', 'b'], inputs: [], outputs: [] }, nodes)).toEqual({ x: -16, y: -48, width: 572, height: 234 });
    expect(subgraphGhostRect({ type: 'create-subgraph', name: 'S', nodeIds: ['zzz'], inputs: [], outputs: [] }, nodes)).toBeNull();
    expect(parameterPill({ type: 'set-parameter', nodeId: 'a', key: 'steps', value: 30 }, nodes)).toEqual({ nodeId: 'a', text: 'steps: 20 → 30' });
    expect(parameterPill({ type: 'set-parameter', nodeId: 'b', key: 'seed', value: 'a very long value that goes on' }, nodes).text).toBe('seed: — → a very long value…');
  });

  it('draws groups around members, else from the stored bounding, else not at all', () => {
    expect(groupRect({ id: 'g', title: 'G', nodeIds: ['a'] }, nodes)).toEqual({ x: -24, y: -56, width: 248, height: 180 });
    expect(groupRect({ id: 'g', title: 'G', nodeIds: [], bounding: [1, 2, 30, 40] }, nodes)).toEqual({ x: 1, y: 2, width: 30, height: 40 });
    expect(groupRect({ id: 'g', title: 'G', nodeIds: [] }, nodes)).toBeNull();
    expect(boundsOf([])).toBeNull();
  });
});

describe('replay stepping', () => {
  it('clamps, steps and stops at the end', () => {
    expect(clampIndex(5, 3)).toBe(2);
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(1, 0)).toBe(0);
    expect(stepReplay({ index: 1, count: 3 }, 1)).toEqual({ index: 2, count: 3 });
    expect(stepReplay({ index: 2, count: 3 }, 1)).toEqual({ index: 2, count: 3 });
    expect(nextPlayIndex({ index: 0, count: 3 })).toBe(1);
    expect(nextPlayIndex({ index: 2, count: 3 })).toBeNull();
    expect(nextPlayIndex({ index: 0, count: 0 })).toBeNull();
    expect(playStartIndex({ index: 2, count: 3 })).toBe(0);
    expect(playStartIndex({ index: 1, count: 3 })).toBe(1);
  });
});

describe('build reveal order', () => {
  it('diffs added ids and changed node data', () => {
    const before = { nodes: [{ id: 'a', data: { p: 1 } }], edges: [] };
    const after = { nodes: [{ id: 'a', data: { p: 2 } }, { id: 'b', data: {} }], edges: [{ id: 'e', source: 'a', target: 'b' }] };
    expect(diffGraph(before, after)).toEqual({ addedNodes: ['b'], addedEdges: ['e'] });
    expect(changedNodes(before.nodes, after.nodes)).toEqual(['a']);
  });

  it('shows each node and then the new edges that reach it', () => {
    const steps = revealSteps({ addedNodes: ['b', 'c'], addedEdges: ['e1', 'e2', 'e3'] }, [
      { id: 'e1', source: 'b', target: 'c' },
      { id: 'e2', source: 'a', target: 'b' },
      { id: 'e3', source: 'a', target: 'old' },
    ]);
    expect(steps).toEqual([
      { kind: 'edge', id: 'e3' },
      { kind: 'node', id: 'b' },
      { kind: 'edge', id: 'e2' },
      { kind: 'node', id: 'c' },
      { kind: 'edge', id: 'e1' },
    ]);
  });
});

describe('flow pulses', () => {
  const { edges } = txt2img();
  it('pulses the focused object, selected edges and the tour step inputs', () => {
    expect([...flowingEdges(edges, { focus: { kind: 'edge', id: 'e5' }, selectedEdges: [], stepNodeId: null })]).toEqual(['e5']);
    expect([...flowingEdges(edges, { focus: { kind: 'node', id: 'decode' }, selectedEdges: [], stepNodeId: null })].sort()).toEqual(['e5', 'e6', 'e7']);
    expect([...flowingEdges(edges, { focus: { kind: 'port', id: 'ckpt:out-1', nodeId: 'ckpt', direction: 'output', portName: 'CLIP' }, selectedEdges: [], stepNodeId: null })]).toEqual(['e2']);
    expect([...flowingEdges(edges, { focus: null, selectedEdges: ['e1', 'missing'], stepNodeId: 'save' })].sort()).toEqual(['e1', 'e7']);
  });
});

describe('subgraph view', () => {
  const definition: SubgraphDefinition = {
    id: 'def',
    name: 'Block',
    inputs: [{ id: 's1', name: 'model', type: 'MODEL' }],
    outputs: [{ id: 's2', name: 'latent', type: 'LATENT' }],
    nodes: [{ id: '5', type: 'comfy', position: { x: 100, y: 100 }, data: { comfyType: 'KSampler', inputs: [], outputs: [], parameters: {} } }],
    edges: [
      { id: 'b1', source: '-10', sourceHandle: 'out-0', target: '5', targetHandle: 'in-0', data: { dataType: 'MODEL' } },
      { id: 'b2', source: '5', sourceHandle: 'out-0', target: '-20', targetHandle: 'in-0', data: { dataType: 'LATENT' } },
    ],
    nestedIn: null,
    raw: { inputNode: { id: -10, bounding: [-200, 100, 120, 60] } },
  };

  it('adds boundary nodes whose handles match the inner edges', () => {
    const view = definitionView(definition);
    const input = view.nodes.find((node) => node.id === '-10');
    const output = view.nodes.find((node) => node.id === '-20');
    expect(input).toMatchObject({ type: 'boundary', position: { x: -200, y: 100 }, data: { direction: 'input', ports: [{ id: 'out-0', name: 'model', dataType: 'MODEL' }] } });
    expect(output).toMatchObject({ type: 'boundary', data: { direction: 'output', ports: [{ id: 'in-0', name: 'latent', dataType: 'LATENT' }] } });
    expect(output!.position.x).toBeGreaterThan(100);
    expect(view.edges.map((edge) => edge.id)).toEqual(['b1', 'b2']);
  });

  it('labels the breadcrumb and prunes paths to removed definitions', () => {
    expect(breadcrumb(['def', 'gone'], [definition])).toEqual([{ id: 'def', name: 'Block', depth: 1 }]);
    expect(pruneSubgraphPath(['def', 'gone', 'def'], [definition])).toEqual(['def']);
  });

  it('enters and leaves definitions in graphState', () => {
    useGraphStore.setState({ subgraphs: [definition], subgraphPath: [], activeSubgraphId: null });
    useGraphStore.getState().enterSubgraph('def');
    expect(useGraphStore.getState()).toMatchObject({ subgraphPath: ['def'], activeSubgraphId: 'def' });
    useGraphStore.getState().enterSubgraph('missing');
    expect(useGraphStore.getState().subgraphPath).toEqual(['def']);
    useGraphStore.getState().exitSubgraph(0);
    expect(useGraphStore.getState()).toMatchObject({ subgraphPath: [], activeSubgraphId: null });
  });
});

describe('selection refs', () => {
  it('lists selected nodes, edges and the focused port', () => {
    const refs = selectionRefs(
      [{ id: 'a', selected: true, data: { comfyType: 'KSampler' } }, { id: 'b' }],
      [{ id: 'e', selected: true }],
      { kind: 'port', id: 'a:in-0', nodeId: 'a', portName: 'model', direction: 'input' },
    );
    expect(refs).toEqual([
      { kind: 'node', id: 'a', classType: 'KSampler' },
      { kind: 'edge', id: 'e' },
      { kind: 'port', id: 'a:in-0', nodeId: 'a', portName: 'model', direction: 'input' },
    ]);
    expect(sameRefs(refs, [...refs])).toBe(true);
    expect(sameRefs(refs, refs.slice(1))).toBe(false);
  });
});

describe('colours and motion tokens', () => {
  it('maps types and categories to token colours with fallbacks', () => {
    expect(typeColor('model')).toBe('var(--type-model, #b79cff)');
    expect(typeColor(undefined)).toBe('var(--type-unknown, #8b939c)');
    expect(categoryAccent('loaders', 'IMAGE')).toBe(typeColor('MODEL'));
    expect(categoryAccent('sampling', undefined)).toBe(typeColor('LATENT'));
    expect(categoryAccent(undefined, 'IMAGE')).toBe(typeColor('IMAGE'));
  });

  it('colours pack types by the family they carry', () => {
    expect(typeColor('WANVIDEOMODEL')).toBe(typeColor('MODEL'));
    expect(typeColor('WANVAE')).toBe(typeColor('VAE'));
    expect(typeColor('WANTEXTENCODER')).toBe(typeColor('CLIP'));
    expect(typeColor('WANVIDEOTEXTEMBEDS')).toBe(typeColor('CONDITIONING'));
    expect(typeColor('WANVIDIMAGE_EMBEDS')).toBe(typeColor('CONDITIONING'));
    expect(typeColor('WANVIDIMAGE_CLIPEMBEDS')).toBe(typeColor('CLIP_VISION'));
    expect(typeColor('AUDIO')).toBe('var(--type-audio, #7fc8a9)');
    expect(typeColor('CONTROL_NET')).toBe('var(--type-controlnet, #3fd6bf)');
    expect(typeColor('SOMETHING_ELSE')).toBe(typeColor(undefined));
    expect(categoryAccent('WanVideoWrapper', 'WANVIDEOMODEL')).toBe(typeColor('MODEL'));
  });

  it('parses duration tokens', () => {
    expect(parseDuration('320ms', 0)).toBe(320);
    expect(parseDuration(' 0.6s ', 0)).toBe(600);
    expect(parseDuration('', 42)).toBe(42);
  });
});

describe('micro-illustrations', () => {
  it('maps classes to illustrations', () => {
    expect(illustrationKind('KSampler')).toBe('sampler');
    expect(illustrationKind('KSamplerAdvanced')).toBe('sampler');
    expect(illustrationKind('VAEDecode')).toBe('vae-decode');
    expect(illustrationKind('VAEEncode')).toBe('vae-encode');
    expect(illustrationKind('CLIPTextEncode')).toBe('text-encode');
    expect(illustrationKind('LoraLoader')).toBe('lora');
    expect(illustrationKind('CheckpointLoaderSimple')).toBe('weights');
    expect(illustrationKind('UNETLoader')).toBe('weights');
    expect(illustrationKind('ControlNetApplyAdvanced')).toBe('controlnet');
    expect(illustrationKind('LoadImage')).toBe('image');
    expect(illustrationKind('SaveImage')).toBe('image');
    expect(illustrationKind('EmptyLatentImage')).toBe('empty-latent');
    expect(illustrationKind('SomethingElse')).toBe('generic');
    // Pack nodes get pictures by the words of their names, so a video graph is not all fallbacks.
    expect(illustrationKind('WanVideoDecode')).toBe('vae-decode');
    expect(illustrationKind('WanVideoTextEncodeCached')).toBe('text-encode');
    expect(illustrationKind('WanVideoModelLoader')).toBe('weights');
    expect(illustrationKind('WanVideoImageToVideoEncode')).toBe('vae-encode');
    expect(illustrationKind('VHS_VideoCombine')).toBe('video');
    expect(illustrationKind('LoadAudio')).toBe('audio');
    expect(illustrationKind('MultiTalkWav2VecEmbeds')).toBe('audio');
    expect(illustrationKind('SetNode')).toBe('set-get');
    expect(illustrationKind('GetNode')).toBe('set-get');
    expect(illustrationKind('ImageResizeKJv2')).toBe('image');
    expect(illustrationKind(undefined)).toBe('generic');
  });

  it('renders a static first frame for every kind, the same every time', () => {
    for (const kind of ILLUSTRATION_KINDS) {
      const markup = renderToStaticMarkup(createElement(Illustration, { kind }));
      expect(markup, kind).toContain('<svg');
      expect(markup, kind).toContain(`data-illustration="${kind}"`);
      expect(markup, kind).toContain('data-frame="static"');
      expect(markup, kind).not.toContain('<animate');
      expect(renderToStaticMarkup(createElement(Illustration, { kind }))).toBe(markup);
      expect(renderToStaticMarkup(createElement(Illustration, { kind, animate: true }))).toContain('data-frame="animated"');
    }
    expect(noisePoints(4, 10, 10, 3)).toEqual(noisePoints(4, 10, 10, 3));
  });
});
