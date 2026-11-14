import { log } from './log';

/**
 * Process-level error handling for main. An uncaught exception or unhandled rejection is logged and, at most
 * once a minute, the person is told in a non-blocking dialog; the app keeps running. A renderer that dies is
 * logged and the person can reload it.
 */

export const NOTICE_INTERVAL_MS = 60_000;

/** Returns true when a notice may be shown now (at most one per interval). */
export function createNoticeGate(intervalMs = NOTICE_INTERVAL_MS, now: () => number = Date.now): () => boolean {
  let last = -Infinity;
  return () => {
    const time = now();
    if (time - last < intervalMs) return false;
    last = time;
    return true;
  };
}

export interface CrashHandlerDeps {
  /** Shows the non-fatal notice; must not block. */
  notify: (kind: 'exception' | 'rejection', error: unknown) => void;
  gate?: () => boolean;
  target?: Pick<NodeJS.Process, 'on'>;
}

function describe(error: unknown): unknown {
  if (error instanceof Error) return error;
  try {
    return typeof error === 'string' ? error : JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function installCrashHandlers(deps: CrashHandlerDeps): void {
  const gate = deps.gate ?? createNoticeGate();
  const target = deps.target ?? process;
  const handle = (kind: 'exception' | 'rejection', error: unknown) => {
    log.error(kind === 'exception' ? '[Crash] Uncaught exception:' : '[Crash] Unhandled rejection:', describe(error));
    if (!gate()) return;
    try {
      deps.notify(kind, error);
    } catch (notifyError) {
      log.error('[Crash] Notice could not be shown:', describe(notifyError));
    }
  };
  target.on('uncaughtException', (error: Error) => handle('exception', error));
  target.on('unhandledRejection', (reason: unknown) => handle('rejection', reason));
}
