import React from 'react';
import styles from './ProgressRing.module.css';
import { cx } from './cx';

export interface ProgressRingProps {
  /** 0..1; null for an indeterminate ring. */
  value: number | null;
  size?: number;
  stroke?: number;
  /** Accessible name. */
  label: string;
  className?: string;
}

/** Circular progress (role=progressbar). Indeterminate spins only when motion is allowed. */
export default function ProgressRing({ value, size = 16, stroke = 2, label, className }: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = value == null ? 0.28 : Math.min(1, Math.max(0, value));
  return (
    <svg
      className={cx(styles.ring, className)}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={value == null ? undefined : 0}
      aria-valuemax={value == null ? undefined : 100}
      aria-valuenow={value == null ? undefined : Math.round(fraction * 100)}
    >
      <circle className={styles.track} cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
      <g className={value == null ? styles.indeterminate : undefined}>
        <circle
          className={styles.bar}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </g>
    </svg>
  );
}
