import { useChatStore } from '../../state/chatState';
import { getGraphService } from '../graph/graphService';
import { getActionExecutor } from '../actions/actionExecutor';
class ChatService {
    isStreaming = false;
    async sendMessage(content) {
        if (this.isStreaming) {
            console.warn('[ChatService] Already streaming');
            return;
        }
        this.isStreaming = true;
        const { messages, addMessage } = useChatStore.getState();
        // Add user message
        addMessage({ id: `msg-${Date.now()}`, role: 'user', content, timestamp: Date.now() });
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
        try {
            await window.electronAPI.llmStreamChat(messageHistory, toolSpecs, (chunk) => {
                console.log('[ChatService] Chunk:', chunk.type);
                if (chunk.type === 'text-delta' && chunk.content.textDelta) {
                    assistantContent += chunk.content.textDelta;
                }
                else if (chunk.type === 'done') {
                    // Add final assistant message
                    if (assistantContent) {
                        addMessage({
                            id: `msg-${Date.now()}`,
                            role: 'assistant',
                            content: assistantContent,
                            timestamp: Date.now(),
                        });
                    }
                    this.isStreaming = false;
                }
                else if (chunk.type === 'error') {
                    console.error('[ChatService] Error:', chunk.content);
                    addMessage({
                        id: `msg-${Date.now()}`,
                        role: 'assistant',
                        content: `Error: ${chunk.content}`,
                        timestamp: Date.now(),
                    });
                    this.isStreaming = false;
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
        }
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
        const baseRev = getGraphService().createRevision('system', 'Before AI add');
        const action = {
            id: `a-${Date.now()}`,
            type: 'add-node',
            timestamp: Date.now(),
            beforeRevisionId: baseRev.id,
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
            return { success: true, message: `Added ${args.nodeType} node`, nodeType: args.nodeType };
        }
    }
    async executeAnnotateNode(args) {
        const baseRev = getGraphService().createRevision('system', 'Before AI annotate');
        const action = {
            id: `a-${Date.now()}`,
            type: 'annotate-node',
            timestamp: Date.now(),
            beforeRevisionId: baseRev.id,
            payload: args,
            source: 'ai',
            status: 'pending',
        };
        await getActionExecutor().queueAction(action);
        if (action.status === 'applied') {
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
