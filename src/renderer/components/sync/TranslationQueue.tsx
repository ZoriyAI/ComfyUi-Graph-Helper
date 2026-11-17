/** Pausing the background queue never changes the selected assistant or the original model data. */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelTranslationControl, ModelTranslationQueue } from '../../../shared/contracts/knowledge';
import Button from '../../ui/Button';
import styles from './TranslationQueue.module.css';

export default function TranslationQueue() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ModelTranslationQueue | null>(null);
  const [busy, setBusy] = useState(false); const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false; let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try { const value = await window.electronAPI.modelTranslationStatus(); if (!disposed) setStatus(value); }
      catch { if (!disposed) setFailed(true); }
      finally { if (!disposed) timer = setTimeout(() => void read(), 3000); }
    };
    void read(); return () => { disposed = true; clearTimeout(timer); };
  }, []);
  const control = async (action?: ModelTranslationControl['action']) => {
    setBusy(true); setFailed(false);
    try { setStatus(action ? await window.electronAPI.modelTranslationControl({ action }) : await window.electronAPI.modelTranslationStatus()); }
    catch { setFailed(true); }
    finally { setBusy(false); }
  };
  return <section aria-label={String(t('translationQueue.title'))} className={styles.section} data-translation-queue>
    <h3>{t('translationQueue.title')}</h3>
    <p>{t('translationQueue.lead')}</p>
    {status ? <>
      <p role="status">{t(`translationQueue.${status.state}`)}</p>
      <p>{t('translationQueue.counts', { pending: status.pending, failed: status.failed, cached: status.cached })}</p>
      {status.state === 'running' && status.active ? <p>{t('translationQueue.active', status.active)}</p> : null}
    </> : null}
    <div className={styles.actions}>
      {status?.state === 'paused' ? <Button size="sm" variant="subtle" disabled={busy} onClick={() => void control('resume')}>{t('translationQueue.resume')}</Button>
        : <Button size="sm" variant="subtle" disabled={busy || !status || status.state === 'not-russian'} onClick={() => void control('pause')}>{t('translationQueue.pause')}</Button>}
      <Button size="sm" variant="subtle" disabled={busy || !status?.failed || status.state === 'paused' || status.state === 'unavailable'} onClick={() => void control('retry')}>{t('translationQueue.retry')}</Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void control()}>{t('translationQueue.refresh')}</Button>
    </div>
    {failed ? <p role="status">{t('translationQueue.error')}</p> : null}
  </section>;
}
