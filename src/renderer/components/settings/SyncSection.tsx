import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { startSyncSubscription, useKnowledgeStore } from '../../state/knowledgeState';
import Button from '../../ui/Button';
import Switch from '../../ui/Switch';
import { runSyncNow, setAutoSync } from '../sync/SyncIndicator';
import { clampInterval, formatSyncTime, MIN_INTERVAL_MINUTES, syncView } from '../sync/syncView';

/** Settings › Sync: auto-sync, interval, last result, Sync now. Applies at once; Save is not needed. */
export default function SyncSection({ fieldClass, hintClass, rowClass }: { fieldClass: string; hintClass: string; rowClass: string }) {
  const { t, i18n } = useTranslation();
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
      <p className={hintClass}>{t('settings.syncLead')}</p>
      <p className={hintClass} role="status">
        {t(view.labelKey)}
        {status ? ` · ${String(t('sync.summary', {
          nodes: status.counts.nodeClasses,
          packs: status.counts.packs,
          models: status.counts.models,
          enriched: status.counts.enrichedModels,
          time: status.lastSyncAt ? formatSyncTime(status.lastSyncAt, language) : String(t('settings.syncNever')),
        }))}` : ''}
      </p>
      {status?.lastError && view.state === 'error' ? <p className={hintClass}>{t('sync.lastError', { error: status.lastError })}</p> : null}
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
    </>
  );
}
