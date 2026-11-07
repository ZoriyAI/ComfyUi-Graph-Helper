import { LanguageModelV4, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { convertArrayToReadableStream } from '@ai-sdk/provider-utils/test';

/**
 * TEST-ONLY deterministic LLM transport
 * 
 * Single-turn response with all tool calls and completion text
 */

export function createTestLLMModel(): LanguageModelV4 {
  return {
    specificationVersion: 'v4' as const,
    provider: 'test',
    modelId: 'test-fixture',
    supportedUrls: {},

    async doGenerate() {
      throw new Error('Use doStream for test transport');
    },

    async doStream(options) {
      console.log('[TestLLM] doStream called');
      
      const parts: LanguageModelV4StreamPart[] = [];

      // Tool call 1: addNode
      console.log('[TestLLM] Part 1: addNode tool-call');
      parts.push({
        type: 'tool-call',
        toolCallId: 'call-add-node',
        toolName: 'addNode',
        input: JSON.stringify({ nodeType: 'TestNode', title: 'AI Test Node', x: 200, y: 200 }),
      });

      // Tool call 2: annotateNode (with placeholder nodeId)
      console.log('[TestLLM] Part 2: annotateNode tool-call');
      parts.push({
        type: 'tool-call',
        toolCallId: 'call-annotate',
        toolName: 'annotateNode',
        input: JSON.stringify({ nodeId: 'LATEST_NODE', annotation: 'AI added annotation' }),
      });

      // Completion text
      console.log('[TestLLM] Parts 3-N: completion text');
      const textId = 'text-1';
      parts.push({ type: 'text-start', id: textId });
      
      const text = 'I have added a TestNode and annotated it.';
      for (const char of text) {
        parts.push({ type: 'text-delta', id: textId, delta: char });
      }
      
      parts.push({ type: 'text-end', id: textId });

      // Finish
      parts.push({
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 20, text: 20, reasoning: 0 },
        },
      });

      console.log(`[TestLLM] Returning ${parts.length} parts total`);

      return {
        stream: convertArrayToReadableStream(parts),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}
