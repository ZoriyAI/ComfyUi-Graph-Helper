import { app, shell, type IpcMain } from 'electron';
import * as os from 'os';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { getDatabase } from '../database';
import { readSettings } from '../settings/repository';
import { catalogTotals } from '../catalog/repository';
import { syncService } from '../mcp/sync';
import { mainLLMService } from '../llmService';
import { buildDiagnosticsReport } from '../diagnostics';
import { log, logsDir, readLogTail, redactForLog } from '../log';

/** At most `limit` events per `windowMs`; later ones are dropped (and counted) until the window moves on. */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const stamps: number[] = [];
  let dropped = 0;
  return {
    allow(): boolean {
      const time = now();
      while (stamps.length > 0 && time - stamps[0] >= windowMs) stamps.shift();
      if (stamps.length >= limit) {
        dropped += 1;
        return false;
      }
      stamps.push(time);
      return true;
    },
    /** Dropped since the last call. */
    takeDropped(): number {
      const value = dropped;
      dropped = 0;
      return value;
    },
  };
}

const TEXT_CAP = 2000;

function clip(value: unknown, cap = TEXT_CAP): string {
  if (typeof value !== 'string') return '';
  return value.length > cap ? `${value.slice(0, cap)}…` : value;
}

/** A renderer error report as main accepts it: known fields, clipped strings, redacted. */
export function rendererErrorLine(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  const kind = record.kind === 'unhandledrejection' || record.kind === 'boundary' ? record.kind : 'error';
  const message = clip(record.message, 500).trim();
  if (!message) return null;
  const source = clip(record.source, 300);
  const stack = clip(record.stack);
  return redactForLog([`[Renderer] ${kind}: ${message}`, source ? `at ${source}` : '', stack].filter(Boolean).join('\n'));
}

export function collectDiagnostics(): string {
  let settingsSource = 'unknown';
  let settings: Record<string, unknown> | null = null;
  let preferences: unknown = null;
  let sync: unknown = null;
  let catalog: Record<string, number | null> = { nodeClasses: null, detailedClasses: null, packs: null, models: null, enrichedModels: null };
  try {
    const db = getDatabase();
    const read = readSettings(db);
    settingsSource = read.source;
    settings = read.source === 'corrupt' ? null : { ...read.values };
    preferences = read.preferences ?? null;
    try {
      catalog = { ...catalogTotals(db) };
    } catch {
      // A database before the catalog tables: counts stay unknown.
    }
    try {
      const status = syncService.status(db);
      sync = { state: status.state, lastSyncAt: status.lastSyncAt ? new Date(status.lastSyncAt).toISOString() : null, lastError: status.lastError, mcpUrl: status.mcpUrl, tokenHeld: status.tokenHeld, auto: status.auto };
    } catch {
      sync = 'unavailable';
    }
  } catch {
    settingsSource = 'database unavailable';
  }
  return buildDiagnosticsReport({
    generatedAt: new Date().toISOString(),
    versions: {
      app: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      v8: process.versions.v8,
    },
    platform: { os: process.platform, release: os.release(), arch: process.arch },
    locale: app.getLocale(),
    paths: { userData: app.getPath('userData'), logs: logsDir(), packaged: String(app.isPackaged) },
    settingsSource,
    settings,
    preferences,
    sync,
    catalog,
    keyHeld: mainLLMService.sessionStatus().held,
    logTail: readLogTail(200),
    redact: (text) => mainLLMService.redact(redactForLog(text)),
  });
}

/** diagnostics:collect, diagnostics:open-logs and diagnostics:renderer-error. */
export function registerDiagnosticsIpc(ipcMain: IpcMain): void {
  const limiter = createRateLimiter(10, 60_000);
  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_COLLECT, () => collectDiagnostics());
  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_OPEN_LOGS, async () => {
    const dir = logsDir();
    if (!dir) return { ok: false as const, error: 'The log folder is not available.' };
    const failure = await shell.openPath(dir);
    return failure ? { ok: false as const, error: failure } : { ok: true as const };
  });
  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_RENDERER_ERROR, (_event, input: unknown) => {
    if (!limiter.allow()) return { logged: false };
    const dropped = limiter.takeDropped();
    if (dropped > 0) log.warn(`[Renderer] ${dropped} error reports were dropped (rate limit)`);
    const line = rendererErrorLine(input);
    if (!line) return { logged: false };
    log.error(line);
    return { logged: true };
  });
}
