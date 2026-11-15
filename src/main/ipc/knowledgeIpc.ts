import * as path from 'node:path';
import { app, BrowserWindow, type IpcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { guardedHandle } from './guard';
import type { SyncStatus } from '../../shared/contracts/knowledge';
import { getDatabase } from '../database';
import { knowledgeHandlers } from '../knowledge/handlers';
import { PREVIEW_CACHE_FOLDER, PreviewReader } from '../knowledge/preview';
import { ModelLookupService } from '../knowledge/modelWeb';
import { appWebClient, ModelWebClient, setAppWebClient } from '../knowledge/webLookup';
import { openSavedMcpSession } from '../mcp/savedSession';
import { comfyPreviewSource, syncService } from '../mcp/sync';

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

/** Knowledge (knowledge:*) and sync (sync:*) handlers. Called once from setupIPC, after the database is open. */
export function registerKnowledgeIpc(ipcMain: IpcMain): void {
  // Previews are kept in the app's own folder once read, so a card opens at once the second time.
  let cacheDir: string | null = null;
  try {
    cacheDir = path.join(app.getPath('userData'), PREVIEW_CACHE_FOLDER);
  } catch {
    cacheDir = null;
  }
  // A test build (never a packaged app) may point the model lookup at a fake of Civitai and Hugging Face.
  const fake = app.isPackaged ? '' : process.env.NODEWISE_TEST_MODEL_WEB ?? '';
  if (/^http:\/\/127\.0\.0\.1:\d+$/.test(fake)) {
    setAppWebClient(new ModelWebClient({ endpoints: { civitai: `${fake}/civitai`, huggingface: `${fake}/hf` }, fetchImpl: (url, init) => globalThis.fetch(url, init) }));
  }
  const previews = new PreviewReader({
    db: getDatabase,
    open: openSavedMcpSession,
    cacheDir,
    web: (url) => appWebClient().previewBytes(url),
    comfy: () => comfyPreviewSource(getDatabase()),
    fetchImpl: (...args) => globalThis.fetch(...args),
  });
  // A Hugging Face sample is downloaded at lookup to check it is a picture; it is kept, not downloaded again when shown.
  appWebClient().keepPreview = (url, got) => previews.keepWeb(url, got);
  const lookups = new ModelLookupService({ db: getDatabase, client: appWebClient, open: openSavedMcpSession });
  const handlers = knowledgeHandlers({
    db: getDatabase,
    sync: syncService,
    fetchImpl: globalThis.fetch,
    preview: (directory, name) => previews.get(directory, name),
    lookup: { hash: (directory, name) => lookups.hash(directory, name), lookup: (directory, name) => lookups.lookup(directory, name) },
  });
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
