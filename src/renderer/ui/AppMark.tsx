import React from 'react';
import styles from './AppMark.module.css';
import { cx } from './cx';

/**
 * The application's mark: the picture of resources/icon.png (a violet node and an amber node joined by a glowing
 * cyan link on a dark tile), redrawn as vector so it stays crisp at 16-24px, where the bitmap's detail is lost.
 * Decorative: the product name always stands next to it. The colours are the icon's own, not the accent.
 */
export default function AppMark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg className={cx(styles.mark, className)} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="0.5" y="0.5" width="23" height="23" rx="6" fill="#161d2e" stroke="#2c3a52" />
      <rect x="3.2" y="11.2" width="8.2" height="6.2" rx="1.4" fill="#4a3870" stroke="#9070f0" strokeWidth="0.8" />
      <rect x="3.2" y="11.2" width="8.2" height="1.8" rx="0.9" fill="#9a6cf5" />
      <rect x="12.6" y="6.6" width="8.2" height="6.2" rx="1.4" fill="#6b4630" stroke="#f0a060" strokeWidth="0.8" />
      <rect x="12.6" y="6.6" width="8.2" height="1.8" rx="0.9" fill="#ff9a40" />
      <path d="M10.4 13.6 C 12 13.2, 12.2 10.6, 13.6 9.8" fill="none" stroke="#2fd3ee" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10.4" cy="13.8" r="1.35" fill="#e8fbff" stroke="#2fd3ee" strokeWidth="0.8" />
      <circle cx="13.6" cy="9.6" r="1.35" fill="#e8fbff" stroke="#2fd3ee" strokeWidth="0.8" />
    </svg>
  );
}
