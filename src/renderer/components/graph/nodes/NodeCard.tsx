import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CircleSlash, Layers, Lock, Sparkles } from 'lucide-react';
import type { ComfyNodeData } from '../../../types/graph';
import { categoryAccent } from '../lib/typeColors';
import { categoryLabel } from '../lib/categoryLabel';
import { nodeRunMode, noteTextOf } from '../../../../shared/graph/layout';
import { useNodeDetail } from '../nodeInfo';
import { PortRow } from './PortHandle';
import FieldRow from './FieldRow';
import NoteText from './NoteText';
import { titleParts } from './titleBreaks';
import { nodeLayout } from '../../fields/fieldModel';
import { useCanvasView } from '../CanvasContext';
import MarkdownLite from '../../chat/MarkdownLite';
import { editorKind, fileBox, fileColors } from '../../../../shared/workflow/comfyLook';
import { ConstantLine, PrimitiveFields, PromotedFields, SavedValues, promotedInputNames } from './EditorNodes';
import { fileStyle, useClassPresence } from './nodeLook';
import { nodeDisplayName } from '../lib/nodeName';
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
  const baseLayout = nodeLayout(data, state.subgraph ? null : detail);
  // What the file says of the node (IMPORT+NODES): editor-only kinds, a class that is not installed, colours, size.
  const kind = state.subgraph ? null : editorKind(data.comfyType);
  const presence = useClassPresence(data.comfyType, Boolean(state.subgraph));
  const missing = presence === 'missing' && live;
  const promoted = state.subgraph ? promotedInputNames(data) : new Set<string>();
  const layout = promoted.size > 0 ? { ...baseLayout, linkInputs: baseLayout.linkInputs.filter((port) => !promoted.has(port.name)) } : baseLayout;
  const tinted = Boolean(fileColors(data).color || fileColors(data).bgcolor);
  // Subgraph instances have no catalog spec to place a value with; their fields show, read-only.
  const fieldsDisabled = !live || Boolean(data.locked) || view.readOnly || Boolean(state.subgraph);
  const primary = data.outputs[0]?.dataType || data.inputs[0]?.dataType || 'unknown';
  const accent = categoryAccent(detail?.category, primary);
  // How ComfyUI runs it (bypassed, muted) and a note's text, as the imported workflow saved them.
  const runMode = nodeRunMode(data as { comfy?: unknown });
  const noteText = noteTextOf(data as { comfyType: string; comfy?: unknown });
  const isNote = data.comfyType === 'Note' || data.comfyType === 'MarkdownNote';
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
    runMode ? styles.runModeOff : '',
    missing ? `${styles.missing} is-missing` : '',
    tinted ? styles.fileColor : '',
    kind === 'note' || kind === 'markdown' ? styles.noteNode : '',
  ].filter(Boolean).join(' ');
  // A node without its own title goes by the catalog's readable name (FB-15); the line under it names the class.
  const title = nodeDisplayName(data, detail?.displayName) || data.comfyType;
  // The line under the title names the class. When the title already is the class (no readable name known),
  // it says what the title does not: its pack, else its category.
  const classLine = title !== data.comfyType
    ? data.comfyType
    : detail?.displayName && detail.displayName !== title
      ? detail.displayName
      : detail?.pack && detail.pack !== 'core'
        ? detail.pack
        : categoryLabel(detail?.category, (key) => String(t(key)));
  return (
    <div
      className={classes}
      data-demo={data.demo ? 'true' : 'false'}
      data-primary-type={primary}
      data-node-kind={state.subgraph ? 'subgraph-instance' : 'node'}
      data-run-mode={runMode ?? undefined}
      data-build-pending={state.pending ? 'true' : undefined}
      data-editor-kind={kind ?? undefined}
      data-class-missing={missing ? 'true' : undefined}
      data-file-size={live && fileBox(data) ? 'true' : undefined}
      style={{ '--canvas-accent': accent, ...(live ? fileStyle(data) : {}) } as React.CSSProperties}
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
          {headerExtra ? <span className={`${styles.extra} graph-node-extra`}>{headerExtra}</span> : null}
        </div>
        <div className={`${styles.typeRow} graph-node-meta`}>
          {state.subgraph ? <span className={styles.badge}>{t('node.subgraph')}</span> : null}
          {data.demo ? <span className={styles.badge}>{t('node.demo')}</span> : null}
          {runMode ? <span className={`${styles.modeChip} ${runMode === 'bypassed' ? styles.modeBypassed : styles.modeMuted}`} title={String(t(runMode === 'bypassed' ? 'node.bypassedTitle' : 'node.mutedTitle'))}>{t(runMode === 'bypassed' ? 'node.bypassed' : 'node.muted')}</span> : null}
          {missing ? <span className={styles.missingChip} title={String(t('importLook.missingHint', { type: data.comfyType }))}><CircleSlash size={11} aria-hidden="true" />{t('importLook.missing')}</span> : null}
          {state.subgraph ? null : <span className={`${styles.classType} graph-node-type`} data-class-line={classLine === data.comfyType ? undefined : 'other'} title={data.comfyType}>{classLine}</span>}
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
      {state.subgraph && live ? <PromotedFields id={id} data={data} disabled={!live || view.readOnly || Boolean(data.locked)} connected={connected} focusable={Boolean(state.selected)} /> : null}
      {kind === 'primitive' && live ? <PrimitiveFields id={id} data={data} disabled={fieldsDisabled} /> : null}
      {kind === 'set' || kind === 'get' ? <ConstantLine data={data} kind={kind} /> : null}
      {missing ? <SavedValues data={data} /> : null}
      {noteText || isNote ? (
        // Editing: the person writes the note in place (NoteText.tsx); shown as before while not being written.
        <NoteText
          nodeId={id}
          text={noteText}
          editable={!fieldsDisabled}
          /* MarkdownLite draws a link as its words and address, never as something that opens. */
          display={kind === 'markdown' ? <MarkdownLite text={noteText} className={styles.noteMarkdown} /> : undefined}
        />
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
