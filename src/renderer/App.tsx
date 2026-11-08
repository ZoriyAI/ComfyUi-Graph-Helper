import React, { useEffect, useRef, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import GraphWorkspace from './components/graph/GraphWorkspace';
import Dock from './components/shell/Dock';
import AppBar from './components/shell/AppBar';
import Toolbar from './components/shell/Toolbar';
import Rail from './components/shell/Rail';
import StatusBar from './components/shell/StatusBar';
import { describeNote, type WorkflowNote } from './components/shell/notices';
import styles from './components/shell/AppShell.module.css';
import SettingsPanel from './components/settings/SettingsPanel';
import { useChatStore } from './state/chatState';
import { useDockStore } from './state/dockState';
import { startSyncSubscription, useKnowledgeStore } from './state/knowledgeState';
import { startProposalsSubscription } from './state/proposalsState';
import { useUiStore } from './state/uiState';
import { applyProjection, useProjectionStore } from './services/commands/projection';
import { getChatService } from './services/llm/chatService';
import { showToast } from './ui/toastStore';
import { cx } from './ui/cx';
import { DESKTOP_PROJECT_ID } from '../shared/project';
import type { ChatRuntimeConfig, NonSecretSettings } from '../shared/config/schema';
import type { Translator } from '../shared/i18n';

type KeySource = 'none' | 'session' | 'os';
const CLOUD_PROVIDERS = new Set(['openai', 'anthropic', 'google']);

/** The provider chip text: which provider, and where its key lives. Never the key. */
export function providerNoteKey(provider: string, keySource: KeySource): string {
  if (provider === 'test') return 'provider.test';
  if (provider === 'local') return 'provider.local';
  if (provider === 'openai') return keySource === 'os' ? 'provider.openaiStored' : keySource === 'session' ? 'provider.openaiHeld' : 'provider.openai';
  if (provider === 'anthropic') return keySource === 'os' ? 'provider.cloudStored' : keySource === 'session' ? 'provider.anthropicHeld' : 'provider.anthropic';
  if (provider === 'google') return keySource === 'os' ? 'provider.cloudStored' : keySource === 'session' ? 'provider.googleHeld' : 'provider.google';
  return 'provider.none';
}

function markCurrentSaved() {
  useUiStore.getState().markSaved(useProjectionStore.getState().revSeq);
}

function App() {
  const { t } = useTranslation();
  const sessionOverride = useRef(false);
  const storedRuntime = useRef<ChatRuntimeConfig>({ provider: '', model: '', baseURL: '' });
  const [provider, setProvider] = useState('');
  const [keySource, setKeySource] = useState<KeySource>('none');
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const providerNote = String(t(providerNoteKey(provider, keySource)));
  const notify = (note: WorkflowNote) => showToast(describeNote(note, translate));

  useEffect(() => {
    // Both are idempotent; the canvas and the sync indicator may call them too.
    startSyncSubscription();
    startProposalsSubscription();
    window.electronAPI.readProjection(DESKTOP_PROJECT_ID).then((projection) => {
      applyProjection(projection);
      markCurrentSaved();
    }).catch((error) => {
      console.error('[App] Projection load failed:', error);
    });
    window.electronAPI.llmSessionStatus().then((status) => setKeySource(status.source)).catch(() => undefined);
  }, []);

  const showStoredRuntime = (values: NonSecretSettings) => {
    storedRuntime.current = { provider: values.provider, model: values.model, baseURL: values.baseURL };
    setProvider(values.provider);
    return window.electronAPI.llmSetConfig(storedRuntime.current);
  };

  const applyProvider = async (next: string) => {
    sessionOverride.current = true;
    if (next === 'test') {
      await window.electronAPI.llmSetConfig({ provider: 'test', model: 'test-fixture', baseURL: '' });
      setProvider(next);
      return;
    }
    if (CLOUD_PROVIDERS.has(next) || next === 'local') {
      const sameProvider = storedRuntime.current.provider === next;
      await window.electronAPI.llmSetConfig({
        provider: next,
        model: sameProvider ? storedRuntime.current.model : '',
        baseURL: sameProvider ? storedRuntime.current.baseURL : '',
      });
      setProvider(next);
      return;
    }
    await window.electronAPI.llmSetConfig({ provider: '', model: '', baseURL: '' });
    setProvider('');
  };

  const handleSendMessage = (content: string) => {
    getChatService().sendMessage(content);
  };

  const handlePause = () => {
    const chatService = getChatService();
    if (useChatStore.getState().isPaused) chatService.resume();
    else chatService.pause();
  };

  const handleImport = async () => {
    const result = await window.electronAPI.importWorkflow();
    if (!result || result.status === 'cancelled') return;
    if (result.projection) applyProjection(result.projection);
    if (result.status === 'rejected') {
      const reason = result.result && typeof result.result === 'object' && 'error' in result.result ? String(result.result.error) : 'Import was rejected.';
      notify({ kind: 'error', code: reason });
      return;
    }
    const report = result.result && typeof result.result === 'object' ? result.result as { formatVersion?: number; missingNodes?: string[]; missingModels?: Array<{ directory: string; name: string }> } : {};
    notify({
      kind: 'imported',
      version: String(report.formatVersion ?? '—'),
      missingNodes: report.missingNodes ?? [],
      missingModels: (report.missingModels ?? []).map((model) => `${model.directory}/${model.name}`),
    });
  };

  const handleCatalog = async () => {
    const result = await window.electronAPI.importCatalog();
    if (!result || result.status === 'cancelled') return;
    if (result.status === 'rejected') {
      notify({ kind: 'error', code: result.error });
      return;
    }
    useUiStore.getState().bumpCatalog();
    notify({ kind: 'catalog', nodes: result.result.nodes, models: result.result.models, skipped: result.result.skipped.length });
  };

  const handleExport = async () => {
    const result = await window.electronAPI.exportWorkflow();
    if (!result.ok && result.canceled) return;
    notify(result.ok ? { kind: 'exported' } : { kind: 'error', code: result.error || 'Export failed.' });
  };

  const handleOpenProject = async () => {
    const result = await window.electronAPI.openProject();
    if (!result || result.status === 'cancelled') return;
    if (result.projection) applyProjection(result.projection);
    if (result.status === 'rejected') {
      const reason = result.result && typeof result.result === 'object' && 'error' in result.result ? String(result.result.error) : 'The native project file is not valid.';
      notify({ kind: 'error', code: reason });
      return;
    }
    markCurrentSaved();
    notify({ kind: 'opened-project' });
  };

  const handleSaveProject = async () => {
    const result = await window.electronAPI.saveProjectFile();
    if (!result.ok && result.canceled) return;
    if (result.ok) markCurrentSaved();
    notify(result.ok ? { kind: 'saved-project' } : { kind: 'error', code: result.error || 'The project file could not be written.' });
  };

  const handleCheckGraph = () => {
    useDockStore.getState().show('check');
    void useKnowledgeStore.getState().runCheck().catch(() => undefined);
  };

  const providerOptions = [
    { value: '', label: String(t('provider.notConfigured')) },
    { value: 'test', label: String(t('provider.testFixture')) },
    { value: 'openai', label: String(t('provider.openaiSession')) },
    { value: 'anthropic', label: String(t('provider.anthropicSession')) },
    { value: 'google', label: String(t('provider.googleSession')) },
    { value: 'local', label: String(t('provider.localChip')) },
  ];

  return (
    <div className={cx(styles.shell, 'app-shell')}>
      <AppBar
        provider={provider}
        providerNote={providerNote}
        onOpenProject={() => void handleOpenProject()}
        onSaveProject={() => void handleSaveProject()}
        onCheckGraph={handleCheckGraph}
        onExport={() => void handleExport()}
        settings={(
          <SettingsPanel
            triggerIcon={<SettingsIcon size={16} />}
            onRead={(values) => {
              if (sessionOverride.current) return;
              void showStoredRuntime(values);
            }}
            onSession={setKeySource}
            onSaved={(values) => {
              sessionOverride.current = false;
              void showStoredRuntime(values);
            }}
          />
        )}
      />
      <Toolbar
        provider={provider}
        providerOptions={providerOptions}
        onProvider={(next) => {
          setProvider(next);
          void applyProvider(next);
        }}
        onImport={() => void handleImport()}
        onCatalog={() => void handleCatalog()}
      />
      <div className={cx(styles.body, 'app-body')}>
        <Rail />
        <main className={cx(styles.canvas, 'graph-pane')}>
          <GraphWorkspace />
        </main>
        <Dock onSendMessage={handleSendMessage} onPause={handlePause} />
      </div>
      <StatusBar />
    </div>
  );
}

export default App;
