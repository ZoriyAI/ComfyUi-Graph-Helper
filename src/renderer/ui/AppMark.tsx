/**
 * The application's mark. Who renders it: components/shell/MenuBar.tsx.
 */
import React from 'react';
import styles from './AppMark.module.css';
import { cx } from './cx';

/**
 * The application's mark in the menu bar: the picture of resources/icon-small.svg (a speech bubble that
 * holds two nodes and their link: the app explains graphs), as inline vector so it stays crisp at 16-24 px.
 * Decorative: the product name always stands next to it. The colours are the icon's own, not the accent.
 */
export default function AppMark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg className={cx(styles.mark, className)} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="24" height="24" rx="5" fill="#141d33" />
      <rect x="0.5" y="0.5" width="23" height="23" rx="4.5" fill="none" stroke="#4a5f86" strokeWidth="1" />
      <path d="M7 3 H17 A4 4 0 0 1 21 7 V13 A4 4 0 0 1 17 17 H10 L6 21 V17 A4 4 0 0 1 3 13 V7 A4 4 0 0 1 7 3 Z" fill="#65d9ed" />
      <path d="M8 13 C 10.5 13, 12 8, 16 8" fill="none" stroke="#0b1120" strokeWidth="2" />
      <circle cx="8" cy="13" r="2.4" fill="#0b1120" />
      <circle cx="16" cy="8" r="2.4" fill="#0b1120" />
      <circle cx="8" cy="13" r="0.9" fill="#b7a5ff" />
      <circle cx="16" cy="8" r="0.9" fill="#ffad5c" />
    </svg>
  );
}
