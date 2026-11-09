import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Layers, Lock, Sparkles } from 'lucide-react';
import type { ComfyNodeData } from '../../../types/graph';
import { categoryAccent } from '../lib/typeColors';
import { useNodeDetail } from '../nodeInfo';
import { PortRow } from './PortHandle';
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

function short(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
  return text.length > 24 ? `${text.slice(0, 24)}…` : text;
}

/**
 * The visual node: header strip in the category colour, typed ports, the first parameters and the note.
 * Shared by real nodes, subgraph instances and add-node ghosts so they read as the same thing.
 * Keeps the legacy `.graph-node`, `.is-selected` and `.node-annotation` classes the e2e tests look for.
 */
export default function NodeCard({ id, data, state, connected, live = true, headerExtra, footer }: NodeCardProps) {
  const { t } = useTranslation();
  const detail = useNodeDetail(state.subgraph || state.ghost ? undefined : data.comfyType);
  const parameters = Object.entries(data.parameters || {});
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
      style={{ '--canvas-accent': accent } as React.CSSProperties}
    >
      <div className={styles.header}>
        <div className={styles.titleRow}>
          {state.subgraph ? <Layers size={14} aria-hidden="true" className={styles.headerIcon} /> : null}
          <span className={`${styles.title} graph-node-title`}>{title}</span>
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
      {data.inputs.length > 0 ? (
        <ul className={`${styles.ports} port-list`} aria-label={String(t('node.inputs'))}>
          {data.inputs.map((port) => (
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
      {parameters.length > 0 ? (
        <div className={styles.params}>
          {parameters.slice(0, 3).map(([key, value]) => (
            <div key={key} className={styles.param}>
              <span className={styles.paramKey}>{key}</span>
              <span className={styles.paramValue}>{short(value)}</span>
            </div>
          ))}
          {parameters.length > 3 ? <div className={styles.paramKey}>{t('node.more', { count: parameters.length - 3 })}</div> : null}
        </div>
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
