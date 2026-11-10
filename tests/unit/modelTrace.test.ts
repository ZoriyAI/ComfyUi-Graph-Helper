import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  clearTurnTraces, configureModelTrace, exportTurnTraces, listTurnTraces, originOf, readTurnTrace, startTurnTrace,
  traceDir, traceUsage, turnReport,
} from '../../src/main/trace/modelTrace';

const KEY = 'sk-fixture-key-1234567890abcdef';
const redact = (text: string) => text.split(KEY).join('[redacted]');

let dir = '';
let clock = 1_700_000_000_000;

function setup(overrides: Partial<Parameters<typeof configureModelTrace>[0]> = {}, enabled = true): void {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-trace-'));
  configureModelTrace({ dir, redact, enabled: () => enabled, now: () => clock, ...overrides });
}

beforeEach(() => {
  clock = 1_700_000_000_000;
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

const META = { provider: 'local', model: 'qwen3.5:9b', baseUrl: 'http://user:pw@127.0.0.1:11444/v1?x=1', intent: 'build', language: 'ru', maxSteps: 60, app: '0.3.0', platform: 'linux' };

describe('the model conversation log', () => {
  it('records a turn: prompt, steps, tool calls, results, usage and the end', async () => {
    setup();
    const trace = startTurnTrace(META);
    expect(trace).not.toBeNull();
    trace!.prompt({
      system: `You are a helper. ${KEY}`,
      messages: [{ role: 'user', content: 'хочу картинку по тексту' }],
      tools: [{ name: 'addNode', description: 'adds a node' }, { name: 'connect' }],
    });
    trace!.part({ type: 'start-step' });
    clock += 400;
    trace!.part({ type: 'text-delta', text: 'Сначала ' });
    trace!.part({ type: 'text-delta', text: 'загрузчик.' });
    trace!.part({ type: 'tool-call', toolCallId: 'c1', toolName: 'addNode', input: { nodeType: 'CheckpointLoaderSimple', why: 'нужна модель' } });
    trace!.part({ type: 'tool-result', toolCallId: 'c1', toolName: 'addNode', output: { success: true, nodeId: '1' } });
    clock += 600;
    trace!.part({ type: 'finish-step', finishReason: 'tool-calls', usage: { inputTokens: 1200, outputTokens: 40, totalTokens: 1240 }, response: { id: 'resp_1', modelId: 'qwen3.5:9b-q4_K_M' } });
    trace!.part({ type: 'start-step' });
    trace!.part({ type: 'tool-call', toolCallId: 'c2', toolName: 'connect', input: { from: '1', to: '9' } });
    trace!.part({ type: 'tool-result', toolCallId: 'c2', toolName: 'connect', output: { success: false, error: 'Node was not found.' } });
    trace!.part({ type: 'finish-step', finishReason: 'stop', usage: { inputTokens: 1300, outputTokens: 10 } });
    await trace!.finish('ok');

    const events = readTurnTrace(trace!.id)!;
    expect(events.map((event) => event.type)).toEqual([
      'turn-start', 'question', 'prompt', 'step-start', 'text', 'tool-call', 'tool-result', 'step-finish',
      'step-start', 'tool-call', 'tool-result', 'step-finish', 'turn-end',
    ]);
    // Origin only for the server; the held key never reaches the file.
    expect(events[0]).toMatchObject({ provider: 'local', model: 'qwen3.5:9b', baseUrl: 'http://127.0.0.1:11444', intent: 'build' });
    const raw = fs.readFileSync(trace!.file, 'utf8');
    expect(raw).not.toContain(KEY);
    expect(raw).not.toContain('user:pw');
    expect(events[2]).toMatchObject({ systemChars: `You are a helper. ${KEY}`.length, tools: [{ name: 'addNode', descriptionChars: 11 }, { name: 'connect', descriptionChars: 0 }] });
    expect(events[4]).toMatchObject({ step: 1, text: 'Сначала загрузчик.' });
    expect(events[5]).toMatchObject({ name: 'addNode', input: { nodeType: 'CheckpointLoaderSimple' } });
    expect(events[7]).toMatchObject({ step: 1, finishReason: 'tool-calls', usage: { input: 1200, output: 40, total: 1240 }, ms: 1000, firstTokenMs: 400, servedModel: 'qwen3.5:9b-q4_K_M' });
    expect(events[10]).toMatchObject({ ok: false });
    expect(events[12]).toMatchObject({ outcome: 'ok', steps: 2, toolCalls: 2, inputTokens: 2500, outputTokens: 50 });

    const listed = listTurnTraces();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: trace!.id, provider: 'local', model: 'qwen3.5:9b', outcome: 'ok', steps: 2, toolCalls: 2, inputTokens: 2500, question: 'хочу картинку по тексту' });
    expect(traceUsage().files).toBe(1);
  });

  it('writes nothing when the log is off or not set up', () => {
    setup({}, false);
    expect(startTurnTrace(META)).toBeNull();
    expect(fs.existsSync(path.join(dir, 'model'))).toBe(false);
  });

  it('keeps an error with the server\'s own words and marks the turn as failed', async () => {
    setup();
    const trace = startTurnTrace(META)!;
    trace.part({ type: 'start-step' });
    trace.part({ type: 'error', error: Object.assign(new Error(`registry.ollama.ai/library/qwen does not support tools ${KEY}`), { name: 'AI_APICallError', statusCode: 400, responseBody: `{"error":"does not support tools","key":"${KEY}"}` }) });
    await trace.finish('ok');
    const events = readTurnTrace(trace.id)!;
    const error = events.find((event) => event.type === 'error')!;
    expect(error).toMatchObject({ name: 'AI_APICallError', status: 400 });
    expect(String(error.message)).toContain('does not support tools');
    expect(JSON.stringify(events)).not.toContain(KEY);
    expect(events[events.length - 1]).toMatchObject({ type: 'turn-end', outcome: 'error' });
    expect(listTurnTraces()[0].outcome).toBe('error');
  });

  it('records the wire: request body and response body, never a header or a query', async () => {
    setup();
    const seen: Array<{ url: string; auth: string | null }> = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), auth: new Headers(init?.headers).get('authorization') });
      return new Response('data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream', 'x-request-id': 'req_7', 'set-cookie': 'session=secret' },
      });
    });
    const trace = startTurnTrace(META)!;
    const response = await trace.fetch('http://127.0.0.1:11444/v1/chat/completions?key=abc', {
      method: 'POST',
      headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'qwen3.5:9b', messages: [{ role: 'user', content: 'hi' }], note: KEY }),
    });
    // The caller still reads the whole body.
    expect(await response.text()).toContain('[DONE]');
    await trace.finish('ok');
    // The real request went out untouched.
    expect(seen).toEqual([{ url: 'http://127.0.0.1:11444/v1/chat/completions?key=abc', auth: `Bearer ${KEY}` }]);
    const events = readTurnTrace(trace.id)!;
    const request = events.find((event) => event.type === 'wire-request')!;
    const answer = events.find((event) => event.type === 'wire-response')!;
    expect(request).toMatchObject({ method: 'POST', url: 'http://127.0.0.1:11444/v1/chat/completions' });
    expect(String(request.body)).toContain('"model":"qwen3.5:9b"');
    expect(answer).toMatchObject({ status: 200, headers: { 'content-type': 'text/event-stream', 'x-request-id': 'req_7' } });
    expect(String(answer.body)).toContain('[DONE]');
    const raw = fs.readFileSync(trace.file, 'utf8');
    expect(raw).not.toContain(KEY);
    expect(raw).not.toContain('Bearer');
    expect(raw).not.toContain('set-cookie');
    expect(raw).not.toContain('key=abc');
  });

  it('records a network failure and rethrows it', async () => {
    setup();
    vi.stubGlobal('fetch', async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:11444' } });
    });
    const trace = startTurnTrace(META)!;
    await expect(trace.fetch('http://127.0.0.1:11444/v1/chat/completions', { method: 'POST', body: '{}' })).rejects.toThrow('fetch failed');
    await trace.finish('error');
    const failure = readTurnTrace(trace.id)!.find((event) => event.type === 'wire-error')!;
    expect(failure).toMatchObject({ code: 'ECONNREFUSED', url: 'http://127.0.0.1:11444/v1/chat/completions' });
  });

  it('cuts one long text, stops taking bodies past the turn cap, and still writes the end', async () => {
    setup({ textCap: 50, turnCapBytes: 400 });
    const trace = startTurnTrace(META)!;
    trace.prompt({ system: 'x'.repeat(500), messages: [{ role: 'user', content: 'q' }], tools: [] });
    for (let index = 0; index < 20; index += 1) trace.part({ type: 'tool-call', toolCallId: `c${index}`, toolName: 'readGraph', input: { page: index } });
    await trace.finish('ok');
    const events = readTurnTrace(trace.id)!;
    expect(String(events.find((event) => event.type === 'prompt')!.system)).toContain('[cut: 500 characters in all]');
    expect(events.filter((event) => event.type === 'truncated')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'tool-call').length).toBeLessThan(20);
    expect(events[events.length - 1]).toMatchObject({ type: 'turn-end', toolCalls: 20 });
  });

  it('keeps the folder inside its caps by removing the oldest turns', async () => {
    setup({ folderCapFiles: 3 });
    const ids: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      clock += 1000;
      const trace = startTurnTrace(META)!;
      ids.push(trace.id);
      await trace.finish('ok');
    }
    const kept = listTurnTraces().map((item) => item.id);
    expect(kept).toEqual([ids[4], ids[3], ids[2]]);
    expect(readTurnTrace(ids[0])).toBeNull();
    expect(clearTurnTraces()).toBe(3);
    expect(listTurnTraces()).toEqual([]);
  });

  it('exports chosen turns into one file with a header line, and refuses odd ids', async () => {
    setup();
    const one = startTurnTrace(META)!;
    await one.finish('ok');
    clock += 2000;
    const two = startTurnTrace({ ...META, model: 'gemma4:31b' })!;
    await two.finish('cancelled');
    const target = path.join(dir, 'bundle.jsonl');
    const written = exportTurnTraces([one.id, '../../etc/passwd', two.id], target, { app: '0.3.0', diagnostics: 'text' });
    expect(written.turns).toBe(2);
    const lines = fs.readFileSync(target, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as { type: string; model?: string });
    expect(lines[0]).toMatchObject({ type: 'bundle', app: '0.3.0', diagnostics: 'text' });
    expect(lines.filter((line) => line.type === 'turn-start').map((line) => line.model)).toEqual(['qwen3.5:9b', 'gemma4:31b']);
    expect(readTurnTrace('../../etc/passwd')).toBeNull();
    expect(traceDir()).toBe(path.join(dir, 'model'));
  });

  it('keeps the folder, each record and a saved file readable by the owner only', async () => {
    if (process.platform === 'win32') return;
    setup();
    const trace = startTurnTrace(META)!;
    trace.prompt({ system: 'You are a helper.', messages: [{ role: 'user', content: 'мой промпт' }], tools: [] });
    await trace.finish('ok');
    const folder = traceDir()!;
    expect(fs.statSync(folder).mode & 0o777).toBe(0o700);
    expect(fs.statSync(trace.file).mode & 0o777).toBe(0o600);
    const target = path.join(dir, 'saved.jsonl');
    exportTurnTraces([trace.id], target, { app: '0.3.0' });
    expect(fs.statSync(target).mode & 0o777).toBe(0o600);
  });

  it('makes a short report a person can paste: model, sizes, steps, errors', async () => {
    setup();
    const trace = startTurnTrace(META)!;
    trace.prompt({ system: 'S'.repeat(5000), messages: [{ role: 'user', content: 'собери граф' }], tools: [{ name: 'addNode' }] });
    trace.part({ type: 'start-step' });
    trace.part({ type: 'text-delta', text: 'Ставлю загрузчик.' });
    trace.part({ type: 'tool-call', toolCallId: 'c1', toolName: 'addNode', input: { nodeType: 'KSampler' } });
    trace.part({ type: 'tool-result', toolCallId: 'c1', toolName: 'addNode', output: { success: false, error: 'Unknown node class.' } });
    trace.part({ type: 'finish-step', finishReason: 'tool-calls', usage: { inputTokens: 10, outputTokens: 5 } });
    await trace.finish('paused');
    const report = turnReport(readTurnTrace(trace.id)!);
    expect(report).toContain('Модель: local / qwen3.5:9b (http://127.0.0.1:11444)');
    expect(report).toContain('Системный текст: 5000 симв.');
    expect(report).toContain('[ещё 2000 симв.]');
    expect(report).toContain('**user:** собери граф');
    expect(report).toContain('### Шаг 1');
    expect(report).toContain('вызов `addNode`');
    expect(report).toContain('результат С ОШИБКОЙ');
    expect(report).toContain('Итог: paused');
    expect(report.length).toBeLessThan(20000);
  });

  it('reduces a base URL to its origin', () => {
    expect(originOf('https://api.example.com/v1?token=x')).toBe('https://api.example.com');
    expect(originOf('nonsense')).toBe('');
    expect(originOf(null)).toBe('');
  });
});
