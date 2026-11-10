import React from 'react';
import { useTranslation } from 'react-i18next';
import FieldControl from '../../fields/FieldControl';
import { commitField } from '../../fields/commitField';
import { controlKind, type FieldEntry } from '../../fields/fieldModel';
import { typeColor } from '../lib/typeColors';
import { PortHandle } from './PortHandle';
import styles from './Node.module.css';

interface FieldRowProps {
  nodeId: string;
  field: FieldEntry;
  /** A link feeds this widget input: the value comes from it, so the control gives way to "← link". */
  linked: boolean;
  focusable: boolean;
  /** Ghost cards: no live handle, no editing. */
  live: boolean;
  disabled: boolean;
}

/**
 * One field of a node: the name and a compact control showing the current value, editable in place. The quiet
 * handle on the left keeps a widget input linkable, as in ComfyUI. Stable classes `node-field` (row) and
 * `node-field-name` (label) let the overview zoom level style rows without reaching into the module.
 */
export default function FieldRow({ nodeId, field, linked, focusable, live, disabled }: FieldRowProps) {
  const { t } = useTranslation();
  const stacked = !linked && controlKind(field.spec, field.value) === 'string' && Boolean(field.spec?.multiline);
  const port = field.port;
  return (
    <li
      className={[styles.field, 'node-field', stacked ? styles.fieldStacked : '', linked ? styles.fieldLinked : ''].filter(Boolean).join(' ')}
      data-field={field.name}
      data-field-linked={linked ? 'true' : undefined}
      data-port-side={port ? 'input' : undefined}
      data-port-handle={port?.id}
      data-port-type={port?.dataType}
      style={port ? ({ '--canvas-port': typeColor(port.dataType) } as React.CSSProperties) : undefined}
    >
      {port && live ? <PortHandle nodeId={nodeId} port={port} side="input" connected={linked} focusable={focusable} quiet={!linked} /> : null}
      <span className={`${styles.fieldName} node-field-name`} title={field.tooltip ?? field.name}>{field.name}</span>
      {linked ? (
        <span className={styles.linkedMark} title={String(t('field.linkedHint'))}>{t('field.linked')}</span>
      ) : (
        <FieldControl
          nodeId={nodeId}
          name={field.name}
          value={field.value}
          spec={field.spec}
          variant="node"
          disabled={disabled}
          onCommit={(value) => void commitField(nodeId, field.name, value)}
        />
      )}
    </li>
  );
}
