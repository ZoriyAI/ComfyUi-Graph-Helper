/** Exact logical usage and a reviewed cleanup; changes to the graph invalidate the preview in main. */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HistoryUsage } from '../../../../shared/contracts/revisions';
import { DESKTOP_PROJECT_ID } from '../../../../shared/project';
import { formatByteSize, formatDateTime } from '../../../../shared/i18n/format';
import { refreshUndoHistory } from '../../../commands/undo';
import Button from '../../../ui/Button';
import { Group, hintClass, rowClass } from './common';
import ConfirmDialog from './ConfirmDialog';

export default function HistoryStorage() {
  const { t, i18n } = useTranslation(); const language = i18n.language === 'ru' ? 'ru' : 'en';
  const [usage, setUsage] = useState<HistoryUsage | null>(null); const [preview, setPreview] = useState<HistoryUsage | null>(null);
  const [busy, setBusy] = useState(false); const [note, setNote] = useState(''); const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true); setNote('');
    try { const value = await window.electronAPI.historyUsage(DESKTOP_PROJECT_ID); setUsage(value); return value; }
    catch { setNote(String(t('historyStorage.failed'))); return null; }
    finally { setLoading(false); }
  }, [t]);
  useEffect(() => { void refresh(); }, [refresh]);
  const review = async () => { setBusy(true); const value = await refresh(); if (value) setPreview(value); setBusy(false); };
  const trim = async () => {
    if (!preview) return; setBusy(true);
    try {
      const result = await window.electronAPI.trimHistory({ projectId: DESKTOP_PROJECT_ID, token: preview.trim.token });
      setUsage(result.usage);
      setNote(String(t(result.ok ? 'historyStorage.done' : result.reason === 'changed' ? 'historyStorage.changed' : 'historyStorage.failed', { count: result.removed, size: formatByteSize(result.releasedBytes, language) })));
      await refreshUndoHistory();
    } catch { setNote(String(t('historyStorage.failed'))); await refresh(); }
    finally { setBusy(false); setPreview(null); }
  };
  const date = (value: number | null) => value == null ? '—' : formatDateTime(value, language, { dateStyle: 'medium', timeStyle: 'short' });
  return <section aria-label={String(t('historyStorage.title'))} data-history-storage>
    <Group title={String(t('historyStorage.title'))}>
      {usage ? <>
        <p>{t('historyStorage.size', { size: formatByteSize(usage.snapshotBytes + usage.commandBytes, language), count: usage.revisions })}</p>
        <p className={hintClass}>{t('historyStorage.range', { count: usage.availableRevisions, from: date(usage.oldestAvailableAt), to: date(usage.newestAt) })}</p>
        <p className={hintClass}>{t('historyStorage.policy', { keep: usage.automaticKeep, minimum: usage.minimumKeep, protected: usage.protectedRevisions, size: formatByteSize(usage.softBudgetBytes, language) })}</p>
        <p className={hintClass}>{t('historyStorage.disk')}</p>
      </> : loading ? <p role="status">{t('historyStorage.loading')}</p> : null}
      <div className={rowClass}>
        <Button size="sm" variant="subtle" disabled={busy || loading} onClick={() => void refresh()}>{t('historyStorage.refresh')}</Button>
        <Button size="sm" variant="subtle" loading={busy} disabled={loading || !usage?.trim.count} onClick={() => void review()}>{t('historyStorage.review')}</Button>
      </div>
      {note ? <p role="status" className={hintClass}>{note}</p> : null}
    </Group>
    <ConfirmDialog className="trim-graph-history-dialog" open={preview !== null} onOpenChange={open => { if (!open) setPreview(null); }}
      title={String(t('historyStorage.confirmTitle'))}
      lead={String(t('historyStorage.confirm', { count: preview?.trim.count ?? 0, size: formatByteSize(preview?.trim.bytes ?? 0, language), remaining: preview?.trim.remaining ?? 0, minimum: preview?.minimumKeep ?? 200 }))}
      after={String(t('historyStorage.irreversible'))} confirmLabel={String(t('historyStorage.trim'))} cancelLabel={String(t('preferences.confirmCancel'))} onConfirm={() => void trim()} />
  </section>;
}
