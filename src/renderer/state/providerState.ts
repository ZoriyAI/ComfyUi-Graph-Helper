/**
 * The assistant's provider as the window shows it: which provider is chosen, where its key lives, and the choice
 * itself (top bar, Assistant menu, Settings ▸ Assistant).
 *
 * Who uses it: components/shell (Toolbar, MenuBar), components/chat/ChatDock.tsx, components/settings (the panel,
 * AssistantSection, KeyPanel, PrivacySection), components/graph/Onboarding.tsx, services/ask.ts and appCommands.ts.
 * The key itself never reaches the window; only where it lives.
 */
import { create } from 'zustand';
import type { ChatRuntimeConfig, NonSecretSettings } from '../../shared/config/schema';
import { isPreferenceProvider } from '../../shared/config/preferences';
import { answerPlace } from '../../shared/config/ollamaCloud';
import { currentPreferences } from './preferencesState';
import { useUiStore } from './uiState';
import { SETTINGS_CHANGED } from '../commands/events';

/** Saves the chosen provider into the settings row, keeping every other field. Null when it could not be kept. */
async function persistChoice(runtime: ChatRuntimeConfig): Promise<NonSecretSettings | null> {
  try {
    const read = await window.electronAPI.getSettings();
    if (!('values' in read) || !read.values) return null;
    const result = await window.electronAPI.saveSettings({ ...read.values, ...runtime });
    return result.ok ? result.values : null;
  } catch {
    return null;
  }
}

/** Where the provider's key lives right now: nowhere, in memory for this session, in OS storage, or in a file. */
export type KeySource = 'none' | 'session' | 'os' | 'file';

/**
 * How the provider's key stands, shown as the colour of the chip's dot. `setup`: your own server chosen without an
 * address yet (the card must not say "ready").
 */
export type ProviderKeyState = 'none' | 'test' | 'ok' | 'session' | 'missing' | 'setup';

/** Providers that need a key from the person. */
export const CLOUD_PROVIDERS = new Set(['openai', 'anthropic', 'google', 'compatible']);

/** Values of the provider select (`#chat-provider`) and of the Assistant ▸ Provider menu, in order. */
export const PROVIDER_CHOICES: Array<{ value: string; labelKey: string }> = [
  { value: '', labelKey: 'provider.notConfigured' },
  { value: 'test', labelKey: 'provider.testFixture' },
  { value: 'openai', labelKey: 'provider.openaiSession' },
  { value: 'anthropic', labelKey: 'provider.anthropicSession' },
  { value: 'google', labelKey: 'provider.googleSession' },
  { value: 'compatible', labelKey: 'provider.compatibleSession' },
  { value: 'local', labelKey: 'provider.localChip' },
];

/**
 * The scripted TEST fixture is a developer tool. A packaged app's preload says `testProvider: false` and it is not
 * offered; unpackaged runs (development, tests) and unit tests without a preload keep it.
 */
export function testProviderOffered(): boolean {
  const flags = typeof window !== 'undefined' ? window.electronAPI?.flags : undefined;
  return flags ? flags.testProvider === true : true;
}

/** The provider choices this build offers a person: PROVIDER_CHOICES without the TEST fixture in a packaged app. */
export function providerChoices(): Array<{ value: string; labelKey: string }> {
  return testProviderOffered() ? PROVIDER_CHOICES : PROVIDER_CHOICES.filter((choice) => choice.value !== 'test');
}

/**
 * The provider chip text: which provider, and where its key lives. Never the key. With your own server and an
 * Ollama cloud model (`model`), it says that the question leaves the computer, not that no key is sent.
 */
export function providerNoteKey(provider: string, keySource: KeySource, model = ''): string {
  if (provider === 'test') return 'provider.test';
  if (provider === 'local') return answerPlace(provider, model) === 'ollama-cloud' ? 'provider.localCloud' : 'provider.local';
  if (keySource === 'file' && CLOUD_PROVIDERS.has(provider)) return 'provider.cloudFile';
  if (provider === 'openai') return keySource === 'os' ? 'provider.openaiStored' : keySource === 'session' ? 'provider.openaiHeld' : 'provider.openai';
  if (provider === 'anthropic') return keySource === 'os' ? 'provider.cloudStored' : keySource === 'session' ? 'provider.anthropicHeld' : 'provider.anthropic';
  if (provider === 'google') return keySource === 'os' ? 'provider.cloudStored' : keySource === 'session' ? 'provider.googleHeld' : 'provider.google';
  if (provider === 'compatible') return keySource === 'os' ? 'provider.cloudStored' : keySource === 'session' ? 'provider.compatibleHeld' : 'provider.compatible';
  return 'provider.none';
}

/** The colour of the provider chip's dot: where the key stands, never the key. */
export function providerKeyState(provider: string, keySource: KeySource): ProviderKeyState {
  if (provider === 'test') return 'test';
  if (provider === 'local') return 'ok';
  if (CLOUD_PROVIDERS.has(provider)) return keySource === 'os' || keySource === 'file' ? 'ok' : keySource === 'session' ? 'session' : 'missing';
  return 'none';
}

/** Brand names of the cloud providers, for the sentences that say where a question goes. */
const PROVIDER_BRANDS: Record<string, string> = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google Gemini' };

/**
 * Settings ▸ Privacy ▸ What is sent to the model: the sentence that says where a question goes now, with its
 * values. Your own server with an Ollama cloud model says it leaves the computer; there is no way to call it local.
 */
export function sentWhere(provider: string, model: string): { key: string; values: Record<string, string> } {
  const place = answerPlace(provider, model);
  if (place === 'none') return { key: 'preferences.sentWhere.none', values: {} };
  if (place === 'test') return { key: 'preferences.sentWhere.test', values: {} };
  if (place === 'local') return { key: 'preferences.sentWhere.local', values: {} };
  if (place === 'ollama-cloud') return { key: 'preferences.sentWhere.ollamaCloud', values: { model: model.trim() } };
  if (provider === 'compatible' || !PROVIDER_BRANDS[provider]) return { key: 'preferences.sentWhere.compatible', values: {} };
  return { key: 'preferences.sentWhere.cloud', values: { provider: PROVIDER_BRANDS[provider] } };
}

/**
 * The description on a provider card in Settings ▸ Assistant. The card of your own server says that the question
 * leaves the computer while its model (`model`, the one typed or saved for it) is an Ollama cloud model.
 */
export function providerCardDescriptionKey(provider: string, model: string): string {
  if (answerPlace(provider, model) === 'ollama-cloud') return 'preferences.providerDesc.localCloud';
  return `preferences.providerDesc.${provider === '' ? 'none' : provider}`;
}

/**
 * Whether the question, the graph and the rest of "what goes out with a question" (providers.sentList) leave this
 * computer: a cloud provider, or an Ollama cloud model on your own server. Settings ▸ Assistant shows the list then.
 */
export function sendsOutside(provider: string, model: string): boolean {
  const place = answerPlace(provider, model);
  return place === 'cloud' || place === 'ollama-cloud';
}

/** Each cloud provider's key place. A key belongs to one provider; no card borrows another's. */
export type KeySources = Record<'openai' | 'anthropic' | 'google' | 'compatible' | 'local', KeySource>;
/** No key anywhere: the state before main has answered. */
export const NO_KEYS: KeySources = { openai: 'none', anthropic: 'none', google: 'none', compatible: 'none', local: 'none' };

/** The key place of one provider ('none' for test and no provider; your own server only when it asked for one). */
export function keySourceOf(sources: KeySources, provider: string): KeySource {
  return CLOUD_PROVIDERS.has(provider) || provider === 'local' ? sources[provider as keyof KeySources] ?? 'none' : 'none';
}

/** Asks main where each provider's key lives and shows it (never a key). */
export async function refreshKeySources(): Promise<KeySources> {
  const status = await window.electronAPI.llmSessionStatus();
  const sources = { ...NO_KEYS, ...(status.providers ?? {}) };
  useProviderStore.getState().setKeySources(sources);
  return sources;
}

interface ProviderState {
  provider: string;
  /** The chosen provider's key place (derived from `keySources`), for the chip and the first screen. */
  keySource: KeySource;
  keySources: KeySources;
  /** The runtime the stored settings describe; a session choice of the same provider keeps its model. */
  stored: ChatRuntimeConfig;
  /** True after the person picked a provider for this session; a settings re-read then leaves it alone. */
  sessionOverride: boolean;
  /** Main reported where each provider's key lives. */
  setKeySources: (sources: KeySources) => void;
  /** Settings were read (or saved): show and apply the stored runtime, unless a session choice is active. */
  showStored: (values: NonSecretSettings, force?: boolean) => Promise<void>;
  /** The person picked a provider for this session (toolbar select or Assistant menu). */
  choose: (next: string) => Promise<void>;
}

/** The chosen provider, the stored runtime and where each key lives. */
export const useProviderStore = create<ProviderState>((set, get) => ({
  provider: '',
  keySource: 'none',
  keySources: NO_KEYS,
  stored: { provider: '', model: '', baseURL: '' },
  sessionOverride: false,
  setKeySources: (keySources) => set({ keySources, keySource: keySourceOf(keySources, get().provider) }),
  showStored: async (values, force = false) => {
    if (get().sessionOverride && !force) return;
    const stored = { provider: values.provider, model: values.model, baseURL: values.baseURL };
    set({ stored, provider: values.provider, sessionOverride: false, keySource: keySourceOf(get().keySources, values.provider) });
    await window.electronAPI.llmSetConfig(stored);
  },
  choose: async (next) => {
    // The top bar and Settings ▸ Assistant are one setting: a choice here is saved, so Settings shows it and a
    // restart keeps it.
    const stored = get().stored;
    const sameProvider = stored.provider === next;
    const remembered = isPreferenceProvider(next) ? currentPreferences().providers[next] : { model: '', baseURL: '' };
    const runtime: ChatRuntimeConfig = next === 'test'
      ? { provider: 'test', model: 'test-fixture', baseURL: '' }
      : CLOUD_PROVIDERS.has(next) || next === 'local'
        ? { provider: next as ChatRuntimeConfig['provider'], model: sameProvider ? stored.model : remembered.model, baseURL: sameProvider ? stored.baseURL : remembered.baseURL }
        : { provider: '', model: '', baseURL: '' };
    set({ sessionOverride: true, provider: next, keySource: keySourceOf(get().keySources, next) });
    await window.electronAPI.llmSetConfig(runtime);
    const saved = await persistChoice(runtime);
    if (saved) {
      set({ stored: runtime, sessionOverride: false });
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<NonSecretSettings>(SETTINGS_CHANGED, { detail: saved }));
    } else if (next === 'local') {
      // An own server needs its address and model before it can be kept: Settings asks for them.
      useUiStore.getState().openSettings('assistant');
    }
  },
}));
