/**
 * Pure helpers that turn what main found (models, local servers, addresses) into picker rows and small decisions for
 * Settings > Assistant (AssistantSection) and Settings > Connection (ConnectionSection). They are kept free of React
 * so tests/unit/settingsPickers, localServerAddress and providersWorld can check them directly.
 */
import type { AddressSuggestion, LocalServer, ModelChoice } from '../../../../shared/contracts/pickers';
import type { Translator } from '../../../../shared/i18n';
import type { Suggestion } from '../../../ui/SuggestField';
import { withLoopbackScheme } from '../../../../shared/mcp/loopback';

/** Two base URLs name the same server: trailing slashes, case and localhost vs 127.0.0.1 do not matter. */
export function sameBase(a: string, b: string): boolean {
  const norm = (value: string) => value.trim().replace(/\/+$/, '').toLowerCase().replace('://localhost', '://127.0.0.1');
  return norm(a) !== '' && norm(a) === norm(b);
}

/** The found server a base URL points at, if any. */
export function serverFor(servers: LocalServer[], baseURL: string): LocalServer | undefined {
  return servers.find((server) => sameBase(server.value, baseURL));
}

/**
 * The live list from the server, with what the MCP server knows about the same models (capabilities, size).
 * The live list decides which models exist; the MCP catalog only adds facts.
 */
export function withKnownFacts(models: ModelChoice[], known: ModelChoice[] | undefined): ModelChoice[] {
  if (!known || known.length === 0) return models;
  const facts = new Map(known.map((model) => [model.id, model]));
  return models.map((model) => {
    const fact = facts.get(model.id);
    if (!fact) return model;
    return {
      ...model,
      detail: model.detail ?? fact.detail,
      tools: model.tools ?? fact.tools,
      vision: model.vision ?? fact.vision,
      thinking: model.thinking ?? fact.thinking,
    };
  });
}

/** Picker rows for models: id first, display name and size below, capability badges on the right. */
export function modelSuggestions(models: ModelChoice[], t: Translator): Suggestion[] {
  return models.map((model) => {
    const detail = [
      model.label,
      model.detail,
      // The model's own window, as its server or provider says it (Ollama, Anthropic, Google).
      model.contextLength ? t('picker.capWindow', { tokens: model.contextLength }) : '',
      model.tools === false ? t('picker.capNoTools') : '',
    ].filter(Boolean).join(' · ');
    const badges: NonNullable<Suggestion['badges']> = [];
    if (model.tools === true) badges.push({ text: t('picker.capTools'), tone: 'ok' });
    if (model.tools === false) badges.push({ text: t('picker.capNoTools'), tone: 'warn' });
    if (model.vision) badges.push({ text: t('picker.capVision'), tone: 'accent' });
    if (model.thinking) badges.push({ text: t('picker.capThinking'), tone: 'ai' });
    return { value: model.id, ...(detail ? { detail } : {}), ...(badges.length > 0 ? { badges } : {}) };
  });
}

/** Picker rows for local servers: the name, then address, GPU, default model, model count and where it was found. */
export function serverSuggestions(servers: LocalServer[], t: Translator): Suggestion[] {
  return servers.map((server) => {
    const detail = [
      server.value,
      server.gpu ? t('picker.gpu', { name: server.gpu }) : '',
      server.defaultModel ? t('picker.defaultModel', { model: server.defaultModel }) : '',
      server.models.length > 0 ? t('picker.modelCount', { count: server.models.length }) : '',
      t(server.origin === 'mcp' ? 'picker.fromMcp' : 'picker.onThisComputer'),
    ].filter(Boolean).join(' · ');
    return { value: server.value, label: server.name, detail };
  });
}

/** Picker rows for an address field: the address, and where it was found as the detail. */
export function addressSuggestions(items: AddressSuggestion[], t: Translator): Suggestion[] {
  return items.map((item) => ({ value: item.value, detail: t(`picker.source.${item.source}`) }));
}

/** Whether a model list can be asked for: a cloud provider (main checks key and https), or a local http(s) address. */
export function listable(provider: string, baseURL: string): boolean {
  if (provider === 'openai' || provider === 'anthropic' || provider === 'google') return true;
  // A compatible service is asked only at the https address the person typed (main checks the key for it).
  if (provider === 'compatible') return /^https:\/\/[^\s/]+/i.test(baseURL.trim());
  if (provider !== 'local') return false;
  try {
    // `127.0.0.1:11434/v1` is asked as http://… (main completes it the same way and says so).
    const url = new URL(withLoopbackScheme(baseURL));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** The catalog key that names where the context window number comes from. */
export function contextSourceKey(source: 'override' | 'known' | 'default' | 'server'): string {
  if (source === 'override') return 'preferences.contextSourceOverride';
  if (source === 'server') return 'preferences.contextSourceServer';
  return source === 'known' ? 'preferences.contextSourceKnown' : 'preferences.contextSourceDefault';
}

/**
 * The model to fill in on its own: the server lists exactly one and none is chosen yet. Null otherwise (the person
 * picks among several, or already chose).
 */
export function onlyModelToPick(models: ModelChoice[], current: string): string | null {
  return current.trim() === '' && models.length === 1 ? models[0].id : null;
}

/**
 * Whether "No local server answered" still says something true: not once the address the person typed (or one
 * that discovery found) has answered with its model list. `typedAnswered`: the model list for the typed address
 * came back (ModelListResult ok).
 */
export function discoveryEmptyNoteShown(serversFound: number, typedAnswered: boolean): boolean {
  return serversFound === 0 && !typedAnswered;
}
