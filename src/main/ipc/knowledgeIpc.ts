import { BrowserWindow, type IpcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { guardedHandle } from './guard';
import type { SyncStatus } from '../../shared/contracts/knowledge';
import { getDatabase } from '../database';
import { knowledgeHandlers } from '../knowledge/handlers';
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
  const handlers = knowledgeHandlers({ db: getDatabase, sync: syncService, fetchImpl: globalThis.fetch });
  for (const [channel, handler] of Object.entries(handlers)) {
    guardedHandle(ipcMain, channel, (_event, ...args: unknown[]) => handler(...args));
  }
  syncService.onStatus(broadcast);
  syncService.start(getDatabase());
}
