import { useEffect, useState } from 'react';

/** Effective motion policy: 'full' when On, or System without an OS reduce request. */
export type MotionLevel = 'full' | 'reduced' | 'off';

export function motionLevel(): MotionLevel {
  if (typeof document === 'undefined') return 'off';
  const mode = document.documentElement.dataset.motion || 'system';
  if (mode === 'off') return 'off';
  if (mode === 'reduced') return 'reduced';
  const osReduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (mode === 'system' && osReduce) return 'reduced';
  return 'full';
}

export function useMotionLevel(): MotionLevel {
  const [level, setLevel] = useState<MotionLevel>(() => motionLevel());
  useEffect(() => {
    const read = () => setLevel(motionLevel());
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    media.addEventListener('change', read);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', read);
    };
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

/** A motion token in milliseconds; 0 unless motion is full, so camera moves and reveals are instant otherwise. */
export function motionMs(token: '--motion-reveal' | '--motion-pulse' | '--motion-tour' | '--motion-enter', fallback: number): number {
  if (motionLevel() !== 'full') return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token);
  return parseDuration(raw, fallback);
}

/** Reading pace for the step-by-step build and replay: still readable with motion off. */
export function readingPaceMs(): number {
  const reveal = motionLevel() === 'full'
    ? parseDuration(getComputedStyle(document.documentElement).getPropertyValue('--motion-reveal'), 320)
    : 0;
  return reveal + 400;
}
