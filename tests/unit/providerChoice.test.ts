import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The top-bar choice of the assistant is the stored setting. */
describe('choosing the assistant in the top bar', () => {
  let saved: Array<Record<string, unknown>>;
  let row: Record<string, unknown>;
  let configs: unknown[];

  beforeEach(() => {
    saved = [];
    configs = [];
    row = { theme: 'graphite', motion: 'system', provider: 'local', model: 'm', baseURL: 'http://127.0.0.1:11434/v1', comfyOrigin: '', mcpUrl: '', mcpAuth: '', language: 'ru' };
    const target = new EventTarget();
    vi.stubGlobal('CustomEvent', class extends Event { detail: unknown; constructor(type: string, init?: { detail?: unknown }) { super(type); this.detail = init?.detail; } });
    vi.stubGlobal('window', Object.assign(target, {
      electronAPI: {
        llmSetConfig: async (config: unknown) => { configs.push(config); },
        getSettings: async () => ({ values: { ...row } }),
        saveSettings: async (input: Record<string, unknown>) => {
          saved.push(input);
          if (input.provider === 'local' && !input.baseURL) return { ok: false, error: 'local endpoint' };
          row = { ...input };
          return { ok: true, values: { ...input } };
        },
      },
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('saves the choice, "none" included, so Settings and a restart show the same', async () => {
    const { useProviderStore } = await import('../../src/renderer/state/providerState');
    await useProviderStore.getState().choose('test');
    expect(row.provider).toBe('test');
    expect(useProviderStore.getState()).toMatchObject({ provider: 'test', sessionOverride: false, stored: { provider: 'test' } });
    await useProviderStore.getState().choose('');
    expect(row).toMatchObject({ provider: '', model: '', baseURL: '' });
    expect(configs.at(-1)).toEqual({ provider: '', model: '', baseURL: '' });
  });

  it('an own server without an address is not kept; Settings opens to ask for it', async () => {
    const { useProviderStore } = await import('../../src/renderer/state/providerState');
    const { useUiStore } = await import('../../src/renderer/state/uiState');
    await useProviderStore.getState().choose('');
    await useProviderStore.getState().choose('local');
    expect(row.provider).toBe('');
    expect(useUiStore.getState().settingsRequest?.section).toBe('assistant');
  });
});
