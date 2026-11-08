import React, { useEffect, useState } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../ui/cx';
import { useGraphStore } from '../../state/graphState';
import { applyProjection, useProjectionStore } from '../../services/commands/projection';
import { getChatService } from '../../services/llm/chatService';
import styles from './StatusBar.module.css';

const MOTION_KEYS: Record<string, string> = {
  system: 'settings.motionSystem',
  on: 'settings.motionOn',
  reduced: 'settings.motionReduced',
  off: 'settings.motionOff',
};

function useMotionMode(): string {
  const [mode, setMode] = useState(() => document.documentElement.dataset.motion || 'system');
  useEffect(() => {
    const observer = new MutationObserver(() => setMode(document.documentElement.dataset.motion || 'system'));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    return () => observer.disconnect();
  }, []);
  return mode;
}

/** Agent run controls. Pause and resume go through the chat service so the chat state follows. */
async function pauseRun() {
  await getChatService().pause();
}

async function resumeRun() {
  await getChatService().resume();
}

async function cancelRun(projectId: string, runId: string) {
  const result = await window.electronAPI.cancelRun(projectId, runId);
  applyProjection(result.projection);
  getChatService().cancel();
}

/** Bottom bar (`.status-bar`): counts, zoom, revision, the agent run with its controls, language and motion. */
export default function StatusBar() {
  const { t, i18n } = useTranslation();
  const nodes = useGraphStore((state) => state.nodes);
  const edgeCount = useGraphStore((state) => state.edges.length);
  const zoom = useGraphStore((state) => state.zoom);
  const revSeq = useProjectionStore((state) => state.revSeq);
  const projectId = useProjectionStore((state) => state.projectId);
  const activeRun = useProjectionStore((state) => state.activeRun);
  const motion = useMotionMode();
  const selected = nodes.filter((node) => node.selected).length;
  const language = i18n.language === 'en' ? t('settings.languageEnglish') : t('settings.languageRussian');

  return (
    <footer className={cx(styles.bar, 'status-bar')} aria-label={String(t('status.region'))}>
      <span className={cx(styles.item, styles.mono)}>{t('status.nodes', { count: nodes.length })}</span>
      <span className={cx(styles.item, styles.mono)}>{t('status.edges', { count: edgeCount })}</span>
      <span className={styles.item}>{selected === 0 ? t('status.noSelection') : t('status.selected', { count: selected })}</span>
      <span className={cx(styles.item, styles.mono)}>{t('status.zoom', { percent: Math.round(zoom * 100) })}</span>
      {revSeq > 0 ? <span className={cx(styles.item, styles.mono)}>{t('status.revision', { rev: revSeq })}</span> : null}
      <span className={styles.spacer} />
      {activeRun ? (
        <span className={styles.run} data-status={activeRun.status} role="status">
          <span className={styles.runDot} aria-hidden="true" />
          {t(activeRun.status === 'paused' ? 'status.runPaused' : 'status.runRunning')}
          {activeRun.status === 'running' ? (
            <button type="button" className={styles.runButton} onClick={() => void pauseRun().catch(() => undefined)}>
              <Pause size={10} aria-hidden="true" /> {t('status.pauseRun')}
            </button>
          ) : (
            <button type="button" className={styles.runButton} onClick={() => void resumeRun().catch(() => undefined)}>
              <Play size={10} aria-hidden="true" /> {t('status.resumeRun')}
            </button>
          )}
          <button type="button" className={styles.runButton} onClick={() => void cancelRun(projectId, activeRun.runId).catch(() => undefined)}>
            <Square size={10} aria-hidden="true" /> {t('status.cancelRun')}
          </button>
        </span>
      ) : null}
      <span className={styles.item}>{t('status.language', { language })}</span>
      <span className={styles.item}>{t('status.motion', { mode: t(MOTION_KEYS[motion] ?? 'settings.motionSystem') })}</span>
    </footer>
  );
}
