import React from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, Position, useStore } from '@xyflow/react';
import { ChevronRight, Link2 } from 'lucide-react';
import type { FieldSpec } from '../../../../shared/contracts/knowledge';
import type { SubgraphDefinition } from '../../../../shared/graph/subgraphs';
import { SUBGRAPH_INPUT_NODE_ID } from '../../../../shared/graph/subgraphs';
import {
  collapsedWidth,
  constantName,
  isRunControl,
  primitiveTarget,
  promotedFields,
  ownPromotedValue,
  RUN_CONTROLS,
  savedValues,
  shownTitle,
  type PromotedField,
} from '../../../../shared/workflow/comfyLook';
import type { ComfyNodeData } from '../../../types/graph';
import { useGraphStore } from '../../../state/graphState';
import FieldControl from '../../fields/FieldControl';
import { fieldValue } from '../../fields/fieldModel';
import { useCanvasView } from '../CanvasContext';
import { commitManual } from '../commit';
import { useNodeDetail } from '../nodeInfo';
import { categoryAccent, typeColor } from '../lib/typeColors';
import { fileStyle } from './nodeLook';
import { PortHandle } from './PortHandle';
import { setCollapsed } from '../importLook';
import styles from './Node.module.css';

/** A value the file keeps in widgets_values[index] of a node: the edit names the slot, never a guessed field. */
export function commitWidget(nodeId: string, index: number, value: unknown): Promise<unknown> {
  return commitManual({ type: 'set-parameter', nodeId, key: `widgets::${index}`, value, widgetIndex: index }, 'parameter');
}

const RUN_SPEC: FieldSpec = { kind: 'combo', options: [...RUN_CONTROLS] };

/** Every handle of a node, stacked on its left and right edge: links still end at a collapsed node. */
function EdgeHandles({ data }: { data: ComfyNodeData }) {
  return (
    <>
      {data.inputs.map((port) => (
        <Handle key={`in-${port.id}`} type="target" position={Position.Left} id={port.id} className={styles.edgeHandle} isConnectable={false} data-port-type={port.dataType} />
      ))}
      {data.outputs.map((port) => (
        <Handle key={`out-${port.id}`} type="source" position={Position.Right} id={port.id} className={styles.edgeHandle} isConnectable={false} data-port-type={port.dataType} />
      ))}
    </>
  );
}

/**
 * A node the file saved collapsed: one title row, as in ComfyUI. Its links end at its left and right edge. The
 * arrow (or Alt+C, or the menu) opens it; the flag goes back to the file.
 */
export function CollapsedNode({ id, data, selected }: { id: string; data: ComfyNodeData; selected: boolean }) {
  const { t } = useTranslation();
  const view = useCanvasView();
  const detail = useNodeDetail(data.kind === 'subgraph-instance' ? undefined : data.comfyType);
  const primary = data.outputs[0]?.dataType || data.inputs[0]?.dataType || 'unknown';
  const title = shownTitle(data);
  const style = { ...fileStyle(data), width: `${collapsedWidth(title)}px`, minHeight: undefined, maxWidth: undefined, '--canvas-accent': categoryAccent(detail?.category, primary) } as React.CSSProperties;
  return (
    <div
      className={[styles.collapsed, 'graph-node', selected ? `${styles.selected} is-selected` : '', style['--file-color' as keyof React.CSSProperties] ? styles.fileColor : ''].filter(Boolean).join(' ')}
      data-collapsed="true"
      data-node-kind={data.kind === 'subgraph-instance' ? 'subgraph-instance' : 'node'}
      style={style}
      title={title}
    >
      <div className={styles.collapsedRow}>
        <button
          type="button"
          className={`${styles.expand} nodrag`}
          aria-label={String(t('importLook.expand', { name: title }))}
          title={String(t('importLook.expand', { name: title }))}
          tabIndex={selected ? 0 : -1}
          disabled={view.readOnly}
          onClick={(event) => {
            event.stopPropagation();
            void setCollapsed([id], false);
          }}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
        <span className={`${styles.collapsedTitle} graph-node-title`}>{title}</span>
      </div>
      <EdgeHandles data={data} />
    </div>
  );
}

/** The type a Reroute carries: the link coming in, else what the file says of its output. */
function useRerouteType(id: string, data: ComfyNodeData): string {
  const view = useCanvasView();
  const incoming = view.edges.find((edge) => edge.target === id);
  const type = String((incoming?.data as { dataType?: unknown } | undefined)?.dataType ?? '');
  if (type && type !== '*') return type;
  const out = data.outputs[0]?.dataType;
  return out && out !== '*' ? out : '*';
}

/** A Reroute: a small dot in the colour of what passes through it, with one input and one output. */
export function RerouteNode({ id, data, selected }: { id: string; data: ComfyNodeData; selected: boolean }) {
  const { t } = useTranslation();
  const type = useRerouteType(id, data);
  const view = useCanvasView();
  const input = data.inputs[0];
  const output = data.outputs[0];
  return (
    <div
      className={[styles.reroute, 'graph-node', selected ? `${styles.selected} is-selected` : ''].filter(Boolean).join(' ')}
      data-node-kind="reroute"
      data-reroute-type={type}
      style={{ '--canvas-port': typeColor(type) } as React.CSSProperties}
      title={String(t('importLook.reroute', { type }))}
    >
      <span className={styles.rerouteDot} aria-hidden="true" />
      {input ? <Handle type="target" position={Position.Left} id={input.id} className={styles.rerouteHandle} isConnectable={!view.readOnly} data-port-type={type} /> : null}
      {output ? <Handle type="source" position={Position.Right} id={output.id} className={styles.rerouteHandle} isConnectable={!view.readOnly} data-port-type={type} /> : null}
    </div>
  );
}

/** The class and input a Primitive feeds, from its first outgoing link on the level on screen. */
function usePrimitiveFeed(id: string): { classType: string | undefined; input: string | undefined } {
  const view = useCanvasView();
  const link = view.edges.find((edge) => edge.source === id);
  const targetId = link?.target;
  const target = useStore((state) => (targetId ? state.nodeLookup.get(targetId) : undefined));
  const data = target?.data as ComfyNodeData | undefined;
  const port = data?.inputs.find((item) => item.id === link?.targetHandle);
  return { classType: data?.comfyType, input: port?.name };
}

/**
 * A Primitive's value, edited as the field it feeds (a number with that field's range, a list with its options),
 * and its "after each run" switch when the file keeps one. Both go to the file's widgets_values.
 */
export function PrimitiveFields({ id, data, disabled }: { id: string; data: ComfyNodeData; disabled: boolean }) {
  const { t } = useTranslation();
  const feed = usePrimitiveFeed(id);
  const target = primitiveTarget(data);
  const detail = useNodeDetail(feed.classType);
  const name = feed.input ?? target.widget ?? 'value';
  const spec = detail?.inputs.find((input) => input.name === name)?.spec;
  const values = savedValues(data);
  if (values.length === 0) return <p className={styles.editorHint}>{t('importLook.primitiveEmpty')}</p>;
  return (
    <ul className={`${styles.fields} node-fields`} aria-label={String(t('node.fields'))} data-primitive-for={name}>
      <li className={`${styles.field} node-field`} data-field={name}>
        <span className={`${styles.fieldName} node-field-name`} title={String(t('importLook.primitiveFeeds', { name }))}>{name}</span>
        <FieldControl nodeId={id} name={name} value={values[0]} spec={spec} variant="node" disabled={disabled} onCommit={(value) => void commitWidget(id, 0, value)} />
      </li>
      {isRunControl(values[1]) ? (
        <li className={`${styles.field} node-field`} data-field="control_after_generate">
          <span className={`${styles.fieldName} node-field-name`} title={String(t('importLook.runControlHint'))}>{t('importLook.runControl')}</span>
          <FieldControl nodeId={id} name="control_after_generate" value={values[1]} spec={RUN_SPEC} variant="node" disabled={disabled} onCommit={(value) => void commitWidget(id, 1, value)} />
        </li>
      ) : null}
    </ul>
  );
}

/** The constant a Set stores under or a Get reads, read-only (ComfyUI ties them by this name when it runs). */
export function ConstantLine({ data, kind }: { data: ComfyNodeData; kind: 'set' | 'get' }) {
  const { t } = useTranslation();
  const name = constantName(data);
  return (
    <p className={styles.constant} data-constant={name}>
      <Link2 size={12} aria-hidden="true" />
      <span>{t(kind === 'set' ? 'importLook.setLine' : 'importLook.getLine', { name: name || '—' })}</span>
    </p>
  );
}

/** What a node of a class that is not installed saved, read-only: the values in their order. */
export function SavedValues({ data }: { data: ComfyNodeData }) {
  const { t } = useTranslation();
  const values = savedValues(data);
  if (values.length === 0) return null;
  return (
    <ul className={styles.savedValues} aria-label={String(t('importLook.savedValues'))} data-saved-values={values.length}>
      {values.map((value, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <li key={index}>
          <span className={styles.savedIndex}>{index + 1}</span>
          <span className={styles.savedValue}>{readable(value, String(t('importLook.serviceData')))}</span>
        </li>
      ))}
    </ul>
  );
}

function readable(value: unknown, service: string): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return service;
  return String(value);
}

// ── Promoted fields of a subgraph copy ────────────────────────────────────────────────────────────

/** Where a promoted field's value lives: the copy's own slot, or an inner node's field (with its key there). */
interface PromotedSource {
  innerNodeId: string | null;
  innerKey: string | null;
  innerClass: string | undefined;
  innerData: ComfyNodeData | undefined;
  /** The input name the inner node knows the field by (for its spec). */
  specName: string;
}

function resolvePromoted(field: PromotedField, fields: PromotedField[], definition: SubgraphDefinition | undefined): PromotedSource {
  const empty: PromotedSource = { innerNodeId: null, innerKey: null, innerClass: undefined, innerData: undefined, specName: field.name };
  if (!definition) return empty;
  const nodeOf = (nodeId: string) => definition.nodes.find((node) => String(node.id) === nodeId);
  if (field.nodeId !== '-1') {
    const inner = nodeOf(field.nodeId);
    if (!inner) return empty;
    // `control_after_generate` rides with the field before it (seed): its key is `seed::control_after_generate`.
    let key = field.name;
    if (field.name === 'control_after_generate' || field.name === 'control_filter_list') {
      const before = fields.filter((item) => item.nodeId === field.nodeId && item.index < field.index && !item.name.startsWith('control_')).pop();
      if (before) key = `${before.name}::${field.name}`;
    }
    const data = inner.data as ComfyNodeData;
    return { innerNodeId: field.nodeId, innerKey: key, innerClass: data?.comfyType, innerData: data, specName: key.split('::')[0] };
  }
  // The copy's own field: a subgraph input with a widget. Inside, its value reaches the inner field it is linked to.
  const slot = definition.inputs.findIndex((input) => input.name === field.name);
  if (slot < 0) return empty;
  const link = definition.edges.find((edge) => String(edge.source) === SUBGRAPH_INPUT_NODE_ID && String(edge.sourceHandle) === `out-${slot}`);
  const inner = link ? nodeOf(String(link.target)) : undefined;
  const data = inner?.data as ComfyNodeData | undefined;
  const port = data?.inputs.find((input) => input.id === link?.targetHandle);
  if (!inner || !port) return empty;
  return { innerNodeId: String(inner.id), innerKey: port.name, innerClass: data?.comfyType, innerData: data, specName: port.name };
}

function PromotedRow({ id, data, field, fields, definition, disabled, connected, focusable, panel }: {
  id: string;
  data: ComfyNodeData;
  field: PromotedField;
  fields: PromotedField[];
  definition: SubgraphDefinition | undefined;
  disabled: boolean;
  connected: Set<string>;
  focusable: boolean;
  panel: boolean;
}) {
  const { t } = useTranslation();
  const source = resolvePromoted(field, fields, definition);
  const detail = useNodeDetail(source.innerClass);
  const own = field.nodeId === '-1' ? ownPromotedValue(data, field) : { held: false, value: undefined };
  const found = source.innerKey?.endsWith('::control_after_generate')
    ? RUN_SPEC
    : detail?.inputs.find((input) => input.name === source.specName)?.spec;
  // On the copy every promoted field is one row (a long prompt is a one-line box); Properties gives it its full box.
  const spec = found && !panel && found.multiline ? { ...found, multiline: false } : found;
  const value = own.held
    ? own.value
    : source.innerData && source.innerKey ? fieldValue(source.innerData, source.innerKey, detail?.widgetOrder) : undefined;
  const label = field.name === 'control_after_generate' ? String(t('importLook.runControl')) : field.name;
  const commit = (next: unknown) => {
    if (own.held) {
      void commitWidget(id, field.index, next);
      return;
    }
    if (!definition || !source.innerNodeId || !source.innerKey) return;
    const index = detail?.widgetOrder.indexOf(source.innerKey) ?? -1;
    void commitManual({ type: 'edit-in-subgraph', definitionId: definition.id, edit: { type: 'set-parameter', nodeId: source.innerNodeId, key: source.innerKey, value: next, ...(index >= 0 ? { widgetIndex: index } : {}) } }, 'parameter');
  };
  const known = own.held || Boolean(source.innerNodeId);
  // The copy's own field is also its input: a link can still feed it, as on any field.
  const port = field.nodeId === '-1' ? data.inputs.find((input) => input.name === field.name) : undefined;
  const linked = port ? connected.has(`in:${port.id}`) : false;
  return (
    <li
      className={[styles.field, 'node-field', linked ? styles.fieldLinked : ''].filter(Boolean).join(' ')}
      data-field={field.name}
      data-promoted={field.nodeId === '-1' ? 'own' : 'inner'}
      data-port-side={port ? 'input' : undefined}
      data-port-handle={port?.id}
      style={port ? ({ '--canvas-port': typeColor(port.dataType) } as React.CSSProperties) : undefined}
    >
      {port && !panel ? <PortHandle nodeId={id} port={port} side="input" connected={linked} focusable={focusable} quiet={!linked} /> : null}
      <span className={`${styles.fieldName} node-field-name`} title={String(t('importLook.promotedHint'))}>{label}</span>
      {linked
        ? <span className={styles.linkedMark} title={String(t('field.linkedHint'))}>{t('field.linked')}</span>
        : <FieldControl nodeId={id} name={field.name} value={value} spec={spec} variant={panel ? 'panel' : 'node'} disabled={disabled || !known} onCommit={commit} />}
    </li>
  );
}

/**
 * The fields the subgraph's author promoted to its copies (`properties.proxyWidgets`), in the file's order, editable
 * on the copy: the copy's own value goes to its widgets_values slot, an inner field's to that node in the subgraph.
 */
export function PromotedFields({ id, data, disabled, connected, focusable, panel = false }: { id: string; data: ComfyNodeData; disabled: boolean; connected: Set<string>; focusable: boolean; panel?: boolean }) {
  const { t } = useTranslation();
  const fields = promotedFields(data);
  const definitionId = data.subgraphId ?? data.comfyType;
  const definition = useGraphStore((state) => state.subgraphs.find((item) => item.id === definitionId));
  if (fields.length === 0) return null;
  return (
    <ul className={panel ? styles.promotedPanel : `${styles.fields} node-fields`} aria-label={String(t('importLook.promoted'))} data-promoted-fields={fields.length}>
      {fields.map((field) => (
        <PromotedRow key={`${field.index}-${field.nodeId}-${field.name}`} id={id} data={data} field={field} fields={fields} definition={definition} disabled={disabled} connected={connected} focusable={focusable} panel={panel} />
      ))}
    </ul>
  );
}

/** Names of the inputs a copy's promoted fields stand for: those ports are not repeated as sockets. */
export function promotedInputNames(data: ComfyNodeData): Set<string> {
  return new Set(promotedFields(data).filter((field) => field.nodeId === '-1').map((field) => field.name));
}
