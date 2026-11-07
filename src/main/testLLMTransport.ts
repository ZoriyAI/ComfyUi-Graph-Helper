import { LanguageModelV4, LanguageModelV4Prompt, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { convertArrayToReadableStream } from '@ai-sdk/provider-utils/test';

/**
 * TEST-ONLY model. Each doStream call is one SDK step.
 * The next step is chosen from tool results the SDK places on the prompt
 * after execute() resolves. The model does not call tools itself.
 */
const COMPLETION = 'I have added a TestNode and annotated it.';

interface ToolResultRecord {
  toolName: string;
  value: unknown;
}

function collectToolResults(prompt: LanguageModelV4Prompt | undefined): ToolResultRecord[] {
  const found: ToolResultRecord[] = [];
  for (const message of prompt ?? []) {
    if (!Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (!part || part.type !== 'tool-result') continue;
      const output = 'output' in part ? part.output : undefined;
      const value = output && typeof output === 'object' && 'value' in output
        ? output.value
        : undefined;
      found.push({ toolName: part.toolName, value });
    }
  }
  return found;
}

function nodeIdFrom(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const nodeId = (value as { nodeId?: unknown }).nodeId;
  return typeof nodeId === 'string' && nodeId.length > 0 ? nodeId : null;
}

function finish(unified: 'stop' | 'tool-calls'): LanguageModelV4StreamPart {
  return {
    type: 'finish',
    finishReason: { unified, raw: unified },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 20, text: 20, reasoning: 0 },
    },
  };
}

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
      const prompt = options.prompt;
      const results = collectToolResults(prompt);
      const addNode = results.find((result) => result.toolName === 'addNode');
      const annotate = results.find((result) => result.toolName === 'annotateNode');
      const parts: LanguageModelV4StreamPart[] = [];

      console.log(
        '[TestLLM] doStream results:',
        results.map((result) => result.toolName).join(',') || '(none)'
      );

      if (!addNode) {
        parts.push({
          type: 'tool-call',
          toolCallId: 'call-add-node',
          toolName: 'addNode',
          input: JSON.stringify({ nodeType: 'TestNode', title: 'AI Test Node', x: 200, y: 200 }),
        });
        parts.push(finish('tool-calls'));
      } else if (!annotate) {
        const nodeId = nodeIdFrom(addNode.value);
        console.log('[TestLLM] addNode result nodeId:', nodeId);
        if (!nodeId) {
          const textId = 'text-missing-node';
          parts.push({ type: 'text-start', id: textId });
          parts.push({
            type: 'text-delta',
            id: textId,
            delta: 'addNode finished without a node id.',
          });
          parts.push({ type: 'text-end', id: textId });
          parts.push(finish('stop'));
        } else {
          parts.push({
            type: 'tool-call',
            toolCallId: 'call-annotate',
            toolName: 'annotateNode',
            input: JSON.stringify({ nodeId, annotation: 'AI added annotation' }),
          });
          parts.push(finish('tool-calls'));
        }
      } else {
        const textId = 'text-1';
        parts.push({ type: 'text-start', id: textId });
        for (const char of COMPLETION) {
          parts.push({ type: 'text-delta', id: textId, delta: char });
        }
        parts.push({ type: 'text-end', id: textId });
        parts.push(finish('stop'));
      }

      console.log(`[TestLLM] Returning ${parts.length} parts`);

      return {
        stream: convertArrayToReadableStream(parts),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}
