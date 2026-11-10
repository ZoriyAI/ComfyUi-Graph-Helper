import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCheck, ChevronLeft, ChevronRight, Compass, MessageSquareText, MessagesSquare, Navigation, Pause, Play, Square, SquarePlus, Workflow, ZoomIn, ZoomOut } from 'lucide-react';
import { ControlButton, Controls } from '@xyflow/react';
import { openProposals, useProposalsStore } from '../../state/proposalsState';
import { useUiStore } from '../../state/uiState';
import AddNodeSearch from './AddNodeSearch';
import ReplayPlayer from './ReplayPlayer';
import { useCanvasStore } from './canvasStore';
import { fitDurationMs } from '../../motion/policy';
import { startGraphTour } from './tour/startTour';
import { runCommand, useCommandState } from '../../commands/registry';
import styles from './Toolbar.module.css';

const DESCRIPTION_TITLES = {
  own: 'canvas.descriptionsTitleOwn',
  all: 'canvas.descriptionsTitleAll',
  off: 'canvas.descriptionsTitleOff',
} as const;

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
 * Floating canvas toolbar: add node (labelled «Нода», its own shape so it never reads as zoom), «Разложить»,
 * zoom in / out (magnifier glyphs), React Flow's fit and interactivity controls, follow the helper, description
 * cards (own / all / off), the tour player, replay, and accept-all when there are proposals. "Show all now" for
 * a live build lives only on the live-build strip. Mounted as a React Flow Panel so it sits in the canvas tab zone;
 * onBeforeDelete and React Flow's input check keep graph shortcuts out of its search field.
 */
export default function CanvasToolbar() {
  const { t } = useTranslation();
  const followAgent = useUiStore((state) => state.followAgent);
  const tour = useUiStore((state) => state.tour);
  const setTourIndex = useUiStore((state) => state.setTourIndex);
  const setTourPlaying = useUiStore((state) => state.setTourPlaying);
  const stopTour = useUiStore((state) => state.stopTour);
  const proposals = useProposalsStore((state) => state.proposals);
  const arrange = useCommandState('graph.arrange');
  const replaying = useCanvasStore((state) => Boolean(state.replay));
  const descriptionsMode = useCanvasStore((state) => state.descriptionsMode);
  const open = openProposals(proposals).length;
  const duration = fitDurationMs();

  return (
    <div className={styles.toolbar} role="toolbar" aria-label={String(t('canvas.toolbar'))}>
      <span className={styles.group}>
        <button type="button" className={`${styles.button} ${styles.primary} ${styles.wide}`} onClick={() => void runCommand('graph.addNode')} disabled={replaying} title={String(t('canvas.addNode'))} aria-label={String(t('canvas.addNode'))} data-canvas-add-node>
          <SquarePlus size={16} aria-hidden="true" />
          <span>{t('canvas.addNodeLabel')}</span>
        </button>
        <AddNodeSearch />
        <button
          type="button"
          className={`${styles.button} ${styles.wide}`}
          onClick={() => void runCommand('graph.arrange')}
          disabled={!arrange.enabled}
          title={String(t('canvas.arrangeHint'))}
          aria-label={String(t('canvas.arrangeGraph'))}
          data-canvas-arrange
        >
          <Workflow size={16} aria-hidden="true" />
          <span>{t('canvas.arrange')}</span>
        </button>
      </span>
      <span className={styles.group}>
        {/* React Flow's fit and interactivity controls, with zoom drawn as magnifiers so it never looks like "add". */}
        <Controls
          className={styles.controls}
          orientation="horizontal"
          position="top-left"
          showZoom={false}
          fitViewOptions={{ padding: FIT_PADDING, duration }}
        >
          <ControlButton className="react-flow__controls-zoomin" onClick={() => void runCommand('view.zoomIn')} title={String(t('canvas.zoomIn'))} aria-label={String(t('canvas.zoomIn'))}>
            <ZoomIn className={styles.glyph} aria-hidden="true" />
          </ControlButton>
          <ControlButton className="react-flow__controls-zoomout" onClick={() => void runCommand('view.zoomOut')} title={String(t('canvas.zoomOut'))} aria-label={String(t('canvas.zoomOut'))}>
            <ZoomOut className={styles.glyph} aria-hidden="true" />
          </ControlButton>
        </Controls>
        <button type="button" className={styles.button} aria-pressed={followAgent} onClick={() => void runCommand('view.followAgent')} title={String(t('canvas.followAgent'))} aria-label={String(t('canvas.followAgent'))}>
          <Navigation size={16} aria-hidden="true" />
        </button>
        {/* Cycles own → all → off; the tooltip names the mode, the label stays the same for assistive tech. */}
        <button
          type="button"
          className={styles.button}
          aria-pressed={descriptionsMode !== 'off'}
          data-descriptions-mode={descriptionsMode}
          onClick={() => void runCommand('view.descriptions')}
          title={String(t(DESCRIPTION_TITLES[descriptionsMode]))}
          aria-label={String(t('canvas.descriptions'))}
        >
          {descriptionsMode === 'all' ? <MessagesSquare size={16} aria-hidden="true" /> : <MessageSquareText size={16} aria-hidden="true" />}
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
    </div>
  );
}
