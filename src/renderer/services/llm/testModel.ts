/**
 * Deterministic test model for verifying AI+human collaboration
 * WITHOUT requiring real API keys
 * 
 * This is a FIXTURE for testing, clearly marked as such
 */

import { LanguageModelV1 } from 'ai';

export interface TestModelResponse {
  role: 'assistant';
  content: Array<{
    type: 'text' | 'tool-call';
    text?: string;
    toolCallId?: string;
    toolName?: string;
    args?: Record<string, unknown>;
  }>;
}

/**
 * Create a deterministic test model that follows a script
 * Used ONLY for testing the tool execution path
 */
export function createTestModel(
  script: TestModelResponse[]
): LanguageModelV1 {
  let scriptIndex = 0;

  return {
    specificationVersion: 'v1',
    provider: 'test-fixture',
    modelId: 'deterministic-test',
    defaultObjectGenerationMode: 'tool',

    async doGenerate(options) {
      if (scriptIndex >= script.length) {
        throw new Error('[TestModel] Script exhausted');
      }

      const response = script[scriptIndex++];
      
      const parts: any[] = [];
      let finishReason: 'stop' | 'length' | 'tool-calls' | 'error' = 'stop';

      for (const item of response.content) {
        if (item.type === 'text' && item.text) {
          parts.push({ type: 'text', text: item.text });
        } else if (item.type === 'tool-call' && item.toolCallId && item.toolName) {
          parts.push({
            type: 'tool-call',
            toolCallId: item.toolCallId,
            toolName: item.toolName,
            args: JSON.stringify(item.args || {}),
          });
          finishReason = 'tool-calls';
        }
      }

      return {
        text: response.content.find((c) => c.type === 'text')?.text || '',
        toolCalls: response.content
          .filter((c) => c.type === 'tool-call')
          .map((c) => ({
            toolCallId: c.toolCallId!,
            toolName: c.toolName!,
            args: c.args || {},
          })),
        finishReason,
        usage: { promptTokens: 10, completionTokens: 10 },
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        logprobs: undefined,
      };
    },

    async doStream(options) {
      throw new Error('[TestModel] Streaming not implemented in test fixture');
    },
  } as LanguageModelV1;
}

/**
 * Example test script: Add a KSampler node
 */
export const TEST_SCRIPT_ADD_NODE: TestModelResponse[] = [
  {
    role: 'assistant',
    content: [
      { type: 'text', text: "I'll add a KSampler node for you." },
      {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'addNode',
        args: {
          nodeType: 'KSampler',
          title: 'KSampler',
          x: 400,
          y: 200,
          parameters: { steps: 20, cfg: 7.0 },
        },
      },
    ],
  },
  {
    role: 'assistant',
    content: [
      { type: 'text', text: "I've added the KSampler node to your workflow." },
    ],
  },
];

/**
 * Test script: Multiple operations
 */
export const TEST_SCRIPT_MULTI_OP: TestModelResponse[] = [
  {
    role: 'assistant',
    content: [
      { type: 'text', text: "I'll add a checkpoint loader and connect it." },
      {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'addNode',
        args: {
          nodeType: 'CheckpointLoaderSimple',
          x: 100,
          y: 100,
        },
      },
    ],
  },
  {
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolCallId: 'call-2',
        toolName: 'getCurrentGraph',
        args: {},
      },
    ],
  },
  {
    role: 'assistant',
    content: [
      { type: 'text', text: "Now I'll connect the checkpoint to the KSampler." },
      {
        type: 'tool-call',
        toolCallId: 'call-3',
        toolName: 'connectNodes',
        args: {
          sourceNodeId: 'node-checkpoint',
          sourceOutputIndex: 0,
          targetNodeId: 'node-ksampler',
          targetInputIndex: 0,
        },
      },
    ],
  },
  {
    role: 'assistant',
    content: [
      { type: 'text', text: "Done! The checkpoint is now connected to the sampler." },
    ],
  },
];
