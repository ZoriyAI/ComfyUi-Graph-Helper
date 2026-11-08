import { app, BrowserWindow } from 'electron';
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

  // Load app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
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
