/**
 * The main window's layout: menu bar, toolbar, rail, graph canvas, dock, status bar and the hosts for dialogs.
 * Rendered by index.tsx inside ErrorBoundary. Its one effect installs the app-wide services (commands, hotkeys,
 * focus rescue, preferences, sync and proposal subscriptions, file opening) and loads the saved project, then
 * removes them on unmount so a remount in StrictMode does not install them twice.
 */
import React, { forwardRef, useEffect, useState } from 'react';
import { installFileOpening } from './commands/fileOpening';
import JourneyHost from './components/journey/JourneyHost';
import { Settings as SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WORKSPACE_PANEL } from './commands/events';
import BrowserConnection, { installSharedSession } from './browser/SharedSession';
import { useDockStore } from './state/dockState';
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

// Kept for older imports; current callers import these from state/providerState directly.
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

/** The root component of the main window. */
function App() {
  const { t } = useTranslation();
  const [mobilePanel, setMobilePanel] = useState('canvas');
  useEffect(() => {
    const requested = (event: Event) => setMobilePanel((event as CustomEvent<string>).detail);
    window.addEventListener(WORKSPACE_PANEL, requested);
    return () => window.removeEventListener(WORKSPACE_PANEL, requested);
  }, []);
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
    const offShared = installSharedSession();
    // Safe start: main may ask first whether to draw a graph the last start could not finish drawing.
    const offDraw = installDrawWatch();
    // Files dropped on the window and named on the command line (commands/fileOpening.ts).
    const offFiles = installFileOpening();
    // The projection is read after the start state settles, even when it fails, so a broken start still shows a graph.
    window.electronAPI.startState().catch(() => null).then(() => window.electronAPI.readProjection(DESKTOP_PROJECT_ID)).then((projection) => {
      applyProjection(projection);
      // A file named on the command line opens once the graph it may replace is known.
      void openPendingFile();
    }).catch((error) => {
      console.error('[App] Projection load failed:', error);
    });
    void refreshKeySources().catch(() => undefined);
    return () => {
      offShared();
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
    <div className={cx(styles.shell, 'app-shell')} data-mobile-panel={mobilePanel}>
      {/* Accessibility: one top heading for the window, so a screen reader's heading list starts at the app. */}
      <h1 className="sr-only">{t('shell.title')}</h1>
      <BrowserConnection />
      <MenuBar />
      <Toolbar settings={settings} />
      <div className={cx(styles.body, 'app-body')}>
        <Rail />
        <main className={cx(styles.canvas, 'graph-pane')}>
          <GraphWorkspace onImportWorkflow={() => void importWorkflowFile()} />
        </main>
        <Dock onSendMessage={handleSendMessage} onPause={handlePause} />
      </div>
      <nav className={styles.mobileNav} aria-label={String(t('browser.panels'))}>
        {(['canvas', 'library', 'assistant', 'properties'] as const).map((panel) => <Button key={panel} aria-pressed={mobilePanel === panel} onClick={() => {
          setMobilePanel(panel);
          if (panel === 'library') useUiStore.getState().setRail(true);
          if (panel === 'assistant' || panel === 'properties') useDockStore.getState().show(panel === 'assistant' ? 'assistant' : 'inspector');
        }}>{t(panel === 'canvas' ? 'browser.canvas' : panel === 'library' ? 'browser.library' : panel === 'assistant' ? 'browser.assistant' : 'browser.properties')}</Button>)}
      </nav>
      <StatusBar />
      <CommandDialogs />
      <ModelLogHost />
      <JourneyHost />
    </div>
  );
}

export default App;
