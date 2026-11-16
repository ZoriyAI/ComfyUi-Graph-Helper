/**
 * The body of Settings > Sync, rendered by SettingsPanel under its section head. It shows the knowledge sync status
 * from knowledgeState and edits the auto-sync draft and the enrichment preferences; the layout classes come in as
 * props so the section looks like the others without importing their stylesheet rules.
 */
import React, { useEffect, useState } from 'react';
import { Pause, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { redactDiagnostic, translateKnownError, type Translator } from '../../../shared/i18n';
import { accessErrorText } from './mcpAccess';
import { ENRICH_PAUSE_MS, ENRICH_PER_RUN, MCP_CALL_TIMEOUT_MS, type Preferences } from '../../../shared/config/preferences';
import { startSyncSubscription, useKnowledgeStore } from '../../state/knowledgeState';
import Button from '../../ui/Button';
import NumberField from '../../ui/NumberField';
import SelectField from '../../ui/SelectField';
import Switch from '../../ui/Switch';
import settingsStyles from './SettingsPanel.module.css';
import { pauseEnrichment, requestSync } from '../sync/SyncIndicator';
import { autoSyncAllowed, type AutoDraft } from './settingsDraft';
import { SYNC_INTERVAL_DEFAULT_MINUTES } from '../../../shared/knowledge/schemas';
import { clampInterval, formatSyncTime, MIN_INTERVAL_MINUTES, syncView } from '../sync/syncView';

/**
 * Settings › Sync: auto-sync and its interval (a draft, applied with Save settings like the rest), the last
 * result, Sync now (an action, at once), and what the enrichment reads per run (preferences, saved with Save).
 */
export default function SyncSection({
  autoDraft,
  onAutoDraft,
  addressSet = true,
  fieldClass,
  hintClass,
  rowClass,
  sync,
  onSyncChange,
  container,
}: {
  /** The draft of auto sync and its interval; null while unchanged. */
  autoDraft?: AutoDraft | null;
  onAutoDraft?: (next: AutoDraft) => void;
  /** An MCP or ComfyUI address is set in the draft: auto sync can only be switched on with one. */
  addressSet?: boolean;
  fieldClass: string;
  hintClass: string;
  rowClass: string;
  sync?: Preferences['sync'];
  onSyncChange?: (patch: Partial<Preferences['sync']>) => void;
  container?: HTMLElement | null;
}) {
  const { t, i18n } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  // Only the date format needs the language; anything not English is shown as Russian, the default language.
  const language = i18n.language === 'en' ? 'en' : 'ru';
  const status = useKnowledgeStore((state) => state.sync);
  const view = syncView(status);
  const [interval, setIntervalDraft] = useState(String(status?.auto.intervalMinutes ?? SYNC_INTERVAL_DEFAULT_MINUTES));
  const [note, setNote] = useState('');
  // The interval field changed what was typed (out of range, not a step): say so, do not swap it silently.
  const [clampNote, setClampNote] = useState('');
  const auto: AutoDraft = autoDraft ?? status?.auto ?? { enabled: false, intervalMinutes: SYNC_INTERVAL_DEFAULT_MINUTES };

  // Idempotent: makes sure the status above is live even if nothing else subscribed yet.
  useEffect(() => {
    startSyncSubscription();
  }, []);

  // A new stored or drafted interval (a save, Cancel) replaces what is in the field.
  useEffect(() => {
    setIntervalDraft(String(auto.intervalMinutes));
  }, [auto.intervalMinutes]);

  const syncNow = async () => {
    setNote('');
    if ((await requestSync()) === 'busy') {
      setNote(String(t('sync.busy', { done: status?.progress?.done ?? 0, total: status?.progress?.total ?? 0 })));
    }
  };

  const applyAuto = (enabled: boolean, minutes: number) => {
    onAutoDraft?.({ enabled, intervalMinutes: minutes });
  };

  return (
    <>
      <p className={hintClass} role="status">
        {t(view.labelKey, view.labelParams ?? {})}
        {/* Before the first sync the counts are only the built-in seed nodes and the sentence would read
            "Last sync Not synced yet"; say "Not synced yet" alone. */}
        {status && status.lastSyncAt ? ` · ${String(t('sync.summary', {
          nodes: status.counts.nodeClasses,
          packs: status.counts.packs,
          models: status.counts.models,
          enriched: status.counts.enrichedModels,
          time: formatSyncTime(status.lastSyncAt, language),
        }))}` : status ? ` · ${String(t('settings.syncNever'))}` : ''}
      </p>
      {view.warned ? (status?.warnings ?? []).map((warning) => (
        <p key={warning} className={hintClass}>{t('sync.warning', { warning: translateKnownError(translate, warning) ?? redactDiagnostic(warning) })}</p>
      )) : null}
      {status?.enrichmentPaused && status.metadata ? <p className={hintClass}>{t('sync.paused', { done: status.metadata.done, total: status.metadata.total })}</p> : null}
      {status?.lastError && view.state === 'error' ? <p className={hintClass}>{t('sync.lastError', { error: accessErrorText(status.lastError, status, translate) })}</p> : null}
      {view.hintKey ? <p className={hintClass}>{t(view.hintKey)}</p> : null}
      <Switch
        label={t('sync.auto')}
        checked={auto.enabled}
        // Without an address it can still be switched off, never on.
        disabled={!status || (!addressSet && !auto.enabled)}
        onCheckedChange={(enabled) => applyAuto(enabled && autoSyncAllowed(addressSet, enabled), clampInterval(interval))}
      />
      {!addressSet ? <p className={hintClass}>{t('sync.autoNeedsUrl')}</p> : null}
      <label className={fieldClass}>
        {t('settings.syncInterval')}
        <input
          className={settingsStyles.shortInput}
          type="number"
          min={MIN_INTERVAL_MINUTES}
          step={5}
          aria-label={String(t('settings.syncInterval'))}
          value={interval}
          disabled={!status}
          onChange={(event) => setIntervalDraft(event.target.value)}
          onBlur={() => {
            const next = clampInterval(interval);
            setClampNote(String(next) !== interval.trim() ? String(t('settings.intervalClamped', { minutes: next })) : '');
            setIntervalDraft(String(next));
            if (next !== auto.intervalMinutes) applyAuto(auto.enabled, next);
          }}
        />
      </label>
      {clampNote ? <p className={hintClass} role="status">{clampNote}</p> : null}
      <p className={hintClass}>{t('sync.intervalHint')}</p>
      <div className={rowClass}>
        <Button size="sm" variant="subtle" icon={<RefreshCw size={14} />} loading={view.state === 'running'} onClick={() => void syncNow()}>
          {t('sync.now')}
        </Button>
        {view.enriching ? (
          <Button size="sm" variant="subtle" icon={<Pause size={14} />} onClick={() => void pauseEnrichment()}>
            {t('sync.pause')}
          </Button>
        ) : null}
      </div>
      {note ? <p className={hintClass} role="status">{note}</p> : null}
      {/* What could not be read, why, and what to do (the report a run ends with). */}

      {sync && onSyncChange ? (
        <>
          <SelectField
            label={String(t('preferences.enrichmentScope'))}
            value={sync.enrichmentScope}
            options={[
              { value: 'loaders', label: String(t('preferences.scopeLoaders')) },
              { value: 'all', label: String(t('preferences.scopeAll')) },
            ]}
            container={container}
            onChange={(next) => onSyncChange({ enrichmentScope: next as 'loaders' | 'all' })}
          />
          <NumberField
            label={String(t('preferences.enrichPerRun'))}
            value={sync.enrichPerRun}
            min={ENRICH_PER_RUN.min}
            max={ENRICH_PER_RUN.max}
            step={10}
            hint={String(t('preferences.enrichPerRunHint'))}
            decreaseLabel={String(t('preferences.decrease', { label: t('preferences.enrichPerRun') }))}
            increaseLabel={String(t('preferences.increase', { label: t('preferences.enrichPerRun') }))}
            onChange={(next) => onSyncChange({ enrichPerRun: next })}
          />
          <NumberField
            label={String(t('preferences.enrichPause'))}
            value={sync.enrichPauseMs}
            min={ENRICH_PAUSE_MS.min}
            max={ENRICH_PAUSE_MS.max}
            step={ENRICH_PAUSE_MS.step}
            hint={String(t('preferences.enrichPauseHint'))}
            decreaseLabel={String(t('preferences.decrease', { label: t('preferences.enrichPause') }))}
            increaseLabel={String(t('preferences.increase', { label: t('preferences.enrichPause') }))}
            onChange={(next) => onSyncChange({ enrichPauseMs: next })}
          />
          <p className={hintClass}>{t('preferences.callTimeout', { seconds: MCP_CALL_TIMEOUT_MS / 1000 })}</p>
        </>
      ) : null}
    </>
  );
}
