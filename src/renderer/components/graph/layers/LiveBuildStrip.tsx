import React from 'react';
import { useTranslation } from 'react-i18next';
import { FastForward, Pause, Play, Square } from 'lucide-react';
import { Panel } from '@xyflow/react';
import { useChatStore } from '../../../state/chatState';
import { useProjectionStore } from '../../../services/commands/projection';
import { getChatService } from '../../../services/llm/chatService';
import { useCanvasStore } from '../canvasStore';
import { stepCounter } from '../lib/buildQueue';
import { revealAllNow } from './BuildLayer';
import styles from './LiveBuildStrip.module.css';

/**
 * «Помощник строит: шаг 3 из 7 — зачем» across the top of the canvas while the helper builds, with Pause / Stop
 * (the chat service's run controls) and the only «Показать всё сразу» (flush the reveal queue; the canvas toolbar
 * leaves it to the strip).
 * It appears with the first build step of a run and hides when the run closes and the queue is empty.
 */
export default function LiveBuildStrip() {
  const { t } = useTranslation();
  const activeRun = useProjectionStore((state) => state.activeRun);
  const live = useCanvasStore((state) => state.live);
  const queued = useCanvasStore((state) => state.queue.length);
  const paused = useChatStore((state) => state.isPaused);
  const running = Boolean(activeRun) && activeRun?.runId === live.runId && live.shown + queued > 0;
  if (!running && queued === 0) return null;
  const step = stepCounter(live.shown, queued);
  const service = getChatService();
  return (
    <Panel position="top-center" className={`nopan nowheel nodrag ${styles.panel}`}>
      <div className={styles.strip} role="status" aria-label={String(t('canvas.liveLabel'))} data-live-build data-step={step.index} data-total={step.total}>
        <span className={styles.dot} data-paused={paused ? 'true' : undefined} aria-hidden="true" />
        <span className={styles.text}>
          <strong>{t('canvas.liveBuilding', { index: step.index, count: step.total })}</strong>
          {live.why ? <span className={styles.why}> — {live.why}</span> : null}
        </span>
        {running ? (
          <>
            <button
              type="button"
              className={styles.button}
              onClick={() => void (paused ? service.resume() : service.pause()).catch(() => undefined)}
              aria-label={String(paused ? t('canvas.liveResume') : t('canvas.livePause'))}
              title={String(paused ? t('canvas.liveResume') : t('canvas.livePause'))}
            >
              {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                service.cancel();
                revealAllNow();
              }}
              aria-label={String(t('canvas.liveStop'))}
              title={String(t('canvas.liveStop'))}
            >
              <Square size={13} aria-hidden="true" />
            </button>
          </>
        ) : null}
        {queued > 0 ? (
          <button type="button" className={`${styles.button} ${styles.wide}`} onClick={revealAllNow}>
            <FastForward size={14} aria-hidden="true" />
            {t('canvas.showAll')}
          </button>
        ) : null}
      </div>
    </Panel>
  );
}
