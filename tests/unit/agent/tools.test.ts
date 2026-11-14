import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { createAgentTools, OUTSIDE_DATA, PROPOSAL_BUILD_TWIN, type AgentToolDefinition } from '../../../src/main/agent/tools';
import { ConversationLinks, LINK_NOT_IN_CONVERSATION, linksInText } from '../../../src/main/agent/links';
import { MAIN_TOOL_SPECS } from '../../../src/main/agent/toolSpecs';
import { ensureWorkspace, startRun } from '../../../src/main/commands/commit';
import { migrate } from '../../../src/main/settings/migrate';
import { AGENT_KNOWLEDGE_TOOLS, AGENT_PROPOSAL_TOOLS, AGENT_READ_TOOLS } from '../../../src/shared/contracts';
import { IPC_CHANNELS } from '../../../src/shared/ipc-channels';
import { DESKTOP_PROJECT_ID } from '../../../src/shared/project';
import { fakeKnowledge, fakeProposals, throwingKnowledge } from './fakes';
import type { FetchLike } from '../../../src/main/agent/web';

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

function setup(overrides: Partial<Parameters<typeof createAgentTools>[0]> = {}) {
  const db = openDb();
  const run = startRun(db, DESKTOP_PROJECT_ID);
  const knowledge = fakeKnowledge();
  const proposals = fakeProposals();
  const pushed: Array<{ channel: string; payload: unknown }> = [];
  const fetched: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    fetched.push(url);
    return new Response('<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2F">Example</a>');
  };
  const tools = createAgentTools({
    db,
    projectId: DESKTOP_PROJECT_ID,
    runId: run.runId,
    revision: run.expectedRevisionId,
    knowledge,
    proposals,
    fetchImpl,
    notify: (channel, payload) => pushed.push({ channel, payload }),
    ...overrides,
  });
  const call = (name: string, args: unknown) => (tools[name] as AgentToolDefinition).execute(args) as Promise<any>;
  return { db, run, tools, knowledge, proposals, pushed, fetched, call };
}

describe('agent tools factory', () => {
  it('exposes every read, knowledge, and proposal tool with a JSON schema', () => {
    const { tools } = setup();
    for (const name of [...AGENT_READ_TOOLS, ...AGENT_KNOWLEDGE_TOOLS, ...AGENT_PROPOSAL_TOOLS]) {
      expect(tools[name], name).toBeDefined();
      expect(MAIN_TOOL_SPECS[name].parameters.type).toBe('object');
    }
  });

  it('reads the catalog through the knowledge repository', async () => {
    const { call } = setup();
    expect((await call('searchNodeTypes', { query: 'sampler' })).results.map((item: any) => item.classType)).toEqual(['KSampler']);
    const described = (await call('describeNodeType', { classType: 'KSampler' })).node;
    expect(described.outputs).toEqual([{ name: 'LATENT', type: 'LATENT', handle: 'out-0' }]);
    // Sockets first, then widget inputs, as ComfyUI numbers the slots.
    expect(described.inputs.map((input: any) => [input.name, input.handle])).toEqual([['model', 'in-0'], ['seed', 'in-1']]);
    expect(await call('describeNodeType', { classType: 'Missing' })).toMatchObject({ success: false });
    expect((await call('findInstalledModels', { query: 'portrait', kind: 'lora' })).results).toHaveLength(2);
    expect((await call('describeModel', { directory: 'loras', name: 'portrait_flux.safetensors' })).model.triggerWords).toEqual(['ptdetail']);
    expect((await call('checkGraph', {})).report.ok).toBe(true);
    expect(await call('searchNodeTypes', { limit: 'x' })).toMatchObject({ success: false });
  });

  it('turns a throwing knowledge stub into a tool failure, not a crash', async () => {
    const { call } = setup({ knowledge: throwingKnowledge() });
    expect(await call('searchNodeTypes', { query: 'x' })).toEqual({ success: false, error: 'knowledge: not implemented yet' });
  });

  it('summarizes the graph without widget values', async () => {
    const secret = 'sk-secretvalue123';
    const { call } = setup({
      readGraph: () => ({
        projectId: DESKTOP_PROJECT_ID,
        currentRevisionId: 'rev-9',
        revSeq: 9,
        activeRun: null,
        snapshot: {
          nodes: [
            {
              id: 'node-a',
              data: {
                comfyType: 'CheckpointLoaderSimple',
                title: 'Loader',
                outputs: [{ id: 'out-0', name: 'MODEL', dataType: 'MODEL' }],
                parameters: { ckpt_name: secret },
                comfy: { widgets_values: [secret] },
              },
            },
            { id: 'node-b', data: { comfyType: 'KSampler', title: `api_key=${secret}`, inputs: [{ id: 'in-0', name: 'model', dataType: 'MODEL' }] } },
          ],
          edges: [{ id: 'link-1', source: 'node-a', sourceHandle: '0', target: 'node-b', targetHandle: '0', data: { dataType: 'MODEL' } }],
        },
      }),
    });
    const graph = await call('getGraph', {});
    expect(graph.success).toBe(true);
    expect(graph.revisionId).toBe('rev-9');
    expect(graph.nodes.map((node: any) => node.classType)).toEqual(['CheckpointLoaderSimple', 'KSampler']);
    expect(graph.nodes[1].title).toBe('[redacted]');
    expect(graph.edges[0]).toMatchObject({ source: 'node-a', sourceName: 'MODEL', target: 'node-b', targetName: 'model', type: 'MODEL' });
    expect(JSON.stringify(graph)).not.toContain(secret);
  });

  it('reads the real projection by default', async () => {
    const { call } = setup();
    expect(await call('getGraph', {})).toMatchObject({ success: true, nodes: [], edges: [] });
  });

  it('creates a ghost proposal through mutationFromTool and pushes the list', async () => {
    const { call, proposals, pushed, run } = setup();
    const result = await call('proposeNode', { nodeType: 'KSampler', title: 'Sampler', note: 'Turns noise into an image.' });
    expect(result).toMatchObject({ success: true, proposalId: 'prop-1', kind: 'add-node', note: 'Turns noise into an image.' });
    expect(proposals.created[0]).toMatchObject({
      projectId: DESKTOP_PROJECT_ID,
      runId: run.runId,
      kind: 'add-node',
      revisionId: run.expectedRevisionId,
      payload: { type: 'add-node', nodeType: 'KSampler', title: 'Sampler' },
    });
    expect(proposals.created[0].payload).not.toHaveProperty('note');
    expect(pushed).toEqual([{ channel: IPC_CHANNELS.PROPOSALS_EVENT, payload: proposals.created }]);
  });

  it('refuses a proposal without a note or with a shape the engine cannot map', async () => {
    const { call, proposals } = setup();
    expect(await call('proposeNode', { nodeType: 'KSampler' })).toMatchObject({ success: false });
    // A connection with no target has no mutation, so nothing is proposed.
    const unmapped = await call('proposeConnection', { source: 'a', sourceHandle: '0', note: 'Link them.' });
    expect(unmapped.success).toBe(false);
    expect(unmapped.error).toContain(PROPOSAL_BUILD_TWIN.proposeConnection);
    expect(proposals.created).toEqual([]);
    // The engine maps the full shape, so the same tool then drafts a connect proposal.
    const mapped = await call('proposeConnection', { source: 'a', sourceHandle: '0', target: 'b', targetHandle: '0', note: 'Link them.' });
    expect(mapped).toMatchObject({ success: true, kind: 'connect' });
    expect(proposals.created).toHaveLength(1);
    expect(proposals.created[0].payload).toMatchObject({ type: 'connect', source: 'a', target: 'b' });
  });

  it('reports a failing proposal repository as a tool error', async () => {
    const { call } = setup({ proposals: { createProposal: () => { throw new Error('proposals: createProposal is not implemented yet'); }, listProposals: () => [] } });
    expect(await call('proposeNode', { nodeType: 'KSampler', note: 'n' })).toEqual({ success: false, error: 'proposals: createProposal is not implemented yet' });
  });

  it('saves explanations as ai with project scope only for project objects', async () => {
    const { call, knowledge, run } = setup();
    expect(await call('explain', {
      owner: { kind: 'node', id: 'node-1', classType: 'KSampler' }, aspect: 'why', text: 'It samples.', provenance: 'inference',
    })).toMatchObject({ success: true, explanationId: 'exp-1' });
    expect(knowledge.saved[0]).toEqual({
      projectId: DESKTOP_PROJECT_ID,
      owner: { kind: 'node', id: 'node-1', classType: 'KSampler' },
      aspect: 'why',
      text: 'It samples.',
      provenance: 'inference',
      sourceUrl: null,
      revisionId: run.expectedRevisionId,
      createdBy: 'ai',
    });
    await call('explain', { owner: { kind: 'nodeClass', id: 'KSampler' }, aspect: 'what', text: 'Docs say so.', provenance: 'web', sourceUrl: 'https://docs.comfy.org/' });
    expect(knowledge.saved[1]).toMatchObject({ projectId: null, revisionId: null, provenance: 'web', sourceUrl: 'https://docs.comfy.org/' });
    expect(await call('explain', { owner: { kind: 'model', id: 'loras/x' }, aspect: 'what', text: 't', provenance: 'web' })).toMatchObject({ success: false });
    expect(await call('explain', { owner: { kind: 'node', id: 'n' }, aspect: 'what', text: 't', provenance: 'user' })).toMatchObject({ success: false });
    expect(await call('explain', { owner: { kind: 'node', id: 'n' }, aspect: 'what', text: 'key is sk-abc123', provenance: 'fact' })).toMatchObject({ success: false });
    expect(knowledge.saved).toHaveLength(2);
  });

  it('uses the fallback web search unless the provider has a native one', async () => {
    const fallback = setup();
    const found = await fallback.call('searchWeb', { query: 'ksampler' });
    expect(found).toMatchObject({ success: true, provenance: 'web', results: [{ title: 'Example', url: 'https://example.org/' }] });
    expect(fallback.fetched).toEqual(['https://html.duckduckgo.com/html/?q=ksampler']);

    // Neither search page can be read: the tool says the search is unavailable, never "nothing found" (L5).
    const down = setup({ fetchImpl: async () => new Response('', { status: 503 }) });
    expect(await down.call('searchWeb', { query: 'ksampler' })).toMatchObject({ success: false, unavailable: true, error: expect.stringContaining('unavailable now') });

    const native = { type: 'provider', id: 'openai.web_search' };
    const withNative = setup({ nativeSearch: native });
    expect(withNative.tools.searchWeb).toBe(native);
  });

  it('reads public pages only', async () => {
    // Even an address the person wrote is not read when it points into this machine.
    const links = new ConversationLinks();
    links.add(['http://127.0.0.1:18188/object_info']);
    const { call, fetched } = setup({ links });
    expect(await call('fetchPage', { url: 'http://127.0.0.1:18188/object_info' })).toEqual({ success: false, error: 'Only public http(s) addresses can be read.' });
    expect(fetched).toEqual([]);
  });

  it('opens only addresses the person wrote or a search returned, and marks outside text as data', async () => {
    const links = new ConversationLinks();
    links.add(linksInText('Read https://docs.example.org/ksampler please.'));
    const { call, fetched } = setup({ links });
    // An address planted in a model description or a page: refused, nothing fetched, the model is told to ask.
    const planted = await call('fetchPage', { url: 'https://collect.example/x?d=a%20red%20fox' });
    expect(planted).toEqual({ success: false, error: LINK_NOT_IN_CONVERSATION });
    expect(await call('fetchPage', { url: 'https://docs.example.org/ksampler?d=1' })).toMatchObject({ success: false });
    expect(fetched).toEqual([]);
    // The written address passes the conversation check (the page reader's own address checks follow).
    const page = await call('fetchPage', { url: 'https://docs.example.org/ksampler#inputs' });
    expect(page).not.toEqual({ success: false, error: LINK_NOT_IN_CONVERSATION });
    // A search result becomes an address that may be opened; its results are marked as outside data.
    const found = await call('searchWeb', { query: 'ksampler' });
    expect(found).toMatchObject({ success: true, notice: OUTSIDE_DATA });
    expect(links.allows('https://example.org/')).toBe(true);
    // Without the conversation's addresses nothing is opened at all.
    const bare = setup();
    expect(await bare.call('fetchPage', { url: 'https://docs.example.org/ksampler' })).toEqual({ success: false, error: LINK_NOT_IN_CONVERSATION });
  });
});
