import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonSchema, type Tool } from 'ai';
import type { FileData } from '@ai-sdk/provider-utils';
import { privateToolResults } from '../../../src/main/llm/toolPrivacy';
import type { JSONValue, LanguageModelV4Prompt } from '@ai-sdk/provider';
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
    supportedUrls: { 'image/png': [/^https:\/\/files\.example\.test\//] },
    doStream: async (options: Parameters<typeof model.doStream>[0]) => {
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

  it.each(['execute', 'conversion'])('redacts opaque keyed credentials in nested %s results before the next request', async (boundary) => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const raw = { success: true, nodeId: 'fixture-node', nested: [
      { api_key: 'opaque-unheld-credential-491827', password: 'ordinary-password-value', note: 'useful description', count: 9, enabled: false, optional: null },
    ] };
    const { output } = boundary === 'execute'
      ? await sdkRoundTrip(() => raw)
      : await sdkRoundTrip(() => ({ success: true, nodeId: 'fixture-node' }), () => ({ type: 'json', value: raw }));
    expect(output).toEqual({ type: 'json', value: { ...raw, nested: [
      { api_key: '[redacted]', password: '[redacted]', note: 'useful description', count: 9, enabled: false, optional: null },
    ] } });
    expect(raw.nested[0].api_key).toBe('opaque-unheld-credential-491827');
  });

  it.each([
    ['execute', 'root'], ['execute', 'nested'], ['conversion', 'root'], ['conversion', 'nested'],
  ])('sanitizes enumerable class fields at %s/%s before the second request', async (boundary, nesting) => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    class ToolReply {
      success = true;
      nodeId = 'fixture-node';
      text = HELD;
      api_key = 'opaque-unheld-class-credential';
      count = 3;
      enabled = false;
      optional = null;
    }
    const reply = new ToolReply();
    const safe = { success: true, nodeId: 'fixture-node', text: '[redacted]', api_key: '[redacted]', count: 3, enabled: false, optional: null };
    const value = nesting === 'nested' ? { result: reply } : reply;
    const expected = nesting === 'nested' ? { result: safe } : safe;
    const { output, chunks } = boundary === 'execute'
      ? await sdkRoundTrip(() => value)
      // A class instance is not JSON by type, but a tool's conversion can hand one over at run time: that is the case under test.
      : await sdkRoundTrip(() => ({ success: true, nodeId: 'fixture-node' }), () => ({ type: 'json', value: value as unknown as JSONValue }));
    expect(output).toEqual({ type: 'json', value: expected });
    expect(JSON.stringify(chunks.filter((part) => part.type === 'tool-result'))).not.toContain(HELD);
    expect(reply.text).toBe(HELD);
    expect(reply).toBeInstanceOf(ToolReply);
  });

  const bytes = [137, 80, 78, 71];
  it.each([
    ['Uint8Array', { type: 'data', data: new Uint8Array(bytes) }],
    ['ArrayBuffer', { type: 'data', data: new Uint8Array(bytes).buffer }],
    ['Buffer', { type: 'data', data: Buffer.from(bytes) }],
    ['URL', { type: 'url', url: new URL('https://files.example.test/image.png') }],
  ] satisfies Array<[string, FileData]>)('preserves valid SDK %s file data through the second model request', async (kind, data) => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { output } = await sdkRoundTrip(() => ({ success: true, nodeId: 'fixture-node' }), () => ({
      type: 'content', value: [{ type: 'file', mediaType: 'image/png', data }],
    }));
    expect(output).toEqual({ type: 'content', value: [{
      type: 'file', mediaType: 'image/png', data: kind === 'URL' || kind === 'Buffer' ? data : { type: 'data', data: new Uint8Array(bytes) },
    }] });
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
    const providerTool: Tool = { type: 'provider', id: 'provider.search', args: { maxUses: 5 }, inputSchema: jsonSchema({ type: 'object', properties: {} }), isProviderExecuted: true };
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
