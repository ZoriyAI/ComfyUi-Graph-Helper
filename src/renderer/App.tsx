import React, { useEffect, useRef, useState } from 'react';
import { FolderInput, FolderOutput, Redo2, Undo2, Unplug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import { explainError, type Translator } from '../shared/i18n';
import { getChatService } from './services/llm/chatService';

type WorkflowNote =
  | { kind: 'imported'; version: string; missingNodes: string[]; missingModels: string[] }
  | { kind: 'catalog'; nodes: number; models: number; skipped: number }
  | { kind: 'exported' }
  | { kind: 'error'; code: string }
  | null;

function WorkflowReport({ note }: { note: WorkflowNote }) {
  const { t } = useTranslation();
  if (!note) return null;
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  let summary = '';
  let diagnostic: string | null = null;
  if (note.kind === 'imported') {
    const nodeText = note.missingNodes.length > 0
      ? translate('workflow.missingNodes', { names: note.missingNodes.join(', ') })
      : translate('workflow.noMissingNodes');
    const modelText = note.missingModels.length > 0
      ? translate('workflow.missingModels', { names: note.missingModels.join(', ') })
      : translate('workflow.noMissingModels');
    summary = translate('workflow.imported', { version: note.version, nodeText, modelText });
  } else if (note.kind === 'catalog') {
    summary = translate('workflow.catalogImported', note);
  } else if (note.kind === 'exported') {
    summary = translate('workflow.exported');
  } else {
    const explained = explainError(translate, note.code);
    summary = explained.summary;
    diagnostic = explained.diagnostic;
  }
  return (
    <p className="workflow-report banner" role="status">
      <span>{summary}</span>
      {diagnostic ? <span className="workflow-diagnostic"> {diagnostic}</span> : null}
    </p>
  );
}

function App() {
  const { t } = useTranslation();
  const { nodes, zoom } = useGraphStore();
  const sessionOverride = useRef(false);
  const [provider, setProvider] = useState('');
  const [workflowNote, setWorkflowNote] = useState<WorkflowNote>(null);
  const providerNote = provider === 'test'
    ? t('provider.test')
    : provider === 'openai'
      ? t('provider.openai')
      : t('provider.none');

  useEffect(() => {
    window.electronAPI.readProjection(DESKTOP_PROJECT_ID).then(applyProjection).catch((error) => {
      console.error('[App] Projection load failed:', error);
    });
  }, []);

  const showStoredRuntime = (values: NonSecretSettings) => {
    setProvider(values.provider);
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
      setProvider(next);
      return;
    }
    if (next === 'openai') {
      await window.electronAPI.llmSetConfig({
        provider: 'openai',
        model: '',
      });
      setProvider(next);
      return;
    }
    await window.electronAPI.llmSetConfig({ provider: '', model: '', baseURL: '' });
    setProvider('');
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
      setWorkflowNote({ kind: 'error', code: reason });
      return;
    }
    const report = result.result && typeof result.result === 'object' ? result.result as { formatVersion?: number; missingNodes?: string[]; missingModels?: Array<{ directory: string; name: string }> } : {};
    const missingNodes = report.missingNodes ?? [];
    const missingModels = (report.missingModels ?? []).map((model) => `${model.directory}/${model.name}`);
    setWorkflowNote({ kind: 'imported', version: String(report.formatVersion ?? '—'), missingNodes, missingModels });
  };

  const handleCatalog = async () => {
    const result = await window.electronAPI.importCatalog();
    if (!result || result.status === 'cancelled') return;
    if (result.status === 'rejected') {
      setWorkflowNote({ kind: 'error', code: result.error });
      return;
    }
    setWorkflowNote({
      kind: 'catalog',
      nodes: result.result.nodes,
      models: result.result.models,
      skipped: result.result.skipped.length,
    });
  };

  const handleExport = async () => {
    const result = await window.electronAPI.exportWorkflow();
    if (!result.ok && result.canceled) return;
    setWorkflowNote(result.ok ? { kind: 'exported' } : { kind: 'error', code: result.error || 'Export failed.' });
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
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));

  return (
    <div className="app-shell">
      <header className="document-bar">
        <div className="brand">
          <span className="product-mark" aria-hidden="true" />
          <h1 className="app-title">{t('shell.title')}</h1>
          <span className="project-chip" title={String(t('shell.project'))}>{t('shell.project')}</span>
        </div>
        <div className="header-status">
          <Hint label={String(t('status.comfyDisconnectedHint'))}>
            <button
              type="button"
              className="status-chip"
              disabled
              title={String(t('status.comfyDisconnectedHint'))}
            >
              <Unplug size={16} aria-hidden="true" />
              {t('status.comfyDisconnected')}
            </button>
          </Hint>
          <Hint label={String(providerNote)}>
            <span className="status-chip provider-chip" role="status" title={String(providerNote)}>{providerNote}</span>
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
      <div className="workspace-toolbar" role="toolbar" aria-label={String(t('toolbar.aria'))}>
        <button type="button" className="ghost-button" onClick={() => void handleImport()}>
          <FolderInput size={16} aria-hidden="true" />
          {t('toolbar.import')}
        </button>
        <button type="button" className="ghost-button" onClick={() => void handleCatalog()}>{t('toolbar.catalog')}</button>
        <button type="button" className="ghost-button" onClick={() => void handleExport()}>
          <FolderOutput size={16} aria-hidden="true" />
          {t('toolbar.export')}
        </button>
        <span className="toolbar-rule" aria-hidden="true" />
        <Hint label={String(t('toolbar.undoHint'))}>
          <button
            type="button"
            className="ghost-button"
            disabled
            title={String(t('toolbar.undoHint'))}
          >
            <Undo2 size={16} aria-hidden="true" />
            {t('toolbar.undo')}
          </button>
        </Hint>
        <Hint label={String(t('toolbar.redoHint'))}>
          <button type="button" className="ghost-button" disabled title={String(t('toolbar.redoHint'))}>
            <Redo2 size={16} aria-hidden="true" />
            {t('toolbar.redo')}
          </button>
        </Hint>
        <span className="toolbar-rule" aria-hidden="true" />
        <ToolToggles />
        <span className="toolbar-rule" aria-hidden="true" />
        <SelectField
          id="chat-provider"
          label={String(t('provider.label'))}
          value={provider}
          options={[
            { value: '', label: String(t('provider.notConfigured')) },
            { value: 'test', label: String(t('provider.testFixture')) },
            { value: 'openai', label: String(t('provider.openaiSession')) },
          ]}
          onChange={(next) => {
            setProvider(next);
            void applyProvider(next);
          }}
        />
      </div>
      <WorkflowReport note={workflowNote} />
      <div className="app-body">
        <div className="graph-pane">
          <GraphCanvas />
        </div>
        <Dock onSendMessage={handleSendMessage} onPause={handlePause} />
      </div>
      <footer className="status-bar">
        <span>{translate('status.nodes', { count: nodes.length })}</span>
        <span>{selectedCount === 0 ? t('status.noSelection') : translate('status.selected', { count: selectedCount })}</span>
        <span>{translate('status.zoom', { percent: Math.round(zoom * 100) })}</span>
        <span>{t('status.notConnected')}</span>
      </footer>
    </div>
  );
}

export default App;
