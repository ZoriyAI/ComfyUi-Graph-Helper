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
    addMessage({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    });

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
    const settledById = new Map<string, { status: 'success' | 'error'; result: any; error?: string }>();
    const settledByName = new Map<string, { status: 'success' | 'error'; result: any; error?: string }>();

    const publishToolCalls = () => {
      if (!currentAssistantMessageId) {
        currentAssistantMessageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        addMessage({
          id: currentAssistantMessageId,
          role: 'assistant',
          content: assistantContent,
          timestamp: Date.now(),
          toolCalls: Array.from(currentToolCalls.values()),
        });
        return;
      }
      const { messages } = useChatStore.getState();
      const msgIndex = messages.findIndex((m) => m.id === currentAssistantMessageId);
      if (msgIndex < 0) return;
      const updated = [...messages];
      updated[msgIndex] = {
        ...updated[msgIndex],
        content: assistantContent,
        toolCalls: Array.from(currentToolCalls.values()),
      };
      useChatStore.setState({ messages: updated });
    };

    const applyRecord = (call: any, record: { status: 'success' | 'error'; result: any; error?: string }) => {
      call.status = record.status;
      call.result = record.result;
      call.error = record.error;
    };

    const settleTool = (
      id: string | undefined,
      name: string | undefined,
      status: 'success' | 'error',
      result: any,
      error?: string
    ) => {
      const record = { status, result, error };
      if (id) settledById.set(id, record);
      if (id && currentToolCalls.has(id)) {
        applyRecord(currentToolCalls.get(id), record);
        publishToolCalls();
        return;
      }
      const pending = name
        ? Array.from(currentToolCalls.values()).find((call) => call.name === name && call.status === 'pending')
        : undefined;
      if (pending) {
        applyRecord(pending, record);
        if (id && pending.id !== id) {
          currentToolCalls.delete(pending.id);
          pending.id = id;
          currentToolCalls.set(id, pending);
        }
        publishToolCalls();
        return;
      }
      if (name) settledByName.set(name, record);
    };

    const noteToolCall = (id: string, name: string) => {
      const prior = settledById.get(id) || (name ? settledByName.get(name) : undefined);
      if (name && settledByName.get(name) === prior) settledByName.delete(name);
      currentToolCalls.set(id, {
        id,
        name,
        arguments: {},
        status: prior?.status ?? 'pending',
        result: prior?.result,
        error: prior?.error,
      });
      publishToolCalls();
    };

    

    try {
      await window.electronAPI.llmStreamChat(
        messageHistory,
        toolSpecs,
        (chunk) => {
          console.log('[ChatService] Received chunk:', chunk.type);

          if (chunk.type === 'text-delta' && chunk.content.text) {
            console.log('[ChatService] text-delta:', chunk.content.text);
            assistantContent += chunk.content.text;

            // Update or create assistant message
            if (!currentAssistantMessageId) {
              currentAssistantMessageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
            const id = chunk.content.toolCallId || `tool-${Date.now()}`;
            const name = chunk.content.toolName || 'tool';
            noteToolCall(id, name);
          } else if (chunk.type === 'tool-result' || chunk.type === 'tool-error') {
            // AI SDK fullStream puts the execute() return value on `output`.
            // Older fixtures used `result`. Missing either must not throw.
            const output = chunk.content?.output !== undefined ? chunk.content.output : chunk.content?.result;
            const id = chunk.content?.toolCallId;
            const name = chunk.content?.toolName;
            if (chunk.type === 'tool-error') {
              const message = output?.message || output?.error || 'Tool failed';
              settleTool(id, name, 'error', output, String(message));
            } else if (output !== undefined) {
              const failed = output?.success === false;
              settleTool(
                id,
                name,
                failed ? 'error' : 'success',
                output,
                failed ? output?.error || output?.message : undefined
              );
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
                id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
          settleTool(
            request.toolCallId,
            request.tool,
            result?.success ? 'success' : 'error',
            result,
            result?.error || result?.message
          );
          
          console.log(`[ChatService:${executeId}] Sending result to channel: ${request.resultChannel}`);
          window.electronAPI.sendToolResult(request.resultChannel, result);
          console.log(`[ChatService:${executeId}] Result sent`);
        }
      );
    } catch (error: any) {
      console.error('[ChatService] Stream error:', error);
      addMessage({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
