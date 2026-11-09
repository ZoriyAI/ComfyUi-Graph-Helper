import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCheck, ChevronLeft, ChevronRight, Compass, FastForward, MessageSquareText, Navigation, Pause, Play, Plus, Square } from 'lucide-react';
import { Controls } from '@xyflow/react';
import { openProposals, useProposalsStore } from '../../state/proposalsState';
import { useUiStore } from '../../state/uiState';
import AddNodeSearch from './AddNodeSearch';
import ReplayPlayer from './ReplayPlayer';
import { useCanvasStore } from './canvasStore';
import { revealAllNow } from './layers/BuildLayer';
import { fitDurationMs } from '../../motion/policy';
import { startGraphTour } from './tour/startTour';
import styles from './Toolbar.module.css';

/** Room for the floating toolbar above and the minimap in the bottom-right corner, so a fit never hides a node. */
export const FIT_PADDING = { top: '76px', right: '32px', bottom: '128px', left: '32px' } as const;

/** Accept every open proposal, one at a time so each commit sees the revision the previous one made. */
export async function acceptAllProposals(): Promise<void> {
  const store = useProposalsStore.getState();
  for (const proposal of openProposals(store.proposals)) {
    await useProposalsStore.getState().resolve(proposal.id, 'accept').catch(() => undefined);
  }
}

/**
 * Floating canvas toolbar: add node, React Flow's zoom / fit / interactivity controls, follow the helper, description cards on/off, the tour player, replay, and
 * proposal / build controls when they apply. Mounted as a React Flow Panel so it sits in the canvas tab zone;
 * onBeforeDelete and React Flow's input check keep graph shortcuts out of its search field.
 */
export default function CanvasToolbar() {
  const { t } = useTranslation();
  const followAgent = useUiStore((state) => state.followAgent);
  const setFollowAgent = useUiStore((state) => state.setFollowAgent);
  const tour = useUiStore((state) => state.tour);
  const setTourIndex = useUiStore((state) => state.setTourIndex);
  const setTourPlaying = useUiStore((state) => state.setTourPlaying);
  const stopTour = useUiStore((state) => state.stopTour);
  const proposals = useProposalsStore((state) => state.proposals);
  const pending = useCanvasStore((state) => state.pending.length);
  const replaying = useCanvasStore((state) => Boolean(state.replay));
  const openSearch = useCanvasStore((state) => state.openAddSearch);
  const descriptionsOn = useCanvasStore((state) => state.descriptionsOn);
  const setDescriptionsOn = useCanvasStore((state) => state.setDescriptionsOn);
  const open = openProposals(proposals).length;
  const duration = fitDurationMs();

  return (
    <div className={styles.toolbar} role="toolbar" aria-label={String(t('canvas.toolbar'))}>
      <span className={styles.group}>
        <button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => openSearch(null)} disabled={replaying} title={String(t('canvas.addNode'))} aria-label={String(t('canvas.addNode'))}>
          <Plus size={16} aria-hidden="true" />
        </button>
        <AddNodeSearch />
      </span>
      <span className={styles.group}>
        {/* React Flow's own controls (zoom in, zoom out, fit, interactivity), drawn as part of this toolbar. */}
        <Controls
          className={styles.controls}
          orientation="horizontal"
          position="top-left"
          fitViewOptions={{ padding: FIT_PADDING, duration }}
        />
        <button type="button" className={styles.button} aria-pressed={followAgent} onClick={() => setFollowAgent(!followAgent)} title={String(t('canvas.followAgent'))} aria-label={String(t('canvas.followAgent'))}>
          <Navigation size={16} aria-hidden="true" />
        </button>
        <button type="button" className={styles.button} aria-pressed={descriptionsOn} onClick={() => setDescriptionsOn(!descriptionsOn)} title={String(t('canvas.descriptions'))} aria-label={String(t('canvas.descriptions'))}>
          <MessageSquareText size={16} aria-hidden="true" />
        </button>
      </span>
      <span className={styles.group}>
        {tour ? (
          <>
            <button type="button" className={styles.button} disabled={tour.index === 0} onClick={() => setTourIndex(tour.index - 1)} aria-label={String(t('canvas.tourPrev'))} title={String(t('canvas.tourPrev'))}>
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button type="button" className={styles.button} onClick={() => setTourPlaying(!tour.playing)} aria-label={String(tour.playing ? t('canvas.pause') : t('canvas.play'))} title={String(tour.playing ? t('canvas.pause') : t('canvas.play'))}>
              {tour.playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            </button>
            <button type="button" className={styles.button} disabled={tour.index >= tour.steps.length - 1} onClick={() => setTourIndex(tour.index + 1)} aria-label={String(t('canvas.tourNext'))} title={String(t('canvas.tourNext'))}>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <span className={styles.label}>{t('canvas.tourStep', { index: tour.index + 1, count: tour.steps.length })}</span>
            <button type="button" className={styles.button} onClick={stopTour} aria-label={String(t('canvas.tourStop'))} title={String(t('canvas.tourStop'))}>
              <Square size={14} aria-hidden="true" />
            </button>
          </>
        ) : (
          <button type="button" className={styles.button} disabled={replaying} onClick={() => void startGraphTour()} aria-label={String(t('canvas.tourStart'))} title={String(t('canvas.tourStart'))}>
            <Compass size={16} aria-hidden="true" />
          </button>
        )}
        <ReplayPlayer />
      </span>
      {open >= 2 && !replaying ? (
        <span className={styles.group}>
          <button type="button" className={`${styles.button} ${styles.wide}`} onClick={() => void acceptAllProposals()}>
            <CheckCheck size={16} aria-hidden="true" />
            {t('canvas.acceptAll', { count: open })}
          </button>
        </span>
      ) : null}
      {pending > 0 ? (
        <span className={styles.group}>
          <button type="button" className={`${styles.button} ${styles.wide}`} onClick={revealAllNow}>
            <FastForward size={16} aria-hidden="true" />
            {t('canvas.showAll')}
          </button>
        </span>
      ) : null}
    </div>
  );
}
