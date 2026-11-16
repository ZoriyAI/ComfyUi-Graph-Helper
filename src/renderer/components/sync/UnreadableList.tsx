/**
 * Sync ▸ Problems and repairs: the report of the last syncs. One summary line (files read of files in
 * scope, how many could not be read, how many are skipped), then one row per thing that could not be read: what
 * it is, why, what to do, and for a model file "Try again now" and the switch "Skip this file". Under the list,
 * Retry and copy actions. Collapsed to the first rows when long. Rendered by SyncProblemsDialog;
 * the end-of-sync toast opens this dialog.
 * Why: a broken file must not hide behind "not synchronized": the person sees which file, why, and what to do.
 */
import React, { useRef, useState } from 'react';
import { ClipboardCopy, RefreshCw, RotateCcw, FileSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SyncStatus, UnreadableItem } from '../../../shared/contracts';
import type { Translator } from '../../../shared/i18n';
import { useKnowledgeStore } from '../../state/knowledgeState';
import Button from '../../ui/Button';
import Switch from '../../ui/Switch';
import { markHandRun } from './SyncIndicator';
import { metadataReport } from './syncView';
import { reportText, rowLabel, rowTodo, rowWhy } from './unreadReport';
import { ModelHeaderError, readSelectedModelHeader } from '../../../shared/knowledge/modelHeader';
import styles from './UnreadableList.module.css';

/** Rows shown before "Show all". */
const COLLAPSED_ROWS = 5;

/** The summary line: files read of files in scope; could not be read; skipped. */
export function unreadSummary(status: SyncStatus, t: Translator): string {
  return t('sync.unread.summary', metadataReport(status));
}

/** The report section; renders nothing while everything was read. */
export default function UnreadableList({ status }: { status: SyncStatus | null }) {
  const { t, i18n } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const language = i18n.language === 'en' ? 'en' : 'ru';
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const selected = useRef<{ row: UnreadableItem; catalogRevision: number } | null>(null);
  const rows = status?.unreadable ?? [];
  if (!status) return null;
  const busy = working !== null || status.state === 'running' || status.progress?.phase === 'enrichment';
  const summary = unreadSummary(status, translate);
  const counts = metadataReport(status);
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

  const readFile = async (file: File) => {
    const target = selected.current;
    if (!target) return;
    const { row, catalogRevision } = target;
    setWorking(keyOf(row)); setNote('');
    try {
      const header = await readSelectedModelHeader(file, row.name);
      const result = await window.electronAPI.syncImportHeader({ directory: row.directory ?? '', name: row.name, catalogRevision, ...header });
      useKnowledgeStore.getState().setSync(result.status);
      setNote(String(t(`sync.repair.result.${result.outcome}`, { name: row.name })));
    } catch (error) {
      setNote(String(t(`sync.repair.fileError.${error instanceof ModelHeaderError ? error.code : 'readFailed'}`)));
    } finally { setWorking(null); selected.current = null; }
  };

  const copy = () => {
    const text = reportText(rows, summary, translate, language);
    void navigator.clipboard?.writeText(text).then(() => setNote(String(t('sync.unread.copied'))), () => undefined);
  };

  return (
    <section className={styles.section} aria-label={String(t('sync.unread.title'))} data-testid="sync-unreadable">
      <input ref={picker} type="file" accept=".safetensors,.sft" hidden aria-label={String(t('sync.repair.selectFile'))}
        onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void readFile(file); }} />
      <h3 className={styles.title}>{t('sync.unread.title')}</h3>
      <p className={styles.note} role="status">{summary}</p>
      {counts.pending > 0 ? <p className={styles.note} role="status">{t(busy ? 'sync.unread.pendingBusy' : status.enrichmentPaused ? 'sync.unread.pendingPaused' : 'sync.unread.pendingStopped', { count: counts.pending })}</p> : null}
      {rows.length ? <p className={styles.note}>{t('sync.unread.intro')}</p> : null}
      <ul className={styles.list}>
        {shown.map((row) => (
          <li key={keyOf(row)} className={styles.row} data-unread-kind={row.kind} data-unread-reason={row.reason}>
            <p className={styles.name}>{rowLabel(row, translate)}</p>
            <p className={styles.why}>{rowWhy(row, translate)}</p>
            <p className={styles.todo}>{rowTodo(row, translate, language)}</p>
            {row.skipped ? <p className={styles.todo}>{t('sync.unread.todo.skipped')}</p> : null}
            {row.kind === 'model' ? (
              <div className={styles.rowActions}>
                <Button size="sm" variant="subtle" icon={<RotateCcw size={14} />} disabled={busy} loading={working === keyOf(row)}
                    aria-label={`${String(t('sync.unread.retry'))}: ${row.name}`} onClick={() => void retry(row)}>
                    {t('sync.unread.retry')}
                  </Button>
                {/\.(safetensors|sft)$/i.test(row.name) ? <Button size="sm" variant="subtle" icon={<FileSearch size={14} />} disabled={busy}
                  onClick={() => { selected.current = { row, catalogRevision: status.catalogRevision ?? 0 }; picker.current?.click(); }}>
                  {t('sync.repair.readFile')}
                </Button> : null}
                <Switch disabled={busy} label={t('sync.unread.skip')} checked={row.skipped} aria-label={`${String(t('sync.unread.skip'))}: ${row.name}`}
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
      {rows.length || counts.pending > 0 ? <div className={styles.actions}>
        <Button size="sm" variant="subtle" disabled={busy} icon={<RefreshCw size={14} />} onClick={() => void retryAll()}>{t('sync.unread.retryAll')}</Button>
        <Button size="sm" variant="subtle" icon={<ClipboardCopy size={14} />} onClick={copy}>{t('sync.unread.copy')}</Button>
      </div> : null}
      {note ? <p className={styles.note} role="status">{note}</p> : null}
    </section>
  );
}
