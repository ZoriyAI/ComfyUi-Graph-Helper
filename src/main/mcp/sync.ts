/**
 * The catalog sync: reads what the person's ComfyUI has (through the MCP server, ComfyUI's own read routes, or
 * both), then reads model metadata, pack files and, when allowed, internet lookups in the background. Owns the
 * schedule, the status the window shows, and the run bookkeeping in sync_state.
 * Used by ipc/knowledgeIpc.ts (starts it, forwards its status) and knowledge/handlers.ts (sync:* channels),
 * ipc.ts (address changes, "Read through MCP"), index.ts (a status listener), ipc/diagnosticsIpc.ts (status),
 * ipc/openIpc.ts and settings/connectionSuggestions.ts (sync_state).
 * Why so careful: a sync can take minutes and the address can change in between; each run carries a ticket, and
 * a run that is no longer current writes nothing. A file whose metadata cannot be read never stops the reading:
 * it is recorded with its reason (mcp/unreadable.ts) for the "Could not be read" report, and a lost connection is
 * opened again (bounded) instead of being blamed on the files asked after it.
 */
import type Database from 'better-sqlite3';
import type { ImportModelHeaderRequest, ImportModelHeaderResult, McpReadOutcome, RetryItemResult, SyncStatus } from '../../shared/contracts/knowledge';
import { toolPayload, type McpSession } from '../../shared/mcp/catalogSource';
import { inferBaseModel } from '../../shared/knowledge/baseModel';
import { inferModelKind } from '../../shared/knowledge/modelKind';
import { civitaiUrl, parseModelMetadata, plainText, triggerWordsOf, type ParsedModelMetadata, type SidecarFacts } from '../../shared/knowledge/enrichment';
import { EMPTY_NOTES, parseSidecarFile, type ParsedSidecar } from '../../shared/knowledge/sidecar';
import { SYNC_INTERVAL_DEFAULT_MINUTES, SYNC_INTERVAL_MAX_MINUTES, SYNC_INTERVAL_MIN_MINUTES } from '../../shared/knowledge/schemas';
import { ENRICH_PAUSE_MS, ENRICH_PER_RUN } from '../../shared/config/preferences';
import { bumpCatalogRevision, catalogTotals, packInfoSig, packsDueForInfo, writeModelEnrichment, writeModelNotes, writePackInfo } from '../catalog/repository';
import { packInfoOf, parsePyproject, summarizeReadme, type PackInfo } from '../../shared/knowledge/packInfo';
import { readPreferences, readSettings } from '../settings/repository';
import type { McpAuthMode } from '../../shared/config/schema';
import type { OAuthClientProvider } from '@modelcontextprotocol/client';
import {
  connectStreamableHttp, failure, isNetworkError, MCP_NEEDS_SIGN_IN, MCP_SIGN_IN_AGAIN, mcpUnreachableError, openReadOnlySession,
  readCatalogWithSession, type McpReadSuccess, type McpSessionFactory,
} from './client';

export { isNetworkError, mcpUnreachableError } from './client';
import { explainConnectFailure, explainFailureNow } from './connectError';
import { mcpOAuth } from './oauth';
import { McpRefusedError } from './readOnly';
import { packFilePath, PYPROJECT_MAX_BYTES, readPackFile, README_HEAD_BYTES, readSideFile, SIDECAR_MAX_BYTES, sideFilePath } from './sideFiles';
import { mcpToken, releaseMcpTokenIfOriginChanged } from './token';
import { redactSecrets } from '../../shared/config/draft';
import { isLoopbackHost } from '../../shared/mcp/loopback';
import { readCustomNodeRoots, type ServerIdentity } from './inventory';
import { COMFY_PREVIEW_FILE, ComfyMetadataReadError, comfyMetadataSession, readComfyDirect, readComfyPreview } from '../comfy/direct';
import { MCP_UNKNOWN_SERVER } from './client';
import { dueLookups, writeWebOutcome } from '../knowledge/modelWeb';
import { appWebClient, SYNC_LOOKUP_PAUSE_MS, SYNC_LOOKUPS_PER_RUN, type ModelWebClient } from '../knowledge/webLookup';
import {
  classifyErrorAnswer, classifyReadError, ENRICH_FAILURES_KEY, ENRICH_SKIPPED_KEY, enrichBackoffMs, FAILURES_RESET_KEY, fileKey, isConnectionLoss,
  logSummary, readFailures, readSkipped, SUSPECT_ATTEMPTS, UNREAD_PARTS_KEY, unreadableRows, type ReadFailure, type UnreadPart,
} from './unreadable';

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
/**
 * Pack files: reading stops after this many failed packs in a row (the connection is gone). Model metadata has no
 * such stop: a broken file is recorded and the reading goes on to the end (see enrichBatch).
 */
export const MAX_CONSECUTIVE_FAILURES = 5;
/** A lost connection is opened again at most this many times per run (each time after RECONNECT_PAUSE_MS). */
export const MAX_RECONNECTS = 3;
/** A native 404 can describe one oversized/metadata-free file; verify recovery on at most five other headers. */
export const MAX_METADATA_RECOVERY_PROBES = 5;
/** The pause before a new connection is opened, so a server that is restarting has a moment. */
export const RECONNECT_PAUSE_MS = 1_000;
/** Same-size/root replacements have no fingerprint; supported headers are refreshed at least daily. */
export const HEADER_REFRESH_MS = 24 * 60 * 60 * 1000;

/*
 * The run's error when no model file could be read and the library has none read from before: only then is the
 * sync a failure. Which sentence says why in plain words (the renderer translates each, shared/i18n ERROR_KEYS).
 */
export const ALL_FAILED = 'Model metadata could not be read.';
export const ALL_FAILED_CONNECTION = 'Model metadata could not be read: the connection to the MCP server was lost while reading it.';
export const ALL_FAILED_SERVER = 'Model metadata could not be read: the MCP server answered every file with an error.';
/**
 * The connection for reading model files was lost and did not come back after the bounded reconnects (or the
 * server's own reader behind it is gone): reading stopped there, and the rest is read at the next sync.
 */
export const METADATA_CONNECTION_LOST = 'Reading model files stopped: the MCP server lost its connection for reading them. Restart the MCP server if this stays; the rest is read at the next sync.';
export const NODE_PORTS_NO_URL = 'Node ports were not updated: the MCP server did not name a ComfyUI address.';
export const NODE_PORTS_NOT_ALLOWED = 'Node ports were not updated: the ComfyUI address the server named is not on this computer or saved in Settings.';
/**
 * The node details (inputs, settings) could not be read either way: comfy_api did not send them and the ComfyUI
 * address the server named is not one this computer can open (the server's own machine, seen from another one).
 */
export const NODE_DETAILS_ELSEWHERE = 'Node names and models were read, but not the inputs and settings of nodes: ComfyUI answers only on its own computer. Run this app on that computer, or enter a ComfyUI address this computer can open in Settings ▸ Connection.';
export const comfyNotRunningWarning = (host: string) => `ComfyUI is not running at ${host} — node ports were not updated; start ComfyUI and sync again.`;
export const sectionUnreadWarning = (section: string) => `MCP catalog section could not be read: ${section}.`;
/** One model folder (loras, checkpoints …) could not be listed; the library keeps its previous list. */
export const folderUnreadWarning = (folder: string) => `Model folder could not be read: ${folder}.`;
/** The MCP server is of no kind the app knows; the ComfyUI address in Settings was read instead. */
export const MCP_UNKNOWN_READ_COMFY = 'The MCP server is not one the app knows how to read; everything was read from the ComfyUI address instead.';
/** Neither address is set: there is nothing to read. */
export const NO_ADDRESS = 'Neither a ComfyUI address nor an MCP server address is set.';

/** sync_state: what the library was last read from ('comfy', 'mcp', 'mcp+comfy'). */
export const LIBRARY_SOURCE_KEY = 'library_source';
/** sync_state: the kind of MCP server of the last read (profiles.ts), or '' when no MCP server was read. */
export const MCP_PROFILE_KEY = 'mcp_profile';
/** sync_state: each model folder's paths on the ComfyUI machine, in ComfyUI's order (the preview route's index). */
export const COMFY_MODEL_ROOTS_KEY = 'comfy_model_roots';
/** sync_state: the ComfyUI origin the library's previews and metadata are read from ('' when not ComfyUI). */
export const COMFY_READ_ORIGIN_KEY = 'comfy_read_origin';

/** Everything a sync reads from outside; the app uses defaultDeps, tests replace parts. */
export interface SyncDeps {
  readUrl: (db: Database.Database) => string;
  /** Settings ▸ Connection ▸ ComfyUI address ('' when not set): node details may come from it. */
  readComfyOrigin: (db: Database.Database) => string;
  /** Settings ▸ Connection: which credentials the person chose to offer ('' = whatever is held). */
  readAuthMode: (db: Database.Database) => McpAuthMode;
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
  /** Settings ▸ Privacy: whether sync may look model files up on the internet (off by default). */
  readLookupOnline: (db: Database.Database) => boolean;
  /** The client that asks Civitai and Hugging Face. */
  webClient: () => ModelWebClient;
  /** Pause between internet requests during sync (tests); SYNC_LOOKUP_PAUSE_MS otherwise, never less. */
  lookupPauseMs?: number;
  /** Files looked up per sync at most (tests); SYNC_LOOKUPS_PER_RUN otherwise. */
  lookupsPerRun?: number;
  /** Pause before a lost connection is opened again (tests); RECONNECT_PAUSE_MS otherwise. */
  reconnectPauseMs?: number;
  /** Where the end-of-run summary goes (the app log through the console); tests may catch it. */
  log?: (line: string) => void;
}

type Listener = (status: SyncStatus) => void;

/** Preferences > Sync for metadata reading: which folders, how many files per batch, the pause between batches. */
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
  readComfyOrigin: (db) => {
    const read = readSettings(db);
    return read.source === 'corrupt' ? '' : read.values.comfyOrigin;
  },
  readAuthMode: (db) => {
    const read = readSettings(db);
    return read.source === 'corrupt' ? '' : read.values.mcpAuth;
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
  readLookupOnline: (db) => readPreferences(db).privacy.lookupModelsOnline,
  webClient: appWebClient,
};

/** The internet lookups of one sync: after metadata reading, one file at a time, spaced, until done or cancelled. */
interface WebRun {
  isCurrent: () => boolean;
  cancelled: boolean;
  done: Promise<void>;
}

/** After this many failed lookups in a row (the site is down, the computer offline) the run stops until the next sync. */
const MAX_LOOKUP_FAILURES = 3;

export { ENRICH_FAILURES_KEY, enrichBackoffMs } from './unreadable';

/** LoRAs first (they carry trigger words and base models people ask about), then checkpoints, then the rest. */
function enrichOrder(directory: string): number {
  if (directory === 'loras') return 0;
  if (directory === 'checkpoints') return 1;
  return 2;
}

/** All sync_state rows as a key → value map. Also the store for small app state such as address history. */
export function readState(db: Database.Database): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM sync_state').all() as Array<{ key: string; value: string }>;
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

/**
 * `run_open` in sync_state: when the run in flight started; the row is removed when the run ends, cancelled or not,
 * so a finished or cancelled read leaves sync_state as it found it. Never throws.
 */
function markRunOpen(db: Database.Database, at: number | null): void {
  try {
    if (at === null) db.prepare("DELETE FROM sync_state WHERE key = 'run_open'").run();
    else writeState(db, { run_open: String(at) });
  } catch {
    // Without the mark a crash during this run is not noticed at the next start; nothing else changes.
  }
}

/** Upserts sync_state rows in one transaction. */
export function writeState(db: Database.Database, values: Record<string, string>): void {
  const upsert = db.prepare('INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  db.transaction(() => {
    for (const [key, value] of Object.entries(values)) upsert.run(key, value);
  }).immediate();
}

/** An auto-sync interval within the allowed range, in whole minutes. */
function clampInterval(value: number): number {
  if (!Number.isFinite(value)) return SYNC_INTERVAL_DEFAULT_MINUTES;
  return Math.max(SYNC_INTERVAL_MIN_MINUTES, Math.min(SYNC_INTERVAL_MAX_MINUTES, Math.round(value)));
}

/** The auto-sync setting as stored in sync_state. */
function autoOf(state: Record<string, string>): { enabled: boolean; intervalMinutes: number } {
  const stored = Number(state.auto_interval_minutes);
  return {
    enabled: state.auto_enabled === '1',
    intervalMinutes: state.auto_interval_minutes ? clampInterval(stored) : SYNC_INTERVAL_DEFAULT_MINUTES,
  };
}

/** Files with a safetensors header, the only kind whose metadata can be read. */
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
  // Slow is told apart from gone, a missing host from a closed port (connectError.ts).
  return explainFailureNow(error, url);
}

/** What "Read through MCP" reports after the sync it ran (see McpReadOutcome). */
export function mcpReadOutcome(status: SyncStatus): McpReadOutcome {
  if (status.state === 'error') return { ok: false, error: status.lastError ?? 'MCP server was not read.' };
  if (status.state === 'never') return { ok: false, error: status.mcpUrl ? 'MCP server was not read.' : 'MCP server URL is empty.' };
  const metadata = status.metadata ?? { done: 0, total: 0 };
  return {
    ok: true,
    nodes: status.counts.nodeClasses,
    packs: status.counts.packs,
    models: status.counts.models,
    done: metadata.done,
    total: metadata.total,
    continuing: status.progress?.phase === 'enrichment',
    warnings: status.warnings ?? [],
    at: status.lastSyncAt,
  };
}

/** True when the URL's host is this machine (localhost, 127.x, ::1). */
function onThisMachine(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return isLoopbackHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Non-fatal problems of a successful listing, as fixed sentences. `mcpUrl` tells whether the MCP server runs on
 * this computer: when it does not, a ComfyUI address on "this machine" is the server's machine, not ours.
 */
export function catalogWarnings(result: McpReadSuccess, mcpUrl?: string | null): string[] {
  const warnings = [
    ...(result.failedSections ?? []).map(sectionUnreadWarning),
    ...(result.failedFolders ?? []).filter((folder) => /^[A-Za-z0-9_.-]{1,80}$/.test(folder)).map(folderUnreadWarning),
  ];
  if (result.objectInfo === 'none') {
    const host = hostOf(result.comfyUrl);
    const elsewhere = mcpUrl != null && mcpUrl !== '' && !onThisMachine(mcpUrl);
    if (elsewhere && (result.nativeComfy === 'unreachable' || result.nativeComfy === 'notAllowed')) warnings.push(NODE_DETAILS_ELSEWHERE);
    else if (result.nativeComfy === 'unreachable' && host) warnings.push(comfyNotRunningWarning(host));
    else if (result.nativeComfy === 'notAllowed') warnings.push(NODE_DETAILS_ELSEWHERE);
    else if (!result.comfyUrl) warnings.push(NODE_PORTS_NO_URL);
  }
  return warnings;
}

/** How the last successful connection authenticated: the manual token, the browser sign-in, or nothing at all. */
function authModeOf(state: Record<string, string>): SyncStatus['authMode'] {
  const value = state.auth_mode;
  return value === 'token' || value === 'oauth' || value === 'anonymous' ? value : null;
}

/** The last run's warnings as stored (fixed sentences). */
function readWarnings(state: Record<string, string>): string[] {
  try {
    const value = JSON.parse(state.last_warnings ?? '[]') as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Where the library was last read from, and whether that is still the address in Settings. A library read before
 * this was recorded has no known origin and is never called stale.
 */
function libraryOrigin(state: Record<string, string>, mcpUrl: string, comfyOrigin: string): { libraryUrl: string | null; libraryElsewhere: boolean } {
  const libraryUrl = state.library_url ?? null;
  if (libraryUrl == null || state.last_sync_at == null) return { libraryUrl, libraryElsewhere: false };
  const comfyChanged = state.library_comfy_origin != null && state.library_comfy_origin.trim() !== comfyOrigin.trim();
  return { libraryUrl, libraryElsewhere: libraryUrl.trim() !== mcpUrl.trim() || comfyChanged };
}

function numberOrNull(value: string | undefined): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The run in flight, so a change of address can cancel it: its session is closed and its result dropped. */
interface RunTicket {
  controller: AbortController;
  generation: number;
  cancelled: boolean;
  session: McpSession | null;
  /** All cancellation paths await the same close, including a close already in progress. */
  closing?: Promise<void>;
}

/** One run's metadata reading: the first batch inside the run, then batches in the background on the same session. */
interface EnrichRun {
  isCurrent: () => boolean;
  signal: AbortSignal;
  session: McpSession;
  /** Read-only native fallback, only after this run verified the accepted ComfyUI origin. */
  metadataFallback?: McpSession;
  nativeMetadata?: boolean;
  /** Bounded recovery lookahead, consumed in ordinary order (including across metadata batches). */
  metadataProbes?: Map<string, MetadataOutcome>;
  /** When the sync this reading belongs to began. */
  startedAt: number;
  hasTool: boolean;
  /** The server can hand over the description file a model manager keeps next to a model. */
  hasFiles: boolean;
  /** The library is read from ComfyUI itself: whether a file has a preview picture is asked there, with its header. */
  comfyPreviews?: { origin: string; roots: Record<string, string[]>; fetchImpl: typeof fetch };
  batch: number;
  pauseMs: number;
  scope: 'loaders' | 'all';
  attempted: number;
  failed: number;
  /** Files whose header was read in this run. */
  read: number;
  /** Failures of this run by reason, for the sentence when none could be read. */
  reasons: ReadFailure['reason'][];
  /**
   * Opens a new session the same way the run's first was opened (same factory, same sign-in) after the connection
   * was lost; the stateless ComfyUI reader returns itself. Absent: a lost connection ends the reading.
   */
  reconnect?: () => Promise<McpSession>;
  reconnects: number;
  reconnectPauseMs: number;
  /** The connection could not be restored: reading stopped for this run. */
  lost: boolean;
  cancelled: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  done: Promise<void>;
  resolve: () => void;
}

/**
 * Keeps the local catalog in step with the person's ComfyUI through read-only MCP calls or ComfyUI's read routes.
 * One run at a time; a second request while running joins the first. After a successful listing, model metadata is
 * read in batches in the background until every file in scope is read or waits out its backoff.
 */
export class SyncService {
  private db: Database.Database | null = null;
  private running: Promise<SyncStatus> | null = null;
  private retrying: Promise<RetryItemResult> | null = null;
  private progress: SyncStatus['progress'] = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextRunAt: number | null = null;
  private startupPending = false;
  /**
   * The last run never ended (the app crashed, froze or was killed during a sync): automatic runs wait until the
   * person starts one. Kept as `run_open` in sync_state while a run is in flight.
   */
  private autoHeld = false;
  private background: EnrichRun | null = null;
  private webRun: WebRun | null = null;
  private enrichmentPaused = false;
  private ticket: RunTicket | null = null;
  private generation = 0;
  private readonly listeners = new Set<Listener>();
  private readonly deps: SyncDeps;

  constructor(deps: Partial<SyncDeps> = {}) {
    this.deps = { ...defaultDeps, ...deps };
  }

  /** Called with every status change (ipc/knowledgeIpc.ts pushes it to the windows); returns the unsubscribe. */
  onStatus(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The status the window shows, from sync_state and the run in flight; a neutral status without a database. */
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
        authChoice: '',
        unreadable: [],
      };
    }
    const state = readState(db);
    const lastSyncAt = numberOrNull(state.last_sync_at);
    const lastError = state.last_error ? state.last_error : null;
    let phase: SyncStatus['state'] = 'never';
    if (this.running || this.retrying) phase = 'running';
    else if (lastError) phase = 'error';
    else if (lastSyncAt != null) phase = 'idle';
    const mcpUrl = this.deps.readUrl(db);
    const comfyOrigin = this.readComfyOriginSafe(db);
    const metadata = this.metadataCounts(db);
    let progress: SyncStatus['progress'] = null;
    if (this.running) progress = this.progress;
    else if (this.retrying) progress = { phase: 'enrichment', done: 0, total: 1 };
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
      startupPending: this.startupPending && !this.running && !this.retrying,
      autoHeld: this.autoHeld,
      lastRunAt: numberOrNull(state.last_run_at),
      lastRunDurationMs: numberOrNull(state.last_run_duration_ms),
      warnings: readWarnings(state).filter(warning => warning !== METADATA_CONNECTION_LOST || metadata.total === 0 || metadata.done < metadata.total),
      metadata,
      enrichmentPaused: this.enrichmentPaused,
      authMode: authModeOf(state),
      authChoice: this.readAuthMode(db),
      ...libraryOrigin(state, mcpUrl, comfyOrigin),
      comfyOrigin,
      librarySource: librarySourceOf(state),
      mcpProfile: mcpProfileOf(state),
      catalogRevision: Number(state.catalog_revision) || 0,
      headerRepairs: readHeaderRepairs(state),
      unreadable: unreadableRows(state),
    };
  }

  /**
   * Never throws: failures land in lastError with a fixed, secret-free message.
   * While metadata is still being read in the background the request is ignored and the current status returned.
   */
  runSync(db: Database.Database, fetchImpl: typeof fetch = this.deps.fetchImpl, factory: McpSessionFactory = this.deps.factory): Promise<SyncStatus> {
    this.db = db;
    if (this.running) return this.running;
    if (this.retrying) return Promise.resolve(this.status(db));
    if (this.background) return Promise.resolve(this.status(db));
    // No address yet: there is nothing to read and nothing failed. The status (both addresses '') says what is
    // missing; an earlier "address is empty" error is not kept as a red failure.
    if (!this.hasAddress(db)) {
      const state = readStateSafe(db);
      if (state.last_error === 'MCP server URL is empty.' || state.last_error === NO_ADDRESS) writeState(db, { last_error: '' });
      return Promise.resolve(this.emit(db));
    }
    this.startupPending = false;
    this.enrichmentPaused = false;
    this.progress = { phase: this.readUrlSafe(db) !== '' ? 'connect' : 'comfy', done: 0, total: 0 };
    const held = this.autoHeld;
    this.autoHeld = false;
    markRunOpen(db, this.deps.now());
    this.running = this.execute(db, fetchImpl, factory).finally(() => {
      this.running = null;
      this.progress = null;
      markRunOpen(db, null);
      // A run the person started after a held start ended: the schedule comes back.
      if (held) this.schedule(db, false);
    }).then(() => this.emit(db));
    this.emit(db);
    return this.running;
  }

  /** Turns auto sync on or off and sets its interval; the timer is armed again at once. */
  setAuto(db: Database.Database, enabled: boolean, intervalMinutes: number): SyncStatus {
    this.db = db;
    // Auto sync without an address would only fail on a timer: it stays off until there is one to read.
    const on = enabled && this.hasAddress(db);
    writeState(db, { auto_enabled: on ? '1' : '0', auto_interval_minutes: String(clampInterval(intervalMinutes)) });
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
    if (readStateSafe(db).run_open) {
      // The last run never ended: no automatic run until the person starts one (a server answer that froze or
      // crashed the app must not do it again at every start).
      this.autoHeld = true;
      console.warn('[Sync] The last sync did not end; automatic sync waits until it is started by hand');
      return this.emit(db);
    }
    this.schedule(db, true);
    return this.emit(db);
  }

  /** An automatic run: none while the start is held (see autoHeld). */
  private runAuto(db: Database.Database): void {
    if (this.autoHeld) {
      this.emit(db);
      return;
    }
    void this.runSync(db);
  }

  /** Pushes the current status to listeners (e.g. after a sign-in or sign-out). */
  notify(db: Database.Database | null = this.db): SyncStatus {
    return db ? this.emit(db) : this.status(null);
  }

  /**
   * Settings ▸ Connection saved another MCP or ComfyUI address. A run for the old one is cancelled (its result is
   * dropped), background reading stops, and the library stays marked as read from the old address
   * (status.libraryElsewhere) until the new one is read: at once when auto sync is on, else when the person asks.
   */
  addressChanged(db: Database.Database): SyncStatus {
    this.db = db;
    this.generation += 1;
    const generation = this.generation;
    const ticket = this.ticket;
    if (ticket) {
      ticket.cancelled = true;
      ticket.controller.abort();
      if (this.running || this.retrying) void this.closeTicket(ticket);
    }
    this.cancelEnrichment();
    if (this.webRun) this.webRun.cancelled = true;
    const auto = autoOf(readStateSafe(db));
    const after = this.running ?? this.retrying ?? Promise.resolve(this.status(db));
    void after.catch(() => undefined).then(() => {
      if (generation !== this.generation) return;
      if (auto.enabled && this.hasAddress(db)) this.runAuto(db);
      else this.emit(db);
    });
    this.schedule(db, false);
    return this.emit(db);
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

  /** Resolves when the internet lookups of the current run have ended (at once when none run). */
  whenWebLookupsDone(): Promise<void> {
    return this.webRun?.done ?? Promise.resolve();
  }

  /** Clears the schedule and cancels background reading. Leaves no timer behind (app quit, tests). */
  stop(): void {
    this.generation += 1;
    if (this.ticket) {
      this.ticket.cancelled = true;
      this.ticket.controller.abort();
      if (this.running || this.retrying) void this.closeTicket(this.ticket);
    }
    this.clearSchedule();
    this.cancelEnrichment();
    if (this.webRun) this.webRun.cancelled = true;
    this.webRun = null;
  }

  /**
   * With Settings ▸ Privacy ▸ "Look up models on the internet" on: asks Civitai, then Hugging Face, about the files
   * whose fingerprint is known and that nothing from Civitai describes. Never makes a fingerprint (that reads the
   * whole file on the server). At most SYNC_LOOKUPS_PER_RUN files a run, the rest at the next; requests at least
   * SYNC_LOOKUP_PAUSE_MS apart. Starts after the metadata reading of the run, so fingerprints read from the
   * descriptions are there. Runs on its own: nothing of it touches the MCP server.
   */
  private startWebLookups(db: Database.Database, runStartedAt: number): void {
    if (this.webRun) return;
    let enabled = false;
    try {
      enabled = this.deps.readLookupOnline(db);
    } catch {
      enabled = false;
    }
    if (!enabled) return;
    const generation = this.generation;
    const run: WebRun = { cancelled: false, done: Promise.resolve(), isCurrent: () => generation === this.generation };
    const pauseMs = Math.max(SYNC_LOOKUP_PAUSE_MS, this.deps.lookupPauseMs ?? SYNC_LOOKUP_PAUSE_MS);
    const work = async () => {
      let rows: ReturnType<typeof dueLookups> = [];
      try {
        rows = dueLookups(db, Math.max(1, this.deps.lookupsPerRun ?? SYNC_LOOKUPS_PER_RUN), runStartedAt);
      } catch {
        return;
      }
      let failures = 0;
      for (const row of rows) {
        if (run.cancelled || !run.isCurrent()) return;
        const outcome = await this.deps.webClient().lookup({ sha256: row.sha256, filename: row.name }, pauseMs);
        if (run.cancelled || !run.isCurrent()) return;
        try {
          db.transaction(() => {
            writeWebOutcome(db, row.directory, row.name, outcome, this.deps.now());
            bumpCatalogRevision(db);
          }).immediate();
          this.emit(db);
        } catch {
          return;
        }
        failures = outcome.status === 'error' ? failures + 1 : 0;
        if (failures >= MAX_LOOKUP_FAILURES) return;
      }
    };
    run.done = work().catch(() => undefined).finally(() => {
      if (this.webRun === run) this.webRun = null;
      try {
        this.emit(db);
      } catch {
        // The database went away (app quit).
      }
    });
    this.webRun = run;
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
      // ComfyUI itself needs no sign-in: a startup run can always try it.
      if (!url) return this.readComfyOriginSafe(db) !== '';
      const mode = this.readAuthMode(db);
      // "No sign-in" was the person's explicit choice: every startup tries, and the status says what the server answered.
      if (mode === 'none') return true;
      if ((mode !== 'oauth' && this.deps.token() != null) || (mode !== 'token' && this.deps.signedIn(url))) return true;
      const state = readState(db);
      if (state.auth_mode === 'anonymous') return true;
      return state.last_error !== MCP_NEEDS_SIGN_IN && state.last_error !== MCP_SIGN_IN_AGAIN;
    } catch {
      return false;
    }
  }

  private schedule(db: Database.Database, startup: boolean): void {
    this.clearSchedule();
    if (this.autoHeld) return;
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
      this.runAuto(db);
    }, delay);
    // A pending sync must not keep the app (or a test run) alive.
    this.timer.unref?.();
  }

  /** Either address is set: there is something to read. */
  private hasAddress(db: Database.Database): boolean {
    return this.readUrlSafe(db) !== '' || this.readComfyOriginSafe(db) !== '';
  }

  private readUrlSafe(db: Database.Database): string {
    try {
      return this.deps.readUrl(db).trim();
    } catch {
      return '';
    }
  }

  private readComfyOriginSafe(db: Database.Database): string {
    try {
      return this.deps.readComfyOrigin(db).trim();
    } catch {
      return '';
    }
  }

  private readAuthMode(db: Database.Database): McpAuthMode {
    try {
      return this.deps.readAuthMode(db);
    } catch {
      return '';
    }
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

  /**
   * Files in the scope; with `onlyPending`, those still to read. A file is read when its header was read and,
   * where the server hands over description files, when the description next to it is the one last read.
   */
  private scopeRows(db: Database.Database, scope: 'loaders' | 'all', onlyPending: boolean, sideFiles = false, refreshHeaders = true): EnrichRow[] {
    const pending = onlyPending ? ` AND NOT (${readCondition(sideFiles, this.deps.now(), refreshHeaders)})` : '';
    return (scope === 'all'
      ? db.prepare(`SELECT ${ENRICH_COLUMNS} FROM model_catalog WHERE 1 = 1${pending}`).all()
      : db.prepare(
        `SELECT ${ENRICH_COLUMNS} FROM model_catalog WHERE directory IN (${ENRICH_DIRECTORIES.map(() => '?').join(', ')})${pending}`,
      ).all(...ENRICH_DIRECTORIES)) as EnrichRow[];
  }

  /** Files in the enrichment scope, and how many are read (see scopeRows). */
  private metadataCounts(db: Database.Database): { done: number; total: number } {
    const { scope } = this.enrichmentSettings(db);
    const state = readStateSafe(db);
    const sideFiles = state[SIDE_FILES_KEY] === '1';
    const where = scope === 'all' ? '' : `WHERE directory IN (${ENRICH_DIRECTORIES.map(() => '?').join(', ')})`;
    const row = db.prepare(`SELECT COUNT(*) AS total, COUNT(CASE WHEN ${readCondition(sideFiles, this.deps.now(), state.header_metadata_tool !== '0')} THEN 1 END) AS done FROM model_catalog ${where}`)
      .get(...(scope === 'all' ? [] : ENRICH_DIRECTORIES)) as { total: number; done: number };
    return { done: row.done, total: row.total };
  }

  /**
   * What a connection offers the server: the person's choice in Settings ▸ Connection decides (a manual token, the
   * browser sign-in, or nothing); the server decides whether it is enough.
   */
  private async credentials(db: Database.Database, url: string): Promise<{ token: string | null; authProvider: OAuthClientProvider | null }> {
    const mode = this.readAuthMode(db);
    const token = mode === 'none' || mode === 'oauth' ? null : this.deps.token();
    let authProvider: OAuthClientProvider | null = null;
    if (!token && mode !== 'none' && mode !== 'token') {
      try {
        authProvider = await this.deps.authProvider(url);
      } catch {
        authProvider = null;
      }
    }
    return { token, authProvider };
  }

  /**
   * Settings ▸ Sync ▸ "Try again now" for one model file: its wait is cleared and its header is read at once, on a
   * connection of its own (the way the last sync read it: the MCP server's metadata tool, or ComfyUI itself). The
   * row goes away when the read worked, or says again why it did not. Refused while a sync runs ('busy').
   */
  retryItem(db: Database.Database, directory: string, name: string, fetchImpl: typeof fetch = this.deps.fetchImpl, factory: McpSessionFactory = this.deps.factory): Promise<RetryItemResult> {
    this.db = db;
    if (this.running || this.background || this.retrying) return Promise.resolve({ status: this.status(db), outcome: 'busy' });
    const key = fileKey(directory, name);
    const state = readState(db);
    const readRow = () => db.prepare(`SELECT ${ENRICH_COLUMNS}, size_bytes, synced_at, sha256 FROM model_catalog WHERE directory = ? AND name = ?`).get(directory, name) as (EnrichRow & { size_bytes: number | null; synced_at: number | null; sha256: string | null }) | undefined;
    const row = readRow();
    if (!row || !isHeaderFile(name)) return Promise.resolve({ status: this.status(db), outcome: 'unavailable' });
    const url = this.readUrlSafe(db);
    const comfyOrigin = this.readComfyOriginSafe(db);
    const sourceKeys = [COMFY_READ_ORIGIN_KEY, 'catalog_source_key', MCP_PROFILE_KEY, 'header_metadata_tool'];
    const ticket: RunTicket = { cancelled: false, session: null, controller: new AbortController(), generation: ++this.generation };
    this.ticket = ticket;
    const current = () => {
      if (!this.isCurrent(ticket) || url !== this.readUrlSafe(db) || comfyOrigin !== this.readComfyOriginSafe(db)) return false;
      const now = readState(db);
      if (sourceKeys.some((key) => (now[key] ?? '') !== (state[key] ?? ''))) return false;
      if (JSON.stringify(readSkipped(now)[key]) !== JSON.stringify(readSkipped(state)[key])) return false;
      const fresh = readRow();
      return !!fresh && (['root_path', 'size_bytes', 'synced_at', 'sha256', 'sidecar_sig', 'sidecar_file'] as const).every((field) => fresh[field] === row[field]);
    };
    this.retrying = (async (): Promise<RetryItemResult['outcome']> => {
      let outcome: MetadataOutcome = { ok: false, failure: { reason: 'notConnected' } };
      try {
        if (url && state[MCP_PROFILE_KEY] === 'catalog' && state.header_metadata_tool === '1') {
          this.deps.checkTokenOrigin(url);
          const { token, authProvider } = await this.credentials(db, url);
          if (!current()) return 'cancelled';
          const opened = await openReadOnlySession({ url, token, authProvider }, factory);
          if (opened.ok) ticket.session = opened.session;
        } else if (state[COMFY_READ_ORIGIN_KEY]) {
          ticket.session = comfyMetadataSession(state[COMFY_READ_ORIGIN_KEY], fetchImpl, ticket.controller.signal);
        }
        if (!current()) return 'cancelled';
        if (ticket.session) outcome = await readMetadata(ticket.session, directory, name);
      } catch (error) {
        outcome = { ok: false, failure: error instanceof McpRefusedError ? { reason: 'serverError' } : classifyReadError(error) };
      }
      // Both accepted facts and failure bookkeeping belong to the captured file and source.
      return db.transaction((): RetryItemResult['outcome'] => {
        if (!current()) return 'cancelled';
        const failures = readFailures(readState(db));
        if (outcome.ok) {
          writeModelEnrichment(db, directory, name, enrichmentOf(directory, name, outcome.parsed, null, this.deps.now()));
          bumpCatalogRevision(db);
          delete failures[key];
          const skipped = readSkipped(readState(db));
          delete skipped[key];
          writeState(db, { [ENRICH_FAILURES_KEY]: JSON.stringify(failures), [ENRICH_SKIPPED_KEY]: JSON.stringify(skipped) });
          return 'read';
        }
        failures[key] = {
          attempts: (failures[key]?.attempts ?? 0) + 1,
          lastAt: this.deps.now(),
          reason: outcome.failure.reason,
          ...(outcome.failure.detail ? { detail: outcome.failure.detail } : {}),
        };
        const skipped = readSkipped(readState(db));
        if (skipped[key]) skipped[key] = { at: this.deps.now(), reason: outcome.failure.reason, ...(outcome.failure.detail ? { detail: outcome.failure.detail } : {}) };
        writeState(db, { [ENRICH_FAILURES_KEY]: JSON.stringify(failures), [ENRICH_SKIPPED_KEY]: JSON.stringify(skipped) });
        return 'failed';
      }).immediate();
    })().finally(async () => {
      await this.closeTicket(ticket);
      if (this.ticket === ticket) {
        this.ticket = null;
        this.retrying = null;
      }
      this.emit(db);
    }).then((outcome) => ({ status: this.status(db), outcome }));
    this.emit(db);
    return this.retrying;
  }

  /** Explicit local header repair: no server calls, file writes or tensor loading. */
  importModelHeader(db: Database.Database, input: ImportModelHeaderRequest): ImportModelHeaderResult {
    this.db = db;
    const result = (outcome: ImportModelHeaderResult['outcome']): ImportModelHeaderResult => ({ status: this.status(db), outcome });
    if (this.running || this.background || this.retrying) return result('busy');
    const state = readState(db);
    if (input.catalogRevision !== (Number(state.catalog_revision) || 0) || this.status(db).libraryElsewhere) return result('stale');
    const row = db.prepare(`SELECT ${ENRICH_COLUMNS}, size_bytes FROM model_catalog WHERE directory = ? AND name = ?`)
      .get(input.directory, input.name) as (EnrichRow & { size_bytes: number | null }) | undefined;
    if (!row) return result('stale');
    if (!isHeaderFile(input.name) || input.fileName !== input.name.replace(/\\/g, '/').split('/').pop()
      || input.headerBytes + 8 > input.fileSize || (row.size_bytes != null && row.size_bytes !== input.fileSize)) return result('mismatch');
    const now = this.deps.now();
    const key = fileKey(input.directory, input.name);
    const empty = Object.keys(input.metadata).length === 0;
    db.transaction(() => {
      const value = enrichmentOf(input.directory, input.name, { metadata: input.metadata, sidecar: null }, null, now);
      // A header-only repair does not erase an existing sidecar description or source.
      writeModelEnrichment(db, input.directory, input.name, { ...value, description: value.description || row.description || '',
        sourceUrl: value.sourceUrl || row.source_url || '', triggerWords: value.triggerWords.length ? value.triggerWords : parseWords(row.trigger_words) });
      const failures = readFailures(state); const skipped = readSkipped(state);
      delete failures[key]; delete skipped[key];
      const repairs = [{ directory: input.directory, name: input.name, at: now, headerBytes: input.headerBytes, empty },
        ...readHeaderRepairs(state).filter(item => fileKey(item.directory, item.name) !== key)].slice(0, 50);
      writeState(db, { [ENRICH_FAILURES_KEY]: JSON.stringify(failures), [ENRICH_SKIPPED_KEY]: JSON.stringify(skipped), header_repairs: JSON.stringify(repairs), header_repairs_source: JSON.stringify([state.library_url ?? '', state.library_comfy_origin ?? '']) });
      bumpCatalogRevision(db);
    }).immediate();
    this.emit(db);
    return result(empty ? 'empty' : 'read');
  }

  /**
   * Settings ▸ Sync ▸ "Skip this file": a skipped file is not read again (and not counted as a failure) until the
   * switch is turned off; then its wait is cleared and the next sync reads it.
   */
  setSkipped(db: Database.Database, directory: string, name: string, skip: boolean): SyncStatus {
    this.db = db;
    const key = fileKey(directory, name);
    const state = readState(db);
    const skipped = readSkipped(state);
    const failures = readFailures(state);
    if (skip) {
      const record = failures[key];
      skipped[key] = { at: this.deps.now(), reason: record?.reason ?? 'failed', ...(record?.detail ? { detail: record.detail } : {}) };
    } else {
      delete skipped[key];
    }
    delete failures[key];
    writeState(db, { [ENRICH_SKIPPED_KEY]: JSON.stringify(skipped), [ENRICH_FAILURES_KEY]: JSON.stringify(failures) });
    return this.emit(db);
  }

  /** Settings ▸ Sync ▸ "Try all again": every wait is cleared (skipped files stay skipped) and a sync starts. */
  retryAll(db: Database.Database): Promise<SyncStatus> {
    this.db = db;
    if (!this.running && !this.background && !this.retrying) writeState(db, { [ENRICH_FAILURES_KEY]: '{}' });
    return this.runSync(db);
  }

  private async closeTicket(ticket: RunTicket): Promise<void> {
    const session = ticket.session;
    ticket.session = null;
    if (!session) { await ticket.closing; return; }
    // A fallback may open another session on the same ticket after the earlier one closed.
    ticket.closing = (ticket.closing ?? Promise.resolve()).then(() => session.close()).catch(() => undefined);
    await ticket.closing;
  }

  private isCurrent(ticket: RunTicket): boolean {
    return !ticket.cancelled && !ticket.controller.signal.aborted && ticket.generation === this.generation;
  }

  private async execute(db: Database.Database, fetchImpl: typeof fetch, factory: McpSessionFactory): Promise<void> {
    const startedAt = this.deps.now();
    const url = this.deps.readUrl(db);
    const comfyOrigin = this.readComfyOriginSafe(db);
    const ticket: RunTicket = { cancelled: false, session: null, controller: new AbortController(), generation: ++this.generation };
    this.ticket = ticket;
    // A run cancelled because the address changed leaves no result: the library stays marked as read from the old one.
    const finish = (values: Record<string, string>) => {
      if (!this.isCurrent(ticket)) return;
      writeState(db, {
        ...values,
        ...(values.last_sync_at ? { library_url: url, library_comfy_origin: comfyOrigin } : {}),
        last_run_at: String(startedAt),
        last_run_duration_ms: String(Math.max(0, this.deps.now() - startedAt)),
      });
    };
    // No MCP server: everything comes from ComfyUI's own address.
    if (!url) {
      await this.executeDirect(db, fetchImpl, comfyOrigin, startedAt, ticket, finish, []);
      return;
    }
    this.deps.checkTokenOrigin(url);
    const { token, authProvider } = await this.credentials(db, url);
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
      const error = opened.error === 'MCP server was not read.' && connectError
        ? await explainConnectFailure(connectError, url, { authenticated: token != null || authProvider != null, fetchImpl })
        : opened.error;
      finish({ last_error: redactSecrets(error) });
      return;
    }
    const session = opened.session;
    ticket.session = session;
    if (!this.isCurrent(ticket)) {
      await this.closeTicket(ticket);
      return;
    }
    // Remembered so the indicator knows whether this server needs any credentials at all.
    writeState(db, { auth_mode: token ? 'token' : authProvider && this.deps.signedIn(url) ? 'oauth' : 'anonymous' });
    let handedOver = false;
    try {
      this.setProgress(db, 'catalog', 0, 0);
      const now = this.deps.now();
      const read = await readCatalogWithSession(db, session, fetchImpl, now, {
        mcpUrl: url, comfyOrigin, signal: ticket.controller.signal, isCurrent: () => this.isCurrent(ticket),
        publishState: (accepted) => {
          if (!this.isCurrent(ticket)) throw new Error('Catalog collection cancelled');
          const previousIdentity = storedJson<{ installation_id?: string | null }>(readStateSafe(db).server_identity ?? null, {});
          writeState(db, {
            server_identity: JSON.stringify({ ...identityRecord(accepted.identity), installation_id: accepted.identity.installationId ?? previousIdentity.installation_id ?? null }),
            [SIDE_FILES_KEY]: accepted.toolNames.has('workspace_files') ? '1' : '0',
            header_metadata_tool: (accepted.profile === 'catalog' ? accepted.toolNames.has('model_metadata') : accepted.direct != null) ? '1' : '0',
            [MCP_PROFILE_KEY]: accepted.profile,
            [LIBRARY_SOURCE_KEY]: accepted.direct || accepted.result.objectInfo === 'native' ? 'mcp+comfy' : 'mcp',
            [COMFY_READ_ORIGIN_KEY]: accepted.direct?.origin ?? '',
            [COMFY_MODEL_ROOTS_KEY]: '{}',
            [UNREAD_PARTS_KEY]: JSON.stringify(unreadPartsOf(accepted.result)),
          });
          finish({ last_sync_at: String(now), last_error: '', last_warnings: JSON.stringify([...catalogWarnings(accepted.result, url), ...accepted.warnings]) });
        },
      });
      if (!this.isCurrent(ticket)) return;
      if ('ok' in read) {
        // A server of no known kind: with a ComfyUI address, everything is read from ComfyUI, and the status says
        // why; without one, the sentence names the way forward. Never a green "connected".
        if (read.error === MCP_UNKNOWN_SERVER && comfyOrigin) {
          await this.closeTicket(ticket);
          await this.executeDirect(db, fetchImpl, comfyOrigin, startedAt, ticket, finish, [MCP_UNKNOWN_READ_COMFY], 'unknown');
          return;
        }
        if (read.error === MCP_UNKNOWN_SERVER) writeState(db, { [MCP_PROFILE_KEY]: 'unknown' });
        finish({ last_error: redactSecrets(read.error) });
        return;
      }
      this.emit(db);
      const warnings = [...catalogWarnings(read.result, url), ...read.warnings];
      const settings = this.enrichmentSettings(db);
      let resolve: () => void = () => undefined;
      const done = new Promise<void>((settle) => {
        resolve = settle;
      });
      const hasFiles = read.toolNames.has('workspace_files');
      if (hasFiles && read.toolNames.has('studio_capabilities')) await this.readPackInfo(db, session, () => this.isCurrent(ticket));
      if (!this.isCurrent(ticket)) return;
      // A server that gives no metadata tool of its own: the headers are read from the ComfyUI address, when read.
      const metadataFromComfy = read.profile !== 'catalog' && read.direct != null;
      const metadataSession = metadataFromComfy && read.direct ? comfyMetadataSession(read.direct.origin, fetchImpl, ticket.controller.signal) : session;
      const run: EnrichRun = {
        ...this.newRun(ticket, metadataSession, startedAt, settings, done, resolve),
        hasTool: metadataFromComfy || (read.profile === 'catalog' && read.toolNames.has('model_metadata')),
        hasFiles,
        ...(read.metadataOrigin ? { metadataFallback: comfyMetadataSession(read.metadataOrigin, fetchImpl, ticket.controller.signal, { allowMissing: false }) } : {}),
        // A lost MCP connection is opened again through the same factory with the same sign-in; the ComfyUI
        // reader asks over plain HTTP and is simply asked again.
        reconnect: metadataFromComfy ? async () => metadataSession : async () => {
          const again = await openReadOnlySession({ url, token, authProvider }, factory);
          if (!again.ok) throw new Error(again.error);
          if (ticket.session) ticket.session = again.session;
          return again.session;
        },
      };
      const first = await this.enrichBatch(db, run, 'enrich');
      const enrichError = this.allFailedError(db, run);
      if (run.lost && !enrichError) warnings.push(METADATA_CONNECTION_LOST);
      finish({ last_sync_at: String(now), last_error: enrichError ?? '', last_warnings: JSON.stringify(warnings) });
      if (!this.isCurrent(ticket)) {
        resolve();
        return;
      }
      if (!enrichError && !first.stopped && first.remaining > 0) {
        // The background reading keeps the MCP session (the one it reads through, maybe opened again) only when it reads through it.
        handedOver = !metadataFromComfy;
        this.startBackground(db, run);
      } else {
        resolve();
        this.logReport(db);
        this.startWebLookups(db, startedAt);
      }
    } catch (error) {
      const signInLost = (authProvider as { signInRequired?: boolean } | null)?.signInRequired === true;
      finish({ last_error: signInLost ? MCP_SIGN_IN_AGAIN : classifySyncError(error, url) });
    } finally {
      if (!handedOver) await this.closeTicket(ticket);
      else ticket.session = null;
    }
  }

  /**
   * The whole catalog from the ComfyUI address (comfy/direct.ts): node classes, packs, model files with sizes and
   * folders, then the model headers through /view_metadata in batches like any sync. `extraWarnings` come first in
   * the status; `mcpProfile` is recorded when an MCP server was asked first ('unknown': of no kind the app reads).
   */
  private async executeDirect(
    db: Database.Database,
    fetchImpl: typeof fetch,
    comfyOrigin: string,
    startedAt: number,
    ticket: RunTicket,
    finish: (values: Record<string, string>) => void,
    extraWarnings: string[],
    mcpProfile: '' | 'unknown' = '',
  ): Promise<void> {
    if (!comfyOrigin) {
      finish({ last_error: NO_ADDRESS });
      return;
    }
    this.setProgress(db, 'comfy', 0, 0);
    const now = this.deps.now();
    let read: Awaited<ReturnType<typeof readComfyDirect>>;
    try {
      read = await readComfyDirect(db, comfyOrigin, fetchImpl, now, {
        onPhase: (phase, done, total) => this.setProgress(db, phase === 'catalog' ? 'catalog' : phase === 'models' ? 'models' : 'comfyPacks', done, total),
        cancelled: () => !this.isCurrent(ticket),
        signal: ticket.controller.signal,
        publishState: (accepted) => {
          if (!this.isCurrent(ticket)) throw new Error('Catalog collection cancelled');
          writeState(db, {
            [SIDE_FILES_KEY]: '0', header_metadata_tool: '1', [MCP_PROFILE_KEY]: mcpProfile, [LIBRARY_SOURCE_KEY]: 'comfy',
            [COMFY_READ_ORIGIN_KEY]: accepted.origin, [COMFY_MODEL_ROOTS_KEY]: JSON.stringify(accepted.roots),
            server_identity: JSON.stringify({ installation_id: null, comfyui_url: accepted.origin }),
            [UNREAD_PARTS_KEY]: JSON.stringify(accepted.failedFolders.map((name): UnreadPart => ({ kind: 'folder', name, reason: 'listing' }))),
          });
          finish({ last_sync_at: String(now), last_error: '', last_warnings: JSON.stringify([...extraWarnings, ...accepted.warnings, ...accepted.failedFolders.map(folderUnreadWarning)]) });
        },
      });
    } catch {
      read = { ok: false, error: 'Comfy origin was not read.' };
    }
    if (!this.isCurrent(ticket)) return;
    if (!read.ok) {
      writeState(db, { [MCP_PROFILE_KEY]: mcpProfile });
      finish({ last_error: redactSecrets(read.error) });
      return;
    }
    this.emit(db);
    const warnings = [...extraWarnings, ...read.warnings, ...read.failedFolders.map(folderUnreadWarning)];
    const settings = this.enrichmentSettings(db);
    let resolve: () => void = () => undefined;
    const done = new Promise<void>((settle) => {
      resolve = settle;
    });
    const metadataSession = comfyMetadataSession(read.origin, fetchImpl, ticket.controller.signal);
    const run: EnrichRun = {
      ...this.newRun(ticket, metadataSession, startedAt, settings, done, resolve),
      hasTool: true,
      hasFiles: false,
      comfyPreviews: read.modelListing === 'detailed' ? { origin: read.origin, roots: read.roots, fetchImpl } : undefined,
      // ComfyUI is asked over plain HTTP: "reconnecting" is asking again after the pause.
      reconnect: async () => metadataSession,
    };
    let first: { remaining: number; stopped: boolean };
    try {
      first = await this.enrichBatch(db, run, 'enrich');
    } catch {
      first = { remaining: 0, stopped: true };
    }
    const enrichError = this.allFailedError(db, run);
    if (run.lost && !enrichError) warnings.push(METADATA_CONNECTION_LOST);
    finish({ last_sync_at: String(now), last_error: enrichError ?? '', last_warnings: JSON.stringify(warnings) });
    if (!this.isCurrent(ticket)) {
      resolve();
      return;
    }
    if (!enrichError && !first.stopped && first.remaining > 0) {
      this.startBackground(db, run);
    } else {
      resolve();
      this.logReport(db);
      this.startWebLookups(db, startedAt);
    }
  }

  /**
   * Whether ComfyUI has a preview picture for a file (its preview route answers with one). When it has, the row is
   * marked so the library shows a picture there; the card asks for it again (it is kept then). Never throws.
   */
  private async askComfyPreview(source: NonNullable<EnrichRun['comfyPreviews']>, row: EnrichRow, signal: AbortSignal): Promise<number | null> {
    try {
      const index = row.root_path ? (source.roots[row.directory] ?? []).indexOf(row.root_path) : -1;
      if (index < 0) return null;
      const found = await readComfyPreview(source.origin, row.directory, index, row.name, source.fetchImpl, signal);
      return found?.bytes.length ?? null;
    } catch {
      // No picture is shown; the file is read like any other.
      return null;
    }
  }

  /**
   * What each node pack says about itself: its pyproject.toml and the opening of its README, read through the
   * read-only gate from the folder ComfyUI loads it from. Only packs never read, or updated since (another version
   * or commit), are read, one after another; on a server that has not changed this asks one question at most.
   * Nothing here ever fails the run: a pack whose read broke on the way is tried again at the next sync.
   */
  private async readPackInfo(db: Database.Database, session: McpSession, isCurrent: () => boolean): Promise<void> {
    try {
      const due = packsDueForInfo(db).filter((pack) => !CORE_PACKS.has(pack.name)).slice(0, PACK_INFO_PER_RUN);
      if (due.length === 0) return;
      const roots = await readCustomNodeRoots(session);
      if (!isCurrent() || roots.length === 0) return;
      let failures = 0;
      for (const [index, pack] of due.entries()) {
        this.setProgress(db, 'packs', index, due.length);
        if (!isCurrent()) return;
        const info = await readPackFiles(session, roots, pack.name);
        if (!isCurrent()) return;
        if (!info) {
          failures += 1;
          if (failures >= MAX_CONSECUTIVE_FAILURES) break;
          continue;
        }
        failures = 0;
        db.transaction(() => {
          writePackInfo(db, pack.name, info, packInfoSig(pack), this.deps.now());
          bumpCatalogRevision(db);
        }).immediate();
      }
      this.setProgress(db, 'packs', due.length, due.length);
    } catch {
      // A server that cannot name its folders, or a connection that broke: the packs keep what they had.
    }
  }

  private startBackground(db: Database.Database, run: EnrichRun): void {
    this.background = run;
    const step = async () => {
      run.timer = null;
      if (run.cancelled || !run.isCurrent()) return;
      try {
        const result = await this.enrichBatch(db, run, 'enrichment');
        if (run.cancelled || !run.isCurrent()) return;
        if (run.lost) {
          const warnings = readWarnings(readState(db));
          if (!warnings.includes(METADATA_CONNECTION_LOST)) writeState(db, { last_warnings: JSON.stringify([...warnings, METADATA_CONNECTION_LOST]) });
        }
        if (result.stopped || result.remaining === 0) {
          this.finishBackground(db, run);
          return;
        }
        run.timer = setTimeout(() => void step(), run.pauseMs);
        run.timer.unref?.();
      } catch (error) {
        if (run.cancelled || !run.isCurrent()) return;
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
    if (!run.cancelled && run.isCurrent()) {
      this.logReport(db);
      this.startWebLookups(db, run.startedAt);
    }
    try {
      this.emit(db);
    } catch {
      // The database went away (app quit).
    }
  }

  /** The parts of a run's metadata reading every kind of run starts with. */
  private newRun(
    ticket: RunTicket,
    session: McpSession,
    startedAt: number,
    settings: EnrichmentSettings,
    done: Promise<void>,
    resolve: () => void,
  ): Omit<EnrichRun, 'hasTool' | 'hasFiles'> {
    return {
      isCurrent: () => this.isCurrent(ticket),
      signal: ticket.controller.signal,
      session,
      startedAt,
      batch: Math.max(1, Math.round(this.deps.enrichLimit ?? settings.perRun)),
      pauseMs: Math.max(0, this.deps.batchPauseMs ?? settings.pauseMs ?? DEFAULT_ENRICH_PAUSE_MS),
      scope: settings.scope,
      attempted: 0,
      failed: 0,
      read: 0,
      reasons: [],
      reconnects: 0,
      reconnectPauseMs: Math.max(0, this.deps.reconnectPauseMs ?? RECONNECT_PAUSE_MS),
      lost: false,
      cancelled: false,
      timer: null,
      done,
      resolve,
    };
  }

  /**
   * The run's error, or null. A sync is a failure only when it tried files, read none of them, and the library has
   * no model read from before either: then nothing at all can be shown, and the sentence says why. Anything less
   * is a successful sync with a report of what could not be read.
   */
  private allFailedError(db: Database.Database, run: EnrichRun): string | null {
    if (run.attempted === 0 || run.read > 0) return null;
    // A successful lookahead will be published in the next batch; the first unavailable file must not end it.
    if (run.metadataProbes && [...run.metadataProbes.values()].some(result => result.ok)) return null;
    if (!run.lost && run.failed < run.attempted) return null;
    try {
      if (catalogTotals(db).enrichedModels > 0) return null;
    } catch {
      return null;
    }
    if (run.lost || run.reasons.some((reason) => reason === 'dropped' || reason === 'notConnected')) return ALL_FAILED_CONNECTION;
    if (run.reasons.length > 0 && run.reasons.every((reason) => reason === 'serverError')) return ALL_FAILED_SERVER;
    return ALL_FAILED;
  }

  /** Writes the end-of-run summary into the app log: counts and reasons, never a file name or an address. */
  private logReport(db: Database.Database): void {
    try {
      const metadata = this.metadataCounts(db);
      (this.deps.log ?? ((line: string) => console.info(line)))(logSummary(metadata.done, metadata.total, unreadableRows(readState(db))));
    } catch {
      // The log never breaks a sync.
    }
  }

  /**
   * After a lost connection: waits RECONNECT_PAUSE_MS, then opens a new session the way the first was opened.
   * False when the run may not reconnect again (MAX_RECONNECTS), was cancelled, or the new connection failed.
   */
  private async restoreConnection(run: EnrichRun): Promise<boolean> {
    if (!run.reconnect || run.reconnects >= MAX_RECONNECTS) return false;
    run.reconnects += 1;
    if (run.reconnectPauseMs > 0) {
      await new Promise<void>((settle) => {
        const timer = setTimeout(settle, run.reconnectPauseMs);
        timer.unref?.();
      });
    }
    if (run.cancelled || !run.isCurrent()) return false;
    let next: McpSession;
    try {
      next = await run.reconnect();
    } catch {
      return false;
    }
    if (run.cancelled || !run.isCurrent()) {
      if (next !== run.session) void next.close().catch(() => undefined);
      return false;
    }
    const old = run.session;
    run.session = next;
    if (old !== next) void old.close().catch(() => undefined);
    return true;
  }

  /**
   * Reads one batch of metadata. LoRAs first, then checkpoints, then the rest; alphabetical within a folder.
   * A failed read is recorded with its reason and waits out its backoff; it never stops the reading: the batch goes
   * on to the next file. A lost connection is not the file's fault: the connection is opened again (bounded) and
   * the same file asked once more; only a file that loses the connection again is recorded (as the one that breaks
   * it). When the connection cannot be restored, the run is `lost` and `stopped`. Skipped files are not read.
   * `remaining` counts files still due after this batch.
   */
  private async enrichBatch(db: Database.Database, run: EnrichRun, phase: 'enrich' | 'enrichment'): Promise<{ remaining: number; stopped: boolean }> {
    const now = this.deps.now();
    const state = readState(db);
    // Once per profile, at the first reading of this version: the marks older versions wrote are dropped. They
    // counted a lost connection against every file asked after it, so healthy files waited a day. Written with
    // the records below, so a cancelled run leaves them as they were.
    const resetOld = state[FAILURES_RESET_KEY] !== '1';
    const failures = resetOld ? {} : readFailures(state);
    const skipped = readSkipped(state);
    const due = this.scopeRows(db, run.scope, true, run.hasFiles, run.hasTool)
      .filter((row) => {
        const key = fileKey(row.directory, row.name);
        if (skipped[key]) return false;
        const failure = failures[key];
        return !failure || now - failure.lastAt >= enrichBackoffMs(failure.attempts);
      })
      .sort((left, right) => enrichOrder(left.directory) - enrichOrder(right.directory)
        || left.directory.localeCompare(right.directory)
        || left.name.localeCompare(right.name));
    const rows = due.slice(0, run.batch);
    let handled = 0;
    try {
      for (const [index, row] of rows.entries()) {
        if (run.cancelled || !run.isCurrent()) break;
        if (phase === 'enrich') this.setProgress(db, 'enrich', index, rows.length);
        else this.emit(db);
        const key = fileKey(row.directory, row.name);
        // A read that did not come through: the name-based guess stays, the reason is kept for the report, and
        // the read is retried after the backoff (or at once with "Try again now").
        const failed = (failure: ReadFailure, attempts?: number) => {
          run.failed += 1;
          run.reasons.push(failure.reason);
          handled += 1;
          const previous = failures[key];
          failures[key] = {
            attempts: attempts ?? (previous?.attempts ?? 0) + 1,
            lastAt: this.deps.now(),
            reason: failure.reason,
            ...(failure.detail ? { detail: failure.detail } : {}),
          };
        };
        const headerDue = row.enriched_at == null || (run.hasTool && isHeaderFile(row.name) && now - row.enriched_at >= HEADER_REFRESH_MS);
        let parsed: ParsedModelMetadata | null = null;
        if (headerDue && run.hasTool && isHeaderFile(row.name)) {
          let outcome = run.metadataProbes?.get(key) ?? await readMetadata(run.nativeMetadata && run.metadataFallback ? run.metadataFallback : run.session, row.directory, row.name);
          run.metadataProbes?.delete(key);
          if (run.cancelled || !run.isCurrent()) break;
          run.attempted += 1;
          if (!outcome.ok && isConnectionLoss(outcome.failure) && !run.nativeMetadata) {
            const droppedHere = outcome.failure.reason === 'dropped';
            const restored = await this.restoreConnection(run);
            if (run.cancelled || !run.isCurrent()) break;
            if (restored) {
              outcome = await readMetadata(run.session, row.directory, row.name);
              if (run.cancelled || !run.isCurrent()) break;
            }
            if (!outcome.ok && isConnectionLoss(outcome.failure) && run.metadataFallback) {
              // MCP may still list tools while its internal reader is disconnected. Keep the MCP session for
              // sidecars; read this and subsequent headers through the already verified native origin instead.
              const fallback = await readMetadata(run.metadataFallback, row.directory, row.name);
              if (run.cancelled || !run.isCurrent()) break;
              let recovered = fallback.ok;
              if (!fallback.ok && (fallback.failure.reason === 'unreadable' || fallback.failure.reason === 'tooLarge')) {
                // /view_metadata returns 404 for an oversized or metadata-free header as well as a missing
                // route. One such file cannot establish whether recovery works. Require real metadata from
                // another header before switching; never count the original 404 as an empty success. Known
                // metadata also permits a later sync to retry the last unavailable file without a false outage.
                const later = due.slice(index + 1).filter(candidate => /\.safetensors$/i.test(candidate.name)
                  && (candidate.enriched_at == null || now - candidate.enriched_at >= HEADER_REFRESH_MS));
                const pendingKeys = new Set(due.map(candidate => fileKey(candidate.directory, candidate.name)));
                const known = this.scopeRows(db, run.scope, false).filter(candidate => /\.safetensors$/i.test(candidate.name)
                  && candidate.enriched_at != null && candidate.metadata_json && candidate.metadata_json !== '{}'
                  && !pendingKeys.has(fileKey(candidate.directory, candidate.name)));
                const probes = [...later, ...known].slice(0, MAX_METADATA_RECOVERY_PROBES);
                run.metadataProbes = new Map();
                for (const candidate of probes) {
                  const probe = await readMetadata(run.metadataFallback, candidate.directory, candidate.name);
                  if (run.cancelled || !run.isCurrent()) break;
                  const probeKey = fileKey(candidate.directory, candidate.name);
                  if (pendingKeys.has(probeKey)) run.metadataProbes.set(probeKey, probe);
                  if (probe.ok) { recovered = true; break; }
                  if (probe.failure.reason !== 'unreadable' && probe.failure.reason !== 'tooLarge') break;
                }
                if (!recovered) run.metadataProbes = undefined;
              }
              if (run.cancelled || !run.isCurrent()) break;
              if (recovered) {
                outcome = fallback;
                run.nativeMetadata = true;
                (this.deps.log ?? console.info)('[Sync] Model metadata reading recovered through ComfyUI; unavailable headers are reported separately');
              }
            }
            if (!outcome.ok && isConnectionLoss(outcome.failure)) {
              // The file broke a connection and fails again on a new one: it is the one that breaks it. It alone
              // waits the longest; the files after it are read.
              if (restored && (droppedHere || outcome.failure.reason === 'dropped')) {
                failed({ reason: 'dropped' }, Math.max(SUSPECT_ATTEMPTS, (failures[key]?.attempts ?? 0) + 1));
              }
              // A new connection that is not connected either, or none: the server cannot read now. Nothing more is
              // asked in this run and no other file is blamed.
              if (!restored || outcome.failure.reason === 'notConnected') {
                run.lost = true;
                break;
              }
              continue;
            }
          }
          if (!outcome.ok) {
            failed(outcome.failure);
            continue;
          }
          parsed = outcome.parsed;
        }
        // The description a model manager keeps next to the file. A file that is not a description, or is gone,
        // says nothing and is asked for again only when it changes; a read that failed on the way is retried.
        let side: ParsedSidecar | null = null;
        const sidePath = run.hasFiles ? sideFilePath(row.root_path, row.sidecar_file) : null;
        if (sidePath) {
          const read = await readSidecar(run.session, sidePath);
          if (run.cancelled || !run.isCurrent()) break;
          run.attempted += 1;
          if (!read.ok) {
            failed({ reason: 'failed' });
            continue;
          }
          side = read.side;
        }
        delete failures[key];
        const previewSize = headerDue && run.comfyPreviews ? await this.askComfyPreview(run.comfyPreviews, row, run.signal) : null;
        if (run.cancelled || !run.isCurrent()) break;
        db.transaction(() => {
          if (previewSize !== null) db.prepare('UPDATE model_catalog SET preview_file = ?, preview_sig = ? WHERE directory = ? AND name = ?').run(COMFY_PREVIEW_FILE, String(previewSize), row.directory, row.name);
          const sidecar = run.hasFiles ? { notes: side?.notes ?? EMPTY_NOTES, readSig: row.sidecar_sig ?? null } : undefined;
          if (headerDue) {
            writeModelEnrichment(db, row.directory, row.name, { ...enrichmentOf(row.directory, row.name, parsed, side?.facts ?? null, this.deps.now()), sidecar });
          } else if (sidecar && side) {
            // The header was read at an earlier run; what the description says is laid over what was stored then.
            writeModelEnrichment(db, row.directory, row.name, { ...enrichmentOver(row, side.facts), sidecar });
          } else if (sidecar) {
            writeModelNotes(db, row.directory, row.name, sidecar.notes, sidecar.readSig);
          }
          bumpCatalogRevision(db);
        }).immediate();
        // Only a header that came through counts as read; a name-only guess does not.
        if (parsed) run.read += 1;
        handled += 1;
      }
    } finally {
      if (!run.cancelled && run.isCurrent()) writeState(db, { [ENRICH_FAILURES_KEY]: JSON.stringify(failures), ...(resetOld ? { [FAILURES_RESET_KEY]: '1' } : {}) });
    }
    if (run.cancelled || !run.isCurrent()) return { remaining: 0, stopped: true };
    if (phase === 'enrich' && rows.length > 0) this.setProgress(db, 'enrich', handled, rows.length);
    if (run.lost) return { remaining: 0, stopped: true };
    return { remaining: due.length - handled, stopped: false };
  }
}

/** readState that reads as empty when the table is not there yet. */
function readStateSafe(db: Database.Database): Record<string, string> {
  try {
    return readState(db);
  } catch {
    return {};
  }
}

/** What the library was read from; a library read before the key existed but with an MCP address counts as 'mcp'. */
function librarySourceOf(state: Record<string, string>): SyncStatus['librarySource'] {
  if (state.last_sync_at == null) return null;
  const value = state[LIBRARY_SOURCE_KEY];
  return value === 'comfy' || value === 'mcp' || value === 'mcp+comfy' ? value : state.library_url ? 'mcp' : null;
}

/** The stored kind of MCP server, or null when it is not one of the known values. */
function mcpProfileOf(state: Record<string, string>): SyncStatus['mcpProfile'] {
  const value = state[MCP_PROFILE_KEY];
  return value === 'catalog' || value === 'modelList' || value === 'checkpointList' || value === 'unknown' ? value : null;
}

/**
 * Where previews of the library come from when it was read from ComfyUI itself: the origin, and each model folder's
 * paths in ComfyUI's order. Null when the library was read through an MCP server only.
 */
export function comfyPreviewSource(db: Database.Database): { origin: string; roots: Record<string, string[]> } | null {
  const state = readStateSafe(db);
  const origin = state[COMFY_READ_ORIGIN_KEY];
  if (!origin) return null;
  try {
    const parsed = JSON.parse(state[COMFY_MODEL_ROOTS_KEY] ?? '{}') as unknown;
    const roots: Record<string, string[]> = {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [folder, list] of Object.entries(parsed as Record<string, unknown>)) {
        if (Array.isArray(list)) roots[folder] = list.filter((item): item is string => typeof item === 'string');
      }
    }
    return { origin, roots };
  } catch {
    return { origin, roots: {} };
  }
}

/** The server identity as stored under `server_identity` (snake_case, read back by reportedComfyUrl). */
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

/** State key: whether the server of the last run hands over the files next to a model ('1') or not. */
const SIDE_FILES_KEY = 'side_files_tool';

const ENRICH_COLUMNS = 'directory, name, enriched_at, root_path, sidecar_file, sidecar_sig, metadata_json, trigger_words, description, source_url';

interface EnrichRow {
  directory: string;
  name: string;
  enriched_at: number | null;
  root_path: string | null;
  sidecar_file: string | null;
  sidecar_sig: string | null;
  metadata_json: string | null;
  trigger_words: string | null;
  description: string | null;
  source_url: string | null;
}

/** SQL for "this file is read": its header, and with `sideFiles` the description next to it as the listing has it. */
function readCondition(sideFiles: boolean, now: number, refreshHeaders = true): string {
  const cutoff = (Number.isFinite(now) ? now : Date.now()) - HEADER_REFRESH_MS;
  const headerRead = refreshHeaders ? `enriched_at IS NOT NULL AND (enriched_at > ${cutoff} OR (LOWER(name) NOT LIKE '%.safetensors' AND LOWER(name) NOT LIKE '%.sft'))` : 'enriched_at IS NOT NULL';
  return sideFiles ? `${headerRead} AND COALESCE(sidecar_sig, '') = COALESCE(sidecar_read_sig, '')` : headerRead;
}

/**
 * The description file of a model. `ok: false` when the read itself failed (the connection, a server error on
 * the way): that is retried. A file that is missing, too large or not a description is `side: null`.
 */
async function readSidecar(session: McpSession, path: string): Promise<{ ok: true; side: ParsedSidecar | null } | { ok: false }> {
  let bytes: Buffer | null;
  try {
    bytes = await readSideFile(session, path, SIDECAR_MAX_BYTES);
  } catch (error) {
    if (error instanceof McpRefusedError) throw error;
    return { ok: false };
  }
  if (!bytes) return { ok: true, side: null };
  try {
    return { ok: true, side: parseSidecarFile(JSON.parse(bytes.toString('utf8'))) };
  } catch {
    return { ok: true, side: null };
  }
}

/** Packs that are ComfyUI itself rather than a folder under custom_nodes: there are no pack files to read. */
const CORE_PACKS = new Set(['comfy-core', 'core', 'comfyui', 'ComfyUI']);
/** Packs read in one run at most; on a first sync that is every pack of a large setup, later only updated ones. */
export const PACK_INFO_PER_RUN = 200;
const README_NAMES = ['README.md', 'readme.md', 'Readme.md'] as const;

/**
 * What a pack's own files say, looked for under each folder ComfyUI loads packs from until one holds the pack.
 * A pack without the files (or with a name that is not one folder) says nothing, which is stored like any answer;
 * null only when a read broke on the way, so the pack is tried again at the next sync.
 */
async function readPackFiles(session: McpSession, roots: string[], name: string): Promise<PackInfo | null> {
  try {
    for (const root of roots) {
      const pyprojectPath = packFilePath(root, name, 'pyproject.toml');
      if (!pyprojectPath) return packInfoOf(null, '');
      const pyproject = await readPackFile(session, pyprojectPath, PYPROJECT_MAX_BYTES);
      let readme: Buffer | null = null;
      for (const file of README_NAMES) {
        const path = packFilePath(root, name, file);
        readme = path ? await readPackFile(session, path, README_HEAD_BYTES, true) : null;
        if (readme) break;
      }
      if (!pyproject && !readme) continue;
      return packInfoOf(pyproject ? parsePyproject(pyproject.toString('utf8')) : null, readme ? summarizeReadme(readme.toString('utf8')) : '');
    }
    return packInfoOf(null, '');
  } catch (error) {
    if (error instanceof McpRefusedError) throw error;
    return null;
  }
}

/** A stored JSON column, or `fallback` when empty or unreadable. */
function storedJson<T>(text: string | null, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/** A stored row with the facts of its description file laid over what the header gave at an earlier run. */
function enrichmentOver(row: EnrichRow, facts: SidecarFacts) {
  const stored = storedJson<unknown>(row.metadata_json, {});
  const metadata: Record<string, string> = {};
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    for (const [key, value] of Object.entries(stored as Record<string, unknown>)) if (typeof value === 'string') metadata[key] = value;
  }
  const guess = inferBaseModel({ metadata, sidecarBaseModel: facts.baseModel, filename: row.name });
  const words = storedJson<unknown>(row.trigger_words, []);
  return {
    kind: inferModelKind(row.directory, metadata),
    baseModel: guess.family,
    baseModelEvidence: guess.evidence,
    triggerWords: facts.trainedWords.length > 0 ? facts.trainedWords : Array.isArray(words) ? words.filter((item): item is string => typeof item === 'string') : [],
    description: facts.description || row.description || '',
    sourceUrl: civitaiUrl(facts) ?? row.source_url ?? null,
    metadata,
    enrichedAt: row.enriched_at ?? Date.now(),
    sha256: facts.sha256,
  };
}

/** One metadata read: the parsed header, or why it failed (unreadable.ts sorts the reasons). */
type MetadataOutcome = { ok: true; parsed: ParsedModelMetadata } | { ok: false; failure: ReadFailure };

/** One file's header metadata through `model_metadata`. A gate refusal is thrown; every other failure is sorted. */
async function readMetadata(session: McpSession, directory: string, name: string): Promise<MetadataOutcome> {
  try {
    const result = await session.callTool('model_metadata', { action: 'read', category: directory, name });
    if (result.isError) {
      const text = result.content?.find((block) => block.type === 'text' && typeof block.text === 'string')?.text;
      return { ok: false, failure: classifyErrorAnswer(text) };
    }
    const parsed = parseModelMetadata(toolPayload(result));
    return parsed ? { ok: true, parsed } : { ok: false, failure: { reason: 'unreadable' } };
  } catch (error) {
    if (error instanceof McpRefusedError) throw error;
    if (error instanceof ComfyMetadataReadError) {
      const reason: ReadFailure['reason'] = error.failure === 'notFound' ? 'unreadable'
        : error.failure === 'large' ? 'tooLarge'
          : error.failure === 'timeout' ? 'timeout'
            : error.failure === 'unreachable' || error.failure === 'hostNotFound' ? 'dropped' : 'serverError';
      return { ok: false, failure: { reason } };
    }
    return { ok: false, failure: classifyReadError(error) };
  }
}

/** The model folders and catalog sections a listing did not give, for the report. */
function unreadPartsOf(result: McpReadSuccess): UnreadPart[] {
  // ComfyUI was not up yet when the server was asked (it said so, and still did after the polite retries).
  const reason = result.comfyUnavailable ? 'comfyDown' : 'listing';
  return [
    ...(result.failedFolders ?? []).filter((folder) => /^[A-Za-z0-9_.-]{1,80}$/.test(folder)).map((name): UnreadPart => ({ kind: 'folder', name, reason })),
    ...(result.failedSections ?? []).map((name): UnreadPart => ({ kind: 'section', name, reason })),
  ];
}


/**
 * What is stored for a file from its header and from a description. Two descriptions may exist: the one the MCP
 * server's own download wrote (it comes with the header) and the one a model manager keeps next to the file. The
 * manager's is the one a person keeps up to date, so it speaks first; the other fills what it leaves out.
 */
function enrichmentOf(directory: string, name: string, parsed: ParsedModelMetadata | null, side: SidecarFacts | null, now: number) {
  const own = parsed?.sidecar ?? null;
  const facts: SidecarFacts | null = side || own ? {
    baseModel: side?.baseModel ?? own?.baseModel ?? null,
    trainedWords: side && side.trainedWords.length > 0 ? side.trainedWords : own?.trainedWords ?? [],
    description: side?.description || own?.description || '',
    modelId: side?.modelId ?? own?.modelId ?? null,
    modelVersionId: side?.modelId ? side.modelVersionId : own?.modelVersionId ?? null,
    sha256: side?.sha256 ?? own?.sha256 ?? null,
  } : null;
  const guess = inferBaseModel({ metadata: parsed?.metadata, sidecarBaseModel: facts?.baseModel, filename: name });
  const description = facts?.description || plainText(parsed?.metadata['modelspec.description'] ?? '');
  return {
    kind: inferModelKind(directory, parsed?.metadata),
    baseModel: guess.family,
    baseModelEvidence: guess.evidence,
    triggerWords: triggerWordsOf({ metadata: parsed?.metadata ?? {}, sidecar: facts }),
    description,
    sourceUrl: civitaiUrl(facts),
    metadata: parsed?.metadata ?? {},
    enrichedAt: now,
    sha256: facts?.sha256 ?? null,
  };
}

/** The app-wide instance. knowledgeIpc starts it and forwards its status to windows. */
export const syncService = new SyncService();

function parseWords(raw: string | null): string[] {
  try { const value: unknown = JSON.parse(raw || '[]'); return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 50) : []; } catch { return []; }
}

function readHeaderRepairs(state: Record<string, string>): NonNullable<SyncStatus['headerRepairs']> {
  try {
    if (state.header_repairs_source !== JSON.stringify([state.library_url ?? '', state.library_comfy_origin ?? ''])) return [];
    const value: unknown = JSON.parse(state.header_repairs || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter(item => item && typeof item.directory === 'string' && typeof item.name === 'string'
      && Number.isFinite(item.at) && Number.isFinite(item.headerBytes) && typeof item.empty === 'boolean').slice(0, 50);
  } catch { return []; }
}
