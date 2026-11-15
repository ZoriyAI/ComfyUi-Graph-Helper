/**
 * Flow pulses: dots of the type colour travel from output to input along an edge (SVG animateMotion over
 * --motion-pulse). With reduced or no motion they become one static dot at the input end, so the
 * direction and the type stay readable without movement.
 *
 * Which edges flow is decided once per level by lib/flow.ts (focus, selection, tour step) and handed to
 * edges through CanvasViewContext; TypedEdge (edges/TypedEdge.tsx) renders this component for each flowing edge.
 */
import React, { useMemo } from 'react';
import { tokenMs, type MotionLevel } from '../../../motion/policy';
import styles from './FlowLayer.module.css';

/** The pulses of one edge along its SVG `path`; `target` is the input end, where the static dot sits. */
export function EdgePulse({ path, color, motion, target }: { path: string; color: string; motion: MotionLevel; target: { x: number; y: number } }) {
  const seconds = useMemo(() => tokenMs('--motion-pulse') / 1000, []);
  if (motion !== 'full') {
    // 10 px short of the input, so the dot is not hidden under the port handle.
    return <circle className={styles.static} cx={target.x - 10} cy={target.y} r={4} fill={color} data-flow="static" />;
  }
  // Three dots a third of the period apart; a negative begin starts them already spread along the path.
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
