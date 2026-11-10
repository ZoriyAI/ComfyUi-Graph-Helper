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
import { listCloudModels, listLocalModels, MODEL_LIST_REFUSED } from './llm/modelList';
import { originOf, startTurnTrace, type TurnMeta } from './trace/modelTrace';
import { contextFit, type ContextFit } from './llm/localContext';

/**
 * Main-process LLM service
 * Credentials are ephemeral (session-only, NOT persisted)
 * Renderer never sees API keys
 */

export type ChatProvider = 'openai' | 'anthropic' | 'google' | 'test' | 'local';
export type CloudProvider = 'openai' | 'anthropic' | 'google';

const PROVIDERS: readonly ChatProvider[] = ['openai', 'anthropic', 'google', 'test', 'local'];
export const CLOUD: readonly CloudProvider[] = ['openai', 'anthropic', 'google'];

export function isCloudProvider(value: unknown): value is CloudProvider {
  return typeof value === 'string' && (CLOUD as readonly string[]).includes(value);
}

/** Official endpoints. Passed explicitly so an environment variable never redirects a held key. */
const OFFICIAL_BASE: Record<CloudProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
};

interface LLMConfig {
  provider: ChatProvider;
  model: string;
  baseURL?: string;
}

const LOCAL_PLACEHOLDER = 'local';

function isCloud(provider: ChatProvider): provider is CloudProvider {
  return (CLOUD as readonly string[]).includes(provider);
}

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

export type KeySource = 'none' | 'session' | 'os' | 'file';
type HeldSource = Exclude<KeySource, 'none'>;

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

type StreamMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** One turn's watch on a local server: the size of its first request and the window the model was loaded with. */
interface LocalWatch {
  requestChars: number;
  window: Promise<number | null> | null;
  stop: AbortController;
  key: string | null;
  checked?: boolean;
}

/** Gemini rejects a content with no parts: an assistant turn that only called tools has no text to send. */
export function dropEmptyAssistant(messages: StreamMessage[]): StreamMessage[] {
  return messages.filter((message) => message.role !== 'assistant' || message.content.trim() !== '');
}


export const MAX_STEPS_FLOOR = STEP_LIMIT.min;
export const MAX_STEPS_CEILING = STEP_LIMIT.max;

export function clampSteps(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return STEP_LIMIT.default;
  return Math.max(MAX_STEPS_FLOOR, Math.min(MAX_STEPS_CEILING, Math.round(value)));
}

/** Why a turn stopped before the model finished: the step checkpoint or the failure-streak guard. */
export type PauseReason = 'step-limit' | 'failure-streak';
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

class MainLLMService {
  private config: LLMConfig | null = null;
  /**
   * One key per cloud company, with where it came from. A request to one provider only ever reads that provider's
   * entry: a key pasted for Anthropic is never attached to an OpenAI or Google request after a switch.
   */
  private keys = new Map<CloudProvider, { value: string; source: HeldSource }>();
  /** Context windows local servers were seen to load a model with, by "origin|model". */
  private loadedWindows = new Map<string, number>();
  /** 'tight' notices already shown, by "origin|model|window": said once per run, not on every turn. */
  private tightSaid = new Set<string>();

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
    if (typeof config.provider !== 'string' || !(PROVIDERS as readonly string[]).includes(config.provider)) {
      this.config = null;
      return;
    }
    this.config = {
      provider: config.provider as ChatProvider,
      model: typeof config.model === 'string' ? config.model : '',
      baseURL: typeof config.baseURL === 'string' ? config.baseURL : undefined,
    };
  }

  private hold(provider: unknown, value: unknown, source: HeldSource): { held: boolean; source: KeySource } {
    if (!isCloudProvider(provider)) return { held: false, source: 'none' };
    if (typeof value !== 'string' || value.length === 0 || value.length > 4000) {
      this.keys.delete(provider);
      return { held: false, source: 'none' };
    }
    this.keys.set(provider, { value, source });
    return { held: true, source };
  }

  /**
   * Holds a cloud key for one provider in memory for this process. The value is not returned, logged, or written.
   * An empty value forgets that provider's key; another provider's key is untouched.
   */
  setSessionKey(provider: unknown, value: unknown): { held: boolean; source: KeySource } {
    return this.hold(provider, value, 'session');
  }

  /** Holds a key just decrypted from OS storage for its provider. Does not write SQLite. */
  holdOsKey(provider: CloudProvider, value: string): void {
    if (value.length === 0 || value.length > 4000) return;
    this.hold(provider, value, 'os');
  }

  /** Holds a key read from the app folder file the person chose on a computer without a password store. */
  holdFileKey(provider: CloudProvider, value: string): void {
    if (value.length === 0 || value.length > 4000) return;
    this.hold(provider, value, 'file');
  }

  /** Forgets one provider's key, or every provider's key without an argument. */
  forgetKeys(provider?: CloudProvider): void {
    if (provider) this.keys.delete(provider);
    else this.keys.clear();
  }

  /** The key held for a provider, for remembering it; never returned to the renderer. */
  heldKey(provider: unknown): string | null {
    return isCloudProvider(provider) ? this.keys.get(provider)?.value ?? null : null;
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
    const entry = isCloudProvider(provider) ? this.keys.get(provider) : undefined;
    return entry ? { held: true, source: entry.source } : { held: false, source: 'none' };
  }

  /** Every cloud provider's key place, for the provider cards. */
  keySources(): Record<CloudProvider, KeySource> {
    return { openai: this.keyStatus('openai').source, anthropic: this.keyStatus('anthropic').source, google: this.keyStatus('google').source };
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

  private blockFor(config: LLMConfig | null): string | null {
    if (!config) return 'Model not configured';
    const { provider } = config;
    if (isCloud(provider)) {
      const key = this.heldKey(provider);
      if (key && !httpsCloudEndpoint(config.baseURL)) return 'Cloud key is not sent to an http address.';
      if (!key) return 'Cloud model has no key for this session.';
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
    const provider = typeof draft.provider === 'string' && (PROVIDERS as readonly string[]).includes(draft.provider) ? draft.provider as ChatProvider : null;
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
      const contextTokens = watch ? await Promise.race([watch, new Promise<null>((resolve) => setTimeout(() => resolve(null), 700))]) : null;
      if (contextTokens !== null) {
        const key = this.windowKey(config);
        if (key) this.loadedWindows.set(key, contextTokens);
      }
      return { ok: true, latencyMs, provider, model: config.model, ...(contextTokens !== null ? { contextTokens } : {}) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
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
  async listModels(draft: ProbeDraft, fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args)): Promise<ModelListResult> {
    const provider = typeof draft.provider === 'string' && (PROVIDERS as readonly string[]).includes(draft.provider) ? draft.provider as ChatProvider : null;
    if (!provider) return { ok: false, error: 'Model not configured' };
    const baseURL = typeof draft.baseURL === 'string' ? draft.baseURL.trim() : '';
    if (provider === 'test') return { ok: true, models: [{ id: 'test-fixture' }], source: 'test' };
    try {
      if (provider === 'local') {
        if (!httpEndpoint(baseURL)) return { ok: false, error: 'Local model has no endpoint.' };
        return await listLocalModels(baseURL, fetchImpl);
      }
      const config: LLMConfig = { provider, model: '', baseURL };
      const base = this.cloudBase(provider as CloudProvider, config);
      if (!base) return { ok: false, error: 'Cloud key is not sent to an http address.' };
      const cloud = provider as CloudProvider;
      const entry = this.keys.get(cloud);
      if (!entry) return { ok: false, error: 'Cloud model has no key for this session.' };
      const result = await listCloudModels(cloud, base, entry.value, fetchImpl);
      if (result.ok) return result;
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

  nextSendConfig(): ChatRuntimeConfig {
    if (!this.config) return { provider: '', model: '', baseURL: '' };
    return {
      provider: this.config.provider,
      model: this.config.model,
      baseURL: this.config.baseURL ?? '',
    };
  }

  private cloudBase(provider: CloudProvider, config: LLMConfig | null = this.config): string | null {
    if (!httpsCloudEndpoint(config?.baseURL)) return null;
    return config?.baseURL?.trim() || OFFICIAL_BASE[provider];
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

  private modelFor(config: LLMConfig, fetchImpl?: typeof fetch): LanguageModel | null {
    const { provider, model } = config;

    if (provider === 'test') {
      console.log('[MainLLMService] Using TEST fixture transport');
      return createTestLLMModel();
    }

    if (isCloud(provider)) {
      const baseURL = this.cloudBase(provider, config);
      if (!baseURL) return null;
      // Only the key held for this provider; another provider's key is never a fallback.
      const apiKey = this.heldKey(provider) ?? '';
      const wire = fetchImpl ? { fetch: fetchImpl } : {};
      if (provider === 'openai') return createOpenAI({ apiKey, baseURL, ...wire })(model);
      if (provider === 'anthropic') return createAnthropic({ apiKey, baseURL, ...wire })(model);
      return createGoogleGenerativeAI({ apiKey, baseURL, ...wire })(model);
    }

    if (provider === 'local') {
      const local = createOpenAI({
        apiKey: LOCAL_PLACEHOLDER,
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
    if (!this.config || !isCloud(this.config.provider)) return null;
    if ((this.config.baseURL?.trim() ?? '') !== '') return null;
    const { provider, model } = this.config;
    // The key is not attached here; a tool definition never carries it.
    if (provider === 'openai') return createOpenAI({ apiKey: '' }).tools.webSearch();
    if (provider === 'anthropic') return createAnthropic({ apiKey: '' }).tools.webSearch_20250305({ maxUses: 5 });
    // Before Gemini 3, @ai-sdk/google sends only the search tool when it is present and drops every
    // function tool. Those models use the main-process search fallback instead.
    if (!model.trim().toLowerCase().startsWith('gemini-3')) return null;
    return createGoogleGenerativeAI({ apiKey: '' }).tools.googleSearch({});
  }

  async* streamChatWithTools(
    messages: StreamMessage[],
    tools: Record<string, any>,
    options: StreamOptions = {},
  ): AsyncGenerator<{ type: string; content: any }> {
    const offered = toolsForSend(tools, options);
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
      console.log(`[MainLLMService] Starting stream with ${Object.keys(offered).length} tools`);
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
   * After the first step of a turn with a local model: the window the server loaded it with, whether the request
   * fit, and the notice for the chat when it did not. Null when the server does not say or everything fits.
   */
  private async contextNotice(local: LocalWatch, counted: number | null, compact: boolean, trace: ReturnType<typeof startTurnTrace>): Promise<ContextNotice | null> {
    if (!local.window) return null;
    // The watcher answers within its poll interval once the model is loaded; never hold the answer for long.
    const window = await Promise.race([local.window, new Promise<null>((resolve) => setTimeout(() => resolve(null), 800))]);
    local.stop.abort();
    if (window === null) return null;
    if (local.key) this.loadedWindows.set(local.key, window);
    const fit = contextFit(window, local.requestChars, counted);
    trace?.note('context', { window: fit.window, requestChars: local.requestChars, needed: fit.needed, counted, state: fit.state, compact });
    console.log(`[MainLLMService] Local context window ${fit.window} tokens, request about ${fit.needed}: ${fit.state}`);
    if (fit.state === 'ok') return null;
    if (fit.state === 'tight') {
      const said = `${local.key ?? ''}|${window}`;
      if (this.tightSaid.has(said)) return null;
      this.tightSaid.add(said);
    }
    return { code: 'context-window', model: this.config?.model ?? '', compact, ...fit };
  }

  /** The server a turn talks to, as the log names it: origin only, never a path, a query or credentials. */
  private traceOrigin(config: LLMConfig | null): string {
    if (!config) return '';
    if (config.provider === 'test') return '';
    if (isCloud(config.provider)) return originOf(this.cloudBase(config.provider, config) ?? config.baseURL);
    return originOf(config.baseURL);
  }

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
      toolCallConcurrency: 1,
      abortSignal: options.abortSignal,
      // The SDK's default prints the whole error object. The chat gets the error as a stream part, the main log
      // gets one line at the turn's end, and the conversation log keeps the server's full answer.
      onError: () => undefined,
    });

    let partCount = 0;
    let wroteText = false;
    let breakBeforeText = false;
    for await (const part of result.fullStream) {
      partCount++;
      trace?.part(part as unknown as { type: string } & Record<string, unknown>);
      if (part.type === 'start-step') breakBeforeText = wroteText;
      const forwarded = forwardPart(part as unknown as { type: string } & Record<string, unknown>, this.redact);
      if (part.type === 'text-delta' && typeof forwarded.content.text === 'string' && forwarded.content.text !== '') {
        // Text of a later step starts a new paragraph instead of running into the previous step's words.
        if (breakBeforeText) forwarded.content.text = `\n\n${forwarded.content.text}`;
        breakBeforeText = false;
        wroteText = true;
      }
      yield forwarded;
      if (part.type === 'finish-step' && local && !local.checked) {
        local.checked = true;
        const counted = (part as { usage?: { inputTokens?: unknown } }).usage?.inputTokens;
        const notice = await this.contextNotice(local, typeof counted === 'number' ? counted : null, options.compact === true, trace);
        if (notice) yield { type: 'notice', content: notice };
      }
    }
    console.log(`[MainLLMService] fullStream complete, ${partCount} parts yielded`);
    if (options.abortSignal?.aborted) return;
    let steps: ReadonlyArray<{ finishReason?: unknown; content?: ReadonlyArray<unknown>; usage?: { inputTokens?: number } }> = [];
    try {
      steps = await result.steps;
    } catch {
      steps = [];
    }
    this.noteUsage(messages, steps);
    const paused = pauseOf(steps, maxSteps);
    if (paused) {
      console.log(`[MainLLMService] Turn paused: ${paused.reason} after ${paused.steps} steps`);
      yield { type: 'turn-paused', content: paused };
    }
  }

  /** Characters per token measured on the last send (the provider's input-token count of its first step), or null. */
  private measuredCharsPerToken: { model: string; ratio: number } | null = null;

  private noteUsage(messages: StreamMessage[], steps: ReadonlyArray<{ usage?: { inputTokens?: number } }>): void {
    const tokens = steps[0]?.usage?.inputTokens;
    const chars = messages.reduce((sum, message) => sum + message.content.length, 0);
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

export { MainLLMService };
export const mainLLMService = new MainLLMService();
