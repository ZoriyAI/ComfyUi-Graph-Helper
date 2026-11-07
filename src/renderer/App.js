import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import GraphCanvas from './components/graph/GraphCanvas';
import ChatPanel from './components/chat/ChatPanel';
import { useGraphStore } from './state/graphState';
import { useChatStore } from './state/chatState';
function App() {
    const { nodes, addNode } = useGraphStore();
    const { addMessage } = useChatStore();
    // Initialize with sample nodes if empty
    useEffect(() => {
        if (nodes.length === 0) {
            const sampleNodes = [
                {
                    id: 'node-1',
                    type: 'comfy',
                    position: { x: 100, y: 150 },
                    data: {
                        comfyType: 'LoadImage',
                        title: 'Load Image',
                        inputs: [],
                        outputs: [
                            { id: 'out-0', name: 'IMAGE', dataType: 'IMAGE', optional: false },
                        ],
                        parameters: { image: 'example.png' },
                    },
                },
                {
                    id: 'node-2',
                    type: 'comfy',
                    position: { x: 400, y: 150 },
                    data: {
                        comfyType: 'KSampler',
                        title: 'KSampler',
                        inputs: [
                            { id: 'in-0', name: 'model', dataType: 'MODEL', optional: false },
                            { id: 'in-1', name: 'positive', dataType: 'CONDITIONING', optional: false },
                            { id: 'in-2', name: 'negative', dataType: 'CONDITIONING', optional: false },
                            { id: 'in-3', name: 'latent_image', dataType: 'LATENT', optional: false },
                        ],
                        outputs: [
                            { id: 'out-0', name: 'LATENT', dataType: 'LATENT', optional: false },
                        ],
                        parameters: {
                            seed: 12345,
                            steps: 20,
                            cfg: 7.0,
                            sampler_name: 'euler',
                        },
                    },
                },
            ];
            sampleNodes.forEach((node) => addNode(node));
            // Welcome message
            addMessage({
                id: 'welcome',
                role: 'assistant',
                content: 'Welcome to ComfyUI Graph Builder! I can help you build and modify workflows. Try asking me to add nodes, connect them, or explain what they do.',
                timestamp: Date.now(),
            });
        }
    }, []);
    const handleSendMessage = (content) => {
        // Add user message
        const userMessageId = `msg-${Date.now()}`;
        addMessage({
            id: userMessageId,
            role: 'user',
            content,
            timestamp: Date.now(),
        });
        // Mock AI response (will be replaced with real LLM)
        setTimeout(() => {
            const assistantMessageId = `msg-${Date.now() + 1}`;
            addMessage({
                id: assistantMessageId,
                role: 'assistant',
                content: `I received your request: "${content}". Full LLM integration is being implemented. For now, you can manually edit the graph by dragging nodes and creating connections.`,
                timestamp: Date.now(),
            });
        }, 500);
    };
    const handlePause = () => {
        useChatStore.setState({ isPaused: true });
        console.log('[App] Paused AI operation');
    };
    const handleImport = async () => {
        try {
            const workflow = await window.electronAPI.importWorkflow();
            if (workflow) {
                console.log('[App] Imported workflow:', workflow);
                // Import logic will be implemented
            }
        }
        catch (error) {
            console.error('[App] Import error:', error);
        }
    };
    const handleExport = async () => {
        try {
            const { nodes, edges } = useGraphStore.getState();
            const workflow = {
                version: '1.0',
                nodes: nodes.map((n) => n.data.comfyData || {}),
                edges: edges.map((e) => e.data?.comfyData || {}),
            };
            const success = await window.electronAPI.exportWorkflow(workflow);
            if (success) {
                console.log('[App] Exported successfully');
            }
        }
        catch (error) {
            console.error('[App] Export error:', error);
        }
    };
    return (_jsxs("div", { style: {
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }, children: [_jsxs("div", { style: {
                    padding: '12px 16px',
                    borderBottom: '1px solid #e0e0e0',
                    background: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }, children: [_jsx("h1", { style: { margin: 0, fontSize: '18px', fontWeight: 600 }, children: "ComfyUI Graph Builder" }), _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [_jsx("button", { onClick: handleImport, style: {
                                    padding: '6px 12px',
                                    background: 'white',
                                    border: '1px solid #ccc',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                }, children: "Import" }), _jsx("button", { onClick: handleExport, style: {
                                    padding: '6px 12px',
                                    background: 'white',
                                    border: '1px solid #ccc',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                }, children: "Export" })] })] }), _jsxs("div", { style: { flex: 1, display: 'flex', overflow: 'hidden' }, children: [_jsx("div", { style: { flex: '0 0 70%' }, children: _jsx(GraphCanvas, {}) }), _jsx("div", { style: { flex: '0 0 30%', minWidth: '350px' }, children: _jsx(ChatPanel, { onSendMessage: handleSendMessage, onPause: handlePause }) })] }), _jsxs("div", { style: {
                    padding: '6px 16px',
                    borderTop: '1px solid #e0e0e0',
                    background: '#fafafa',
                    fontSize: '12px',
                    color: '#666',
                    display: 'flex',
                    gap: '16px',
                }, children: [_jsxs("span", { children: [nodes.length, " nodes"] }), _jsxs("span", { children: ["Platform: ", window.electronAPI?.platform || 'unknown'] }), _jsxs("span", { children: ["Electron: ", window.electronAPI?.versions?.electron || 'N/A'] })] })] }));
}
export default App;
