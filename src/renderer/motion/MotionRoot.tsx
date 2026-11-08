import React, { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { motionIsFull } from './policy';

function effectiveReduced(): boolean {
  return !motionIsFull();
}

/** CSS tokens stay the measured policy. MotionConfig only stops transform/layout when not fully on. */
export default function MotionRoot({ children }: { children: React.ReactNode }) {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const read = () => setReduced(effectiveReduced());
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

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'} transition={reduced ? { duration: 0 } : undefined}>
      {children}
    </MotionConfig>
  );
}
