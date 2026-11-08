import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSystemPrompt, catalogSummaryText, describeRef } from '../../../src/main/agent/prompt';
import { mainLLMService } from '../../../src/main/llmService';
import { summarizeGraph } from '../../../src/shared/agent/graph';
import { parseTurnContext } from '../../../src/shared/agent/turnContext';
import { fakeKnowledge, throwingKnowledge } from './fakes';

const KEY = 'sk-prompt-marker-9f8e7d';
const db = new Database(':memory:');

const SNAPSHOT = {
  nodes: [
    { id: 'node-1', data: { comfyType: 'CheckpointLoaderSimple', title: 'Loader', outputs: [{ name: 'MODEL', dataType: 'MODEL' }], parameters: { ckpt_name: 'secret-widget-value' }, comfy: { widgets_values: ['secret-widget-value'] } } },
    { id: 'node-2', data: { comfyType: 'KSampler', title: 'Sampler', inputs: [{ name: 'model', dataType: 'MODEL' }] } },
  ],
  edges: [{ id: 'link-1', source: 'node-1', sourceHandle: '0', target: 'node-2', targetHandle: '0', data: { dataType: 'MODEL' } }],
  components: [{ ownerKind: 'node', ownerId: 'node-2', purpose: 'Makes the image', usage: '' }],
  process: { title: 'Portrait', notes: '' },
};

describe('teaching system prompt', () => {
  afterEach(() => {
    mainLLMService.setConfig({ provider: '' });
    mainLLMService.setSessionKey('');
    vi.restoreAllMocks();
  });

  it('carries role, principles, intent, language, catalog, graph, focus, and tool guidance without secrets', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mainLLMService.setSessionKey(KEY);
    mainLLMService.setConfig({ provider: 'anthropic', model: 'fixture', baseURL: '' });
    const context = parseTurnContext({
      intent: 'ask',
      objectRef: { kind: 'port', id: 'p', nodeId: 'node-2', portName: 'model', direction: 'input' },
      selection: [{ kind: 'node', id: 'node-1', classType: 'CheckpointLoaderSimple' }],
      language: 'ru',
    }, 'en');
    const prompt = buildSystemPrompt({
      context,
      graph: summarizeGraph(SNAPSHOT),
      catalog: catalogSummaryText(db, fakeKnowledge(), 'which portrait lora fits'),
    });
    expect(prompt).toContain('teach');
    expect(prompt).toContain('ghosts');
    expect(prompt).toContain('Never claim a workflow ran');
    expect(prompt).toContain('fact');
    expect(prompt).toContain('inference');
    expect(prompt).toContain('Turn intent: ask');
    expect(prompt).toContain('Answer in Russian.');
    expect(prompt).toContain('The person asked about: input port "model" on node node-2.');
    expect(prompt).toContain('Selected on the canvas: node node-1 (CheckpointLoaderSimple).');
    expect(prompt).toContain('- node-1 CheckpointLoaderSimple "Loader"');
    expect(prompt).toContain('- node-1.MODEL -> node-2.model (MODEL)');
    expect(prompt).toContain('purpose: Makes the image');
    expect(prompt).toContain('Catalog: 3 node classes installed (2 with known inputs and outputs).');
    expect(prompt).toContain('- lora: 3 (sdxl 1, flux1 1, illustrious 1)');
    expect(prompt).toContain('loras/portrait_detail_sdxl.safetensors [sdxl]');
    expect(prompt).not.toContain('anime_lines');
    expect(prompt).toContain('proposeNode');
    expect(prompt).not.toContain(KEY);
    expect(prompt).not.toContain('secret-widget-value');
  });

  it('degrades to "not synced yet" when the knowledge stub throws', () => {
    expect(catalogSummaryText(db, throwingKnowledge(), 'anything')).toContain('not synced yet');
  });

  it('marks build intent and defaults a malformed context to chat in the settings language', () => {
    const build = buildSystemPrompt({ context: parseTurnContext({ intent: 'build', selection: [] }, 'en'), graph: null, catalog: '' });
    expect(build).toContain('Turn intent: build');
    expect(build).toContain('Answer in English.');
    expect(build).toContain('The project is not ready.');
    expect(parseTurnContext({ intent: 'destroy' }, 'ru')).toEqual({ intent: 'chat', selection: [], language: 'ru' });
    expect(parseTurnContext(undefined, 'en')).toEqual({ intent: 'chat', selection: [], language: 'en' });
  });

  it('redacts secret-shaped graph text and describes every reference kind', () => {
    const prompt = buildSystemPrompt({
      context: parseTurnContext({ intent: 'chat', objectRef: { kind: 'model', id: 'loras/a.safetensors', directory: 'loras', name: 'a.safetensors' } }, 'en'),
      graph: summarizeGraph({ nodes: [{ id: 'n', data: { comfyType: 'X', title: 'Bearer abc.def' } }], edges: [] }),
      catalog: '',
    });
    expect(prompt).not.toContain('abc.def');
    expect(prompt).toContain('[redacted]');
    expect(prompt).toContain('The person asked about: model loras/a.safetensors.');
    expect(describeRef({ kind: 'nodeClass', id: 'KSampler' })).toBe('node class KSampler');
    expect(describeRef({ kind: 'process', id: 'process' })).toBe('the whole process');
  });
});
