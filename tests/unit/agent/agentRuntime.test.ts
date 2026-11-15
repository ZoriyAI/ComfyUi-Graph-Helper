/**
 * Protects the assistant's run loop end to end: tools reach Google models, ports resolve by name or slot, action ids
 * are scoped per run, getGraph pages large graphs, the answer language follows the question, secrets never leave in
 * errors or prompts, Ask and Chat never build, and Stop really ends a turn. A person relies on each of these when
 * they let the assistant read or change their graph. The "item N" labels group the cases by topic.
 */
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LanguageModelV4, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { convertArrayToReadableStream } from '@ai-sdk/provider-utils/test';
import { createBuildTools } from '../../../src/main/agent/buildTools';
import { createAgentTools, type AgentToolDefinition } from '../../../src/main/agent/tools';
import { buildToolsAllowed, runAgentTurn } from '../../../src/main/agent/turn';
import { trimHistory } from '../../../src/main/agent/history';
import { writtenLanguage, buildSystemPrompt } from '../../../src/main/agent/prompt';
import { failureStreakReached, forwardPart } from '../../../src/main/agent/streamParts';
import { MainLLMService, mainLLMService } from '../../../src/main/llmService';
import { setMcpToken } from '../../../src/main/mcp/token';
import { readCatalog } from '../../../src/main/catalog/repository';
import { cancelRun, ensureWorkspace, readProjection, startRun } from '../../../src/main/commands/commit';
import { migrate } from '../../../src/main/settings/migrate';
import { graphSummaryText, summarizeGraph } from '../../../src/shared/agent/graph';
import { parseTurnContext } from '../../../src/shared/agent/turnContext';
import { exactMatchRedactor, redactSecrets } from '../../../src/shared/agent/redact';
import { BUILD_TOOL_SPECS } from '../../../src/shared/commands/toolSpecs';
import { AGENT_BUILD_TOOLS, AGENT_KNOWLEDGE_TOOLS, AGENT_PROPOSAL_TOOLS, AGENT_READ_TOOLS } from '../../../src/shared/contracts';
import { DESKTOP_PROJECT_ID } from '../../../src/shared/project';
import { fakeKnowledge, fakeProposals } from './fakes';

/** A fresh in-memory database with the schema and the desktop workspace, like the app has after first start. */
function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

type Exec = { execute: (args: Record<string, unknown>, call?: { toolCallId?: string }) => Promise<any> };

/** Starts a run and returns the build tools bound to it, reading the live projection and catalog on each call. */
function buildSetup(db = openDb()) {
  const run = startRun(db, DESKTOP_PROJECT_ID);
  const tools = createBuildTools(BUILD_TOOL_SPECS as any, {
    db,
    run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
    toolContext: () => ({ snapshot: readProjection(db, DESKTOP_PROJECT_ID)?.snapshot as any, catalog: readCatalog(db) }),
  }) as unknown as Record<string, Exec>;
  return { db, run, tools };
}

function finish(unified: 'stop' | 'tool-calls'): LanguageModelV4StreamPart {
  return {
    type: 'finish',
    finishReason: { unified, raw: unified },
    usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
  };
}

/** A language model whose stream the test writes by hand; generate is never used by the app. */
function scriptedModel(doStream: LanguageModelV4['doStream']): LanguageModelV4 {
  return {
    specificationVersion: 'v4',
    provider: 'test',
    modelId: 'scripted',
    supportedUrls: {},
    async doGenerate() { throw new Error('stream only'); },
    doStream,
  };
}

/** A real LLM service that hands out the scripted model instead of building a provider client. */
function serviceWith(model: LanguageModelV4): MainLLMService {
  const service = new MainLLMService();
  service.setConfig({ provider: 'test', model: 'scripted' });
  vi.spyOn(service, 'getModel').mockReturnValue(model);
  return service;
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Google tools (item 1)', () => {
  it('sends function declarations for gemini-2.5-flash instead of only the search tool', async () => {
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const service = new MainLLMService();
    service.setSessionKey('google', 'google-key-for-request-capture');
    service.setConfig({ provider: 'google', model: 'gemini-2.5-flash', baseURL: '' });
    // Capture the request body and answer with an error: only what was sent matters here.
    const bodies: any[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      bodies.push(JSON.parse(String((init as RequestInit).body)));
      return new Response(JSON.stringify({ error: { message: 'captured', code: 400 } }), { status: 400, headers: { 'content-type': 'application/json' } });
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const tools = createAgentTools({
      db, projectId: DESKTOP_PROJECT_ID, runId: run.runId, revision: run.expectedRevisionId,
      knowledge: fakeKnowledge(), proposals: fakeProposals(), nativeSearch: service.nativeSearchTool(),
    });
    const parts: string[] = [];
    for await (const part of service.streamChatWithTools([{ role: 'user', content: 'hi' }], tools as any)) parts.push(part.type);
    expect(bodies.length).toBeGreaterThan(0);
    const declared = (bodies[0].tools ?? []).flatMap((tool: any) => tool.functionDeclarations ?? []).map((item: any) => item.name);
    expect(declared).toEqual(expect.arrayContaining(['getGraph', 'proposeNode', 'searchWeb', 'explain']));
    expect(JSON.stringify(bodies[0].tools)).not.toContain('googleSearch');
    // The renderer only gets a redacted message, not the error object.
    expect(parts).toContain('error');
  });
});

describe('ports by name and slot (item 2)', () => {
  it('addNode returns handles; connectNodes resolves a port name and a slot index to the right handle', async () => {
    const { db, tools } = buildSetup();
    const loader = await tools.addNode.execute({ nodeType: 'CheckpointLoaderSimple', why: 'w' }, { toolCallId: 'a1' });
    const encoder = await tools.addNode.execute({ nodeType: 'CLIPTextEncode', why: 'w' }, { toolCallId: 'a2' });
    expect(loader.outputs).toEqual([
      { handle: 'out-0', name: 'MODEL', type: 'MODEL' },
      { handle: 'out-1', name: 'CLIP', type: 'CLIP' },
      { handle: 'out-2', name: 'VAE', type: 'VAE' },
    ]);
    expect(encoder.inputs.map((port: any) => `${port.name} ${port.handle}`)).toEqual(['clip in-0', 'text in-1']);

    const byName = await tools.connectNodes.execute({ sourceNodeId: loader.nodeId, sourceHandle: 'CLIP', targetNodeId: encoder.nodeId, targetHandle: 'clip', why: 'w' }, { toolCallId: 'c1' });
    expect(byName.success).toBe(true);
    let edges = readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.edges as any[];
    expect(edges.map((edge) => [edge.sourceHandle, edge.targetHandle])).toEqual([['out-1', 'in-0']]);

    const second = await tools.addNode.execute({ nodeType: 'CLIPTextEncode', why: 'w' }, { toolCallId: 'a3' });
    const byIndex = await tools.connectNodes.execute({ sourceNodeId: loader.nodeId, sourceOutputIndex: 1, targetNodeId: second.nodeId, targetInputIndex: 0, why: 'w' }, { toolCallId: 'c2' });
    expect(byIndex.success).toBe(true);
    edges = readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.edges as any[];
    expect(edges.find((edge) => edge.target === second.nodeId)).toMatchObject({ sourceHandle: 'out-1', targetHandle: 'in-0' });
  });

  it('proposeConnection resolves a port name against the snapshot', async () => {
    const { db, run, tools } = buildSetup();
    const loader = await tools.addNode.execute({ nodeType: 'CheckpointLoaderSimple', why: 'w' }, { toolCallId: 'a1' });
    const encoder = await tools.addNode.execute({ nodeType: 'CLIPTextEncode', why: 'w' }, { toolCallId: 'a2' });
    const proposals = fakeProposals();
    const main = createAgentTools({
      db, projectId: DESKTOP_PROJECT_ID, runId: run.runId, revision: () => readProjection(db, DESKTOP_PROJECT_ID)!.currentRevisionId,
      knowledge: fakeKnowledge(), proposals,
      toolContext: () => ({ snapshot: readProjection(db, DESKTOP_PROJECT_ID)?.snapshot as any, catalog: readCatalog(db) }),
    });
    const result = await (main.proposeConnection as AgentToolDefinition).execute({ sourceNodeId: loader.nodeId, sourceHandle: 'CLIP', targetNodeId: encoder.nodeId, targetHandle: 'clip', note: 'CLIP feeds the encoder.' }) as any;
    expect(result.success).toBe(true);
    expect(proposals.created[0].payload).toMatchObject({ type: 'connect', sourceHandle: 'out-1', targetHandle: 'in-0' });
  });

  it('describes ports as name (in-N) in the prompt graph text', () => {
    const summary = summarizeGraph({ nodes: [{ id: 'n1', data: { comfyType: 'CLIPTextEncode', inputs: [{ id: 'in-0', name: 'clip' }, { id: 'in-1', name: 'text' }], outputs: [{ id: 'out-0', name: 'CONDITIONING' }] } }], edges: [] });
    expect(graphSummaryText(summary)).toContain('inputs: clip (in-0), text (in-1); outputs: CONDITIONING (out-0)');
  });
});

describe('action ids (item 8)', () => {
  it('scopes the provider call id to the run, so the same id in a new run is a new command', async () => {
    const db = openDb();
    const first = buildSetup(db);
    const a = await first.tools.addNode.execute({ nodeType: 'KSampler', why: 'w' }, { toolCallId: 'call-add-node' });
    const second = buildSetup(db);
    const b = await second.tools.addNode.execute({ nodeType: 'KSampler', why: 'w' }, { toolCallId: 'call-add-node' });
    const c = await second.tools.addNode.execute({ nodeType: 'KSampler', why: 'w' }, {});
    // Node ids are numeric (engine counter); three distinct commands made three nodes.
    expect([a.nodeId, b.nodeId, c.nodeId]).toEqual(['1', '2', '3']);
    expect(db.prepare('SELECT action_id FROM applied_commands ORDER BY rowid').all().map((row: any) => row.action_id)).toEqual([
      `${first.run.runId}:call-add-node`,
      `${second.run.runId}:call-add-node`,
      expect.stringMatching(new RegExp(`^${second.run.runId}:[0-9a-f-]{36}$`)),
    ]);
    expect(readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.nodes).toHaveLength(3);
  });
});

describe('getGraph paging and the prompt cap (item 3)', () => {
  const many = (count: number) => ({ nodes: Array.from({ length: count }, (_, index) => ({ id: `n${index}`, data: { comfyType: 'KSampler' } })), edges: [] });

  it('pages with offset and limit (default 200) and reads ids', async () => {
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const projection = { ...readProjection(db, DESKTOP_PROJECT_ID)!, snapshot: many(450) as any };
    const tools = createAgentTools({ db, projectId: DESKTOP_PROJECT_ID, runId: run.runId, revision: run.expectedRevisionId, knowledge: fakeKnowledge(), proposals: fakeProposals(), readGraph: () => projection });
    const call = (args: unknown) => (tools.getGraph as AgentToolDefinition).execute(args) as Promise<any>;
    const page1 = await call({});
    expect(page1.nodes).toHaveLength(200);
    expect(page1).toMatchObject({ totalNodes: 450, offset: 0, nextOffset: 200 });
    const page3 = await call({ offset: 400 });
    expect(page3.nodes.map((node: any) => node.id)[0]).toBe('n400');
    expect(page3.nextOffset).toBeNull();
    expect((await call({ ids: ['n5', 'n300'] })).nodes.map((node: any) => node.id)).toEqual(['n5', 'n300']);
  });

  it('keeps selected, asked-about and recently touched nodes on any page and points to getGraph({ offset })', () => {
    const summary = summarizeGraph(many(100), { selectedIds: ['n90'], priorityIds: ['n95', 'n99'], limit: 60 });
    const ids = summary.nodes.map((node) => node.id);
    expect(ids).toHaveLength(63);
    expect(ids).toEqual(expect.arrayContaining(['n0', 'n59', 'n90', 'n95', 'n99']));
    expect(graphSummaryText(summary)).toContain('37 more nodes not listed; call getGraph({ offset: 60 })');
    // The prompt itself has no cap: without a limit every node is listed.
    expect(summarizeGraph(many(100)).nodes).toHaveLength(100);
  });
});

describe('turn context, language, history, loop guard (items 7, 9, 10)', () => {
  it('drops a bad selection item instead of the whole context, and keeps a large selection whole', () => {
    const parsed = parseTurnContext({ intent: 'build', selection: [{ kind: 'node', id: 'n1' }, { kind: 'bogus', id: 'x' }, 42, { kind: 'node', id: 'n2' }] }, 'en');
    expect(parsed.intent).toBe('build');
    expect(parsed.selection.map((ref) => ref.id)).toEqual(['n1', 'n2']);
    const big = parseTurnContext({ intent: 'ask', selection: Array.from({ length: 250 }, (_, index) => ({ kind: 'node', id: `n${index}` })) }, 'ru');
    expect(big.selection).toHaveLength(250);
    expect(big.language).toBe('ru');
  });

  it('answers in the language the person wrote in when it is clear', () => {
    expect(writtenLanguage('Почему здесь KSampler?')).toBe('ru');
    expect(writtenLanguage('Why is the sampler connected here?')).toBe('en');
    expect(writtenLanguage('KSampler?')).toBeNull();
    const context = parseTurnContext({ intent: 'chat', selection: [] }, 'en');
    expect(buildSystemPrompt({ context, graph: null, catalog: '', question: 'Как подключить VAE?' })).toContain('Answer in Russian.');
    const ru = parseTurnContext({ intent: 'chat', selection: [], language: 'ru' }, 'ru');
    expect(buildSystemPrompt({ context: ru, graph: null, catalog: '', question: 'How do I connect the VAE here?' })).toContain('Answer in English.');
    expect(buildSystemPrompt({ context: ru, graph: null, catalog: '', question: 'VAE?' })).toContain('Answer in Russian.');
  });

  it('trims the dialog to the budget, oldest first, starting with a person message', () => {
    const messages = [
      { role: 'user', content: 'a'.repeat(10_000) },
      { role: 'assistant', content: 'b'.repeat(10_000) },
      { role: 'user', content: 'c'.repeat(10_000) },
      { role: 'assistant', content: 'd'.repeat(5_000) },
      { role: 'user', content: 'last' },
    ];
    // The budget is in tokens and only the last three messages fit, so the two oldest go.
    const kept = trimHistory(messages, 6_000).messages;
    expect(kept.map((message) => message.content[0])).toEqual(['c', 'd', 'l']);
    // A tool message is never left without the call before it.
    const withTool = trimHistory([
      { role: 'user', content: 'x'.repeat(30_000) },
      { role: 'assistant', content: [{ type: 'tool-call' }] },
      { role: 'tool', content: [{ type: 'tool-result' }] },
      { role: 'user', content: 'now' },
    ], 40).messages;
    expect(withTool.map((message) => message.role)).toEqual(['user']);
    // The latest person message is kept even when it alone is over the budget.
    expect(trimHistory([{ role: 'user', content: 'z'.repeat(50_000) }], 6_000).messages).toHaveLength(1);
  });

  it('stops after three failed or conflicted tool results in a row', () => {
    const step = (...outputs: unknown[]) => ({ content: outputs.map((output) => (output === 'error' ? { type: 'tool-error' } : { type: 'tool-result', output })) });
    const stop = failureStreakReached(3);
    expect(stop({ steps: [step({ success: false }), step({ conflict: true, success: false })] })).toBe(false);
    expect(stop({ steps: [step({ success: false }), step('error'), step({ success: false })] })).toBe(true);
    expect(stop({ steps: [step({ success: false }), step({ success: false }), step({ success: true })] })).toBe(false);
  });
});

describe('secrets on the way out (item 5)', () => {
  it('forwards only the chat fields and redacts error messages, including the held key and MCP token', () => {
    const service = new MainLLMService();
    service.setSessionKey('anthropic', 'held-llm-key-1234567890');
    setMcpToken('held-mcp-token-0987654321');
    try {
      const part = forwardPart({
        type: 'error',
        error: new Error('401 for held-llm-key-1234567890 and held-mcp-token-0987654321, Bearer abc.def'),
        request: { body: 'secret' },
        providerMetadata: { x: 1 },
      }, service.redact);
      expect(Object.keys(part.content).sort()).toEqual(['error', 'type']);
      const text = JSON.stringify(part);
      expect(text).not.toContain('held-llm-key');
      expect(text).not.toContain('held-mcp-token');
      expect(text).not.toContain('abc.def');
      const delta = forwardPart({ type: 'text-delta', id: 't', text: 'hi', providerMetadata: { a: 1 } }, service.redact);
      expect(delta.content).toEqual({ type: 'text-delta', id: 't', text: 'hi' });
    } finally {
      setMcpToken('');
    }
  });

  it('redaction helpers keep the readable rest', () => {
    expect(redactSecrets('use sk-abcdef123 and Bearer tok.en; api_key=xyz ok')).toBe('use [redacted] and Bearer [redacted]; api_key=[redacted] ok');
    expect(exactMatchRedactor(['plain-held-value-123', null, 'short'])('x plain-held-value-123 short')).toBe('x [redacted] short');
  });

  it('keeps the held key and secret-shaped graph values out of the prompt', async () => {
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const systems: string[] = [];
    mainLLMService.setSessionKey('openai', 'held-session-key-for-prompt-77');
    try {
      await runAgentTurn({
        db,
        messages: [{ role: 'user', content: 'my key is held-session-key-for-prompt-77, explain' }],
        toolSpecs: [],
        run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
        language: 'en',
        send: () => undefined,
        notify: () => undefined,
        knowledge: fakeKnowledge(),
        proposals: fakeProposals(),
        llm: {
          nativeSearchTool: () => null,
          async* streamChatWithTools(messages: any[]) { systems.push(JSON.stringify(messages)); },
        } as any,
      });
    } finally {
      mainLLMService.forgetKeys();
    }
    expect(systems[0]).not.toContain('held-session-key-for-prompt-77');
    expect(systems[0]).toContain('[redacted]');
  });
});

describe('intent gating (item 6)', () => {
  it('offers build tools only in a build turn: Ask never builds, whatever the default setting', async () => {
    expect(buildToolsAllowed({ intent: 'build', selection: [], language: 'en' })).toBe(true);
    expect(buildToolsAllowed({ intent: 'chat', selection: [], language: 'en' })).toBe(false);
    expect(buildToolsAllowed({ intent: 'ask', selection: [], language: 'en' })).toBe(false);
    expect(buildToolsAllowed({ intent: 'chat', selection: [], language: 'en' }, 'build')).toBe(false);
    expect(buildToolsAllowed({ intent: 'ask', selection: [], language: 'en' }, 'build')).toBe(false);

    const offered: Record<string, string[]> = {};
    for (const intent of ['ask', 'chat', 'build'] as const) {
      const db = openDb();
      const run = startRun(db, DESKTOP_PROJECT_ID);
      await runAgentTurn({
        db,
        messages: [{ role: 'user', content: 'hi' }],
        toolSpecs: BUILD_TOOL_SPECS,
        context: { intent, selection: [] },
        run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
        language: 'en',
        send: () => undefined,
        notify: () => undefined,
        knowledge: fakeKnowledge(),
        proposals: fakeProposals(),
        llm: { nativeSearchTool: () => null, async* streamChatWithTools(_m: any[], tools: Record<string, unknown>) { offered[intent] = Object.keys(tools); } } as any,
      });
    }
    const readKnowledgePropose = [...AGENT_READ_TOOLS, ...AGENT_KNOWLEDGE_TOOLS, ...AGENT_PROPOSAL_TOOLS];
    for (const intent of ['ask', 'chat'] as const) {
      expect(offered[intent].sort()).toEqual([...readKnowledgePropose].sort());
    }
    expect(offered.build.sort()).toEqual([...readKnowledgePropose, ...AGENT_BUILD_TOOLS].sort());
  });
});

describe('cancellation and run lifecycle (item 4)', () => {
  it('aborts a stream that never completes, ends the turn with done, and closes the run', async () => {
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    let sawSignal = false;
    const model = scriptedModel(async ({ abortSignal }) => {
      sawSignal = abortSignal !== undefined;
      const stream = new ReadableStream<LanguageModelV4StreamPart>({
        start(controller) {
          controller.enqueue({ type: 'text-start', id: 't' });
          controller.enqueue({ type: 'text-delta', id: 't', delta: 'thinking…' });
          abortSignal?.addEventListener('abort', () => controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        },
      });
      return { stream, rawCall: { rawPrompt: null, rawSettings: {} } } as any;
    });
    const service = serviceWith(model);
    const controller = new AbortController();
    const chunks: Array<{ type: string; content?: any }> = [];
    const done = runAgentTurn({
      db,
      messages: [{ role: 'user', content: 'hello' }],
      toolSpecs: [],
      run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
      language: 'en',
      send: (chunk) => {
        chunks.push(chunk);
        // Press Stop as soon as the first words arrive; the stream itself never finishes.
        if (chunk.type === 'text-delta') controller.abort();
      },
      notify: () => undefined,
      signal: controller.signal,
      llm: service,
      knowledge: fakeKnowledge(),
      proposals: fakeProposals(),
    });
    // A turn that hangs after the abort fails on the test's time limit; no race against the wall clock.
    await expect(done.then(() => 'finished')).resolves.toBe('finished');
    expect(sawSignal).toBe(true);
    const types = chunks.map((chunk) => chunk.type);
    expect(types).not.toContain('error');
    expect(types[types.length - 1]).toBe('done');
    expect(readProjection(db, DESKTOP_PROJECT_ID)?.activeRun).toBeNull();
  });

  it('refuses proposals and explanations after cancel', async () => {
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const proposals = fakeProposals();
    const knowledge = fakeKnowledge();
    const controller = new AbortController();
    const tools = createAgentTools({ db, projectId: DESKTOP_PROJECT_ID, runId: run.runId, revision: run.expectedRevisionId, knowledge, proposals, signal: controller.signal });
    const propose = () => (tools.proposeNode as AgentToolDefinition).execute({ nodeType: 'KSampler', note: 'A sampler.' }) as Promise<any>;
    expect((await propose()).success).toBe(true);
    controller.abort();
    expect(await propose()).toMatchObject({ success: false });

    // Second path: the run is cancelled in the database rather than through the signal.
    const run2 = startRun(db, DESKTOP_PROJECT_ID);
    const tools2 = createAgentTools({ db, projectId: DESKTOP_PROJECT_ID, runId: run2.runId, revision: run2.expectedRevisionId, knowledge, proposals });
    cancelRun(db, DESKTOP_PROJECT_ID, run2.runId);
    expect(await (tools2.proposeNode as AgentToolDefinition).execute({ nodeType: 'KSampler', note: 'A sampler.' })).toMatchObject({ success: false });
    expect(await (tools2.explain as AgentToolDefinition).execute({ owner: { kind: 'nodeClass', id: 'KSampler' }, aspect: 'what', text: 'x', provenance: 'inference' })).toMatchObject({ success: false });
    expect(proposals.created).toHaveLength(1);
    expect(knowledge.saved).toHaveLength(0);
  });

  it('separates the text of consecutive steps with a blank line', async () => {
    let call = 0;
    const model = scriptedModel(async () => {
      call += 1;
      const parts: LanguageModelV4StreamPart[] = call === 1
        ? [{ type: 'text-start', id: 'a' }, { type: 'text-delta', id: 'a', delta: 'Looking.' }, { type: 'text-end', id: 'a' },
          { type: 'tool-call', toolCallId: 'x', toolName: 'noop', input: '{}' }, finish('tool-calls')]
        : [{ type: 'text-start', id: 'b' }, { type: 'text-delta', id: 'b', delta: 'Done.' }, { type: 'text-end', id: 'b' }, finish('stop')];
      return { stream: convertArrayToReadableStream(parts), rawCall: { rawPrompt: null, rawSettings: {} } } as any;
    });
    const service = serviceWith(model);
    const tools = { noop: { description: 'noop', inputSchema: (await import('ai')).jsonSchema({ type: 'object', properties: {} }), execute: async () => ({ success: true }) } };
    let text = '';
    for await (const part of service.streamChatWithTools([{ role: 'user', content: 'go' }], tools)) {
      if (part.type === 'text-delta') text += part.content.text;
    }
    expect(text).toBe('Looking.\n\nDone.');
  });
});
