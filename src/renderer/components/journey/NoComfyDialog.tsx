import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookA, ExternalLink, Search } from 'lucide-react';
import Button from '../../ui/Button';
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from '../../ui/Dialog';
import { showToast } from '../../ui/toastStore';
import { useJourneyStore } from '../../state/journeyState';
import { useUiStore } from '../../state/uiState';
import { openHelp } from '../../services/help';
import styles from './Journey.module.css';

/**
 * "No ComfyUI yet": for a person who installed this app out of curiosity and has nothing to connect to.
 *
 * Who sees it: the welcome card's "I have no ComfyUI yet" while ComfyUI is not connected. Why: without ComfyUI the
 * first screen asked for an address the person did not have. This says in the app's own words what ComfyUI is, that
 * this app never runs anything, how to get ComfyUI and connect it, and what works meanwhile. Pages outside open only
 * on a click, and main builds their addresses (ipc/openIpc.ts journeyLink).
 */
export default function NoComfyDialog() {
  const { t } = useTranslation();
  const open = useJourneyStore((state) => state.dialog === 'no-comfy');
  const close = useJourneyStore((state) => state.close);
  const link = async (kind: 'comfyui-download' | 'ollama-download') => {
    const result = await window.electronAPI.openJourneyLink(kind).catch(() => ({ ok: false as const, error: 'failed' }));
    if (!result.ok) showToast({ id: 'journey-link', title: String(t('journey.noComfy.linkFailed')), tone: 'error', duration: 4000 });
  };
  return (
    <DialogRoot open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className={`${styles.dialog} journey-no-comfy-dialog`} aria-describedby="journey-no-comfy-lead">
          <header className={styles.header}>
            <DialogTitle className={styles.title}>{t('journey.noComfy.title')}</DialogTitle>
            <DialogDescription id="journey-no-comfy-lead" className={styles.lead}>{t('journey.noComfy.what')}</DialogDescription>
          </header>
          <div className={styles.body}>
            <p>{t('journey.noComfy.role')}</p>
            <span className={styles.label}>{t('journey.noComfy.stepsTitle')}</span>
            <ol className={styles.steps}>
              {(['step1', 'step2', 'step3'] as const).map((key, index) => (
                <li key={key} className={styles.step}>
                  <span className={styles.number} aria-hidden="true">{index + 1}</span>
                  <span className={styles.stepText}>{t(`journey.noComfy.${key}`)}</span>
                </li>
              ))}
            </ol>
            <span className={styles.row}>
              <Button size="sm" variant="primary" icon={<ExternalLink size={14} aria-hidden="true" />} onClick={() => void link('comfyui-download')}>{t('journey.noComfy.download')}</Button>
              <Button size="sm" variant="subtle" icon={<Search size={14} aria-hidden="true" />} onClick={() => { close(); useUiStore.getState().openSettings('connection'); }}>{t('journey.noComfy.find')}</Button>
            </span>
            <p className={styles.note}>{t('journey.noComfy.card')}</p>
            <p className={styles.note}>{t('journey.noComfy.local')}</p>
            <span className={styles.row}>
              <Button size="sm" variant="subtle" quiet icon={<ExternalLink size={14} aria-hidden="true" />} onClick={() => void link('ollama-download')}>{t('journey.noComfy.ollama')}</Button>
            </span>
            <p>{t('journey.noComfy.meanwhile')}</p>
          </div>
          <footer className={styles.footer}>
            <Button size="sm" variant="subtle" quiet icon={<BookA size={14} aria-hidden="true" />} onClick={() => { close(); openHelp('glossary'); }}>{t('journey.noComfy.glossary')}</Button>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">{t('journey.noComfy.close')}</Button>
            </DialogClose>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}
