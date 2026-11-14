import React, { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NodeProps } from '@xyflow/react';
import type { BoundaryNodeData, PortDefinition } from '../../../types/graph';
import { PortHandle, useConnectedHandles } from './PortHandle';
import { NEW_INPUT_SLOT, NEW_OUTPUT_SLOT } from '../lib/subgraphView';
import { typeColor } from '../lib/typeColors';
import { commitManual } from '../commit';
import { useCanvasView } from '../CanvasContext';
import styles from './Node.module.css';

/** One slot: its socket and its name; a double click on the name renames the slot (Enter saves, Esc cancels). */
function SlotRow({ nodeId, port, side, connected, focusable, slot }: {
  nodeId: string;
  port: PortDefinition;
  side: 'input' | 'output';
  connected: boolean;
  focusable: boolean;
  slot: { definitionId: string; direction: 'input' | 'output'; slotId: string } | null;
}) {
  const { t } = useTranslation();
  const view = useCanvasView();
  const [draft, setDraft] = useState<string | null>(null);
  const save = () => {
    const next = draft?.trim() ?? '';
    setDraft(null);
    if (slot && next !== '' && next !== port.name) {
      void commitManual({ type: 'rename-subgraph-io', definitionId: slot.definitionId, direction: slot.direction, slotId: slot.slotId, name: next }, 'rename-slot');
    }
  };
  const editable = Boolean(slot) && !view.readOnly;
  return (
    <li
      className={`${styles.port} ${side === 'input' ? styles.portIn : styles.portOut}`}
      data-port-type={port.dataType}
      data-port-side={side}
      data-port-handle={port.id}
      style={{ '--canvas-port': typeColor(port.dataType) } as React.CSSProperties}
    >
      <PortHandle nodeId={nodeId} port={port} side={side} connected={connected} focusable={focusable} />
      {draft !== null ? (
        <input
          className={`nodrag nopan ${styles.slotInput}`}
          value={draft}
          aria-label={String(t(slot?.direction === 'output' ? 'node.slotNameOutput' : 'node.slotNameInput'))}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') save();
            else if (event.key === 'Escape') setDraft(null);
          }}
        />
      ) : (
        <span
          className={`${styles.portName} port-name`}
          title={editable ? String(t('node.slotRenameHint')) : undefined}
          onDoubleClick={editable ? (event) => {
            event.stopPropagation();
            setDraft(port.name);
          } : undefined}
        >
          {port.name}
        </span>
      )}
      {draft === null && port.name.toLowerCase() !== port.dataType.toLowerCase() ? <span className={`${styles.portType} port-type`} title={port.dataType}>{port.dataType}</span> : null}
    </li>
  );
}

/**
 * The input or output edge of an open subgraph definition. Definition inputs leave the input boundary node
 * as outputs; definition outputs arrive at the output boundary node as inputs. A slot's name is renamed in place.
 * The last row is the empty slot: a link from an inner port to it adds a slot for that port.
 */
function BoundaryNode({ id, data: rawData, selected }: NodeProps) {
  const { t } = useTranslation();
  const data = rawData as BoundaryNodeData;
  const connected = useConnectedHandles(id);
  const side = data.direction === 'input' ? 'output' : 'input';
  const fresh = { id: data.direction === 'input' ? NEW_INPUT_SLOT : NEW_OUTPUT_SLOT, name: String(t(data.direction === 'input' ? 'node.newSlotInput' : 'node.newSlotOutput')), dataType: '*', optional: true };
  return (
    <div className={`${styles.boundary} graph-boundary${selected ? ` ${styles.selected}` : ''}`} data-boundary={data.direction}>
      <div className={`${styles.boundaryTitle} graph-boundary-title`}>{data.direction === 'input' ? t('node.boundaryInputs') : t('node.boundaryOutputs')}</div>
      <ul className={`${styles.ports} graph-boundary-ports`}>
        {data.ports.map((port, index) => (
          <SlotRow
            key={port.id}
            nodeId={id}
            port={port}
            side={side}
            connected={connected.has(`${side === 'input' ? 'in' : 'out'}:${port.id}`)}
            focusable={Boolean(selected)}
            slot={data.definitionId && data.slotIds?.[index] ? { definitionId: data.definitionId, direction: data.direction, slotId: data.slotIds[index] } : null}
          />
        ))}
        <li className={`${styles.port} ${side === 'input' ? styles.portIn : styles.portOut} ${styles.newSlot}`} data-port-side={side} data-port-handle={fresh.id} data-new-slot>
          <PortHandle nodeId={id} port={fresh} side={side} connected={false} focusable={Boolean(selected)} quiet />
          <span className={`${styles.portName} port-name`}>{fresh.name}</span>
        </li>
      </ul>
    </div>
  );
}

export default memo(BoundaryNode);
