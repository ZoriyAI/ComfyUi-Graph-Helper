import { app, BrowserWindow, Menu } from 'electron';
import * as path from 'path';
import { passwordStoreFlag } from '../shared/config/passwordStore';
import { initDatabase, closeDatabase } from './database';
import { setupIPC } from './ipc';

const storeFlag = passwordStoreFlag(process.env.XDG_CURRENT_DESKTOP, process.argv);
if (storeFlag) app.commandLine.appendSwitch('password-store', storeFlag);

let mainWindow: BrowserWindow | null = null;

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
    },
  });

  // The renderer draws the only menu bar (File · Edit · View …); Electron's default menu would be a second one.
  mainWindow.setMenuBarVisibility(false);

  // Load app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
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
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
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
