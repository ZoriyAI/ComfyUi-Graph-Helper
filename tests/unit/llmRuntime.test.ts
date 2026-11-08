import { afterEach, describe, expect, it, vi } from 'vitest';
import { mainLLMService } from '../../src/main/llmService';

describe('chat runtime config', () => {
  afterEach(() => {
    mainLLMService.setConfig({ provider: '' });
  });

  it('keeps the non-secret provider, model, and base URL for the next send and drops a key', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    mainLLMService.setConfig({
      provider: 'openai',
      model: 'fixture-model',
      baseURL: 'https://example.test/v1',
      apiKey: 'fake-marker-not-a-key',
    });
    expect(mainLLMService.nextSendConfig()).toEqual({
      provider: 'openai',
      model: 'fixture-model',
      baseURL: 'https://example.test/v1',
    });
    expect(JSON.stringify(mainLLMService.nextSendConfig())).not.toContain('fake-marker-not-a-key');

    mainLLMService.setConfig({
      provider: 'test',
      model: 'test-fixture',
      baseURL: 'https://fixture.example/v1',
    });
    expect(mainLLMService.nextSendConfig()).toEqual({
      provider: 'test',
      model: 'test-fixture',
      baseURL: 'https://fixture.example/v1',
    });

    mainLLMService.setConfig({ provider: '', model: 'left-behind', baseURL: 'https://example.test/v1' });
    expect(mainLLMService.nextSendConfig()).toEqual({ provider: '', model: '', baseURL: '' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
