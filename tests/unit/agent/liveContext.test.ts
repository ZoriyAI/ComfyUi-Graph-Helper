import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { buildSystemPrompt, recentText, viewportText } from '../../../src/main/agent/prompt';
import { createAgentTools, type AgentToolDefinition } from '../../../src/main/agent/tools';
import { commitCommand, ensureWorkspace, listRecentCommands, readProjection, startRun } from '../../../src/main/commands/commit';
import { migrate } from '../../../src/main/settings/migrate';
import { safeParameter, summarizeGraph } from '../../../src/shared/agent/graph';
import { describeCommand, recentActionsText, type RecentCommand } from '../../../src/shared/agent/recentActions';
import { parseTurnContext } from '../../../src/shared/agent/turnContext';
import type { GraphMutation } from '../../../src/shared/commands/types';
import { DESKTOP_PROJECT_ID } from '../../../src/shared/project';
import { fakeKnowledge, fakeProposals } from './fakes';

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

let counter = 0;
function manual(db: Database.Database, payload: GraphMutation) {
  const current = readProjection(db, DESKTOP_PROJECT_ID)!;
  counter += 1;
  const outcome = commitCommand(db, {
    projectId: DESKTOP_PROJECT_ID, actionId: `manual-${counter}`, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload,
  });
  expect(outcome.status).toBe('applied');
  return outcome.result as Record<string, unknown>;
}

const LONG = 'a cat on a sofa '.repeat(30);

const SNAPSHOT = {
  nodes: [
    { id: '2', position: { x: 10.4, y: 20.6 }, data: { comfyType: 'CLIPTextEncode', title: 'Positive', outputs: [{ id: 'out-0', name: 'CONDITIONING', dataType: 'CONDITIONING' }], parameters: { text: LONG } } },
    { id: '4', position: { x: 780.2, y: 119.7 }, measured: { width: 240.4, height: 180 }, data: {
      comfyType: 'KSampler', title: 'Sample',
      inputs: [{ id: 'in-0', name: 'model' }, { id: 'in-1', name: 'positive' }],
      comfy: { widgets_values: [42, 'fixed', 30], flags: { pinned: true }, mode: 4 },
    } },
    { id: '9', position: { x: 3000, y: 3000 }, data: { comfyType: 'LoadImage', parameters: { token: 'harmless', image: 'Bearer abc.def' } } },
  ],
  edges: [{ id: 'link-1', source: '2', sourceHandle: 'out-0', target: '4', targetHandle: 'in-1', data: { dataType: 'CONDITIONING' } }],
  groups: [{ id: 'g1', title: 'Prompts', nodeIds: ['2'] }],
  subgraphs: [{ id: 'def-1', name: 'Upscale', nodes: [{}, {}], edges: [], inputs: [], outputs: [] }],
};

describe('graph summary sees every field', () => {
  it('lists parameters clipped to 200 characters, positions, size, lock, mode, selection, groups and subgraphs', () => {
    const summary = summarizeGraph(SNAPSHOT, { selectedIds: ['4'] });
    const positive = summary.nodes[0];
    expect(positive.parameters[0].name).toBe('text');
    expect(positive.parameters[0].value.length).toBe(201);
    expect(positive.parameters[0].value.endsWith('…')).toBe(true);
    expect(positive.position).toEqual({ x: 10, y: 21 });
    const sampler = summary.nodes[1];
    expect(sampler.parameters).toEqual([{ name: 'widget[0]', value: '42' }, { name: 'widget[1]', value: 'fixed' }, { name: 'widget[2]', value: '30' }]);
    expect(sampler).toMatchObject({ size: { width: 240, height: 180 }, selected: true, locked: true, mode: 'bypassed' });
    expect(summary.nodes[2].parameters).toEqual([{ name: 'token', value: '[redacted]' }, { name: 'image', value: '[redacted]' }]);
    expect(summary.edges[0]).toMatchObject({ sourceName: 'CONDITIONING', targetName: 'positive' });
    expect(summary.groups).toEqual([{ id: 'g1', title: 'Prompts', nodeIds: ['2'] }]);
    expect(summary.subgraphs).toEqual([{ id: 'def-1', name: 'Upscale', instances: [], inner: 2 }]);
  });

  it('redacts secret-looking values and credential names only', () => {
    expect(safeParameter('steps', 30)).toBe('30');
    expect(safeParameter('seed', { a: 1 })).toBe('{"a":1}');
    expect(safeParameter('prompt', 'sk-abc123')).toBe('[redacted]');
    expect(safeParameter('prompt', 'api_key: x')).toBe('[redacted]');
    expect(safeParameter('api_key', 'anything')).toBe('[redacted]');
    expect(safeParameter('password', 'x')).toBe('[redacted]');
  });
});

describe('prompt: recent actions and what is on screen', () => {
  const commands: RecentCommand[] = [
    { actionId: 'a', actor: 'manual', type: 'move-node', ids: ['4'], timestamp: 1, revisionId: 'r1', payload: { type: 'move-node', nodeId: '4', x: 10, y: 10 } },
    { actionId: 'b', actor: 'manual', type: 'connect', ids: ['2', '4'], timestamp: 2, revisionId: 'r2', payload: { type: 'connect', source: '2', sourceHandle: 'out-0', target: '4', targetHandle: 'in-1' } },
    { actionId: 'c', actor: 'ai', type: 'add-node', ids: ['node-x'], timestamp: 3, revisionId: 'r3', payload: { type: 'add-node', nodeType: 'VAEDecode' } },
    { actionId: 'd', actor: 'manual', type: 'set-parameter', ids: ['4'], timestamp: 4, revisionId: 'r4', payload: { type: 'set-parameter', nodeId: '4', key: 'steps', value: 30 } },
    { actionId: 'e', actor: 'manual', type: 'move-node', ids: ['4'], timestamp: 5, revisionId: 'r5', payload: { type: 'move-node', nodeId: '4', x: 780.4, y: 120.2 } },
    { actionId: 'f', actor: 'manual', type: 'set-parameter', ids: ['2'], timestamp: 6, revisionId: 'r6', payload: { type: 'set-parameter', nodeId: '2', key: 'text', value: 'my key is sk-secret999' } },
  ];

  it('renders the person\'s actions with port names, the last move only, redacted values and the selection', () => {
    const summary = summarizeGraph(SNAPSHOT);
    const line = recentActionsText(commands, summary, ['2', '3']);
    expect(line).toBe('connected 2:CONDITIONING → 4:positive; set 4.steps = 30; moved node 4 to (780,120); set 2.text = [redacted]; selected nodes 2, 3');
    expect(line).not.toContain('VAEDecode');
    expect(describeCommand({ ...commands[0], type: 'import-workflow', payload: { type: 'import-workflow' } }, null)).toBe('imported a workflow');
    const context = parseTurnContext({ intent: 'chat', selection: [{ kind: 'node', id: '2' }, { kind: 'node', id: '3' }] }, 'en');
    expect(recentText(context, summary, commands)).toBe(`What the person did recently: ${line}.`);
  });

  it('says what is on screen from the viewport and leaves it out without one', () => {
    const graph = summarizeGraph(SNAPSHOT);
    const context = parseTurnContext({ intent: 'chat', selection: [], viewport: { x: 0, y: 0, zoom: 0.5, width: 1000, height: 600 } }, 'en');
    expect(viewportText(context, graph)).toBe('On screen: canvas at zoom 0.5 showing (0,0)-(2000,1200); nodes in view: 2 "Positive", 4 "Sample".');
    expect(viewportText(parseTurnContext({ intent: 'chat', selection: [] }, 'en'), graph)).toBe('');
    // A malformed viewport is dropped; the rest of the context stays.
    expect(parseTurnContext({ intent: 'build', selection: [], viewport: { x: 'a' } }, 'en')).toMatchObject({ intent: 'build' });
    const prompt = buildSystemPrompt({ context, graph, catalog: '', recent: commands });
    expect(prompt).toContain('On screen: canvas at zoom 0.5');
    expect(prompt).toContain('What the person did recently: connected 2:CONDITIONING → 4:positive');
    expect(prompt).toContain('fields: widget[0]=42; widget[1]=fixed; widget[2]=30');
    expect(prompt).toContain('- 4 KSampler "Sample" at (780,120) 240x180 [locked, bypassed]');
    expect(prompt).toContain('- group g1 "Prompts": nodes 2');
    expect(prompt).not.toContain('sk-secret999');
    expect(prompt).not.toContain('abc.def');
  });
});

describe('listRecentCommands', () => {
  it('returns the last applied commands oldest first with actor, type, ids and time', () => {
    const db = openDb();
    const added = manual(db, { type: 'add-node', nodeType: 'KSampler', x: 0, y: 0 });
    const nodeId = String(added.nodeId);
    manual(db, { type: 'move-node', nodeId, x: 780, y: 120 });
    manual(db, { type: 'annotate-node', nodeId, annotation: 'mine' });
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const ai = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID, actionId: 'ai-1', expectedRevisionId: run.expectedRevisionId, actor: 'ai', runId: run.runId,
      payload: { type: 'add-node', nodeType: 'VAEDecode' },
    });
    expect(ai.status).toBe('applied');
    const all = listRecentCommands(db, DESKTOP_PROJECT_ID);
    expect(all.map((item) => [item.actor, item.type])).toEqual([['manual', 'add-node'], ['manual', 'move-node'], ['manual', 'annotate-node'], ['ai', 'add-node']]);
    expect(all[1]).toMatchObject({ ids: [nodeId], payload: { type: 'move-node', nodeId, x: 780, y: 120 } });
    expect(all[0].ids).toEqual([nodeId]);
    expect(all[0].timestamp).toBeGreaterThan(0);
    expect(all[0].revisionId).toMatch(/^rev-/);
    expect(listRecentCommands(db, DESKTOP_PROJECT_ID, 2).map((item) => item.type)).toEqual(['annotate-node', 'add-node']);
    expect(listRecentCommands(db, DESKTOP_PROJECT_ID, 30, { actor: 'manual' })).toHaveLength(3);
    expect(listRecentCommands(db, 'missing-project')).toEqual([]);
  });

  it('drops bulky payloads', () => {
    const db = openDb();
    manual(db, { type: 'import-workflow', document: { last_node_id: 0, last_link_id: 0, nodes: [], links: [], version: 0.4 } });
    const [imported] = listRecentCommands(db, DESKTOP_PROJECT_ID);
    expect(imported.payload).toEqual({ type: 'import-workflow' });
  });
});

describe('getGraph returns every field', () => {
  it('includes parameters with the same redaction', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const tools = createAgentTools({
      db, projectId: DESKTOP_PROJECT_ID, runId: run.runId, revision: run.expectedRevisionId, knowledge: fakeKnowledge(), proposals: fakeProposals(),
      readGraph: () => ({ ...readProjection(db, DESKTOP_PROJECT_ID)!, snapshot: { ...SNAPSHOT } }),
    });
    const result = await (tools.getGraph as AgentToolDefinition).execute({}) as { success: boolean; nodes: Array<{ id: string; parameters: Array<{ name: string; value: string }> }> };
    expect(result.success).toBe(true);
    expect(result.nodes.find((node) => node.id === '9')?.parameters).toEqual([{ name: 'token', value: '[redacted]' }, { name: 'image', value: '[redacted]' }]);
    expect(result.nodes.find((node) => node.id === '4')?.parameters).toHaveLength(3);
    vi.restoreAllMocks();
  });
});
