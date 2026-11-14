import React, { memo } from 'react';
import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { useCanvasStore } from '../canvasStore';
import { useCanvasView } from '../CanvasContext';
import { EdgePulse } from '../layers/FlowLayer';
import { typeColor } from '../lib/typeColors';
import { useMotionLevel } from '../lib/motion';
import { pathThrough, useReroutePoints } from '../lib/nativeReroutes';
import styles from './TypedEdge.module.css';

/**
 * An edge in the colour of its type: brighter and thicker when selected, drawn in once when it first
 * appears (stroke-dashoffset over --motion-reveal), and carrying flow pulses when FlowLayer says so.
 */
function TypedEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }: EdgeProps) {
  const [bezier] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  // ComfyUI's own reroute points on a link (IMPORT+NODES): the link passes through each of them.
  const via = useReroutePoints(id);
  const path = via && via.length > 0 ? pathThrough([{ x: sourceX, y: sourceY }, ...via, { x: targetX, y: targetY }]) : bezier;
  const view = useCanvasView();
  const motion = useMotionLevel();
  const revealing = useCanvasStore((state) => Boolean(state.justAdded[id]));
  const pending = useCanvasStore((state) => state.pending.includes(id));
  const dataType = String((data as { dataType?: unknown } | undefined)?.dataType ?? '');
  const color = typeColor(dataType);
  const flowing = view.flowing.has(id);
  const dimmed = Boolean(view.plan);
  const className = [
    styles.path,
    selected ? styles.selected : '',
    flowing ? styles.flowing : '',
    revealing ? styles.reveal : '',
    pending ? styles.pending : '',
    dimmed ? styles.dimmed : '',
  ].filter(Boolean).join(' ');
  return (
    <>
      <path
        d={path}
        fill="none"
        className={`react-flow__edge-path ${className}`}
        pathLength={revealing ? 1 : undefined}
        style={{ '--canvas-edge': color } as React.CSSProperties}
        data-edge-type={dataType}
      />
      <path d={path} fill="none" strokeOpacity={0} strokeWidth={20} className="react-flow__edge-interaction" />
      {via?.map((point) => <circle key={point.id} cx={point.x} cy={point.y} r={5} className={styles.reroutePoint} style={{ '--canvas-edge': color } as React.CSSProperties} data-reroute-point={point.id} />)}
      {flowing && !pending ? (
        <>
          <EdgePulse path={path} color={color} motion={motion} target={{ x: targetX, y: targetY }} />
          <EdgeLabelRenderer>
            <div
              className={styles.label}
              style={{ transform: `translate(-100%, -50%) translate(${targetX - 18}px, ${targetY - 16}px)`, '--canvas-edge': color } as React.CSSProperties}
            >
              {dataType || '?'}
            </div>
          </EdgeLabelRenderer>
        </>
      ) : null}
    </>
  );
}

export default memo(TypedEdge);
