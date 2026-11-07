/**
 * TEST-ONLY injectable deterministic LLM transport
 * Simulates AI SDK tool calling with predictable addNode -> annotateNode sequence
 */

interface TestScenario {
  name: string;
  steps: Array<{
    type: 'text' | 'tool-call';
    text?: string;
    toolName?: string;
    toolArgs?: any;
  }>;
}

const TEST_SCENARIO: TestScenario = {
  name: 'Add node and annotate',
  steps: [
    {
      type: 'tool-call',
      toolName: 'addNode',
      toolArgs: { nodeType: 'TestNode', title: 'Test Node 1', x: 100, y: 100 },
    },
    {
      type: 'tool-call',
      toolName: 'annotateNode',
      toolArgs: { nodeId: 'will-be-replaced-with-actual-node-id', annotation: 'Test annotation' },
    },
    {
      type: 'text',
      text: 'I have added a TestNode and annotated it.',
    },
  ],
};

export class TestLLMModel {
  readonly specificationVersion = 'v4';
  readonly provider = 'test';
  readonly modelId = 'test-fixture';
  readonly defaultObjectGenerationMode = 'json' as const;

  private lastNodeId: string | null = null;

  async doGenerate(): Promise<any> {
    throw new Error('Use doStream for test transport');
  }

  async doStream(options: any): Promise<any> {
    const self = this;
    let stepIndex = 0;

    return {
      stream: (async function* () {
        for (const step of TEST_SCENARIO.steps) {
          if (step.type === 'tool-call') {
            // Replace placeholder node ID if needed
            let args = step.toolArgs;
            if (step.toolName === 'annotateNode' && self.lastNodeId) {
              args = { ...args, nodeId: self.lastNodeId };
            }

            const toolCallId = `call-${stepIndex++}`;
            yield {
              type: 'tool-call' as const,
              toolCallType: 'function' as const,
              toolCallId,
              toolName: step.toolName!,
              args: JSON.stringify(args),
            };

            // Simulate tool result
            const toolResult = options.tools?.[step.toolName!];
            if (toolResult?.execute) {
              const result = await toolResult.execute(args);
              console.log(`[TestLLM] Tool ${step.toolName} executed:`, result);

              // Capture node ID from addNode
              if (step.toolName === 'addNode' && result.success) {
                // Extract from graph state (will be set by action executor)
                // For now, we'll use a mock pattern
                self.lastNodeId = `test-node-${Date.now()}`;
              }

              yield {
                type: 'tool-result' as const,
                toolCallType: 'function' as const,
                toolCallId,
                toolName: step.toolName!,
                args: JSON.stringify(args),
                result,
              };
            }
          } else if (step.type === 'text') {
            for (const char of step.text!) {
              yield {
                type: 'text-delta' as const,
                textDelta: char,
              };
              await new Promise((r) => setTimeout(r, 5));
            }
          }
        }

        yield {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: { promptTokens: 10, completionTokens: 20 },
        };
      })(),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    };
  }
}

export function createTestLLMModel(): any {
  return new TestLLMModel();
}
