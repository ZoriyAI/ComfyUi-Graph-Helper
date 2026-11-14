import React, { forwardRef } from 'react';
import styles from './IconButton.module.css';
import { cx } from './cx';

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Accessible name; required because the button shows only an icon. */
  label: string;
  size?: 'sm' | 'md';
  active?: boolean;
  children: React.ReactNode;
}

/** Square icon-only button. The label is the accessible name and the native tooltip. */
const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', active, className, children, type = 'button', title, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={title ?? label}
      data-active={active ? 'true' : undefined}
      className={cx(styles.iconButton, styles[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
});

export default IconButton;
