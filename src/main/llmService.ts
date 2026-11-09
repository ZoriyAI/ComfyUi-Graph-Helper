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
import { listCloudModels, listLocalModels } from './llm/modelList';

/**
 * Main-process LLM service
 * Credentials are ephemeral (session-only, NOT persisted)
 * Renderer never sees API keys
 */

export type ChatProvider = 'openai' | 'anthropic' | 'google' | 'test' | 'local';
type CloudProvider = 'openai' | 'anthropic' | 'google';

const PROVIDERS: readonly ChatProvider[] = ['openai', 'anthropic', 'google', 'test', 'local'];
const CLOUD: readonly CloudProvider[] = ['openai', 'anthropic', 'google'];

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

export type KeySource = 'none' | 'session' | 'os';

export interface StreamOptions {
  /** Upper bound on model steps. Each tool round trip is one step. Clamped to the preferences range. */
  maxSteps?: number;
  /** Aborts the provider request and the tool loop (llm:cancel, window gone). */
  abortSignal?: AbortSignal;
  /** Preferences ▸ Assistant: when false, the web search tool is not offered to the model. */
  allowWebSearch?: boolean;
  /** Preferences ▸ Assistant: when false, the page reader tool is not offered to the model. */
  allowFetchPage?: boolean;
}

/** The loop stops after this many failed or conflicted tool results in a row. */
export const FAILURE_STREAK_LIMIT = 3;

type StreamMessage = { role: 'system' | 'user' | 'assistant'; content: string };

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

export type ProbeResult = { ok: true; latencyMs: number; provider: string; model: string } | { ok: false; error: string; latencyMs: number | null };

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
  private sessionKey: string | null = null;
  private sessionSource: KeySource = 'none';

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

  /** Holds a cloud key in memory for this process. The value is not returned, logged, or written. */
  setSessionKey(value: unknown): { held: boolean; source: KeySource } {
    if (typeof value !== 'string' || value.length === 0 || value.length > 4000) {
      this.sessionKey = null;
      this.sessionSource = 'none';
      return { held: false, source: 'none' };
    }
    this.sessionKey = value;
    this.sessionSource = 'session';
    return { held: true, source: 'session' };
  }

  /** Holds a key just decrypted from OS storage. Does not write SQLite. */
  holdOsKey(value: string): void {
    if (value.length === 0 || value.length > 4000) return;
    this.sessionKey = value;
    this.sessionSource = 'os';
  }

  /** The held LLM key and MCP token, for exact-match redaction only. Never returned to a caller. */
  private heldValues(): string[] {
    return [this.sessionKey, mcpToken()].filter((value): value is string => typeof value === 'string' && value.length > 0);
  }

  /** Heuristic redaction plus exact redaction of the held key and MCP token. */
  redact: Redact = (text: string): string => exactMatchRedactor(this.heldValues())(redactSecrets(text));

  /** True when the exact held key or MCP token appears in the text. */
  containsHeldSecret(text: string): boolean {
    return containsExact(this.heldValues(), text);
  }

  sessionStatus(): { held: boolean; source: KeySource } {
    const held = this.sessionKey != null && this.sessionKey.length > 0;
    return { held, source: held ? this.sessionSource : 'none' };
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
      if (this.sessionKey && !httpsCloudEndpoint(config.baseURL)) return 'Cloud key is not sent to an http address.';
      if (!this.sessionKey) return 'Cloud model has no key for this session.';
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
    try {
      await generate({ model, abortSignal: controller.signal });
      return { ok: true, latencyMs: Math.max(0, Math.round(now() - started)), provider, model: config.model };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: redactProbeError(message, [this.sessionKey]), latencyMs: Math.max(0, Math.round(now() - started)) };
    } finally {
      clearTimeout(timer);
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
      if (!this.sessionKey) return { ok: false, error: 'Cloud model has no key for this session.' };
      const result = await listCloudModels(provider as CloudProvider, base, this.sessionKey, fetchImpl);
      return result.ok ? result : { ok: false, error: redactProbeError(result.error, [this.sessionKey]) };
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

  getModel(): LanguageModel | null {
    if (!this.config) {
      console.warn('[MainLLMService] No config set');
      return null;
    }
    return this.modelFor(this.config);
  }

  private modelFor(config: LLMConfig): LanguageModel | null {
    const { provider, model } = config;

    if (provider === 'test') {
      console.log('[MainLLMService] Using TEST fixture transport');
      return createTestLLMModel();
    }

    if (isCloud(provider)) {
      const baseURL = this.cloudBase(provider, config);
      if (!baseURL) return null;
      const apiKey = this.sessionKey ?? '';
      if (provider === 'openai') return createOpenAI({ apiKey, baseURL })(model);
      if (provider === 'anthropic') return createAnthropic({ apiKey, baseURL })(model);
      return createGoogleGenerativeAI({ apiKey, baseURL })(model);
    }

    if (provider === 'local') {
      const local = createOpenAI({
        apiKey: LOCAL_PLACEHOLDER,
        baseURL: config.baseURL,
        name: 'local',
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
    const blocked = this.sendBlock();
    if (blocked) throw new Error(blocked);
    const model = this.getModel();
    if (!model) {
      throw new Error('Model not configured');
    }

    const offered = toolsForSend(tools, options);
    console.log(`[MainLLMService] Starting stream with ${Object.keys(offered).length} tools`);
    const text = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n');
    const dialog = dropEmptyAssistant(messages.filter((message) => message.role !== 'system'));
    // The system prompt is the stable prefix of every step: cache it on Anthropic.
    const instructions = text && this.config?.provider === 'anthropic'
      ? { role: 'system' as const, content: text, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } }
      : text || undefined;

    const maxSteps = clampSteps(options.maxSteps);
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
    });

    let partCount = 0;
    let wroteText = false;
    let breakBeforeText = false;
    for await (const part of result.fullStream) {
      partCount++;
      if (part.type === 'start-step') breakBeforeText = wroteText;
      const forwarded = forwardPart(part as unknown as { type: string } & Record<string, unknown>, this.redact);
      if (part.type === 'text-delta' && typeof forwarded.content.text === 'string' && forwarded.content.text !== '') {
        // Text of a later step starts a new paragraph instead of running into the previous step's words.
        if (breakBeforeText) forwarded.content.text = `\n\n${forwarded.content.text}`;
        breakBeforeText = false;
        wroteText = true;
      }
      yield forwarded;
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
