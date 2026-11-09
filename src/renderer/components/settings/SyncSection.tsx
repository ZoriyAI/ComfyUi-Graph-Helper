import React, { useEffect, useState } from 'react';
import { Pause, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { redactDiagnostic, translateKnownError, type Translator } from '../../../shared/i18n';
import { ENRICH_PAUSE_MS, ENRICH_PER_RUN, MCP_CALL_TIMEOUT_MS, type Preferences } from '../../../shared/config/preferences';
import { startSyncSubscription, useKnowledgeStore } from '../../state/knowledgeState';
import Button from '../../ui/Button';
import NumberField from '../../ui/NumberField';
import SelectField from '../../ui/SelectField';
import Switch from '../../ui/Switch';
import { pauseEnrichment, requestSync, setAutoSync } from '../sync/SyncIndicator';
import { clampInterval, formatSyncTime, MIN_INTERVAL_MINUTES, syncView } from '../sync/syncView';

/**
 * Settings › Sync: auto-sync, interval, last result, Sync now (these apply at once), and what the enrichment
 * reads per run (preferences, saved with Save settings).
 */
export default function SyncSection({
  fieldClass,
  hintClass,
  rowClass,
  sync,
  onSyncChange,
  container,
}: {
  fieldClass: string;
  hintClass: string;
  rowClass: string;
  sync?: Preferences['sync'];
  onSyncChange?: (patch: Partial<Preferences['sync']>) => void;
  container?: HTMLElement | null;
}) {
  const { t, i18n } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const language = i18n.language === 'en' ? 'en' : 'ru';
  const status = useKnowledgeStore((state) => state.sync);
  const view = syncView(status);
  const [interval, setIntervalDraft] = useState(String(status?.auto.intervalMinutes ?? MIN_INTERVAL_MINUTES));
  const [note, setNote] = useState('');

  useEffect(() => {
    startSyncSubscription();
  }, []);

  useEffect(() => {
    if (status) setIntervalDraft(String(status.auto.intervalMinutes));
  }, [status?.auto.intervalMinutes]);

  const syncNow = async () => {
    setNote('');
    if ((await requestSync()) === 'busy') {
      setNote(String(t('sync.busy', { done: status?.progress?.done ?? 0, total: status?.progress?.total ?? 0 })));
    }
  };

  const applyAuto = async (enabled: boolean, minutes: number) => {
    await setAutoSync(enabled, minutes);
    setNote(String(t('settings.syncSaved')));
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
      {status?.lastError && view.state === 'error' ? <p className={hintClass}>{t('sync.lastError', { error: translateKnownError(translate, status.lastError) ?? redactDiagnostic(status.lastError) })}</p> : null}
      {view.blocked ? <p className={hintClass}>{t(view.blocked === 'noUrl' ? 'sync.noUrl' : 'sync.noToken')}</p> : null}
      <Switch
        label={t('sync.auto')}
        checked={status?.auto.enabled ?? false}
        disabled={!status}
        onCheckedChange={(enabled) => void applyAuto(enabled, clampInterval(interval))}
      />
      <label className={fieldClass}>
        {t('settings.syncInterval')}
        <input
          type="number"
          min={MIN_INTERVAL_MINUTES}
          step={5}
          aria-label={String(t('settings.syncInterval'))}
          value={interval}
          disabled={!status}
          onChange={(event) => setIntervalDraft(event.target.value)}
          onBlur={() => {
            const next = clampInterval(interval);
            setIntervalDraft(String(next));
            if (status && next !== status.auto.intervalMinutes) void applyAuto(status.auto.enabled, next);
          }}
        />
      </label>
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
