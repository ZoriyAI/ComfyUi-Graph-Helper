import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from '../../src/renderer/state/chatState';
import { useGraphStore } from '../../src/renderer/state/graphState';
import { getChatService } from '../../src/renderer/services/llm/chatService';

/**
 * Integration test: Real streaming to Chat UI
 * Verifies text deltas and tool events appear in chat messages
 */

const mockElectronAPI = {
  llmSetConfig: vi.fn(),
  llmStreamChat: vi.fn(),
  sendToolResult: vi.fn(),
};

(global as any).window = {
  electronAPI: mockElectronAPI,
};

describe('Chat UI Streaming', () => {
  beforeEach(async () => {
    useChatStore.setState({ messages: [], isStreaming: false, isPaused: false });
    useGraphStore.setState({ nodes: [], edges: [] });
    vi.clearAllMocks();

    // Force module reload to pick up changes
    vi.resetModules();
  });

  it('should show separate tool-call and tool-result events in order', async () => {
    console.log('\n=== TEST: Tool events in order ===');

    mockElectronAPI.llmStreamChat.mockImplementation(
      async (messages: any[], toolSpecs: any[], onChunk: any, onToolExecute: any) => {
        // Tool call 1: addNode
        console.log('[TEST] Sending tool-call event for addNode');
        await new Promise((r) => setTimeout(r, 5)); // Let sendMessage initialize
        onChunk({
          type: 'tool-call',
          content: {
            toolCallId: 'call-1',
            toolName: 'addNode',
            args: { nodeType: 'TestNode' },
          },
        });

        await new Promise((r) => setTimeout(r, 10));

        // Verify pending state
        let { messages: chatMessages } = useChatStore.getState();
        let assistantMsg = chatMessages.find((m) => m.role === 'assistant');
        expect(assistantMsg?.toolCalls?.length).toBe(1);
        expect(assistantMsg?.toolCalls?.[0].status).toBe('pending');
        expect(assistantMsg?.toolCalls?.[0].name).toBe('addNode');

        // Execute tool
        await onToolExecute({
          tool: 'addNode',
          args: { nodeType: 'TestNode' },
          resultChannel: 'result-1',
        });

        // Tool result
        console.log('[TEST] Sending tool-result event (success)');
        onChunk({
          type: 'tool-result',
          content: {
            toolCallId: 'call-1',
            result: { success: true, message: 'Node added' },
          },
        });

        await new Promise((r) => setTimeout(r, 5));

        // Verify success state
        chatMessages = useChatStore.getState().messages;
        assistantMsg = chatMessages.find((m) => m.role === 'assistant');
        expect(assistantMsg?.toolCalls?.[0].status).toBe('success');

        // Tool call 2: annotateNode
        console.log('[TEST] Sending tool-call event for annotateNode');
        onChunk({
          type: 'tool-call',
          content: {
            toolCallId: 'call-2',
            toolName: 'annotateNode',
            args: { nodeId: 'test', annotation: 'Test' },
          },
        });

        await new Promise((r) => setTimeout(r, 5));

        // Verify two tool calls
        chatMessages = useChatStore.getState().messages;
        assistantMsg = chatMessages.find((m) => m.role === 'assistant');
        expect(assistantMsg?.toolCalls?.length).toBe(2);
        expect(assistantMsg?.toolCalls?.[1].status).toBe('pending');

        // Execute second tool
        await onToolExecute({
          tool: 'annotateNode',
          args: { nodeId: 'test', annotation: 'Test' },
          resultChannel: 'result-2',
        });

        // Second result
        onChunk({
          type: 'tool-result',
          content: {
            toolCallId: 'call-2',
            result: { success: true, message: 'Annotated' },
          },
        });

        await new Promise((r) => setTimeout(r, 5));

        // Final text
        onChunk({ type: 'text-delta', content: { text: 'Done!' } });
        onChunk({ type: 'done' });
      }
    );

    const chatService = getChatService();
    await chatService.sendMessage('Test two operations');

    const { messages } = useChatStore.getState();
    const assistantMsg = messages.find((m) => m.role === 'assistant');

    // Verify both tools succeeded
    expect(assistantMsg?.toolCalls?.length).toBe(2);
    expect(assistantMsg?.toolCalls?.[0].status).toBe('success');
    expect(assistantMsg?.toolCalls?.[1].status).toBe('success');
    expect(assistantMsg?.content).toBe('Done!');

    console.log('[TEST] ✓ Tool events shown in order\n');
  });

  it('should mark failed tool as error, not success', async () => {
    console.log('\n=== TEST: Failed tool marked as error ===');

    mockElectronAPI.llmStreamChat.mockImplementation(
      async (messages: any[], toolSpecs: any[], onChunk: any, onToolExecute: any) => {
        onChunk({
          type: 'tool-call',
          content: {
            toolCallId: 'call-fail',
            toolName: 'addNode',
            args: {},
          },
        });

        await new Promise((r) => setTimeout(r, 5));

        // Execute tool that will fail
        await onToolExecute({
          tool: 'addNode',
          args: {},
          resultChannel: 'result-fail',
        });

        // Return failure result
        onChunk({
          type: 'tool-result',
          content: {
            toolCallId: 'call-fail',
            result: { success: false, error: 'Missing nodeType' },
          },
        });

        await new Promise((r) => setTimeout(r, 5));
        onChunk({ type: 'done' });
      }
    );

    const chatService = getChatService();
    await chatService.sendMessage('Test failure');

    const { messages } = useChatStore.getState();
    const assistantMsg = messages.find((m) => m.role === 'assistant');

    expect(assistantMsg?.toolCalls?.length).toBe(1);
    expect(assistantMsg?.toolCalls?.[0].status).toBe('error');
    expect(assistantMsg?.toolCalls?.[0].error).toBe('Missing nodeType');

    console.log('[TEST] ✓ Failed tool correctly marked as error\n');
  });

  it('applies official SDK output when the tool-result chunk arrives before the tool-call', async () => {
    mockElectronAPI.llmStreamChat.mockImplementation(async (_messages, _specs, onChunk) => {
      onChunk({
        type: 'tool-result',
        content: {
          type: 'tool-result',
          toolCallId: 'call-add-node',
          toolName: 'addNode',
          output: { success: true, nodeId: 'node-from-sdk' },
        },
      });
      onChunk({
        type: 'tool-call',
        content: {
          type: 'tool-call',
          toolCallId: 'call-add-node',
          toolName: 'addNode',
          input: { nodeType: 'TestNode' },
        },
      });
      onChunk({ type: 'text-delta', content: { type: 'text-delta', id: 'text-1', text: 'Done!' } });
      onChunk({ type: 'done' });
    });

    const chatService = getChatService();
    await chatService.sendMessage('Add a test node');

    const assistantMsg = useChatStore.getState().messages.find((m) => m.role === 'assistant');
    expect(assistantMsg?.content).toBe('Done!');
    expect(assistantMsg?.toolCalls?.[0].status).toBe('success');
    expect(assistantMsg?.toolCalls?.[0].name).toBe('addNode');
    expect(useChatStore.getState().isStreaming).toBe(false);
  });
});
