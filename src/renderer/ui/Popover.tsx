/**
 * Popover pieces: Radix's primitives and a styled content box.
 * Who uses it: components/sync/SyncIndicator.tsx and components/fields/FieldControl.tsx.
 */
import React, { forwardRef } from 'react';
import * as Pop from '@radix-ui/react-popover';
import styles from './Popover.module.css';
import { cx } from './cx';

/** Radix popover primitives, re-exported unstyled. */
export const PopoverRoot = Pop.Root;
export const PopoverTrigger = Pop.Trigger;
export const PopoverAnchor = Pop.Anchor;
export const PopoverClose = Pop.Close;

/** Styled, portalled popover surface at elevation 3. */
export const PopoverContent = forwardRef<HTMLDivElement, Pop.PopoverContentProps>(function PopoverContent(
  { className, sideOffset = 6, collisionPadding = 8, children, ...rest },
  ref,
) {
  return (
    <Pop.Portal>
      <Pop.Content ref={ref} className={cx(styles.content, className)} sideOffset={sideOffset} collisionPadding={collisionPadding} {...rest}>
        {/* The arrow lives outside the box, so the box itself cannot clip: an inner box scrolls. */}
        <div className={styles.scroll}>{children}</div>
        <Pop.Arrow className={styles.arrow} width={12} height={6} />
      </Pop.Content>
    </Pop.Portal>
  );
});
