import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runAgentTurn } from '../../../src/main/agent/turn';
import { mainLLMService } from '../../../src/main/llmService';
import { ensureWorkspace, readProjection, startRun } from '../../../src/main/commands/commit';
import { migrate } from '../../../src/main/settings/migrate';
import { DESKTOP_PROJECT_ID } from '../../../src/shared/project';
import { IPC_CHANNELS } from '../../../src/shared/ipc-channels';
import { fakeKnowledge, fakeProposals } from './fakes';

const RENDERER_SPECS = [
  { name: 'addNode', description: 'Add a node', parameters: { type: 'object', properties: { nodeType: { type: 'string' }, title: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' } }, required: ['nodeType'] } },
  { name: 'annotateNode', description: 'Annotate', parameters: { type: 'object', properties: { nodeId: { type: 'string' }, annotation: { type: 'string' } }, required: ['nodeId', 'annotation'] } },
  // A renderer spec must not replace a main tool that is not a build tool.
  { name: 'explain', description: 'renderer explain', parameters: { type: 'object', properties: {} } },
];

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

async function turn(text: string, extra: Partial<Parameters<typeof runAgentTurn>[0]> = {}) {
  const db = openDb();
  const run = startRun(db, DESKTOP_PROJECT_ID);
  const chunks: Array<{ type: string; content?: any }> = [];
  const pushed: Array<{ channel: string; payload: unknown }> = [];
  const knowledge = fakeKnowledge();
  const proposals = fakeProposals();
  const systems: string[] = [];
  const llm = {
    nativeSearchTool: () => mainLLMService.nativeSearchTool(),
    streamChatWithTools: (messages: any[], tools: Record<string, any>) => {
      systems.push(...messages.filter((message) => message.role === 'system').map((message) => message.content));
      return mainLLMService.streamChatWithTools(messages, tools);
    },
  };
  await runAgentTurn({
    db,
    messages: [{ role: 'system', content: 'renderer system text' }, { role: 'user', content: text }],
    toolSpecs: RENDERER_SPECS,
    run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
    language: 'en',
    send: (chunk) => chunks.push(chunk),
    notify: (channel, payload) => pushed.push({ channel, payload }),
    llm,
    knowledge,
    proposals,
    fetchImpl: async () => { throw new Error('no network in unit tests'); },
    ...extra,
  });
  return { db, chunks, pushed, knowledge, proposals, systems, types: chunks.map((chunk) => chunk.type) };
}

describe('agent turn (llm:stream-chat)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mainLLMService.setConfig({ provider: 'test', model: 'test-fixture' });
  });
  afterEach(() => {
    mainLLMService.setConfig({ provider: '' });
    vi.restoreAllMocks();
  });

  it('keeps the legacy build flow: tool-call, projection, tool-result, text, done', async () => {
    const { db, chunks, types, systems } = await turn('Add a test node', { context: { intent: 'build', selection: [] } });
    expect(types[types.length - 1]).toBe('done');
    expect(types).not.toContain('error');
    // A projection is pushed while the tool executes, before the SDK yields the matching tool-call part.
    const order = types.filter((type) => ['tool-call', 'tool-result', 'text-delta'].includes(type));
    expect(order.slice(0, 4)).toEqual(['tool-call', 'tool-result', 'tool-call', 'tool-result']);
    expect(order).toContain('text-delta');
    // Two commits, then the projection of the closed run before done.
    expect(types.filter((type) => type === 'projection')).toHaveLength(3);
    expect(types[types.length - 2]).toBe('projection');
    expect(readProjection(db, DESKTOP_PROJECT_ID)?.activeRun).toBeNull();
    expect(types.indexOf('projection')).toBeLessThan(types.indexOf('tool-result'));
    const results = chunks.filter((chunk) => chunk.type === 'tool-result').map((chunk) => chunk.content.output);
    expect(results[0]).toMatchObject({ success: true, nodeType: 'TestNode' });
    expect(results[1]).toMatchObject({ success: true });
    expect(readProjection(db, DESKTOP_PROJECT_ID)?.snapshot.nodes).toHaveLength(1);
    // The main prompt replaces the renderer's system message.
    expect(systems).toHaveLength(1);
    expect(systems[0]).not.toContain('renderer system text');
    expect(systems[0]).toContain('Catalog: 3 node classes');
  }, 15000);

  it('proposes a ghost instead of committing and pushes the proposal list', async () => {
    const { db, chunks, pushed, proposals, types } = await turn('Please propose a sampler', { context: { intent: 'chat', selection: [] } });
    expect(types).toContain('tool-call');
    // No commit: the only projection is the closed run's, right before done.
    expect(types.filter((type) => type === 'projection')).toHaveLength(1);
    expect(types[types.length - 2]).toBe('projection');
    expect(types[types.length - 1]).toBe('done');
    expect(proposals.created).toHaveLength(1);
    expect(proposals.created[0].payload).toMatchObject({ type: 'add-node', nodeType: 'KSampler' });
    expect(pushed.map((item) => item.channel)).toEqual([IPC_CHANNELS.PROPOSALS_EVENT]);
    expect(readProjection(db, DESKTOP_PROJECT_ID)?.snapshot.nodes).toEqual([]);
    const text = chunks.filter((chunk) => chunk.type === 'text-delta').map((chunk) => chunk.content.text).join('');
    expect(text).toContain('ghost');
  }, 15000);

  it('saves an explanation through the main explain tool, not the renderer spec', async () => {
    const { knowledge, chunks } = await turn('explain this', { context: { intent: 'ask', objectRef: { kind: 'nodeClass', id: 'KSampler' }, selection: [] } });
    expect(knowledge.saved).toHaveLength(1);
    expect(knowledge.saved[0]).toMatchObject({ createdBy: 'ai', provenance: 'inference', projectId: null });
    const result = chunks.find((chunk) => chunk.type === 'tool-result');
    expect(result?.content.output).toMatchObject({ success: true, explanationId: 'exp-1' });
  }, 15000);

  it('sends an error chunk when the provider is blocked', async () => {
    mainLLMService.setConfig({ provider: 'openai', model: 'x' });
    mainLLMService.forgetKeys();
    const { chunks } = await turn('hello');
    expect(chunks.filter((chunk) => chunk.type !== 'projection')).toEqual([{ type: 'error', content: 'Cloud model has no key for this session.' }]);
    expect(chunks[chunks.length - 1].type).toBe('error');
  });
});
