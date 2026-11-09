import { streamText, LanguageModel, isStepCount } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { ChatRuntimeConfig } from '../shared/config/schema';
import { createTestLLMModel } from './testLLMTransport';
import { mcpToken } from './mcp/token';
import { containsExact, exactMatchRedactor, redactSecrets } from '../shared/agent/redact';
import { failureStreakReached, forwardPart, type Redact } from './agent/streamParts';

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
  /** Upper bound on model steps. Each tool round trip is one step. */
  maxSteps?: number;
  /** Aborts the provider request and the tool loop (llm:cancel, window gone). */
  abortSignal?: AbortSignal;
}

/** The loop stops after this many failed or conflicted tool results in a row. */
export const FAILURE_STREAK_LIMIT = 3;

type StreamMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** Gemini rejects a content with no parts: an assistant turn that only called tools has no text to send. */
export function dropEmptyAssistant(messages: StreamMessage[]): StreamMessage[] {
  return messages.filter((message) => message.role !== 'assistant' || message.content.trim() !== '');
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
    if (!this.config) return 'Model not configured';
    const { provider } = this.config;
    if (isCloud(provider)) {
      if (this.sessionKey && !httpsCloudEndpoint(this.config.baseURL)) return 'Cloud key is not sent to an http address.';
      if (!this.sessionKey) return 'Cloud model has no key for this session.';
      if (this.config.model.trim() === '') return 'Cloud model has no model id.';
    }
    if (provider === 'local' && !httpEndpoint(this.config.baseURL)) return 'Local model has no endpoint.';
    if (provider === 'local' && this.config.model.trim() === '') return 'Local model has no model id.';
    return null;
  }

  nextSendConfig(): ChatRuntimeConfig {
    if (!this.config) return { provider: '', model: '', baseURL: '' };
    return {
      provider: this.config.provider,
      model: this.config.model,
      baseURL: this.config.baseURL ?? '',
    };
  }

  private cloudBase(provider: CloudProvider): string | null {
    if (!httpsCloudEndpoint(this.config?.baseURL)) return null;
    return this.config?.baseURL?.trim() || OFFICIAL_BASE[provider];
  }

  getModel(): LanguageModel | null {
    if (!this.config) {
      console.warn('[MainLLMService] No config set');
      return null;
    }
    const { provider, model } = this.config;

    if (provider === 'test') {
      console.log('[MainLLMService] Using TEST fixture transport');
      return createTestLLMModel();
    }

    if (isCloud(provider)) {
      const baseURL = this.cloudBase(provider);
      if (!baseURL) return null;
      const apiKey = this.sessionKey ?? '';
      if (provider === 'openai') return createOpenAI({ apiKey, baseURL })(model);
      if (provider === 'anthropic') return createAnthropic({ apiKey, baseURL })(model);
      return createGoogleGenerativeAI({ apiKey, baseURL })(model);
    }

    if (provider === 'local') {
      const local = createOpenAI({
        apiKey: LOCAL_PLACEHOLDER,
        baseURL: this.config.baseURL,
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

    console.log(`[MainLLMService] Starting stream with ${Object.keys(tools).length} tools`);
    const text = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n');
    const dialog = dropEmptyAssistant(messages.filter((message) => message.role !== 'system'));
    // The system prompt is the stable prefix of every step: cache it on Anthropic.
    const instructions = text && this.config?.provider === 'anthropic'
      ? { role: 'system' as const, content: text, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } }
      : text || undefined;

    const result = streamText({
      model,
      instructions,
      messages: dialog,
      tools,
      // Default stopWhen is one step, which never feeds tool results back to the model.
      // A teaching turn reads the catalog, maybe the web, then proposes: allow a few rounds.
      stopWhen: [isStepCount(options.maxSteps ?? 12), failureStreakReached(FAILURE_STREAK_LIMIT)],
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
  }
}

export { MainLLMService };
export const mainLLMService = new MainLLMService();
