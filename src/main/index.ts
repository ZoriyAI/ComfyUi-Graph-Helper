/**
 * The main process entry point (package.json "main" points at its build, dist/main/index.js). In order: the
 * command-line answers, the profile folder (and the 0.x takeover), the single-instance lock, the log, then at
 * ready the permissions, the app:// page server, the database, the IPC handlers and the one window.
 * The order matters: nothing may open a file in the profile folder before the folder is settled and the lock held,
 * so most of this file runs at the top level, before app.whenReady.
 */
import { fileFromArgs, requestOpen } from './ipc/openIpc';
import { app, BrowserWindow, dialog, Menu, net, protocol, screen, session, shell, type WebContents } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { homeRedactor } from './diagnostics';
import { passwordStoreFlag } from '../shared/config/passwordStore';
import { readPasswordStoreOverride } from './settings/passwordStoreOverride';
import { initDatabase, closeDatabase, getDatabase } from './database';
import { setupIPC } from './ipc';
import { appEntryUrl, isTrustedAppUrl, setTrustedAppUrl } from './ipc/guard';
import { addLogRedactor, initLog, log, logsDir, redactForLog, routeConsole } from './log';
import { installCrashHandlers } from './crash';
import { startupFailureText } from './settings/databaseSafety';
import { isExpectedRestart, watchWindowHang } from './windowWatch';
import { appVersion, DISPLAY_NAME, STABLE_APP_NAME, usesStableProfile } from './identity';
import { commandLineAnswer } from './cli';
import { clampWindowState, MIN_WINDOW_SIZE, readWindowState, trackWindowState, WINDOW_BACKGROUND, WINDOW_STATE_FILE } from './windowState';
import { allowTestProvider, configureLocalContext, mainLLMService } from './llmService';
import { watchLoadedContext } from './llm/localContext';
import { readPreferences, readSettings } from './settings/repository';
import { configureModelTrace } from './trace/modelTrace';
import { internetFetch } from './net/proxy';
import { setKnownRootsSource, setMcpCallObserver } from './mcp/readOnly';
import { isDevelopmentRun, scriptedProviderAllowed } from './runMode';
import { APP_ENTRY, APP_SCHEME, APP_SCHEME_PRIVILEGES, bundleFileFor, bundleFileUrl } from './appProtocol';
import { secureProfileFolder } from './profileFolder';
import { adoptLegacyProfile, adoptionTexts, homeRelative, takeAdoptionNotice, type ProfileAdoption } from './profileAdoption';
import { syncService } from './mcp/sync';
import { setMcpClientVersion } from './mcp/client';
import { catalogModelRoots } from './mcp/knownRoots';
import { createTranslator, languageOf, type AppLanguage } from '../shared/i18n';
import { pseudoLocaleWanted, setSystemLanguages, systemLanguage } from './systemLanguage';
import type { SyncStatus } from '../shared/contracts/knowledge';

// The system's languages: the language of a first start and of dialogs shown before the settings can be read.
try { setSystemLanguages(app.getPreferredSystemLanguages()); } catch { /* the locale variables stand in */ }

// `--version` / `--help`: answer on the terminal and leave before anything opens.
const cliAnswer = commandLineAnswer(process.argv, appVersion(), systemLanguage());
if (cliAnswer !== null) {
  process.stdout.write(cliAnswer);
  process.exit(0);
}

/**
 * package.json productName (the display name) names the bundle and the window. Inside the app the name is the
 * package name: it names the profile folder (database, window state, logs) and the OS keyring entry the provider
 * key is encrypted under. --user-data-dir still wins (tests). See src/main/identity.ts.
 */
/** What the start did with a 0.x profile folder; read again once the window exists, for the notice. */
let profileAdoption: ProfileAdoption = { outcome: 'none' };
if (usesStableProfile(app.getName(), app.isPackaged)) {
  app.setName(STABLE_APP_NAME);
  if (!app.commandLine.hasSwitch('user-data-dir')) {
    // 1.0 renamed the profile folder: take over the 0.x one before anything below opens a file in the new one.
    profileAdoption = adoptLegacyProfile(app.getPath('appData'));
    // While a running 0.x holds the old folder, this start must not create the new one (it would block the
    // adoption for good): it runs on a throw-away folder only long enough to say so, then quits (see whenReady).
    app.setPath('userData', profileAdoption.outcome === 'old-in-use'
      ? fs.mkdtempSync(path.join(os.tmpdir(), `${STABLE_APP_NAME}-waiting-`))
      : path.join(app.getPath('appData'), STABLE_APP_NAME));
  }
}

// One app at a time: a second start hands over to the first window (see 'second-instance' below) and exits, so two
// processes never sync, sign in or write the same database at once.
const firstInstance = app.requestSingleInstanceLock();
if (!firstInstance) {
  // At once: app.exit alone lets the rest of this file run first (profile, log) in the instance that is leaving.
  app.exit(0);
  process.exit(0);
}

// The profile holds chats, prompts and the database: owner only, whatever the umask made of it.
secureProfileFolder(app.getPath('userData'));
// The log goes to <userData>/logs/main.log; stdout keeps a copy except in the packaged app.
initLog({ dir: path.join(app.getPath('userData'), 'logs'), mirror: !app.isPackaged || isDevelopmentRun(app.isPackaged) });
routeConsole();
addLogRedactor((text) => mainLLMService.redact(text));
// The home folder carries the person's user name: the log, diagnostics and the conversation log show it as `~`.
addLogRedactor(homeRedactor(os.homedir()));
// A model on the person's own server: while a request runs, ask the server which context window it loaded the
// model with (Ollama's /api/ps), so a request that does not fit is noticed and said. Read-only, same server.
configureLocalContext((base, model, signal) => watchLoadedContext(base, model, (...args) => fetch(...args), { signal }));
// The model conversation log lives next to the main log; the same redaction applies to every line of it.
configureModelTrace({
  dir: path.join(app.getPath('userData'), 'logs'),
  transport: internetFetch,
  redact: (text) => mainLLMService.redact(redactForLog(text)),
  enabled: () => {
    try {
      return readPreferences(getDatabase()).privacy.modelLog;
    } catch {
      // Before the database is open nothing talks to a model anyway.
      return false;
    }
  },
});
// One line per MCP tool call (never the payload): enough to see from the log why a sync read nothing.
setMcpCallObserver((note) => {
  const tail = `${note.items !== null ? ` items=${note.items}` : ''}${note.chars !== null ? ` chars=${note.chars}` : ''} ms=${note.ms}`;
  const tool = note.remote ? `${note.tool} (as ${note.remote})` : note.tool;
  if (note.ok) log.info(`[MCP] ${tool} ${note.args} ok${tail}`);
  else log.warn(`[MCP] ${tool} ${note.args} failed: ${note.error ?? 'error'}${tail}`);
});
log.info(
  `[App] Start ${DISPLAY_NAME} ${app.getVersion()} electron=${process.versions.electron} chrome=${process.versions.chrome} `
  + `node=${process.versions.node} platform=${process.platform}/${process.arch} packaged=${app.isPackaged}`,
);
log.info(`[App] Paths userData=${app.getPath('userData')} logs=${logsDir()}`);
if (profileAdoption.outcome !== 'none') log.info(`[App] Profile of 0.x: ${profileAdoption.outcome}${'error' in profileAdoption ? ` (${profileAdoption.error})` : ''}`);

// workspace_files reads only inside a folder the server named: the model folders of the last sync are known here.
setKnownRootsSource(() => {
  try {
    return catalogModelRoots(getDatabase());
  } catch {
    // Before the database is open nothing reads files from the server.
    return [];
  }
});

/** The settings language, or the system's language when the database cannot be read yet. */
function uiLanguage(): AppLanguage {
  try {
    return languageOf(readSettings(getDatabase()));
  } catch {
    return systemLanguage();
  }
}

// Set at quit: errors and dying renderers while the app shuts down are logged but not shown.
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
  if (quitting || details.reason === 'clean-exit' || contents.isDestroyed() || isExpectedRestart(contents)) return;
  const owner = BrowserWindow.fromWebContents(contents);
  if (!owner || owner.isDestroyed()) return;
  // The graph lives in the database, so a reload brings the page back with nothing committed lost.
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

/** The one window; null before it is created and after it closed. */
let mainWindow: BrowserWindow | null = null;

// Only an unpackaged app may be a development run: an installed app never trusts the dev server (runMode.ts).
const DEVELOPMENT = isDevelopmentRun(app.isPackaged);
const RENDERER_INDEX = path.join(__dirname, '../renderer/index.html');
const DEV_SERVER_URL = 'http://localhost:5173/';
// The built page is served as app://bundle/… (appProtocol.ts): CSP 'self' then means the bundle, not the whole disk.
protocol.registerSchemesAsPrivileged([{ scheme: APP_SCHEME, privileges: APP_SCHEME_PRIVILEGES }]);
// IPC handlers and navigation checks compare against this one URL.
setTrustedAppUrl(appEntryUrl({ development: DEVELOPMENT, devServerUrl: DEV_SERVER_URL, rendererIndexPath: RENDERER_INDEX, bundleEntry: APP_ENTRY }));
// The scripted TEST answers exist for development and tests only (runMode.ts).
allowTestProvider(scriptedProviderAllowed(app.isPackaged));

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
  // dist/main/index.js sits two levels under the project root, packaged or not.
  for (const file of [path.join(__dirname, '..', '..', 'package.json'), path.join(app.getAppPath(), 'package.json')]) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { version?: unknown; name?: unknown };
      if (typeof parsed.version === 'string' && parsed.name !== 'electron') return parsed.version;
    } catch {
      // Not there; the next place is tried.
    }
  }
  return app.getVersion();
}

/** Creates the window with its saved bounds, the locked-down webPreferences and the page for this kind of run. */
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
    // The layout is checked down to this size; the night colour avoids a white frame before the page paints.
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height,
    backgroundColor: WINDOW_BACKGROUND,
    show: false,
    ...(process.platform === 'linux' ? { icon: ICON_PATH } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      // Chromium's spell-check downloads its dictionaries from a Google server the first time a person types, and
      // only for English: off, so typing sends nothing anywhere.
      spellcheck: false,
      // The renderer's About section reads the app version from preload `versions.app`; the scripted TEST fixture
      // is a developer tool and is offered only when the app runs unpackaged (development and tests).
      additionalArguments: [`--app-version=${displayVersion()}`, ...(scriptedProviderAllowed(app.isPackaged) ? ['--test-provider=1'] : []), ...(pseudoLocaleWanted(app.isPackaged, process.env) ? ['--pseudo-locale=1'] : [])],
    },
  });

  // Shown once the first frame is painted (or after a few seconds, so a slow start never leaves no window).
  const shown = mainWindow;
  let revealed = false;
  const reveal = () => {
    if (revealed || shown.isDestroyed()) return;
    revealed = true;
    if (restored.maximized) shown.maximize();
    shown.show();
  };
  shown.once('ready-to-show', reveal);
  setTimeout(reveal, 4000);
  trackWindowState(mainWindow, stateFile);
  watchWindowHang(mainWindow, { translate: () => createTranslator(uiLanguage()), showMessageBox: (window, options) => dialog.showMessageBox(window as BrowserWindow, options) });

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
    mainWindow.loadURL(APP_ENTRY);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * What the person is told about the 0.x profile: once after it was taken over (which keys must be entered again),
 * or that it could not be read. Shown over the window once it has painted; never blocks the start.
 */
function tellAboutProfileMove(window: BrowserWindow): void {
  const notice = takeAdoptionNotice(app.getPath('userData'));
  const unreadable = profileAdoption.outcome === 'old-unreadable' || profileAdoption.outcome === 'failed' ? profileAdoption.from : null;
  if (!notice && !unreadable) return;
  const t = createTranslator(uiLanguage());
  const options = notice
    ? adoptionTexts(t, 'adopted', homeRelative(app.getPath('userData')))
    : { title: t('profileMove.unreadableTitle'), message: t('profileMove.unreadableMessage', { folder: homeRelative(unreadable ?? '') }), detail: '' };
  window.once('ready-to-show', () => {
    void dialog.showMessageBox(window, { type: 'info', buttons: [t('diagnostics.ok')], defaultId: 0, noLink: true, ...options });
  });
}

app.whenReady().then(async () => {
  if (profileAdoption.outcome === 'old-in-use') {
    // A running 0.x still holds its profile: say so and leave without touching either folder.
    const t = createTranslator(systemLanguage());
    const text = adoptionTexts(t, 'old-in-use', homeRelative(profileAdoption.from));
    await dialog.showMessageBox({ type: 'info', buttons: [t('diagnostics.ok')], defaultId: 0, noLink: true, ...text });
    // The throw-away folder made for this start (see the top of this file) goes again.
    fs.rmSync(app.getPath('userData'), { recursive: true, force: true });
    app.exit(0);
    return;
  }
  try {
    // No camera, microphone, notifications, geolocation or any other permission. Writing to the clipboard
    // (the "copy link" button) is the one exception; reading it is not.
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === 'clipboard-sanitized-write'));
    session.defaultSession.setPermissionCheckHandler((_contents, permission) => permission === 'clipboard-sanitized-write');
    // No spell-check: it downloads dictionaries from a Google server the first time a person types (see createWindow).
    session.defaultSession.setSpellCheckerEnabled(false);
    session.defaultSession.setSpellCheckerLanguages([]);
    // Only files inside the built renderer folder are served; anything else is a 404.
    const bundleDir = path.dirname(RENDERER_INDEX);
    protocol.handle(APP_SCHEME, (request) => {
      const file = bundleFileFor(bundleDir, request.url);
      return file ? net.fetch(bundleFileUrl(file)) : new Response('Not found', { status: 404 });
    });
    initDatabase();
    setMcpClientVersion(displayVersion());
    const settings = readSettings(getDatabase());
    log.info(`[Settings] Read source=${settings.source}${settings.source === 'corrupt' ? '' : ` provider=${settings.values.provider || 'none'} language=${settings.values.language}`}`);
    await setupIPC();
    // A workflow or project named on the command line opens once the window asks for it (ipc/openIpc.ts).
    requestOpen(fileFromArgs(process.argv, process.cwd()));
    logSyncRuns();
    Menu.setApplicationMenu(null);
    createWindow();
    if (mainWindow) tellAboutProfileMove(mainWindow);
  } catch (error) {
    log.error('[App] Startup failed', error);
    // Truly fatal: nothing can run without the database and the handlers. Say so before exiting.
    const t = createTranslator(uiLanguage());
    const text = startupFailureText(error, t, { profile: app.getPath('userData'), logs: logsDir() ?? '' }, (value) => mainLLMService.redact(value));
    if (text) dialog.showErrorBox(t('diagnostics.startupFailedTitle'), text);
    app.exit(1);
  }
});

app.on('second-instance', (_event, argv, workingDirectory) => {
  // A second start with a file hands the file to this window, which asks before replacing its graph.
  requestOpen(fileFromArgs(argv, workingDirectory));
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

// macOS keeps an app running without windows; the app is built for Linux, where closing the window quits.
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
