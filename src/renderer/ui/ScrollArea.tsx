import React, { forwardRef } from 'react';
import * as SA from '@radix-ui/react-scroll-area';
import styles from './ScrollArea.module.css';
import { cx } from './cx';

export interface ScrollAreaProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'dir'> {
  /** Ref to the scrolling viewport (for windowed lists). */
  viewportRef?: React.Ref<HTMLDivElement>;
  onViewportScroll?: React.UIEventHandler<HTMLDivElement>;
  horizontal?: boolean;
}

/** Radix scroll area with thin night scrollbars. The viewport is what scrolls. */
const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { className, children, viewportRef, onViewportScroll, horizontal, ...rest },
  ref,
) {
  return (
    <SA.Root ref={ref} className={cx(styles.root, className)} type="hover" {...rest}>
      <SA.Viewport ref={viewportRef} className={styles.viewport} onScroll={onViewportScroll}>
        {children}
      </SA.Viewport>
      <SA.Scrollbar className={styles.scrollbar} orientation="vertical">
        <SA.Thumb className={styles.thumb} />
      </SA.Scrollbar>
      {horizontal ? (
        <SA.Scrollbar className={styles.scrollbar} orientation="horizontal">
          <SA.Thumb className={styles.thumb} />
        </SA.Scrollbar>
      ) : null}
    </SA.Root>
  );
});

export default ScrollArea;
