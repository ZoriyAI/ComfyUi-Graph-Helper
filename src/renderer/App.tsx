import React, { useEffect, useState } from 'react';
import { Download, Redo2, Unplug, Undo2, Upload } from 'lucide-react';
import GraphCanvas from './components/graph/GraphCanvas';
import Inspector from './components/graph/Inspector';
import ChatPanel from './components/chat/ChatPanel';
import SettingsPanel from './components/settings/SettingsPanel';
import { Button } from './ui/Button';
import { Hint } from './ui/Hint';
import { MotionRoot } from './ui/policy';
import { useGraphStore } from './state/graphState';
import { useChatStore } from './state/chatState';
import { applyProjection } from './services/commands/projection';
import { DESKTOP_PROJECT_ID } from '../shared/project';
import { getChatService } from './services/llm/chatService';

function App() {
  const { nodes } = useGraphStore();
  const [provider, setProvider] = useState('');
  const [providerNote, setProviderNote] = useState('No provider selected. Nothing is sent.');
  const [workflowNote, setWorkflowNote] = useState('');

  useEffect(() => {
    window.electronAPI.readProjection(DESKTOP_PROJECT_ID).then(applyProjection).catch((error) => {
      console.error('[App] Projection load failed:', error);
    });
  }, []);

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

  const handleImport = async () => {
    const result = await window.electronAPI.importWorkflow();
    if (!result || result.status === 'cancelled') return;
    if (result.projection) applyProjection(result.projection);
    if (result.status === 'rejected') {
      const reason = result.result && typeof result.result === 'object' && 'error' in result.result ? String(result.result.error) : 'Import was rejected.';
      setWorkflowNote(reason);
      return;
    }
    const report = result.result && typeof result.result === 'object' ? result.result as { formatVersion?: number; missingNodes?: string[]; missingModels?: Array<{ directory: string; name: string }> } : {};
    const missingNodes = report.missingNodes ?? [];
    const missingModels = report.missingModels ?? [];
    const nodeText = missingNodes.length > 0 ? `Missing nodes: ${missingNodes.join(', ')}.` : 'No missing nodes.';
    const modelText = missingModels.length > 0
      ? `Missing models: ${missingModels.map((model) => `${model.directory}/${model.name}`).join(', ')}.`
      : 'No missing models.';
    setWorkflowNote(`Imported format ${report.formatVersion}. ${nodeText} ${modelText}`);
  };

  const handleExport = async () => {
    const result = await window.electronAPI.exportWorkflow();
    if (!result.ok && result.canceled) return;
    setWorkflowNote(result.ok ? 'Exported the current workflow.' : result.error || 'Export failed.');
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
    <MotionRoot>
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">G</span>
          <div className="brand-copy">
            <h1 className="app-title">ComfyUI Graph Builder</h1>
            <span className="project-chip">Project Desktop</span>
          </div>
        </div>
        <div className="header-actions">
          <div className="toolbar-group">
            <Hint label="ComfyUI is not connected. This build does not start a queue.">
              <Button disabled title="ComfyUI is not connected. This build does not start a queue.">
                <Unplug size={14} aria-hidden="true" />
                ComfyUI not connected
              </Button>
            </Hint>
          </div>
          <div className="toolbar-group provider-controls">
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
            <p className="provider-note" title={providerNote}>{providerNote}</p>
          </div>
          <div className="toolbar-group">
            <Button onClick={() => void handleImport()}>
              <Download size={14} aria-hidden="true" />
              Import
            </Button>
            <Button onClick={() => void handleExport()}>
              <Upload size={14} aria-hidden="true" />
              Export
            </Button>
          </div>
          <div className="toolbar-group">
            <Hint label="Undo is not available in this build. Each commit stays in the revision history.">
              <Button disabled title="Undo is not available in this build. Each commit stays in the revision history.">
                <Undo2 size={14} aria-hidden="true" />
                Undo
              </Button>
            </Hint>
            <Hint label="Redo is not available in this build.">
              <Button disabled title="Redo is not available in this build.">
                <Redo2 size={14} aria-hidden="true" />
                Redo
              </Button>
            </Hint>
          </div>
          <SettingsPanel />
        </div>
      </header>
      {workflowNote ? <p className="workflow-banner">{workflowNote}</p> : null}
      <div className="app-body">
        <div className="graph-pane">
          <GraphCanvas />
        </div>
        <div className="chat-pane">
          <Inspector />
          <ChatPanel onSendMessage={handleSendMessage} onPause={handlePause} />
        </div>
      </div>
      <footer className="status-bar">
        <span className="status-link"><span className="status-dot" aria-hidden="true" />{nodes.length} nodes</span>
        <span>Platform: {window.electronAPI?.platform || 'unknown'}</span>
        <span>Electron: {window.electronAPI?.versions?.electron || 'N/A'}</span>
      </footer>
    </div>
    </MotionRoot>
  );
}

export default App;
