import React, { useState } from 'react';
import GraphCanvas from './components/graph/GraphCanvas';
import ChatPanel from './components/chat/ChatPanel';
import SettingsPanel from './components/settings/SettingsPanel';
import { useGraphStore } from './state/graphState';
import { useChatStore } from './state/chatState';
import { getChatService } from './services/llm/chatService';

function App() {
  const { nodes } = useGraphStore();
  const [provider, setProvider] = useState('');
  const [providerNote, setProviderNote] = useState('No provider selected. Nothing is sent.');

  const applyProvider = async (next: string) => {
    if (next === 'test') {
      await window.electronAPI.llmSetConfig({ provider: 'test', model: 'test-fixture' });
      setProviderNote('TEST fixture is on. Replies are scripted and are not a live model or your ComfyUI server.');
      return;
    }
    if (next === 'openai') {
      await window.electronAPI.llmSetConfig({
        provider: 'openai',
        model: '',
      });
      setProviderNote('OpenAI is selected with no key. The next send will fail before any graph change.');
    }
  };

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
          <small>Not connected to a ComfyUI server.</small>
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
                  void applyProvider(next);
                }}
              >
                <option value="">Not configured</option>
                <option value="test">TEST fixture</option>
                <option value="openai">OpenAI session</option>
              </select>
            </label>
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
      <SettingsPanel />
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
