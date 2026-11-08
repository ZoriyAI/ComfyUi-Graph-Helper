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

function latestUserText(prompt: LanguageModelV4Prompt | undefined): string {
  let text = '';
  for (const message of prompt ?? []) {
    if (message.role !== 'user') continue;
    if (typeof message.content === 'string') {
      text = message.content;
      continue;
    }
    if (!Array.isArray(message.content)) continue;
    text = message.content.map((part) => (part && part.type === 'text' ? part.text : '')).join('');
  }
  return text;
}

function toolCall(id: string, name: string, input: unknown): LanguageModelV4StreamPart {
  return { type: 'tool-call', toolCallId: id, toolName: name, input: JSON.stringify(input) };
}

function textParts(message: string): LanguageModelV4StreamPart[] {
  const textId = 'text-process';
  return [
    { type: 'text-start', id: textId },
    { type: 'text-delta', id: textId, delta: message },
    { type: 'text-end', id: textId },
    finish('stop'),
  ];
}

/** TEST fixture path for the prerelease journey. It is not a live model. */
function processFixtureParts(prompt: LanguageModelV4Prompt | undefined): LanguageModelV4StreamPart[] {
  const results = collectToolResults(prompt);
  const addNode = results.find((result) => result.toolName === 'addNode');
  const docs = results.find((result) => result.toolName === 'setComponentDocumentation');
  const process = results.find((result) => result.toolName === 'setProcess');
  if (!addNode) {
    return [
      toolCall('call-add-node', 'addNode', { nodeType: 'TestNode', title: 'Fixture step', x: 120, y: 120 }),
      finish('tool-calls'),
    ];
  }
  const nodeId = nodeIdFrom(addNode.value);
  if (!nodeId) return textParts('addNode finished without a node id.');
  if (!docs) {
    return [
      toolCall('call-docs', 'setComponentDocumentation', {
        ownerKind: 'node',
        ownerId: nodeId,
        purpose: 'Fixture node purpose',
        usage: 'Connect it in Comfy after export.',
      }),
      finish('tool-calls'),
    ];
  }
  if (!process) {
    return [
      toolCall('call-process', 'setProcess', {
        title: 'Fixture process',
        notes: 'The TEST fixture stored this note. It is not a live model.',
      }),
      finish('tool-calls'),
    ];
  }
  return textParts('TEST fixture only: I added a node, stored what it is for, and named the process. Export the workflow and run it in your ComfyUI.');
}

/** TEST fixture for a loader whose parameter must survive export. It is not a live model. */
function loaderFixtureParts(prompt: LanguageModelV4Prompt | undefined): LanguageModelV4StreamPart[] {
  const results = collectToolResults(prompt);
  const addNode = results.find((result) => result.toolName === 'addNode');
  const docs = results.find((result) => result.toolName === 'setComponentDocumentation');
  const process = results.find((result) => result.toolName === 'setProcess');
  if (!addNode) {
    return [
      toolCall('call-add-loader', 'addNode', {
        nodeType: 'CheckpointLoaderSimple',
        title: 'Portrait loader',
        x: 80,
        y: 80,
        parameters: { ckpt_name: 'portrait.safetensors' },
      }),
      finish('tool-calls'),
    ];
  }
  const nodeId = nodeIdFrom(addNode.value);
  if (!nodeId) return textParts('addNode finished without a node id.');
  if (!docs) {
    return [
      toolCall('call-docs-loader', 'setComponentDocumentation', {
        ownerKind: 'node',
        ownerId: nodeId,
        purpose: 'Loads the portrait checkpoint',
        usage: 'Connect MODEL to the sampler.',
      }),
      finish('tool-calls'),
    ];
  }
  if (!process) {
    return [
      toolCall('call-process-loader', 'setProcess', {
        title: 'Portrait process',
        notes: 'Keep the loader.',
      }),
      finish('tool-calls'),
    ];
  }
  return textParts('TEST fixture only: the loader parameter is in the export. Run that workflow in your ComfyUI.');
}

/** Reads `success` and `error` from a tool result value without trusting its shape. */
function outcomeOf(value: unknown): { success: boolean; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { success: false, error: 'no result' };
  const record = value as { success?: unknown; error?: unknown };
  return { success: record.success !== false, error: typeof record.error === 'string' ? record.error : '' };
}

/**
 * TEST fixture for one main-side tool call followed by a short completion. It is not a live model.
 * Keyed by user text so the older scenarios above keep their exact behaviour.
 */
function singleToolFixtureParts(
  prompt: LanguageModelV4Prompt | undefined,
  call: { id: string; name: string; input: unknown },
  done: string,
): LanguageModelV4StreamPart[] {
  const result = collectToolResults(prompt).find((item) => item.toolName === call.name);
  if (!result) return [toolCall(call.id, call.name, call.input), finish('tool-calls')];
  const outcome = outcomeOf(result.value);
  if (!outcome.success) return textParts(`TEST fixture only: ${call.name} failed: ${outcome.error}`);
  return textParts(done);
}

const SCRIPTED: Array<{ match: RegExp; call: { id: string; name: string; input: unknown }; done: string }> = [
  {
    match: /propose a sampler/i,
    call: {
      id: 'call-propose-sampler',
      name: 'proposeNode',
      input: {
        nodeType: 'KSampler',
        title: 'Sampler',
        x: 420,
        y: 200,
        note: 'The sampler turns noise into an image using the model and both prompts.',
      },
    },
    done: 'TEST fixture only: I put a KSampler on the canvas as a ghost. Accept it if you want it in the graph.',
  },
  {
    match: /explain this/i,
    call: {
      id: 'call-explain',
      name: 'explain',
      input: {
        owner: { kind: 'nodeClass', id: 'KSampler', classType: 'KSampler' },
        aspect: 'what',
        text: 'KSampler denoises a latent step by step, guided by the model and the conditioning.',
        provenance: 'inference',
      },
    },
    done: 'TEST fixture only: I saved a short explanation to KSampler. It is an inference, not a fact from your catalog.',
  },
];

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
      if (latestUserText(prompt).includes('Build the process fixture')) {
        const parts = processFixtureParts(prompt);
        return {
          stream: convertArrayToReadableStream(parts),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
      if (latestUserText(prompt).includes('Build the loader fixture')) {
        return {
          stream: convertArrayToReadableStream(loaderFixtureParts(prompt)),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
      const scripted = SCRIPTED.find((entry) => entry.match.test(latestUserText(prompt)));
      if (scripted) {
        return {
          stream: convertArrayToReadableStream(singleToolFixtureParts(prompt, scripted.call, scripted.done)),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
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
