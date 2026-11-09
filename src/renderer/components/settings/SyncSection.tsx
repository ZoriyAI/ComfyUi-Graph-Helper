import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { redactDiagnostic, translateKnownError, type Translator } from '../../../shared/i18n';
import { ENRICH_PER_RUN, type Preferences } from '../../../shared/config/preferences';
import { startSyncSubscription, useKnowledgeStore } from '../../state/knowledgeState';
import Button from '../../ui/Button';
import NumberField from '../../ui/NumberField';
import SelectField from '../../ui/SelectField';
import Switch from '../../ui/Switch';
import { runSyncNow, setAutoSync } from '../sync/SyncIndicator';
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

  const applyAuto = async (enabled: boolean, minutes: number) => {
    await setAutoSync(enabled, minutes);
    setNote(String(t('settings.syncSaved')));
  };

  return (
    <>
      <p className={hintClass} role="status">
        {t(view.labelKey)}
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
        <Button size="sm" variant="subtle" icon={<RefreshCw size={14} />} loading={view.state === 'running'} onClick={() => void runSyncNow()}>
          {t('sync.now')}
        </Button>
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
        </>
      ) : null}
    </>
  );
}
