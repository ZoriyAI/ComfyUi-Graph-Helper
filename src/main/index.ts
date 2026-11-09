import { app, BrowserWindow, dialog, Menu, screen, session, shell, type WebContents } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { passwordStoreFlag } from '../shared/config/passwordStore';
import { readPasswordStoreOverride } from './settings/passwordStoreOverride';
import { initDatabase, closeDatabase, getDatabase } from './database';
import { setupIPC } from './ipc';
import { appEntryUrl, isTrustedAppUrl, setTrustedAppUrl } from './ipc/guard';
import { addLogRedactor, initLog, log, logsDir, routeConsole } from './log';
import { installCrashHandlers } from './crash';
import { clampWindowState, readWindowState, trackWindowState, WINDOW_STATE_FILE } from './windowState';
import { mainLLMService } from './llmService';
import { readSettings } from './settings/repository';
import { syncService } from './mcp/sync';
import { createTranslator, languageOf, type AppLanguage } from '../shared/i18n';
import type { SyncStatus } from '../shared/contracts/knowledge';

/**
 * package.json productName ("Graph Helper for ComfyUI") names the package, the bundle and the desktop entry. Inside
 * the app the name stays the package name, as before: it names the profile folder (database, window state,
 * logs) and the OS keyring entry the provider key is encrypted under, so an update keeps both. --user-data-dir
 * still wins (tests).
 */
const STABLE_APP_NAME = 'comfyui-graph-builder';
// Only when package.json's productName is in effect (installed, or `electron .`); a bare script launch (tests)
// keeps Electron's own name and folder.
if (['ComfyUI Graph Helper', 'Graph Helper for ComfyUI'].includes(app.getName())) {
  app.setName(STABLE_APP_NAME);
  if (!app.commandLine.hasSwitch('user-data-dir')) app.setPath('userData', path.join(app.getPath('appData'), STABLE_APP_NAME));
}

// The log goes to <userData>/logs/main.log; stdout keeps a copy except in the packaged app.
initLog({ dir: path.join(app.getPath('userData'), 'logs'), mirror: !app.isPackaged || process.env.NODE_ENV === 'development' });
routeConsole();
addLogRedactor((text) => mainLLMService.redact(text));
log.info(
  `[App] Start ComfyUI Graph Helper ${app.getVersion()} electron=${process.versions.electron} chrome=${process.versions.chrome} `
  + `node=${process.versions.node} platform=${process.platform}/${process.arch} packaged=${app.isPackaged}`,
);
log.info(`[App] Paths userData=${app.getPath('userData')} logs=${logsDir()}`);

/** The settings language, or Russian (the default) when the database cannot be read yet. */
function uiLanguage(): AppLanguage {
  try {
    return languageOf(readSettings(getDatabase()));
  } catch {
    return 'ru';
  }
}

let quitting = false;
app.on('before-quit', () => {
  quitting = true;
});

installCrashHandlers({
  notify: (_kind, error) => {
    if (quitting || !app.isReady()) return;
    const t = createTranslator(uiLanguage());
    const detail = mainLLMService.redact(error instanceof Error ? error.message : String(error)).slice(0, 500);
    const options = {
      type: 'warning' as const,
      title: t('diagnostics.errorTitle'),
      message: t('diagnostics.errorMessage'),
      detail,
      buttons: [t('diagnostics.ok'), t('diagnostics.openLogs')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    };
    const shown = mainWindow && !mainWindow.isDestroyed() ? dialog.showMessageBox(mainWindow, options) : dialog.showMessageBox(options);
    void shown.then((choice) => {
      const dir = logsDir();
      if (choice.response === 1 && dir) void shell.openPath(dir);
    }).catch(() => undefined);
  },
});

app.on('render-process-gone', (_event, contents, details) => {
  log.error(`[App] Renderer process gone reason=${details.reason} exitCode=${details.exitCode}`);
  if (quitting || details.reason === 'clean-exit' || contents.isDestroyed()) return;
  const owner = BrowserWindow.fromWebContents(contents);
  if (!owner || owner.isDestroyed()) return;
  const t = createTranslator(uiLanguage());
  void dialog.showMessageBox(owner, {
    type: 'error',
    title: t('diagnostics.rendererGoneTitle'),
    message: t('diagnostics.rendererGoneMessage'),
    buttons: [t('diagnostics.reload'), t('diagnostics.close')],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  }).then((choice) => {
    if (choice.response === 0 && !contents.isDestroyed()) contents.reload();
  }).catch(() => undefined);
});

app.on('child-process-gone', (_event, details) => {
  if (details.reason !== 'clean-exit') log.warn(`[App] Child process gone type=${details.type} reason=${details.reason} exitCode=${details.exitCode}`);
});

/** One log line when a sync starts and one when it ends, with the counts or the error. */
function logSyncRuns(): void {
  let previous: SyncStatus['state'] | null = null;
  let started = 0;
  syncService.onStatus((status) => {
    if (status.state === 'running' && previous !== 'running') {
      started = Date.now();
      log.info('[Sync] Start');
    } else if (status.state !== 'running' && previous === 'running') {
      const counts = status.counts;
      log.info(
        `[Sync] End state=${status.state} ms=${Date.now() - started} classes=${counts.nodeClasses} detailed=${counts.detailedClasses} `
        + `packs=${counts.packs} models=${counts.models} enriched=${counts.enrichedModels}${status.lastError ? ` error=${status.lastError}` : ''}`,
      );
    }
    previous = status.state;
  });
}

// Settings ▸ Privacy ▸ Password store: the person's choice wins over the desktop heuristic. Read before ready.
const storeFlag = readPasswordStoreOverride(app.getPath('userData')) ?? passwordStoreFlag(process.env.XDG_CURRENT_DESKTOP, process.argv);
if (storeFlag) app.commandLine.appendSwitch('password-store', storeFlag);

let mainWindow: BrowserWindow | null = null;

const DEVELOPMENT = process.env.NODE_ENV === 'development';
const RENDERER_INDEX = path.join(__dirname, '../renderer/index.html');
const DEV_SERVER_URL = 'http://localhost:5173/';
// IPC handlers and navigation checks compare against this one URL.
setTrustedAppUrl(appEntryUrl({ development: DEVELOPMENT, devServerUrl: DEV_SERVER_URL, rendererIndexPath: RENDERER_INDEX }));

/**
 * The app page may not leave itself: no navigation to another URL, no new windows, no webviews.
 * Applied to every web contents the app creates, not only the main window.
 */
function hardenContents(contents: WebContents): void {
  contents.on('will-navigate', (event, url) => {
    if (!isTrustedAppUrl(url)) event.preventDefault();
  });
  contents.on('will-redirect', (event, url) => {
    if (!isTrustedAppUrl(url)) event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

app.on('web-contents-created', (_event, contents) => hardenContents(contents));

/** The window icon on Linux (other platforms take it from the bundle). */
const ICON_PATH = path.join(__dirname, '../../resources/icon.png');


/** The version a person should see: the app's own, also unpackaged, where Electron reports its own version instead. */
function displayVersion(): string {
  if (app.isPackaged) return app.getVersion();
  try {
    const raw = fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8');
    const version = (JSON.parse(raw) as { version?: unknown }).version;
    return typeof version === 'string' ? version : app.getVersion();
  } catch {
    return app.getVersion();
  }
}

function createWindow() {
  const stateFile = path.join(app.getPath('userData'), WINDOW_STATE_FILE);
  let workAreas: Array<{ x: number; y: number; width: number; height: number }> = [];
  try {
    const primary = screen.getPrimaryDisplay();
    workAreas = [primary.workArea, ...screen.getAllDisplays().filter((display) => display.id !== primary.id).map((display) => display.workArea)];
  } catch {
    workAreas = [];
  }
  const restored = clampWindowState(readWindowState(stateFile), workAreas);
  mainWindow = new BrowserWindow({
    ...restored.bounds,
    ...(process.platform === 'linux' ? { icon: ICON_PATH } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      // The renderer's About section reads the app version from preload `versions.app`; the scripted TEST fixture
      // is a developer tool and is offered only when the app runs unpackaged (development and tests).
      additionalArguments: [`--app-version=${displayVersion()}`, ...(app.isPackaged ? [] : ['--test-provider=1'])],
    },
  });

  if (restored.maximized) mainWindow.maximize();
  trackWindowState(mainWindow, stateFile);

  // The renderer draws the only menu bar (File · Edit · View …); Electron's default menu would be a second one.
  mainWindow.setMenuBarVisibility(false);

  // Load app
  hardenContents(mainWindow.webContents);
  if (DEVELOPMENT) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
    // Without the default menu its DevTools accelerator is gone; keep Ctrl+Shift+I in development.
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const toggle = (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i';
      if (!toggle) return;
      event.preventDefault();
      mainWindow?.webContents.toggleDevTools();
    });
  } else {
    mainWindow.loadFile(RENDERER_INDEX);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    // No camera, microphone, notifications, geolocation or any other permission. Writing to the clipboard
    // (the "copy link" button) is the one exception; reading it is not.
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === 'clipboard-sanitized-write'));
    session.defaultSession.setPermissionCheckHandler((_contents, permission) => permission === 'clipboard-sanitized-write');
    initDatabase();
    const settings = readSettings(getDatabase());
    log.info(`[Settings] Read source=${settings.source}${settings.source === 'corrupt' ? '' : ` provider=${settings.values.provider || 'none'} language=${settings.values.language}`}`);
    await setupIPC();
    logSyncRuns();
    Menu.setApplicationMenu(null);
    createWindow();
  } catch (error) {
    log.error('[App] Startup failed', error);
    // Truly fatal: nothing can run without the database and the handlers. Say so before exiting.
    const t = createTranslator(uiLanguage());
    const detail = mainLLMService.redact(error instanceof Error ? error.message : String(error)).slice(0, 500);
    dialog.showErrorBox(t('diagnostics.startupFailedTitle'), `${t('diagnostics.startupFailedMessage', { logs: logsDir() ?? '' })}\n\n${detail}`);
    app.exit(1);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('quit', () => {
  closeDatabase();
});
