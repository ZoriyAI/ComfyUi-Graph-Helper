import type Database from 'better-sqlite3';
import type { SyncStatus } from '../../shared/contracts/knowledge';
import { toolPayload, type McpSession } from '../../shared/mcp/catalogSource';
import { inferBaseModel } from '../../shared/knowledge/baseModel';
import { inferModelKind } from '../../shared/knowledge/modelKind';
import { civitaiUrl, parseModelMetadata, plainText, triggerWordsOf, type ParsedModelMetadata } from '../../shared/knowledge/enrichment';
import { SYNC_INTERVAL_DEFAULT_MINUTES, SYNC_INTERVAL_MAX_MINUTES, SYNC_INTERVAL_MIN_MINUTES } from '../../shared/knowledge/schemas';
import { ENRICH_PAUSE_MS, ENRICH_PER_RUN } from '../../shared/config/preferences';
import { catalogTotals, writeModelEnrichment } from '../catalog/repository';
import { readPreferences, readSettings } from '../settings/repository';
import type { OAuthClientProvider } from '@modelcontextprotocol/client';
import {
  connectStreamableHttp, failure, isNetworkError, MCP_NEEDS_SIGN_IN, MCP_SIGN_IN_AGAIN, mcpUnreachableError, openReadOnlySession,
  readCatalogWithSession, type McpReadSuccess, type McpSessionFactory,
} from './client';

export { isNetworkError, mcpUnreachableError } from './client';
import { mcpOAuth } from './oauth';
import { McpRefusedError } from './readOnly';
import { mcpToken, releaseMcpTokenIfOriginChanged } from './token';
import { redactSecrets } from '../../shared/config/draft';
import type { ServerIdentity } from './inventory';

/** Loader folders whose files carry a safetensors header worth reading. */
export const ENRICH_DIRECTORIES = [
  'checkpoints', 'loras', 'diffusion_models', 'unet', 'vae', 'controlnet', 'text_encoders', 'clip', 'upscale_models', 'embeddings',
] as const;
/** Batch size when Preferences ▸ Sync cannot be read. A batch is pacing only; reading goes on until every file is read. */
export const DEFAULT_ENRICH_BATCH = ENRICH_PER_RUN.default;
/** Pause between metadata batches when Preferences ▸ Sync cannot be read. */
export const DEFAULT_ENRICH_PAUSE_MS = ENRICH_PAUSE_MS.default;
/** With auto sync on and a sign-in or token held, the first run starts this long after the app opens. */
export const STARTUP_DELAY_MS = 5_000;
/** Background metadata reading stops after this many failed reads in a row; backoff applies at the next run. */
export const MAX_CONSECUTIVE_FAILURES = 5;

const ALL_FAILED = 'Model metadata could not be read.';
/** Fixed English sentences stored in sync_state; the renderer translates them (shared/i18n ERROR_KEYS and patterns). */
export const METADATA_STOPPED = 'Model metadata reading stopped after 5 failed reads in a row; it continues at the next sync.';
export const NODE_PORTS_NO_URL = 'Node ports were not updated: the MCP server did not name a ComfyUI address.';
export const NODE_PORTS_NOT_ALLOWED = 'Node ports were not updated: the ComfyUI address the server named is not on this computer or saved in Settings.';
export const comfyNotRunningWarning = (host: string) => `ComfyUI is not running at ${host} — node ports were not updated; start ComfyUI and sync again.`;
export const sectionUnreadWarning = (section: string) => `MCP catalog section could not be read: ${section}.`;

export interface SyncDeps {
  readUrl: (db: Database.Database) => string;
  /** The in-memory bearer token. Passed to the session factory only; never stored, logged, or returned. */
  token: () => string | null;
  fetchImpl: typeof fetch;
  factory: McpSessionFactory;
  now: () => number;
  /** Fixed batch size (tests). When absent, Preferences ▸ Sync ▸ "Models per batch" is read on each run. */
  enrichLimit?: number;
  /** Fixed pause between batches (tests). When absent, Preferences ▸ Sync ▸ "Pause between batches" is read. */
  batchPauseMs?: number;
  /** Delay of the first run after start() (tests). */
  startupDelayMs?: number;
  /** Preferences ▸ Sync, read on each run: which folders to enrich, the batch size, and the pause between batches. */
  readEnrichment: (db: Database.Database) => EnrichmentSettings;
  /** Called with the MCP URL before each connect; drops a token held for another origin. */
  checkTokenOrigin: (url: string) => void;
  /**
   * The OAuth provider for the URL's origin when the person signed in through the browser, else null.
   * Used only when no manual token is held. Never opens the browser.
   */
  authProvider: (url: string) => Promise<OAuthClientProvider | null>;
  /** Whether a usable OAuth sign-in is held for the URL's origin (status only, no I/O). */
  signedIn: (url: string) => boolean;
}

type Listener = (status: SyncStatus) => void;

export interface EnrichmentSettings {
  scope: 'loaders' | 'all';
  perRun: number;
  pauseMs?: number;
}

const defaultDeps: SyncDeps = {
  readUrl: (db) => {
    const read = readSettings(db);
    return read.source === 'corrupt' ? '' : read.values.mcpUrl;
  },
  token: mcpToken,
  fetchImpl: (...args) => globalThis.fetch(...args),
  factory: connectStreamableHttp,
  now: () => Date.now(),
  readEnrichment: (db) => {
    const { sync } = readPreferences(db);
    return { scope: sync.enrichmentScope, perRun: sync.enrichPerRun, pauseMs: sync.enrichPauseMs };
  },
  checkTokenOrigin: releaseMcpTokenIfOriginChanged,
  authProvider: async (url) => (url ? (await mcpOAuth()?.backgroundProvider(url)) ?? null : null),
  signedIn: (url) => (url ? mcpOAuth()?.signedIn(url) ?? false : false),
};

/** sync_state key holding failed metadata reads: { "directory/name": { attempts, lastAt } }. */
export const ENRICH_FAILURES_KEY = 'enrich_failures';
const HOUR = 60 * 60_000;

/** How long a file waits after its n-th failed metadata read: 1 h, then 6 h, then 24 h. */
export function enrichBackoffMs(attempts: number): number {
  if (attempts <= 0) return 0;
  if (attempts === 1) return HOUR;
  if (attempts === 2) return 6 * HOUR;
  return 24 * HOUR;
}

type FailureMap = Record<string, { attempts: number; lastAt: number }>;

function readFailures(state: Record<string, string>): FailureMap {
  try {
    const value = JSON.parse(state[ENRICH_FAILURES_KEY] ?? '{}') as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result: FailureMap = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const item = entry as { attempts?: unknown; lastAt?: unknown } | null;
      if (item && typeof item.attempts === 'number' && typeof item.lastAt === 'number') result[key] = { attempts: item.attempts, lastAt: item.lastAt };
    }
    return result;
  } catch {
    return {};
  }
}

/** LoRAs first (they carry trigger words and base models people ask about), then checkpoints, then the rest. */
function enrichOrder(directory: string): number {
  if (directory === 'loras') return 0;
  if (directory === 'checkpoints') return 1;
  return 2;
}

function readState(db: Database.Database): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM sync_state').all() as Array<{ key: string; value: string }>;
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function writeState(db: Database.Database, values: Record<string, string>): void {
  const upsert = db.prepare('INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  db.transaction(() => {
    for (const [key, value] of Object.entries(values)) upsert.run(key, value);
  }).immediate();
}

function clampInterval(value: number): number {
  if (!Number.isFinite(value)) return SYNC_INTERVAL_DEFAULT_MINUTES;
  return Math.max(SYNC_INTERVAL_MIN_MINUTES, Math.min(SYNC_INTERVAL_MAX_MINUTES, Math.round(value)));
}

function autoOf(state: Record<string, string>): { enabled: boolean; intervalMinutes: number } {
  const stored = Number(state.auto_interval_minutes);
  return {
    enabled: state.auto_enabled === '1',
    intervalMinutes: state.auto_interval_minutes ? clampInterval(stored) : SYNC_INTERVAL_DEFAULT_MINUTES,
  };
}

function isHeaderFile(name: string): boolean {
  return /\.(safetensors|sft)$/i.test(name);
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

/** The fixed sentence for a failed run: unreachable (network) is told apart from "not read". */
export function classifySyncError(error: unknown, url: string): string {
  const base = failure(error).error;
  if (base === 'MCP server was not read.' && isNetworkError(error)) {
    const host = hostOf(url);
    if (host) return mcpUnreachableError(host);
  }
  return base;
}

/** Non-fatal problems of a successful listing, as fixed sentences. */
export function catalogWarnings(result: McpReadSuccess): string[] {
  const warnings = (result.failedSections ?? []).map(sectionUnreadWarning);
  if (result.objectInfo === 'none') {
    const host = hostOf(result.comfyUrl);
    if (result.nativeComfy === 'unreachable' && host) warnings.push(comfyNotRunningWarning(host));
    else if (result.nativeComfy === 'notAllowed') warnings.push(NODE_PORTS_NOT_ALLOWED);
    else if (!result.comfyUrl) warnings.push(NODE_PORTS_NO_URL);
  }
  return warnings;
}

/** How the last successful connection authenticated: the manual token, the browser sign-in, or nothing at all. */
function authModeOf(state: Record<string, string>): SyncStatus['authMode'] {
  const value = state.auth_mode;
  return value === 'token' || value === 'oauth' || value === 'anonymous' ? value : null;
}

function readWarnings(state: Record<string, string>): string[] {
  try {
    const value = JSON.parse(state.last_warnings ?? '[]') as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function numberOrNull(value: string | undefined): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** One run's metadata reading: the first batch inside the run, then batches in the background on the same session. */
interface EnrichRun {
  session: McpSession;
  hasTool: boolean;
  batch: number;
  pauseMs: number;
  scope: 'loaders' | 'all';
  consecutiveFailures: number;
  attempted: number;
  failed: number;
  cancelled: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  done: Promise<void>;
  resolve: () => void;
}

/**
 * Keeps the local catalog in step with the owner's ComfyUI through read-only MCP calls.
 * One run at a time; a second request while running joins the first. After a successful listing, model metadata is
 * read in batches in the background until every file in scope is read or waits out its backoff.
 */
export class SyncService {
  private db: Database.Database | null = null;
  private running: Promise<SyncStatus> | null = null;
  private progress: SyncStatus['progress'] = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextRunAt: number | null = null;
  private startupPending = false;
  private background: EnrichRun | null = null;
  private enrichmentPaused = false;
  private readonly listeners = new Set<Listener>();
  private readonly deps: SyncDeps;

  constructor(deps: Partial<SyncDeps> = {}) {
    this.deps = { ...defaultDeps, ...deps };
  }

  onStatus(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  status(db: Database.Database | null = this.db): SyncStatus {
    if (!db) {
      return {
        state: 'never', lastSyncAt: null, lastError: null, mcpUrl: '', tokenHeld: this.deps.token() != null, signedIn: false,
        auto: { enabled: false, intervalMinutes: SYNC_INTERVAL_DEFAULT_MINUTES },
        counts: { nodeClasses: 0, detailedClasses: 0, packs: 0, models: 0, enrichedModels: 0 },
        progress: null,
        nextRunAt: null,
        startupPending: false,
        lastRunAt: null,
        lastRunDurationMs: null,
        warnings: [],
        metadata: { done: 0, total: 0 },
        enrichmentPaused: false,
        authMode: null,
      };
    }
    const state = readState(db);
    const lastSyncAt = numberOrNull(state.last_sync_at);
    const lastError = state.last_error ? state.last_error : null;
    let phase: SyncStatus['state'] = 'never';
    if (this.running) phase = 'running';
    else if (lastError) phase = 'error';
    else if (lastSyncAt != null) phase = 'idle';
    const mcpUrl = this.deps.readUrl(db);
    const metadata = this.metadataCounts(db);
    let progress: SyncStatus['progress'] = null;
    if (this.running) progress = this.progress;
    else if (this.background) progress = { phase: 'enrichment', done: metadata.done, total: metadata.total };
    return {
      state: phase,
      lastSyncAt,
      lastError,
      mcpUrl,
      tokenHeld: this.deps.token() != null,
      signedIn: this.deps.signedIn(mcpUrl),
      auto: autoOf(state),
      counts: catalogTotals(db),
      progress,
      nextRunAt: this.nextRunAt,
      startupPending: this.startupPending && !this.running,
      lastRunAt: numberOrNull(state.last_run_at),
      lastRunDurationMs: numberOrNull(state.last_run_duration_ms),
      warnings: readWarnings(state),
      metadata,
      enrichmentPaused: this.enrichmentPaused,
      authMode: authModeOf(state),
    };
  }

  /**
   * Never throws: failures land in lastError with a fixed, secret-free message.
   * While metadata is still being read in the background the request is ignored and the current status returned.
   */
  runSync(db: Database.Database, fetchImpl: typeof fetch = this.deps.fetchImpl, factory: McpSessionFactory = this.deps.factory): Promise<SyncStatus> {
    this.db = db;
    if (this.running) return this.running;
    if (this.background) return Promise.resolve(this.status(db));
    this.startupPending = false;
    this.enrichmentPaused = false;
    this.progress = { phase: 'connect', done: 0, total: 0 };
    this.running = this.execute(db, fetchImpl, factory).finally(() => {
      this.running = null;
      this.progress = null;
    }).then(() => this.emit(db));
    this.emit(db);
    return this.running;
  }

  setAuto(db: Database.Database, enabled: boolean, intervalMinutes: number): SyncStatus {
    this.db = db;
    writeState(db, { auto_enabled: enabled ? '1' : '0', auto_interval_minutes: String(clampInterval(intervalMinutes)) });
    this.schedule(db, false);
    return this.emit(db);
  }

  /**
   * Reads the stored schedule and starts the timer when auto sync is on. Call once at startup.
   * With a sign-in or token held for the saved URL, the first run comes after STARTUP_DELAY_MS, unless the last
   * successful sync is younger than the interval (then it comes when the interval runs out).
   */
  start(db: Database.Database): SyncStatus {
    this.db = db;
    this.schedule(db, true);
    return this.emit(db);
  }

  /** Pushes the current status to listeners (e.g. after a sign-in or sign-out). */
  notify(db: Database.Database | null = this.db): SyncStatus {
    return db ? this.emit(db) : this.status(null);
  }

  /** Stops background metadata reading until the next run. */
  pauseEnrichment(db: Database.Database | null = this.db): SyncStatus {
    if (this.background) {
      this.cancelEnrichment();
      this.enrichmentPaused = true;
    }
    return db ? this.emit(db) : this.status(null);
  }

  /** Resolves when the background metadata reading of the current run has ended (at once when none runs). */
  whenEnrichmentDone(): Promise<void> {
    return this.background?.done ?? Promise.resolve();
  }

  /** Clears the schedule and cancels background reading. Leaves no timer behind (app quit, tests). */
  stop(): void {
    this.clearSchedule();
    this.cancelEnrichment();
  }

  private clearSchedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.nextRunAt = null;
    this.startupPending = false;
  }

  private cancelEnrichment(): void {
    const run = this.background;
    if (!run) return;
    run.cancelled = true;
    if (run.timer) clearTimeout(run.timer);
    run.timer = null;
    this.background = null;
    void run.session.close().catch(() => undefined);
    run.resolve();
  }

  /**
   * Whether a startup run can reach the server: credentials are held, the server accepted an anonymous connection
   * before, or it has not yet said that it wants a sign-in. Whether credentials are needed is the server's call;
   * one that asked for them is not retried until a token or a browser sign-in appears.
   */
  private canConnect(db: Database.Database): boolean {
    try {
      const url = this.deps.readUrl(db);
      if (!url) return false;
      if (this.deps.token() != null || this.deps.signedIn(url)) return true;
      const state = readState(db);
      if (state.auth_mode === 'anonymous') return true;
      return state.last_error !== MCP_NEEDS_SIGN_IN && state.last_error !== MCP_SIGN_IN_AGAIN;
    } catch {
      return false;
    }
  }

  private schedule(db: Database.Database, startup: boolean): void {
    this.clearSchedule();
    const state = readState(db);
    const auto = autoOf(state);
    if (!auto.enabled) return;
    const interval = auto.intervalMinutes * 60_000;
    const now = this.deps.now();
    let delay = interval;
    if (startup && this.canConnect(db)) {
      const lastSyncAt = numberOrNull(state.last_sync_at);
      if (lastSyncAt == null || now - lastSyncAt >= interval) {
        delay = this.deps.startupDelayMs ?? STARTUP_DELAY_MS;
        this.startupPending = true;
      } else {
        delay = Math.max(this.deps.startupDelayMs ?? STARTUP_DELAY_MS, lastSyncAt + interval - now);
      }
    }
    this.arm(db, delay);
  }

  private arm(db: Database.Database, delay: number): void {
    this.nextRunAt = this.deps.now() + delay;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.startupPending = false;
      const auto = autoOf(readStateSafe(db));
      if (auto.enabled) this.arm(db, auto.intervalMinutes * 60_000);
      else this.nextRunAt = null;
      void this.runSync(db);
    }, delay);
    // A pending sync must not keep the app (or a test run) alive.
    this.timer.unref?.();
  }

  private emit(db: Database.Database): SyncStatus {
    const status = this.status(db);
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch {
        // A closed window must not stop the sync.
      }
    }
    return status;
  }

  private setProgress(db: Database.Database, phase: string, done: number, total: number): void {
    this.progress = { phase, done, total };
    this.emit(db);
  }

  private enrichmentSettings(db: Database.Database): EnrichmentSettings {
    try {
      return this.deps.readEnrichment(db);
    } catch {
      return { scope: 'loaders', perRun: DEFAULT_ENRICH_BATCH, pauseMs: DEFAULT_ENRICH_PAUSE_MS };
    }
  }

  private scopeRows(db: Database.Database, scope: 'loaders' | 'all', onlyPending: boolean): Array<{ directory: string; name: string }> {
    const pending = onlyPending ? ' AND enriched_at IS NULL' : '';
    return (scope === 'all'
      ? db.prepare(`SELECT directory, name FROM model_catalog WHERE 1 = 1${pending}`).all()
      : db.prepare(
        `SELECT directory, name FROM model_catalog WHERE directory IN (${ENRICH_DIRECTORIES.map(() => '?').join(', ')})${pending}`,
      ).all(...ENRICH_DIRECTORIES)) as Array<{ directory: string; name: string }>;
  }

  /** Files in the enrichment scope, and how many carry metadata. */
  private metadataCounts(db: Database.Database): { done: number; total: number } {
    const { scope } = this.enrichmentSettings(db);
    const where = scope === 'all' ? '' : `WHERE directory IN (${ENRICH_DIRECTORIES.map(() => '?').join(', ')})`;
    const row = db.prepare(`SELECT COUNT(*) AS total, COUNT(enriched_at) AS done FROM model_catalog ${where}`)
      .get(...(scope === 'all' ? [] : ENRICH_DIRECTORIES)) as { total: number; done: number };
    return { done: row.done, total: row.total };
  }

  private async execute(db: Database.Database, fetchImpl: typeof fetch, factory: McpSessionFactory): Promise<void> {
    const startedAt = this.deps.now();
    const url = this.deps.readUrl(db);
    const finish = (values: Record<string, string>) => writeState(db, {
      ...values,
      last_run_at: String(startedAt),
      last_run_duration_ms: String(Math.max(0, this.deps.now() - startedAt)),
    });
    this.deps.checkTokenOrigin(url);
    const token = this.deps.token();
    let authProvider: OAuthClientProvider | null = null;
    if (!token) {
      try {
        authProvider = await this.deps.authProvider(url);
      } catch {
        authProvider = null;
      }
    }
    // Keep the connect error so an unreachable server is told apart from one that answered badly.
    let connectError: unknown = null;
    const watched: McpSessionFactory = async (target, bearer, provider) => {
      try {
        return await factory(target, bearer, provider);
      } catch (error) {
        connectError = error;
        throw error;
      }
    };
    const opened = await openReadOnlySession({ url, token, authProvider }, watched);
    if (!opened.ok) {
      const error = opened.error === 'MCP server was not read.' && connectError ? classifySyncError(connectError, url) : opened.error;
      finish({ last_error: redactSecrets(error) });
      return;
    }
    const session = opened.session;
    // Remembered so the indicator knows whether this server needs any credentials at all.
    writeState(db, { auth_mode: token ? 'token' : this.deps.signedIn(url) ? 'oauth' : 'anonymous' });
    let handedOver = false;
    try {
      this.setProgress(db, 'catalog', 0, 0);
      const now = this.deps.now();
      const read = await readCatalogWithSession(db, session, fetchImpl, now);
      if ('ok' in read) {
        finish({ last_error: redactSecrets(read.error) });
        return;
      }
      writeState(db, { server_identity: JSON.stringify(identityRecord(read.identity)) });
      const warnings = catalogWarnings(read.result);
      const settings = this.enrichmentSettings(db);
      let resolve: () => void = () => undefined;
      const done = new Promise<void>((settle) => {
        resolve = settle;
      });
      const run: EnrichRun = {
        session,
        hasTool: read.toolNames.has('model_metadata'),
        batch: Math.max(1, Math.round(this.deps.enrichLimit ?? settings.perRun)),
        pauseMs: Math.max(0, this.deps.batchPauseMs ?? settings.pauseMs ?? DEFAULT_ENRICH_PAUSE_MS),
        scope: settings.scope,
        consecutiveFailures: 0,
        attempted: 0,
        failed: 0,
        cancelled: false,
        timer: null,
        done,
        resolve,
      };
      const first = await this.enrichBatch(db, run, 'enrich');
      const enrichError = run.attempted > 0 && run.failed === run.attempted ? ALL_FAILED : null;
      if (first.stopped && !enrichError) warnings.push(METADATA_STOPPED);
      finish({ last_sync_at: String(now), last_error: enrichError ?? '', last_warnings: JSON.stringify(warnings) });
      if (!enrichError && !first.stopped && first.remaining > 0) {
        handedOver = true;
        this.startBackground(db, run);
      } else {
        resolve();
      }
    } catch (error) {
      const signInLost = (authProvider as { signInRequired?: boolean } | null)?.signInRequired === true;
      finish({ last_error: signInLost ? MCP_SIGN_IN_AGAIN : classifySyncError(error, url) });
    } finally {
      if (!handedOver) await session.close().catch(() => undefined);
    }
  }

  private startBackground(db: Database.Database, run: EnrichRun): void {
    this.background = run;
    const step = async () => {
      run.timer = null;
      if (run.cancelled) return;
      try {
        const result = await this.enrichBatch(db, run, 'enrichment');
        if (run.cancelled) return;
        if (result.stopped) {
          const warnings = readWarnings(readState(db));
          if (!warnings.includes(METADATA_STOPPED)) writeState(db, { last_warnings: JSON.stringify([...warnings, METADATA_STOPPED]) });
        }
        if (result.stopped || result.remaining === 0) {
          this.finishBackground(db, run);
          return;
        }
        run.timer = setTimeout(() => void step(), run.pauseMs);
        run.timer.unref?.();
      } catch (error) {
        if (run.cancelled) return;
        try {
          writeState(db, { last_error: error instanceof McpRefusedError ? redactSecrets(error.message) : classifySyncError(error, this.deps.readUrl(db)) });
        } catch {
          // The database went away (app quit); nothing to record.
        }
        this.finishBackground(db, run);
      }
    };
    run.timer = setTimeout(() => void step(), run.pauseMs);
    run.timer.unref?.();
    this.emit(db);
  }

  private finishBackground(db: Database.Database, run: EnrichRun): void {
    if (this.background !== run) return;
    this.background = null;
    void run.session.close().catch(() => undefined);
    run.resolve();
    try {
      this.emit(db);
    } catch {
      // The database went away (app quit).
    }
  }

  /**
   * Reads one batch of metadata. LoRAs first, then checkpoints, then the rest; alphabetical within a folder.
   * A failed read waits out its backoff and does not take a slot from the others. `stopped` after
   * MAX_CONSECUTIVE_FAILURES failed reads in a row; `remaining` counts files still due after this batch.
   */
  private async enrichBatch(db: Database.Database, run: EnrichRun, phase: 'enrich' | 'enrichment'): Promise<{ remaining: number; stopped: boolean }> {
    const now = this.deps.now();
    const failures = readFailures(readState(db));
    const due = this.scopeRows(db, run.scope, true)
      .filter((row) => {
        const failure = failures[`${row.directory}/${row.name}`];
        return !failure || now - failure.lastAt >= enrichBackoffMs(failure.attempts);
      })
      .sort((left, right) => enrichOrder(left.directory) - enrichOrder(right.directory)
        || left.directory.localeCompare(right.directory)
        || left.name.localeCompare(right.name));
    const rows = due.slice(0, run.batch);
    let handled = 0;
    let stopped = false;
    try {
      for (const [index, row] of rows.entries()) {
        if (run.cancelled) break;
        if (phase === 'enrich') this.setProgress(db, 'enrich', index, rows.length);
        else this.emit(db);
        const key = `${row.directory}/${row.name}`;
        let parsed: ParsedModelMetadata | null = null;
        if (run.hasTool && isHeaderFile(row.name)) {
          parsed = await readMetadata(run.session, row.directory, row.name);
          if (run.cancelled) break;
          run.attempted += 1;
          if (!parsed) {
            // Not enriched: the name-based guess stays and the read is retried after the backoff.
            run.failed += 1;
            run.consecutiveFailures += 1;
            handled += 1;
            const previous = failures[key];
            failures[key] = { attempts: (previous?.attempts ?? 0) + 1, lastAt: this.deps.now() };
            if (run.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
              stopped = true;
              break;
            }
            continue;
          }
          run.consecutiveFailures = 0;
        }
        delete failures[key];
        writeModelEnrichment(db, row.directory, row.name, enrichmentOf(row.directory, row.name, parsed, this.deps.now()));
        handled += 1;
      }
    } finally {
      writeState(db, { [ENRICH_FAILURES_KEY]: JSON.stringify(failures) });
    }
    if (phase === 'enrich' && rows.length > 0) this.setProgress(db, 'enrich', handled, rows.length);
    return { remaining: due.length - handled, stopped };
  }
}

function readStateSafe(db: Database.Database): Record<string, string> {
  try {
    return readState(db);
  } catch {
    return {};
  }
}

function identityRecord(identity: ServerIdentity): Record<string, string | null> {
  return { installation_id: identity.installationId, comfyui_url: identity.comfyuiUrl };
}

/**
 * The ComfyUI address the MCP server named at the last successful sync, with whatever port it uses, or null.
 * Main refuses it in the agent's page reader; no port is assumed anywhere.
 */
export function reportedComfyUrl(db: Database.Database): string | null {
  try {
    const raw = readState(db).server_identity;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const url = (parsed as Record<string, unknown>).comfyui_url;
    return typeof url === 'string' && url !== '' ? url : null;
  } catch {
    return null;
  }
}

async function readMetadata(session: McpSession, directory: string, name: string): Promise<ParsedModelMetadata | null> {
  try {
    const result = await session.callTool('model_metadata', { action: 'read', category: directory, name });
    return parseModelMetadata(toolPayload(result));
  } catch (error) {
    if (error instanceof McpRefusedError) throw error;
    return null;
  }
}

function enrichmentOf(directory: string, name: string, parsed: ParsedModelMetadata | null, now: number) {
  const guess = inferBaseModel({ metadata: parsed?.metadata, sidecarBaseModel: parsed?.sidecar?.baseModel, filename: name });
  const description = parsed?.sidecar?.description || plainText(parsed?.metadata['modelspec.description'] ?? '');
  return {
    kind: inferModelKind(directory, parsed?.metadata),
    baseModel: guess.family,
    baseModelEvidence: guess.evidence,
    triggerWords: parsed ? triggerWordsOf(parsed) : [],
    description,
    sourceUrl: civitaiUrl(parsed?.sidecar ?? null),
    metadata: parsed?.metadata ?? {},
    enrichedAt: now,
  };
}

/** The app-wide instance. knowledgeIpc starts it and forwards its status to windows. */
export const syncService = new SyncService();
