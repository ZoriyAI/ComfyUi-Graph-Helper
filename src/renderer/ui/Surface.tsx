import React, { forwardRef } from 'react';
import styles from './Surface.module.css';
import { cx } from './cx';

export type Elevation = 0 | 1 | 2 | 3;

export interface SurfaceProps extends React.HTMLAttributes<HTMLElement> {
  /** 0 canvas, 1 panel, 2 raised, 3 overlay. Each level is a step lighter with a deeper shadow. */
  elevation?: Elevation;
  as?: 'div' | 'section' | 'aside' | 'header' | 'footer' | 'nav';
  rounded?: boolean;
  /** No border or radius: for frame regions that meet the window edge. */
  flush?: boolean;
}

/** A layered night surface: lighter per level, 1px border, top inner highlight, soft shadow. */
const Surface = forwardRef<HTMLElement, SurfaceProps>(function Surface(
  { elevation = 1, as = 'div', rounded, flush, className, ...rest },
  ref,
) {
  const Tag = as as React.ElementType;
  return <Tag ref={ref} className={cx(styles.surface, styles[`e${elevation}`], rounded && styles.rounded, flush && styles.flush, className)} {...rest} />;
});

export default Surface;
