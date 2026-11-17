/** One place for sync failures, skipped files, recovery actions and completed header repairs. */
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from '../../ui/Dialog';
import Button from '../../ui/Button';
import { startSyncSubscription, useKnowledgeStore } from '../../state/knowledgeState';
import { useUiStore } from '../../state/uiState';
import { redactDiagnostic, translateKnownError, type Translator } from '../../../shared/i18n';
import { metadataReport } from './syncView';
import UnreadableList from './UnreadableList';
import TranslationQueue from './TranslationQueue';
import { pauseEnrichment, requestSync } from './SyncIndicator';
import styles from './SyncProblemsDialog.module.css';

export default function SyncProblemsDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const { t } = useTranslation();
  const status = useKnowledgeStore(state => state.sync);
  useEffect(() => { if (open) startSyncSubscription(); }, [open]);
  const translate: Translator = (key, values) => String(t(key, values ?? {}));
  const warnings = [...new Set([...(status?.warnings ?? []), ...(status?.lastError ? [status.lastError] : [])])];
  const busy = status?.state === 'running' || status?.progress?.phase === 'enrichment';
  return <DialogRoot open={open} onOpenChange={onOpenChange}>
    <DialogPortal><DialogOverlay /><DialogContent className={`${styles.dialog} sync-problems-dialog`} aria-describedby="sync-problems-lead">
      <header className={styles.header}>
        <DialogTitle className={styles.title}>{t('sync.repair.title')}</DialogTitle>
        <DialogDescription id="sync-problems-lead" className={styles.lead}>{t('sync.repair.lead')}</DialogDescription>
      </header>
      <div className={styles.body}>
        {warnings.map(warning => <p key={warning} className={styles.warning}>{translateKnownError(translate, warning) ?? redactDiagnostic(warning)}</p>)}
        {status?.progress?.phase === 'enrichment' ? <p role="status">{t('sync.enriching', status?.metadata ?? { done: 0, total: 0 })}</p> : null}
        <UnreadableList status={status} />
        <TranslationQueue />
        {!status?.unreadable?.length && metadataReport(status).pending === 0 ? <p>{t(warnings.length ? 'sync.repair.noFileErrors' : 'sync.repair.empty')}</p> : null}
        {status?.headerRepairs?.length ? <section aria-label={String(t('sync.repair.history'))}>
          <h3 className={styles.subtitle}>{t('sync.repair.history')}</h3>
          <ul className={styles.history}>{status.headerRepairs.map(item => <li key={`${item.directory}/${item.name}`}>
            <strong>{item.directory}/{item.name}</strong>
            <p>{t(item.empty ? 'sync.repair.emptyHeader' : 'sync.repair.imported')}</p>
            {item.headerBytes > 1024 * 1024 ? <p>{t('sync.repair.largeHeader', { size: (item.headerBytes / 1024 / 1024).toFixed(1) })}</p> : null}
          </li>)}</ul>
        </section> : null}
      </div>
      <footer className={styles.footer}>
        {status?.progress?.phase === 'enrichment' ? <Button variant="subtle" onClick={() => void pauseEnrichment()}>{t('sync.pause')}</Button> : null}
        <Button variant="subtle" disabled={busy} onClick={() => void requestSync()}>{t('sync.now')}</Button>
        <Button variant="ghost" onClick={() => { onOpenChange(false); useUiStore.getState().openSettings('connection'); }}>{t('sync.repair.connection')}</Button>
        <Button variant="ghost" onClick={() => { onOpenChange(false); useUiStore.getState().openSettings('services'); }}>{t('services.title')}</Button>
        <DialogClose asChild><Button variant="primary">{t('menu.close')}</Button></DialogClose>
      </footer>
    </DialogContent></DialogPortal>
  </DialogRoot>;
}
