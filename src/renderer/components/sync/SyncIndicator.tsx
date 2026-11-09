import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { startSyncSubscription, useKnowledgeStore } from '../../state/knowledgeState';
import Button from '../../ui/Button';
import ProgressRing from '../../ui/ProgressRing';
import Switch from '../../ui/Switch';
import { PopoverContent, PopoverRoot, PopoverTrigger } from '../../ui/Popover';
import { showToast } from '../../ui/toastStore';
import { cx } from '../../ui/cx';
import { clampInterval, formatSyncTime, MIN_INTERVAL_MINUTES, syncTransition, syncView, type SyncState } from './syncView';
import styles from './SyncIndicator.module.css';
import { redactDiagnostic, translateKnownError } from '../../../shared/i18n';

/** Starts or refreshes a sync. Shared by the indicator, the library empty states and settings. */
export async function runSyncNow(): Promise<void> {
  try {
    const status = await window.electronAPI.syncNow();
    useKnowledgeStore.getState().setSync(status);
  } catch {
    // Main pushes the error state through onSyncEvent; nothing else to do here.
  }
}

export async function setAutoSync(enabled: boolean, intervalMinutes: number): Promise<void> {
  try {
    const status = await window.electronAPI.syncSetAuto(enabled, clampInterval(intervalMinutes));
    useKnowledgeStore.getState().setSync(status);
  } catch {
    // Invalid input is clamped before the call; a failure leaves the shown status as it was.
  }
}

/**
 * App-bar chip for catalog sync: state, progress ring while running, counts in a popover,
 * "Sync now" and the auto-sync switch. Run endings become toasts.
 */
export default function SyncIndicator() {
  const { t, i18n } = useTranslation();
  /** Main stores fixed English sentences; show the catalog wording, or the redacted text when it is not one of them. */
  const errorText = (error: string) => translateKnownError((key, options) => String(t(key, (options ?? {}) as Record<string, string>)), error) ?? redactDiagnostic(error);
  const status = useKnowledgeStore((state) => state.sync);
  const view = syncView(status);
  const previous = useRef<SyncState | null>(null);
  const [interval, setIntervalDraft] = useState(String(MIN_INTERVAL_MINUTES));
  const language = i18n.language === 'en' ? 'en' : 'ru';

  useEffect(() => {
    startSyncSubscription();
  }, []);

  useEffect(() => {
    if (status) setIntervalDraft(String(status.auto.intervalMinutes));
  }, [status?.auto.intervalMinutes]);

  useEffect(() => {
    const transition = syncTransition(previous.current, view.state);
    previous.current = view.state;
    if (!status || !transition) return;
    if (transition === 'done') {
      showToast({
        id: 'sync-result',
        tone: 'success',
        title: String(t('sync.state.idle')),
        description: String(t('sync.summary', {
          nodes: status.counts.nodeClasses,
          packs: status.counts.packs,
          models: status.counts.models,
          enriched: status.counts.enrichedModels,
          time: status.lastSyncAt ? formatSyncTime(status.lastSyncAt, language) : '—',
        })),
      });
    } else {
      showToast({
        id: 'sync-result',
        tone: 'error',
        title: String(t('sync.state.error')),
        description: status.lastError ? String(t('sync.lastError', { error: errorText(status.lastError) })) : null,
      });
    }
  }, [view.state]);

  const stateLabel = String(t(view.labelKey));
  const progress = status?.progress;
  const phaseKey = progress ? `sync.phase.${progress.phase}` : '';
  const phase = progress ? (i18n.exists(phaseKey) ? String(t(phaseKey)) : progress.phase) : '';

  return (
    <PopoverRoot>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cx(styles.trigger, styles[view.state], 'sync-indicator')}
          data-sync-state={view.state}
          aria-label={stateLabel}
        >
          {view.state === 'running'
            ? <ProgressRing value={view.fraction} size={14} label={stateLabel} />
            : <span className={styles.dot} aria-hidden="true" />}
          <span className={styles.label}>{stateLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label={String(t('settings.sync'))}>
        <div className={styles.panel}>
          <div className={styles.head}>
            <RefreshCw size={16} aria-hidden="true" />
            <p className={styles.title}>{stateLabel}</p>
          </div>
          {progress && view.state === 'running' ? (
            <p className={styles.note} role="status">{t('sync.progress', { phase, done: progress.done, total: progress.total })}</p>
          ) : null}
          <dl className={styles.counts}>
            <dt>{t('library.nodes')}</dt>
            <dd>{status?.counts.nodeClasses ?? 0}</dd>
            <dt>{t('library.detailedCount')}</dt>
            <dd>{status?.counts.detailedClasses ?? 0}</dd>
            <dt>{t('library.packs')}</dt>
            <dd>{status?.counts.packs ?? 0}</dd>
            <dt>{t('library.models')}</dt>
            <dd>{status?.counts.models ?? 0}</dd>
            <dt>{t('library.enrichedCount')}</dt>
            <dd>{status?.counts.enrichedModels ?? 0}</dd>
          </dl>
          <p className={styles.note}>
            {status?.lastSyncAt ? t('settings.syncLast', { time: formatSyncTime(status.lastSyncAt, language) }) : t('settings.syncNever')}
          </p>
          {status?.lastError && view.state === 'error' ? <p className={styles.errorNote}>{t('sync.lastError', { error: errorText(status.lastError) })}</p> : null}
          {view.blocked ? <p className={styles.note}>{t(view.blocked === 'noUrl' ? 'sync.noUrl' : 'sync.noToken')}</p> : null}
          <div className={styles.auto}>
            <Switch
              label={t('sync.auto')}
              checked={status?.auto.enabled ?? false}
              disabled={!status}
              onCheckedChange={(enabled) => void setAutoSync(enabled, clampInterval(interval))}
            />
            <label className={styles.interval}>
              {t('settings.syncInterval')}
              <input
                type="number"
                min={MIN_INTERVAL_MINUTES}
                step={5}
                value={interval}
                disabled={!status}
                onChange={(event) => setIntervalDraft(event.target.value)}
                onBlur={() => {
                  const next = clampInterval(interval);
                  setIntervalDraft(String(next));
                  if (status && next !== status.auto.intervalMinutes) void setAutoSync(status.auto.enabled, next);
                }}
              />
            </label>
            <p className={styles.note}>{t('sync.intervalHint')}</p>
          </div>
          <div className={styles.actions}>
            <Button variant="primary" size="sm" icon={<RefreshCw size={14} />} loading={view.state === 'running'} onClick={() => void runSyncNow()}>
              {t('sync.now')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}
