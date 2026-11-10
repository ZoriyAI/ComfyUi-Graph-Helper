import { useLayoutEffect, useState } from 'react';

/** The width of a card that opens beside the library rail. */
export const CARD_WIDTH = 360;

/**
 * Where the card goes: a flyout just right of the library rail, over the edge of the canvas, so it never covers
 * the row it belongs to. Follows the rail when the window or the rail changes size.
 */
export function useFlyoutBox(): { left: number; top: number; maxHeight: number } | null {
  const [box, setBox] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  useLayoutEffect(() => {
    const rail = document.getElementById('library-rail');
    if (!rail) return undefined;
    const measure = () => {
      const rect = rail.getBoundingClientRect();
      const top = rect.top + 8;
      setBox({
        left: Math.min(rect.right + 8, Math.max(8, window.innerWidth - CARD_WIDTH - 8)),
        top,
        maxHeight: Math.max(240, rect.bottom - top - 8),
      });
    };
    measure();
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(rail);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);
  return box;
}
