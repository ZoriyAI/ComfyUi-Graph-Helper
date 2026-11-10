import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MainLLMService } from '../../../src/main/llmService';
import { nonSecretSettingsSchema, nonSecretDefaults } from '../../../src/shared/config/schema';

const KEY = 'provider-matrix-marker';

const CLOUD = [
  { provider: 'openai', modelProvider: 'openai.responses', searchId: 'openai.web_search', searchModel: 'fixture-model' },
  { provider: 'anthropic', modelProvider: 'anthropic.messages', searchId: 'anthropic.web_search_20250305', searchModel: 'fixture-model' },
  // Google's search tool is offered only on Gemini 3; earlier models would lose every function tool.
  { provider: 'google', modelProvider: 'google.generative-ai', searchId: 'google.google_search', searchModel: 'gemini-3-pro-preview' },
] as const;

describe('chat providers', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let service: MainLLMService;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    service = new MainLLMService();
  });

  afterEach(() => {
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  for (const entry of CLOUD) {
    describe(entry.provider, () => {
      it('blocks a send without a key, with an http base, or without a model id', () => {
        service.setConfig({ provider: entry.provider, model: 'fixture-model' });
        expect(service.sendBlock()).toBe('Cloud model has no key for this session.');

        service.setSessionKey(entry.provider, KEY);
        service.setConfig({ provider: entry.provider, model: 'fixture-model', baseURL: 'http://127.0.0.1:9/v1' });
        expect(service.sendBlock()).toBe('Cloud key is not sent to an http address.');
        expect(service.getModel()).toBeNull();

        service.setConfig({ provider: entry.provider, model: '  ', baseURL: '' });
        expect(service.sendBlock()).toBe('Cloud model has no model id.');
      });

      it('builds a model for the official endpoint and a custom https endpoint without a request', () => {
        service.setSessionKey(entry.provider, KEY);
        service.setConfig({ provider: entry.provider, model: 'fixture-model', baseURL: '' });
        expect(service.sendBlock()).toBeNull();
        expect(service.currentProvider()).toBe(entry.provider);
        const model = service.getModel() as { provider: string; modelId: string };
        expect(model.provider).toBe(entry.modelProvider);
        expect(model.modelId).toBe('fixture-model');

        service.setConfig({ provider: entry.provider, model: 'fixture-model', baseURL: 'https://gateway.example.test/v1' });
        expect(service.sendBlock()).toBeNull();
        expect(service.getModel()).not.toBeNull();
        expect(JSON.stringify(service.nextSendConfig())).not.toContain(KEY);
      });

      it('offers the provider web search only on the official endpoint', () => {
        service.setConfig({ provider: entry.provider, model: entry.searchModel, baseURL: '' });
        const tool = service.nativeSearchTool() as { type: string; id: string };
        expect(tool.type).toBe('provider');
        expect(tool.id).toBe(entry.searchId);
        expect(JSON.stringify(tool.id)).not.toContain(KEY);

        service.setConfig({ provider: entry.provider, model: entry.searchModel, baseURL: 'https://gateway.example.test/v1' });
        expect(service.nativeSearchTool()).toBeNull();
      });

      it('rejects a send before any fetch when blocked', async () => {
        service.setConfig({ provider: entry.provider, model: 'fixture-model' });
        await expect(service.streamChatWithTools([{ role: 'user', content: 'hi' }], {}).next())
          .rejects.toThrow('Cloud model has no key for this session.');
      });
    });
  }

  it('offers no Google search tool before Gemini 3', () => {
    for (const model of ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', '']) {
      service.setConfig({ provider: 'google', model, baseURL: '' });
      expect(service.nativeSearchTool(), model).toBeNull();
    }
    service.setConfig({ provider: 'google', model: 'gemini-3-flash', baseURL: '' });
    expect(service.nativeSearchTool()).not.toBeNull();
  });

  it('treats local as an OpenAI-compatible chat completions endpoint such as Ollama', () => {
    service.setConfig({ provider: 'local', model: 'llama3.2', baseURL: '' });
    expect(service.sendBlock()).toBe('Local model has no endpoint.');
    service.setConfig({ provider: 'local', model: '', baseURL: 'http://localhost:11434/v1' });
    expect(service.sendBlock()).toBe('Local model has no model id.');
    service.setConfig({ provider: 'local', model: 'llama3.2', baseURL: 'http://localhost:11434/v1' });
    expect(service.sendBlock()).toBeNull();
    const model = service.getModel() as { provider: string };
    expect(model.provider).toBe('local.chat');
    expect(service.nativeSearchTool()).toBeNull();
  });

  it('has no web search tool for test or an empty provider, and drops unknown providers', () => {
    service.setConfig({ provider: 'test', model: 'test-fixture' });
    expect(service.sendBlock()).toBeNull();
    expect(service.nativeSearchTool()).toBeNull();
    service.setConfig({ provider: 'mistral', model: 'x' });
    expect(service.currentProvider()).toBe('');
    expect(service.sendBlock()).toBe('Model not configured');
    expect(service.nextSendConfig()).toEqual({ provider: '', model: '', baseURL: '' });
  });

  it('accepts the new providers in the settings schema', () => {
    for (const provider of ['', 'test', 'openai', 'anthropic', 'google', 'local']) {
      const input = { ...nonSecretDefaults, provider, baseURL: provider === 'local' ? 'http://localhost:11434/v1' : '', model: provider === 'local' ? 'llama3.2' : '' };
      expect(nonSecretSettingsSchema.safeParse(input).success, provider).toBe(true);
    }
    expect(nonSecretSettingsSchema.safeParse({ ...nonSecretDefaults, provider: 'mistral' }).success).toBe(false);
  });
});
