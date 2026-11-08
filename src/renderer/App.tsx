import React, { useEffect, useRef, useState } from 'react';
import { FolderInput, FolderOutput, Redo2, Undo2, Unplug } from 'lucide-react';
import GraphCanvas from './components/graph/GraphCanvas';
import Dock, { ToolToggles } from './components/shell/Dock';
import SettingsPanel from './components/settings/SettingsPanel';
import Hint from './ui/Hint';
import SelectField from './ui/SelectField';
import { useGraphStore } from './state/graphState';
import { useChatStore } from './state/chatState';
import { applyProjection } from './services/commands/projection';
import { DESKTOP_PROJECT_ID } from '../shared/project';
import type { NonSecretSettings } from '../shared/config/schema';
import { getChatService } from './services/llm/chatService';

function noteForProvider(provider: string): string {
  if (provider === 'test') return 'TEST fixture is on. Replies are scripted and are not a live model or your ComfyUI server.';
  if (provider === 'openai') return 'OpenAI is selected with no key. The next send will fail before any graph change.';
  return 'No provider selected. Nothing is sent.';
}

function App() {
  const { nodes, zoom } = useGraphStore();
  const sessionOverride = useRef(false);
  const [provider, setProvider] = useState('');
  const [providerNote, setProviderNote] = useState('No provider selected. Nothing is sent.');
  const [workflowNote, setWorkflowNote] = useState('');

  useEffect(() => {
    window.electronAPI.readProjection(DESKTOP_PROJECT_ID).then(applyProjection).catch((error) => {
      console.error('[App] Projection load failed:', error);
    });
  }, []);

  const showStoredRuntime = (values: NonSecretSettings) => {
    setProvider(values.provider);
    setProviderNote(noteForProvider(values.provider));
    return window.electronAPI.llmSetConfig({
      provider: values.provider,
      model: values.model,
      baseURL: values.baseURL,
    });
  };

  const applyProvider = async (next: string) => {
    sessionOverride.current = true;
    if (next === 'test') {
      await window.electronAPI.llmSetConfig({ provider: 'test', model: 'test-fixture' });
      setProviderNote(noteForProvider(next));
      return;
    }
    if (next === 'openai') {
      await window.electronAPI.llmSetConfig({
        provider: 'openai',
        model: '',
      });
      setProviderNote(noteForProvider(next));
      return;
    }
    await window.electronAPI.llmSetConfig({ provider: '', model: '', baseURL: '' });
    setProviderNote(noteForProvider(''));
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

  const handleCatalog = async () => {
    const result = await window.electronAPI.importCatalog();
    if (!result || result.status === 'cancelled') return;
    if (result.status === 'rejected') {
      setWorkflowNote(result.error);
      return;
    }
    setWorkflowNote(`Catalog snapshot imported. Nodes: ${result.result.nodes}. Models: ${result.result.models}. Skipped: ${result.result.skipped.length}.`);
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

  const selectedCount = nodes.filter((node) => node.selected).length;

  return (
    <div className="app-shell">
      <header className="document-bar">
        <div className="brand">
          <span className="product-mark" aria-hidden="true" />
          <h1 className="app-title">ComfyUI Graph Builder</h1>
          <span className="project-chip" title="Project Desktop">Project Desktop</span>
        </div>
        <div className="header-status">
          <Hint label="ComfyUI is not connected. This build does not start a queue.">
            <button
              type="button"
              className="status-chip"
              disabled
              title="ComfyUI is not connected. This build does not start a queue."
            >
              <Unplug size={16} aria-hidden="true" />
              ComfyUI not connected
            </button>
          </Hint>
          <Hint label={providerNote}>
            <span className="status-chip provider-chip" role="status" title={providerNote}>{providerNote}</span>
          </Hint>
          <SettingsPanel
            onRead={(values) => {
              if (sessionOverride.current) return;
              void showStoredRuntime(values);
            }}
            onSaved={(values) => {
              sessionOverride.current = false;
              void showStoredRuntime(values);
            }}
          />
        </div>
      </header>
      <div className="workspace-toolbar" role="toolbar" aria-label="Workspace">
        <button type="button" className="ghost-button" onClick={() => void handleImport()}>
          <FolderInput size={16} aria-hidden="true" />
          Import
        </button>
        <button type="button" className="ghost-button" onClick={() => void handleCatalog()}>Catalog snapshot</button>
        <button type="button" className="ghost-button" onClick={() => void handleExport()}>
          <FolderOutput size={16} aria-hidden="true" />
          Export
        </button>
        <span className="toolbar-rule" aria-hidden="true" />
        <Hint label="Undo is not available in this build. Each commit stays in the revision history.">
          <button
            type="button"
            className="ghost-button"
            disabled
            title="Undo is not available in this build. Each commit stays in the revision history."
          >
            <Undo2 size={16} aria-hidden="true" />
            Undo
          </button>
        </Hint>
        <Hint label="Redo is not available in this build.">
          <button type="button" className="ghost-button" disabled title="Redo is not available in this build.">
            <Redo2 size={16} aria-hidden="true" />
            Redo
          </button>
        </Hint>
        <span className="toolbar-rule" aria-hidden="true" />
        <ToolToggles />
        <span className="toolbar-rule" aria-hidden="true" />
        <SelectField
          id="chat-provider"
          label="Chat provider"
          value={provider}
          options={[
            { value: '', label: 'Not configured' },
            { value: 'test', label: 'TEST fixture' },
            { value: 'openai', label: 'OpenAI session' },
          ]}
          onChange={(next) => {
            setProvider(next);
            void applyProvider(next);
          }}
        />
      </div>
      {workflowNote ? <p className="workflow-report banner" role="status">{workflowNote}</p> : null}
      <div className="app-body">
        <div className="graph-pane">
          <GraphCanvas />
        </div>
        <Dock onSendMessage={handleSendMessage} onPause={handlePause} />
      </div>
      <footer className="status-bar">
        <span>{nodes.length} nodes</span>
        <span>{selectedCount === 0 ? 'No selection' : `${selectedCount} selected`}</span>
        <span>Zoom {Math.round(zoom * 100)}%</span>
        <span>Not connected</span>
      </footer>
    </div>
  );
}

export default App;
