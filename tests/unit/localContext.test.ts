import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  COMPACT_WINDOW, contextFit, estimateRequestTokens, parseOllamaPs, readLoadedContext, resetLocalContextMemory, watchLoadedContext,
} from '../../src/main/llm/localContext';
import { readStoredWindow, writeStoredWindow } from '../../src/main/llm/localContextStore';
import { configureLocalContext, MainLLMService } from '../../src/main/llmService';
import { configureModelTrace, listTurnTraces, readTurnTrace, turnReport } from '../../src/main/trace/modelTrace';
import { compactToolNames, runAgentTurn } from '../../src/main/agent/turn';
import { ensureWorkspace, startRun } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { BUILD_TOOL_SPECS } from '../../src/shared/commands/toolSpecs';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { fakeKnowledge, fakeProposals } from './agent/fakes';

/**
 * A model on the person's own server reads only what fits its context window, and the request cannot widen it.
 * The app reads the window the server loaded the model with, says when the request did not fit, and offers fewer
 * tools when the window is small.
 */

const PS = {
  models: [
    { name: 'qwen3.5:9b-q4_K_M', model: 'qwen3.5:9b-q4_K_M', size: 6_600_000_000, context_length: 8192 },
    { name: 'llama3.2:latest', model: 'llama3.2:latest', context_length: 4096 },
    { name: 'no-window:latest', model: 'no-window:latest' },
  ],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function sse(lines: unknown[]): Response {
  const body = `${lines.map((line) => `data: ${typeof line === 'string' ? line : JSON.stringify(line)}\n\n`).join('')}`;
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function answer(promptTokens: number): Response {
  return sse([
    { id: 'c', object: 'chat.completion.chunk', created: 1, model: 'm', choices: [{ index: 0, delta: { role: 'assistant', content: 'Готово.' }, finish_reason: null }] },
    { id: 'c', object: 'chat.completion.chunk', created: 1, model: 'm', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: promptTokens, completion_tokens: 3, total_tokens: promptTokens + 3 } },
    '[DONE]',
  ]);
}

async function drain(stream: AsyncGenerator<{ type: string; content: any }>): Promise<Array<{ type: string; content: any }>> {
  const chunks: Array<{ type: string; content: any }> = [];
  for await (const part of stream) chunks.push(part);
  return chunks;
}

let dir = '';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  configureLocalContext(null);
  resetLocalContextMemory();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = '';
  configureModelTrace({ dir: path.join(os.tmpdir(), 'model-trace-off'), redact: (text) => text, enabled: () => false });
});

describe('the window a local server loaded the model with', () => {
  it('is read from the list of loaded models, by the model name with or without a tag', () => {
    expect(parseOllamaPs(PS, 'qwen3.5:9b-q4_K_M')).toBe(8192);
    expect(parseOllamaPs(PS, 'llama3.2')).toBe(4096);
    expect(parseOllamaPs(PS, 'llama3.2:latest')).toBe(4096);
    expect(parseOllamaPs(PS, 'no-window')).toBeNull();
    expect(parseOllamaPs(PS, 'not-loaded:7b')).toBeNull();
    expect(parseOllamaPs({ models: 'nope' }, 'llama3.2')).toBeNull();
    expect(parseOllamaPs(null, 'llama3.2')).toBeNull();
    expect(parseOllamaPs({ models: [{ name: 'x:latest', context_length: -5 }] }, 'x')).toBeNull();
  });

  it('asks the server itself, only when the address has the shape of an Ollama server', async () => {
    const asked: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      asked.push(String(input));
      return json(PS);
    }) as typeof fetch;
    expect(await readLoadedContext('http://127.0.0.1:11444/v1', 'qwen3.5:9b-q4_K_M', fetchImpl)).toBe(8192);
    expect(await readLoadedContext('http://127.0.0.1:11444', 'llama3.2', fetchImpl)).toBe(4096);
    expect(asked).toEqual(['http://127.0.0.1:11444/api/ps', 'http://127.0.0.1:11444/api/ps']);
    // Another server's own path is left alone: nothing is asked there.
    expect(await readLoadedContext('http://127.0.0.1:8000/openai/v1', 'x', fetchImpl)).toBeNull();
    expect(asked).toHaveLength(2);
    expect(await readLoadedContext('http://127.0.0.1:11444/v1', 'qwen3.5:9b-q4_K_M', (async () => json({}, 404)) as typeof fetch)).toBeNull();
    expect(await readLoadedContext('http://127.0.0.1:11444/v1', 'qwen3.5:9b-q4_K_M', (async () => { throw new Error('down'); }) as typeof fetch)).toBeNull();
  });

  it('keeps asking while a request runs until the model shows up, and stops when told', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return json(calls < 3 ? { models: [] } : PS);
    }) as typeof fetch;
    expect(await watchLoadedContext('http://127.0.0.1:11444/v1', 'llama3.2', fetchImpl, { everyMs: 5 })).toBe(4096);
    expect(calls).toBe(3);

    const stop = new AbortController();
    const never = watchLoadedContext('http://127.0.0.1:11444/v1', 'llama3.2', (async () => json({ models: [] })) as typeof fetch, { everyMs: 5, signal: stop.signal });
    setTimeout(() => stop.abort(), 20);
    expect(await never).toBeNull();
    expect(await watchLoadedContext('http://127.0.0.1:11444/v1', 'llama3.2', (async () => json({ models: [] })) as typeof fetch, { everyMs: 5, maxMs: 15 })).toBeNull();
  });

  it('asks a server that is not Ollama once, and then leaves it alone', async () => {
    let calls = 0;
    const lmStudio = (async () => {
      calls += 1;
      return json({ error: 'Unexpected endpoint or method. (GET /api/ps)' }, 404);
    }) as typeof fetch;
    // The watch ends at the first "no such thing" instead of asking twice a second for the whole answer.
    expect(await watchLoadedContext('http://127.0.0.1:1234/v1', 'some-model', lmStudio, { everyMs: 5, maxMs: 200 })).toBeNull();
    expect(calls).toBe(1);
    expect(await watchLoadedContext('http://127.0.0.1:1234/v1', 'some-model', lmStudio, { everyMs: 5, maxMs: 200 })).toBeNull();
    expect(await readLoadedContext('http://127.0.0.1:1234/v1', 'other', lmStudio)).toBeNull();
    expect(calls).toBe(1);

    // A server that answers 200 with something else is the same case.
    let other = 0;
    const odd = (async () => {
      other += 1;
      return json({ status: 'ok' });
    }) as typeof fetch;
    expect(await watchLoadedContext('http://127.0.0.1:8080', 'm', odd, { everyMs: 5, maxMs: 200 })).toBeNull();
    expect(other).toBe(1);

    // A server that is only slow to answer is asked again.
    let slow = 0;
    const waking = (async () => {
      slow += 1;
      if (slow < 3) throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNRESET' } });
      return json(PS);
    }) as typeof fetch;
    expect(await watchLoadedContext('http://127.0.0.1:11444/v1', 'llama3.2', waking, { everyMs: 5 })).toBe(4096);
    expect(slow).toBe(3);
  });

  it('says whether a request fits: cut, tight or fine', () => {
    expect(estimateRequestTokens(19_656)).toBeGreaterThan(5_000);
    // A 4k window cannot hold a build request of about six thousand tokens.
    expect(contextFit(4096, 19_656, 4090)).toMatchObject({ window: 4096, state: 'cut' });
    expect(contextFit(4096, 19_656, null).state).toBe('cut');
    // The server counted right up to the edge: it stopped there, whatever the estimate says.
    expect(contextFit(8192, 12_000, 8190).state).toBe('cut');
    // 8k holds the request but leaves little room for a build's steps.
    expect(contextFit(8192, 23_000, 6_800).state).toBe('tight');
    expect(contextFit(8192, 11_900, 3_400).state).toBe('ok');
    // The reduced request fits 4k on paper, but nothing is left for a tool result and the answer.
    expect(contextFit(4096, 10_200, 3_100).state).toBe('tight');
    // Later steps are judged by the server's own count alone.
    expect(contextFit(8192, 0, 5_000).state).toBe('ok');
    expect(contextFit(8192, 0, 8_150)).toMatchObject({ state: 'cut', needed: 8_150 });
    expect(contextFit(32_768, 19_656, 5_600)).toMatchObject({ state: 'ok', window: 32_768 });
    expect(contextFit(4096, 19_656, null).needed).toBeGreaterThan(4096);
  });

  it('is remembered per server and model between runs', () => {
    const db = new Database(':memory:');
    migrate(db);
    expect(readStoredWindow(db, 'http://127.0.0.1:11444/v1', 'qwen3.5:9b-q4_K_M')).toBeNull();
    writeStoredWindow(db, 'http://127.0.0.1:11444/v1', 'qwen3.5:9b-q4_K_M', 8192);
    expect(readStoredWindow(db, 'http://127.0.0.1:11444/v1', 'qwen3.5:9b-q4_K_M')).toBe(8192);
    // The same model on the other server is its own fact.
    expect(readStoredWindow(db, 'http://127.0.0.1:11445/v1', 'qwen3.5:9b-q4_K_M')).toBeNull();
    writeStoredWindow(db, 'http://127.0.0.1:11444/v1', 'qwen3.5:9b-q4_K_M', 32_768);
    expect(readStoredWindow(db, 'http://127.0.0.1:11444/v1', 'qwen3.5:9b-q4_K_M')).toBe(32_768);
    writeStoredWindow(db, '', 'x', 4096);
    writeStoredWindow(db, 'http://127.0.0.1:11444/v1', 'x', Number.NaN);
    expect(readStoredWindow(db, 'http://127.0.0.1:11444/v1', 'x')).toBeNull();
    db.close();
  });
});

describe('a turn with a local model and a small window', () => {
  it('tells the chat and the log when the server dropped part of the request', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-context-'));
    configureModelTrace({ dir, redact: (text) => text, enabled: () => true });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const watched: Array<{ base: string; model: string }> = [];
    configureLocalContext(async (base, model) => {
      watched.push({ base, model });
      return 4096;
    });
    vi.stubGlobal('fetch', vi.fn(async () => answer(4090)));
    const service = new MainLLMService();
    service.setConfig({ provider: 'local', model: 'qwen3.5:4b-q4_K_M', baseURL: 'http://127.0.0.1:11445/v1' });
    expect(service.localContextTokens()).toBeNull();
    const big = 'Опиши каждую ноду подробно. '.repeat(700);
    const chunks = await drain(service.streamChatWithTools([{ role: 'system', content: big }, { role: 'user', content: 'собери граф' }], {}));

    expect(watched).toEqual([{ base: 'http://127.0.0.1:11445/v1', model: 'qwen3.5:4b-q4_K_M' }]);
    const notice = chunks.find((part) => part.type === 'notice');
    expect(notice?.content).toMatchObject({ code: 'context-window', state: 'cut', window: 4096, model: 'qwen3.5:4b-q4_K_M', compact: false });
    expect(notice?.content.needed).toBeGreaterThan(4096);
    expect(service.localContextTokens()).toBe(4096);
    // The answer still arrives: the notice explains it, it does not replace it.
    expect(chunks.some((part) => part.type === 'text-delta')).toBe(true);

    const turn = listTurnTraces(5)[0];
    const events = readTurnTrace(turn.id)!;
    const context = events.find((event) => event.type === 'context')!;
    expect(context).toMatchObject({ window: 4096, state: 'cut', counted: 4090, compact: false });
    expect(Number(context.requestChars)).toBeGreaterThan(19_000);
    expect(turnReport(events)).toContain('окно контекста на сервере: 4096');
    expect(turnReport(events)).toContain('сервер насчитал 4090');
    expect(turnReport(events)).toContain('НЕ ПОМЕСТИЛСЯ');
  });

  it('says a tight window once per run and stays quiet when the request fits', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    let window = 8192;
    configureLocalContext(async () => window);
    vi.stubGlobal('fetch', vi.fn(async () => answer(6_900)));
    const service = new MainLLMService();
    service.setConfig({ provider: 'local', model: 'qwen3.5:9b-q4_K_M', baseURL: 'http://127.0.0.1:11444/v1' });
    const long = 'x'.repeat(22_000);
    const first = await drain(service.streamChatWithTools([{ role: 'system', content: long }, { role: 'user', content: 'вопрос' }], {}, { compact: true }));
    expect(first.find((part) => part.type === 'notice')?.content).toMatchObject({ state: 'tight', window: 8192, compact: true });
    const second = await drain(service.streamChatWithTools([{ role: 'system', content: long }, { role: 'user', content: 'ещё вопрос' }], {}, { compact: true }));
    expect(second.some((part) => part.type === 'notice')).toBe(false);

    // The person gave the server a larger window: nothing to say, and the service knows the new number.
    window = 32_768;
    const third = await drain(service.streamChatWithTools([{ role: 'system', content: long }, { role: 'user', content: 'и ещё' }], {}));
    expect(third.some((part) => part.type === 'notice')).toBe(false);
    expect(service.localContextTokens()).toBe(32_768);
  });

  it('notices a build that runs out of window halfway, by what the server counted at a later step', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    configureLocalContext(async () => 8192);
    let call = 0;
    const toolStep = (promptTokens: number) => sse([
      { id: 'c', object: 'chat.completion.chunk', created: 1, model: 'm', choices: [{ index: 0, delta: { role: 'assistant', content: null, tool_calls: [{ index: 0, id: `call_${promptTokens}`, type: 'function', function: { name: 'step', arguments: '{}' } }] }, finish_reason: null }] },
      { id: 'c', object: 'chat.completion.chunk', created: 1, model: 'm', choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }], usage: { prompt_tokens: promptTokens, completion_tokens: 8, total_tokens: promptTokens + 8 } },
      '[DONE]',
    ]);
    vi.stubGlobal('fetch', vi.fn(async () => {
      call += 1;
      if (call === 1) return toolStep(3_000);
      if (call === 2) return toolStep(6_000);
      if (call === 3) return toolStep(8_180);
      return answer(8_185);
    }));
    const service = new MainLLMService();
    service.setConfig({ provider: 'local', model: 'qwen3.5:9b-q4_K_M', baseURL: 'http://127.0.0.1:11444/v1' });
    const { tool } = await import('ai');
    const { z } = await import('zod');
    const tools = { step: tool({ description: 'One step.', inputSchema: z.object({}), execute: async () => ({ success: true }) }) };
    const chunks = await drain(service.streamChatWithTools([{ role: 'user', content: 'собери граф' }], tools, { compact: true }));
    const notices = chunks.filter((part) => part.type === 'notice');
    // Nothing at the first two steps; one notice when the count reaches the window, and no second one after it.
    expect(notices).toHaveLength(1);
    expect(notices[0].content).toMatchObject({ state: 'cut', window: 8192, needed: 8_180, compact: true });
    const order = chunks.map((part) => part.type);
    expect(order.indexOf('notice')).toBeGreaterThan(order.indexOf('tool-result'));
  });

  it('asks nothing extra for a cloud model or when the server does not say', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-context-'));
    configureModelTrace({ dir, redact: (text) => text, enabled: () => true });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const watcher = vi.fn(async () => null);
    configureLocalContext(watcher);
    vi.stubGlobal('fetch', vi.fn(async () => answer(900)));
    const service = new MainLLMService();
    service.setConfig({ provider: 'local', model: 'some-model', baseURL: 'http://127.0.0.1:1234/v1' });
    const chunks = await drain(service.streamChatWithTools([{ role: 'user', content: 'привет' }], {}));
    expect(watcher).toHaveBeenCalledTimes(1);
    expect(chunks.some((part) => part.type === 'notice')).toBe(false);
    expect(service.localContextTokens()).toBeNull();
    // The record still holds what a reader can compare: the size of the request and the server's own count.
    const events = readTurnTrace(listTurnTraces(5)[0].id)!;
    expect(events.find((event) => event.type === 'context')).toMatchObject({ window: null, counted: 900, state: 'unknown' });
    expect(turnReport(events)).toContain('окно контекста сервер не сообщил');
    expect(turnReport(events)).toContain('сервер насчитал 900');

    watcher.mockClear();
    service.setConfig({ provider: 'test', model: 'test-fixture' });
    await drain(service.streamChatWithTools([{ role: 'user', content: 'привет' }], {}));
    expect(watcher).not.toHaveBeenCalled();
  });

  it('shows the window in the connection check of Settings', async () => {
    configureLocalContext(async () => 8192);
    const service = new MainLLMService();
    const result = await service.probe({ provider: 'local', model: 'qwen3.5:9b-q4_K_M', baseURL: 'http://127.0.0.1:11444/v1' }, async () => undefined);
    expect(result).toMatchObject({ ok: true, contextTokens: 8192 });
    // The check also teaches the service, so the first question after it already fits.
    service.setConfig({ provider: 'local', model: 'qwen3.5:9b-q4_K_M', baseURL: 'http://127.0.0.1:11444/v1' });
    expect(service.localContextTokens()).toBe(8192);

    configureLocalContext(async () => null);
    const silent = await service.probe({ provider: 'local', model: 'other', baseURL: 'http://127.0.0.1:1234/v1' }, async () => undefined);
    expect(silent).toMatchObject({ ok: true });
    expect('contextTokens' in silent).toBe(false);
  });
});

describe('the reduced tool set for a small window', () => {
  function openDb(): Database.Database {
    const db = new Database(':memory:');
    migrate(db);
    ensureWorkspace(db);
    return db;
  }

  async function turnWith(db: Database.Database, intent: 'ask' | 'build', llmExtra: Record<string, unknown>) {
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const seen: { tools: string[]; system: string; options?: Record<string, any> } = { tools: [], system: '' };
    await runAgentTurn({
      db,
      messages: [{ role: 'user', content: 'собери картинку по тексту' }],
      toolSpecs: BUILD_TOOL_SPECS,
      context: { intent, selection: [] },
      run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
      language: 'ru',
      send: () => undefined,
      notify: () => undefined,
      knowledge: fakeKnowledge(),
      proposals: fakeProposals(),
      llm: {
        nativeSearchTool: () => null,
        nextSendConfig: () => ({ provider: 'local', model: 'qwen3.5:9b-q4_K_M', baseURL: 'http://127.0.0.1:11444/v1' }),
        async* streamChatWithTools(messages: any[], tools: Record<string, unknown>, options: Record<string, any>) {
          seen.tools = Object.keys(tools);
          seen.system = messages[0].content;
          seen.options = options;
        },
        ...llmExtra,
      } as any,
    });
    return seen;
  }

  it('offers every tool when the window is unknown or large', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const db = openDb();
    const unknown = await turnWith(db, 'build', { localContextTokens: () => null });
    expect(unknown.tools.length).toBeGreaterThan(18);
    expect(unknown.options?.compact).toBe(false);
    expect(unknown.system).not.toContain('small context window');
    const large = await turnWith(db, 'build', { localContextTokens: () => 32_768 });
    expect(large.tools.length).toBe(unknown.tools.length);
    expect(large.options?.trace.contextTokens).toBeLessThanOrEqual(32_768);
    db.close();
  });

  it('keeps only what a build needs when the server loads the model with 8k', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const db = openDb();
    expect(8192).toBeLessThan(COMPACT_WINDOW);
    const build = await turnWith(db, 'build', { localContextTokens: () => 8192 });
    expect(build.tools.sort()).toEqual([...compactToolNames(true)].sort());
    expect(build.tools).toEqual(expect.arrayContaining(['addNode', 'connectNodes', 'setParameter', 'getGraph', 'describeNodeType']));
    expect(build.tools).not.toContain('proposeNode');
    expect(build.tools).not.toContain('searchWeb');
    expect(build.options).toMatchObject({ compact: true });
    expect(build.options?.trace).toMatchObject({ contextTokens: 8192, contextSource: 'server' });
    // The model is told what it has, and nothing about tools it does not have.
    expect(build.system).toContain('small context window here (8192 tokens)');
    expect(build.system).toContain('addNode, connectNodes, setParameter, removeNode: build tools');
    expect(build.system).not.toContain('- propose*');
    expect(build.system).not.toContain('searchWeb');
    expect(build.system).toContain('Building step by step');

    const ask = await turnWith(db, 'ask', { localContextTokens: () => 8192 });
    expect(ask.tools.sort()).toEqual([...compactToolNames(false)].sort());
    expect(ask.tools).toContain('proposeNode');
    expect(ask.tools).not.toContain('addNode');
    expect(ask.system).toContain('- propose*');
    expect(ask.system).not.toContain('Building step by step');
    db.close();
  });

  it('uses the window remembered from an earlier run, and remembers a new one', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const db = openDb();
    writeStoredWindow(db, 'http://127.0.0.1:11444/v1', 'qwen3.5:9b-q4_K_M', 8192);
    const remembered: number[] = [];
    let live: number | null = null;
    const first = await turnWith(db, 'build', {
      localContextTokens: () => live,
      rememberLocalContext: (tokens: number) => { remembered.push(tokens); },
    });
    expect(remembered).toEqual([8192]);
    expect(first.options?.compact).toBe(true);

    // During the next turn the server shows a larger window (the person changed its setting): it is kept.
    const db2 = openDb();
    live = null;
    await runTurnThatLearns(db2, () => live, (value) => { live = value; });
    expect(readStoredWindow(db2, 'http://127.0.0.1:11444/v1', 'qwen3.5:9b-q4_K_M')).toBe(32_768);
    db.close();
    db2.close();
  });

  async function runTurnThatLearns(db: Database.Database, read: () => number | null, learn: (value: number) => void): Promise<void> {
    const run = startRun(db, DESKTOP_PROJECT_ID);
    await runAgentTurn({
      db,
      messages: [{ role: 'user', content: 'привет' }],
      toolSpecs: BUILD_TOOL_SPECS,
      context: { intent: 'ask', selection: [] },
      run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
      language: 'ru',
      send: () => undefined,
      notify: () => undefined,
      knowledge: fakeKnowledge(),
      proposals: fakeProposals(),
      llm: {
        nativeSearchTool: () => null,
        nextSendConfig: () => ({ provider: 'local', model: 'qwen3.5:9b-q4_K_M', baseURL: 'http://127.0.0.1:11444/v1' }),
        localContextTokens: read,
        async* streamChatWithTools() {
          learn(32_768);
        },
      } as any,
    });
  }
});
