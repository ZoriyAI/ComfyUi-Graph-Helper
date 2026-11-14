import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../src/shared/i18n';
import { newToolCall } from '../../src/renderer/services/llm/chatModel';
import type { ToolCall } from '../../src/renderer/types/chat';
import {
  buildCounts,
  buildProgress,
  buildSummary,
  callStepKey,
  groupToolCalls,
  quietSentence,
  stepError,
  stepSentence,
  stepWhy,
  type StepNames,
} from '../../src/renderer/components/chat/buildSteps';

const ru = createTranslator('ru');
const en = createTranslator('en');

const NODES: Record<string, { title: string; inputs: Record<string, string>; outputs: Record<string, string> }> = {
  '1': { title: 'Load Checkpoint', inputs: {}, outputs: { 'out-0': 'MODEL', 'out-1': 'CLIP' } },
  '5': { title: 'KSampler', inputs: { 'in-0': 'model', 'in-1': 'positive' }, outputs: { 'out-0': 'LATENT' } },
};

const names: StepNames = {
  node: (id) => NODES[id]?.title,
  nodeClass: (classType) => (classType === 'CheckpointLoaderSimple' ? 'Load Checkpoint' : undefined),
  port: (nodeId, handle, direction) => (direction === 'output' ? NODES[nodeId]?.outputs[handle] : NODES[nodeId]?.inputs[handle]),
  subgraph: (id) => (id === 'sg-1' ? 'Upscale' : undefined),
};

function call(name: string, args: Record<string, unknown>, result?: Record<string, unknown>, status: ToolCall['status'] = 'success', error?: string): ToolCall {
  return { ...newToolCall(`${name}-${Math.random()}`, name, args), status, ...(result ? { result } : {}), ...(error ? { error } : {}) };
}

describe('build step sentences', () => {
  const add = call('addNode', { nodeType: 'CheckpointLoaderSimple', why: 'Everything starts here.' }, { success: true, message: 'Added CheckpointLoaderSimple node', nodeId: '1' });
  const link = call('connectNodes', { sourceNodeId: '1', sourceHandle: 'out-0', targetNodeId: '5', targetHandle: 'in-0' }, {
    success: true, message: 'Connected the nodes', edgeId: 'e1', sourceNodeId: '1', targetNodeId: '5', sourcePort: 'MODEL', targetPort: 'model',
  });
  const param = call('setParameter', { nodeId: '5', key: 'steps', value: 20 }, { success: true, message: 'Set the parameter', nodeId: '5' });

  it('says each step in Russian from the arguments and result, never from the English message', () => {
    expect(stepSentence(add, ru, names)).toBe('Добавлена нода Load Checkpoint');
    expect(stepSentence(link, ru, names)).toBe('Связь: Load Checkpoint · MODEL → KSampler · model');
    expect(stepSentence(param, ru, names)).toBe('Поле steps = 20 у KSampler');
    expect(stepSentence(call('setParameter', { nodeId: '5', key: 'sampler_name', value: 'euler' }), ru, names)).toBe('Поле sampler_name = «euler» у KSampler');
    expect(stepSentence(call('removeNode', { nodeId: '9' }, { success: true, removedTitle: 'Old Upscale' }), ru, names)).toBe('Нода удалена: Old Upscale');
    expect(stepSentence(call('createSubgraph', { name: 'Prompts', nodeIds: ['2', '3', '4'] }, { success: true, definitionId: 'sg-2' }), ru, names))
      .toBe('Субграф «Prompts» собран из 3 нод');
    expect(stepSentence(call('createSubgraph', { name: 'One', nodeIds: ['2'] }, { success: true }), ru, names)).toBe('Субграф «One» собран из 1 ноды');
    expect(stepSentence(call('insertSubgraph', { definitionId: 'sg-1' }, { success: true, nodeId: '12' }), ru, names)).toBe('Вставлен субграф Upscale');
    expect(stepSentence(call('setProcess', { title: 'Text to image', notes: '' }), ru, names)).toBe('Граф назван «Text to image»');
    for (const item of [add, link, param]) expect(stepSentence(item, ru, names)).not.toMatch(/Added|Connected|Set the/);
  });

  it('says each step in English too', () => {
    expect(stepSentence(add, en, names)).toBe('Added the node Load Checkpoint');
    expect(stepSentence(link, en, names)).toBe('Link: Load Checkpoint · MODEL → KSampler · model');
    expect(stepSentence(param, en, names)).toBe('Field steps = 20 on KSampler');
    expect(stepSentence(call('setParameter', { nodeId: '5', key: 'text', value: 'a cat' }), en, names)).toBe('Field text = “a cat” on KSampler');
  });

  it('falls back to the canvas handle names, the title argument, and the catalog name', () => {
    const viaHandles = call('connectNodes', { sourceNodeId: '1', sourceHandle: 'out-1', targetNodeId: '5', targetHandle: 'in-1' }, { success: true, edgeId: 'e2' });
    expect(stepSentence(viaHandles, ru, names)).toBe('Связь: Load Checkpoint · CLIP → KSampler · positive');
    // A raw handle on a node the chat cannot see is left out rather than shown as "out-3".
    const unknown = call('connectNodes', { sourceNodeId: '7', sourceHandle: 'out-3', targetNodeId: '8', targetHandle: 'in-0' }, { success: true });
    expect(stepSentence(unknown, ru, names)).toBe('Связь: нода → нода');
    expect(stepSentence(call('addNode', { nodeType: 'X', title: 'My loader' }, { success: true, nodeId: '42' }), ru, names)).toBe('Добавлена нода My loader');
    expect(stepSentence(call('addNode', { nodeType: 'CheckpointLoaderSimple' }, { success: true, nodeId: '43' }), ru, names)).toBe('Добавлена нода Load Checkpoint');
  });

  it('never shows a secret-looking value', () => {
    const secret = call('setParameter', { nodeId: '5', key: 'api_key', value: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789' }, { success: true });
    expect(stepSentence(secret, ru, names)).not.toContain('abcdefghijklmnop');
  });

  it('says what a failed step tried, and why it failed in plain words', () => {
    const missing = call('addNode', { nodeType: 'KSamplr' }, { success: false, error: 'Unknown node class `KSamplr`. Did you mean: KSampler?', suggestions: ['KSampler', 'KSamplerAdvanced'] }, 'error', 'Unknown node class `KSamplr`. Did you mean: KSampler?');
    expect(stepSentence(missing, ru, names)).toBe('Не удалось добавить ноду KSamplr');
    expect(stepError(missing, ru)).toEqual({ summary: 'Такой ноды нет в вашем ComfyUI. Похожие: KSampler или KSamplerAdvanced.', detail: null });
    const conflict = call('connectNodes', { sourceNodeId: '1', targetNodeId: '5' }, { success: false, conflict: true, error: 'conflict' }, 'error', 'conflict');
    expect(stepError(conflict, en)?.summary).toBe('The graph changed first, so this step was not applied.');
    const known = call('connectNodes', {}, { success: false, error: 'Port types cannot be connected.' }, 'error', 'Port types cannot be connected.');
    expect(stepError(known, ru)?.detail).toBeNull();
    const odd = call('setParameter', { nodeId: '5', key: 'k', value: 1 }, { success: false }, 'error', 'Bearer abc.def.ghi went wrong');
    const plain = stepError(odd, ru);
    expect(plain?.summary).toBe('Шаг не применился; помощник может попробовать иначе.');
    expect(plain?.detail).not.toContain('abc.def.ghi');
    expect(stepError(add, ru)).toBeNull();
  });

  it('reads the why from the result first, then the arguments', () => {
    expect(stepWhy(add)).toBe('Everything starts here.');
    expect(stepWhy(call('addNode', { why: 'asked' }, { success: true, why: 'saved' }))).toBe('saved');
    expect(stepWhy(param)).toBe('');
  });
});

describe('grouping the calls of one message', () => {
  it('puts every graph change into one build card and every read into one quiet group, in first-seen order', () => {
    const calls = [
      call('getGraph', {}),
      call('addNode', { nodeType: 'A' }, { nodeId: '1' }),
      call('searchNodeTypes', { query: 'lora' }),
      call('connectNodes', {}, { edgeId: 'e' }),
      call('proposeNode', { nodeType: 'B' }),
      call('explain', {}),
      call('annotateNode', { nodeId: '1', annotation: 'x' }),
    ];
    const segments = groupToolCalls(calls);
    expect(segments.map((segment) => segment.type)).toEqual(['quiet', 'build', 'card', 'card']);
    const build = segments[1];
    expect(build.type === 'build' && build.calls.map((item) => item.toolName)).toEqual(['addNode', 'connectNodes', 'annotateNode']);
    const quiet = segments[0];
    expect(quiet.type === 'quiet' && quiet.calls.map((item) => item.toolName)).toEqual(['getGraph', 'searchNodeTypes']);
  });

  it('says what the helper looked at as short phrases, with only the host of a page', () => {
    expect(quietSentence(call('getGraph', {}), ru)).toBe('прочитал граф');
    expect(quietSentence(call('searchNodeTypes', { query: 'lora' }), ru)).toBe('искал в каталоге нод «lora»');
    expect(quietSentence(call('fetchPage', { url: 'https://docs.comfy.org/built-in-nodes?token=abc' }), ru)).toBe('читал docs.comfy.org');
    expect(quietSentence(call('searchWeb', { query: 'flux lora' }), en)).toBe('searched the web for “flux lora”');
    expect(quietSentence(call('describeNodeType', { classType: 'CheckpointLoaderSimple' }), ru, names)).toBe('прочитал, что делает Load Checkpoint');
  });
});

describe('build progress and summary', () => {
  const steps = [
    call('addNode', {}, { nodeId: '1' }),
    call('addNode', {}, { nodeId: '2' }),
    call('connectNodes', {}, { edgeId: 'e1' }),
    call('setParameter', { nodeId: '2', key: 'steps', value: 20 }, {}),
  ];

  it('keys steps like the canvas reveal queue', () => {
    expect(steps.map(callStepKey)).toEqual(['1', '2', 'e1', 'param:2:steps']);
  });

  it('marks the step the canvas shows as running and the queued ones as waiting', () => {
    const progress = buildProgress(steps, { shownKey: '2', queuedKeys: new Set(['e1', 'param:2:steps']) }, true);
    expect(progress.running).toBe(1);
    expect([...progress.waiting]).toEqual([2, 3]);
    const pending = [...steps.slice(0, 3), { ...steps[3], status: 'pending' as const }];
    expect(buildProgress(pending, { shownKey: '1', queuedKeys: new Set() }, true).running).toBe(3);
    expect(buildProgress(steps, { shownKey: null, queuedKeys: new Set() }, false).running).toBe(-1);
  });

  it('closes the build with what it made', () => {
    const many = [
      ...Array.from({ length: 7 }, (_, index) => call('addNode', {}, { nodeId: String(index) })),
      ...Array.from({ length: 9 }, (_, index) => call('connectNodes', {}, { edgeId: `e${index}` })),
      call('addNode', {}, {}, 'error', 'nope'),
    ];
    expect(buildSummary(buildCounts(many), ru)).toBe('Готово: 7 нод и 9 связей.');
    expect(buildSummary(buildCounts(many), en)).toBe('Done: 7 nodes and 9 links.');
    expect(buildSummary(buildCounts(steps), ru)).toBe('Готово: 2 ноды, 1 связь и 1 поле задано.');
    expect(buildSummary(buildCounts(steps.slice(0, 1)), ru, true)).toBe('Остановлено: 1 нода. Сделанное осталось в графе.');
    // Notes and the graph's name are said too, and a change to the person's work left as a grey draft (P0).
    expect(buildSummary(buildCounts([call('annotateNode', { nodeId: '1' }, {})]), ru)).toBe('Готово: 1 заметка записана.');
    expect(buildSummary(buildCounts([call('setProcess', { title: 'x' }, {})]), ru)).toBe('Готово: граф назван.');
    const drafted = [call('addNode', {}, { nodeId: '5' }), call('removeNode', { nodeId: '1' }, { drafted: true, proposalId: 'p1', nodeTitle: 'KSampler' })];
    expect(buildSummary(buildCounts(drafted), ru)).toBe('Готово: 1 нода, 1 серый черновик ждёт вашего решения: он меняет сделанное вами.');
    expect(stepSentence(drafted[1], ru, { node: () => undefined })).toBe('Предложено вам: удалить ноду KSampler');
  });
});
