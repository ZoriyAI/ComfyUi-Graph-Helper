import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import { tool } from 'ai';
import { MainLLMService } from '../../src/main/llmService';
import { configureModelTrace, listTurnTraces, readTurnTrace, turnReport } from '../../src/main/trace/modelTrace';

/**
 * The model conversation log as a real turn fills it: the service sends through the turn's recording fetch, so
 * the record holds what went to the server and what came back, and never what travelled in the headers.
 */

const SECRET_HEADER = 'Bearer local';
let dir = '';

function setup(enabled = true): void {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-trace-hook-'));
  configureModelTrace({ dir, redact: (text) => text, enabled: () => enabled });
}

function sse(lines: unknown[]): Response {
  const body = `${lines.map((line) => `data: ${typeof line === 'string' ? line : JSON.stringify(line)}\n\n`).join('')}`;
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream', 'x-request-id': 'req-77', 'set-cookie': 'session=abc' } });
}

function chunk(delta: Record<string, unknown>, finish: string | null = null, usage?: Record<string, number>): unknown {
  return {
    id: 'chatcmpl-1',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'qwen-fixture:q4',
    choices: [{ index: 0, delta, finish_reason: finish }],
    ...(usage ? { usage } : {}),
  };
}

async function drain(stream: AsyncGenerator<{ type: string; content: any }>): Promise<Array<{ type: string; content: any }>> {
  const chunks: Array<{ type: string; content: any }> = [];
  for await (const part of stream) chunks.push(part);
  return chunks;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = '';
  // Later test files must not write turns into a removed folder.
  configureModelTrace({ dir: path.join(os.tmpdir(), 'model-trace-off'), redact: (text) => text, enabled: () => false });
});

describe('a turn as the model conversation log records it', () => {
  it('records the request and the answer of a local model, with a tool round trip', async () => {
    setup();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const requests: Array<{ url: string; authorization: string | null; body: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      requests.push({ url: String(input), authorization: headers.get('authorization'), body: String(init?.body ?? '') });
      if (requests.length === 1) {
        return sse([
          chunk({ role: 'assistant', content: null, tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'lookUp', arguments: '{"what":"KSampler"}' } }] }),
          chunk({}, 'tool_calls', { prompt_tokens: 900, completion_tokens: 12, total_tokens: 912 }),
          '[DONE]',
        ]);
      }
      return sse([
        chunk({ role: 'assistant', content: 'KSampler убирает шум.' }),
        chunk({}, 'stop', { prompt_tokens: 960, completion_tokens: 9, total_tokens: 969 }),
        '[DONE]',
      ]);
    }));

    const service = new MainLLMService();
    service.setConfig({ provider: 'local', model: 'qwen-fixture', baseURL: 'http://127.0.0.1:21434/v1' });
    const tools = {
      lookUp: tool({
        description: 'Reads a node class.',
        inputSchema: z.object({ what: z.string() }),
        execute: async ({ what }) => ({ success: true, name: what, inputs: 7 }),
      }),
    };
    const chunks = await drain(service.streamChatWithTools(
      [{ role: 'system', content: 'You are a helper.' }, { role: 'user', content: 'Что делает KSampler?' }],
      tools,
      { trace: { intent: 'ask', language: 'ru', runId: 'run-1', app: '0.3.0' } },
    ));

    // The chat learns which record is this turn's, before anything else.
    expect(chunks[0].type).toBe('trace');
    const id = String(chunks[0].content.id);
    expect(chunks.some((part) => part.type === 'text-delta')).toBe(true);
    expect(requests).toHaveLength(2);
    expect(requests[0].authorization).toBe(SECRET_HEADER);

    const events = readTurnTrace(id)!;
    const types = events.map((event) => event.type);
    expect(types[0]).toBe('turn-start');
    expect(types).toContain('prompt');
    expect(types.filter((type) => type === 'wire-request')).toHaveLength(2);
    expect(types.filter((type) => type === 'wire-response')).toHaveLength(2);
    expect(types.filter((type) => type === 'step-finish')).toHaveLength(2);
    expect(types[types.length - 1]).toBe('turn-end');

    const start = events[0];
    expect(start).toMatchObject({ provider: 'local', model: 'qwen-fixture', baseUrl: 'http://127.0.0.1:21434', intent: 'ask', language: 'ru', runId: 'run-1', app: '0.3.0' });

    const wireRequest = events.find((event) => event.type === 'wire-request')!;
    expect(wireRequest.url).toBe('http://127.0.0.1:21434/v1/chat/completions');
    // The body is exactly what the server received: the system text, the question and the tool's schema.
    expect(String(wireRequest.body)).toBe(requests[0].body);
    expect(String(wireRequest.body)).toContain('Что делает KSampler?');
    expect(String(wireRequest.body)).toContain('"lookUp"');

    const wireResponse = events.find((event) => event.type === 'wire-response')!;
    expect(wireResponse.status).toBe(200);
    expect(String(wireResponse.body)).toContain('tool_calls');
    expect(wireResponse.headers).toEqual({ 'content-type': 'text/event-stream', 'x-request-id': 'req-77' });

    const call = events.find((event) => event.type === 'tool-call')!;
    expect(call).toMatchObject({ name: 'lookUp', input: { what: 'KSampler' } });
    const result = events.find((event) => event.type === 'tool-result')!;
    expect(result).toMatchObject({ name: 'lookUp', ok: true, output: { success: true, name: 'KSampler', inputs: 7 } });
    expect(events.find((event) => event.type === 'text')).toMatchObject({ step: 2, text: 'KSampler убирает шум.' });

    const end = events[events.length - 1];
    expect(end).toMatchObject({ outcome: 'ok', steps: 2, toolCalls: 1, inputTokens: 1860, outputTokens: 21, error: null });

    // What travels in the headers is nowhere in the file.
    const raw = fs.readFileSync(path.join(dir, 'model', `turn-${id}.jsonl`), 'utf8');
    expect(raw).not.toContain(SECRET_HEADER);
    expect(raw).not.toContain('session=abc');
    expect(raw.toLowerCase()).not.toContain('authorization');

    const summary = listTurnTraces(10)[0];
    expect(summary).toMatchObject({ id, outcome: 'ok', steps: 2, toolCalls: 1, question: 'Что делает KSampler?' });
    const report = turnReport(events);
    expect(report).toContain('lookUp');
    expect(report).toContain('KSampler убирает шум.');
  });

  it('records the server\'s own words when the model refuses the request', async () => {
    setup();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { message: 'registry.ollama.ai/library/gemma3:27b does not support tools', type: 'api_error' } }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    )));
    const service = new MainLLMService();
    service.setConfig({ provider: 'local', model: 'gemma3:27b', baseURL: 'http://127.0.0.1:21434/v1' });
    const chunks = await drain(service.streamChatWithTools([{ role: 'user', content: 'собери граф' }], {})).catch((error) => error);
    const turn = listTurnTraces(10)[0];
    expect(turn.outcome).toBe('error');
    expect(turn.error).toContain('does not support tools');
    const events = readTurnTrace(turn.id)!;
    const response = events.find((event) => event.type === 'wire-response')!;
    expect(response.status).toBe(400);
    expect(String(response.body)).toContain('does not support tools');
    expect(turnReport(events)).toContain('does not support tools');
    // The stream reported it as an error part or threw: either way the chat was told.
    const told = chunks instanceof Error || (Array.isArray(chunks) && chunks.some((part) => part.type === 'error'));
    expect(told).toBe(true);
  });

  it('records a send that never left: no model is set up', async () => {
    setup();
    const service = new MainLLMService();
    const stream = service.streamChatWithTools([{ role: 'user', content: 'привет' }], {});
    const first = await stream.next();
    expect(first.value?.type).toBe('trace');
    await expect(stream.next()).rejects.toThrow('Model not configured');
    const turn = listTurnTraces(10)[0];
    expect(turn).toMatchObject({ outcome: 'error', error: 'Model not configured', steps: 0, question: 'привет' });
  });

  it('closes the record when the person stops the answer', async () => {
    setup();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn(async () => sse([chunk({ role: 'assistant', content: 'Начинаю' }), chunk({ content: ' отвечать' })])));
    const service = new MainLLMService();
    service.setConfig({ provider: 'local', model: 'qwen-fixture', baseURL: 'http://127.0.0.1:21434/v1' });
    const stream = service.streamChatWithTools([{ role: 'user', content: 'расскажи' }], {}, { abortSignal: controller.signal });
    for await (const part of stream) {
      if (part.type === 'text-delta') {
        controller.abort();
        break;
      }
    }
    const turn = listTurnTraces(10)[0];
    expect(turn.outcome).toBe('cancelled');
  });

  it('writes nothing and sends no trace chunk when the log is switched off', async () => {
    setup(false);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => sse([chunk({ role: 'assistant', content: 'ок' }), chunk({}, 'stop'), '[DONE]'])));
    const service = new MainLLMService();
    service.setConfig({ provider: 'local', model: 'qwen-fixture', baseURL: 'http://127.0.0.1:21434/v1' });
    const chunks = await drain(service.streamChatWithTools([{ role: 'user', content: 'привет' }], {}));
    expect(chunks.some((part) => part.type === 'trace')).toBe(false);
    expect(listTurnTraces(10)).toEqual([]);
    expect(fs.existsSync(path.join(dir, 'model'))).toBe(false);
  });
});
