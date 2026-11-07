import { useChatStore } from '../../state/chatState';
import { useRevisionStore } from '../../state/revisionState';
import { getGraphService } from '../graph/graphService';
import { getActionExecutor } from '../actions/actionExecutor';
import { GraphAction } from '../../types/revisions';

/**
 * Renderer chat service that integrates with main-process AI SDK
 * Tools execute in renderer context with full graph access
 */

interface ToolSpec {
  name: string;
  description: string;
  parameters: any;
}

class ChatService {
  private isStreaming = false;
  private currentBaseRevisionId: string | null = null;

  async sendMessage(content: string): Promise<void> {
    console.log(`[ChatService] sendMessage called: "${content}"`);
    if (this.isStreaming) {
      console.warn('[ChatService] Already streaming');
      return;
    }

    this.isStreaming = true;
    useChatStore.setState({ isStreaming: true, isPaused: false });
    const { messages, addMessage } = useChatStore.getState();

    // Add user message
    addMessage({ id: `msg-${Date.now()}`, role: 'user', content, timestamp: Date.now() });

    // CRITICAL: Create base revision BEFORE sending to model
    // This captures the graph state that the model "sees"
    const baseRevision = getGraphService().createRevision('system', 'Before AI conversation turn');
    this.currentBaseRevisionId = baseRevision.id;
    console.log(`[ChatService] Base revision captured: ${baseRevision.id}`);

    // Prepare tool specs (no execute functions - those stay in renderer)
    const toolSpecs: ToolSpec[] = [
      {
        name: 'addNode',
        description: 'Add a node to the graph',
        parameters: {
          type: 'object',
          properties: {
            nodeType: { type: 'string', description: 'Type of node to add' },
            title: { type: 'string', description: 'Node title' },
            x: { type: 'number', description: 'X position' },
            y: { type: 'number', description: 'Y position' },
            parameters: { type: 'object', description: 'Node parameters' },
          },
          required: ['nodeType'],
        },
      },
      {
        name: 'annotateNode',
        description: 'Add an annotation to a node',
        parameters: {
          type: 'object',
          properties: {
            nodeId: { type: 'string', description: 'Node ID to annotate' },
            annotation: { type: 'string', description: 'Annotation text' },
          },
          required: ['nodeId', 'annotation'],
        },
      },
    ];

    // Prepare message history for AI
    
    const messageHistory = messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));
    messageHistory.push({ role: 'user', content });
    

    let assistantContent = '';
    let currentAssistantMessageId: string | null = null;
    const currentToolCalls: Map<string, any> = new Map();

    

    try {
      await window.electronAPI.llmStreamChat(
        messageHistory,
        toolSpecs,
        (chunk) => {
          console.log('[ChatService] Received chunk:', chunk.type);

          if (chunk.type === 'text-delta' && chunk.content.textDelta) {
            console.log('[ChatService] text-delta:', chunk.content.textDelta);
            assistantContent += chunk.content.textDelta;

            // Update or create assistant message
            if (!currentAssistantMessageId) {
              currentAssistantMessageId = `msg-${Date.now()}`;
              addMessage({
                id: currentAssistantMessageId,
                role: 'assistant',
                content: assistantContent,
                timestamp: Date.now(),
                toolCalls: [],
              });
            } else {
              // Update existing message
              const { messages } = useChatStore.getState();
              const msgIndex = messages.findIndex((m) => m.id === currentAssistantMessageId);
              if (msgIndex >= 0) {
                const updated = [...messages];
                updated[msgIndex] = {
                  ...updated[msgIndex],
                  content: assistantContent,
                };
                useChatStore.setState({ messages: updated });
              }
            }
          } else if (chunk.type === 'tool-call') {
            // Tool call started
            const toolCall = {
              id: chunk.content.toolCallId || `tool-${Date.now()}`,
              name: chunk.content.toolName,
              arguments: {},
              status: 'pending' as const,
            };
            currentToolCalls.set(toolCall.id, toolCall);

            // Create or update message with tool call
            if (!currentAssistantMessageId) {
              currentAssistantMessageId = `msg-${Date.now()}`;
              addMessage({
                id: currentAssistantMessageId,
                role: 'assistant',
                content: assistantContent,
                timestamp: Date.now(),
                toolCalls: Array.from(currentToolCalls.values()),
              });
            } else {
              const { messages } = useChatStore.getState();
              const msgIndex = messages.findIndex((m) => m.id === currentAssistantMessageId);
              if (msgIndex >= 0) {
                const updated = [...messages];
                updated[msgIndex] = {
                  ...updated[msgIndex],
                  toolCalls: Array.from(currentToolCalls.values()),
                };
                useChatStore.setState({ messages: updated });
              }
            }
          } else if (chunk.type === 'tool-result') {
            // Tool result received
            const toolCallId = chunk.content.toolCallId;
            const result = chunk.content.result;
            const existingCall = currentToolCalls.get(toolCallId);

            if (existingCall) {
              existingCall.status = result.success ? 'success' : 'error';
              existingCall.error = result.error;
              existingCall.result = result;
              currentToolCalls.set(toolCallId, existingCall);

              // Update message
              if (currentAssistantMessageId) {
                const { messages } = useChatStore.getState();
                const msgIndex = messages.findIndex((m) => m.id === currentAssistantMessageId);
                if (msgIndex >= 0) {
                  const updated = [...messages];
                  updated[msgIndex] = {
                    ...updated[msgIndex],
                    toolCalls: Array.from(currentToolCalls.values()),
                  };
                  useChatStore.setState({ messages: updated });
                }
              }
            }
          } else if (chunk.type === 'done') {
            this.isStreaming = false;
            useChatStore.setState({ isStreaming: false });
          } else if (chunk.type === 'error') {
            const errorMessage = typeof chunk.content === 'string' 
              ? chunk.content 
              : chunk.content?.error?.message || chunk.content?.message || JSON.stringify(chunk.content);
            console.error('[ChatService] Error:', errorMessage);
            this.isStreaming = false;
            useChatStore.setState({ isStreaming: false });

            if (!currentAssistantMessageId) {
              addMessage({
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: `Error: ${errorMessage}`,
                timestamp: Date.now(),
              });
            }
          }
        },
        async (request) => {
          const executeId = request.executeId || 'unknown';
          console.log(`[ChatService:${executeId}] Tool execute request: ${request.tool}`);
          console.log(`[ChatService:${executeId}] Args:`, request.args);
          console.log(`[ChatService:${executeId}] Result channel: ${request.resultChannel}`);
          
          const result = await this.executeTool(request.tool, request.args);
          
          console.log(`[ChatService:${executeId}] Tool executed, result:`, result);
          
          // Update tool call status in current message
          // Find the pending tool call for this tool
          const { messages } = useChatStore.getState();
          if (currentAssistantMessageId) {
            const msgIndex = messages.findIndex((m) => m.id === currentAssistantMessageId);
            if (msgIndex >= 0) {
              const toolCall = Array.from(currentToolCalls.values()).find(tc => tc.name === request.tool && tc.status === 'pending');
              if (toolCall) {
                toolCall.status = result.success ? 'success' : 'error';
                toolCall.result = result;
                toolCall.error = result.error;
                currentToolCalls.set(toolCall.id, toolCall);
                
                const updated = [...messages];
                updated[msgIndex] = {
                  ...updated[msgIndex],
                  toolCalls: Array.from(currentToolCalls.values()),
                };
                useChatStore.setState({ messages: updated });
                console.log(`[ChatService:${executeId}] Updated tool status to ${toolCall.status}`);
              }
            }
          }
          
          console.log(`[ChatService:${executeId}] Sending result to channel: ${request.resultChannel}`);
          window.electronAPI.sendToolResult(request.resultChannel, result);
          console.log(`[ChatService:${executeId}] Result sent`);
        }
      );
    } catch (error: any) {
      console.error('[ChatService] Stream error:', error);
      addMessage({
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: Date.now(),
      });
      this.isStreaming = false;
      useChatStore.setState({ isStreaming: false });
    }
  }

  cancel(): void {
    this.isStreaming = false;
    useChatStore.setState({ isStreaming: false, isPaused: false });
    console.log('[ChatService] Streaming cancelled');
  }

  pause(): void {
    useChatStore.setState({ isPaused: true });
    console.log('[ChatService] Streaming paused');
  }

  resume(): void {
    useChatStore.setState({ isPaused: false });
    console.log('[ChatService] Streaming resumed');
  }

  private async executeTool(toolName: string, args: any): Promise<any> {
    console.log(`[ChatService] Executing tool ${toolName}:`, args);

    if (toolName === 'addNode') {
      return this.executeAddNode(args);
    } else if (toolName === 'annotateNode') {
      return this.executeAnnotateNode(args);
    } else {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }
  }

  private async executeAddNode(args: {
    nodeType: string;
    title?: string;
    x?: number;
    y?: number;
    parameters?: Record<string, unknown>;
  }): Promise<any> {
    // Capture FRESH base revision for this tool execution (multi-tool support)
    const { currentRevisionId } = useRevisionStore.getState();

    const action: GraphAction = {
      id: `a-${Date.now()}`,
      type: 'add-node',
      timestamp: Date.now(),
      beforeRevisionId: currentRevisionId || '',
      payload: args,
      source: 'ai',
      status: 'pending',
    };
    await getActionExecutor().queueAction(action);

    if (action.status === 'conflict') {
      return { success: false, conflict: true, message: action.error || 'Conflict detected' };
    } else if (action.status === 'failed') {
      return { success: false, error: action.error || 'Failed to add node' };
    } else {
      console.log(`[ChatService] addNode result:`, action.result);
      return { 
        success: true, 
        message: `Added ${args.nodeType} node`, 
        nodeType: args.nodeType,
        nodeId: action.result?.nodeId, // Return nodeId for subsequent tool calls
      };
    }
  }

  private async executeAnnotateNode(args: { nodeId: string; annotation: string }): Promise<any> {
    // Capture FRESH base revision for this tool execution (multi-tool support)
    const { currentRevisionId } = useRevisionStore.getState();

    const action: GraphAction = {
      id: `a-${Date.now()}`,
      type: 'annotate-node',
      timestamp: Date.now(),
      beforeRevisionId: currentRevisionId || '',
      payload: args,
      source: 'ai',
      status: 'pending',
    };
    await getActionExecutor().queueAction(action);

    if (action.status === 'applied') {
      return { success: true, message: `Annotated node ${args.nodeId}` };
    } else {
      return { success: false, error: action.error || 'Failed to annotate' };
    }
  }
}

let chatServiceInstance: ChatService | null = null;

export function getChatService(): ChatService {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService();
  }
  return chatServiceInstance;
}
