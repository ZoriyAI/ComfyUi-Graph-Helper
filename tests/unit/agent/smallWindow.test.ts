import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildToolsAllowed, dataBudgetChars, fitTurnData, runAgentTurn } from '../../../src/main/agent/turn';
import { ensureWorkspace, readProjection, startRun } from '../../../src/main/commands/commit';
import { migrate } from '../../../src/main/settings/migrate';
import { graphSummaryText, summarizeGraph } from '../../../src/shared/agent/graph';
import { parseTurnContext } from '../../../src/shared/agent/turnContext';
import { DESKTOP_PROJECT_ID as P } from '../../../src/shared/project';
import { parsePreferences } from '../../../src/shared/config/preferences';

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

/** An imported graph: values by position, as a workflow file stores them. */
function imported(count: number) {
  return {
    nodes: Array.from({ length: count }, (_, index) => ({
      id: String(index + 1),
      type: 'comfy',
      position: { x: index * 400, y: 0 },
      data: { comfyType: 'KSampler', title: `Sampler ${index + 1}`, comfy: { widgets_values: [42, 'fixed', 20, 7, 'euler', 'normal', 1] }, inputs: [{ name: 'model', type: 'MODEL' }], outputs: [{ name: 'LATENT', type: 'LATENT' }] },
    })),
    edges: Array.from({ length: count - 1 }, (_, index) => ({ id: `e${index}`, source: String(index + 1), target: String(index + 2), sourceHandle: 'out-0', targetHandle: 'in-0' })),
  };
}
const ORDER = ['seed', 'control_after_generate', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'];

describe('a small context window (item 4)', () => {
  it('names positional values by the class\'s widget order', () => {
    const text = graphSummaryText(summarizeGraph(imported(1) as never, { widgetNames: () => ORDER }));
    expect(text).toContain('steps=20');
    expect(text).toContain('cfg=7');
    expect(text).not.toContain('widget[');
    // Without the catalog the position is all there is.
    expect(graphSummaryText(summarizeGraph(imported(1) as never))).toContain('widget[2]=20');
  });

  it('sends a short plan: no positions, sizes, ports or field values', () => {
    const plan = graphSummaryText(summarizeGraph(imported(5) as never, { widgetNames: () => ORDER }), { plan: true });
    expect(plan).toContain('A short plan of the graph (5 nodes, 4 connections)');
    expect(plan).toContain('- 1.LATENT -> 2.model');
    expect(plan).not.toMatch(/at \(\d+,|steps=|inputs:/);
  });

  it('keeps the data block within its share of the window', () => {
    const snapshot = imported(80);
    const input = {
      context: parseTurnContext({ intent: 'ask' }, 'en'),
      graph: summarizeGraph(snapshot as never, { widgetNames: () => ORDER }),
      catalog: 'Catalog: none.',
      recent: [],
      recentWindow: 30,
      question: 'hi',
      preferences: {},
    };
    const budget = dataBudgetChars(8192, 3.3);
    const data = fitTurnData(input as never, { snapshot } as never, { selectedIds: [], priority: [], omitValues: false, widgetNames: () => ORDER, budgetChars: budget });
    expect(data.length).toBeLessThanOrEqual(budget);
    expect(data).toContain('A short plan of the graph');
  });

  it('Ask never builds, whatever the default setting', () => {
    expect(buildToolsAllowed({ intent: 'chat' } as never, 'build')).toBe(false);
    expect(buildToolsAllowed({ intent: 'ask' } as never, 'build')).toBe(false);
    expect(buildToolsAllowed({ intent: 'build' } as never, 'ask')).toBe(true);
  });
});

describe('a model that cannot call tools, an unknown window, a link of the person\'s', () => {
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => undefined); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('is asked again without tools, and the chat says so truthfully; the first turn on an own server is short', async () => {
    const db = openDb();
    const run = startRun(db, P);
    const calls: Array<{ tools: string[]; system: string }> = [];
    const chunks: Array<{ type: string; content?: any }> = [];
    const llm = {
      nativeSearchTool: () => null,
      nextSendConfig: () => ({ provider: 'local', model: 'small:4b', baseURL: 'http://127.0.0.1:9/v1' }),
      localContextTokens: () => null,
      async* streamChatWithTools(messages: any[], tools: Record<string, any>) {
        calls.push({ tools: Object.keys(tools), system: messages[0].content });
        if (Object.keys(tools).length > 0) {
          yield { type: 'error', content: { type: 'error', error: { message: '"small:4b" does not support tools', kind: 'no-tools', details: '' } } };
          return;
        }
        yield { type: 'text-delta', content: { text: 'An answer from the graph.' } };
      },
    };
    await runAgentTurn({
      db,
      messages: [{ role: 'user', content: 'What is on https://docs.example/page ?' }],
      toolSpecs: [],
      run: { projectId: P, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
      language: 'en',
      send: (chunk) => chunks.push(chunk),
      notify: () => undefined,
      llm: llm as never,
      preferences: parsePreferences({}),
      fetchImpl: async () => { throw new Error('no network'); },
    });
    expect(calls).toHaveLength(2);
    // The window was never seen: short mode from the first question, and the page reader kept for the person's link.
    expect(calls[0].tools).toContain('fetchPage');
    expect(calls[0].tools).not.toContain('searchWeb');
    expect(calls[0].system).toContain('a context window of a size not known yet');
    expect(calls[1].tools).toEqual([]);
    expect(calls[1].system).toContain('This model cannot call tools');
    expect(chunks.filter((chunk) => chunk.type === 'error')).toEqual([]);
    expect(chunks.find((chunk) => chunk.type === 'notice')?.content).toMatchObject({ code: 'no-tools' });
    expect(chunks.at(-1)?.type).toBe('done');
    expect(readProjection(db, P)!.activeRun).toBeNull();
  });
});
