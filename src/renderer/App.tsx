import React, { useEffect, useState } from 'react';
import GraphCanvas from './components/graph/GraphCanvas';
import ChatPanel from './components/chat/ChatPanel';
import { useGraphStore } from './state/graphState';
import { useChatStore } from './state/chatState';
import { GraphNode } from './types/graph';
import { getChatService } from './services/llm/chatService';

function App() {
  const { nodes, addNode } = useGraphStore();
  const { addMessage } = useChatStore();
  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [providerNote, setProviderNote] = useState('No provider selected. Nothing is sent.');

  const applyProvider = async (next: string, key: string) => {
    if (next === 'test') {
      await window.electronAPI.llmSetConfig({ provider: 'test', model: 'test-fixture' });
      setProviderNote('TEST fixture is on. Replies are scripted and are not a live model or your ComfyUI server.');
      return;
    }
    if (next === 'openai') {
      await window.electronAPI.llmSetConfig({
        provider: 'openai',
        model: 'gpt-4',
        apiKey: key,
      });
      setProviderNote(key
        ? 'OpenAI key stays in this window only. It is not written to disk.'
        : 'OpenAI is selected with no key. The next send will fail before any graph change.');
    }
  };

  // Initialize with sample nodes if empty
  useEffect(() => {
    if (nodes.length === 0) {
      const sampleNodes: GraphNode[] = [
        {
          id: 'node-1',
          type: 'comfy',
          position: { x: 80, y: 180 },
          data: {
            demo: true,
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
          position: { x: 560, y: 180 },
          data: {
            demo: true,
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
          'The two nodes on the canvas are a local DEMO sample, not a discovered ComfyUI catalog. Pick TEST fixture in the header for a scripted add-and-annotate reply, or OpenAI with a session key. This app does not call your ComfyUI server.',
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">
          ComfyUI Graph Builder
          <small>Local demo graph. Not connected to a ComfyUI server.</small>
        </h1>
        <div className="header-actions">
          <div className="provider-controls">
            <label>
              Chat provider
              <select
                id="chat-provider"
                aria-label="Chat provider"
                value={provider}
                onChange={(event) => {
                  const next = event.target.value;
                  setProvider(next);
                  void applyProvider(next, apiKey);
                }}
              >
                <option value="">Not configured</option>
                <option value="test">TEST fixture</option>
                <option value="openai">OpenAI session</option>
              </select>
            </label>
            {provider === 'openai' ? (
              <label>
                Session API key
                <input
                  type="password"
                  aria-label="OpenAI session API key"
                  autoComplete="off"
                  value={apiKey}
                  placeholder="Not saved"
                  onChange={(event) => {
                    const key = event.target.value;
                    setApiKey(key);
                    void applyProvider('openai', key);
                  }}
                />
              </label>
            ) : null}
          </div>
          <p className="provider-note">{providerNote}</p>
          <button type="button" className="ghost-button" disabled title="ComfyUI workflow import is not implemented.">
            Import
          </button>
          <button type="button" className="ghost-button" disabled title="ComfyUI workflow export is not implemented.">
            Export
          </button>
        </div>
      </header>
      <div className="app-body">
        <div className="graph-pane">
          <GraphCanvas />
        </div>
        <div className="chat-pane">
          <ChatPanel onSendMessage={handleSendMessage} onPause={handlePause} />
        </div>
      </div>
      <footer className="status-bar">
        <span>{nodes.length} nodes</span>
        <span>Platform: {window.electronAPI?.platform || 'unknown'}</span>
        <span>Electron: {window.electronAPI?.versions?.electron || 'N/A'}</span>
      </footer>
    </div>
  );
}

export default App;
