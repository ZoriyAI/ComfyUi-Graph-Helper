import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleHelp, LogIn, MessageCircleQuestion, Ungroup } from 'lucide-react';
import { listSubgraphDefinitions, type ComponentOwnerKind, type ComponentRecord } from '../../../shared/components/model';
import { objectKey, type ObjectRef } from '../../../shared/contracts/objects';
import type { Explanation, Provenance } from '../../../shared/contracts/knowledge';
import { useGraphStore } from '../../state/graphState';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { edgeKnowledge, linkTypeRef } from './lib/linkTypeKnowledge';
import type { ComfyNodeData, GraphEdge, GraphNode } from '../../types/graph';
import Illustration from './illustrations/Illustration';
import { askAbout } from './askAbout';
import { commitManual } from './commit';
import { useNodeDetail } from './nodeInfo';
import { nodeRef, portRef } from './lib/selection';
import { useLevelGraph } from './lib/levelGraph';
import { useCanvasStore } from './canvasStore';
import FieldControl from '../fields/FieldControl';
import { commitField } from '../fields/commitField';
import { isSeedField, nodeLayout, type FieldEntry } from '../fields/fieldModel';
import { typeColor } from './lib/typeColors';
import SubgraphSummary from './SubgraphSummary';
import styles from './Inspector.module.css';

function recordFor(components: ComponentRecord[], kind: ComponentOwnerKind, ownerId: string): ComponentRecord | undefined {
  return components.find((item) => item.ownerKind === kind && item.ownerId === ownerId);
}

function DocsEditor({
  ownerKind,
  ownerId,
  purpose,
  usage,
  heading,
}: {
  ownerKind: ComponentOwnerKind;
  ownerId: string;
  purpose: string;
  usage: string;
  heading: string;
}) {
  const { t } = useTranslation();
  const [draftPurpose, setDraftPurpose] = useState(purpose);
  const [draftUsage, setDraftUsage] = useState(usage);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setDraftPurpose(purpose);
    setDraftUsage(usage);
  }, [ownerKind, ownerId, purpose, usage]);
  const dirty = draftPurpose !== purpose || draftUsage !== usage;
  const purposeId = `component-purpose-${ownerKind}-${ownerId}`;
  const usageId = `component-usage-${ownerKind}-${ownerId}`;
  const save = () => {
    if (!dirty || pending) return;
    setPending(true);
    void commitManual({ type: 'set-component', ownerKind, ownerId, purpose: draftPurpose, usage: draftUsage }, 'component')
      .finally(() => setPending(false));
  };
  return (
    <form
      className={`inspector-docs ${styles.docs}`}
      data-component-owner={`${ownerKind}:${ownerId}`}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <h3 className={styles.h3}>{heading}</h3>
      <p className={`inspector-type ${styles.mono}`}>{ownerId}</p>
      <label htmlFor={purposeId}>{t('inspector.purpose')}</label>
      <textarea id={purposeId} className={styles.field} value={draftPurpose} aria-describedby={`${purposeId}-hint`} onChange={(event) => setDraftPurpose(event.target.value)} />
      <p id={`${purposeId}-hint`} className={`inspector-empty ${styles.hint}`}>{t('inspector.purposeHint')}</p>
      <label htmlFor={usageId}>{t('inspector.usage')}</label>
      <textarea id={usageId} className={styles.field} value={draftUsage} aria-describedby={`${usageId}-hint`} onChange={(event) => setDraftUsage(event.target.value)} />
      <p id={`${usageId}-hint`} className={`inspector-empty ${styles.hint}`}>{t('inspector.usageHint')}</p>
      <button type="button" className="ghost-button" disabled={!dirty || pending} onClick={save}>{t('inspector.saveDocs')}</button>
    </form>
  );
}

const PROVENANCE_KEY: Record<Provenance, string> = {
  fact: 'inspector.provenanceFact',
  inference: 'inspector.provenanceInference',
  web: 'inspector.provenanceWeb',
  user: 'inspector.provenanceUser',
};

/**
 * The latest explanation lines for one or more owners, with their provenance badges. `fallback` (an edge's data
 * type) is shown only when the owners have nothing of their own.
 */
function Explanations({ refs, fallback = null }: { refs: ObjectRef[]; fallback?: ObjectRef | null }) {
  const { t } = useTranslation();
  const keys = refs.map(objectKey);
  const fallbackKey = fallback ? objectKey(fallback) : '';
  const cache = useKnowledgeStore((state) => state.explanations);
  const load = useKnowledgeStore((state) => state.loadExplanations);
  const joined = [...keys, fallbackKey].join('|');
  useEffect(() => {
    for (const ref of [...refs, ...(fallback ? [fallback] : [])]) void load(ref).catch(() => []);
    // refs are rebuilt each render; their keys say when they changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, load]);
  const own = keys.flatMap((key) => cache[key] ?? []);
  const list: Explanation[] = edgeKnowledge(own, fallbackKey ? cache[fallbackKey] : undefined)
    .sort((left, right) => right.createdAt - left.createdAt).slice(0, 4);
  return (
    <div className={styles.explanations}>
      <h3 className={styles.h3}>{t('inspector.explanations')}</h3>
      {list.length === 0 ? <p className={`inspector-empty ${styles.hint}`}>{t('inspector.noExplanations')}</p> : (
        <ul className={styles.lines}>
          {list.map((item) => (
            <li key={item.id} className={styles.line}>
              <span className={`${styles.badge} ${styles[`prov_${item.provenance}`] ?? ''}`}>{t(PROVENANCE_KEY[item.provenance])}</span>
              <span>{item.text}</span>
              {item.sourceUrl ? <span className={styles.source}>{item.sourceUrl}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One field in Properties: the name, the same control as on the node at full width, the node author's tooltip from
 * object_info under it, and a "?" that asks the helper about this field. A field fed by a link says so instead.
 */
function ParameterField({ nodeId, nodeName, field, linked, disabled }: { nodeId: string; nodeName: string; field: FieldEntry; linked: boolean; disabled: boolean }) {
  const { t } = useTranslation();
  const labelId = `node-param-${nodeId}-${field.name}-label`;
  const ref = field.port ? portRef(nodeId, field.port.id, 'input', field.name) : { kind: 'node' as const, id: nodeId };
  // The range helps where it is a real limit (steps 1–10000, denoise 0–1); a seed's 0–2^48 is noise.
  const spec = field.spec;
  const range = spec && (spec.kind === 'int' || spec.kind === 'float') && spec.min !== undefined && spec.max !== undefined
    && !isSeedField(field.name, spec) && Math.abs(spec.max) < 1e9
    ? String(t('field.range', { min: spec.min, max: spec.max }))
    : null;
  return (
    <div className={`inspector-field ${styles.param}`} data-field={field.name}>
      <div className={styles.paramHead}>
        <span id={labelId} className={styles.paramName}>{field.name}</span>
        <button
          type="button"
          className={styles.ask}
          aria-label={String(t('field.ask'))}
          title={String(t('field.ask'))}
          onClick={() => askAbout(ref, String(t('field.askMessage', { name: field.name, node: nodeName })))}
        >
          <CircleHelp size={14} aria-hidden="true" />
        </button>
      </div>
      {linked ? (
        <p className={styles.linkedField}>{t('field.linked')} · {t('field.linkedHint')}</p>
      ) : (
        <FieldControl
          nodeId={nodeId}
          name={field.name}
          value={field.value}
          spec={field.spec}
          variant="panel"
          labelledBy={labelId}
          disabled={disabled}
          onCommit={(value) => void commitField(nodeId, field.name, value)}
        />
      )}
      {field.tooltip || range ? (
        <p className={`inspector-empty ${styles.hint}`}>{[field.tooltip, range].filter(Boolean).join(' · ')}</p>
      ) : null}
    </div>
  );
}

function NodeSection({ node, edges }: { node: GraphNode; edges: GraphEdge[] }) {
  const { t } = useTranslation();
  const data = node.data as ComfyNodeData;
  const instance = data.kind === 'subgraph-instance';
  const detail = useNodeDetail(instance ? undefined : data.comfyType);
  const subgraphs = useGraphStore((state) => state.subgraphs);
  const enter = useGraphStore((state) => state.enterSubgraph);
  const definition = instance ? subgraphs.find((item) => item.id === (data.subgraphId ?? data.comfyType)) : undefined;
  const [name, setName] = useState(definition?.name ?? '');
  useEffect(() => setName(definition?.name ?? ''), [definition?.name]);
  const ref = nodeRef(node);
  const canvasReplay = useCanvasStore((state) => Boolean(state.replay));
  const title = String(data.title || detail?.displayName || data.comfyType);
  const connected = (side: 'in' | 'out', handle: string) => edges.some((edge) => (side === 'in'
    ? edge.target === node.id && edge.targetHandle === handle
    : edge.source === node.id && edge.sourceHandle === handle));
  const layout = nodeLayout(data, instance ? null : detail);
  const linkedField = (field: FieldEntry) => Boolean(field.port && connected('in', field.port.id));
  // Link ports only; a widget input fed by a link is listed too, as connected, so the table shows every link.
  const ports = [
    ...layout.linkInputs.map((port) => ({ ...port, direction: 'in' as const })),
    ...layout.fields.filter(linkedField).map((field) => ({ ...field.port!, direction: 'in' as const })),
    ...data.outputs.map((port) => ({ ...port, direction: 'out' as const })),
  ];
  const tooltips = new Map((detail?.inputs ?? []).filter((input) => input.tooltip).map((input) => [input.name, input.tooltip!]));
  const readOnly = Boolean(data.locked) || instance || canvasReplay;
  // Values came with the workflow, but the app cannot name them until it has read this class from ComfyUI.
  const stored = (data as { comfy?: { widgets_values?: unknown } }).comfy?.widgets_values;
  const unnamedValues = !instance && !detail && (Array.isArray(stored) ? stored.length > 0 : Boolean(stored && typeof stored === 'object' && Object.keys(stored).length > 0));
  return (
    <>
      <header className={styles.header}>
        <Illustration classType={instance ? undefined : data.comfyType} hoverPlay />
        <div className={styles.headText}>
          <h2 className={styles.h2}>{title}</h2>
          <p className={`inspector-type ${styles.mono}`}>{instance ? definition?.name ?? data.comfyType : data.comfyType}</p>
          {detail?.category ? <p className={styles.meta}>{t('inspector.category')}: {detail.category}</p> : null}
        </div>
      </header>
      <button
        type="button"
        className={`ghost-button ${styles.explain}`}
        onClick={() => askAbout(ref, String(instance ? t('inspector.askSubgraph', { name: definition?.name ?? title }) : t('inspector.askNode', { name: title })))}
      >
        <MessageCircleQuestion size={16} aria-hidden="true" />
        {t('inspector.explain')}
      </button>
      {detail?.description ? <p className={styles.description}>{detail.description}</p> : null}
      {instance && definition ? (
        <div className={styles.instance}>
          <h3 className={styles.h3}>{t('inspector.instanceHeading')}</h3>
          <form
            className={styles.rename}
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim() && name.trim() !== definition.name) void commitManual({ type: 'rename-subgraph', definitionId: definition.id, name: name.trim() }, 'rename');
            }}
          >
            <label htmlFor={`subgraph-name-${definition.id}`}>{t('inspector.renameLabel')}</label>
            <input id={`subgraph-name-${definition.id}`} className={styles.field} value={name} onChange={(event) => setName(event.target.value)} />
            <button type="submit" className="ghost-button" disabled={!name.trim() || name.trim() === definition.name}>{t('inspector.saveName')}</button>
          </form>
          <div className={styles.actions}>
            <button type="button" className="ghost-button" onClick={() => enter(definition.id)}><LogIn size={16} aria-hidden="true" />{t('inspector.enter')}</button>
            <button type="button" className="ghost-button" onClick={() => void commitManual({ type: 'dissolve-subgraph', nodeId: node.id }, 'dissolve')}><Ungroup size={16} aria-hidden="true" />{t('inspector.dissolve')}</button>
          </div>
        </div>
      ) : null}
      <h3 className={styles.h3}>{t('inspector.ports')}</h3>
      <ul className={styles.ports}>
        {ports.map((port) => {
          const linked = connected(port.direction, port.id);
          return (
            <li key={`${port.direction}-${port.id}`} className={`inspector-port ${styles.port}`} data-port-type={port.dataType} title={port.direction === 'in' ? tooltips.get(port.name) : undefined} style={{ '--canvas-port': typeColor(port.dataType) } as React.CSSProperties}>
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.dir}>{port.direction === 'in' ? t('inspector.in') : t('inspector.out')}</span>
              <span className={styles.portName}>{port.name}</span>
              <span className={styles.mono}>{port.dataType}</span>
              <span className={linked ? styles.linked : styles.free}>{linked ? t('inspector.connected') : t('inspector.free')}</span>
            </li>
          );
        })}
      </ul>
      <h3 className={styles.h3}>{t('inspector.properties')}</h3>
      {layout.fields.length === 0 ? <p className={`inspector-empty ${styles.hint}`}>{t(unnamedValues ? 'inspector.fieldsUnknown' : 'inspector.noParameters')}</p> : (
        <div className={styles.params}>
          {layout.fields.map((field) => (
            <ParameterField key={field.name} nodeId={node.id} nodeName={title} field={field} linked={linkedField(field)} disabled={readOnly} />
          ))}
        </div>
      )}
      <Explanations refs={[ref, ...(instance ? [] : [{ kind: 'nodeClass' as const, id: data.comfyType, classType: data.comfyType }])]} />
    </>
  );
}

function EdgeSection({ edge, nodes }: { edge: GraphEdge; nodes: GraphNode[] }) {
  const { t } = useTranslation();
  const source = nodes.find((node) => node.id === edge.source);
  const target = nodes.find((node) => node.id === edge.target);
  const output = source?.data.outputs.find((port) => port.id === edge.sourceHandle);
  const input = target?.data.inputs.find((port) => port.id === edge.targetHandle);
  const type = String(edge.data?.dataType ?? output?.dataType ?? '');
  const sourceName = String(source?.data.title || source?.data.comfyType || edge.source);
  const targetName = String(target?.data.title || target?.data.comfyType || edge.target);
  const ref: ObjectRef = { kind: 'edge', id: edge.id };
  return (
    <>
      <header className={styles.header}>
        <span className={styles.swatch} style={{ '--canvas-port': typeColor(type) } as React.CSSProperties} aria-hidden="true" />
        <div className={styles.headText}>
          <h2 className={styles.h2}>{t('inspector.edgeHeading')}</h2>
          <p className={`inspector-type ${styles.mono}`}>{type}</p>
        </div>
      </header>
      <button type="button" className={`ghost-button ${styles.explain}`} onClick={() => askAbout(ref, String(t('inspector.askEdge', { source: sourceName, target: targetName })))}>
        <MessageCircleQuestion size={16} aria-hidden="true" />
        {t('inspector.explain')}
      </button>
      <dl className={styles.facts}>
        <dt>{t('inspector.edgeFrom')}</dt>
        <dd>{sourceName} · {output?.name ?? edge.sourceHandle}</dd>
        <dt>{t('inspector.edgeTo')}</dt>
        <dd>{targetName} · {input?.name ?? edge.targetHandle}</dd>
        <dt>{t('inspector.edgeType')}</dt>
        <dd className={styles.mono}>{type}</dd>
      </dl>
      <p className={styles.description}>{t('inspector.edgeFlows', { type, source: output?.name ?? edge.sourceHandle ?? '', target: input?.name ?? edge.targetHandle ?? '' })}</p>
      <Explanations refs={[ref]} fallback={linkTypeRef(type)} />
    </>
  );
}

/**
 * The selected object in detail: a node (illustration, class, category, ports with their links, editable
 * parameters, explanations with provenance, component docs), an edge (types, what flows), or a subgraph
 * instance (definition, rename, open, dissolve). Subgraph definition docs and the process stay below.
 */
export default function Inspector() {
  const { t } = useTranslation();
  // WP6: the level on screen (root, or the open subgraph's inner graph), so inner nodes can be edited too.
  const { nodes, edges } = useLevelGraph();
  const components = useGraphStore((state) => state.components);
  const process = useGraphStore((state) => state.process);
  const document = useGraphStore((state) => state.document);
  const selected = nodes.filter((item) => item.selected);
  const selectedEdges = edges.filter((item) => item.selected);
  const census = listSubgraphDefinitions(document?.raw);
  const [subgraphId, setSubgraphId] = useState<string | null>(null);
  const [processTitle, setProcessTitle] = useState(process.title);
  const [processNotes, setProcessNotes] = useState(process.notes);
  const [processPending, setProcessPending] = useState(false);
  useEffect(() => {
    setProcessTitle(process.title);
    setProcessNotes(process.notes);
  }, [process.title, process.notes]);
  useEffect(() => {
    if (subgraphId && !census.definitions.some((item) => item.id === subgraphId)) setSubgraphId(null);
  }, [census.definitions, subgraphId]);

  const label = String(t('inspector.label'));
  const node = selected.length === 1 ? selected[0] : undefined;
  const edge = !node && selected.length === 0 && selectedEdges.length === 1 ? selectedEdges[0] : undefined;
  const data = node ? (node.data as ComfyNodeData) : undefined;
  const nodeRecord = node ? recordFor(components, 'node', node.id) : undefined;
  const instance = data && census.definitions.some((item) => item.id === data.comfyType) ? data.comfyType : null;
  const activeSubgraph = census.definitions.find((item) => item.id === (subgraphId ?? instance));
  const subgraphRecord = activeSubgraph ? recordFor(components, 'subgraph', activeSubgraph.id) : undefined;
  const processDirty = processTitle !== process.title || processNotes !== process.notes;
  const saveProcess = () => {
    if (!processDirty || processPending) return;
    setProcessPending(true);
    void commitManual({ type: 'set-process', title: processTitle, notes: processNotes }, 'process').finally(() => setProcessPending(false));
  };

  return (
    <section className={`inspector ${styles.root}`} role="region" aria-label={label}>
      {selected.length > 1 ? (
        <>
          <h2 className={styles.h2}>{t('inspector.multi', { count: selected.length })}</h2>
          <p className={`inspector-type ${styles.mono}`}>{t('inspector.multiDetail')}</p>
          <p className={`inspector-empty ${styles.hint}`}>{t('inspector.selectNode')}</p>
        </>
      ) : null}
      {!node && !edge && selected.length === 0 ? (
        <>
          <h2 className={styles.h2}>{t('inspector.heading')}</h2>
          <p className={`inspector-empty ${styles.hint}`}>{t('inspector.empty')}</p>
        </>
      ) : null}
      {node && data ? (
        <>
          <NodeSection node={node} edges={edges} />
          {nodeRecord ? (
            <DocsEditor ownerKind="node" ownerId={node.id} purpose={nodeRecord.purpose} usage={nodeRecord.usage} heading={String(t('inspector.component'))} />
          ) : null}
          {instance ? <p className={`inspector-empty ${styles.hint}`}>{t('inspector.instanceOf', { id: instance })}</p> : null}
        </>
      ) : null}
      {edge ? <EdgeSection edge={edge} nodes={nodes} /> : null}

      <h3 className={styles.h3}>{t('inspector.subgraphs')}</h3>
      {/* One sentence at a time: what the list is for when there is a list, what a subgraph is when there is none. */}
      {census.definitions.length > 0 ? <p className={`inspector-empty ${styles.hint}`}>{t('inspector.subgraphBoundary')}</p> : null}
      {census.unidentified > 0 ? <p className={`inspector-empty ${styles.hint}`}>{t('inspector.unidentified')}</p> : null}
      {census.definitions.length === 0 ? <p className={`inspector-empty ${styles.hint}`}>{t('inspector.noSubgraphs')}</p> : (
        <div className={`inspector-subgraphs ${styles.subgraphs}`} role="list">
          {census.definitions.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ghost-button subgraph-pick ${styles.pick}`}
              aria-pressed={activeSubgraph?.id === item.id}
              onClick={() => setSubgraphId(item.id)}
            >
              {/* The name and what it holds, not the definition's id. */}
              {item.depth > 0 ? <span>{t('inspector.nested')}</span> : null}
              <span>{item.name}</span>
              <SubgraphSummary id={item.id} />
            </button>
          ))}
        </div>
      )}
      {activeSubgraph && subgraphRecord ? (
        <DocsEditor ownerKind="subgraph" ownerId={activeSubgraph.id} purpose={subgraphRecord.purpose} usage={subgraphRecord.usage} heading={String(t('inspector.subgraphs'))} />
      ) : null}

      <form
        className={`inspector-docs ${styles.docs}`}
        data-component-owner="process"
        onSubmit={(event) => {
          event.preventDefault();
          saveProcess();
        }}
      >
        <h3 className={styles.h3}>{t('inspector.process')}</h3>
        <label htmlFor="process-title">{t('inspector.processTitle')}</label>
        <input
          id="process-title"
          className={styles.field}
          value={processTitle}
          onChange={(event) => setProcessTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              saveProcess();
            }
          }}
        />
        <label htmlFor="process-notes">{t('inspector.processNotes')}</label>
        <textarea id="process-notes" className={styles.field} value={processNotes} onChange={(event) => setProcessNotes(event.target.value)} />
        <button type="button" className="ghost-button" disabled={!processDirty || processPending} onClick={saveProcess}>{t('inspector.saveProcess')}</button>
      </form>
    </section>
  );
}
