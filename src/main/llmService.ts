import { streamText, LanguageModel, isStepCount } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { ChatRuntimeConfig } from '../shared/config/schema';
import { createTestLLMModel } from './testLLMTransport';

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
    const { provider } = this.config;
    // The key is not attached here; a tool definition never carries it.
    if (provider === 'openai') return createOpenAI({ apiKey: '' }).tools.webSearch();
    if (provider === 'anthropic') return createAnthropic({ apiKey: '' }).tools.webSearch_20250305({ maxUses: 5 });
    return createGoogleGenerativeAI({ apiKey: '' }).tools.googleSearch({});
  }

  async* streamChatWithTools(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
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
    const instructions = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n');
    const dialog = messages.filter((message) => message.role !== 'system');

    const result = streamText({
      model,
      instructions: instructions || undefined,
      messages: dialog,
      tools,
      // Default stopWhen is one step, which never feeds tool results back to the model.
      // A teaching turn reads the catalog, maybe the web, then proposes: allow a few rounds.
      stopWhen: isStepCount(options.maxSteps ?? 12),
      toolCallConcurrency: 1,
    });

    console.log('[MainLLMService] Consuming fullStream...');
    let partCount = 0;
    for await (const part of result.fullStream) {
      partCount++;
      console.log(`[MainLLMService] Part ${partCount}: type=${part.type}`);
      yield { type: part.type, content: part };
    }
    console.log(`[MainLLMService] fullStream complete, ${partCount} parts yielded`);
  }
}

export { MainLLMService };
export const mainLLMService = new MainLLMService();
