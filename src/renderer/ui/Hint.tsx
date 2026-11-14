import React, { useCallback, useRef, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import styles from './Hint.module.css';
import { cx } from './cx';

/**
 * How the person last moved focus: a hint opens on focus only when they moved it themselves with the keyboard
 * (Tab, Shift+Tab, arrows, Home/End). Focus a dialog hands back on close, after a click or Escape, is not that,
 * and a hint opened by it stayed over the panels.
 */
let keyboardNavigation = false;
const NAVIGATION_KEYS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => { keyboardNavigation = NAVIGATION_KEYS.has(event.key); }, true);
  window.addEventListener('pointerdown', () => { keyboardNavigation = false; }, true);
}

export function HintProvider({ children }: { children: React.ReactNode }) {
  return <Tooltip.Provider delayDuration={400}>{children}</Tooltip.Provider>;
}

/**
 * Tooltip on hover and on keyboard focus. The wrapped control keeps its own accessible name; the hint adds context
 * and, for commands, the shortcut (drawn with <Kbd>).
 */
export default function Hint({ label, children, side, shortcut }: { label: string; children: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right'; shortcut?: React.ReactNode }) {
  const target = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const onOpenChange = useCallback((next: boolean) => {
    if (next) {
      const el = target.current;
      const hovered = Boolean(el?.matches(':hover'));
      const focused = Boolean(el && document.activeElement && el.contains(document.activeElement));
      // Opened by a focus the person did not move with the keyboard: stay closed.
      if (focused && !hovered && !keyboardNavigation) return;
    }
    setOpen(next);
  }, []);
  // An empty label keeps the wrapper (so the control is not remounted when a reason comes and goes) but never opens.
  return (
    <Tooltip.Root open={label ? open : false} onOpenChange={onOpenChange}>
      <Tooltip.Trigger asChild>
        <span
          ref={target}
          className={cx(styles.target, 'hint-target')}
          // A hint opened by focus closes when the pointer goes elsewhere, like one opened by hover.
          onPointerLeave={() => setOpen(false)}
        >
          {children}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className={cx(styles.content, 'hint-content')} side={side} sideOffset={6} collisionPadding={8}>
          {shortcut ? (
            <span className={styles.withShortcut}>
              <span>{label}</span>
              <span className={styles.shortcut}>{shortcut}</span>
            </span>
          ) : label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
