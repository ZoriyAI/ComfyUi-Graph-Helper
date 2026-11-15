import React, { forwardRef, useEffect } from 'react';
import { installFileOpening } from './commands/fileOpening';
import JourneyHost from './components/journey/JourneyHost';
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
import { installFocusRescue } from './a11y/focusRescue';
import { installHotkeys } from './commands/hotkeys';
import { installPreferences } from './state/preferencesBridge';
import { importWorkflowFile, openPendingFile } from './commands/actions';
import { installDrawWatch } from './services/start/drawWatch';
import { cx } from './ui/cx';
import { DESKTOP_PROJECT_ID } from '../shared/project';

export { providerKeyState, providerNoteKey } from './state/providerState';

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
    // Keyboard focus that falls to the page body goes back to a sensible element (a11y/focusRescue.ts).
    const offFocusRescue = installFocusRescue();
    const offPreferences = installPreferences();
    const offFrame = installFrameBalance();
    // Safe start: main may ask first whether to draw a graph the last start could not finish drawing.
    const offDraw = installDrawWatch();
    // Files dropped on the window and named on the command line (commands/fileOpening.ts).
    const offFiles = installFileOpening();
    window.electronAPI.startState().catch(() => null).then(() => window.electronAPI.readProjection(DESKTOP_PROJECT_ID)).then((projection) => {
      applyProjection(projection);
      // A file named on the command line opens once the graph it may replace is known.
      void openPendingFile();
    }).catch((error) => {
      console.error('[App] Projection load failed:', error);
    });
    void refreshKeySources().catch(() => undefined);
    return () => {
      offFiles();
      offDraw();
      offFrame();
      offPreferences();
      offHotkeys();
      offFocusRescue();
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
      {/* Accessibility: one top heading for the window, so a screen reader's heading list starts at the app. */}
      <h1 className="sr-only">{t('shell.title')}</h1>
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
      <JourneyHost />
    </div>
  );
}

export default App;
