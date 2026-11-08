import { streamText, LanguageModel, isStepCount } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { ChatRuntimeConfig } from '../shared/config/schema';
import { createTestLLMModel } from './testLLMTransport';

/**
 * Main-process LLM service
 * Credentials are ephemeral (session-only, NOT persisted)
 * Renderer never sees API keys
 */

interface LLMConfig {
  provider: 'openai' | 'test' | 'local';
  model: string;
  baseURL?: string;
}

const LOCAL_PLACEHOLDER = 'local';

function httpEndpoint(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

class MainLLMService {
  private config: LLMConfig | null = null;
  private sessionKey: string | null = null;

  /**
   * Stores the non-secret provider, model, and base URL for the next send.
   * Does not construct a client and does not send a request. An API key on the input is ignored.
   */
  setConfig(config: { provider?: unknown; model?: unknown; baseURL?: unknown; apiKey?: unknown }): void {
    console.log('[MainLLMService] Config updated (credentials NOT logged)');
    if (config.provider !== 'openai' && config.provider !== 'test' && config.provider !== 'local') {
      this.config = null;
      return;
    }
    this.config = {
      provider: config.provider,
      model: typeof config.model === 'string' ? config.model : '',
      baseURL: typeof config.baseURL === 'string' ? config.baseURL : undefined,
    };
  }

  /** Holds a cloud key in memory. The value is not returned, logged, or written. */
  setSessionKey(value: unknown): { held: boolean } {
    if (typeof value !== 'string' || value.length === 0 || value.length > 4000) {
      this.sessionKey = null;
      return { held: false };
    }
    this.sessionKey = value;
    return { held: true };
  }

  sessionStatus(): { held: boolean } {
    return { held: this.sessionKey != null && this.sessionKey.length > 0 };
  }

  private sendBlock(): string | null {
    if (!this.config) return 'Model not configured';
    if (this.config.provider === 'openai' && !this.sessionKey) return 'Cloud model has no key for this session.';
    if (this.config.provider === 'openai' && this.config.model.trim() === '') return 'Cloud model has no model id.';
    if (this.config.provider === 'local' && !httpEndpoint(this.config.baseURL)) return 'Local model has no endpoint.';
    if (this.config.provider === 'local' && this.config.model.trim() === '') return 'Local model has no model id.';
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

  getModel(): LanguageModel | null {
    if (!this.config) {
      console.warn('[MainLLMService] No config set');
      return null;
    }

    if (this.config.provider === 'test') {
      console.log('[MainLLMService] Using TEST fixture transport');
      return createTestLLMModel();
    }

    if (this.config.provider === 'openai') {
      const openai = createOpenAI({
        apiKey: this.sessionKey ?? '',
        baseURL: this.config.baseURL || 'https://api.openai.com/v1',
      });
      return openai(this.config.model);
    }

    if (this.config.provider === 'local') {
      const local = createOpenAI({
        apiKey: LOCAL_PLACEHOLDER,
        baseURL: this.config.baseURL,
        name: 'local',
      });
      // Local OpenAI-compatible servers expose chat completions, not the Responses API.
      return local.chat(this.config.model);
    }

    return null;
  }

  async* streamChatWithTools(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    tools: Record<string, any>
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
      stopWhen: isStepCount(6),
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

export const mainLLMService = new MainLLMService();
