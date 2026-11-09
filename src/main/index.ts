import { app, BrowserWindow, Menu, session, type WebContents } from 'electron';
import * as path from 'path';
import { passwordStoreFlag } from '../shared/config/passwordStore';
import { initDatabase, closeDatabase } from './database';
import { setupIPC } from './ipc';
import { appEntryUrl, isTrustedAppUrl, setTrustedAppUrl } from './ipc/guard';

const storeFlag = passwordStoreFlag(process.env.XDG_CURRENT_DESKTOP, process.argv);
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      // The renderer's About section reads the app version from preload `versions.app`.
      additionalArguments: [`--app-version=${app.getVersion()}`],
    },
  });

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
    await setupIPC();
    Menu.setApplicationMenu(null);
    createWindow();
  } catch (error) {
    console.error('[App] Startup failed', error);
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
