import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from '../../src/renderer/state/chatState';
import { useGraphStore } from '../../src/renderer/state/graphState';
import { getChatService } from '../../src/renderer/services/llm/chatService';

/**
 * E2E chat flow test
 * Tests full path: UI -> IPC -> AI SDK -> tool execution -> graph state
 * Mocks only electronAPI IPC bridge
 */

describe('E2E Chat Flow', () => {
  beforeEach(() => {
    // Reset stores
    useChatStore.setState({ messages: [], isStreaming: false, isPaused: false });
    useGraphStore.setState({ nodes: [], edges: [] });

    // Mock electronAPI
    (global as any).window = {
      electronAPI: {
        llmSetConfig: vi.fn().mockResolvedValue(undefined),
        llmStreamChat: vi.fn(async (messages, toolSpecs, onChunk, onToolExecute) => {
          console.log('[MOCK] llmStreamChat called');
          
          // Simulate AI SDK test fixture flow
          // Step 1: addNode tool call
          onChunk({ type: 'tool-call', content: { toolCallId: 'call-1', toolName: 'addNode' } });
          
          // Wait for tool execution request
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Simulate tool execute callback
          const addNodeResult: any = await new Promise((resolve) => {
            // Mock sendToolResult BEFORE calling onToolExecute
            (window.electronAPI as any).sendToolResult = (channel: string, result: any) => {
              console.log('[MOCK] Tool result:', result);
              resolve(result);
            };
            
            // Execute tool (will call sendToolResult async)
            onToolExecute({
              tool: 'addNode',
              args: { nodeType: 'TestNode', title: 'AI Test Node', x: 200, y: 200 },
              resultChannel: 'result-1',
            });
          });
          
          // Send tool result back
          onChunk({ 
            type: 'tool-result', 
            content: { 
              toolCallId: 'call-1', 
              result: addNodeResult 
            } 
          });
          
          // Step 2: annotateNode tool call
          const nodeId = addNodeResult.nodeId;
          console.log('[MOCK] Using nodeId:', nodeId);
          onChunk({ type: 'tool-call', content: { toolCallId: 'call-2', toolName: 'annotateNode' } });
          
          await new Promise(resolve => setTimeout(resolve, 10));
          
          const annotateResult = await new Promise((resolve) => {
            (window.electronAPI as any).sendToolResult = (channel: string, result: any) => {
              console.log('[MOCK] Annotate result:', result);
              resolve(result);
            };
            
            onToolExecute({
              tool: 'annotateNode',
              args: { nodeId, annotation: 'AI added annotation' },
              resultChannel: 'result-2',
            });
          });
          
          onChunk({ 
            type: 'tool-result', 
            content: { 
              toolCallId: 'call-2', 
              result: annotateResult 
            } 
          });
          
          // Step 3: text completion
          onChunk({ type: 'text-delta', content: { textDelta: 'Done!' } });
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
