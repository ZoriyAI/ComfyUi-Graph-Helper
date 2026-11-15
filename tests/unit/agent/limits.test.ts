/**
 * Protects the assistant's size limits: the graph goes into the prompt whole (compact past a size), getGraph and the
 * catalog searches have no maximum page, a turn pauses at the step limit and Continue finishes it, old messages are
 * dropped by the model's context window with a note, and fetched pages have stated caps. A person with a large
 * graph or a long build relies on the assistant seeing all of it and stopping only where they can resume.
 */
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runAgentTurn } from '../../../src/main/agent/turn';
import { omittedHistoryText, trimHistory } from '../../../src/main/agent/history';
import { createAgentTools, type AgentToolDefinition } from '../../../src/main/agent/tools';
import { MAIN_TOOL_SPECS } from '../../../src/main/agent/toolSpecs';
import { PAGE_BYTE_CAP, PAGE_TEXT_CAP } from '../../../src/main/agent/web';
import { clampSteps, mainLLMService, pauseOf } from '../../../src/main/llmService';
import { LONG_CHAIN_STEPS } from '../../../src/main/testLLMTransport';
import { ensureWorkspace, readProjection, resumeRun, startRun } from '../../../src/main/commands/commit';
import { migrate } from '../../../src/main/settings/migrate';
import { graphSummaryText, summarizeGraph } from '../../../src/shared/agent/graph';
import { contextWindowFor, DEFAULT_CONTEXT_TOKENS, historyBudgetTokens, knownContextTokens } from '../../../src/shared/agent/contextWindow';
import { FETCH_PAGE_BYTE_CAP, FETCH_PAGE_TEXT_CAP } from '../../../src/shared/agent/limits';
import { parsePreferences, preferencesSchema, STEP_LIMIT } from '../../../src/shared/config/preferences';
import { BUILD_TOOL_SPECS } from '../../../src/shared/commands/toolSpecs';
import { DESKTOP_PROJECT_ID } from '../../../src/shared/project';
import { fakeKnowledge, fakeProposals } from './fakes';

/** A fresh in-memory database with the schema and the desktop workspace. */
function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

/** A straight chain of `count` KSamplers, each with a title and two fields, linked one to the next. */
const graph = (count: number) => ({
  nodes: Array.from({ length: count }, (_, index) => ({
    id: `n${index}`,
    data: { comfyType: 'KSampler', title: `Step ${index}`, parameters: { seed: index, prompt: `text ${index}` } },
  })),
  edges: Array.from({ length: Math.max(0, count - 1) }, (_, index) => ({ id: `e${index}`, source: `n${index}`, sourceHandle: 'out-0', target: `n${index + 1}`, targetHandle: 'in-0' })),
});

describe('graph context without a cap', () => {
  it('lists a 150-node graph whole in the prompt: every node, field and connection', () => {
    const summary = summarizeGraph(graph(150));
    expect(summary.nodes).toHaveLength(150);
    expect(summary.edges).toHaveLength(149);
    expect(summary).toMatchObject({ omittedNodes: 0, omittedEdges: 0, nextOffset: null });
    const text = graphSummaryText(summary);
    expect(text).toContain('- n149 KSampler "Step 149"');
    expect(text).toContain('fields: seed=149; prompt=text 149');
    expect(text).toContain('- n148.out-0 -> n149.in-0');
    expect(text).not.toContain('getGraph({ offset');
  });

  it('lists every node of a 400-node graph compactly and points to getGraph({ offset }) for fields and edges', () => {
    const summary = summarizeGraph(graph(400), { selectedIds: ['n390'] });
    expect(summary.nodes).toHaveLength(400);
    const text = graphSummaryText(summary);
    for (const id of ['n0', 'n199', 'n300', 'n399']) expect(text).toContain(`- ${id} KSampler "Step ${id.slice(1)}"`);
    expect(text).toContain('The graph has 400 nodes and 399 connections');
    expect(text).toContain('getGraph({ offset: 0 })');
    expect(text).not.toContain('fields: seed=5;');
    // The selected node is written in full.
    expect(text).toContain('fields: seed=390; prompt=text 390');
  });

  it('getGraph returns everything in pages of any size, with full values', async () => {
    const db = openDb();
    const big = graph(1200);
    (big.nodes[3].data.parameters as Record<string, unknown>).prompt = 'p'.repeat(5000);
    const projection = { ...readProjection(db, DESKTOP_PROJECT_ID)!, snapshot: big as any };
    const tools = createAgentTools({ db, projectId: DESKTOP_PROJECT_ID, runId: null, revision: 'r', knowledge: fakeKnowledge(), proposals: fakeProposals(), readGraph: () => projection });
    const call = (args: unknown) => (tools.getGraph as AgentToolDefinition).execute(args) as Promise<any>;
    const whole = await call({ limit: 1200 });
    expect(whole.success).toBe(true);
    expect(whole.nodes).toHaveLength(1200);
    expect(whole.edges).toHaveLength(1199);
    expect(whole.nextOffset).toBeNull();
    expect(whole.nodes[3].parameters.find((item: any) => item.name === 'prompt').value).toHaveLength(5000);
    const ids = await call({ ids: Array.from({ length: 700 }, (_, index) => `n${index}`) });
    expect(ids.nodes).toHaveLength(700);
    let offset: number | null = 0;
    let read = 0;
    while (offset !== null) {
      const page: any = await call({ offset });
      read += page.nodes.length;
      offset = page.nextOffset;
    }
    expect(read).toBe(1200);
    expect(MAIN_TOOL_SPECS.getGraph.parameters).not.toHaveProperty('properties.limit.maximum');
  });

  it('shortens a very long value in the prompt only, and says so', () => {
    const snapshot = { nodes: [{ id: 'a', data: { comfyType: 'Note', parameters: { text: 'x'.repeat(2500) } } }], edges: [] };
    const text = graphSummaryText(summarizeGraph(snapshot));
    // The prompt keeps 2000 characters of a value; getGraph still returns it whole.
    expect(text).toContain('… [+500 chars]');
  });
});

describe('step checkpoint', () => {
  it('step limit bounds are 4–200, default 60', () => {
    expect(STEP_LIMIT).toEqual({ min: 4, max: 200, default: 60 });
    expect(parsePreferences({}).assistant.maxStepsPerTurn).toBe(60);
    expect(preferencesSchema.safeParse({ assistant: { maxStepsPerTurn: 200 } }).success).toBe(true);
    expect(preferencesSchema.safeParse({ assistant: { maxStepsPerTurn: 201 } }).success).toBe(false);
    expect(clampSteps(500)).toBe(200);
    expect(clampSteps(undefined)).toBe(60);
  });

  it('pauseOf: step-limit when the last step still wanted tools, failure-streak after three failures, null otherwise', () => {
    const ok = { finishReason: 'tool-calls', content: [{ type: 'tool-result', output: { success: true } }] };
    const bad = { finishReason: 'tool-calls', content: [{ type: 'tool-result', output: { success: false } }] };
    expect(pauseOf(Array(5).fill(ok), 5)).toEqual({ reason: 'step-limit', steps: 5, canContinue: true });
    expect(pauseOf([...Array(4).fill(ok), { finishReason: 'stop', content: [] }], 5)).toBeNull();
    expect(pauseOf([ok, bad, bad, bad], 60)).toEqual({ reason: 'failure-streak', steps: 4, canContinue: true, failures: 3 });
    expect(pauseOf([ok, bad, bad], 60)).toBeNull();
    expect(pauseOf([], 60)).toBeNull();
  });

  describe('scripted "build a long chain" (TEST transport)', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => undefined);
      mainLLMService.setConfig({ provider: 'test', model: 'test-fixture' });
    });
    afterEach(() => {
      mainLLMService.setConfig({ provider: '' });
      vi.restoreAllMocks();
    });

    // Runs one build turn with the default preferences (step limit 60) and returns every chunk sent.
    async function turn(db: Database.Database, run: { runId: string; expectedRevisionId: string }, messages: Array<{ role: string; content: string }>) {
      const chunks: Array<{ type: string; content?: any }> = [];
      await runAgentTurn({
        db,
        messages,
        toolSpecs: BUILD_TOOL_SPECS,
        run: { projectId: DESKTOP_PROJECT_ID, ...run },
        context: { intent: 'build', selection: [] },
        language: 'en',
        send: (chunk) => chunks.push(chunk),
        notify: () => undefined,
        knowledge: fakeKnowledge(),
        proposals: fakeProposals(),
        preferences: parsePreferences({}),
      });
      return chunks;
    }

    it(`pauses at 60 steps with a turn-paused chunk, keeps the run paused, and Continue finishes all ${LONG_CHAIN_STEPS}`, async () => {
      const db = openDb();
      const started = startRun(db, DESKTOP_PROJECT_ID);
      const ask = { role: 'user', content: 'Build a long chain' };
      const first = await turn(db, started, [ask]);
      const types = first.map((chunk) => chunk.type);
      expect(types).not.toContain('error');
      const paused = first.find((chunk) => chunk.type === 'turn-paused');
      expect(paused?.content).toEqual({ reason: 'step-limit', steps: 60, canContinue: true });
      // turn-paused, then the final projection, then done.
      expect(types.slice(-3)).toEqual(['turn-paused', 'projection', 'done']);
      const afterFirst = readProjection(db, DESKTOP_PROJECT_ID)!;
      expect(afterFirst.activeRun).toMatchObject({ runId: started.runId, status: 'paused' });
      expect(afterFirst.snapshot.nodes).toHaveLength(60);

      // Continue: resume the same run, then send "continue" with the same context.
      const resumed = resumeRun(db, DESKTOP_PROJECT_ID);
      expect(resumed.runId).toBe(started.runId);
      const second = await turn(db, resumed, [ask, { role: 'assistant', content: '' }, { role: 'user', content: 'continue' }]);
      expect(second.map((chunk) => chunk.type)).not.toContain('turn-paused');
      expect(second[second.length - 1].type).toBe('done');
      const text = second.filter((chunk) => chunk.type === 'text-delta').map((chunk) => chunk.content.text).join('');
      expect(text).toContain(`complete with ${LONG_CHAIN_STEPS} steps`);
      const end = readProjection(db, DESKTOP_PROJECT_ID)!;
      expect(end.activeRun).toBeNull();
      const titles = end.snapshot.nodes.map((node: any) => node.data?.title);
      expect(titles).toHaveLength(LONG_CHAIN_STEPS);
      expect(new Set(titles).size).toBe(LONG_CHAIN_STEPS);
      expect(titles).toContain(`Chain step ${LONG_CHAIN_STEPS}`);
    }, 60_000);
  });
});

describe('history by context window', () => {
  it('knows common models and falls back to 32k; the preference overrides', () => {
    expect(knownContextTokens('claude-sonnet-4-5')).toBe(200_000);
    expect(knownContextTokens('gpt-4o-mini')).toBe(128_000);
    expect(knownContextTokens('gpt-4')).toBe(8_192);
    expect(knownContextTokens('models/gemini-2.5-pro')).toBe(1_048_576);
    expect(knownContextTokens('llama3.1:8b')).toBe(131_072);
    expect(knownContextTokens('qwen2.5:7b')).toBe(32_768);
    expect(knownContextTokens('my-custom-model')).toBeNull();
    expect(contextWindowFor('my-custom-model')).toEqual({ tokens: DEFAULT_CONTEXT_TOKENS, source: 'default' });
    expect(contextWindowFor('claude-opus-4-1', 50_000)).toEqual({ tokens: 50_000, source: 'override' });
    expect(parsePreferences({}).assistant.contextTokens).toBe(0);
  });

  it('keeps the newest messages within 70 % of the window minus the prompt, never splitting a tool call from its result', () => {
    expect(historyBudgetTokens(10_000, 4_000)).toBe(6_000);
    expect(historyBudgetTokens(1_000, 40_000)).toBe(0);
    const messages = [
      { role: 'user', content: 'a'.repeat(8_000) },
      { role: 'assistant', content: 'b'.repeat(8_000) },
      { role: 'user', content: 'c'.repeat(8_000) },
      { role: 'assistant', content: 'd'.repeat(4_000) },
      { role: 'user', content: 'last' },
    ];
    const kept = trimHistory(messages, 3_100);
    expect(kept.messages.map((message) => message.content[0])).toEqual(['c', 'd', 'l']);
    expect(kept.omitted).toBe(2);
    const withTool = trimHistory([
      { role: 'user', content: 'x'.repeat(30_000) },
      { role: 'assistant', content: [{ type: 'tool-call' }] },
      { role: 'tool', content: [{ type: 'tool-result' }] },
      { role: 'user', content: 'now' },
    ], 40);
    expect(withTool.messages.map((message) => message.role)).toEqual(['user']);
    expect(trimHistory([{ role: 'user', content: 'z'.repeat(500_000) }], 10).messages).toHaveLength(1);
    expect(omittedHistoryText(2)).toBe('2 earlier messages were left out of this conversation to fit the model\'s context window; ask the person for details if needed.');
  });

  it('tells the model how many messages were left out', async () => {
    mainLLMService.setConfig({ provider: 'test', model: 'test-fixture' });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const systems: string[] = [];
    const sent: number[] = [];
    // Ten long messages do not fit a 16k window, so some must be left out.
    const long = Array.from({ length: 10 }, (_, index) => ({ role: index % 2 === 0 ? 'user' : 'assistant', content: `${index} `.repeat(4_000) }));
    await runAgentTurn({
      db,
      messages: [...long, { role: 'user', content: 'Hello' }],
      toolSpecs: [],
      run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
      language: 'en',
      send: () => undefined,
      notify: () => undefined,
      knowledge: fakeKnowledge(),
      proposals: fakeProposals(),
      preferences: parsePreferences({ assistant: { contextTokens: 16_384 } }),
      llm: {
        nativeSearchTool: () => null,
        async* streamChatWithTools(messages: any[]) {
          systems.push(...messages.filter((message) => message.role === 'system').map((message) => message.content));
          sent.push(messages.length - 1);
          yield { type: 'text-delta', content: { text: 'ok' } };
        },
      },
    });
    mainLLMService.setConfig({ provider: '' });
    vi.restoreAllMocks();
    // Eleven dialog messages were given; fewer reached the model (the one system message is not counted).
    expect(sent[0]).toBeLessThan(11);
    const omitted = 11 - sent[0];
    expect(systems[0]).toContain(`${omitted} earlier messages were left out`);
  });
});

describe('catalog searches: no maximum, and "more" when the list goes on', () => {
  it('returns the default 20 with more: true, and any larger limit the model asks for', async () => {
    const db = openDb();
    const rows = Array.from({ length: 75 }, (_, index) => ({ classType: `Node${index}` }));
    // 75 classes, more than the tool's default of 20, so the result must say there is more.
    const knowledge = { ...fakeKnowledge(), searchNodeClasses: (_db: unknown, request: { limit?: number }) => rows.slice(0, request.limit ?? 30) } as any;
    const tools = createAgentTools({ db, projectId: DESKTOP_PROJECT_ID, runId: null, revision: 'r', knowledge, proposals: fakeProposals() });
    const call = (args: unknown) => (tools.searchNodeTypes as AgentToolDefinition).execute(args) as Promise<any>;
    const first = await call({ query: '' });
    expect(first.results).toHaveLength(20);
    expect(first.more).toBe(true);
    expect(first.note).toContain('More than 20 match');
    const all = await call({ query: '', limit: 500 });
    expect(all.results).toHaveLength(75);
    expect(all.more).toBeUndefined();
    expect(MAIN_TOOL_SPECS.searchNodeTypes.parameters).not.toHaveProperty('properties.limit.maximum');
    expect(MAIN_TOOL_SPECS.findInstalledModels.parameters).not.toHaveProperty('properties.limit.maximum');
  });
});

describe('external page cap: higher and stated', () => {
  it('reads up to 10 MB and returns up to 60k characters, and the tool description says so', () => {
    expect(PAGE_BYTE_CAP).toBe(10 * 1024 * 1024);
    expect(PAGE_TEXT_CAP).toBe(60_000);
    expect(FETCH_PAGE_BYTE_CAP).toBe(PAGE_BYTE_CAP);
    expect(FETCH_PAGE_TEXT_CAP).toBe(PAGE_TEXT_CAP);
    expect(MAIN_TOOL_SPECS.fetchPage.description).toContain('10 MB');
    expect(MAIN_TOOL_SPECS.fetchPage.description).toContain('60000 characters');
  });
});
