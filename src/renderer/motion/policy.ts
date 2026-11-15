/**
 * The motion policy of the whole renderer: one answer to "how much may things move now?".
 *
 * Who uses it: every component that animates from script (the camera, the node glide, the live build, the tour, the
 * history replay, panels driven by the motion library) and the few places that pick a scroll behaviour. CSS needs no
 * code: it reads the --motion-* tokens in theme/tokens.css, which the same setting rewrites.
 *
 * Why one module: the "Motion" setting (System, On, Reduced, Off) and the system's reduced-motion wish must mean
 * the same thing everywhere. Before, two modules answered with different rules.
 *
 * The levels:
 * - full: On, or System while the system does not ask to reduce motion.
 * - reduced: Reduced, or System while the system asks to reduce. Short fades only; nothing travels, no camera
 *   flights, no loops. Order and meaning stay (a build still shows its steps one by one).
 * - off: Off. Nothing animates; states change at once.
 */
import { useEffect, useState } from 'react';

/** How much may move now: see the levels above. */
export type MotionLevel = 'full' | 'reduced' | 'off';

/** The stored setting, as `data-motion` on <html> carries it. */
export type MotionMode = 'system' | 'on' | 'reduced' | 'off';

/** The timing tokens a script may read. Each one is a CSS custom property in theme/tokens.css. */
export type MotionToken =
  | '--motion-feedback'
  | '--motion-enter'
  | '--motion-exit'
  | '--motion-panel'
  | '--motion-reveal'
  | '--motion-pulse'
  | '--motion-camera'
  | '--motion-camera-min'
  | '--motion-ping'
  | '--motion-mark';

/** Full-motion values, used when the stylesheet cannot be read (tests, a page without tokens.css). */
export const MOTION_DEFAULTS: Record<MotionToken, number> = {
  '--motion-feedback': 100,
  '--motion-enter': 160,
  '--motion-exit': 120,
  '--motion-panel': 200,
  '--motion-reveal': 320,
  '--motion-pulse': 1400,
  '--motion-camera': 640,
  '--motion-camera-min': 240,
  '--motion-ping': 600,
  '--motion-mark': 1600,
};

/** The one curve for things that appear (CSS: --motion-ease-out). */
export const EASE_OUT: [number, number, number, number] = [0.2, 0, 0, 1];
/** The one curve for things that leave (CSS: --motion-ease-in). */
export const EASE_IN: [number, number, number, number] = [0.4, 0, 1, 1];
/** The one curve for things that travel: the camera and nodes that glide (CSS: --motion-ease-in-out). */
export const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

/** The stored setting read from <html data-motion>; 'off' outside a browser, 'system' when unset or unknown. */
export function motionMode(): MotionMode {
  if (typeof document === 'undefined') return 'off';
  const raw = document.documentElement.dataset.motion;
  return raw === 'on' || raw === 'reduced' || raw === 'off' ? raw : 'system';
}

/** The operating system's "reduce motion" wish, as the browser reports it. */
function systemAsksToReduce(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

/** The level for a setting and the system's wish. Pure, so the rule is tested without a window. */
export function levelFor(mode: MotionMode, systemReduce: boolean): MotionLevel {
  if (mode === 'off') return 'off';
  if (mode === 'reduced') return 'reduced';
  if (mode === 'on') return 'full';
  return systemReduce ? 'reduced' : 'full';
}

/** The motion level now; 'off' outside a browser (tests run without animation). */
export function motionLevel(): MotionLevel {
  if (typeof document === 'undefined') return 'off';
  return levelFor(motionMode(), systemAsksToReduce());
}

/** True with full motion: callers choose smooth scrolling and travelling effects only then. */
export function motionIsFull(): boolean {
  return motionLevel() === 'full';
}

/** Calls `read` whenever the setting or the system's wish changes; returns the unsubscribe. */
export function watchMotion(read: () => void): () => void {
  const observer = new MutationObserver(read);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  media?.addEventListener('change', read);
  return () => {
    observer.disconnect();
    media?.removeEventListener('change', read);
  };
}

/** The current level, re-rendering the component when it changes. */
export function useMotionLevel(): MotionLevel {
  const [level, setLevel] = useState<MotionLevel>(() => motionLevel());
  useEffect(() => {
    const read = () => setLevel(motionLevel());
    read();
    return watchMotion(read);
  }, []);
  return level;
}

/** Parses "320ms" / "0.6s" into milliseconds. */
export function parseDuration(value: string, fallback: number): number {
  const text = value.trim();
  const match = /^(-?\d*\.?\d+)(ms|s)$/.exec(text);
  if (!match) return fallback;
  const amount = Number(match[1]);
  return match[2] === 's' ? amount * 1000 : amount;
}

/**
 * A token's value now, in milliseconds, as the stylesheet sets it for the current level (Reduced gives the short
 * fades, Off gives 0). Use it for fades and panels driven from script.
 */
export function tokenMs(token: MotionToken): number {
  if (typeof document === 'undefined') return 0;
  // Cached per level: reading a computed style forces the browser to restyle first, and glides and camera moves ask
  // for tokens while a zoom has the whole canvas waiting to be restyled.
  const key = `${motionMode()}|${systemAsksToReduce()}`;
  if (cache.key !== key) {
    cache.key = key;
    cache.values.clear();
  }
  const known = cache.values.get(token);
  if (known !== undefined) return known;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token);
  const value = Math.max(0, parseDuration(raw, MOTION_DEFAULTS[token]));
  cache.values.set(token, value);
  return value;
}

/** Token values read for one setting and system wish (`key`); cleared when either changes. */
const cache: { key: string; values: Map<MotionToken, number> } = { key: '', values: new Map() };

/** A token in seconds, for the motion library's `transition.duration`. */
export function tokenSeconds(token: MotionToken): number {
  return tokenMs(token) / 1000;
}

/**
 * A token for movement (camera, glide, reveal, pulse): its value with full motion, 0 otherwise. Things that travel
 * do not travel at all when motion is reduced; they arrive.
 */
export function motionMs(token: MotionToken): number {
  if (motionLevel() !== 'full') return 0;
  return tokenMs(token);
}

/** Reading pace for the step-by-step build and the history replay: still readable with motion reduced or off. */
export function readingPaceMs(): number {
  // 400 ms is the reading time that stays when the reveal itself is 0 (motion reduced or off).
  return motionMs('--motion-reveal') + 400;
}

/**
 * The durations a component driven by the motion library needs, in seconds, re-read when the setting changes.
 * With motion reduced they are the short fades of the stylesheet; with motion off they are 0.
 */
export function useMotionTimings(): { level: MotionLevel; enter: number; exit: number; panel: number } {
  const level = useMotionLevel();
  // The level is the dependency: the stylesheet rewrites the tokens at the same moment it changes.
  void level;
  return {
    level,
    enter: tokenSeconds('--motion-enter'),
    exit: tokenSeconds('--motion-exit'),
    panel: level === 'full' ? tokenSeconds('--motion-panel') : tokenSeconds('--motion-enter'),
  };
}
