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
  call: { id: string; name: string; input: unknown | ((text: string) => unknown) },
  done: string,
): LanguageModelV4StreamPart[] {
  const result = collectToolResults(prompt).find((item) => item.toolName === call.name);
  const input = typeof call.input === 'function' ? (call.input as (text: string) => unknown)(latestUserText(prompt)) : call.input;
  if (!result) return [toolCall(call.id, call.name, input), finish('tool-calls')];
  const outcome = outcomeOf(result.value);
  if (!outcome.success) return textParts(`TEST fixture only: ${call.name} failed: ${outcome.error}`);
  return textParts(done);
}

const SCRIPTED: Array<{ match: RegExp; call: { id: string; name: string; input: unknown | ((text: string) => unknown) }; done: string }> = [
  {
    // Library ▸ "Ask about this model" (en and ru wording): a read-only catalog lookup, valid in Ask and Build turns.
    match: /(?:What is the model|Что это за модель) \S/i,
    call: {
      id: 'call-find-model',
      name: 'findInstalledModels',
      input: (text: string) => ({ query: (/(?:model|модель) (\S+?)(?:,|\s|$)/i.exec(text)?.[1] ?? '').slice(0, 200), limit: 5 }),
    },
    done: 'TEST fixture only: I looked this model up in your synced catalog. Its base family and trigger words are in the tool result.',
  },
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
    // "explain node 4 (KSampler)": an explanation owned by one node, not its class.
    match: /explain node (\S+) \((\w+)\)/i,
    call: {
      id: 'call-explain-node',
      name: 'explain',
      input: (text: string) => {
        const found = /explain node (\S+) \((\w+)\)/i.exec(text);
        return {
          owner: { kind: 'node', id: found?.[1] ?? '', classType: found?.[2] ?? '' },
          aspect: 'why',
          text: 'This sampler renders prompt A; its latent goes to Decode.',
          provenance: 'inference',
        };
      },
    },
    done: 'TEST fixture only: I saved why this node is here. It is an inference about this graph.',
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

/** One step of the scripted text-to-image build: a tool call that may refer to nodes added earlier by name. */
interface BuildScriptStep {
  name: 'addNode' | 'connectNodes';
  /** For addNode: the name later steps use for the node it adds. */
  as?: string;
  input: (ids: Record<string, string>) => Record<string, unknown>;
}

const connect = (from: string, out: string, to: string, input: string, why: string): BuildScriptStep => ({
  name: 'connectNodes',
  input: (ids) => ({ sourceNodeId: ids[from], sourceHandle: out, targetNodeId: ids[to], targetHandle: input, why }),
});

/** TEST fixture: a text-to-image graph built one step at a time, each step with its why. It is not a live model. */
const TEXT_TO_IMAGE: BuildScriptStep[] = [
  { name: 'addNode', as: 'loader', input: () => ({ nodeType: 'CheckpointLoaderSimple', title: 'Load Checkpoint', x: 0, y: 220, why: 'Everything starts with a checkpoint: it brings the model, the text encoder (CLIP) and the VAE in one file.' }) },
  { name: 'addNode', as: 'positive', input: () => ({ nodeType: 'CLIPTextEncode', title: 'Positive prompt', x: 380, y: 40, why: 'This turns the words you want in the picture into conditioning the sampler can follow.' }) },
  { name: 'addNode', as: 'negative', input: () => ({ nodeType: 'CLIPTextEncode', title: 'Negative prompt', x: 380, y: 300, why: 'A second encoder for what you do not want, so the sampler can steer away from it.' }) },
  { name: 'addNode', as: 'latent', input: () => ({ nodeType: 'EmptyLatentImage', title: 'Empty Latent Image', x: 380, y: 560, why: 'The blank canvas in latent space: its width and height decide the size of the picture.' }) },
  { name: 'addNode', as: 'sampler', input: () => ({ nodeType: 'KSampler', title: 'KSampler', x: 780, y: 220, why: 'The sampler removes noise step by step, guided by the model and both prompts. This is where the image is made.' }) },
  connect('loader', 'out-0', 'sampler', 'in-0', 'The sampler needs the model weights to know how to denoise.'),
  connect('loader', 'out-1', 'positive', 'in-0', 'The positive prompt is read by the CLIP that came with the checkpoint.'),
  connect('loader', 'out-1', 'negative', 'in-0', 'The negative prompt uses the same CLIP, so both prompts speak the same language.'),
  connect('positive', 'out-0', 'sampler', 'in-1', 'What you want goes into the sampler\'s positive input.'),
  connect('negative', 'out-0', 'sampler', 'in-2', 'What you do not want goes into the negative input.'),
  connect('latent', 'out-0', 'sampler', 'in-3', 'The empty latent is the noise the sampler starts from.'),
  { name: 'addNode', as: 'decode', input: () => ({ nodeType: 'VAEDecode', title: 'VAE Decode', x: 1160, y: 220, why: 'The sampler works in latent space; the VAE decoder turns that latent into real pixels.' }) },
  connect('sampler', 'out-0', 'decode', 'in-0', 'The finished latent from the sampler is what gets decoded.'),
  connect('loader', 'out-2', 'decode', 'in-1', 'Decoding needs the VAE from the same checkpoint.'),
  { name: 'addNode', as: 'save', input: () => ({ nodeType: 'SaveImage', title: 'Save Image', x: 1500, y: 220, why: 'Save Image writes the picture to ComfyUI\'s output folder when you run the workflow there.' }) },
  connect('decode', 'out-0', 'save', 'in-0', 'The decoded image goes to Save Image.'),
];

function textToImageParts(prompt: LanguageModelV4Prompt | undefined): LanguageModelV4StreamPart[] {
  const results = collectToolResults(prompt).filter((result) => result.toolName === 'addNode' || result.toolName === 'connectNodes');
  const ids: Record<string, string> = {};
  for (let index = 0; index < results.length; index += 1) {
    const step = TEXT_TO_IMAGE[index];
    const outcome = outcomeOf(results[index].value);
    if (!outcome.success) return textParts(`TEST fixture only: step ${index + 1} failed: ${outcome.error}`);
    if (step?.as) {
      const nodeId = nodeIdFrom(results[index].value);
      if (!nodeId) return textParts('addNode finished without a node id.');
      ids[step.as] = nodeId;
    }
  }
  const next = TEXT_TO_IMAGE[results.length];
  if (!next) {
    return textParts('TEST fixture only: I built a text-to-image graph step by step: checkpoint, two prompts, an empty latent, the sampler, the decoder and Save Image. Each node carries why it is there. Export it and run it in your ComfyUI.');
  }
  return [toolCall(`call-t2i-${results.length + 1}`, next.name, next.input(ids)), finish('tool-calls')];
}

/** Steps of the long-chain scenario: more than the default step checkpoint (60), so the turn pauses once. */
export const LONG_CHAIN_STEPS = 70;
const LONG_CHAIN = /build a long chain|построй длинную цепочку/i;

function anyUserText(prompt: LanguageModelV4Prompt | undefined, pattern: RegExp): boolean {
  for (const message of prompt ?? []) {
    if (message.role !== 'user') continue;
    const text = typeof message.content === 'string'
      ? message.content
      : Array.isArray(message.content) ? message.content.map((part) => (part && part.type === 'text' ? part.text : '')).join('') : '';
    if (pattern.test(text)) return true;
  }
  return false;
}

function systemText(prompt: LanguageModelV4Prompt | undefined): string {
  return (prompt ?? []).filter((message) => message.role === 'system').map((message) => (typeof message.content === 'string' ? message.content : '')).join('\n');
}

/**
 * TEST fixture "build a long chain": 70 addNode steps titled "Chain step N", one per model step. Progress is read
 * from the graph in the system prompt (nodes built by earlier turns) plus this turn's addNode results, so a
 * Continue after the step checkpoint picks up where the previous turn paused. It is not a live model.
 */
function longChainParts(prompt: LanguageModelV4Prompt | undefined): LanguageModelV4StreamPart[] {
  const built = [...systemText(prompt).matchAll(/"Chain step (\d+)"/g)].map((match) => Number(match[1]));
  const before = built.length > 0 ? Math.max(...built) : 0;
  const results = collectToolResults(prompt).filter((result) => result.toolName === 'addNode');
  const failed = results.find((result) => !outcomeOf(result.value).success);
  if (failed) return textParts(`TEST fixture only: a chain step failed: ${outcomeOf(failed.value).error}`);
  const next = before + results.length + 1;
  if (next > LONG_CHAIN_STEPS) return textParts(`TEST fixture only: the long chain is complete with ${LONG_CHAIN_STEPS} steps.`);
  return [
    toolCall(`call-chain-${next}`, 'addNode', { nodeType: 'TestNode', title: `Chain step ${next}`, x: 120 + (next % 10) * 240, y: 120 + Math.floor(next / 10) * 160, why: `Step ${next} of the long chain.` }),
    finish('tool-calls'),
  ];
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
      const latest = latestUserText(prompt);
      if (LONG_CHAIN.test(latest) || (/^\s*(continue|продолжай)\s*$/i.test(latest) && anyUserText(prompt, LONG_CHAIN))) {
        return {
          stream: convertArrayToReadableStream(longChainParts(prompt)),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
      if (/build a text to image graph/i.test(latestUserText(prompt))) {
        return {
          stream: convertArrayToReadableStream(textToImageParts(prompt)),
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
