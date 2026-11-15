/**
 * An on/off switch with its label. Who uses it: settings sections (Canvas, Privacy and others),
 * components/lessons/LessonEditor.tsx and components/log/ModelLogDialog.tsx.
 */
import React, { forwardRef, useId } from 'react';
import * as S from '@radix-ui/react-switch';
import styles from './Switch.module.css';
import { cx } from './cx';

/** Props of Switch: Radix switch props plus a visible label. */
export interface SwitchProps extends Omit<S.SwitchProps, 'children'> {
  /** Visible label; it is also the accessible name. */
  label: React.ReactNode;
  className?: string;
}

/** Radix switch with a visible label (click on the label toggles). */
const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch({ label, className, id, ...rest }, ref) {
  // The label points at the switch by id; a caller that gives none gets a generated one.
  const fallback = useId();
  const switchId = id ?? fallback;
  return (
    <label className={cx(styles.row, 'switch-row', className)} htmlFor={switchId}>
      <S.Root ref={ref} id={switchId} className={styles.root} {...rest}>
        <S.Thumb className={styles.thumb} />
      </S.Root>
      <span>{label}</span>
    </label>
  );
});

export default Switch;
