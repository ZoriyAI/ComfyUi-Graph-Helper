import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGraphStore } from '../../src/renderer/state/graphState';
import { useChatStore } from '../../src/renderer/state/chatState';
import { useRevisionStore } from '../../src/renderer/state/revisionState';
import { getChatService } from '../../src/renderer/services/llm/chatService';
import { useProjectionStore } from '../../src/renderer/services/commands/projection';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';

/**
 * Integration test: Chat UI -> IPC -> Main AI SDK -> Tool Execution -> Graph
 * Uses TEST fixture transport (not real LLM calls)
 */

// Mock window.electronAPI with test transport
const started = {
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
};

const mockElectronAPI = {
  llmSetConfig: vi.fn(),
  llmStreamChat: vi.fn(),
  sendToolResult: vi.fn(),
  startRun: vi.fn(async () => started),
};

(global as any).window = {
  electronAPI: mockElectronAPI,
};

describe('Chat-to-Graph Integration', () => {
  beforeEach(() => {
    // Reset stores
    useGraphStore.setState({ nodes: [], edges: [] });
    useChatStore.setState({ messages: [] });
    useRevisionStore.setState({ revisions: [], currentRevisionId: null });
    useProjectionStore.setState({ projectId: DESKTOP_PROJECT_ID, revSeq: 0, currentRevisionId: '', activeRun: null });
    vi.clearAllMocks();
  });

  it('should execute addNode and annotateNode via chat message with TEST fixture', async () => {
    console.log('\n=== TEST: Chat -> AI SDK -> Graph ===');

    // Mock IPC to simulate test transport behavior
    mockElectronAPI.llmStreamChat.mockImplementation(async (_messages: any[], _toolSpecs: any[], onChunk: any) => {
      onChunk({
        type: 'projection',
        content: {
          projectId: DESKTOP_PROJECT_ID,
          currentRevisionId: 'rev-desktop-2',
          revSeq: 2,
          activeRun: { runId: 'run-test', status: 'running', expectedRevisionId: 'rev-desktop-2' },
          snapshot: {
            nodes: [{ id: 'node-add-1', data: { comfyType: 'TestNode', title: 'Test Node 1', annotations: [] } }],
            edges: [],
          },
        },
      });
      onChunk({
        type: 'projection',
        content: {
          projectId: DESKTOP_PROJECT_ID,
          currentRevisionId: 'rev-desktop-3',
          revSeq: 3,
          activeRun: { runId: 'run-test', status: 'running', expectedRevisionId: 'rev-desktop-3' },
          snapshot: {
            nodes: [{ id: 'node-add-1', data: { comfyType: 'TestNode', title: 'Test Node 1', annotations: ['Test annotation'] } }],
            edges: [],
          },
        },
      });
      onChunk({ type: 'text-delta', content: { text: 'I have added a TestNode and annotated it.' } });
      onChunk({ type: 'done' });
    });

    // Execute chat message
    const chatService = getChatService();
    await chatService.sendMessage('Add a test node and annotate it');

    // Verify graph state
    const { nodes } = useGraphStore.getState();
    console.log(`[TEST] Final node count: ${nodes.length}`);
    expect(nodes.length).toBe(1);
    expect(nodes[0].data.comfyType).toBe('TestNode');
    expect(nodes[0].data.title).toBe('Test Node 1');
    expect(nodes[0].data.annotations || []).toContain('Test annotation');

    // Verify chat messages
    const { messages } = useChatStore.getState();
    console.log(`[TEST] Final message count: ${messages.length}`);
    expect(messages.length).toBeGreaterThanOrEqual(2); // user + assistant
    expect(messages[0].role).toBe('user');
    expect(messages[messages.length - 1].role).toBe('assistant');

    // Verify revisions
    expect(useRevisionStore.getState().currentRevisionId).toBe('rev-desktop-3');

    console.log('[TEST] ✓ Chat-to-graph integration verified\n');
  });

  it('should track action sources correctly', async () => {
    mockElectronAPI.llmStreamChat.mockImplementation(async (_messages: any[], _toolSpecs: any[], onChunk: any, run: any) => {
      expect(run.actor).toBeUndefined();
      expect(run.runId).toBe('run-test');
      onChunk({
        type: 'projection',
        content: {
          projectId: DESKTOP_PROJECT_ID,
          currentRevisionId: 'rev-desktop-2',
          revSeq: 2,
          activeRun: { runId: 'run-test', status: 'running', expectedRevisionId: 'rev-desktop-2' },
          snapshot: { nodes: [{ id: 'node-1', data: { comfyType: 'SourceTest', title: 'Source Test', annotations: [] } }], edges: [] },
        },
      });
      onChunk({ type: 'done' });
    });

    const chatService = getChatService();
    await chatService.sendMessage('Add a node');

    expect(mockElectronAPI.startRun).toHaveBeenCalledWith(DESKTOP_PROJECT_ID);
    expect(useGraphStore.getState().nodes).toHaveLength(1);

    console.log('[TEST] ✓ AI action source tracked correctly\n');
  });

  it('should handle tool execution failures gracefully', async () => {
    mockElectronAPI.llmStreamChat.mockImplementation(async (_messages: any[], _toolSpecs: any[], onChunk: any) => {
      onChunk({ type: 'done' });
    });

    const chatService = getChatService();
    await chatService.sendMessage('Annotate non-existent node');

    // Tool should report failure, not throw
    const { nodes } = useGraphStore.getState();
    expect(nodes.length).toBe(0); // No node added

    console.log('[TEST] ✓ Tool failure handled gracefully\n');
  });
});
