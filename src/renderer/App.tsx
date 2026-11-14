import React, { forwardRef, useEffect } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import GraphWorkspace from './components/graph/GraphWorkspace';
import Dock from './components/shell/Dock';
import MenuBar from './components/shell/MenuBar';
import Toolbar, { toolButtonClass } from './components/shell/Toolbar';
import Rail from './components/shell/Rail';
import StatusBar from './components/shell/StatusBar';
import CommandDialogs from './components/shell/CommandDialogs';
import { ModelLogHost } from './components/log/ModelLogDialog';
import styles from './components/shell/AppShell.module.css';
import SettingsPanel from './components/settings/SettingsPanel';
import Button from './ui/Button';
import Hint from './ui/Hint';
import Shortcut from './ui/Shortcut';
import { useChatStore } from './state/chatState';
import { startSyncSubscription } from './state/knowledgeState';
import { startProposalsSubscription } from './state/proposalsState';
import { useUiStore } from './state/uiState';
import { installFrameBalance } from './state/frame';
import { refreshKeySources, useProviderStore } from './state/providerState';
import { applyProjection, useProjectionStore } from './services/commands/projection';
import { getChatService } from './services/llm/chatService';
import { installAppCommands } from './commands/appCommands';
import { useCommandState } from './commands/registry';
import { installHotkeys } from './commands/hotkeys';
import { installPreferences } from './state/preferencesBridge';
import { importWorkflowFile } from './commands/actions';
import { cx } from './ui/cx';
import { DESKTOP_PROJECT_ID } from '../shared/project';

export { providerKeyState, providerNoteKey } from './state/providerState';

function markCurrentSaved() {
  useUiStore.getState().markSaved(useProjectionStore.getState().revSeq);
}

/** The settings button at the right end of the toolbar: a gear, named "Settings" by its text. */
const SettingsButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(function SettingsButton(props, ref) {
  const { t } = useTranslation();
  return (
    <Button ref={ref} {...props} className={cx(props.className, toolButtonClass, 'toolbar-settings')} icon={<SettingsIcon size={16} aria-hidden="true" />}>
      <span className="sr-only">{t('shell.settings')}</span>
    </Button>
  );
});

function App() {
  const { t } = useTranslation();
  // Preferences ▸ Shortcuts may move or remove Mod+, ; the hint shows what the command has now.
  const settingsShortcut = useCommandState('file.settings').command?.shortcut;

  useEffect(() => {
    // Both are idempotent; the canvas and the sync indicator may call them too.
    startSyncSubscription();
    startProposalsSubscription();
    const offCommands = installAppCommands();
    const offHotkeys = installHotkeys();
    const offPreferences = installPreferences();
    const offFrame = installFrameBalance();
    window.electronAPI.readProjection(DESKTOP_PROJECT_ID).then((projection) => {
      applyProjection(projection);
      markCurrentSaved();
    }).catch((error) => {
      console.error('[App] Projection load failed:', error);
    });
    void refreshKeySources().catch(() => undefined);
    return () => {
      offFrame();
      offPreferences();
      offHotkeys();
      offCommands();
    };
  }, []);

  const handleSendMessage = (content: string) => {
    getChatService().sendMessage(content);
  };

  const handlePause = () => {
    const chatService = getChatService();
    if (useChatStore.getState().isPaused) chatService.resume();
    else chatService.pause();
  };

  const settings = (
    <Hint label={String(t('shell.settings'))} side="bottom" shortcut={settingsShortcut ? <Shortcut shortcut={settingsShortcut} /> : undefined}>
      <SettingsPanel
        trigger={<SettingsButton />}
        onRead={(values) => void useProviderStore.getState().showStored(values)}
        onSession={(sources) => useProviderStore.getState().setKeySources(sources)}
        onSaved={(values) => void useProviderStore.getState().showStored(values, true)}
      />
    </Hint>
  );

  return (
    <div className={cx(styles.shell, 'app-shell')}>
      <MenuBar />
      <Toolbar settings={settings} />
      <div className={cx(styles.body, 'app-body')}>
        <Rail />
        <main className={cx(styles.canvas, 'graph-pane')}>
          <GraphWorkspace onImportWorkflow={() => void importWorkflowFile()} />
        </main>
        <Dock onSendMessage={handleSendMessage} onPause={handlePause} />
      </div>
      <StatusBar />
      <CommandDialogs />
      <ModelLogHost />
    </div>
  );
}

export default App;
