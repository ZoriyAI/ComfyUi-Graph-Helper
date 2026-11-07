import React, { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';

function seconds(raw: string) {
  const value = raw.trim();
  if (value.endsWith('ms')) return Number.parseFloat(value) / 1000;
  return Number.parseFloat(value) || 0;
}

export function applyMotion(motion: string) {
  document.documentElement.dataset.motion = motion;
  window.dispatchEvent(new CustomEvent('app-motion'));
}

export function useMotionPolicy() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick((value) => value + 1);
    window.addEventListener('app-motion', update);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    media.addEventListener('change', update);
    return () => {
      window.removeEventListener('app-motion', update);
      media.removeEventListener('change', update);
    };
  }, []);
  const style = getComputedStyle(document.documentElement);
  const feedback = seconds(style.getPropertyValue('--motion-feedback'));
  const enter = seconds(style.getPropertyValue('--motion-enter'));
  const shift = Number.parseFloat(style.getPropertyValue('--motion-shift')) || 0;
  return { feedback, enter, shift, spatial: shift === 0, instant: feedback === 0 };
}

export function MotionRoot({ children }: { children: React.ReactNode }) {
  const policy = useMotionPolicy();
  return (
    <MotionConfig
      reducedMotion={policy.spatial ? 'always' : 'never'}
      transition={{ duration: policy.feedback, ease: [0.2, 0, 0, 1] }}
    >
      <TooltipProvider delayDuration={280}>{children}</TooltipProvider>
    </MotionConfig>
  );
}
