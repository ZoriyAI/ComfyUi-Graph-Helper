/**
 * The React Flow edge type "default" of the canvas: every link is drawn here. CanvasFlow registers it in edgeTypes.
 * Its colour is its data type's, so a person learns the types by sight; it passes through ComfyUI's own reroute
 * points and is memoised, since a big graph redraws many links on every change.
 */
import React, { memo } from 'react';
import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { useCanvasStore } from '../canvasStore';
import { useCanvasView } from '../CanvasContext';
import { EdgePulse } from '../layers/FlowLayer';
import { typeColor } from '../lib/typeColors';
import { pathThrough, useReroutePoints } from '../lib/nativeReroutes';
import { useMotionLevel } from '../../../motion/policy';
import { useFlash } from '../../../motion/attention';
import styles from './TypedEdge.module.css';

/**
 * An edge in the colour of its type: brighter and thicker when selected, drawn in once when it first
 * appears (stroke-dashoffset over --motion-reveal), and carrying flow pulses (FlowLayer's EdgePulse) while
 * lib/flow.ts marks it flowing.
 */
function TypedEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }: EdgeProps) {
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
  // While the connect assist is showing, every link steps back so the lit ports stand out.
  const dimmed = Boolean(view.plan);
  // Motion package: out of a tour or lesson focus unless it joins two nodes in focus; a flash when it just changed.
  const unfocused = view.focusNodes ? !(view.focusNodes.has(source) && view.focusNodes.has(target)) : false;
  const flashMark = useFlash(`edge:${id}`);
  const className = [
    styles.path,
    selected ? styles.selected : '',
    flowing ? styles.flowing : '',
    revealing ? styles.reveal : '',
    pending ? styles.pending : '',
    dimmed ? styles.dimmed : '',
    unfocused ? styles.unfocused : '',
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
        data-flash={flashMark}
      />
      {/* An invisible wide copy of the path: a 2 px line is too thin to click or right-click. */}
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
