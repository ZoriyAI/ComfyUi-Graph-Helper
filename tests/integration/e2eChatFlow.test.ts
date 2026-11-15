/**
 * Chat flow test in one process: chat store, ChatService, tool execution and graph store, with only the preload
 * bridge (window.electronAPI) mocked. Despite the name it is not a Playwright spec. It protects that a chat turn with
 * tool calls ends with the nodes on the canvas, and that a failure shows a readable message instead of a raw error.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from '../../src/renderer/state/chatState';
import { useGraphStore } from '../../src/renderer/state/graphState';
import { getChatService } from '../../src/renderer/services/llm/chatService';
import { useProjectionStore } from '../../src/renderer/services/commands/projection';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';

describe('E2E Chat Flow', () => {
  beforeEach(() => {
    // Reset stores
    useChatStore.setState({ messages: [], isStreaming: false, isPaused: false });
    useGraphStore.setState({ nodes: [], edges: [] });
    useProjectionStore.setState({ projectId: DESKTOP_PROJECT_ID, revSeq: 0, currentRevisionId: '', activeRun: null });

    // Mock electronAPI
    (global as any).window = {
      electronAPI: {
        llmSetConfig: vi.fn().mockResolvedValue(undefined),
        startRun: vi.fn(async () => ({
          runId: 'run-test',
          baseRevisionId: 'rev-desktop-1',
          expectedRevisionId: 'rev-desktop-1',
          projection: {
            projectId: DESKTOP_PROJECT_ID,
            snapshot: { nodes: [], edges: [] },
            currentRevisionId: 'rev-desktop-1',
            revSeq: 1,
            activeRun: { runId: 'run-test', status: 'running', expectedRevisionId: 'rev-desktop-1' },
          },
        })),
        llmStreamChat: vi.fn(async (_messages, _toolSpecs, onChunk) => {
          onChunk({ type: 'tool-call', content: { toolCallId: 'call-1', toolName: 'addNode' } });
          onChunk({
            type: 'projection',
            content: {
              projectId: DESKTOP_PROJECT_ID,
              currentRevisionId: 'rev-desktop-2',
              revSeq: 2,
              activeRun: { runId: 'run-test', status: 'running', expectedRevisionId: 'rev-desktop-2' },
              snapshot: {
                nodes: [{ id: 'node-call-1', data: { comfyType: 'TestNode', title: 'AI Test Node', annotations: [] } }],
                edges: [],
              },
            },
          });
          onChunk({
            type: 'tool-result',
            content: { toolCallId: 'call-1', result: { success: true, nodeId: 'node-call-1' } },
          });
          onChunk({ type: 'tool-call', content: { toolCallId: 'call-2', toolName: 'annotateNode' } });
          onChunk({
            type: 'projection',
            content: {
              projectId: DESKTOP_PROJECT_ID,
              currentRevisionId: 'rev-desktop-3',
              revSeq: 3,
              activeRun: { runId: 'run-test', status: 'running', expectedRevisionId: 'rev-desktop-3' },
              snapshot: {
                nodes: [{ id: 'node-call-1', data: { comfyType: 'TestNode', title: 'AI Test Node', annotations: ['AI added annotation'] } }],
                edges: [],
              },
            },
          });
          onChunk({
            type: 'tool-result',
            content: { toolCallId: 'call-2', result: { success: true } },
          });
          onChunk({ type: 'text-delta', content: { text: 'Done!' } });
          onChunk({ type: 'done' });
        }),
        sendToolResult: vi.fn(),
      },
    };
  });

  it('should complete full chat-to-graph flow with real tool execution', async () => {
    const initialNodeCount = useGraphStore.getState().nodes.length;
    console.log('[TEST] Initial node count:', initialNodeCount);

    // Configure TEST provider
    await window.electronAPI.llmSetConfig({ provider: 'test', model: 'test-fixture' });

    // Send chat message
    const chatService = getChatService();
    await chatService.sendMessage('Add a test node');

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify chat state
    const { messages } = useChatStore.getState();
    expect(messages.length).toBeGreaterThan(0);
    
    const lastMessage = messages[messages.length - 1];
    expect(lastMessage.role).toBe('assistant');
    expect(lastMessage.content).not.toContain('Error');
    expect(lastMessage.content).not.toContain('[object Object]');

    // Verify graph state changed
    const { nodes } = useGraphStore.getState();
    const newNodeCount = nodes.length;
    console.log('[TEST] Final node count:', newNodeCount);
    
    expect(newNodeCount).toBeGreaterThan(initialNodeCount);
    
    // Verify new node has expected properties
    const newNode = nodes.find(n => n.data.title === 'AI Test Node');
    expect(newNode).toBeDefined();
    expect(newNode?.data.annotations).toContain('AI added annotation');
  });

  it('should show readable error message on failure', async () => {
    // Mock error scenario
    (window.electronAPI as any).llmStreamChat = vi.fn(async (messages, toolSpecs, onChunk) => {
      onChunk({ 
        type: 'error', 
        content: { 
          message: 'API key invalid',
          code: 'auth_error' 
        } 
      });
    });

    await window.electronAPI.llmSetConfig({ provider: 'test', model: 'test-fixture' });

    const chatService = getChatService();
    await chatService.sendMessage('Add a node');

    await new Promise(resolve => setTimeout(resolve, 50));

    const { messages } = useChatStore.getState();
    const errorMessage = messages.find(m => m.content.includes('Error'));
    
    expect(errorMessage).toBeDefined();
    expect(errorMessage?.content).not.toContain('[object Object]');
    expect(errorMessage?.content).toContain('API key invalid');
  });
});
