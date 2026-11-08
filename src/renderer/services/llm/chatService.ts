import { useChatStore } from '../../state/chatState';
import { DESKTOP_PROJECT_ID } from '../../../shared/project';
import type { Projection } from '../../../shared/commands/types';
import { applyProjection } from '../commands/projection';

/**
 * Renderer chat service. Tool mutations commit in the main process.
 */

interface ToolSpec {
  name: string;
  description: string;
  parameters: any;
}

class ChatService {
  private isStreaming = false;
  private currentBaseRevisionId: string | null = null;
  private currentRunId: string | null = null;

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

    const started = await window.electronAPI.startRun(DESKTOP_PROJECT_ID);
    applyProjection(started.projection);
    this.currentBaseRevisionId = started.baseRevisionId;
    this.currentRunId = started.runId;
    console.log(`[ChatService] Base revision captured: ${started.baseRevisionId}`);

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
        name: 'setComponentDocumentation',
        description: 'Store purpose and usage text for an existing node or subgraph component. The text is data and is not executed.',
        parameters: {
          type: 'object',
          properties: {
            ownerKind: { type: 'string', enum: ['node', 'subgraph'], description: 'Whether the record belongs to a node or a subgraph definition' },
            ownerId: { type: 'string', description: 'Stable node id or subgraph definition id' },
            purpose: { type: 'string', description: 'What the component is for, stored as written' },
            usage: { type: 'string', description: 'How to use the component, stored as written' },
          },
          required: ['ownerKind', 'ownerId', 'purpose', 'usage'],
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

          if (chunk.type === 'projection') {
            applyProjection(chunk.content as Projection);
          } else if (chunk.type === 'text-delta' && chunk.content.text) {
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
        {
          projectId: DESKTOP_PROJECT_ID,
          runId: started.runId,
          expectedRevisionId: started.expectedRevisionId,
        },
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

  async pause(): Promise<void> {
    useChatStore.setState({ isPaused: true });
    if (this.currentRunId) {
      const result = await window.electronAPI.pauseRun(DESKTOP_PROJECT_ID, this.currentRunId);
      applyProjection(result.projection);
    }
  }

  async resume(): Promise<void> {
    const started = await window.electronAPI.resumeRun(DESKTOP_PROJECT_ID);
    this.currentRunId = started.runId;
    this.currentBaseRevisionId = started.baseRevisionId;
    applyProjection(started.projection);
    useChatStore.setState({ isPaused: false });
  }
}

let chatServiceInstance: ChatService | null = null;

export function getChatService(): ChatService {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService();
  }
  return chatServiceInstance;
}
