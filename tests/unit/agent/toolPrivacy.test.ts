import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { privateToolResults } from '../../../src/main/llm/toolPrivacy';
import type { LanguageModelV4Prompt } from '@ai-sdk/provider';
import { MainLLMService } from '../../../src/main/llmService';
import { createTestLLMModel } from '../../../src/main/testLLMTransport';

const HELD = 'opaque-session-credential-4821';
const SHAPED = 'sk-synthetic-credential-491827';

/** Inspect what the real SDK sends in its second model call, after executing a tool. */
async function sdkRoundTrip(execute: () => unknown, toModelOutput?: Tool['toModelOutput']) {
  const service = new MainLLMService();
  service.setConfig({ provider: 'test', model: 'test-fixture' });
  service.setSessionKey('openai', HELD);
  const prompts: LanguageModelV4Prompt[] = [];
  const model = createTestLLMModel();
  vi.spyOn(service, 'getModel').mockReturnValue({
    ...model,
    doStream: async (options) => {
      prompts.push(options.prompt);
      return model.doStream(options);
    },
  });
  const tools = {
    addNode: { description: 'Read fixture data', parameters: { type: 'object', properties: {} }, execute, ...(toModelOutput ? { toModelOutput } : {}) },
    annotateNode: { description: 'Finish fixture', parameters: { type: 'object', properties: {} }, execute: () => ({ success: true }) },
  };
  const chunks = [];
  for await (const chunk of service.streamChatWithTools([{ role: 'user', content: 'fixture' }], tools)) chunks.push(chunk);
  expect(prompts.length).toBeGreaterThanOrEqual(2);
  const outputs = prompts[1].flatMap((message) => Array.isArray(message.content)
    ? message.content.filter((part) => part.type === 'tool-result').map((part) => part.output)
    : []);
  expect(outputs).toHaveLength(1);
  return { output: outputs[0], chunks, tools };
}

describe('SDK tool result privacy boundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('redacts held and secret-shaped strings recursively before the next model call, preserving JSON types', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const raw = {
      success: true, nodeId: 'fixture-node', count: 37, ratio: 1.25, optional: null,
      nested: [{ text: `ordinary prose ${HELD}`, values: [SHAPED, false, 0, null] }],
    };
    const execute = vi.fn(() => Promise.resolve(raw));
    const { output, chunks, tools } = await sdkRoundTrip(execute);
    expect(output).toEqual({ type: 'json', value: {
      success: true, nodeId: 'fixture-node', count: 37, ratio: 1.25, optional: null,
      nested: [{ text: 'ordinary prose [redacted]', values: ['[redacted]', false, 0, null] }],
    } });
    expect(JSON.stringify(chunks.filter((part) => part.type === 'tool-result'))).not.toContain(HELD);
    expect(raw.nested[0].text).toContain(HELD);
    expect(tools.addNode.execute).toBe(execute);
  });

  it('keeps streamed preliminary and final results private', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { output, chunks } = await sdkRoundTrip(async function* () {
      yield { success: true, nodeId: 'fixture-node', status: HELD };
      yield { success: true, nodeId: 'fixture-node', count: 5, status: SHAPED };
    });
    expect(output).toEqual({ type: 'json', value: { success: true, nodeId: 'fixture-node', count: 5, status: '[redacted]' } });
    const results = chunks.filter((part) => part.type === 'tool-result');
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(results)).not.toContain(HELD);
    expect(JSON.stringify(results)).not.toContain(SHAPED);
  });

  it('redacts custom SDK output conversion and retains provider tool metadata', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { output } = await sdkRoundTrip(() => ({ success: true, nodeId: 'fixture-node' }),
      () => ({ type: 'json', value: { content: HELD, count: 4 } }));
    expect(output).toEqual({ type: 'json', value: { content: '[redacted]', count: 4 } });
    const providerTool: Tool = { type: 'provider', id: 'provider.search', args: { maxUses: 5 } };
    const wrapped = privateToolResults({ search: providerTool }, (text) => text);
    expect(wrapped.search).toBe(providerTool);
  });

  it.each(['sync', 'async', 'stream'] as const)('redacts a %s tool error before the SDK sends it back to the model', async (kind) => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fail = () => { throw new Error(`Read failed: ${HELD}; ${SHAPED}`); };
    const execute = kind === 'async' ? async () => fail()
      : kind === 'stream' ? async function* () { yield fail(); }
        : fail;
    const { output } = await sdkRoundTrip(execute);
    expect(output).toEqual({ type: 'error-text', value: 'Error: Read failed: [redacted]; [redacted]' });
  });
});
