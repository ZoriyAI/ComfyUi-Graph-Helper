import { streamText, LanguageModel, isStepCount } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createTestLLMModel } from './testLLMTransport';

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
    this.config = {
      provider: config.provider,
      model: config.model,
      baseURL: config.baseURL,
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
        apiKey: '',
        baseURL: this.config.baseURL ?? 'https://api.openai.com/v1',
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
      // Default stopWhen is one step, which never feeds tool results back to the model.
      stopWhen: isStepCount(4),
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
