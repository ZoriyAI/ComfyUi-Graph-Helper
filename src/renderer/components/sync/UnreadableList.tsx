/**
 * Settings ▸ Sync ▸ "Could not be read": the report of the last syncs. One summary line (files read of files in
 * scope, how many could not be read, how many are skipped), then one row per thing that could not be read: what
 * it is, why, what to do, and for a model file "Try again now" and the switch "Skip this file". Under the list,
 * "Try all again" and "Copy report". Collapsed to the first rows when long. Rendered by settings/SyncSection.tsx;
 * the end-of-sync toast opens Settings at this section.
 * Why: a broken file must not hide behind "not synchronized": the person sees which file, why, and what to do.
 */
import React, { useState } from 'react';
import { ClipboardCopy, RefreshCw, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SyncStatus, UnreadableItem } from '../../../shared/contracts';
import type { Translator } from '../../../shared/i18n';
import { useKnowledgeStore } from '../../state/knowledgeState';
import Button from '../../ui/Button';
import Switch from '../../ui/Switch';
import { markHandRun } from './SyncIndicator';
import { reportText, rowLabel, rowTodo, rowWhy } from './unreadReport';
import styles from './UnreadableList.module.css';

/** Rows shown before "Show all". */
const COLLAPSED_ROWS = 5;

/** The summary line: files read of files in scope; could not be read; skipped. */
export function unreadSummary(status: SyncStatus, t: Translator): string {
  const rows = (status.unreadable ?? []).filter((row) => row.kind === 'model');
  const skipped = rows.filter((row) => row.skipped).length;
  return t('sync.unread.summary', {
    done: status.metadata?.done ?? 0,
    total: status.metadata?.total ?? 0,
    failed: rows.length - skipped,
    skipped,
  });
}

/** The report section; renders nothing while everything was read. */
export default function UnreadableList({ status }: { status: SyncStatus | null }) {
  const { t, i18n } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const language = i18n.language === 'en' ? 'en' : 'ru';
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const rows = status?.unreadable ?? [];
  if (!status || rows.length === 0) return null;
  const summary = unreadSummary(status, translate);
  const shown = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);
  const keyOf = (row: UnreadableItem) => `${row.kind}:${row.directory ?? ''}/${row.name}`;

  const retry = async (row: UnreadableItem) => {
    setNote('');
    setWorking(keyOf(row));
    try {
      const result = await window.electronAPI.syncRetryItem({ directory: row.directory ?? '', name: row.name });
      useKnowledgeStore.getState().setSync(result.status);
      const key = result.outcome === 'read' ? 'sync.unread.readNow'
        : result.outcome === 'busy' ? 'sync.unread.busy'
          : result.outcome === 'unavailable' ? 'sync.unread.unavailable'
            : result.outcome === 'cancelled' ? 'sync.unread.cancelled' : 'sync.unread.failedAgain';
      setNote(String(t(key, { name: row.name })));
    } catch {
      setNote(String(t('sync.unread.failedAgain', { name: row.name })));
    } finally {
      setWorking(null);
    }
  };

  const skip = async (row: UnreadableItem, value: boolean) => {
    try {
      useKnowledgeStore.getState().setSync(await window.electronAPI.syncSkipItem({ directory: row.directory ?? '', name: row.name, skip: value }));
    } catch {
      // The next pushed status shows what is stored.
    }
  };

  const retryAll = async () => {
    setNote('');
    markHandRun();
    try {
      useKnowledgeStore.getState().setSync(await window.electronAPI.syncRetryAll());
    } catch {
      // The run's end is pushed like any other.
    }
  };

  const copy = () => {
    const text = reportText(rows, summary, translate, language);
    void navigator.clipboard?.writeText(text).then(() => setNote(String(t('sync.unread.copied'))), () => undefined);
  };

  return (
    <section className={styles.section} aria-label={String(t('sync.unread.title'))} data-testid="sync-unreadable">
      <h3 className={styles.title}>{t('sync.unread.title')}</h3>
      <p className={styles.note} role="status">{summary}</p>
      <p className={styles.note}>{t('sync.unread.intro')}</p>
      <ul className={styles.list}>
        {shown.map((row) => (
          <li key={keyOf(row)} className={styles.row} data-unread-kind={row.kind} data-unread-reason={row.reason}>
            <p className={styles.name}>{rowLabel(row, translate)}</p>
            <p className={styles.why}>{rowWhy(row, translate)}</p>
            <p className={styles.todo}>{rowTodo(row, translate, language)}</p>
            {row.kind === 'model' ? (
              <div className={styles.rowActions}>
                {!row.skipped ? (
                  <Button size="sm" variant="subtle" icon={<RotateCcw size={14} />} loading={working === keyOf(row)}
                    aria-label={`${String(t('sync.unread.retry'))}: ${row.name}`} onClick={() => void retry(row)}>
                    {t('sync.unread.retry')}
                  </Button>
                ) : null}
                <Switch label={t('sync.unread.skip')} checked={row.skipped} aria-label={`${String(t('sync.unread.skip'))}: ${row.name}`}
                  onCheckedChange={(value) => void skip(row, value)} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {rows.length > COLLAPSED_ROWS ? (
        <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          {expanded ? t('sync.unread.showFewer') : t('sync.unread.showAll', { count: rows.length })}
        </Button>
      ) : null}
      <div className={styles.actions}>
        <Button size="sm" variant="subtle" icon={<RefreshCw size={14} />} onClick={() => void retryAll()}>{t('sync.unread.retryAll')}</Button>
        <Button size="sm" variant="subtle" icon={<ClipboardCopy size={14} />} onClick={copy}>{t('sync.unread.copy')}</Button>
      </div>
      {note ? <p className={styles.note} role="status">{note}</p> : null}
    </section>
  );
}
