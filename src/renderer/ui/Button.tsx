import React, { forwardRef } from 'react';
import styles from './Button.module.css';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'ghost' | 'subtle' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, keeps the width and disables the button. */
  loading?: boolean;
  /** Leading icon (lucide icon element). Decorative: give it aria-hidden. */
  icon?: React.ReactNode;
}

/**
 * The one button. `ghost` also carries the legacy `ghost-button` class so e2e selectors and older
 * panels keep working.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'md', loading = false, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(styles.button, styles[variant], styles[size], loading && styles.loading, variant === 'ghost' && 'ghost-button', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon ? <span className={styles.icon} aria-hidden="true">{icon}</span> : null}
      {children != null && children !== false ? <span className={styles.label}>{children}</span> : null}
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
    </button>
  );
});

export default Button;
