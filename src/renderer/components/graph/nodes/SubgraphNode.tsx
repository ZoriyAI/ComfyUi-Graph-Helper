import React from 'react';
import { useTranslation } from 'react-i18next';
import { LogIn } from 'lucide-react';
import type { ComfyNodeData } from '../../../types/graph';
import { useGraphStore } from '../../../state/graphState';
import { useCanvasView } from '../CanvasContext';
import NodeCard from './NodeCard';
import { useConnectedHandles } from './PortHandle';
import { useNodeFlags } from './nodeFlags';
import styles from './Node.module.css';

/**
 * A subgraph instance: a container with ports on its border. Double frame, "Subgraph" badge, the definition
 * name, and an Enter affordance (button or double click) that opens the definition on the canvas.
 */
export default function SubgraphNode({ id, data, selected }: { id: string; data: ComfyNodeData; selected: boolean }) {
  const { t } = useTranslation();
  const flags = useNodeFlags(id);
  const connected = useConnectedHandles(id);
  const view = useCanvasView();
  const definitionId = data.subgraphId ?? data.comfyType;
  const definition = useGraphStore((state) => state.subgraphs.find((item) => item.id === definitionId));
  const enter = useGraphStore((state) => state.enterSubgraph);
  const name = definition?.name ?? definitionId;
  const canEnter = Boolean(definition) && !view.readOnly;
  return (
    <div className={styles.subgraphWrap} onDoubleClick={canEnter ? () => enter(definitionId) : undefined}>
      <NodeCard
        id={id}
        data={data}
        connected={connected}
        state={{ ...flags, selected, subgraph: true }}
        headerExtra={canEnter ? (
          <button
            type="button"
            className={`${styles.enter} nodrag`}
            aria-label={String(t('node.enterLabel', { name }))}
            title={String(t('node.enterLabel', { name }))}
            tabIndex={selected ? 0 : -1}
            onClick={(event) => {
              event.stopPropagation();
              enter(definitionId);
            }}
          >
            <LogIn size={12} aria-hidden="true" />
            <span>{t('node.enter')}</span>
          </button>
        ) : null}
        footer={<div className={styles.definitionName}>{name}</div>}
      />
    </div>
  );
}
