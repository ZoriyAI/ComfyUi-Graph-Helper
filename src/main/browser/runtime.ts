/** Connects the optional browser host to the existing desktop profile and lifecycle. */
import { app, BrowserWindow, ipcMain } from 'electron';
import { BrowserAccessServer } from './server';
import { invokeBrowserMethod, onBrowserEvent } from './registry';
import { guardedHandle } from '../ipc/guard';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { getDatabase } from '../database';
import { preferencesDefaults } from '../../shared/config/preferences';
import { readSettings } from '../settings/repository';

let service: BrowserAccessServer | null = null;
let requested = '';

/** Adopt only a changed host configuration, preserving paired sessions during ordinary preference saves. */
export async function applyBrowserAccess(): Promise<void> {
  if (!service) return;
  const read = readSettings(getDatabase());
  const config = (read.preferences ?? preferencesDefaults).browserAccess;
  const key = JSON.stringify(config);
  if (requested === key) return;
  requested = key;
  await service.configure(config);
}

/** Registers desktop-only controls and starts only the explicitly enabled listener. */
export async function setupBrowserAccess(rendererDir: string): Promise<void> {
  service = new BrowserAccessServer({
    rendererDir,
    invoke: invokeBrowserMethod,
    bootstrap: () => ({ platform: process.platform, versions: { app: app.getVersion(), node: '', electron: '', chrome: '' }, flags: { testProvider: !app.isPackaged && process.argv.includes('--test-provider=1'), pseudoLocale: false } }),
  });
  onBrowserEvent((channel, payload) => {
    service?.publish(channel, payload);
    if (channel === IPC_CHANNELS.BROWSER_REFRESH && service?.hasDevices()) for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send(channel, payload);
  });
  guardedHandle(ipcMain, IPC_CHANNELS.BROWSER_STATUS, () => service!.status());
  guardedHandle(ipcMain, IPC_CHANNELS.BROWSER_PAIR_CODE, () => service!.pairingCode());
  guardedHandle(ipcMain, IPC_CHANNELS.BROWSER_REVOKE, (_event, id: unknown) => {
    if (typeof id !== 'string' || !/^[a-f0-9]{24}$/.test(id)) return { ok: false };
    service!.revoke(id); return { ok: true };
  });
  app.on('before-quit', () => { void service?.close(); });
  await applyBrowserAccess();
}
