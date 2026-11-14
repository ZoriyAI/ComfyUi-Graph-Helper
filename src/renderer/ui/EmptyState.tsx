import React from 'react';
import styles from './EmptyState.module.css';
import { cx } from './cx';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /**
   * `regular` (default): a region of its own (a library tab), icon tile with a soft halo.
   * `compact`: inside a panel or dock tab, a smaller tile without the halo and less padding.
   */
  size?: 'regular' | 'compact';
  /** Extra content after the actions, full width (a list of suggested questions). */
  footer?: React.ReactNode;
  /** The title's element: a paragraph by default, a heading when the empty state is the region's first heading. */
  titleAs?: 'p' | 'h2' | 'h3';
}

/** Explains why a region is empty and what to do next: an icon, a title, one sentence, one action. */
export default function EmptyState({ icon, title, children, actions, className, size = 'regular', footer, titleAs: Title = 'p' }: EmptyStateProps) {
  return (
    <div className={cx(styles.empty, size === 'compact' && styles.compact, className)}>
      {icon ? <span className={styles.icon} aria-hidden="true">{icon}</span> : null}
      <Title className={styles.title}>{title}</Title>
      {children ? <div className={styles.body}>{children}</div> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  );
}
