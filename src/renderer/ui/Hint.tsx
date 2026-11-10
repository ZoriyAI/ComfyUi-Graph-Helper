import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import styles from './Hint.module.css';
import { cx } from './cx';

export function HintProvider({ children }: { children: React.ReactNode }) {
  return <Tooltip.Provider delayDuration={400}>{children}</Tooltip.Provider>;
}

/**
 * Tooltip on hover/focus. The wrapped control keeps its own accessible name; the hint adds context and,
 * for commands, the shortcut (drawn with <Kbd>).
 */
export default function Hint({ label, children, side, shortcut }: { label: string; children: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right'; shortcut?: React.ReactNode }) {
  // An empty label keeps the wrapper (so the control is not remounted when a reason comes and goes) but never opens.
  return (
    <Tooltip.Root {...(label ? {} : { open: false })}>
      <Tooltip.Trigger asChild>
        <span className={cx(styles.target, 'hint-target')}>{children}</span>
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
