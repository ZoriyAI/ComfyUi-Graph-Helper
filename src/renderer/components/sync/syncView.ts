import type { SyncStatus } from '../../../shared/contracts';

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
  /** Model metadata is still being read in the background after a successful listing. */
  enriching: boolean;
  /** The ring is shown: a run or background enrichment. */
  busy: boolean;
  /** The last successful run left warnings (ComfyUI offline, a section not read). */
  warned: boolean;
  /** A browser sign-in would fix the current problem. */
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
  const noCredentials = status != null && !status.tokenHeld && !status.signedIn && status.authMode !== 'anonymous';
  const blocked = !status || status.mcpUrl.trim() === '' ? 'noUrl' : noCredentials && status.lastError === NEEDS_SIGN_IN ? 'noToken' : null;
  let labelKey = `sync.state.${state}`;
  let labelParams: Record<string, number> | undefined;
  if (enriching && progress) {
    labelKey = 'sync.enriching';
    labelParams = { done: progress.done, total: progress.total };
  } else if (state !== 'running' && status?.startupPending) {
    labelKey = 'sync.state.starting';
  }
  const warned = state === 'idle' && (status?.warnings?.length ?? 0) > 0;
  const needsSignIn = blocked === 'noToken'
    || (state === 'error' && (status?.lastError === SIGN_IN_AGAIN || status?.lastError === NEEDS_SIGN_IN));
  return { state, labelKey, labelParams, fraction, blocked, enriching, busy, warned, needsSignIn };
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

/** The i18n key and values of the summary toast after a successful run. */
export function syncSummary(status: SyncStatus): { key: string; params: Record<string, number> } {
  const metadata = status.metadata ?? { done: status.counts.enrichedModels, total: status.counts.enrichedModels };
  return {
    key: isEnriching(status) ? 'sync.toastContinuing' : 'sync.toast',
    params: {
      nodes: status.counts.nodeClasses,
      detailed: status.counts.detailedClasses,
      packs: status.counts.packs,
      models: status.counts.models,
      done: metadata.done,
      total: metadata.total,
    },
  };
}

export function formatSyncTime(timestamp: number, language: 'en' | 'ru'): string {
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
}

/** Seconds with one decimal under 10 s, whole seconds above. */
export function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  return seconds < 10 ? seconds.toFixed(1) : String(Math.round(seconds));
}
