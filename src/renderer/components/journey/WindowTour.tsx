import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../../ui/Button';
import MarkdownLite from '../chat/MarkdownLite';
import { readFlag, SEEN_KEYS, useJourneyStore, writeFlag } from '../../state/journeyState';
import { useUiStore } from '../../state/uiState';
import styles from './Journey.module.css';

/**
 * A short tour of the window: six stops, each a ring around one part of the window and a card that says what it is.
 *
 * Who sees it: a person on their first start (once; "Skip the tour" ends it), and anyone from Help ▸ Tour of the
 * window. Why: the window has a library, a canvas, a toolbar, a right panel with four icon tabs and a status bar, and
 * none of them says what it is for. The tour is not modal: the window stays usable, Escape ends it, the arrow keys
 * move through it, and its card takes focus so a keyboard user can follow it. Glossary words in the cards explain
 * themselves (MarkdownLite `terms`). A part that is folded or missing is skipped.
 */

/** The stops: a selector of the part of the window, and the catalog keys of its card. */
export const TOUR_STOPS = [
  { key: 'menu', selector: '.document-bar' },
  { key: 'library', selector: '#library-rail, .rail' },
  { key: 'canvas', selector: '.graph-pane' },
  { key: 'toolbar', selector: '.workspace-toolbar' },
  { key: 'dock', selector: '.dock-tablist, .dock-strip' },
  { key: 'status', selector: '.status-bar' },
] as const;

/**
 * Whether the tour starts by itself: on a first start (never seen), with no dialog open, and not in an automated run
 * (navigator.webdriver: the app's own end-to-end tests drive windows of fresh profiles and must not meet a tour on
 * each; the tour's spec starts it from Help).
 */
export function shouldAutoStartTour(state: { seen: boolean; dialogOpen: boolean; automated: boolean }): boolean {
  return !state.seen && !state.dialogOpen && !state.automated;
}

/** How long a first start waits before the tour, so the window has drawn and a start-up question can come first. */
const FIRST_START_DELAY_MS = 1500;
const CARD_WIDTH = 320;
const GAP = 12;

function targetRect(selector: string): DOMRect | null {
  const element = document.querySelector(selector);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

/** Where the card goes: beside the part (right, left, below, above), always inside the window. */
function cardPlace(rect: DOMRect, height: number): { left: number; top: number } {
  const width = Math.min(CARD_WIDTH, window.innerWidth - 32);
  const clampX = (x: number) => Math.max(16, Math.min(window.innerWidth - width - 16, x));
  const clampY = (y: number) => Math.max(16, Math.min(window.innerHeight - height - 16, y));
  if (rect.right + GAP + width <= window.innerWidth - 16 && rect.width < window.innerWidth / 2) return { left: rect.right + GAP, top: clampY(rect.top) };
  if (rect.left - GAP - width >= 16 && rect.width < window.innerWidth / 2) return { left: rect.left - GAP - width, top: clampY(rect.top) };
  if (rect.bottom + GAP + height <= window.innerHeight - 16) return { left: clampX(rect.left + rect.width / 2 - width / 2), top: rect.bottom + GAP };
  return { left: clampX(rect.left + rect.width / 2 - width / 2), top: clampY(rect.top - GAP - height) };
}

export default function WindowTour() {
  const { t, i18n } = useTranslation();
  const step = useJourneyStore((state) => state.tourStep);
  const setStep = useJourneyStore((state) => state.setTourStep);
  const card = useRef<HTMLDivElement | null>(null);
  const [, redraw] = useState(0);

  // The first start: once, after the window has drawn, unless a dialog is open then.
  useEffect(() => {
    if (readFlag(SEEN_KEYS.tour)) return;
    const timer = window.setTimeout(() => {
      const dialogOpen = Boolean(document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"]') || useUiStore.getState().dialog);
      if (!shouldAutoStartTour({ seen: readFlag(SEEN_KEYS.tour), dialogOpen, automated: navigator.webdriver === true })) return;
      useJourneyStore.getState().startTour();
    }, FIRST_START_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const stops = TOUR_STOPS.filter((stop) => targetRect(stop.selector));
  const current = step !== null ? stops[Math.min(step, stops.length - 1)] : undefined;
  const end = () => {
    writeFlag(SEEN_KEYS.tour, true);
    setStep(null);
  };

  useEffect(() => {
    if (step === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') end();
      else if (event.key === 'ArrowRight' && card.current?.contains(document.activeElement)) setStep(Math.min(stops.length - 1, step + 1));
      else if (event.key === 'ArrowLeft' && card.current?.contains(document.activeElement)) setStep(Math.max(0, step - 1));
    };
    const onResize = () => redraw((value) => value + 1);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  });

  useLayoutEffect(() => {
    if (step !== null) card.current?.focus();
  }, [step]);

  if (step === null || !current) return null;
  const rect = targetRect(current.selector);
  if (!rect) return null;
  const index = stops.indexOf(current);
  const last = index === stops.length - 1;
  const place = cardPlace(rect, card.current?.offsetHeight ?? 170);
  return (
    <>
      <div className={styles.ring} aria-hidden="true" data-tour-ring={current.key} style={{ left: rect.left + 2, top: rect.top + 2, width: rect.width - 4, height: rect.height - 4 }} />
      <div
        ref={card}
        className={`${styles.tourCard} window-tour`}
        role="dialog"
        aria-modal="false"
        aria-label={String(t('journey.tour.label'))}
        aria-describedby="window-tour-body"
        tabIndex={-1}
        data-tour-step={current.key}
        style={{ left: place.left, top: place.top }}
      >
        <span className={styles.tourProgress}>{t('journey.tour.progress', { current: index + 1, total: stops.length })}</span>
        <h3 className={styles.tourTitle}>{t(`journey.tour.${current.key}Title`)}</h3>
        <div id="window-tour-body"><MarkdownLite text={String(t(`journey.tour.${current.key}Body`))} terms={i18n.language} /></div>
        <div className={styles.tourButtons}>
          <Button size="sm" variant="ghost" className={styles.tourSkip} onClick={end}>{t('journey.tour.skip')}</Button>
          {index > 0 ? <Button size="sm" variant="subtle" onClick={() => setStep(index - 1)}>{t('journey.tour.back')}</Button> : null}
          <Button size="sm" variant="primary" onClick={() => (last ? end() : setStep(index + 1))}>{t(last ? 'journey.tour.done' : 'journey.tour.next')}</Button>
        </div>
      </div>
    </>
  );
}
