/**
 * The sender check of every IPC handler: a request is served only when it comes from the app's own page.
 * index.ts sets the trusted URL at start (setTrustedAppUrl, appEntryUrl); ipc.ts wraps ipcMain in guardedIpcMain,
 * and the register functions in ipc/* use guardedHandle. Why: a frame that navigated elsewhere, an iframe, or any
 * other web contents must not reach the database, the keys or the files through the preload bridge.
 */
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { pathToFileURL } from 'url';
import { log } from '../log';

/** The fixed error a refused sender gets; the handler never runs. */
export const UNTRUSTED_SENDER_ERROR = 'The request did not come from the app window.';

let trusted: URL | null = null;

/** The URL the main window loads: the Vite dev server in development, the built index.html otherwise. */
export function appEntryUrl(options: { development: boolean; devServerUrl?: string | null; rendererIndexPath: string; bundleEntry?: string | null }): string {
  if (options.development) return options.devServerUrl || 'http://localhost:5173/';
  // The built app is served from its own scheme (appProtocol.ts) when main registered one.
  if (options.bundleEntry) return options.bundleEntry;
  return pathToFileURL(options.rendererIndexPath).href;
}

/** Set once at startup, before any window loads. Until it is set every request is refused. */
export function setTrustedAppUrl(url: string | null): void {
  try {
    trusted = url ? new URL(url) : null;
  } catch {
    trusted = null;
  }
}

/** file: and the app scheme must be the same document (hash and query aside); http(s) must be the same origin. */
export function isTrustedAppUrl(value: string | null | undefined): boolean {
  if (!trusted || !value) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (trusted.protocol === 'file:') return url.protocol === 'file:' && url.host === trusted.host && url.pathname === trusted.pathname;
  if (trusted.protocol === 'http:' || trusted.protocol === 'https:') return url.origin === trusted.origin;
  // The app's own scheme: Node gives such URLs the origin "null", so the scheme, host and page are compared instead.
  return url.protocol === trusted.protocol && url.host === trusted.host && url.pathname === trusted.pathname;
}

type Handler = (event: IpcMainInvokeEvent, ...args: any[]) => unknown;

/** Whether the frame that sent a request shows the app's page. Reading a destroyed frame throws: refused. */
export function isTrustedSender(event: Pick<IpcMainInvokeEvent, 'senderFrame'>): boolean {
  let url: string | undefined;
  try {
    url = event.senderFrame?.url;
  } catch {
    return false;
  }
  return isTrustedAppUrl(url);
}

/** The sender's URL for the log, cut to 200 characters. */
function senderUrl(event: Pick<IpcMainInvokeEvent, 'senderFrame'>): string {
  try {
    return String(event.senderFrame?.url ?? 'unknown').slice(0, 200);
  } catch {
    return 'unknown';
  }
}

/** Wraps one handler with the sender check. A refusal is logged with the channel and the sender's URL. */
export function guardHandler<T extends Handler>(handler: T, channel = 'unknown'): Handler {
  return (event, ...args) => {
    if (!isTrustedSender(event)) {
      log.warn(`[IPC] Refused ${channel}: sender ${senderUrl(event)} is not the app window`);
      throw new Error(UNTRUSTED_SENDER_ERROR);
    }
    return handler(event, ...args);
  };
}

/** ipcMain.handle with the sender check. */
export function guardedHandle(ipc: Pick<IpcMain, 'handle'>, channel: string, handler: Handler): void {
  ipc.handle(channel, guardHandler(handler, channel));
}

/** Listener registration on the guarded IpcMain: refused, because `on`/`once` would carry no sender check. */
export const UNGUARDED_LISTENER_ERROR = 'Register IPC with handle(): on() and once() have no sender check.';

/**
 * An IpcMain whose `handle` checks the sender; `on`, `once` and `handleOnce` are refused (they would bypass the
 * check); every other member is the real one. Register functions that take an IpcMain can be given this without
 * changing.
 */
export function guardedIpcMain(ipc: IpcMain): IpcMain {
  return new Proxy(ipc, {
    get(target, property, receiver) {
      if (property === 'handle') return (channel: string, handler: Handler) => guardedHandle(target, channel, handler);
      if (property === 'on' || property === 'once' || property === 'addListener' || property === 'prependListener' || property === 'handleOnce') {
        return () => {
          throw new Error(UNGUARDED_LISTENER_ERROR);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
