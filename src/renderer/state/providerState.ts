import { create } from 'zustand';
import type { ChatRuntimeConfig, NonSecretSettings } from '../../shared/config/schema';

/** Where the provider's key lives right now: nowhere, in memory for this session, or in OS storage. */
export type KeySource = 'none' | 'session' | 'os';

/** How the provider's key stands, shown as the colour of the chip's dot. */
export type ProviderKeyState = 'none' | 'test' | 'ok' | 'session' | 'missing';

export const CLOUD_PROVIDERS = new Set(['openai', 'anthropic', 'google']);

/** Values of the provider select (`#chat-provider`) and of the Assistant ▸ Provider menu, in order. */
export const PROVIDER_CHOICES: Array<{ value: string; labelKey: string }> = [
  { value: '', labelKey: 'provider.notConfigured' },
  { value: 'test', labelKey: 'provider.testFixture' },
  { value: 'openai', labelKey: 'provider.openaiSession' },
  { value: 'anthropic', labelKey: 'provider.anthropicSession' },
  { value: 'google', labelKey: 'provider.googleSession' },
  { value: 'local', labelKey: 'provider.localChip' },
];

/** The provider chip text: which provider, and where its key lives. Never the key. */
export function providerNoteKey(provider: string, keySource: KeySource): string {
  if (provider === 'test') return 'provider.test';
  if (provider === 'local') return 'provider.local';
  if (provider === 'openai') return keySource === 'os' ? 'provider.openaiStored' : keySource === 'session' ? 'provider.openaiHeld' : 'provider.openai';
  if (provider === 'anthropic') return keySource === 'os' ? 'provider.cloudStored' : keySource === 'session' ? 'provider.anthropicHeld' : 'provider.anthropic';
  if (provider === 'google') return keySource === 'os' ? 'provider.cloudStored' : keySource === 'session' ? 'provider.googleHeld' : 'provider.google';
  return 'provider.none';
}

/** The colour of the provider chip's dot: where the key stands, never the key. */
export function providerKeyState(provider: string, keySource: KeySource): ProviderKeyState {
  if (provider === 'test') return 'test';
  if (provider === 'local') return 'ok';
  if (CLOUD_PROVIDERS.has(provider)) return keySource === 'os' ? 'ok' : keySource === 'session' ? 'session' : 'missing';
  return 'none';
}

interface ProviderState {
  provider: string;
  keySource: KeySource;
  /** The runtime the stored settings describe; a session choice of the same provider keeps its model. */
  stored: ChatRuntimeConfig;
  /** True after the person picked a provider for this session; a settings re-read then leaves it alone. */
  sessionOverride: boolean;
  setKeySource: (source: KeySource) => void;
  /** Settings were read (or saved): show and apply the stored runtime, unless a session choice is active. */
  showStored: (values: NonSecretSettings, force?: boolean) => Promise<void>;
  /** The person picked a provider for this session (toolbar select or Assistant menu). */
  choose: (next: string) => Promise<void>;
}

export const useProviderStore = create<ProviderState>((set, get) => ({
  provider: '',
  keySource: 'none',
  stored: { provider: '', model: '', baseURL: '' },
  sessionOverride: false,
  setKeySource: (keySource) => set({ keySource }),
  showStored: async (values, force = false) => {
    if (get().sessionOverride && !force) return;
    const stored = { provider: values.provider, model: values.model, baseURL: values.baseURL };
    set({ stored, provider: values.provider, sessionOverride: false });
    await window.electronAPI.llmSetConfig(stored);
  },
  choose: async (next) => {
    set({ sessionOverride: true, provider: next });
    const stored = get().stored;
    if (next === 'test') {
      await window.electronAPI.llmSetConfig({ provider: 'test', model: 'test-fixture', baseURL: '' });
      return;
    }
    if (CLOUD_PROVIDERS.has(next) || next === 'local') {
      const sameProvider = stored.provider === next;
      await window.electronAPI.llmSetConfig({
        provider: next,
        model: sameProvider ? stored.model : '',
        baseURL: sameProvider ? stored.baseURL : '',
      });
      return;
    }
    await window.electronAPI.llmSetConfig({ provider: '', model: '', baseURL: '' });
  },
}));
