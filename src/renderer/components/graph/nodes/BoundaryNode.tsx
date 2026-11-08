import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { NodeProps } from '@xyflow/react';
import type { BoundaryNodeData } from '../../../types/graph';
import { PortRow, useConnectedHandles } from './PortHandle';
import styles from './Node.module.css';

/**
 * The input or output edge of an open subgraph definition. Definition inputs leave the input boundary node
 * as outputs; definition outputs arrive at the output boundary node as inputs.
 */
function BoundaryNode({ id, data: rawData, selected }: NodeProps) {
  const { t } = useTranslation();
  const data = rawData as BoundaryNodeData;
  const connected = useConnectedHandles(id);
  const side = data.direction === 'input' ? 'output' : 'input';
  return (
    <div className={`${styles.boundary}${selected ? ` ${styles.selected}` : ''}`} data-boundary={data.direction}>
      <div className={styles.boundaryTitle}>{data.direction === 'input' ? t('node.boundaryInputs') : t('node.boundaryOutputs')}</div>
      <ul className={styles.ports}>
        {data.ports.map((port) => (
          <PortRow key={port.id} nodeId={id} port={port} side={side} connected={connected.has(`${side === 'input' ? 'in' : 'out'}:${port.id}`)} focusable={Boolean(selected)} />
        ))}
      </ul>
    </div>
  );
}

export default memo(BoundaryNode);
