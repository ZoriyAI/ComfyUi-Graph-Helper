import React from 'react';
import { useNodes, ViewportPortal } from '@xyflow/react';
import { useGraphStore } from '../../../state/graphState';
import { groupRect, type PositionedNode } from '../lib/geometry';
import styles from './GroupLayer.module.css';

/**
 * Groups as translucent rounded rectangles behind their members, with the title on top. Bounds follow the
 * members as they move (measured sizes from React Flow), else the stored native bounding.
 * Not React Flow nodes, so they never count as graph nodes. Only on the root level.
 */
export default function GroupLayer() {
  const groups = useGraphStore((state) => state.groups);
  const inDefinition = useGraphStore((state) => state.activeSubgraphId !== null);
  const nodes = useNodes() as PositionedNode[];
  if (inDefinition || groups.length === 0) return null;
  return (
    <ViewportPortal>
      {groups.map((group) => {
        const rect = groupRect(group, nodes);
        if (!rect) return null;
        return (
          <div
            key={group.id}
            className={styles.group}
            data-group-id={group.id}
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              ...(group.color ? { '--canvas-group': group.color } : {}),
            } as React.CSSProperties}
          >
            <div className={styles.title} data-group-id={group.id}>{group.title || '—'}</div>
          </div>
        );
      })}
    </ViewportPortal>
  );
}
