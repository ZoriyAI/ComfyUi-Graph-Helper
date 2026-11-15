import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, ExternalLink, FolderOpen, Stethoscope } from 'lucide-react';
import Button from '../../ui/Button';
import Switch from '../../ui/Switch';
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from '../../ui/Dialog';
import { showToast } from '../../ui/toastStore';
import { readFlag, SEEN_KEYS, useJourneyStore, writeFlag } from '../../state/journeyState';
import { useUiStore } from '../../state/uiState';
import { exportedFileName } from '../../commands/actions';
import styles from './Journey.module.css';

/**
 * "Run it in ComfyUI": the bridge from this app to ComfyUI after File ▸ Save workflow for ComfyUI.
 *
 * Who sees it: everyone after a save for ComfyUI (until they turn it off with the switch), and anyone from the save
 * toast's "How to run it". Why: the app never runs a graph, and a newcomer does not know how a .json file gets into
 * ComfyUI or where the picture appears. Three numbered steps say it, each with the one button that does its part:
 * open ComfyUI at its saved address, show the file or copy the workflow (ComfyUI takes a pasted workflow), and where
 * the result goes. An error from ComfyUI has its own way back: "Explain a ComfyUI error…".
 */
export default function RunInComfyDialog() {
  const { t } = useTranslation();
  const open = useJourneyStore((state) => state.dialog === 'run');
  const close = useJourneyStore((state) => state.close);
  const [address, setAddress] = useState(false);
  const [always, setAlways] = useState(!readFlag(SEEN_KEYS.runCard));
  useEffect(() => {
    if (!open) return;
    setAlways(!readFlag(SEEN_KEYS.runCard));
    void window.electronAPI.comfyAddressKnown().then(setAddress).catch(() => setAddress(false));
  }, [open]);
  const name = exportedFileName();
  const say = (title: string, tone: 'success' | 'error') => showToast({ id: 'journey-run', title, tone, duration: 4000 });
  const copy = async () => {
    const text = await window.electronAPI.exportedText().catch(() => null);
    if (!text) return say(String(t('journey.run.copyFailed')), 'error');
    await navigator.clipboard.writeText(text).then(() => say(String(t('journey.run.copied')), 'success'), () => say(String(t('journey.run.copyFailed')), 'error'));
  };
  return (
    <DialogRoot open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className={`${styles.dialog} journey-run-dialog`} aria-describedby="journey-run-lead">
          <header className={styles.header}>
            <DialogTitle className={styles.title}>{t('journey.run.title')}</DialogTitle>
            <DialogDescription id="journey-run-lead" className={styles.lead}>{t('journey.run.lead')}</DialogDescription>
          </header>
          <div className={styles.body}>
            <ol className={styles.steps}>
              <li className={styles.step} data-run-step="open">
                <span className={styles.number} aria-hidden="true">1</span>
                <span className={styles.stepText}>
                  <span>{t(address ? 'journey.run.step1' : 'journey.run.step1NoAddress')}</span>
                  <span className={styles.row}>
                    {address
                      ? <Button size="sm" variant="subtle" icon={<ExternalLink size={14} aria-hidden="true" />} onClick={() => void window.electronAPI.openJourneyLink('comfyui')}>{t('journey.run.openComfy')}</Button>
                      : <Button size="sm" variant="subtle" onClick={() => { close(); useUiStore.getState().openSettings('connection'); }}>{t('journey.run.openConnection')}</Button>}
                  </span>
                </span>
              </li>
              <li className={styles.step} data-run-step="file">
                <span className={styles.number} aria-hidden="true">2</span>
                <span className={styles.stepText}>
                  <span>{t('journey.run.step2', { name: name ? `«${name}»` : '' })}</span>
                  <span className={styles.row}>
                    <Button size="sm" variant="subtle" icon={<FolderOpen size={14} aria-hidden="true" />} onClick={() => void window.electronAPI.showExported()}>{t('journey.run.showFile')}</Button>
                    <Button size="sm" variant="subtle" icon={<Copy size={14} aria-hidden="true" />} onClick={() => void copy()}>{t('journey.run.copy')}</Button>
                  </span>
                </span>
              </li>
              <li className={styles.step} data-run-step="run">
                <span className={styles.number} aria-hidden="true">3</span>
                <span className={styles.stepText}>{t('journey.run.step3')}</span>
              </li>
            </ol>
            <p className={styles.note}>{t('journey.run.error')}</p>
            <span className={styles.row}>
              <Button size="sm" variant="subtle" icon={<Stethoscope size={14} aria-hidden="true" />} onClick={() => useJourneyStore.getState().open('error')}>{t('journey.run.errorButton')}</Button>
            </span>
          </div>
          <footer className={styles.footer}>
            <Switch
              className={styles.footerStart}
              label={t('journey.run.showAgain')}
              checked={always}
              onCheckedChange={(next: boolean) => {
                setAlways(next);
                writeFlag(SEEN_KEYS.runCard, !next);
              }}
            />
            <DialogClose asChild>
              <Button variant="primary" size="sm">{t('journey.run.done')}</Button>
            </DialogClose>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}
