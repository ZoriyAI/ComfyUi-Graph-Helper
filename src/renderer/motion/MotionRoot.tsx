/**
 * The motion library's defaults for the whole window, taken from the motion policy (motion/policy.ts).
 *
 * Who renders it: index.tsx, around the whole app. Who it serves: every component that animates with the motion library (the library rail, the dock's tab underline,
 * chat messages and cards, Explain items, check rows, the welcome card, grey drafts on the canvas). A component that
 * gives no `transition` of its own appears over --motion-enter on the ease-out curve.
 *
 * Why: the "Reduced" motion setting must mean the same here as in CSS. With motion reduced the library keeps fades
 * (at the stylesheet's short --motion-enter) and drops movement and layout animation; with motion off every
 * duration is 0. Before, the library cut to 0 under Reduced while dialogs and toasts still faded.
 */
import React from 'react';
import { MotionConfig } from 'motion/react';
import { EASE_OUT, useMotionTimings } from './policy';

/** Wraps the app in the motion library's config for the current motion level. */
export default function MotionRoot({ children }: { children: React.ReactNode }) {
  const { level, enter } = useMotionTimings();
  return (
    <MotionConfig reducedMotion={level === 'full' ? 'never' : 'always'} transition={{ duration: enter, ease: EASE_OUT }}>
      {children}
    </MotionConfig>
  );
}
