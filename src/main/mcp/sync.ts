import type Database from 'better-sqlite3';
import type { SyncStatus } from '../../shared/contracts/knowledge';
import { toolPayload, type McpSession } from '../../shared/mcp/catalogSource';
import { inferBaseModel } from '../../shared/knowledge/baseModel';
import { inferModelKind } from '../../shared/knowledge/modelKind';
import { civitaiUrl, parseModelMetadata, plainText, triggerWordsOf, type ParsedModelMetadata } from '../../shared/knowledge/enrichment';
import { SYNC_INTERVAL_DEFAULT_MINUTES, SYNC_INTERVAL_MAX_MINUTES, SYNC_INTERVAL_MIN_MINUTES } from '../../shared/knowledge/schemas';
import { catalogTotals, writeModelEnrichment } from '../catalog/repository';
import { readPreferences, readSettings } from '../settings/repository';
import type { OAuthClientProvider } from '@modelcontextprotocol/client';
import { connectStreamableHttp, failure, MCP_SIGN_IN_AGAIN, openReadOnlySession, readCatalogWithSession, type McpSessionFactory } from './client';
import { mcpOAuth } from './oauth';
import { McpRefusedError } from './readOnly';
import { mcpToken, releaseMcpTokenIfOriginChanged } from './token';
import { redactSecrets } from '../../shared/config/draft';
import type { ServerIdentity } from './inventory';

/** Loader folders whose files carry a safetensors header worth reading. */
export const ENRICH_DIRECTORIES = [
  'checkpoints', 'loras', 'diffusion_models', 'unet', 'vae', 'controlnet', 'text_encoders', 'clip', 'upscale_models', 'embeddings',
] as const;
export const DEFAULT_ENRICH_LIMIT = 40;
const ALL_FAILED = 'Model metadata could not be read.';

export interface SyncDeps {
  readUrl: (db: Database.Database) => string;
  /** The in-memory bearer token. Passed to the session factory only; never stored, logged, or returned. */
  token: () => string | null;
  fetchImpl: typeof fetch;
  factory: McpSessionFactory;
  now: () => number;
  /** Fixed per-run limit (tests). When absent, Preferences ▸ Sync ▸ "Models per run" is read on each run. */
  enrichLimit?: number;
  /** Preferences ▸ Sync, read on each run: which folders to enrich and how many files per run. */
  readEnrichment: (db: Database.Database) => { scope: 'loaders' | 'all'; perRun: number };
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
    return { scope: sync.enrichmentScope, perRun: sync.enrichPerRun };
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

/**
 * Keeps the local catalog in step with the owner's ComfyUI through read-only MCP calls.
 * One run at a time; a second request while running joins the first.
 */
export class SyncService {
  private db: Database.Database | null = null;
  private running: Promise<SyncStatus> | null = null;
  private progress: SyncStatus['progress'] = null;
  private timer: ReturnType<typeof setInterval> | null = null;
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
      };
    }
    const state = readState(db);
    const lastSyncAt = state.last_sync_at ? Number(state.last_sync_at) : null;
    const lastError = state.last_error ? state.last_error : null;
    let phase: SyncStatus['state'] = 'never';
    if (this.running) phase = 'running';
    else if (lastError) phase = 'error';
    else if (lastSyncAt != null) phase = 'idle';
    const mcpUrl = this.deps.readUrl(db);
    return {
      state: phase,
      lastSyncAt: Number.isFinite(lastSyncAt) ? lastSyncAt : null,
      lastError,
      mcpUrl,
      tokenHeld: this.deps.token() != null,
      signedIn: this.deps.signedIn(mcpUrl),
      auto: autoOf(state),
      counts: catalogTotals(db),
      progress: this.running ? this.progress : null,
    };
  }

  /** Never throws: failures land in lastError with a fixed, secret-free message. */
  runSync(db: Database.Database, fetchImpl: typeof fetch = this.deps.fetchImpl, factory: McpSessionFactory = this.deps.factory): Promise<SyncStatus> {
    this.db = db;
    if (this.running) return this.running;
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
    this.schedule(db);
    return this.emit(db);
  }

  /** Reads the stored schedule and starts the timer when auto sync is on. Call once at startup. */
  start(db: Database.Database): SyncStatus {
    this.db = db;
    this.schedule(db);
    return this.status(db);
  }

  /** Pushes the current status to listeners (e.g. after a sign-in or sign-out). */
  notify(db: Database.Database | null = this.db): SyncStatus {
    return db ? this.emit(db) : this.status(null);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(db: Database.Database): void {
    this.stop();
    const auto = autoOf(readState(db));
    if (!auto.enabled) return;
    this.timer = setInterval(() => {
      void this.runSync(db);
    }, auto.intervalMinutes * 60_000);
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

  private async execute(db: Database.Database, fetchImpl: typeof fetch, factory: McpSessionFactory): Promise<void> {
    const url = this.deps.readUrl(db);
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
    const opened = await openReadOnlySession({ url, token, authProvider }, factory);
    if (!opened.ok) {
      writeState(db, { last_error: redactSecrets(opened.error) });
      return;
    }
    const session = opened.session;
    try {
      this.setProgress(db, 'catalog', 0, 0);
      const now = this.deps.now();
      const read = await readCatalogWithSession(db, session, fetchImpl, now);
      if ('ok' in read) {
        writeState(db, { last_error: redactSecrets(read.error) });
        return;
      }
      writeState(db, { server_identity: JSON.stringify(identityRecord(read.identity)) });
      const enrichError = await this.enrich(db, session, read.toolNames.has('model_metadata'));
      writeState(db, { last_sync_at: String(now), last_error: enrichError ?? '' });
    } catch (error) {
      const signInLost = (authProvider as { signInRequired?: boolean } | null)?.signInRequired === true;
      writeState(db, { last_error: signInLost ? MCP_SIGN_IN_AGAIN : failure(error).error });
    } finally {
      await session.close().catch(() => undefined);
    }
  }

  /** Returns an error only when every metadata read failed; partial failures still make progress. */
  private async enrich(db: Database.Database, session: McpSession, hasTool: boolean): Promise<string | null> {
    let enrichment: { scope: 'loaders' | 'all'; perRun: number } = { scope: 'loaders', perRun: DEFAULT_ENRICH_LIMIT };
    try {
      enrichment = this.deps.readEnrichment(db);
    } catch {
      // Defaults: loader folders, 40 per run.
    }
    const limit = this.deps.enrichLimit ?? enrichment.perRun;
    const candidates = (enrichment.scope === 'all'
      ? db.prepare('SELECT directory, name FROM model_catalog WHERE enriched_at IS NULL').all()
      : db.prepare(
        `SELECT directory, name FROM model_catalog WHERE enriched_at IS NULL AND directory IN (${ENRICH_DIRECTORIES.map(() => '?').join(', ')})`,
      ).all(...ENRICH_DIRECTORIES)) as Array<{ directory: string; name: string }>;
    const now = this.deps.now();
    const failures = readFailures(readState(db));
    // A file whose read failed waits out its backoff and does not take a slot from the others.
    const rows = candidates
      .filter((row) => {
        const failure = failures[`${row.directory}/${row.name}`];
        return !failure || now - failure.lastAt >= enrichBackoffMs(failure.attempts);
      })
      .sort((left, right) => enrichOrder(left.directory) - enrichOrder(right.directory)
        || left.directory.localeCompare(right.directory)
        || left.name.localeCompare(right.name))
      .slice(0, Math.max(0, limit));
    let attempted = 0;
    let failed = 0;
    for (const [index, row] of rows.entries()) {
      this.setProgress(db, 'enrich', index, rows.length);
      const key = `${row.directory}/${row.name}`;
      let parsed: ParsedModelMetadata | null = null;
      if (hasTool && isHeaderFile(row.name)) {
        attempted += 1;
        parsed = await readMetadata(session, row.directory, row.name);
        if (!parsed) {
          // Not enriched: the name-based guess stays and the read is retried after the backoff.
          failed += 1;
          const previous = failures[key];
          failures[key] = { attempts: (previous?.attempts ?? 0) + 1, lastAt: this.deps.now() };
          continue;
        }
      }
      delete failures[key];
      writeModelEnrichment(db, row.directory, row.name, enrichmentOf(row.directory, row.name, parsed, this.deps.now()));
    }
    writeState(db, { [ENRICH_FAILURES_KEY]: JSON.stringify(failures) });
    if (rows.length > 0) this.setProgress(db, 'enrich', rows.length, rows.length);
    return attempted > 0 && failed === attempted ? ALL_FAILED : null;
  }
}

function identityRecord(identity: ServerIdentity): Record<string, string | null> {
  return { installation_id: identity.installationId, comfyui_url: identity.comfyuiUrl };
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
