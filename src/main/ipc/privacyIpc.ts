import { app, type IpcMain } from 'electron';
import * as path from 'path';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { clearPreviewCache, PREVIEW_CACHE_FOLDER, previewCacheSize } from '../knowledge/preview';

function previewFolder(): string {
  return path.join(app.getPath('userData'), PREVIEW_CACHE_FOLDER);
}

/** Pictures of another server's models do not stay on the disk once the address changed. */
export function clearPreviewsForNewAddress(): void {
  const cleared = clearPreviewCache(previewFolder());
  if (cleared.files > 0) console.log(`[Privacy] Picture cache cleared after an address change: ${cleared.files} files`);
}

/** Settings ▸ Privacy: the size of the picture cache and the button that empties it. */
export function registerPrivacyIpc(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.PRIVACY_PREVIEW_CACHE, () => previewCacheSize(previewFolder()));
  ipcMain.handle(IPC_CHANNELS.PRIVACY_CLEAR_PREVIEWS, () => clearPreviewCache(previewFolder()));
}
