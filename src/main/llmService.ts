import { streamText, LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

/**
 * Main-process LLM service
 * Credentials are ephemeral (session-only, NOT persisted)
 * Renderer never sees API keys
 */

interface LLMConfig {
  provider: 'openai' | 'test';
  model: string;
  apiKey?: string; // EPHEMERAL - not saved
  baseURL?: string;
}

class MainLLMService {
  private config: LLMConfig | null = null;

  setConfig(config: LLMConfig): void {
    console.log('[MainLLMService] Config updated (credentials NOT logged)');
    this.config = config;
  }

  getModel(): LanguageModel | null {
    if (!this.config) {
      console.warn('[MainLLMService] No config set');
      return null;
    }

    if (this.config.provider === 'openai') {
      const openai = createOpenAI({
        apiKey: this.config.apiKey || process.env.OPENAI_API_KEY,
        baseURL: this.config.baseURL,
      });
      return openai(this.config.model);
    }

    return null;
  }

  async* streamChatWithTools(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    tools: Record<string, any>
  ): AsyncGenerator<{ type: string; content: any }> {
    const model = this.getModel();
    if (!model) {
      throw new Error('Model not configured');
    }

    console.log(`[MainLLMService] Starting stream with ${Object.keys(tools).length} tools`);

    const result = streamText({
      model,
      messages,
      tools,
    });

    for await (const part of result.fullStream) {
      yield { type: part.type, content: part };
    }
  }
}

export const mainLLMService = new MainLLMService();
