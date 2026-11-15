/**
 * IPC of Help > Diagnostics and the model conversation log: the copyable diagnostics report, the log folders,
 * renderer error reports, and listing, saving and clearing recorded assistant turns.
 * Registered from setupIPC in ipc.ts. Everything that leaves the app here is scrubbed first (keys, addresses,
 * the home folder), because people paste these reports into public issues.
 */
import { app, dialog, shell, type IpcMain } from 'electron';
import { systemLanguage } from '../systemLanguage';
import * as path from 'path';
import * as os from 'os';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { APP_ID } from '../identity';
import { getDatabase } from '../database';
import { readSettings } from '../settings/repository';
import { catalogTotals } from '../catalog/repository';
import { syncService } from '../mcp/sync';
import { mainLLMService } from '../llmService';
import { addressScrubber, buildDiagnosticsReport, homeRedactor } from '../diagnostics';
import { log, logsDir, readLogTail, redactForLog } from '../log';
import { readPreferences } from '../settings/repository';
import {
  clearTurnTraces, exportTurnTraces, listTurnTraces, readTurnTrace, traceDir, traceUsage, turnReport,
} from '../trace/modelTrace';
import { languageOf, type AppLanguage } from '../../shared/i18n';
import type { ModelLogExportRequest, ModelLogExportResult, ModelLogList } from '../../shared/contracts/modelLog';

/**
 * What a saved conversation log must not carry: the app's profile folder becomes "[app profile]", then the
 * person's home folder becomes `~` (the folder name is usually their own name).
 */
export function savedLogScrub(userData: string, home: string): (text: string) => string {
  const toHome = homeRedactor(home);
  const profile = userData.replace(/\/+$/, '');
  const escapedJson = JSON.stringify(profile).slice(1, -1);
  const addresses = addressScrubber(personAddresses());
  return (text) => {
    let out = addresses(text);
    if (profile.length > 1) {
      out = out.split(profile).join('[app profile]');
      if (escapedJson !== profile) out = out.split(escapedJson).join('[app profile]');
    }
    return toHome(out);
  };
}

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

/** Longest renderer stack kept in the log, so a flood of huge reports cannot fill the disk. */
const TEXT_CAP = 2000;

/** A string cut to `cap` characters; anything that is not a string is empty. */
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

/**
 * Every server address the person set up: the MCP server (saved, and as the sync status reports it), the saved
 * ComfyUI address, the model server of each provider. The ComfyUI address an MCP server reported is not added
 * (the status field is read in the type but never pushed). Reports meant for someone else name these only by
 * where they are (diagnostics.ts addressScrubber).
 */
export function personAddresses(): string[] {
  const found: string[] = [];
  try {
    const db = getDatabase();
    const read = readSettings(db);
    if (read.source !== 'corrupt') found.push(read.values.mcpUrl, read.values.comfyOrigin, read.values.baseURL);
    const providers = (read.preferences as { providers?: Record<string, { baseURL?: unknown }> } | undefined)?.providers ?? {};
    for (const entry of Object.values(providers)) if (typeof entry?.baseURL === 'string') found.push(entry.baseURL);
    try {
      const reported = syncService.status(db) as { mcpUrl?: unknown; comfyuiUrl?: unknown };
      if (typeof reported.mcpUrl === 'string') found.push(reported.mcpUrl);
    } catch {
      // No sync status: the saved addresses are enough.
    }
  } catch {
    // Without the database there is nothing the person set up to hide.
  }
  return found.filter((value) => typeof value === 'string' && value.trim() !== '');
}

/**
 * The diagnostics report as text. Each part that cannot be read (no database, an old schema, no sync) is reported
 * as unknown rather than failing the whole report, since the report is most needed when something is broken.
 */
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
    // Whether any cloud provider has a key held (never which key).
    keyHeld: Object.values(mainLLMService.keySources()).some((source) => source !== 'none'),
    logTail: readLogTail(200),
    redact: (text) => mainLLMService.redact(redactForLog(text)),
    addresses: personAddresses(),
  });
}

/** Whether Preferences > Privacy keeps the model log; on when the preferences cannot be read. */
function modelLogEnabled(): boolean {
  try {
    return readPreferences(getDatabase()).privacy.modelLog;
  } catch {
    return true;
  }
}

/** Which recorded turns a save request means. Ids are checked again where the files are read. */
export function turnsToExport(request: unknown, now = Date.now()): string[] {
  const turns = listTurnTraces(500);
  if (request && typeof request === 'object' && Array.isArray((request as { ids?: unknown }).ids)) {
    const wanted = new Set(((request as { ids: unknown[] }).ids).filter((id): id is string => typeof id === 'string').slice(0, 500));
    return turns.filter((turn) => wanted.has(turn.id)).map((turn) => turn.id).reverse();
  }
  const scope = (request as { scope?: unknown } | null)?.scope;
  if (scope === 'last') return turns.slice(0, 1).map((turn) => turn.id);
  if (scope === 'today') {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    return turns.filter((turn) => turn.startedAt >= dayStart.getTime()).map((turn) => turn.id).reverse();
  }
  return turns.map((turn) => turn.id).reverse();
}

/** The interface language, so the copied report reads like the rest of the window. */
function reportLanguage(): AppLanguage {
  try {
    return languageOf(readSettings(getDatabase()));
  } catch {
    return systemLanguage();
  }
}

/** diagnostics:collect, diagnostics:open-logs, diagnostics:renderer-error and the model conversation log. */
export function registerDiagnosticsIpc(ipcMain: IpcMain): void {
  const limiter = createRateLimiter(10, 60_000);
  // The file the person saved last, so "Show the file" needs no path from the window.
  let lastExport: string | null = null;

  ipcMain.handle(IPC_CHANNELS.TRACE_LIST, (): ModelLogList => {
    const usage = traceUsage();
    return { enabled: modelLogEnabled(), turns: listTurnTraces(100), files: usage.files, bytes: usage.bytes, folder: traceDir() };
  });
  ipcMain.handle(IPC_CHANNELS.TRACE_REPORT, (_event, id: unknown) => {
    const events = typeof id === 'string' ? readTurnTrace(id) : null;
    if (!events) return { ok: false as const, error: 'That turn is not in the log.' };
    return { ok: true as const, text: turnReport(events, reportLanguage()) };
  });
  // One file a person can send: app facts and the tail of the main log first, then the chosen turns as recorded.
  ipcMain.handle(IPC_CHANNELS.TRACE_EXPORT, async (_event, request: ModelLogExportRequest): Promise<ModelLogExportResult> => {
    const ids = turnsToExport(request);
    if (ids.length === 0) return { ok: false, error: 'The log has no turns to save.' };
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const chosen = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath('documents'), `${APP_ID}-model-log-${stamp}.jsonl`),
      filters: [{ name: 'JSON Lines', extensions: ['jsonl'] }],
      // GTK on Linux replaces an existing file without asking unless told to ask.
      properties: ['showOverwriteConfirmation'],
    });
    if (chosen.canceled || !chosen.filePath) return { ok: false, canceled: true };
    try {
      const written = exportTurnTraces(ids, chosen.filePath, { app: app.getVersion(), diagnostics: collectDiagnostics() }, savedLogScrub(app.getPath('userData'), os.homedir()));
      log.info(`[ModelLog] Saved ${written.turns} turns, ${written.bytes} bytes`);
      lastExport = chosen.filePath;
      return { ok: true, path: chosen.filePath, bytes: written.bytes, turns: written.turns };
    } catch {
      return { ok: false, error: 'The log file could not be written.' };
    }
  });
  ipcMain.handle(IPC_CHANNELS.TRACE_REVEAL_EXPORT, () => {
    if (!lastExport) return { ok: false };
    shell.showItemInFolder(lastExport);
    return { ok: true };
  });
  ipcMain.handle(IPC_CHANNELS.TRACE_CLEAR, () => ({ removed: clearTurnTraces() }));
  ipcMain.handle(IPC_CHANNELS.TRACE_OPEN_FOLDER, async () => {
    const dir = traceDir() ?? logsDir();
    if (!dir) return { ok: false as const, error: 'The log folder is not available.' };
    const failure = await shell.openPath(dir);
    // Before the first turn the model folder does not exist yet: the parent log folder opens instead.
    if (failure && logsDir()) {
      const parent = await shell.openPath(logsDir() as string);
      return parent ? { ok: false as const, error: parent } : { ok: true as const };
    }
    return failure ? { ok: false as const, error: failure } : { ok: true as const };
  });

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
