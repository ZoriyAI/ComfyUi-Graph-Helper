import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGraphStore } from '../../src/renderer/state/graphState';
import { useChatStore } from '../../src/renderer/state/chatState';
import { useRevisionStore } from '../../src/renderer/state/revisionState';
import { getChatService } from '../../src/renderer/services/llm/chatService';

/**
 * Integration test: Chat UI -> IPC -> Main AI SDK -> Tool Execution -> Graph
 * Uses TEST fixture transport (not real LLM calls)
 */

// Mock window.electronAPI with test transport
const mockElectronAPI = {
  llmSetConfig: vi.fn(),
  llmStreamChat: vi.fn(),
  sendToolResult: vi.fn(),
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
    vi.clearAllMocks();
  });

  it('should execute addNode and annotateNode via chat message with TEST fixture', async () => {
    console.log('\n=== TEST: Chat -> AI SDK -> Graph ===');

    // Mock IPC to simulate test transport behavior
    let capturedToolSpecs: any[] = [];
    let capturedOnChunk: any;
    let capturedOnToolExecute: any;

    mockElectronAPI.llmStreamChat.mockImplementation(
      async (messages: any[], toolSpecs: any[], onChunk: any, onToolExecute: any) => {
        capturedToolSpecs = toolSpecs;
        capturedOnChunk = onChunk;
        capturedOnToolExecute = onToolExecute;

        console.log('[TEST] Simulating AI SDK test transport');

        // Step 1: Tool call addNode
        const addNodeArgs = { nodeType: 'TestNode', title: 'Test Node 1', x: 100, y: 100 };
        console.log('[TEST] Step 1: addNode tool call');

        await onToolExecute({
          tool: 'addNode',
          args: addNodeArgs,
          resultChannel: 'test-result-1',
        });

        // Small delay for action processing
        await new Promise((r) => setTimeout(r, 10));

        // Capture the added node ID
        const { nodes } = useGraphStore.getState();
        expect(nodes.length).toBe(1);
        const nodeId = nodes[0].id;
        console.log(`[TEST] Node added: ${nodeId}`);

        // Step 2: Tool call annotateNode
        const annotateArgs = { nodeId, annotation: 'Test annotation' };
        console.log('[TEST] Step 2: annotateNode tool call');

        await onToolExecute({
          tool: 'annotateNode',
          args: annotateArgs,
          resultChannel: 'test-result-2',
        });

        await new Promise((r) => setTimeout(r, 10));

        // Step 3: Final text response
        console.log('[TEST] Step 3: text response');
        onChunk({ type: 'text-delta', content: { text: 'I have added a TestNode and annotated it.' } });
        onChunk({ type: 'done' });
      }
    );

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
    const { revisions } = useRevisionStore.getState();
    console.log(`[TEST] Revision count: ${revisions.length}`);
    expect(revisions.length).toBeGreaterThanOrEqual(2); // base revisions for both actions

    console.log('[TEST] ✓ Chat-to-graph integration verified\n');
  });

  it('should track action sources correctly', async () => {
    mockElectronAPI.llmStreamChat.mockImplementation(
      async (messages: any[], toolSpecs: any[], onChunk: any, onToolExecute: any) => {
        await onToolExecute({
          tool: 'addNode',
          args: { nodeType: 'SourceTest', title: 'Source Test', x: 0, y: 0 },
          resultChannel: 'test-source',
        });
        await new Promise((r) => setTimeout(r, 10));
        onChunk({ type: 'done' });
      }
    );

    const chatService = getChatService();
    await chatService.sendMessage('Add a node');

    const { revisions } = useRevisionStore.getState();
    const aiRevisions = revisions.filter((r) => r.source === 'ai');
    expect(aiRevisions.length).toBeGreaterThan(0);

    console.log('[TEST] ✓ AI action source tracked correctly\n');
  });

  it('should handle tool execution failures gracefully', async () => {
    mockElectronAPI.llmStreamChat.mockImplementation(
      async (messages: any[], toolSpecs: any[], onChunk: any, onToolExecute: any) => {
        // Attempt to annotate non-existent node
        await onToolExecute({
          tool: 'annotateNode',
          args: { nodeId: 'non-existent', annotation: 'Should fail' },
          resultChannel: 'test-fail',
        });
        await new Promise((r) => setTimeout(r, 10));
        onChunk({ type: 'done' });
      }
    );

    const chatService = getChatService();
    await chatService.sendMessage('Annotate non-existent node');

    // Tool should report failure, not throw
    const { nodes } = useGraphStore.getState();
    expect(nodes.length).toBe(0); // No node added

    console.log('[TEST] ✓ Tool failure handled gracefully\n');
  });
});
