import * as path from 'node:path';
import { app, BrowserWindow, type IpcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { guardedHandle } from './guard';
import type { SyncStatus } from '../../shared/contracts/knowledge';
import { getDatabase } from '../database';
import { knowledgeHandlers } from '../knowledge/handlers';
import { PreviewReader } from '../knowledge/preview';
import { openSavedMcpSession } from '../mcp/savedSession';
import { syncService } from '../mcp/sync';

/** Pushes sync status to every open window. A window closing mid-send must not break the sync. */
function broadcast(status: SyncStatus): void {
  let windows: BrowserWindow[] = [];
  try {
    windows = BrowserWindow.getAllWindows();
  } catch {
    return;
  }
  for (const window of windows) {
    try {
      if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.SYNC_EVENT, status);
    } catch {
      // Window went away between the check and the send.
    }
  }
}

/** KB workstream: knowledge:* and sync:* handlers. Called once from setupIPC, after the database is open. */
export function registerKnowledgeIpc(ipcMain: IpcMain): void {
  // Previews are kept in the app's own folder once read, so a card opens at once the second time.
  let cacheDir: string | null = null;
  try {
    cacheDir = path.join(app.getPath('userData'), 'model-previews');
  } catch {
    cacheDir = null;
  }
  const previews = new PreviewReader({ db: getDatabase, open: openSavedMcpSession, cacheDir });
  const handlers = knowledgeHandlers({ db: getDatabase, sync: syncService, fetchImpl: globalThis.fetch, preview: (directory, name) => previews.get(directory, name) });
  for (const [channel, handler] of Object.entries(handlers)) {
    guardedHandle(ipcMain, channel, (_event, ...args: unknown[]) => handler(...args));
  }
  syncService.onStatus(broadcast);
  // Quitting cancels the schedule and any background metadata reading, so no timer or MCP session outlives the app.
  try {
    app.on('before-quit', () => {
      syncService.stop();
      previews.stop();
    });
  } catch {
    // Not running inside Electron (tests).
  }
  syncService.start(getDatabase());
}
