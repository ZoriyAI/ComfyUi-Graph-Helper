/**
 * The catalog sync chip of the menu bar (shell/MenuBar.tsx) and the sync actions the rest of the app shares:
 * requestSync, runSyncNow, setAutoSync and pauseEnrichment, called from the library empty states, the menu
 * commands, settings and onboarding. The chip turns the end of each run into one toast.
 */
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
  clampInterval, formatDuration, formatSyncTime, isEnriching, MIN_INTERVAL_MINUTES, sourceSentence, syncSummary, syncTransition, syncView, unreadCount, type SyncState,
} from './syncView';
import styles from './SyncIndicator.module.css';
import { SYNC_INTERVAL_DEFAULT_MINUTES } from '../../../shared/knowledge/schemas';
import { explainError, redactDiagnostic, translateKnownError, type Translator } from '../../../shared/i18n';
import { accessErrorText } from '../settings/mcpAccess';
import { i18n as appI18n } from '../../i18n';
import { useUiStore } from '../../state/uiState';

/**
 * A run the person started (Sync now, Try all again) is waiting for its end: only such a run ends with a toast.
 * A run on the timer or at startup shows its result as the mark on the chip, without a toast.
 */
let handRunPending = false;

/** Marks the next run end as one the person asked for (Settings ▸ Sync ▸ "Try all again" uses it too). */
export function markHandRun(): void {
  handRunPending = true;
}

/**
 * Asks main for a run. While model metadata is still being read in the background, main ignores the request;
 * the caller gets 'busy' and shows the hint.
 */
export async function requestSync(): Promise<'started' | 'busy' | 'noUrl'> {
  if (isEnriching(useKnowledgeStore.getState().sync)) return 'busy';
  markHandRun();
  try {
    const status = await window.electronAPI.syncNow();
    useKnowledgeStore.getState().setSync(status);
    // Main does not run without an address: nothing failed, the address is simply not set yet.
    if (status.mcpUrl.trim() === '' && (status.comfyOrigin ?? '').trim() === '') return 'noUrl';
  } catch {
    // Main pushes the error state through onSyncEvent; nothing else to do here.
  }
  return 'started';
}

/** Starts or refreshes a sync. Shared by the indicator, the library empty states, the menu and settings. */
export async function runSyncNow(): Promise<void> {
  const outcome = await requestSync();
  if (outcome === 'noUrl') {
    showToast({
      id: 'sync-result',
      tone: 'info',
      title: String(appI18n.t('sync.noUrlTitle')),
      description: String(appI18n.t('sync.noUrl')),
      action: { label: String(appI18n.t('canvas.onboardOpenConnection')), onSelect: () => useUiStore.getState().openSettings('connection') },
    });
    return;
  }
  if (outcome === 'busy') {
    const progress = useKnowledgeStore.getState().sync?.progress;
    showToast({
      id: 'sync-busy',
      tone: 'info',
      title: String(appI18n.t('sync.enriching', { done: progress?.done ?? 0, total: progress?.total ?? 0 })),
      description: String(appI18n.t('sync.busy', { done: progress?.done ?? 0, total: progress?.total ?? 0 })),
    });
  }
}

/** Turns auto-sync on or off with an interval, clamped to the range main accepts. */
export async function setAutoSync(enabled: boolean, intervalMinutes: number): Promise<void> {
  try {
    const status = await window.electronAPI.syncSetAuto(enabled, clampInterval(intervalMinutes));
    useKnowledgeStore.getState().setSync(status);
  } catch {
    // Invalid input is clamped before the call; a failure leaves the shown status as it was.
  }
}

/** Pauses the background reading of model metadata. */
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
 * Menu-bar chip for catalog sync: state, progress ring while running or reading metadata, details in a popover,
 * "Sync now", pause, sign-in and the auto-sync switch. Run endings become one toast per run.
 */
export default function SyncIndicator() {
  const { t, i18n } = useTranslation();
  /** Main stores fixed English sentences; show the catalog wording, or the redacted text when it is not one of them. */
  const errorText = (error: string) => translateKnownError((key, options) => String(t(key, (options ?? {}) as Record<string, string>)), error) ?? redactDiagnostic(error);
  const status = useKnowledgeStore((state) => state.sync);
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  // "Requires sign-in" becomes "paste the token" or "sign in" when the person already chose how to get in.
  // Outside Settings there is no token field "above": the sentence names Settings ▸ Connection.
  const lastErrorText = (error: string) => accessErrorText(error, status, translate, 'elsewhere');
  const view = syncView(status);
  const previous = useRef<SyncState | null>(null);
  const [interval, setIntervalDraft] = useState(String(status?.auto.intervalMinutes ?? SYNC_INTERVAL_DEFAULT_MINUTES));
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
    const byHand = handRunPending;
    handRunPending = false;
    if (!byHand) return;
    // The open popover already shows the result. A toast on top of it would also take the first Escape
    // (Radix closes the newest layer), leaving the popover open. The same holds for any open dialog.
    if (openRef.current || modalOpen()) return;
    if (transition === 'done' && unreadCount(status) > 0) {
      // Some files could not be read: the toast says how many and opens the report.
      showToast({
        id: 'sync-result',
        tone: 'warn',
        title: String(t('sync.unread.toast', { count: unreadCount(status) })),
        action: { label: String(t('sync.unread.toastAction')), onSelect: () => useUiStore.getState().setDialog('sync-problems') },
      });
    } else if (transition === 'done') {
      const summary = syncSummary(status);
      const warnings = status.warnings ?? [];
      const source = sourceSentence(status);
      showToast({
        id: 'sync-result',
        tone: warnings.length > 0 ? 'warn' : 'success',
        title: String(t(warnings.length > 0 ? 'sync.toastWarnings' : 'sync.state.idle')),
        // Whole sentences, each ending with its full stop, read one after the other.
        description: [
          ...(source ? [String(t(source.key, { host: source.host }))] : []),
          String(t(summary.key, summary.params)),
          ...warnings.map((warning) => errorText(warning)),
        ].join(' '),
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
  // The pill has little room: while model files are read it shows the short form, so the counter is never cut.
  const pillLabel = view.enriching && view.labelParams ? String(t('sync.enrichingShort', view.labelParams)) : stateLabel;
  const progress = status?.progress;
  const phaseKey = progress ? `sync.phase.${progress.phase}` : '';
  const phase = progress ? (i18n.exists(phaseKey) ? String(t(phaseKey)) : progress.phase) : '';
  const metadata = status?.metadata;
  const source = sourceSentence(status);

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
          <span className={styles.label} title={stateLabel}>{pillLabel}</span>
        </button>
      </PopoverTrigger>
      {/* Accessibility: a screen reader hears that a read started and how it ended, without the popover open.
          Only the state is said (not the counters), so a long read is not announced file by file. */}
      <span className="sr-only" role="status">{i18n.exists(`sync.state.${view.state}`) && view.state !== 'never' ? String(t(`sync.state.${view.state}`)) : ''}</span>
      <PopoverContent align="end" aria-label={String(t('settings.sync'))}>
        <div className={styles.panel}>
          <div className={styles.head}>
            <RefreshCw size={16} aria-hidden="true" />
            {/* While model metadata is still read, the title says so (not "Up to date" next to a spinning counter). */}
            <p className={styles.title}>{view.enriching && progress
              ? String(t('sync.enriching', { done: progress.done, total: progress.total }))
              : String(t(view.enriching ? 'sync.state.idle' : view.labelKey, view.labelParams ?? {}))}</p>
          </div>
          {progress && view.state === 'running' ? (
            <p className={styles.note} role="status">{t('sync.progress', { phase, done: progress.done, total: progress.total })}</p>
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
          {status?.autoHeld ? <p className={styles.warnNote}>{t('sync.autoHeld')}</p> : null}
          <p className={styles.note}>
            {status?.lastSyncAt ? t('settings.syncLast', { time: formatSyncTime(status.lastSyncAt, language) }) : t('settings.syncNever')}
          </p>
          {/* Where the library came from, in plain words; read from ComfyUI itself, also what that cannot give. */}
          {source ? <p className={styles.note} data-library-source={status?.librarySource ?? undefined}>{t(source.key, { host: source.host })}</p> : null}
          {status?.librarySource === 'comfy' ? <p className={styles.note}>{t('sync.source.comfyLimits')}</p> : null}
          {view.warned ? (status?.warnings ?? []).map((warning) => (
            <p key={warning} className={styles.warnNote}>{t('sync.warning', { warning: errorText(warning) })}</p>
          )) : null}
          {status?.lastError && view.state === 'error' && view.blocked !== 'noToken' ? <p className={styles.errorNote}>{t('sync.lastError', { error: lastErrorText(status.lastError) })}</p> : null}
          {view.hintKey ? <p className={styles.note}>{t(view.hintKey)}</p> : null}
          {note ? <p className={styles.note} role="status">{note}</p> : null}
          <div className={styles.auto}>
            <Switch
              label={t('sync.auto')}
              checked={status?.auto.enabled ?? false}
              // Without an address there is nothing to read on a timer; switching off always works.
              disabled={!status || (view.blocked === 'noUrl' && !status.auto.enabled)}
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
            <Button variant="subtle" size="sm" icon={<RefreshCw size={14} />} loading={view.state === 'running'} onClick={() => void syncNow()}>
              {t('sync.now')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}
