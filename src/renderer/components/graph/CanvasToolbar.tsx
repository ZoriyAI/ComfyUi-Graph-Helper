import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCheck, ChevronLeft, ChevronRight, Compass, Maximize, MessageSquareText, MessagesSquare, Navigation, Pause, Play, Square, SquarePlus, Workflow, ZoomIn, ZoomOut } from 'lucide-react';
import { ControlButton, Controls, useStore, type ReactFlowState } from '@xyflow/react';
import { openProposals, useProposalsStore } from '../../state/proposalsState';
import { useUiStore } from '../../state/uiState';
import AddNodeSearch from './AddNodeSearch';
import ReplayPlayer from './ReplayPlayer';
import { useCanvasStore } from './canvasStore';
import { fitDurationMs } from '../../motion/policy';
import { startGraphTour } from './tour/startTour';
import { runCommand, useCommandState } from '../../commands/registry';
import styles from './Toolbar.module.css';

const zoomOf = (state: ReactFlowState) => state.transform[2];

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

/** «Отклонить все»: every open grey draft is rejected, nothing on the graph changes. */
export async function rejectAllProposals(): Promise<void> {
  const store = useProposalsStore.getState();
  for (const proposal of openProposals(store.proposals)) {
    await useProposalsStore.getState().resolve(proposal.id, 'reject').catch(() => undefined);
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
  const zoom = useStore(zoomOf);

  // Groups: make (add, arrange) | camera (zoom out, zoom %, zoom in, fit) | explain (descriptions, tour, history) |
  // follow the assistant. The tour's transport is its own pill under the toolbar, so the toolbar does not jump.
  return (
    <div className={styles.stack}>
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
        {/*
          React Flow's controls panel, laid out as − 100 % + ⛶: zoom drawn as magnifiers so it never looks like "add",
          the zoom readout resets to 100 %, the fit keeps React Flow's class. The interactivity lock is not offered:
          a lock in the toolbar read as "lock the node".
        */}
        <Controls
          className={styles.controls}
          orientation="horizontal"
          position="top-left"
          showZoom={false}
          showFitView={false}
          showInteractive={false}
          fitViewOptions={{ padding: FIT_PADDING, duration }}
        >
          <ControlButton className="react-flow__controls-zoomout" onClick={() => void runCommand('view.zoomOut')} title={String(t('canvas.zoomOut'))} aria-label={String(t('canvas.zoomOut'))}>
            <ZoomOut className={styles.glyph} aria-hidden="true" />
          </ControlButton>
          <ControlButton className={`${styles.zoomLevel} react-flow__controls-zoomreset`} onClick={() => void runCommand('view.zoomReset')} title={String(t('menu.zoomReset'))} aria-label={String(t('menu.zoomReset'))}>
            {Math.round(zoom * 100)}%
          </ControlButton>
          <ControlButton className="react-flow__controls-zoomin" onClick={() => void runCommand('view.zoomIn')} title={String(t('canvas.zoomIn'))} aria-label={String(t('canvas.zoomIn'))}>
            <ZoomIn className={styles.glyph} aria-hidden="true" />
          </ControlButton>
          <ControlButton className="react-flow__controls-fitview" onClick={() => void runCommand('view.fit')} title={String(t('graph.fitView'))} aria-label={String(t('graph.fitView'))}>
            <Maximize className={styles.glyph} aria-hidden="true" />
          </ControlButton>
        </Controls>
      </span>
      <span className={styles.group}>
        {/* Cycles own → all → off; the tooltip names the mode, the label stays the same for assistive tech. */}
        <button
          type="button"
          className={`${styles.button} ${styles.labelled}`}
          aria-pressed={descriptionsMode !== 'off'}
          data-descriptions-mode={descriptionsMode}
          onClick={() => void runCommand('view.descriptions')}
          title={String(t(DESCRIPTION_TITLES[descriptionsMode]))}
          aria-label={String(t('canvas.descriptions'))}
        >
          {descriptionsMode === 'all' ? <MessagesSquare size={16} aria-hidden="true" /> : <MessageSquareText size={16} aria-hidden="true" />}
          <span>{t('canvas.descriptionsLabel')}</span>
        </button>
        <button type="button" className={`${styles.button} ${styles.labelled}`} disabled={replaying} aria-pressed={Boolean(tour)} onClick={() => (tour ? stopTour() : void startGraphTour())} aria-label={String(t('canvas.tourStart'))} title={String(tour ? t('canvas.tourStop') : t('canvas.tourStart'))}>
          <Compass size={16} aria-hidden="true" />
          <span>{t('canvas.tourLabel')}</span>
        </button>
        <ReplayPlayer />
      </span>
      <span className={styles.group}>
        <button type="button" className={styles.button} aria-pressed={followAgent} onClick={() => void runCommand('view.followAgent')} title={String(t('canvas.followAgent'))} aria-label={String(t('canvas.followAgent'))}>
          <Navigation size={16} aria-hidden="true" />
        </button>
      </span>
      {open >= 2 && !replaying ? (
        <span className={styles.group}>
          <button type="button" className={`${styles.button} ${styles.wide}`} onClick={() => void acceptAllProposals()}>
            <CheckCheck size={16} aria-hidden="true" />
            {t('canvas.acceptAll', { count: open })}
          </button>
          <button type="button" className={`${styles.button} ${styles.wide}`} onClick={() => void rejectAllProposals()} data-reject-all>
            {t('canvas.rejectAll')}
          </button>
        </span>
      ) : null}
    </div>
    {tour ? (
      <div className={`${styles.toolbar} ${styles.tourBar}`} role="group" aria-label={String(t('canvas.tourBar'))}>
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
      </div>
    ) : null}
    </div>
  );
}
