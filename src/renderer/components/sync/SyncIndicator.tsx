import React, { useEffect, useRef, useState } from 'react';
import { Pause, RefreshCw, LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { refreshSyncStatus, startSyncSubscription, useKnowledgeStore } from '../../state/knowledgeState';
import Button from '../../ui/Button';
import ProgressRing from '../../ui/ProgressRing';
import Switch from '../../ui/Switch';
import { PopoverContent, PopoverRoot, PopoverTrigger } from '../../ui/Popover';
import { showToast } from '../../ui/toastStore';
import { cx } from '../../ui/cx';
import {
  clampInterval, formatDuration, formatSyncTime, isEnriching, MIN_INTERVAL_MINUTES, syncSummary, syncTransition, syncView, type SyncState,
} from './syncView';
import styles from './SyncIndicator.module.css';
import { explainError, redactDiagnostic, translateKnownError, type Translator } from '../../../shared/i18n';
import { accessErrorText } from '../settings/mcpAccess';
import { i18n as appI18n } from '../../i18n';

/**
 * Asks main for a run. While model metadata is still being read in the background, main ignores the request;
 * the caller gets 'busy' and shows the hint.
 */
export async function requestSync(): Promise<'started' | 'busy'> {
  if (isEnriching(useKnowledgeStore.getState().sync)) return 'busy';
  try {
    const status = await window.electronAPI.syncNow();
    useKnowledgeStore.getState().setSync(status);
  } catch {
    // Main pushes the error state through onSyncEvent; nothing else to do here.
  }
  return 'started';
}

/** Starts or refreshes a sync. Shared by the indicator, the library empty states, the menu and settings. */
export async function runSyncNow(): Promise<void> {
  if ((await requestSync()) === 'busy') {
    const progress = useKnowledgeStore.getState().sync?.progress;
    showToast({
      id: 'sync-busy',
      tone: 'info',
      title: String(appI18n.t('sync.enriching', { done: progress?.done ?? 0, total: progress?.total ?? 0 })),
      description: String(appI18n.t('sync.busy', { done: progress?.done ?? 0, total: progress?.total ?? 0 })),
    });
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

export async function pauseEnrichment(): Promise<void> {
  try {
    const status = await window.electronAPI.syncPauseEnrichment();
    useKnowledgeStore.getState().setSync(status);
  } catch {
    // The next pushed status shows what happened.
  }
}

/** A modal dialog is open (settings, export…): a toast would land on top of it. */
function modalOpen(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[role="dialog"][aria-modal="true"]') != null;
}

/**
 * App-bar chip for catalog sync: state, progress ring while running or reading metadata, details in a popover,
 * "Sync now", pause, sign-in and the auto-sync switch. Run endings become one toast per run.
 */
export default function SyncIndicator() {
  const { t, i18n } = useTranslation();
  /** Main stores fixed English sentences; show the catalog wording, or the redacted text when it is not one of them. */
  const errorText = (error: string) => translateKnownError((key, options) => String(t(key, (options ?? {}) as Record<string, string>)), error) ?? redactDiagnostic(error);
  const status = useKnowledgeStore((state) => state.sync);
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  // "Requires sign-in" becomes "paste the token" or "sign in" when the person already chose how to get in.
  const lastErrorText = (error: string) => accessErrorText(error, status, translate);
  const view = syncView(status);
  const previous = useRef<SyncState | null>(null);
  const [interval, setIntervalDraft] = useState(String(MIN_INTERVAL_MINUTES));
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const openRef = useRef(false);
  openRef.current = open;
  const language = i18n.language === 'en' ? 'en' : 'ru';

  useEffect(() => {
    startSyncSubscription();
  }, []);

  useEffect(() => {
    if (status) setIntervalDraft(String(status.auto.intervalMinutes));
  }, [status?.auto.intervalMinutes]);

  useEffect(() => {
    if (!view.enriching) setNote('');
  }, [view.enriching]);

  useEffect(() => {
    const transition = syncTransition(previous.current, view.state);
    previous.current = view.state;
    if (!status || !transition) return;
    // The open popover already shows the result. A toast on top of it would also take the first Escape
    // (Radix closes the newest layer), leaving the popover open. The same holds for any open dialog.
    if (openRef.current || modalOpen()) return;
    if (transition === 'done') {
      const summary = syncSummary(status);
      const warnings = status.warnings ?? [];
      showToast({
        id: 'sync-result',
        tone: warnings.length > 0 ? 'warn' : 'success',
        title: String(t(warnings.length > 0 ? 'sync.toastWarnings' : 'sync.state.idle')),
        description: [String(t(summary.key, summary.params)), ...warnings.map((warning) => errorText(warning))].join('\n'),
      });
    } else {
      showToast({
        id: 'sync-result',
        tone: 'error',
        title: String(t('sync.state.error')),
        description: status.lastError ? String(t('sync.lastError', { error: lastErrorText(status.lastError) })) : null,
      });
    }
  }, [view.state]);

  const stateLabel = String(t(view.labelKey, view.labelParams ?? {}));
  const progress = status?.progress;
  const phaseKey = progress ? `sync.phase.${progress.phase}` : '';
  const phase = progress ? (i18n.exists(phaseKey) ? String(t(phaseKey)) : progress.phase) : '';
  const metadata = status?.metadata;

  const syncNow = async () => {
    setNote('');
    if ((await requestSync()) === 'busy') {
      setNote(String(t('sync.busy', { done: progress?.done ?? 0, total: progress?.total ?? 0 })));
    }
  };

  const signIn = async () => {
    setNote('');
    setSigningIn(true);
    try {
      const result = await window.electronAPI.mcpOAuthLogin();
      if (!result.ok) {
        setNote(explainError((key, options) => String(t(key, (options ?? {}) as Record<string, string>)), result.error).summary);
      }
    } catch {
      setNote(String(t('sync.signInFailed')));
    } finally {
      setSigningIn(false);
      refreshSyncStatus();
    }
  };

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cx(styles.trigger, styles[view.state], view.busy && styles.running, view.warned && styles.warned, 'sync-indicator')}
          data-sync-state={view.state}
          data-sync-enriching={view.enriching ? 'true' : undefined}
          aria-label={stateLabel}
        >
          {view.busy
            ? <ProgressRing value={view.fraction} size={14} label={stateLabel} />
            : <span className={styles.dot} aria-hidden="true" />}
          <span className={styles.label}>{stateLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label={String(t('settings.sync'))}>
        <div className={styles.panel}>
          <div className={styles.head}>
            <RefreshCw size={16} aria-hidden="true" />
            <p className={styles.title}>{String(t(view.enriching ? 'sync.state.idle' : view.labelKey, view.labelParams ?? {}))}</p>
          </div>
          {progress && view.state === 'running' ? (
            <p className={styles.note} role="status">{t('sync.progress', { phase, done: progress.done, total: progress.total })}</p>
          ) : null}
          {view.enriching && progress ? (
            <p className={styles.note} role="status">{t('sync.enriching', { done: progress.done, total: progress.total })}</p>
          ) : null}
          {status?.enrichmentPaused && metadata ? (
            <p className={styles.note}>{t('sync.paused', { done: metadata.done, total: metadata.total })}</p>
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
            {metadata ? (
              <>
                <dt>{t('sync.metadata')}</dt>
                <dd>{`${metadata.done} / ${metadata.total}`}</dd>
              </>
            ) : null}
          </dl>
          <dl className={styles.counts}>
            <dt>{t('sync.lastRun')}</dt>
            <dd>{status?.lastRunAt ? formatSyncTime(status.lastRunAt, language) : '—'}</dd>
            <dt>{t('sync.duration')}</dt>
            <dd>{status?.lastRunDurationMs != null ? t('sync.seconds', { seconds: formatDuration(status.lastRunDurationMs) }) : '—'}</dd>
            <dt>{t('sync.nextRun')}</dt>
            <dd>{status?.nextRunAt ? formatSyncTime(status.nextRunAt, language) : t('sync.nextRunOff')}</dd>
          </dl>
          <p className={styles.note}>
            {status?.lastSyncAt ? t('settings.syncLast', { time: formatSyncTime(status.lastSyncAt, language) }) : t('settings.syncNever')}
          </p>
          {view.warned ? (status?.warnings ?? []).map((warning) => (
            <p key={warning} className={styles.warnNote}>{t('sync.warning', { warning: errorText(warning) })}</p>
          )) : null}
          {status?.lastError && view.state === 'error' ? <p className={styles.errorNote}>{t('sync.lastError', { error: lastErrorText(status.lastError) })}</p> : null}
          {view.hintKey ? <p className={styles.note}>{t(view.hintKey)}</p> : null}
          {note ? <p className={styles.note} role="status">{note}</p> : null}
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
            {view.needsSignIn && view.blocked !== 'noUrl' ? (
              <Button variant="subtle" size="sm" icon={<LogIn size={14} />} loading={signingIn} onClick={() => void signIn()}>
                {t('sync.signIn')}
              </Button>
            ) : null}
            {view.enriching ? (
              <Button variant="subtle" size="sm" icon={<Pause size={14} />} onClick={() => void pauseEnrichment()}>
                {t('sync.pause')}
              </Button>
            ) : null}
            <Button variant="primary" size="sm" icon={<RefreshCw size={14} />} loading={view.state === 'running'} onClick={() => void syncNow()}>
              {t('sync.now')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}
