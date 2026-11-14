import type { McpReadOutcome, SyncStatus } from '../../../shared/contracts';

export type SyncState = SyncStatus['state'];

/** The stored sentence for an expired browser sign-in (main/mcp/client.ts MCP_SIGN_IN_AGAIN). */
const SIGN_IN_AGAIN = 'MCP sign-in has expired. Sign in through the browser again.';
/** The stored sentence for a server that answered 401 to a connection without credentials (MCP_NEEDS_SIGN_IN). */
const NEEDS_SIGN_IN = 'MCP server requires sign-in.';

export interface SyncView {
  state: SyncState;
  /** i18n key of the short state label. */
  labelKey: string;
  /** Interpolation values for labelKey (the enrichment counter). */
  labelParams?: Record<string, number>;
  /** 0..1 while a phase with a known total runs; null when indeterminate or idle. */
  fraction: number | null;
  /**
   * 'noUrl' when the server address is missing. 'noToken' when the server has asked for a sign-in and neither a token
   * nor a browser sign-in is held. Whether credentials are needed is the server's call, so a run is never blocked
   * before the server has answered, and a server that accepted an anonymous connection never blocks.
   */
  blocked: 'noUrl' | 'noToken' | null;
  /**
   * i18n key of the sentence that tells the person what to do about `blocked`, worded for the access they chose in
   * Settings ▸ Connection: paste the token, sign in, or (nothing chosen, or "no sign-in") choose one of the two.
   */
  hintKey: string | null;
  /** Model metadata is still being read in the background after a successful listing. */
  enriching: boolean;
  /** The ring is shown: a run or background enrichment. */
  busy: boolean;
  /** The last successful run left warnings (ComfyUI offline, a section not read), or the library is from another address. */
  warned: boolean;
  /**
   * The library was read from another MCP or ComfyUI address than the one now in Settings (the address changed):
   * the label says so instead of "up to date", and hintKey offers to read the new one.
   */
  elsewhere: boolean;
  /** A browser sign-in would fix the current problem (and would be used: the chosen access allows it). */
  needsSignIn: boolean;
}

export const MIN_INTERVAL_MINUTES = 5;
export const MAX_INTERVAL_MINUTES = 1440;

export function isEnriching(status: SyncStatus | null): boolean {
  return status?.state !== 'running' && status?.progress?.phase === 'enrichment';
}

export function syncView(status: SyncStatus | null): SyncView {
  const state: SyncState = status?.state ?? 'never';
  const progress = status?.progress ?? null;
  const enriching = isEnriching(status);
  const busy = state === 'running' || enriching;
  const fraction = busy && progress && progress.total > 0 ? Math.min(1, progress.done / progress.total) : null;
  // Main sends only what the chosen access allows ('none' sends nothing), so only that counts as held here.
  const choice = status?.authChoice ?? '';
  const tokenCounts = choice !== 'none' && choice !== 'oauth' && status?.tokenHeld === true;
  const signInCounts = choice !== 'none' && choice !== 'token' && status?.signedIn === true;
  const noCredentials = status != null && !tokenCounts && !signInCounts && status.authMode !== 'anonymous';
  // A token is the chosen access and the server wanted one, but none is held (it lived until the app closed): the
  // next run cannot work, so the indicator says so at start instead of a green left from before.
  const tokenGone = choice === 'token' && status?.tokenHeld !== true && status?.authMode === 'token';
  const blocked = !status || status.mcpUrl.trim() === '' ? 'noUrl' : (noCredentials && status.lastError === NEEDS_SIGN_IN) || tokenGone ? 'noToken' : null;
  let hintKey: string | null = null;
  if (blocked === 'noUrl') hintKey = 'sync.noUrl';
  else if (blocked === 'noToken') hintKey = choice === 'token' ? 'sync.needsToken' : choice === 'oauth' ? 'sync.needsBrowser' : 'sync.needsChoice';
  let labelKey = `sync.state.${state}`;
  let labelParams: Record<string, number> | undefined;
  if (enriching && progress) {
    labelKey = 'sync.enriching';
    labelParams = { done: progress.done, total: progress.total };
  } else if (state !== 'running' && status?.startupPending) {
    labelKey = 'sync.state.starting';
  } else if (state !== 'running' && blocked === 'noToken') {
    labelKey = 'sync.state.needsToken';
  }
  // The library was read from another address than the one now in Settings: not "up to date", whatever the last run.
  const elsewhere = state !== 'running' && status?.libraryElsewhere === true && blocked !== 'noUrl';
  const warned = (state === 'idle' && (status?.warnings?.length ?? 0) > 0) || elsewhere;
  if (!enriching && state === 'idle' && warned) labelKey = elsewhere ? 'sync.state.elsewhere' : 'sync.state.warned';
  if (elsewhere && state !== 'idle') labelKey = 'sync.state.elsewhere';
  if (elsewhere && hintKey === null) hintKey = 'sync.elsewhereHint';
  // The browser sign-in button helps only when that sign-in would be used: chosen, or nothing chosen yet.
  const browserMayHelp = choice === '' || choice === 'oauth';
  const needsSignIn = browserMayHelp && (blocked === 'noToken'
    || (state === 'error' && (status?.lastError === SIGN_IN_AGAIN || status?.lastError === NEEDS_SIGN_IN)));
  return { state, labelKey, labelParams, fraction, blocked, hintKey, enriching, busy, warned, elsewhere, needsSignIn };
}

/** Clamp what a person typed into the interval field to the range main accepts. */
export function clampInterval(raw: string | number): number {
  const value = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return MIN_INTERVAL_MINUTES;
  return Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, Math.round(value)));
}

/** Which toast, if any, a status change deserves: only the end of a run is news. */
export function syncTransition(previous: SyncState | null, next: SyncState): 'done' | 'failed' | null {
  if (previous !== 'running') return null;
  if (next === 'idle') return 'done';
  if (next === 'error') return 'failed';
  return null;
}

/**
 * The i18n key and values of the summary after a successful run: one sentence of what was read, and, while model
 * files are still read in the background, how far that is. The one model counter is "files read of files in
 * scope" (status.metadata): it is what the background reading works through. The title says "synced", so the
 * sentence never repeats it.
 */
export function syncSummary(status: SyncStatus): { key: string; params: Record<string, number> } {
  const metadata = status.metadata ?? { done: status.counts.enrichedModels, total: status.counts.enrichedModels };
  return summaryKey({
    nodes: status.counts.nodeClasses,
    packs: status.counts.packs,
    models: status.counts.models,
    done: metadata.done,
    total: metadata.total,
  }, isEnriching(status));
}

/** The same summary for Settings ▸ Connection ▸ "Read through MCP", which runs the ordinary sync. */
export function readSummary(outcome: Extract<McpReadOutcome, { ok: true }>): { key: string; params: Record<string, number> } {
  return summaryKey({ nodes: outcome.nodes, packs: outcome.packs, models: outcome.models, done: outcome.done, total: outcome.total }, outcome.continuing);
}

function summaryKey(params: Record<string, number>, continuing: boolean): { key: string; params: Record<string, number> } {
  return { key: continuing && params.done < params.total ? 'sync.toastContinuing' : 'sync.toast', params };
}

export function formatSyncTime(timestamp: number, language: 'en' | 'ru'): string {
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
}

/** Seconds with one decimal under 10 s, whole seconds above. */
export function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  return seconds < 10 ? seconds.toFixed(1) : String(Math.round(seconds));
}
