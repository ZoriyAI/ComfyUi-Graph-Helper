import { LanguageModelV4, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { convertArrayToReadableStream } from '@ai-sdk/provider-utils/test';

/**
 * TEST-ONLY deterministic LLM transport using official AI SDK test utilities
 * Simulates tool calling: addNode -> capture ID -> annotateNode with that ID -> text completion
 */

export function createTestLLMModel(): LanguageModelV4 {
  let capturedNodeId: string | null = null;

  return {
    specificationVersion: 'v4' as const,
    provider: 'test',
    modelId: 'test-fixture',
    supportedUrls: {},

    async doGenerate() {
      throw new Error('Use doStream for test transport');
    },

    async doStream(options) {
      console.log('[TestLLM] Starting test stream');

      const parts: LanguageModelV4StreamPart[] = [];

      // Step 1: addNode tool call
      parts.push({
        type: 'tool-call',
        toolCallId: 'call-add-node',
        toolName: 'addNode',
        input: JSON.stringify({ nodeType: 'TestNode', title: 'AI Test Node', x: 200, y: 200 }),
      });

      // Execute addNode and capture result
      const addNodeTool = (options as any).tools?.addNode;
      if (addNodeTool?.execute) {
        const addNodeResult = await addNodeTool.execute({
          nodeType: 'TestNode',
          title: 'AI Test Node',
          x: 200,
          y: 200,
        });
        console.log('[TestLLM] addNode result:', addNodeResult);

        // Capture nodeId from result
        if (addNodeResult.success && addNodeResult.nodeId) {
          capturedNodeId = addNodeResult.nodeId;
          console.log('[TestLLM] Captured nodeId:', capturedNodeId);
        }

        parts.push({
          type: 'tool-result',
          toolCallId: 'call-add-node',
          toolName: 'addNode',
          result: addNodeResult,
        });
      }

      // Step 2: annotateNode tool call with captured ID
      if (capturedNodeId) {
        parts.push({
          type: 'tool-call',
          toolCallId: 'call-annotate',
          toolName: 'annotateNode',
          input: JSON.stringify({ nodeId: capturedNodeId, annotation: 'AI added annotation' }),
        });

        const annotateTool = (options as any).tools?.annotateNode;
        if (annotateTool?.execute) {
          const annotateResult = await annotateTool.execute({
            nodeId: capturedNodeId,
            annotation: 'AI added annotation',
          });
          console.log('[TestLLM] annotateNode result:', annotateResult);

          parts.push({
            type: 'tool-result',
            toolCallId: 'call-annotate',
            toolName: 'annotateNode',
            result: annotateResult,
          });
        }
      }

      // Step 3: Text completion
      const textId = 'text-1';
      parts.push({
        type: 'text-start',
        id: textId,
      });

      const text = 'I have added a TestNode and annotated it.';
      for (const char of text) {
        parts.push({
          type: 'text-delta',
          id: textId,
          delta: char,
        });
      }

      parts.push({
        type: 'text-end',
        id: textId,
      });

      // Step 4: Finish
      parts.push({
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 20, text: 20, reasoning: 0 },
        },
      });

      console.log('[TestLLM] Stream contains', parts.length, 'parts');

      // Use official SDK helper to convert array to ReadableStream
      return {
        stream: convertArrayToReadableStream(parts),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}
