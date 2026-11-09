import React, { useMemo } from 'react';
import { parseDuration, type MotionLevel } from '../lib/motion';
import styles from './FlowLayer.module.css';

/**
 * Flow pulses: dots of the type colour travel from output to input along an edge (SVG animateMotion over
 * --motion-pulse). With reduced or no motion they become one static dot at the input end, so the
 * direction and the type stay readable without movement.
 *
 * Which edges flow is decided once per level by lib/flow.ts (focus, selection, tour step) and handed to
 * edges through CanvasViewContext; TypedEdge renders this component for each flowing edge.
 */
export function EdgePulse({ path, color, motion, target }: { path: string; color: string; motion: MotionLevel; target: { x: number; y: number } }) {
  const seconds = useMemo(() => parseDuration(getComputedStyle(document.documentElement).getPropertyValue('--motion-pulse'), 1400) / 1000, []);
  if (motion !== 'full') {
    return <circle className={styles.static} cx={target.x - 10} cy={target.y} r={4} fill={color} data-flow="static" />;
  }
  return (
    <g className={styles.pulses} data-flow="pulse" style={{ '--canvas-pulse-color': color } as React.CSSProperties}>
      {[0, 1, 2].map((index) => (
        <circle key={index} r={index === 0 ? 4 : 3} fill={color} className={styles.pulse}>
          <animateMotion dur={`${seconds}s`} begin={`-${((index * seconds) / 3).toFixed(3)}s`} repeatCount="indefinite" path={path} />
        </circle>
      ))}
    </g>
  );
}
