import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from '../../src/renderer/state/chatState';
import { useKnowledgeStore } from '../../src/renderer/state/knowledgeState';
import { useProposalsStore } from '../../src/renderer/state/proposalsState';
import { useRevisionStore } from '../../src/renderer/state/revisionState';
import { useUiStore } from '../../src/renderer/state/uiState';
import { ChatService } from '../../src/renderer/services/llm/chatService';
import { useProjectionStore } from '../../src/renderer/services/commands/projection';
import { BUILD_TOOL_SPECS } from '../../src/shared/commands/toolSpecs';
import type { ChatRecord, Explanation, Proposal } from '../../src/shared/contracts';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';

/**
 * The chat service with a fake bridge: turn context, tool specs, explain and proposal routing, persistence, history.
 */

type Chunk = { type: string; content?: unknown };
type StreamImpl = (messages: unknown, specs: unknown, onChunk: (chunk: Chunk) => void, run: unknown, context: unknown) => Promise<void>;

const started = {
  runId: 'run-ctx',
  baseRevisionId: 'rev-ctx-1',
  expectedRevisionId: 'rev-ctx-1',
  projection: {
    projectId: DESKTOP_PROJECT_ID,
    snapshot: { nodes: [], edges: [] },
    currentRevisionId: 'rev-ctx-1',
    revSeq: 1,
    activeRun: { runId: 'run-ctx', status: 'running', expectedRevisionId: 'rev-ctx-1' },
  },
};

const explanation: Explanation = {
  id: 'exp-1',
  projectId: null,
  owner: { kind: 'nodeClass', id: 'KSampler', classType: 'KSampler' },
  aspect: 'what',
  text: 'KSampler denoises a latent step by step.',
  provenance: 'inference',
  sourceUrl: null,
  revisionId: null,
  createdBy: 'ai',
  createdAt: 10,
};

const proposal: Proposal = {
  id: 'prop-1',
  projectId: DESKTOP_PROJECT_ID,
  runId: 'run-ctx',
  kind: 'add-node',
  status: 'proposed',
  payload: { type: 'add-node', nodeType: 'KSampler' } as unknown as Proposal['payload'],
  note: 'The sampler turns noise into an image.',
  revisionId: 'rev-ctx-1',
  createdAt: 11,
  resolvedAt: null,
};

const api = {
  startRun: vi.fn(async () => started),
  llmStreamChat: vi.fn<StreamImpl>(),
  saveChatMessage: vi.fn(async (_record: ChatRecord) => ({ ok: true })),
  loadChatHistory: vi.fn(async (_projectId: string): Promise<ChatRecord[]> => []),
  listExplanations: vi.fn(async () => [explanation]),
  listProposals: vi.fn(async () => [proposal]),
  cancelRun: vi.fn(async () => ({ projection: null })),
};

(globalThis as unknown as { window: unknown }).window = { electronAPI: api };

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('chat service turn context and routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({ messages: [], isStreaming: false, isPaused: false });
    useKnowledgeStore.setState({ explanations: {}, recent: [] });
    useProposalsStore.setState({ proposals: [], resolving: [] });
    useUiStore.setState({ selection: [], focusRef: null });
    useRevisionStore.setState({ revisions: [], currentRevisionId: null });
    useProjectionStore.setState({ projectId: DESKTOP_PROJECT_ID, revSeq: 0, currentRevisionId: '', activeRun: null });
  });

  it('sends the build tool specs and a default chat context with the selection and language', async () => {
    useUiStore.setState({ selection: [{ kind: 'node', id: 'n1' }] });
    api.llmStreamChat.mockImplementation(async (_m, _s, onChunk) => onChunk({ type: 'done' }));
    await new ChatService().sendMessage('Hello');
    const call = api.llmStreamChat.mock.calls[0];
    expect(call[1]).toBe(BUILD_TOOL_SPECS);
    expect(call[3]).toEqual({ projectId: DESKTOP_PROJECT_ID, runId: 'run-ctx', expectedRevisionId: 'rev-ctx-1' });
    expect(call[4]).toEqual({ intent: 'chat', selection: [{ kind: 'node', id: 'n1' }], language: 'en' });
  });

  it('completes a partial context and keeps it on the person\'s message for the about chip', async () => {
    api.llmStreamChat.mockImplementation(async (_m, _s, onChunk) => onChunk({ type: 'done' }));
    const objectRef = { kind: 'port' as const, id: 'n2:in-0', nodeId: 'n2', portName: 'in-0', direction: 'input' as const };
    await new ChatService().sendMessage('What goes here?', { intent: 'ask', objectRef });
    expect(api.llmStreamChat.mock.calls[0][4]).toEqual({ intent: 'ask', objectRef, selection: [], language: 'en' });
    const user = useChatStore.getState().messages[0];
    expect(user.role).toBe('user');
    expect(user.context?.objectRef).toEqual(objectRef);
  });

  it('refreshes explanations and focuses the owner when explain succeeds', async () => {
    api.llmStreamChat.mockImplementation(async (_m, _s, onChunk) => {
      onChunk({ type: 'tool-call', content: { toolCallId: 'call-explain', toolName: 'explain', input: { owner: explanation.owner, aspect: 'what', text: explanation.text, provenance: 'inference' } } });
      onChunk({ type: 'tool-result', content: { toolCallId: 'call-explain', toolName: 'explain', output: { success: true, explanationId: 'exp-1', provenance: 'inference', owner: explanation.owner } } });
      onChunk({ type: 'text-delta', content: { text: 'Saved.' } });
      onChunk({ type: 'done' });
    });
    await new ChatService().sendMessage('explain this');
    await tick();
    expect(api.listExplanations).toHaveBeenCalledWith({ projectId: DESKTOP_PROJECT_ID, owner: explanation.owner });
    expect(useKnowledgeStore.getState().explanations['nodeClass:KSampler']).toEqual([explanation]);
    expect(useKnowledgeStore.getState().recent.map((item) => item.id)).toEqual(['exp-1']);
    expect(useUiStore.getState().focusRef).toEqual(explanation.owner);
    const call = useChatStore.getState().messages.find((m) => m.role === 'assistant')?.toolCalls?.[0];
    expect(call).toMatchObject({ name: 'explain', toolName: 'explain', kind: 'knowledge', status: 'success', explanationId: 'exp-1' });
  });

  it('does not route a failed explain', async () => {
    api.llmStreamChat.mockImplementation(async (_m, _s, onChunk) => {
      onChunk({ type: 'tool-call', content: { toolCallId: 'c', toolName: 'explain', input: {} } });
      onChunk({ type: 'tool-result', content: { toolCallId: 'c', toolName: 'explain', output: { success: false, error: 'Invalid arguments.' } } });
      onChunk({ type: 'done' });
    });
    await new ChatService().sendMessage('explain this');
    await tick();
    expect(api.listExplanations).not.toHaveBeenCalled();
    expect(useUiStore.getState().focusRef).toBeNull();
  });

  it('reloads proposals after a propose tool and records the proposal id', async () => {
    api.llmStreamChat.mockImplementation(async (_m, _s, onChunk) => {
      onChunk({ type: 'tool-call', content: { toolCallId: 'call-propose', toolName: 'proposeNode', input: { nodeType: 'KSampler', note: proposal.note } } });
      onChunk({ type: 'tool-result', content: { toolCallId: 'call-propose', toolName: 'proposeNode', output: { success: true, proposalId: 'prop-1', kind: 'add-node', note: proposal.note } } });
      onChunk({ type: 'done' });
    });
    await new ChatService().sendMessage('propose a sampler');
    await tick();
    await tick();
    expect(api.listProposals).toHaveBeenCalledWith(DESKTOP_PROJECT_ID);
    expect(useProposalsStore.getState().proposals).toEqual([proposal]);
    const call = useChatStore.getState().messages.find((m) => m.role === 'assistant')?.toolCalls?.[0];
    expect(call).toMatchObject({ kind: 'proposal', proposalId: 'prop-1', args: { nodeType: 'KSampler' } });
  });

  it('saves the person\'s and the assistant\'s messages as ChatRecords', async () => {
    useRevisionStore.setState({ currentRevisionId: 'rev-ctx-0' });
    api.llmStreamChat.mockImplementation(async (_m, _s, onChunk) => {
      onChunk({ type: 'tool-call', content: { toolCallId: 'c1', toolName: 'addNode', input: { nodeType: 'TestNode' } } });
      onChunk({ type: 'tool-result', content: { toolCallId: 'c1', toolName: 'addNode', output: { success: true, nodeId: 'n9', message: 'Added TestNode node' } } });
      onChunk({ type: 'text-delta', content: { text: 'Done!' } });
      onChunk({ type: 'done' });
    });
    await new ChatService().sendMessage('Add a test node');
    await tick();
    const records = api.saveChatMessage.mock.calls.map((call) => call[0]);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ projectId: DESKTOP_PROJECT_ID, role: 'user', content: 'Add a test node', graphRevisionId: 'rev-ctx-0', toolCalls: null });
    expect(records[1]).toMatchObject({ role: 'assistant', content: 'Done!', graphRevisionId: 'rev-ctx-1' });
    expect(records[1].toolCalls).toEqual([
      expect.objectContaining({ id: 'c1', toolName: 'addNode', kind: 'build', status: 'success', args: { nodeType: 'TestNode' } }),
    ]);
  });

  it('saves an error reply too', async () => {
    api.llmStreamChat.mockImplementation(async (_m, _s, onChunk) => onChunk({ type: 'error', content: 'Cloud model has no key for this session.' }));
    await new ChatService().sendMessage('Add a node');
    await tick();
    const last = api.saveChatMessage.mock.calls.at(-1)?.[0];
    expect(last?.role).toBe('assistant');
    expect(last?.content.startsWith('Error')).toBe(true);
  });

  it('loads history once into an empty chat', async () => {
    const record: ChatRecord = {
      id: 'old-1', projectId: DESKTOP_PROJECT_ID, role: 'assistant', content: 'Earlier', timestamp: 5, graphRevisionId: 'rev-0',
      toolCalls: [{ id: 'c', toolName: 'proposeNode', kind: 'proposal', status: 'success', args: {}, proposalId: 'prop-1' }],
    };
    api.loadChatHistory.mockResolvedValue([record]);
    const service = new ChatService();
    await service.loadHistory();
    await service.loadHistory();
    expect(api.loadChatHistory).toHaveBeenCalledTimes(1);
    expect(api.loadChatHistory).toHaveBeenCalledWith(DESKTOP_PROJECT_ID);
    const [message] = useChatStore.getState().messages;
    expect(message).toMatchObject({ id: 'old-1', content: 'Earlier', graphRevisionId: 'rev-0' });
    expect(message.toolCalls?.[0]).toMatchObject({ toolName: 'proposeNode', proposalId: 'prop-1', kind: 'proposal' });
  });

  it('does not replace messages that are already on screen', async () => {
    api.loadChatHistory.mockResolvedValue([{ id: 'old', projectId: DESKTOP_PROJECT_ID, role: 'user', content: 'x', timestamp: 1, graphRevisionId: null, toolCalls: null }]);
    useChatStore.setState({ messages: [{ id: 'live', role: 'user', content: 'now', timestamp: 2 }] });
    await new ChatService().loadHistory();
    expect(useChatStore.getState().messages.map((m) => m.id)).toEqual(['live']);
  });

  it('cancels the run when the person stops it', async () => {
    let release: () => void = () => undefined;
    api.llmStreamChat.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    const service = new ChatService();
    const pending = service.sendMessage('long');
    await tick();
    expect(useChatStore.getState().isStreaming).toBe(true);
    service.cancel();
    await tick();
    expect(api.cancelRun).toHaveBeenCalledWith(DESKTOP_PROJECT_ID, 'run-ctx');
    expect(useChatStore.getState().isStreaming).toBe(false);
    release();
    await pending;
  });
});
