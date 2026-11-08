import React, { forwardRef, useId } from 'react';
import * as S from '@radix-ui/react-switch';
import styles from './Switch.module.css';
import { cx } from './cx';

export interface SwitchProps extends Omit<S.SwitchProps, 'children'> {
  /** Visible label; it is also the accessible name. */
  label: React.ReactNode;
  className?: string;
}

/** Radix switch with a visible label (click on the label toggles). */
const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch({ label, className, id, ...rest }, ref) {
  const fallback = useId();
  const switchId = id ?? fallback;
  return (
    <label className={cx(styles.row, className)} htmlFor={switchId}>
      <S.Root ref={ref} id={switchId} className={styles.root} {...rest}>
        <S.Thumb className={styles.thumb} />
      </S.Root>
      <span>{label}</span>
    </label>
  );
});

export default Switch;
