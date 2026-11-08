import type { SyncStatus } from '../../../shared/contracts';

export type SyncState = SyncStatus['state'];

export interface SyncView {
  state: SyncState;
  /** i18n key of the short state label. */
  labelKey: string;
  /** 0..1 while a phase with a known total runs; null when indeterminate or idle. */
  fraction: number | null;
  /** True when the server address or the token is missing, so "Sync now" would fail. */
  blocked: 'noUrl' | 'noToken' | null;
}

export const MIN_INTERVAL_MINUTES = 5;
export const MAX_INTERVAL_MINUTES = 1440;

export function syncView(status: SyncStatus | null): SyncView {
  const state: SyncState = status?.state ?? 'never';
  const progress = status?.progress ?? null;
  const fraction = state === 'running' && progress && progress.total > 0 ? Math.min(1, progress.done / progress.total) : null;
  const blocked = !status || status.mcpUrl.trim() === '' ? 'noUrl' : !status.tokenHeld ? 'noToken' : null;
  return { state, labelKey: `sync.state.${state}`, fraction, blocked };
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

export function formatSyncTime(timestamp: number, language: 'en' | 'ru'): string {
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
}
