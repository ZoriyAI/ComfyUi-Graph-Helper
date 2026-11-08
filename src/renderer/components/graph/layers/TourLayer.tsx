import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { NodeToolbar, Position, useReactFlow } from '@xyflow/react';
import { useUiStore } from '../../../state/uiState';
import Illustration from '../illustrations/Illustration';
import { motionMs, useMotionLevel } from '../lib/motion';
import styles from './Callout.module.css';

/** How long an autoplayed step stays: enough to read one sentence and watch the pulses once or twice. */
export const TOUR_STEP_MS = 4800;

function typingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest('input, textarea, select, [role="dialog"], [role="listbox"], [role="menu"]')) return true;
  return false;
}

/** Centre the camera on a node over --motion-tour (instant without full motion). */
export function useCenterOn() {
  const flow = useReactFlow();
  return useCallback((nodeId: string) => {
    const node = flow.getInternalNode(nodeId);
    if (!node) return;
    const width = node.measured?.width ?? 240;
    const height = node.measured?.height ?? 120;
    const at = node.internals.positionAbsolute;
    void flow.setCenter(at.x + width / 2, at.y + height / 2, { zoom: Math.max(flow.getZoom(), 0.85), duration: motionMs('--motion-tour', 600) });
  }, [flow]);
}

/**
 * Guided tour: the camera moves node to node, a callout opens at each with one sentence and a
 * micro-illustration, and FlowLayer pulses the edges into the node. Prev / next / play / pause in the
 * toolbar; ← → Space Esc on the keyboard. With reduced or no motion every step gets a static numbered
 * callout instead, and the camera jumps.
 */
export default function TourLayer() {
  const { t } = useTranslation();
  const tour = useUiStore((state) => state.tour);
  const setTourIndex = useUiStore((state) => state.setTourIndex);
  const setTourPlaying = useUiStore((state) => state.setTourPlaying);
  const stopTour = useUiStore((state) => state.stopTour);
  const motion = useMotionLevel();
  const centerOn = useCenterOn();
  const step = tour ? tour.steps[tour.index] : undefined;
  const stepId = step?.ref.id;

  useEffect(() => {
    if (stepId) centerOn(stepId);
  }, [stepId, centerOn]);

  useEffect(() => {
    if (!tour?.playing) return undefined;
    const timer = window.setTimeout(() => {
      const current = useUiStore.getState().tour;
      if (!current) return;
      if (current.index < current.steps.length - 1) setTourIndex(current.index + 1);
      else setTourPlaying(false);
    }, TOUR_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [tour?.playing, tour?.index, setTourIndex, setTourPlaying]);

  const active = Boolean(tour);
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (typingTarget(event.target)) return;
      const current = useUiStore.getState().tour;
      if (!current) return;
      if (event.key === 'ArrowRight') setTourIndex(current.index + 1);
      else if (event.key === 'ArrowLeft') setTourIndex(current.index - 1);
      else if (event.key === ' ') setTourPlaying(!current.playing);
      else if (event.key === 'Escape') stopTour();
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, setTourIndex, setTourPlaying, stopTour]);

  if (!tour || !step) return null;
  const staticMode = motion !== 'full';
  return (
    <>
      {staticMode ? tour.steps.map((item, index) => (index === tour.index ? null : (
        <NodeToolbar key={item.ref.id} nodeId={item.ref.id} isVisible position={Position.Top} offset={8}>
          <button type="button" className={styles.number} onClick={() => setTourIndex(index)} aria-label={String(t('canvas.tourStep', { index: index + 1, count: tour.steps.length }))}>
            {index + 1}
          </button>
        </NodeToolbar>
      ))) : null}
      <NodeToolbar nodeId={step.ref.id} isVisible position={Position.Top} offset={12}>
        <section className={styles.callout} aria-live="polite" aria-label={step.title} data-tour-step={tour.index}>
          <header className={styles.head}>
            <span className={styles.counter}>{t('canvas.tourStep', { index: tour.index + 1, count: tour.steps.length })}</span>
            <button type="button" className={styles.icon} onClick={stopTour} aria-label={String(t('canvas.tourStop'))}><X size={14} aria-hidden="true" /></button>
          </header>
          <div className={styles.body}>
            <Illustration key={step.ref.id} classType={step.ref.classType} animate={!staticMode} hoverPlay />
            <div>
              <h3 className={styles.title}>{step.title}</h3>
              <p className={styles.text}>{step.text}</p>
            </div>
          </div>
          <footer className={styles.foot}>
            <button type="button" className={styles.icon} disabled={tour.index === 0} onClick={() => setTourIndex(tour.index - 1)} aria-label={String(t('canvas.tourPrev'))}><ChevronLeft size={16} aria-hidden="true" /></button>
            <button type="button" className={styles.icon} disabled={tour.index >= tour.steps.length - 1} onClick={() => setTourIndex(tour.index + 1)} aria-label={String(t('canvas.tourNext'))}><ChevronRight size={16} aria-hidden="true" /></button>
          </footer>
        </section>
      </NodeToolbar>
    </>
  );
}
