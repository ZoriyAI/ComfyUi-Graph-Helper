/**
 * The main-process LLM service: holds the chat runtime (provider, model, address) and one key per provider, builds
 * the AI SDK model for a send, and streams a turn with tools to the caller. Keys live in this process only: pasted
 * for the session, or held again at start from the OS password store or the owner-only key file (main/ipc.ts).
 * The renderer never sees a key; every text that leaves through here is redacted against the held values.
 * Used by agent/turn.ts for every chat turn, by main/ipc.ts for Settings ▸ Assistant, and by many modules for redact.
 */
import { generateText, streamText, LanguageModel, isStepCount } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { ChatRuntimeConfig } from '../shared/config/schema';
import { createTestLLMModel } from './testLLMTransport';
import { mcpToken } from './mcp/token';
import { containsExact, exactMatchRedactor, redactSecrets } from '../shared/agent/redact';
import { failureStreakReached, forwardPart, type Redact } from './agent/streamParts';
import { STEP_LIMIT } from '../shared/config/preferences';
import type { ModelListResult } from '../shared/contracts/pickers';
import { listCloudModels, listLocalModels, MODEL_LIST_NEEDS_KEY, MODEL_LIST_REFUSED } from './llm/modelList';
import { originOf, startTurnTrace, turnLog, type TurnMeta } from './trace/modelTrace';
import { privateToolResults } from './llm/toolPrivacy';
import { contextFit, createWindowVariant, estimateRequestTokens, loadAndReadContext, type ContextFit, type WindowVariantResult } from './llm/localContext';
import { ADVICE_DATE, costOf } from '../shared/config/modelAdvice';
import { CLOUD_PROVIDER_IDS, hasOfficialBase, isKeyProvider, KEY_OTHER_ADDRESS, KEY_PROVIDERS, keyOriginFor, OFFICIAL_BASE, officialOrigin, type CloudProviderId, type KeyProvider } from '../shared/config/keyOrigin';

/** Every provider a send can use: the cloud ones, the scripted TEST fixture and the person's own server. */
export type ChatProvider = CloudProviderId | 'test' | 'local';
/** A provider that answers from the internet and needs a key: the three companies and an OpenAI-compatible service. */
export type CloudProvider = CloudProviderId;

const PROVIDERS: readonly ChatProvider[] = [...CLOUD_PROVIDER_IDS, 'test', 'local'];
export const CLOUD: readonly CloudProvider[] = CLOUD_PROVIDER_IDS;
/** Every provider a key may be held for: the cloud ones and the person's own server (for a server that asks). */
export const KEYED: readonly KeyProvider[] = KEY_PROVIDERS;

/**
 * The scripted TEST transport is a developer tool: main sets this false in the packaged app (index.ts), so a
 * provider saved as `test` never makes a release build answer with canned text.
 */
let testProviderAllowed = true;
/** Turns the TEST provider on or off for this run (main/index.ts, from runMode.ts). */
export function allowTestProvider(allowed: boolean): void {
  testProviderAllowed = allowed;
}

/** The provider named, or null for anything unknown (and for TEST when it is not allowed). */
function knownProvider(value: unknown): ChatProvider | null {
  if (typeof value !== 'string' || !(PROVIDERS as readonly string[]).includes(value)) return null;
  if (value === 'test' && !testProviderAllowed) return null;
  return value as ChatProvider;
}

/** Whether a value names a cloud provider. */
export function isCloudProvider(value: unknown): value is CloudProvider {
  return typeof value === 'string' && (CLOUD as readonly string[]).includes(value);
}


/** The runtime of the next send: never a key. */
interface LLMConfig {
  provider: ChatProvider;
  model: string;
  baseURL?: string;
}

/** The API key sent to a local server that asks for none: the OpenAI client refuses an empty one. */
const LOCAL_PLACEHOLDER = 'local';
/** A compatible cloud service has no official address: without the person's https address nothing is sent. */
export const COMPATIBLE_NO_ADDRESS = 'A compatible service needs its https address.';
/** Stream parts that show the model answered: words, reasoning, a tool call, or an error of its own. */
const ANSWER_PARTS = new Set(['text-delta', 'reasoning-delta', 'tool-call', 'tool-input-start', 'error', 'source']);
const NOT_A_MODEL = 'The server answered, but not as a model: no words, no tool calls.';

/** isCloudProvider for a value already known to be a provider. */
function isCloud(provider: ChatProvider): provider is CloudProvider {
  return (CLOUD as readonly string[]).includes(provider);
}

/** An http(s) address without user info: the only kind a local server may have. */
function httpEndpoint(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

/** Empty means the official https endpoint. A cloud key is never attached to http or userinfo. */
function httpsCloudEndpoint(value: string | undefined): boolean {
  const base = value?.trim() ?? '';
  if (base === '') return true;
  try {
    const url = new URL(base);
    return url.protocol === 'https:' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

/** Where a held key came from: pasted this session, the OS password store, or the owner-only key file. */
export type KeySource = 'none' | 'session' | 'os' | 'file';
type HeldSource = Exclude<KeySource, 'none'>;

/** How one turn is streamed; agent/turn.ts fills it from the preferences and the turn. */
export interface StreamOptions {
  /** Upper bound on model steps. Each tool round trip is one step. Clamped to the preferences range. */
  maxSteps?: number;
  /** Aborts the provider request and the tool loop (llm:cancel, window gone). */
  abortSignal?: AbortSignal;
  /** Preferences ▸ Assistant: when false, the web search tool is not offered to the model. */
  allowWebSearch?: boolean;
  /** Preferences ▸ Assistant: when false, the page reader tool is not offered to the model. */
  allowFetchPage?: boolean;
  /** The turn already offers the reduced tool set for a small context window; said in the notice and the log. */
  compact?: boolean;
  /**
   * Called with each address a provider-run web search cited (a `source` part). agent/turn.ts passes none: cited
   * addresses are not added to what the page reader may open (see links.ts).
   */
  onSource?: (url: string) => void;
  /** What the turn is for, written at the top of its record in the model conversation log. */
  trace?: Pick<TurnMeta, 'intent' | 'language' | 'runId' | 'projectId' | 'app'> & {
    /** Earlier messages left out to fit the model's window, and the window the budget used. */
    omittedMessages?: number;
    contextTokens?: number;
    contextSource?: string;
  };
}

/** The loop stops after this many failed or conflicted tool results in a row. */
export const FAILURE_STREAK_LIMIT = 3;

/** One message of the dialog as the turn passes it in. */
type StreamMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** One turn's watch on a local server: the size of its first request and the window the model was loaded with. */
interface LocalWatch {
  requestChars: number;
  window: Promise<number | null> | null;
  stop: AbortController;
  key: string | null;
  /** The window once the first step settled it: a number, or null when the server does not say. */
  known?: number | null;
  /** The notice this turn already gave. */
  said?: 'tight' | 'cut';
}

/** Gemini rejects a content with no parts: an assistant turn that only called tools has no text to send. */
export function dropEmptyAssistant(messages: StreamMessage[]): StreamMessage[] {
  return messages.filter((message) => message.role !== 'assistant' || message.content.trim() !== '');
}


// The step limit's range, the same as the preference allows.
export const MAX_STEPS_FLOOR = STEP_LIMIT.min;
export const MAX_STEPS_CEILING = STEP_LIMIT.max;

/** The step limit of a turn: the preference within its range, the default when it is not a number. */
export function clampSteps(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return STEP_LIMIT.default;
  return Math.max(MAX_STEPS_FLOOR, Math.min(MAX_STEPS_CEILING, Math.round(value)));
}

/** Why a turn stopped before the model finished: the step checkpoint or the failure-streak guard. */
export type PauseReason = 'step-limit' | 'failure-streak';
/** The content of a 'turn-paused' chunk: why, after how many steps, and that Continue is offered. */
export interface TurnPaused { reason: PauseReason; steps: number; canContinue: true; failures?: number }

/**
 * The 'turn-paused' chunk content when the loop stopped on a guard rather than on the model's own answer, or null.
 * The step checkpoint applies when the last step still asked for tools; the failure guard when the last
 * `FAILURE_STREAK_LIMIT` tool results all failed.
 */
export function pauseOf(steps: ReadonlyArray<{ finishReason?: unknown; content?: ReadonlyArray<unknown> }>, maxSteps: number): TurnPaused | null {
  if (steps.length === 0) return null;
  const last = steps[steps.length - 1];
  if (last.finishReason !== 'tool-calls') return null;
  if (failureStreakReached(FAILURE_STREAK_LIMIT)({ steps })) return { reason: 'failure-streak', steps: steps.length, canContinue: true, failures: FAILURE_STREAK_LIMIT };
  if (steps.length >= maxSteps) return { reason: 'step-limit', steps: steps.length, canContinue: true };
  return null;
}

/** Tools offered for one send: the web tools leave the set when the person switched them off. */
export function toolsForSend<T>(tools: Record<string, T>, options: StreamOptions): Record<string, T> {
  const next = { ...tools };
  if (options.allowWebSearch === false) delete next.searchWeb;
  if (options.allowFetchPage === false) delete next.fetchPage;
  return next;
}

/** A draft runtime the Settings ▸ Assistant "Check connection" button probes. */
export interface ProbeDraft {
  provider?: unknown;
  model?: unknown;
  baseURL?: unknown;
}

/** What "Check connection" shows: the time the answer took, or a redacted error. */
export type ProbeResult =
  | { ok: true; latencyMs: number; provider: string; model: string; /** The window the server loaded the model with, when it says. */ contextTokens?: number }
  | { ok: false; error: string; latencyMs: number | null };

/**
 * Watches a local server for the context window it loads `model` with while a request runs (Ollama's /api/ps).
 * Resolves to the window in tokens, or null when the server does not say. The app wires the real one at start;
 * without it (unit tests) the service asks nothing beyond the chat request itself.
 */
export type LocalContextWatcher = (base: string, model: string, signal: AbortSignal) => Promise<number | null>;
let localContextWatcher: LocalContextWatcher | null = null;

/**
 * How requests to cloud providers travel: the app wires a proxy-aware fetch at start (main/net/proxy.ts); unit tests
 * keep Node's fetch. Your own server is always asked directly.
 */
let transport: typeof fetch = (...args) => globalThis.fetch(...args);
/** Sets the fetch for cloud requests (llm/network.ts, at start and after each settings save). */
export function configureTransport(fetchImpl: typeof fetch): void {
  transport = fetchImpl;
}
/**
 * The web search's way out (main/agent/tools.ts): undefined means the search connects itself to the address it
 * vetted (the default, and always without a proxy); behind a proxy it gets the proxy-aware fetch, since a direct
 * connection would not get through.
 */
let searchTransport: (url: string) => Promise<typeof fetch | undefined> = async () => undefined;
/** Sets how the web search picks its fetch (llm/network.ts). */
export function configureSearchTransport(pick: (url: string) => Promise<typeof fetch | undefined>): void {
  searchTransport = pick;
}
/** The fetch the web search should use for `url`, or undefined to connect itself. Never throws. */
export function webSearchTransport(url: string): Promise<typeof fetch | undefined> {
  return searchTransport(url).catch(() => undefined);
}
/** The fetch for cloud requests right now. */
export function cloudTransport(): typeof fetch {
  return transport;
}
/** Sets the local window watcher (main/index.ts, at start). */
export function configureLocalContext(watcher: LocalContextWatcher | null): void {
  localContextWatcher = watcher;
}

/** What the chat is told when the request does not fit the model's window on the person's server. */
export interface ContextNotice extends ContextFit {
  code: 'context-window';
  model: string;
  /** The turn already ran with the reduced tool set. */
  compact: boolean;
}

/** One tiny generation. Injected in tests so nothing leaves the process there. */
export type ProbeGenerate = (input: { model: LanguageModel; abortSignal: AbortSignal }) => Promise<unknown>;

/** A check that takes longer than this counts as no answer; a cold local model may need a while to load. */
const PROBE_TIMEOUT_MS = 20_000;

const defaultProbeGenerate: ProbeGenerate = ({ model, abortSignal }) => generateText({
  model,
  prompt: 'ping',
  // The smallest output most providers accept (OpenAI's Responses API refuses fewer than 16).
  maxOutputTokens: 16,
  abortSignal,
  maxRetries: 0,
});

/** An error message safe to show: no key, no bearer value, no sk- token, at most 300 characters. */
export function redactProbeError(message: string, secrets: Array<string | null | undefined>): string {
  let text = message;
  for (const secret of secrets) {
    if (secret && secret.length >= 4) text = text.split(secret).join('[redacted]');
  }
  text = text
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/(api[_-]?key\s*[:=]\s*)\S+/gi, '$1[redacted]');
  return text.replace(/\s+/g, ' ').trim().slice(0, 300) || 'The provider did not answer.';
}

/** The service; the app uses the one instance, mainLLMService. */
class MainLLMService {
  private config: LLMConfig | null = null;
  /**
   * One key per cloud company, with where it came from. A request to one provider only ever reads that provider's
   * entry: a key pasted for Anthropic is never attached to an OpenAI or Google request after a switch.
   */
  private keys = new Map<KeyProvider, { value: string; source: HeldSource; origin: string }>();
  /** Context windows local servers were seen to load a model with, by "origin|model". */
  private loadedWindows = new Map<string, number>();
  /** 'tight' notices already shown, by "origin|model|window": said once per run, not on every turn. */
  private tightSaid = new Set<string>();

  /** "origin|model" for a local runtime, the key of the window maps; null for anything else. */
  private windowKey(config: LLMConfig | null): string | null {
    if (!config || config.provider !== 'local') return null;
    const origin = originOf(config.baseURL);
    return origin && config.model.trim() !== '' ? `${origin}|${config.model.trim()}` : null;
  }

  /**
   * The context window the configured local server was seen to load the configured model with, or null when it
   * is not known (a cloud model, a server that does not say, or no request yet).
   */
  localContextTokens(): number | null {
    const key = this.windowKey(this.config);
    return key ? this.loadedWindows.get(key) ?? null : null;
  }

  /**
   * The window before the first question on your own server: asks the server, loading the model on Ollama when it
   * is not loaded yet, and remembers the number. Null for a cloud model or a server that does not say.
   */
  async ensureLocalWindow(fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args)): Promise<number | null> {
    const known = this.localContextTokens();
    if (known !== null) return known;
    const config = this.config;
    const key = this.windowKey(config);
    if (!config || !key || !config.baseURL || !localContextWatcher) return null;
    const window = await loadAndReadContext(config.baseURL, config.model.trim(), fetchImpl);
    if (window !== null) this.loadedWindows.set(key, window);
    return window;
  }

  /**
   * Settings ▸ Assistant ▸ "Make a copy with a larger window": Ollama makes a copy of the draft model that loads with
   * `window` tokens. Only a local Ollama address; the person asks for it with the button.
   */
  async makeWindowVariant(draft: ProbeDraft, window: number, fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args)): Promise<WindowVariantResult> {
    const base = typeof draft.baseURL === 'string' ? draft.baseURL.trim() : '';
    const model = typeof draft.model === 'string' ? draft.model.trim() : '';
    if (knownProvider(draft.provider) !== 'local' || !httpEndpoint(base) || model === '') return { ok: false, error: 'Local model has no endpoint.' };
    // The copy's window stays in a sane range: 4k to 256k tokens.
    const size = Math.max(4096, Math.min(262_144, Math.round(window)));
    return createWindowVariant(base, model, size, fetchImpl);
  }

  /** The window each model's list entry gave (provider|model → tokens), so a turn uses what the list said. */
  private listedWindows = new Map<string, number>();
  /** The listed window of the configured model, or null when no list said one. */
  listedContextTokens(): number | null {
    const config = this.config;
    return config ? this.listedWindows.get(`${config.provider}|${config.model.trim()}`) ?? null : null;
  }
  /** Keeps the windows a model list named and passes the list on unchanged. */
  private rememberListed(provider: string, result: ModelListResult): ModelListResult {
    if (result.ok) for (const model of result.models) if (model.contextLength) this.listedWindows.set(`${provider}|${model.id}`, model.contextLength);
    return result;
  }

  /** OpenAI organization and project for a key that belongs to several (Settings ▸ Assistant); empty: none sent. */
  private openaiAccount: { organization: string; project: string } = { organization: '', project: '' };
  /** Sets the organization and project (llm/network.ts); anything that is not a plain id is dropped. */
  setOpenAiAccount(account: { organization?: string; project?: string }): void {
    const clean = (value: unknown) => (typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value.trim()) ? value.trim() : '');
    this.openaiAccount = { organization: clean(account.organization), project: clean(account.project) };
  }
  /** The OpenAI-Organization / OpenAI-Project headers to send, none when empty. */
  openAiAccountHeaders(): Record<string, string> {
    return {
      ...(this.openaiAccount.organization ? { 'OpenAI-Organization': this.openaiAccount.organization } : {}),
      ...(this.openaiAccount.project ? { 'OpenAI-Project': this.openaiAccount.project } : {}),
    };
  }

  /** Remembers a window read earlier (kept across restarts by the caller) for the configured server and model. */
  rememberLocalContext(tokens: number): void {
    const key = this.windowKey(this.config);
    if (key && Number.isFinite(tokens) && tokens >= 256) this.loadedWindows.set(key, Math.floor(tokens));
  }

  /**
   * Stores the non-secret provider, model, and base URL for the next send.
   * Does not construct a client and does not send a request. An API key on the input is ignored.
   */
  setConfig(config: { provider?: unknown; model?: unknown; baseURL?: unknown; apiKey?: unknown }): void {
    console.log('[MainLLMService] Config updated (credentials NOT logged)');
    const provider = knownProvider(config.provider);
    if (!provider) {
      this.config = null;
      return;
    }
    this.config = {
      provider,
      model: typeof config.model === 'string' ? config.model : '',
      baseURL: typeof config.baseURL === 'string' ? config.baseURL : undefined,
    };
  }

  /** Holds or (with an empty value or no address) forgets one provider's key, bound to its address. */
  private hold(provider: unknown, value: unknown, source: HeldSource, origin?: string | null): { held: boolean; source: KeySource } {
    if (!isKeyProvider(provider)) return { held: false, source: 'none' };
    const bound = origin === undefined ? officialOrigin(provider) : origin;
    if (typeof value !== 'string' || value.length === 0 || value.length > 4000 || !bound) {
      this.keys.delete(provider);
      return { held: false, source: 'none' };
    }
    this.keys.set(provider, { value, source, origin: bound });
    return { held: true, source };
  }

  /**
   * Holds a cloud key for one provider in memory for this process. The value is not returned, logged, or written.
   * An empty value forgets that provider's key; another provider's key is untouched. The key belongs to the address
   * it was pasted for (`forBase`: empty means the official address; an http or broken address takes no key): it is
   * sent there and nowhere else.
   */
  setSessionKey(provider: unknown, value: unknown, forBase?: unknown): { held: boolean; source: KeySource } {
    const origin = isKeyProvider(provider) ? keyOriginFor(provider, typeof forBase === 'string' ? forBase : '') : null;
    return this.hold(provider, value, 'session', origin);
  }

  /** Holds a key just decrypted from OS storage for its provider and the address it was remembered for. */
  holdOsKey(provider: KeyProvider, value: string, origin: string | null = officialOrigin(provider)): void {
    if (value.length === 0 || value.length > 4000 || !origin) return;
    this.hold(provider, value, 'os', origin);
  }

  /** Holds a key read from the app folder file the person chose on a computer without a password store. */
  holdFileKey(provider: KeyProvider, value: string, origin: string | null = officialOrigin(provider)): void {
    if (value.length === 0 || value.length > 4000 || !origin) return;
    this.hold(provider, value, 'file', origin);
  }

  /** The address (origin) the held key of a provider belongs to, or null. Not a secret. */
  keyOrigin(provider: unknown): string | null {
    return isKeyProvider(provider) ? this.keys.get(provider)?.origin ?? null : null;
  }

  /** Every provider's key address, for the cards ("this key is for …"). Never a key. */
  keyOrigins(): Record<KeyProvider, string | null> {
    return Object.fromEntries(KEYED.map((provider) => [provider, this.keyOrigin(provider)])) as Record<KeyProvider, string | null>;
  }

  /** The held key of a provider when it belongs to the address `base` sends to; null otherwise. */
  private keyFor(provider: KeyProvider, base: string | null | undefined): string | null {
    const entry = this.keys.get(provider);
    const origin = keyOriginFor(provider, base);
    return entry && origin && entry.origin === origin ? entry.value : null;
  }

  /** Forgets one provider's key, or every provider's key without an argument. */
  forgetKeys(provider?: KeyProvider): void {
    if (provider) this.keys.delete(provider);
    else this.keys.clear();
  }

  /** The key held for a provider, for remembering it; never returned to the renderer. */
  heldKey(provider: unknown): string | null {
    return isKeyProvider(provider) ? this.keys.get(provider)?.value ?? null : null;
  }

  /** Every held LLM key and the MCP token, for exact-match redaction only. Never returned to a caller. */
  private heldValues(): string[] {
    return [...[...this.keys.values()].map((entry) => entry.value), mcpToken()]
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
  }

  /** Heuristic redaction plus exact redaction of every held key and the MCP token. */
  redact: Redact = (text: string): string => exactMatchRedactor(this.heldValues())(redactSecrets(text));

  /** True when any exact held key or the MCP token appears in the text. */
  containsHeldSecret(text: string): boolean {
    return containsExact(this.heldValues(), text);
  }

  /** Where one provider's key lives right now (never the key). */
  keyStatus(provider: unknown): { held: boolean; source: KeySource } {
    const entry = isKeyProvider(provider) ? this.keys.get(provider) : undefined;
    return entry ? { held: true, source: entry.source } : { held: false, source: 'none' };
  }

  /** Every provider's key place, for the provider cards. */
  keySources(): Record<KeyProvider, KeySource> {
    return Object.fromEntries(KEYED.map((provider) => [provider, this.keyStatus(provider).source])) as Record<KeyProvider, KeySource>;
  }

  /** The key status of the provider of the next send ('none' for local, test and no provider). */
  sessionStatus(): { held: boolean; source: KeySource } {
    return this.keyStatus(this.config?.provider);
  }

  /** The provider of the next send, or '' when nothing is configured. */
  currentProvider(): ChatProvider | '' {
    return this.config?.provider ?? '';
  }

  /** Why the next send would not leave this process, or null when it may. Checked before any client exists. */
  sendBlock(): string | null {
    return this.blockFor(this.config);
  }

  /** The send rules for any runtime (the held one, or a draft being checked); null when a send may go. */
  private blockFor(config: LLMConfig | null): string | null {
    if (!config) return 'Model not configured';
    const { provider } = config;
    if (provider === 'compatible' && (config.baseURL?.trim() ?? '') === '') return COMPATIBLE_NO_ADDRESS;
    if (isCloud(provider)) {
      const key = this.heldKey(provider);
      if (key && !httpsCloudEndpoint(config.baseURL)) return 'Cloud key is not sent to an http address.';
      if (!key) return 'Cloud model has no key for this session.';
      // A key goes only to the address it was pasted for; any other address needs its own key.
      if (!this.keyFor(provider, config.baseURL)) return KEY_OTHER_ADDRESS;
      if (config.model.trim() === '') return 'Cloud model has no model id.';
    }
    if (provider === 'local' && !httpEndpoint(config.baseURL)) return 'Local model has no endpoint.';
    if (provider === 'local' && config.model.trim() === '') return 'Local model has no model id.';
    return null;
  }

  /**
   * Settings ▸ Assistant ▸ Check connection: one tiny request with the draft provider, model and base URL and
   * the key held for this session. The same send rules apply as for chat (no cloud key to http, no empty model).
   * Returns the latency or a redacted error. The held configuration does not change.
   */
  async probe(draft: ProbeDraft, generate: ProbeGenerate = defaultProbeGenerate, now: () => number = () => Date.now()): Promise<ProbeResult> {
    const provider = knownProvider(draft.provider);
    if (!provider) return { ok: false, error: 'Model not configured', latencyMs: null };
    const config: LLMConfig = {
      provider,
      model: typeof draft.model === 'string' ? draft.model.trim() : '',
      baseURL: typeof draft.baseURL === 'string' ? draft.baseURL.trim() : undefined,
    };
    const blocked = this.blockFor(config);
    if (blocked) return { ok: false, error: blocked, latencyMs: null };
    // The TEST fixture answers in process; there is nothing to reach.
    if (provider === 'test') return { ok: true, latencyMs: 0, provider, model: config.model || 'test-fixture' };
    const model = this.modelFor(config);
    if (!model) return { ok: false, error: 'Model not configured', latencyMs: null };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    timer.unref?.();
    const started = now();
    // A local server shows the window it loaded the model with only while the model is loaded: watch meanwhile.
    const watching = new AbortController();
    const watch = provider === 'local' && localContextWatcher && config.baseURL
      ? localContextWatcher(config.baseURL, config.model, watching.signal).catch(() => null)
      : null;
    try {
      await generate({ model, abortSignal: controller.signal });
      const latencyMs = Math.max(0, Math.round(now() - started));
      // The answer is in: give the watcher at most 0.7 s more to report the window.
      const contextTokens = watch ? await Promise.race([watch, new Promise<null>((resolve) => setTimeout(() => resolve(null), 700))]) : null;
      if (contextTokens !== null) {
        const key = this.windowKey(config);
        if (key) this.loadedWindows.set(key, contextTokens);
      }
      return { ok: true, latencyMs, provider, model: config.model, ...(contextTokens !== null ? { contextTokens } : {}) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (provider === 'local' && refusedForKey(error) && !this.keyFor('local', config.baseURL)) {
        return { ok: false, error: MODEL_LIST_NEEDS_KEY, latencyMs: Math.max(0, Math.round(now() - started)) };
      }
      return { ok: false, error: redactProbeError(message, this.heldValues()), latencyMs: Math.max(0, Math.round(now() - started)) };
    } finally {
      clearTimeout(timer);
      watching.abort();
    }
  }

  /**
   * Settings ▸ Assistant ▸ model list: which models the draft provider offers. Local servers are asked at the
   * draft base URL; cloud providers at the official (or configured https) base with the key held here, which is
   * never returned or logged. Without a key nothing is sent. Errors are fixed sentences with any key redacted.
   */
  async listModels(draft: ProbeDraft, fetchImpl?: typeof fetch): Promise<ModelListResult> {
    const provider = knownProvider(draft.provider);
    if (!provider) return { ok: false, error: 'Model not configured' };
    const baseURL = typeof draft.baseURL === 'string' ? draft.baseURL.trim() : '';
    if (provider === 'test') return { ok: true, models: [{ id: 'test-fixture' }], source: 'test' };
    try {
      if (provider === 'local') {
        if (!httpEndpoint(baseURL)) return { ok: false, error: 'Local model has no endpoint.' };
        return this.rememberListed('local', await listLocalModels(baseURL, fetchImpl ?? ((...args) => globalThis.fetch(...args)), undefined, this.keyFor('local', baseURL)));
      }
      if (provider === 'compatible' && baseURL === '') return { ok: false, error: COMPATIBLE_NO_ADDRESS };
      const config: LLMConfig = { provider, model: '', baseURL };
      const base = this.cloudBase(provider as CloudProvider, config);
      if (!base) return { ok: false, error: 'Cloud key is not sent to an http address.' };
      const cloud = provider as CloudProvider;
      const entry = this.keys.get(cloud);
      if (!entry) return { ok: false, error: 'Cloud model has no key for this session.' };
      // Nothing is sent to an address the key was not pasted for: not the key, not a request without it.
      if (!this.keyFor(cloud, baseURL)) return { ok: false, error: KEY_OTHER_ADDRESS };
      const result = await listCloudModels(cloud, base, entry.value, fetchImpl ?? transport, undefined, cloud === 'openai' ? this.openAiAccountHeaders() : {});
      if (result.ok) return this.rememberListed(cloud, result);
      // A key the provider refused must not be sent again: a key pasted for this session is dropped at once.
      // A remembered key stays until the person forgets it, so one 401 cannot erase what they chose to save.
      // A network failure says nothing about the key and keeps it.
      if (result.error === MODEL_LIST_REFUSED && entry.source === 'session' && this.keys.get(cloud) === entry) {
        this.keys.delete(cloud);
        console.log(`[MainLLMService] ${cloud} refused the pasted key; it is no longer held (value NOT logged)`);
        return { ok: false, error: MODEL_LIST_REFUSED, dropped: true };
      }
      return { ok: false, error: redactProbeError(result.error, this.heldValues()) };
    } catch {
      return { ok: false, error: 'The model list could not be read.' };
    }
  }

  /** The runtime the next send uses, with empty strings when none is set. Never a key. */
  nextSendConfig(): ChatRuntimeConfig {
    if (!this.config) return { provider: '', model: '', baseURL: '' };
    return {
      provider: this.config.provider,
      model: this.config.model,
      baseURL: this.config.baseURL ?? '',
    };
  }

  /** The address a cloud request goes to: the typed https one, else the official one; null when neither may be used. */
  private cloudBase(provider: CloudProvider, config: LLMConfig | null = this.config): string | null {
    if (!httpsCloudEndpoint(config?.baseURL)) return null;
    const typed = config?.baseURL?.trim() ?? '';
    if (typed !== '') return typed;
    return hasOfficialBase(provider) ? OFFICIAL_BASE[provider] : null;
  }

  /**
   * `fetchImpl` is the recording fetch of the turn being logged (the model conversation log): the provider
   * client sends through it, so the exact request and response bodies land in the turn's record. Headers,
   * where the key travels, are not recorded there.
   */
  getModel(fetchImpl?: typeof fetch): LanguageModel | null {
    if (!this.config) {
      console.warn('[MainLLMService] No config set');
      return null;
    }
    return this.modelFor(this.config, fetchImpl);
  }

  /** The AI SDK model for a runtime, with the key that belongs to its address; null when it cannot be built. */
  private modelFor(config: LLMConfig, fetchImpl?: typeof fetch): LanguageModel | null {
    const { provider, model } = config;

    if (provider === 'test') {
      if (!testProviderAllowed) return null;
      console.log('[MainLLMService] Using TEST fixture transport');
      return createTestLLMModel();
    }

    if (isCloud(provider)) {
      const baseURL = this.cloudBase(provider, config);
      if (!baseURL) return null;
      // Only the key held for this provider and this address; another provider's key is never a fallback.
      const apiKey = this.keyFor(provider, config.baseURL) ?? '';
      const wire = { fetch: fetchImpl ?? transport };
      // OpenAI's own service reads the Responses interface; every compatible service (a gateway, a regional
      // provider) reads chat completions, the interface they all share.
      if (provider === 'compatible') return createOpenAI({ apiKey, baseURL, name: 'compatible', ...wire }).chat(model);
      if (provider === 'openai') {
        const account = this.openaiAccount;
        return createOpenAI({ apiKey, baseURL, ...(account.organization ? { organization: account.organization } : {}), ...(account.project ? { project: account.project } : {}), ...wire })(model);
      }
      if (provider === 'anthropic') return createAnthropic({ apiKey, baseURL, ...wire })(model);
      return createGoogleGenerativeAI({ apiKey, baseURL, ...wire })(model);
    }

    if (provider === 'local') {
      const local = createOpenAI({
        // A server that asks for a key gets the one pasted for its address; any other gets a placeholder.
        apiKey: this.keyFor('local', config.baseURL) ?? LOCAL_PLACEHOLDER,
        baseURL: config.baseURL,
        name: 'local',
        ...(fetchImpl ? { fetch: fetchImpl } : {}),
      });
      // Local OpenAI-compatible servers (Ollama at http://localhost:11434/v1, LM Studio, vLLM)
      // expose chat completions, not the Responses API.
      return local.chat(model);
    }

    return null;
  }

  /**
   * The provider-executed web search tool, or null when the provider has none.
   * Only for the official endpoint: a custom https base is often a compatible gateway without these tools.
   * Building the tool sends nothing and needs no key.
   */
  nativeSearchTool(): unknown | null {
    if (!this.config || !isCloud(this.config.provider) || this.config.provider === 'compatible') return null;
    if ((this.config.baseURL?.trim() ?? '') !== '') return null;
    const { provider, model } = this.config;
    // The key is not attached here; a tool definition never carries it.
    if (provider === 'openai') return createOpenAI({ apiKey: '' }).tools.webSearch();
    if (provider === 'anthropic') return createAnthropic({ apiKey: '' }).tools.webSearch_20250305({ maxUses: 5 });
    // Before Gemini 3, @ai-sdk/google sends only the search tool when it is present and drops every
    // function tool. Those models use the main-process search fallback instead.
    if (!/^gemini-([3-9]|\d{2,})/.test(model.trim().toLowerCase())) return null;
    return createGoogleGenerativeAI({ apiKey: '' }).tools.googleSearch({});
  }

  /**
   * One turn: the system messages become the instructions, the rest the dialog, and the model may call the tools
   * for up to the step limit. Yields the forwarded stream parts plus the app's own chunks ('trace', 'notice',
   * 'usage', 'turn-paused'); throws when the send is blocked or the provider fails before streaming.
   */
  async* streamChatWithTools(
    messages: StreamMessage[],
    tools: Record<string, any>,
    options: StreamOptions = {},
  ): AsyncGenerator<{ type: string; content: any }> {
    const offered = privateToolResults(toolsForSend(tools, options), this.redact);
    const text = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n');
    const dialog = dropEmptyAssistant(messages.filter((message) => message.role !== 'system'));
    const maxSteps = clampSteps(options.maxSteps);

    // The model conversation log (Settings ▸ Privacy): one record per turn, started before anything can fail so
    // "it did not even send" is in the record too. Null when the person switched the log off.
    const config = this.config;
    const trace = startTurnTrace({
      provider: config?.provider ?? '',
      model: config?.model ?? '',
      baseUrl: this.traceOrigin(config),
      maxSteps,
      platform: `${process.platform} ${process.arch}`,
      ...options.trace,
    });
    trace?.prompt({
      system: text,
      messages: dialog,
      tools: Object.entries(offered).map(([name, definition]) => ({
        name,
        description: typeof definition?.description === 'string' ? definition.description : undefined,
      })),
    });
    // A model on the person's own server: how large the request is, and which window the server loaded the
    // model with. Both are read off the first request; the answer decides what the chat is told (ContextNotice).
    const local: LocalWatch | null = config?.provider === 'local' && localContextWatcher && config.baseURL
      ? { requestChars: 0, window: null, stop: new AbortController(), key: this.windowKey(config) }
      : null;
    const recording = trace?.fetch;
    const wire: typeof fetch | undefined = local && config?.baseURL
      ? (input, init) => {
        // The first request's size, and a watcher started with it (the model loads when the request arrives).
        if (local.requestChars === 0 && typeof init?.body === 'string') local.requestChars = init.body.length;
        if (!local.window && localContextWatcher) local.window = localContextWatcher(config.baseURL as string, config.model, local.stop.signal).catch(() => null);
        return (recording ?? globalThis.fetch)(input, init);
      }
      : recording;
    let outcome: 'ok' | 'paused' | 'cancelled' | 'error' = 'ok';
    try {
      // Inside the try so a consumer that never iterates past this point still gets the record closed.
      if (trace) yield { type: 'trace', content: { id: trace.id } };
      const blocked = this.sendBlock();
      if (blocked) throw new Error(blocked);
      const model = this.getModel(wire);
      if (!model) {
        throw new Error('Model not configured');
      }
      turnLog(`[MainLLMService] Starting stream with ${Object.keys(offered).length} tools`);
      for await (const chunk of this.streamSteps(model, text, dialog, offered, maxSteps, messages, options, trace, local)) {
        if (chunk.type === 'turn-paused') outcome = 'paused';
        yield chunk;
      }
    } catch (error) {
      outcome = 'error';
      if (!options.abortSignal?.aborted) trace?.fail(error);
      throw error;
    } finally {
      local?.stop.abort();
      // Also reached when the caller stops reading (Stop in the chat): the record still gets its end line.
      if (options.abortSignal?.aborted) outcome = 'cancelled';
      await trace?.finish(outcome);
    }
  }

  /**
   * After each step of a turn with a local model: the window the server loaded it with, whether the request
   * fits, and the notice for the chat when it does not. The first step waits (briefly) for the window and judges
   * the request by its size; later steps only look at what the server counted, because a build grows with every
   * step and can run out of window halfway. One notice of each kind per turn at most; null when there is
   * nothing to say.
   */
  private async contextNotice(local: LocalWatch, counted: number | null, compact: boolean, trace: ReturnType<typeof startTurnTrace>): Promise<ContextNotice | null> {
    const first = local.known === undefined;
    if (first) {
      // The watcher answers within its poll interval once the model is loaded; never hold the answer for long.
      local.known = local.window ? await Promise.race([local.window, new Promise<null>((resolve) => setTimeout(() => resolve(null), 800))]) : null;
      local.stop.abort();
      if (local.known !== null && local.key) this.loadedWindows.set(local.key, local.known);
    }
    const window = local.known ?? null;
    if (window === null) {
      // The server does not say its window. The record still gets the two numbers a reader can compare: how
      // large the request was and how many tokens the server counted.
      if (first) trace?.note('context', { window: null, requestChars: local.requestChars, needed: estimateRequestTokens(local.requestChars), counted, state: 'unknown', compact });
      return null;
    }
    if (local.said === 'cut') return null;
    // Later steps: only the server's own count says whether the growing conversation still fits.
    const fit = first ? contextFit(window, local.requestChars, counted) : contextFit(window, 0, counted);
    if (first || fit.state === 'cut') {
      trace?.note('context', { window: fit.window, requestChars: first ? local.requestChars : undefined, needed: fit.needed, counted, state: fit.state, compact });
      turnLog(`[MainLLMService] Local context window ${fit.window} tokens, request about ${fit.needed}: ${fit.state}`);
    }
    if (fit.state === 'ok') return null;
    if (fit.state === 'tight') {
      // Said once per run for a server, model and window; and only about the request itself, at the first step.
      const said = `${local.key ?? ''}|${window}`;
      if (!first || this.tightSaid.has(said)) return null;
      this.tightSaid.add(said);
    }
    local.said = fit.state;
    return { code: 'context-window', model: this.config?.model ?? '', compact, ...fit };
  }

  /** The server a turn talks to, as the log names it: origin only, never a path, a query or credentials. */
  private traceOrigin(config: LLMConfig | null): string {
    if (!config) return '';
    if (config.provider === 'test') return '';
    if (isCloud(config.provider)) return originOf(this.cloudBase(config.provider, config) ?? config.baseURL);
    return originOf(config.baseURL);
  }

  /** Runs the AI SDK stream and turns its parts into the chunks the renderer reads. */
  private async* streamSteps(
    model: LanguageModel,
    text: string,
    dialog: StreamMessage[],
    offered: Record<string, any>,
    maxSteps: number,
    messages: StreamMessage[],
    options: StreamOptions,
    trace: ReturnType<typeof startTurnTrace>,
    local: LocalWatch | null,
  ): AsyncGenerator<{ type: string; content: any }> {
    // The system prompt is the stable prefix of every step: cache it on Anthropic.
    const instructions = text && this.config?.provider === 'anthropic'
      ? { role: 'system' as const, content: text, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } }
      : text || undefined;

    const result = streamText({
      model,
      instructions,
      messages: dialog,
      tools: offered,
      // Default stopWhen is one step, which never feeds tool results back to the model.
      // A teaching turn reads the catalog, maybe the web, then proposes: allow a few rounds.
      // Both guards end the stream with a visible 'turn-paused' chunk (below), never silently.
      stopWhen: [
        isStepCount(maxSteps),
        failureStreakReached(FAILURE_STREAK_LIMIT),
      ],
      // One tool at a time: build steps commit in order, each against the revision the one before left.
      toolCallConcurrency: 1,
      abortSignal: options.abortSignal,
      // No quick retries: a server that asks to wait (429) gets its wait, and the person gets the Retry button
      // (catalog chat.retry).
      maxRetries: 0,
      // The SDK's default prints the whole error object. The chat gets the error as a stream part, the main log
      // gets one line at the turn's end, and the conversation log keeps the server's full answer.
      onError: () => undefined,
    });

    let partCount = 0;
    // A reply with no words, no tool calls and no error is not a model's answer (an HTML page, a proxy).
    let answered = false;
    let wroteText = false;
    let breakBeforeText = false;
    for await (const part of result.fullStream) {
      partCount++;
      if (part.type === 'error') this.markProviderError((part as { error?: unknown }).error);
      trace?.part(part as unknown as { type: string } & Record<string, unknown>);
      if (part.type === 'start-step') breakBeforeText = wroteText;
      if (ANSWER_PARTS.has(part.type)) answered = true;
      if (part.type === 'source') {
        const url = (part as { url?: unknown }).url;
        if (typeof url === 'string') {
          try {
            options.onSource?.(url);
          } catch {
            // Remembering a cited address never breaks the stream.
          }
        }
      }
      const forwarded = forwardPart(part as unknown as { type: string } & Record<string, unknown>, this.redact);
      if (part.type === 'text-delta' && typeof forwarded.content.text === 'string' && forwarded.content.text !== '') {
        // Text of a later step starts a new paragraph instead of running into the previous step's words.
        if (breakBeforeText) forwarded.content.text = `\n\n${forwarded.content.text}`;
        breakBeforeText = false;
        wroteText = true;
      }
      yield forwarded;
      if (part.type === 'finish-step' && local) {
        const counted = (part as { usage?: { inputTokens?: unknown } }).usage?.inputTokens;
        const notice = await this.contextNotice(local, typeof counted === 'number' ? counted : null, options.compact === true, trace);
        if (notice) yield { type: 'notice', content: notice };
      }
    }
    turnLog(`[MainLLMService] fullStream complete, ${partCount} parts yielded`);
    if (options.abortSignal?.aborted) return;
    if (!answered) {
      trace?.part({ type: 'error', error: { message: NOT_A_MODEL } });
      yield { type: 'error', content: { type: 'error', error: { message: NOT_A_MODEL, kind: 'not-a-model', details: NOT_A_MODEL } } };
      return;
    }
    let steps: ReadonlyArray<{ finishReason?: unknown; content?: ReadonlyArray<unknown>; usage?: { inputTokens?: number } }> = [];
    try {
      steps = await result.steps;
    } catch {
      steps = [];
    }
    // A count the server stopped at its window says nothing about how many characters make a token.
    if (local?.said !== 'cut') this.noteUsage(messages, steps);
    const usage = turnUsage(this.config, steps);
    if (usage) yield { type: 'usage', content: usage };
    // The model stopped because it reached its length limit, not because it was done: the chat says so.
    const last = steps[steps.length - 1] as { finishReason?: unknown } | undefined;
    if (last?.finishReason === 'length') yield { type: 'notice', content: { code: 'answer-cut', reason: 'length' } };
    const paused = pauseOf(steps, maxSteps);
    if (paused) {
      turnLog(`[MainLLMService] Turn paused: ${paused.reason} after ${paused.steps} steps`);
      yield { type: 'turn-paused', content: paused };
    }
  }

  /**
   * A failure only the provider side can name: your own server refused the request for want of a key the person
   * never gave it ("needs-key", not "the key was refused"). The chat reads the kind (shared/agent/turnError.ts).
   */
  private markProviderError(error: unknown): void {
    const config = this.config;
    if (!config || config.provider !== 'local' || !error || typeof error !== 'object') return;
    if (refusedForKey(error) && !this.keyFor('local', config.baseURL)) (error as { kind?: string }).kind = 'needs-key';
  }

  /** Characters per token measured on the last send (the provider's input-token count of its first step), or null. */
  private measuredCharsPerToken: { model: string; ratio: number } | null = null;

  /** Measures characters per token from the first step's input count, for the next history budget. */
  private noteUsage(messages: StreamMessage[], steps: ReadonlyArray<{ usage?: { inputTokens?: number } }>): void {
    const tokens = steps[0]?.usage?.inputTokens;
    const chars = messages.reduce((sum, message) => sum + message.content.length, 0);
    // Too short a request says little about the ratio.
    if (typeof tokens !== 'number' || !Number.isFinite(tokens) || tokens < 200 || chars < 800) return;
    // Tool schemas also count as input tokens, so the measure leans low; clamp to a sane range.
    const ratio = Math.max(2, Math.min(6, chars / tokens));
    this.measuredCharsPerToken = { model: `${this.config?.provider ?? ''}/${this.config?.model ?? ''}`, ratio };
  }

  /** ~4 characters per token, or what the previous send of the same model measured. */
  charsPerToken(): number {
    const key = `${this.config?.provider ?? ''}/${this.config?.model ?? ''}`;
    return this.measuredCharsPerToken?.model === key ? this.measuredCharsPerToken.ratio : 4;
  }
}

/**
 * What one turn cost: the tokens every step counted and, for a cloud model in the dated price table, an estimate in
 * dollars (shared/config/modelAdvice.ts). Null when the server counted nothing. The chat shows it under the answer.
 */
export interface TurnUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Dollars, or null when the price is not known (a compatible service, a model not in the table). */
  costUsd: number | null;
  /** The date of the price table the estimate came from. */
  pricesFrom: string;
  /** False for your own server: nothing is billed. */
  billed: boolean;
}

/** The usage of a turn from its steps, or null when no step counted anything. */
export function turnUsage(config: { provider: string; model: string } | null, steps: ReadonlyArray<{ usage?: { inputTokens?: number; outputTokens?: number } }>): TurnUsage | null {
  if (!config) return null;
  let input = 0;
  let output = 0;
  let counted = false;
  for (const step of steps) {
    const tokensIn = step.usage?.inputTokens;
    const tokensOut = step.usage?.outputTokens;
    if (typeof tokensIn === 'number' && Number.isFinite(tokensIn)) { input += tokensIn; counted = true; }
    if (typeof tokensOut === 'number' && Number.isFinite(tokensOut)) { output += tokensOut; counted = true; }
  }
  if (!counted) return null;
  const billed = isCloudProvider(config.provider);
  return {
    provider: config.provider,
    model: config.model,
    inputTokens: input,
    outputTokens: output,
    costUsd: billed ? costOf(config.provider, config.model, input, output) : null,
    pricesFrom: ADVICE_DATE,
    billed,
  };
}

/** Whether a provider error is a 401 or 403, the answer of a server that wants a key. */
export function refusedForKey(error: unknown): boolean {
  let current: unknown = error;
  // The SDK wraps errors (a retry error around the last one, a cause chain): look a few levels down.
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const status = (current as { statusCode?: unknown; status?: unknown }).statusCode ?? (current as { status?: unknown }).status;
    if (status === 401 || status === 403) return true;
    current = (current as { lastError?: unknown; cause?: unknown }).lastError ?? (current as { cause?: unknown }).cause;
  }
  return false;
}

export { MainLLMService };
/** The one service of the app. */
export const mainLLMService = new MainLLMService();
