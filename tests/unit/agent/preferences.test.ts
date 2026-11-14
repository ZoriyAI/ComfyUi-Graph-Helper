import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSystemPrompt, buildTurnData } from '../../../src/main/agent/prompt';
import { createAgentTools } from '../../../src/main/agent/tools';
import { runAgentTurn } from '../../../src/main/agent/turn';
import { clampSteps, MainLLMService, mainLLMService, redactProbeError, toolsForSend, type StreamOptions } from '../../../src/main/llmService';
import { commitCommand, ensureWorkspace, readProjection, startRun } from '../../../src/main/commands/commit';
import { migrate } from '../../../src/main/settings/migrate';
import { saveSettings } from '../../../src/main/settings/repository';
import { summarizeGraph } from '../../../src/shared/agent/graph';
import { parseTurnContext } from '../../../src/shared/agent/turnContext';
import { parsePreferences } from '../../../src/shared/config/preferences';
import { DESKTOP_PROJECT_ID } from '../../../src/shared/project';
import { fakeKnowledge, fakeProposals } from './fakes';
import { INNER_ID, nestedSubgraphWorkflow } from '../../e2e/fixtures/nestedSubgraphWorkflow';

const SNAPSHOT = {
  nodes: [{ id: 'node-1', data: { comfyType: 'CLIPTextEncode', title: 'Prompt', parameters: { text: 'a red fox in snow' } } }],
  edges: [],
};

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

describe('prompt honours Preferences ▸ Assistant and Privacy', () => {
  const context = parseTurnContext({ intent: 'chat', selection: [] }, 'en');

  it('defaults: ghosts first, the interface language, short answers, field values visible', () => {
    const input = { context, graph: summarizeGraph(SNAPSHOT), catalog: '' };
    const prompt = `${buildSystemPrompt(input)}\n\n${buildTurnData(input)}`;
    // Ghost by default: a chat turn has no build tools and says so.
    expect(prompt).toContain('Build tools are not available in this turn. Suggest graph changes as ghosts with propose* tools');
    expect(prompt).toContain('Answer in English.');
    expect(prompt).toContain('Length: keep answers short');
    expect(prompt).toContain('fields: text=a red fox in snow');
    expect(prompt).toContain('searchWeb / fetchPage');
  });

  it('build-by-default, answer language, fuller answers, no field values, no web', () => {
    const preferences = { defaultIntent: 'build' as const, answerLanguage: 'ru' as const, verbosity: 'normal' as const, allowWebSearch: false, allowFetchPage: false, sendFieldValues: false };
    const prompt = buildSystemPrompt({ context, graph: summarizeGraph(SNAPSHOT, { omitValues: true }), catalog: '', preferences });
    expect(prompt).toContain('set "build directly" as their default');
    expect(prompt).toContain('Build tools: the person prefers that you build directly');
    expect(prompt).toContain('Answer in Russian.');
    expect(prompt).toContain('the person asked for fuller answers');
    expect(prompt).not.toContain('a red fox in snow');
    expect(prompt).toContain('but not field values');
    expect(prompt).toContain('The web is switched off by the person');
    expect(prompt).not.toContain('searchWeb / fetchPage');
    // An explicit ask intent still wins over the build default.
    const ask = buildSystemPrompt({ context: parseTurnContext({ intent: 'ask', selection: [] }, 'en'), graph: null, catalog: '', preferences });
    expect(ask).toContain('Turn intent: ask');
    // "ui" follows the turn's language.
    const ui = buildSystemPrompt({ context: parseTurnContext({ intent: 'chat', selection: [], language: 'ru' }, 'en'), graph: null, catalog: '', preferences: { answerLanguage: 'ui' } });
    expect(ui).toContain('Answer in Russian.');
  });
});

describe('agent tools honour the web and field-value switches', () => {
  it('omits searchWeb and fetchPage when they are off, and field values from getGraph', async () => {
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const base = { db, projectId: DESKTOP_PROJECT_ID, runId: run.runId, revision: run.expectedRevisionId, knowledge: fakeKnowledge(), proposals: fakeProposals() };
    const all = createAgentTools(base);
    expect(Object.keys(all)).toEqual(expect.arrayContaining(['searchWeb', 'fetchPage']));
    const none = createAgentTools({ ...base, allowWebSearch: false, allowFetchPage: false, nativeSearch: { provider: 'native' } });
    expect(none).not.toHaveProperty('searchWeb');
    expect(none).not.toHaveProperty('fetchPage');
    expect(createAgentTools({ ...base, allowFetchPage: false })).toHaveProperty('searchWeb');
    const hidden = createAgentTools({
      ...base,
      omitValues: true,
      readGraph: () => ({ snapshot: SNAPSHOT, currentRevisionId: 'r1' }) as never,
    }) as Record<string, { execute: (args: unknown) => Promise<{ nodes: Array<{ parameters: unknown[] }> }> }>;
    const graph = await hidden.getGraph.execute({});
    expect(graph.nodes[0].parameters).toEqual([]);
    db.close();
  });
});

describe('agent turn reads preferences from the settings row', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function turnWith(db: Database.Database) {
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const seen: { options?: StreamOptions; tools?: string[]; system?: string; users: string[]; nativeAsked: number } = { users: [], nativeAsked: 0 };
    await runAgentTurn({
      db,
      messages: [{ role: 'user', content: 'hello' }],
      toolSpecs: [],
      run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
      language: 'en',
      send: () => undefined,
      notify: () => undefined,
      knowledge: fakeKnowledge(),
      proposals: fakeProposals(),
      fetchImpl: async () => { throw new Error('no network in unit tests'); },
      llm: {
        nativeSearchTool: () => {
          seen.nativeAsked += 1;
          return null;
        },
        // eslint-disable-next-line require-yield
        streamChatWithTools: async function* (messages, tools, options) {
          seen.options = options;
          seen.tools = Object.keys(tools);
          seen.system = messages[0].content;
          seen.users = messages.filter((message) => message.role === 'user').map((message) => message.content);
        },
      },
    });
    return seen;
  }

  it('uses the defaults when nothing is stored', async () => {
    const db = openDb();
    const seen = await turnWith(db);
    expect(seen.options).toMatchObject({ maxSteps: 60, allowWebSearch: true, allowFetchPage: true });
    // The turn's facts for its record in the model conversation log.
    expect(seen.options?.trace).toMatchObject({ intent: 'chat', omittedMessages: 0 });
    expect(typeof seen.options?.trace?.runId).toBe('string');
    expect(seen.tools).toEqual(expect.arrayContaining(['searchWeb', 'fetchPage']));
    expect(seen.nativeAsked).toBe(1);
    db.close();
  });

  it('applies a saved step limit, web switches, language and privacy on the next turn', async () => {
    const db = openDb();
    const saved = saveSettings(db, {
      theme: 'graphite', motion: 'system', provider: 'test', model: 'test-fixture', baseURL: '', comfyOrigin: '', mcpUrl: '', language: 'en',
      preferences: { assistant: { maxStepsPerTurn: 6, allowWebSearch: false, allowFetchPage: false, answerLanguage: 'ru' }, privacy: { sendFieldValues: false } },
    });
    expect(saved.ok).toBe(true);
    const seen = await turnWith(db);
    expect(seen.options).toMatchObject({ maxSteps: 6, allowWebSearch: false, allowFetchPage: false });
    expect(seen.tools).not.toContain('searchWeb');
    expect(seen.tools).not.toContain('fetchPage');
    expect(seen.nativeAsked).toBe(0);
    expect(seen.system).toContain('Answer in Russian.');
    expect(seen.system).toContain('but not field values');
    db.close();
  });

  it.each([false, true])('applies sendFieldValues=%s to the actual turn data, including recent manual edits', async (sendFieldValues) => {
    const db = openDb();
    try {
      const manual = (actionId: string, payload: Record<string, unknown>) => {
        const outcome = commitCommand(db, {
          projectId: DESKTOP_PROJECT_ID, actionId, actor: 'manual', runId: null,
          expectedRevisionId: readProjection(db, DESKTOP_PROJECT_ID)!.currentRevisionId, payload,
        });
        expect(outcome.status, JSON.stringify(outcome.result)).toBe('applied');
        return outcome.result as Record<string, unknown>;
      };
      manual('import', { type: 'import-workflow', document: structuredClone(nestedSubgraphWorkflow) });
      const nodeId = '3';
      manual('text', { type: 'set-parameter', nodeId, key: 'text', value: 'private orchid beside a window', widgetIndex: 1 });
      manual('number', { type: 'set-parameter', nodeId, key: 'seed', value: 918273645, widgetIndex: 0 });
      manual('secret', { type: 'set-parameter', nodeId, key: 'api_key', value: 'sk-never-visible-credential', widgetIndex: 2 });
      manual('inner', { type: 'edit-in-subgraph', definitionId: INNER_ID, edit: {
        type: 'set-parameter', nodeId: '1', key: 'text', value: 'private nested illustration', widgetIndex: 0,
      } });
      manual('batch-private', { type: 'batch', label: 'move', edits: [
        { type: 'set-parameter', nodeId, key: 'batch_text', value: 'private batch landscape', widgetIndex: 1 },
        { type: 'set-parameter', nodeId, key: 'batch_number', value: 873619245, widgetIndex: 0 },
      ] });
      const saved = saveSettings(db, {
        theme: 'graphite', motion: 'system', provider: 'test', model: 'test-fixture', baseURL: '', comfyOrigin: '', mcpUrl: '', language: 'en',
        preferences: { privacy: { sendFieldValues } },
      });
      expect(saved.ok).toBe(true);
      const sent = (await turnWith(db)).users.join('\n');
      expect(sent).toContain('What the person did recently:');
      expect(sent).toContain(`set ${nodeId}.text`);
      expect(sent).toContain(`set ${nodeId}.seed`);
      expect(sent).toContain(`inside subgraph ${INNER_ID}: set-parameter node 1 field text`);
      expect(sent).not.toContain('sk-never-visible-credential');
      expect(sent).not.toContain('private nested illustration');
      if (sendFieldValues) {
        expect(sent).toContain('private orchid beside a window');
        expect(sent).toContain('918273645');
        expect(sent).toContain(`set ${nodeId}.api_key = [redacted]`);
      } else {
        expect(sent).not.toContain('private orchid beside a window');
        expect(sent).not.toContain('918273645');
        expect(sent).not.toContain('private batch landscape');
        expect(sent).not.toContain('873619245');
      }
    } finally {
      db.close();
    }
  });

  it('takes injected preferences over the stored row', async () => {
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    let options: StreamOptions | undefined;
    await runAgentTurn({
      db,
      messages: [{ role: 'user', content: 'hi' }],
      toolSpecs: [],
      run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
      language: 'en',
      send: () => undefined,
      notify: () => undefined,
      knowledge: fakeKnowledge(),
      preferences: parsePreferences({ assistant: { maxStepsPerTurn: 40 } }),
      llm: {
        nativeSearchTool: () => null,
        // eslint-disable-next-line require-yield
        streamChatWithTools: async function* (_messages, _tools, next) {
          options = next;
        },
      },
    });
    expect(options?.maxSteps).toBe(40);
    db.close();
  });
});

describe('llm service: step limit, tool filter, probe', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    // The probe never reaches the network in unit tests: generation is injected.
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('clamps the step limit and drops switched-off web tools', () => {
    expect(clampSteps(2)).toBe(4);
    expect(clampSteps(500)).toBe(200);
    expect(clampSteps(Number.NaN)).toBe(60);
    expect(clampSteps(12.4)).toBe(12);
    const tools = { searchWeb: 1, fetchPage: 2, getGraph: 3 };
    expect(Object.keys(toolsForSend(tools, {}))).toEqual(['searchWeb', 'fetchPage', 'getGraph']);
    expect(Object.keys(toolsForSend(tools, { allowWebSearch: false }))).toEqual(['fetchPage', 'getGraph']);
    expect(Object.keys(toolsForSend(tools, { allowWebSearch: false, allowFetchPage: false }))).toEqual(['getGraph']);
    expect(tools).toHaveProperty('searchWeb');
  });

  it('streams with the clamped limit and without the switched-off tools', async () => {
    mainLLMService.setConfig({ provider: 'test', model: 'test-fixture' });
    const parts: string[] = [];
    for await (const part of mainLLMService.streamChatWithTools([{ role: 'user', content: 'hello' }], {}, { maxSteps: 2, allowWebSearch: false })) parts.push(part.type);
    expect(parts).toContain('finish');
    mainLLMService.setConfig({ provider: '' });
  });

  it('probes the draft runtime with one injected request and reports latency', async () => {
    const service = new MainLLMService();
    const generate = vi.fn(async () => ({ text: 'pong' }));
    let clock = 1000;
    const now = () => (clock += 37);
    service.setSessionKey('anthropic', 'probe-key-value-123');
    const ok = await service.probe({ provider: 'anthropic', model: 'fixture-model', baseURL: '' }, generate, now);
    expect(ok).toEqual({ ok: true, latencyMs: 37, provider: 'anthropic', model: 'fixture-model' });
    expect(generate).toHaveBeenCalledTimes(1);
    const firstCall = (generate.mock.calls as unknown as Array<[{ model: { modelId: string } }]>)[0][0];
    expect(firstCall.model.modelId).toBe('fixture-model');
    // The held configuration did not change.
    expect(service.nextSendConfig()).toEqual({ provider: '', model: '', baseURL: '' });
  });

  it('applies the send rules before anything is built, and redacts provider errors', async () => {
    const service = new MainLLMService();
    const generate = vi.fn(async () => { throw new Error('401 Incorrect API key provided: probe-key-value-123 (Bearer probe-key-value-123) sk-live-abcdef'); });
    expect(await service.probe({ provider: 'openai', model: 'x' }, generate)).toEqual({ ok: false, error: 'Cloud model has no key for this session.', latencyMs: null });
    expect(await service.probe({ provider: 'local', model: 'llama', baseURL: '' }, generate)).toEqual({ ok: false, error: 'Local model has no endpoint.', latencyMs: null });
    expect(await service.probe({ provider: 'nope' }, generate)).toEqual({ ok: false, error: 'Model not configured', latencyMs: null });
    expect(await service.probe({ provider: 'test' }, generate)).toMatchObject({ ok: true, latencyMs: 0 });
    expect(generate).not.toHaveBeenCalled();
    service.setSessionKey('openai', 'probe-key-value-123');
    expect(await service.probe({ provider: 'openai', model: 'x', baseURL: 'http://127.0.0.1:9/v1' }, generate)).toMatchObject({ ok: false, error: 'Cloud key is not sent to an http address.' });
    const failed = await service.probe({ provider: 'openai', model: 'x', baseURL: '' }, generate);
    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.error).toContain('401 Incorrect API key provided');
    expect(failed.error).not.toContain('probe-key-value-123');
    expect(failed.error).not.toContain('sk-live');
    expect(redactProbeError('api_key=abc123 failed', [])).toBe('api_key=[redacted] failed');
    expect(redactProbeError('   ', [])).toBe('The provider did not answer.');
  });
});
