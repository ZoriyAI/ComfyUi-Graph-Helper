import React, { useEffect } from 'react';
import GraphCanvas from './components/graph/GraphCanvas';
import ChatPanel from './components/chat/ChatPanel';
import { useGraphStore } from './state/graphState';
import { useChatStore } from './state/chatState';
import { GraphNode } from './types/graph';
import { getChatService } from './services/llm/chatService';

function App() {
  const { nodes, addNode } = useGraphStore();
  const { addMessage } = useChatStore();

  // Initialize with sample nodes if empty
  useEffect(() => {
    if (nodes.length === 0) {
      const sampleNodes: GraphNode[] = [
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
        content:
          'Welcome to ComfyUI Graph Builder! I can help you build and modify workflows. Try asking me to add nodes, connect them, or explain what they do.',
        timestamp: Date.now(),
      });
    }
  }, []);

  const handleSendMessage = (content: string) => {
    const chatService = getChatService();
    chatService.sendMessage(content);
  };

  const handlePause = () => {
    const chatService = getChatService();
    const { isPaused } = useChatStore.getState();
    if (isPaused) {
      chatService.resume();
    } else {
      chatService.pause();
    }
  };

  const handleImport = async () => {
    try {
      const workflow = await window.electronAPI.importWorkflow();
      if (workflow) {
        console.log('[App] Imported workflow:', workflow);
        // Import logic will be implemented
      }
    } catch (error) {
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
    } catch (error) {
      console.error('[App] Export error:', error);
    }
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e0e0e0',
          background: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
          ComfyUI Graph Builder
        </h1>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleImport}
            style={{
              padding: '6px 12px',
              background: 'white',
              border: '1px solid #ccc',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Import
          </button>
          <button
            onClick={handleExport}
            style={{
              padding: '6px 12px',
              background: 'white',
              border: '1px solid #ccc',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Export
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Graph canvas - 70% */}
        <div style={{ flex: '0 0 70%' }}>
          <GraphCanvas />
        </div>

        {/* Chat panel - 30% */}
        <div style={{ flex: '0 0 30%', minWidth: '350px' }}>
          <ChatPanel onSendMessage={handleSendMessage} onPause={handlePause} />
        </div>
      </div>

      {/* Status bar */}
      <div
        style={{
          padding: '6px 16px',
          borderTop: '1px solid #e0e0e0',
          background: '#fafafa',
          fontSize: '12px',
          color: '#666',
          display: 'flex',
          gap: '16px',
        }}
      >
        <span>{nodes.length} nodes</span>
        <span>Platform: {window.electronAPI?.platform || 'unknown'}</span>
        <span>Electron: {window.electronAPI?.versions?.electron || 'N/A'}</span>
      </div>
    </div>
  );
}

export default App;
