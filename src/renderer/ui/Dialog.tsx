import React, { forwardRef } from 'react';
import * as D from '@radix-ui/react-dialog';
import styles from './Dialog.module.css';
import { cx } from './cx';

export {
  Root as DialogRoot,
  Trigger as DialogTrigger,
  Portal as DialogPortal,
  Title as DialogTitle,
  Description as DialogDescription,
  Close as DialogClose,
} from '@radix-ui/react-dialog';

/** Scrim behind a modal dialog. */
export const DialogOverlay = forwardRef<HTMLDivElement, D.DialogOverlayProps>(function DialogOverlay({ className, ...rest }, ref) {
  return <D.Overlay ref={ref} className={cx(styles.overlay, 'dialog-overlay', className)} {...rest} />;
});

/**
 * Centred overlay surface (elevation 3). Enter/exit use --motion-enter/--motion-exit and --motion-shift,
 * so the motion policy (system/on/reduced/off) applies without code.
 */
export const DialogContent = forwardRef<HTMLDivElement, D.DialogContentProps>(function DialogContent({ className, ...rest }, ref) {
  return <D.Content ref={ref} className={cx(styles.content, className)} {...rest} />;
});
