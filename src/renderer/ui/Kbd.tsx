/**
 * A key cap. Who uses it: ui/Shortcut.tsx and components/chat/MessageInput.tsx.
 */
import React from 'react';
import styles from './Kbd.module.css';
import { cx } from './cx';

/** A key cap, e.g. <Kbd>Enter</Kbd>. */
export default function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cx(styles.kbd, className)}>{children}</kbd>;
}
