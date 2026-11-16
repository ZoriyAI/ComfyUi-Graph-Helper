/** Maps named synchronization speed and interval choices to the existing bounded preferences. */
import { ENRICH_PAUSE_MS, ENRICH_PER_RUN, type Preferences } from './preferences';

/** Preferences remain the source of truth: old/custom numeric values are never replaced on read. */
export const SYNC_PROFILES = {
  gentle: { enrichPerRun: 10, enrichPauseMs: 3000 },
  balanced: { enrichPerRun: ENRICH_PER_RUN.default, enrichPauseMs: ENRICH_PAUSE_MS.default },
  faster: { enrichPerRun: 100, enrichPauseMs: 250 },
} as const;
export function syncProfileOf(sync: Preferences['sync']): keyof typeof SYNC_PROFILES | 'custom' {
  return (Object.keys(SYNC_PROFILES) as Array<keyof typeof SYNC_PROFILES>).find(key =>
    SYNC_PROFILES[key].enrichPerRun === sync.enrichPerRun && SYNC_PROFILES[key].enrichPauseMs === sync.enrichPauseMs) ?? 'custom';
}
