/**
 * The status bar at the bottom of the main window (App.tsx renders it): graph counts, zoom, the history step, the
 * running agent with Pause, Resume and Stop, and the update notice. It only reads the graph and projection stores.
 */
import React from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../ui/cx';
import { useGraphStore } from '../../state/graphState';
import { applyProjection, useProjectionStore } from '../../services/commands/projection';
import { getChatService } from '../../services/llm/chatService';
import styles from './StatusBar.module.css';
import UpdateNotice from './UpdateNotice';

/** Agent run controls. Pause and resume go through the chat service so the chat state follows. */
async function pauseRun() {
  await getChatService().pause();
}

/** Resumes a paused run through the chat service. */
async function resumeRun() {
  await getChatService().resume();
}

/**
 * Stops the run in main first, shows the projection main returns, then tells the chat service, so the chat never
 * shows the run as ended while main still holds it.
 */
async function cancelRun(projectId: string, runId: string) {
  const result = await window.electronAPI.cancelRun(projectId, runId);
  applyProjection(result.projection);
  getChatService().cancel();
}

/**
 * Bottom bar (`.status-bar`): counts, zoom, revision and the agent run with its controls. Language and motion are
 * settings, not state, so they live in Settings only and the bar keeps its room for what changes while you work.
 */
export default function StatusBar() {
  const { t } = useTranslation();
  const nodes = useGraphStore((state) => state.nodes);
  const edgeCount = useGraphStore((state) => state.edges.length);
  const zoom = useGraphStore((state) => state.zoom);
  const revSeq = useProjectionStore((state) => state.revSeq);
  const projectId = useProjectionStore((state) => state.projectId);
  const activeRun = useProjectionStore((state) => state.activeRun);
  const selected = nodes.filter((node) => node.selected).length;

  return (
    <footer className={cx(styles.bar, 'status-bar')} aria-label={String(t('status.region'))} data-run={activeRun ? 'true' : undefined}>
      <span className={styles.group}>
        <span className={cx(styles.item, styles.mono)}>{t('status.nodes', { count: nodes.length })}</span>
        <span className={cx(styles.item, styles.mono)}>{t('status.edges', { count: edgeCount })}</span>
        <span className={styles.item}>{selected === 0 ? t('status.noSelection') : t('status.selected', { count: selected })}</span>
        {/* Zoom and the history step give way first when a run needs the room (StatusBar.module.css). */}
        <span className={cx(styles.item, styles.mono, styles.optional)}>{t('status.zoom', { percent: Math.round(zoom * 100) })}</span>
        {revSeq > 0 ? <span className={cx(styles.item, styles.mono, styles.optional)}>{t('status.revision', { rev: revSeq })}</span> : null}
      </span>
      <span className={styles.spacer} />
      {activeRun ? (
        <span className={styles.run} data-status={activeRun.status} role="status">
          <span className={styles.runDot} aria-hidden="true" />
          <span className={styles.runText}>{t(activeRun.status === 'paused' ? 'status.runPaused' : 'status.runRunning')}</span>
          {activeRun.status === 'running' ? (
            <button type="button" className={styles.runButton} onClick={() => void pauseRun().catch(() => undefined)}>
              <Pause size={10} aria-hidden="true" /> {t('status.pauseRun')}
            </button>
          ) : (
            <button type="button" className={styles.runButton} onClick={() => void resumeRun().catch(() => undefined)}>
              <Play size={10} aria-hidden="true" /> {t('status.resumeRun')}
            </button>
          )}
          <button type="button" className={cx(styles.runButton, styles.endButton)} onClick={() => void cancelRun(projectId, activeRun.runId).catch(() => undefined)}>
            <Square size={9} aria-hidden="true" /> {t('status.cancelRun')}
          </button>
        </span>
      ) : null}
      <UpdateNotice />
    </footer>
  );
}
