import { useChatStore } from '../../state/chatState';
import { getGraphService } from '../graph/graphService';
import { getActionExecutor } from '../actions/actionExecutor';
class ChatService {
    isStreaming = false;
    currentBaseRevisionId = null;
    async sendMessage(content) {
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
        const toolSpecs = [
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
            role: m.role,
            content: m.content,
        }));
        messageHistory.push({ role: 'user', content });
        let assistantContent = '';
        let currentAssistantMessageId = null;
        const currentToolCalls = new Map();
        try {
            await window.electronAPI.llmStreamChat(messageHistory, toolSpecs, (chunk) => {
                if (chunk.type === 'text-delta' && chunk.content.textDelta) {
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
                    }
                    else {
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
                }
                else if (chunk.type === 'tool-call') {
                    // Tool call started
                    const toolCall = {
                        id: chunk.content.toolCallId || `tool-${Date.now()}`,
                        name: chunk.content.toolName,
                        arguments: {},
                        status: 'pending',
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
                    }
                    else {
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
                else if (chunk.type === 'tool-result') {
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
                }
                else if (chunk.type === 'done') {
                    this.isStreaming = false;
                    useChatStore.setState({ isStreaming: false });
                }
                else if (chunk.type === 'error') {
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
            }, async (request) => {
                console.log('[ChatService] Tool execute request:', request.tool);
                const result = await this.executeTool(request.tool, request.args);
                window.electronAPI.sendToolResult(request.resultChannel, result);
            });
        }
        catch (error) {
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
    cancel() {
        this.isStreaming = false;
        useChatStore.setState({ isStreaming: false, isPaused: false });
        console.log('[ChatService] Streaming cancelled');
    }
    pause() {
        useChatStore.setState({ isPaused: true });
        console.log('[ChatService] Streaming paused');
    }
    resume() {
        useChatStore.setState({ isPaused: false });
        console.log('[ChatService] Streaming resumed');
    }
    async executeTool(toolName, args) {
        console.log(`[ChatService] Executing tool ${toolName}:`, args);
        if (toolName === 'addNode') {
            return this.executeAddNode(args);
        }
        else if (toolName === 'annotateNode') {
            return this.executeAnnotateNode(args);
        }
        else {
            return { success: false, error: `Unknown tool: ${toolName}` };
        }
    }
    async executeAddNode(args) {
        if (!this.currentBaseRevisionId) {
            return { success: false, error: 'No base revision set' };
        }
        const action = {
            id: `a-${Date.now()}`,
            type: 'add-node',
            timestamp: Date.now(),
            beforeRevisionId: this.currentBaseRevisionId,
            payload: args,
            source: 'ai',
            status: 'pending',
        };
        await getActionExecutor().queueAction(action);
        if (action.status === 'conflict') {
            return { success: false, conflict: true, message: action.error || 'Conflict detected' };
        }
        else if (action.status === 'failed') {
            return { success: false, error: action.error || 'Failed to add node' };
        }
        else {
            // Update base revision for next tool call (sequential AI operations)
            const newRevision = getGraphService().createRevision('system', 'After AI addNode');
            this.currentBaseRevisionId = newRevision.id;
            console.log(`[ChatService] addNode result:`, action.result);
            return {
                success: true,
                message: `Added ${args.nodeType} node`,
                nodeType: args.nodeType,
                nodeId: action.result?.nodeId, // Return nodeId for subsequent tool calls
            };
        }
    }
    async executeAnnotateNode(args) {
        if (!this.currentBaseRevisionId) {
            return { success: false, error: 'No base revision set' };
        }
        const action = {
            id: `a-${Date.now()}`,
            type: 'annotate-node',
            timestamp: Date.now(),
            beforeRevisionId: this.currentBaseRevisionId,
            payload: args,
            source: 'ai',
            status: 'pending',
        };
        await getActionExecutor().queueAction(action);
        if (action.status === 'applied') {
            // Update base revision for next tool call
            const newRevision = getGraphService().createRevision('system', 'After AI annotateNode');
            this.currentBaseRevisionId = newRevision.id;
            return { success: true, message: `Annotated node ${args.nodeId}` };
        }
        else {
            return { success: false, error: action.error || 'Failed to annotate' };
        }
    }
}
let chatServiceInstance = null;
export function getChatService() {
    if (!chatServiceInstance) {
        chatServiceInstance = new ChatService();
    }
    return chatServiceInstance;
}
