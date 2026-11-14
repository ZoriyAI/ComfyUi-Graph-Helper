import { app, shell, type IpcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { UpdateLink, UpdateStatus } from '../../shared/contracts/updates';
import { appVersion, PROJECT_URL, STABLE_APP_NAME, userAgent } from '../identity';
import { getDatabase } from '../database';
import { readPreferences } from '../settings/repository';
import { cappedFetch } from '../net/capped';
import { log } from '../log';
import { createUpdateChecker, installKind, RELEASE_ANSWER_MAX_BYTES, type UpdateChecker } from './updateCheck';

let checker: UpdateChecker | null = null;

function updateChecker(): UpdateChecker {
  checker ??= createUpdateChecker({
    projectUrl: PROJECT_URL,
    currentVersion: app.isPackaged ? app.getVersion() : appVersion(),
    enabled: () => {
      try {
        return readPreferences(getDatabase()).privacy.checkUpdates;
      } catch {
        return false;
      }
    },
    stateFile: path.join(app.getPath('userData'), 'update-check.json'),
    fetch: cappedFetch(RELEASE_ANSWER_MAX_BYTES),
    userAgent: userAgent('update check'),
    kind: installKind(process.execPath, process.env, (file) => fs.existsSync(file), STABLE_APP_NAME),
    log: (line) => log.info(line),
  });
  return checker;
}

/** Settings ▸ Privacy ▸ "Check for new versions" and the quiet notice it shows (src/renderer/components/shell/UpdateNotice.tsx). */
export function registerUpdateIpc(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.UPDATES_STATUS, (): Promise<UpdateStatus> => updateChecker().status());
  ipcMain.handle(IPC_CHANNELS.UPDATES_DISMISS, (_event, version: unknown) => {
    if (typeof version === 'string' && version.length <= 40) updateChecker().dismiss(version);
    return { ok: true as const };
  });
  // Opens only an address main found on the project's release page, never one the page passes in.
  ipcMain.handle(IPC_CHANNELS.UPDATES_OPEN, async (_event, link: unknown) => {
    if (link !== 'notes' && link !== 'download') return { ok: false as const };
    const url = updateChecker().linkFor(link as UpdateLink);
    if (!url) return { ok: false as const };
    await shell.openExternal(url);
    return { ok: true as const };
  });
}
