import React from 'react';
import styles from './Skeleton.module.css';
import { cx } from './cx';

/** Loading placeholder. Decorative; pair it with an aria-busy container. */
export default function Skeleton({ width = '100%', height = 14, className }: { width?: number | string; height?: number | string; className?: string }) {
  return <span className={cx(styles.skeleton, className)} style={{ width, height }} aria-hidden="true" />;
}
