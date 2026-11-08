import React from 'react';
import styles from './EmptyState.module.css';
import { cx } from './cx';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/** Explains why a region is empty and what to do next. */
export default function EmptyState({ icon, title, children, actions, className }: EmptyStateProps) {
  return (
    <div className={cx(styles.empty, className)}>
      {icon ? <span className={styles.icon} aria-hidden="true">{icon}</span> : null}
      <p className={styles.title}>{title}</p>
      {children ? <div className={styles.body}>{children}</div> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
