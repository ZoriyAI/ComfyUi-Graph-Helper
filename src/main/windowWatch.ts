/**
 * A window that stops responding (a long loop in the page, a huge graph being drawn) gets one calm question:
 * wait, or reload the window. The graph is in the database, so a reload loses nothing that was committed.
 * Reloading a hung page needs its process ended first; that ending is expected, so the "window stopped" notice
 * for it is not shown (isExpectedRestart). main/index.ts watches the main window with it.
 */
import type { BrowserWindow, MessageBoxOptions, MessageBoxReturnValue, WebContents } from 'electron';
import type { Translator } from '../shared/i18n';
import { log } from './log';

/** The parts of a BrowserWindow the watch uses, so tests can pass a fake. */
type WatchedWindow = Pick<BrowserWindow, 'on' | 'isDestroyed'> & { webContents: Pick<WebContents, 'forcefullyCrashRenderer' | 'reload' | 'isDestroyed'> };

/** The dialog and the translator the question is asked with. */
export interface WindowWatchDeps {
  translate: () => Translator;
  showMessageBox: (window: WatchedWindow, options: MessageBoxOptions) => Promise<Pick<MessageBoxReturnValue, 'response'>>;
}

/** Pages ended on purpose; a WeakSet, so a closed window's page is not held in memory. */
const restarting = new WeakSet<object>();

/** True once for a page this module ended on purpose to reload it. */
export function isExpectedRestart(contents: object): boolean {
  if (!restarting.has(contents)) return false;
  restarting.delete(contents);
  return true;
}

/** Asks wait-or-reload when the window stops responding; one question at a time. */
export function watchWindowHang(window: WatchedWindow, deps: WindowWatchDeps): void {
  let asking = false;
  window.on('unresponsive', () => {
    log.warn('[App] Window not responding');
    if (asking || window.isDestroyed()) return;
    asking = true;
    const t = deps.translate();
    void deps.showMessageBox(window, {
      type: 'warning',
      title: t('diagnostics.unresponsiveTitle'),
      message: t('diagnostics.unresponsiveMessage'),
      buttons: [t('diagnostics.wait'), t('diagnostics.reload')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    }).then((choice) => {
      if (choice.response !== 1 || window.isDestroyed() || window.webContents.isDestroyed()) return;
      log.warn('[App] Reloading the window that did not respond');
      restarting.add(window.webContents);
      window.webContents.forcefullyCrashRenderer();
      window.webContents.reload();
    }).catch(() => undefined).finally(() => {
      asking = false;
    });
  });
  window.on('responsive', () => {
    log.info('[App] Window responding again');
  });
}
