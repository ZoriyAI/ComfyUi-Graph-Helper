import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Layers, Lock, Sparkles } from 'lucide-react';
import type { ComfyNodeData } from '../../../types/graph';
import { categoryAccent } from '../lib/typeColors';
import { useNodeDetail } from '../nodeInfo';
import { PortRow } from './PortHandle';
import FieldRow from './FieldRow';
import { titleParts } from './titleBreaks';
import { nodeLayout } from '../../fields/fieldModel';
import { useCanvasView } from '../CanvasContext';
import styles from './Node.module.css';

export interface NodeCardState {
  selected?: boolean;
  aiTouched?: boolean;
  ghost?: boolean;
  error?: boolean;
  dimmed?: boolean;
  revealing?: boolean;
  pending?: boolean;
  subgraph?: boolean;
}

interface NodeCardProps {
  id: string;
  data: ComfyNodeData;
  state: NodeCardState;
  connected: Set<string>;
  /** Live React Flow handles (real nodes) or plain dots (ghosts). */
  live?: boolean;
  /** Extra header content, e.g. the subgraph "Enter" button. */
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * The visual node: header strip in the category colour, link ports (inputs, then outputs), then the fields a person
 * sets by hand as live controls, and the note. Widget inputs are fields, not sockets: `seed`, `sampler_name`,
 * `lora_name` show their value and edit in place (a small handle still lets a link feed them).
 * Shared by real nodes, subgraph instances and add-node ghosts so they read as the same thing.
 * Keeps the legacy `.graph-node`, `.graph-node-title`, `.graph-node-type`, `.port-list`, `.is-selected` and
 * `.node-annotation` classes; field rows are `.node-fields` > `.node-field`.
 */
export default function NodeCard({ id, data, state, connected, live = true, headerExtra, footer }: NodeCardProps) {
  const { t } = useTranslation();
  const view = useCanvasView();
  const detail = useNodeDetail(state.subgraph ? undefined : data.comfyType);
  const layout = nodeLayout(data, state.subgraph ? null : detail);
  // Subgraph instances have no catalog spec to place a value with; their fields show, read-only.
  const fieldsDisabled = !live || Boolean(data.locked) || view.readOnly || Boolean(state.subgraph);
  const primary = data.outputs[0]?.dataType || data.inputs[0]?.dataType || 'unknown';
  const accent = categoryAccent(detail?.category, primary);
  const classes = [
    styles.node,
    'graph-node',
    state.selected ? `${styles.selected} is-selected` : '',
    data.locked ? `${styles.locked} is-locked` : '',
    state.aiTouched ? styles.aiTouched : '',
    state.ghost ? styles.ghost : '',
    state.error ? styles.error : '',
    state.dimmed ? styles.dimmed : '',
    state.revealing ? styles.revealing : '',
    state.pending ? styles.pending : '',
    state.subgraph ? styles.subgraph : '',
  ].filter(Boolean).join(' ');
  const title = data.title || detail?.displayName || data.comfyType;
  return (
    <div
      className={classes}
      data-demo={data.demo ? 'true' : 'false'}
      data-primary-type={primary}
      data-node-kind={state.subgraph ? 'subgraph-instance' : 'node'}
      data-build-pending={state.pending ? 'true' : undefined}
      style={{ '--canvas-accent': accent } as React.CSSProperties}
    >
      <div className={styles.header}>
        <div className={styles.titleRow}>
          {state.subgraph ? <Layers size={14} aria-hidden="true" className={styles.headerIcon} /> : null}
          <span className={`${styles.title} graph-node-title`}>
            {/* A class name wraps between its words, not in the middle of one; the text itself is unchanged. */}
            {titleParts(title).map((part, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <React.Fragment key={index}>{index > 0 ? <wbr /> : null}{part}</React.Fragment>
            ))}
          </span>
          {data.locked ? <Lock size={13} aria-label={String(t('node.locked'))} className={styles.headerIcon} /> : null}
          {state.error ? <AlertTriangle size={13} aria-label={String(t('node.error'))} className={styles.errorIcon} /> : null}
          {state.aiTouched ? <Sparkles size={13} aria-label={String(t('node.aiTouched'))} className={styles.aiIcon} /> : null}
          {headerExtra}
        </div>
        <div className={styles.typeRow}>
          {state.subgraph ? <span className={styles.badge}>{t('node.subgraph')}</span> : null}
          {data.demo ? <span className={styles.badge}>{t('node.demo')}</span> : null}
          {state.subgraph ? null : <span className={`${styles.classType} graph-node-type`}>{data.comfyType}</span>}
        </div>
      </div>
      {layout.linkInputs.length > 0 ? (
        <ul className={`${styles.ports} port-list`} aria-label={String(t('node.inputs'))}>
          {layout.linkInputs.map((port) => (
            <PortRow key={port.id} nodeId={id} port={port} side="input" connected={connected.has(`in:${port.id}`)} focusable={Boolean(state.selected)} live={live} />
          ))}
        </ul>
      ) : null}
      {data.outputs.length > 0 ? (
        <ul className={`${styles.ports} port-list`} aria-label={String(t('node.outputs'))}>
          {data.outputs.map((port) => (
            <PortRow key={port.id} nodeId={id} port={port} side="output" connected={connected.has(`out:${port.id}`)} focusable={Boolean(state.selected)} live={live} />
          ))}
        </ul>
      ) : null}
      {layout.fields.length > 0 ? (
        <ul className={`${styles.fields} node-fields`} aria-label={String(t('node.fields'))}>
          {layout.fields.map((field) => (
            <FieldRow
              key={field.name}
              nodeId={id}
              field={field}
              linked={field.port ? connected.has(`in:${field.port.id}`) : false}
              focusable={Boolean(state.selected)}
              live={live}
              disabled={fieldsDisabled}
            />
          ))}
        </ul>
      ) : null}
      {data.annotations && data.annotations.length > 0 ? (
        <div className={`${styles.annotation} node-annotation`}>
          <span className={styles.paramKey}>{t('node.note')} </span>
          {data.annotations[0]}
        </div>
      ) : null}
      {footer}
    </div>
  );
}
