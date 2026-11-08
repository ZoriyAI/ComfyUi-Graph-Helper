import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listSubgraphDefinitions, type ComponentOwnerKind, type ComponentRecord } from '../../../shared/components/model';
import { submitManual } from '../../services/commands/projection';
import { useGraphStore } from '../../state/graphState';
import { ComfyNodeData } from '../../types/graph';

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
  return (
    <form
      className="inspector-docs"
      data-component-owner={`${ownerKind}:${ownerId}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!dirty || pending) return;
        setPending(true);
        void submitManual(`component-${crypto.randomUUID()}`, {
          type: 'set-component',
          ownerKind,
          ownerId,
          purpose: draftPurpose,
          usage: draftUsage,
        }).finally(() => setPending(false));
      }}
    >
      <h3>{heading}</h3>
      <p className="inspector-type">{ownerId}</p>
      <label htmlFor={purposeId}>{t('inspector.purpose')}</label>
      <textarea
        id={purposeId}
        value={draftPurpose}
        aria-describedby={`${purposeId}-hint`}
        onChange={(event) => setDraftPurpose(event.target.value)}
      />
      <p id={`${purposeId}-hint`} className="inspector-empty">{t('inspector.purposeHint')}</p>
      <label htmlFor={usageId}>{t('inspector.usage')}</label>
      <textarea
        id={usageId}
        value={draftUsage}
        aria-describedby={`${usageId}-hint`}
        onChange={(event) => setDraftUsage(event.target.value)}
      />
      <p id={`${usageId}-hint`} className="inspector-empty">{t('inspector.usageHint')}</p>
      <button type="submit" className="ghost-button" disabled={!dirty || pending}>{t('inspector.saveDocs')}</button>
    </form>
  );
}

export default function Inspector() {
  const { t } = useTranslation();
  const nodes = useGraphStore((state) => state.nodes);
  const components = useGraphStore((state) => state.components);
  const process = useGraphStore((state) => state.process);
  const document = useGraphStore((state) => state.document);
  const selected = nodes.filter((item) => item.selected);
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
  const data = node ? (node.data as ComfyNodeData) : undefined;
  const nodeRecord = node ? recordFor(components, 'node', node.id) : undefined;
  const instance = data && census.definitions.some((item) => item.id === data.comfyType) ? data.comfyType : null;
  const activeSubgraph = census.definitions.find((item) => item.id === (subgraphId ?? instance));
  const subgraphRecord = activeSubgraph ? recordFor(components, 'subgraph', activeSubgraph.id) : undefined;
  const parameters = Object.entries(data?.parameters || {});
  const ports = data ? [
    ...data.inputs.map((port) => ({ ...port, direction: 'in' as const })),
    ...data.outputs.map((port) => ({ ...port, direction: 'out' as const })),
  ] : [];
  const processDirty = processTitle !== process.title || processNotes !== process.notes;

  return (
    <section className="inspector" role="region" aria-label={label}>
      {selected.length > 1 ? (
        <>
          <h2>{t('inspector.multi', { count: selected.length })}</h2>
          <p className="inspector-type">{t('inspector.multiDetail')}</p>
          <p className="inspector-empty">{t('inspector.selectNode')}</p>
        </>
      ) : null}
      {!node && selected.length === 0 ? (
        <>
          <h2>{t('inspector.heading')}</h2>
          <p className="inspector-empty">{t('inspector.empty')}</p>
        </>
      ) : null}
      {node && data ? (
        <>
          <h2>{data.title || data.comfyType}</h2>
          <p className="inspector-type">{data.comfyType}</p>
          <h3>{t('inspector.ports')}</h3>
          <div className="inspector-ports">
            {ports.map((port) => (
              <div key={`${port.direction}-${port.id}`} className="inspector-port" data-port-type={port.dataType}>
                <span>{port.direction === 'in' ? t('inspector.in') : t('inspector.out')}</span>
                <span className="port-name">{port.name}</span>
                {port.name.toLowerCase() === port.dataType.toLowerCase() ? null : <span className="port-type">{port.dataType}</span>}
              </div>
            ))}
          </div>
          <h3>{t('inspector.properties')}</h3>
          {parameters.length === 0 ? <p className="inspector-empty">{t('inspector.noParameters')}</p> : (
            <div className="inspector-ports">
              {parameters.map(([key, value]) => (
                <div key={key} className="inspector-port">
                  <span className="port-name">{key}</span>
                  <span className="port-type">{String(value)}</span>
                </div>
              ))}
            </div>
          )}
          {nodeRecord ? (
            <DocsEditor
              ownerKind="node"
              ownerId={node.id}
              purpose={nodeRecord.purpose}
              usage={nodeRecord.usage}
              heading={String(t('inspector.component'))}
            />
          ) : null}
          {instance ? <p className="inspector-empty">{t('inspector.instanceOf', { id: instance })}</p> : null}
        </>
      ) : null}

      <h3>{t('inspector.subgraphs')}</h3>
      <p className="inspector-empty">{t('inspector.subgraphBoundary')}</p>
      {census.unidentified > 0 ? <p className="inspector-empty">{t('inspector.unidentified')}</p> : null}
      {census.definitions.length === 0 ? <p className="inspector-empty">{t('inspector.noSubgraphs')}</p> : (
        <div className="inspector-subgraphs" role="list">
          {census.definitions.map((item) => (
            <button
              key={item.id}
              type="button"
              className="ghost-button subgraph-pick"
              aria-pressed={activeSubgraph?.id === item.id}
              onClick={() => setSubgraphId(item.id)}
            >
              {item.depth > 0 ? <span>{t('inspector.nested')}</span> : null}
              <span>{item.name}</span>
              <span className="inspector-type">{item.id}</span>
            </button>
          ))}
        </div>
      )}
      {activeSubgraph && subgraphRecord ? (
        <DocsEditor
          ownerKind="subgraph"
          ownerId={activeSubgraph.id}
          purpose={subgraphRecord.purpose}
          usage={subgraphRecord.usage}
          heading={String(t('inspector.subgraphs'))}
        />
      ) : null}

      <form
        className="inspector-docs"
        data-component-owner="process"
        onSubmit={(event) => {
          event.preventDefault();
          if (!processDirty || processPending) return;
          setProcessPending(true);
          void submitManual(`process-${crypto.randomUUID()}`, {
            type: 'set-process',
            title: processTitle,
            notes: processNotes,
          }).finally(() => setProcessPending(false));
        }}
      >
        <h3>{t('inspector.process')}</h3>
        <label htmlFor="process-title">{t('inspector.processTitle')}</label>
        <input id="process-title" value={processTitle} onChange={(event) => setProcessTitle(event.target.value)} />
        <label htmlFor="process-notes">{t('inspector.processNotes')}</label>
        <textarea id="process-notes" value={processNotes} onChange={(event) => setProcessNotes(event.target.value)} />
        <button type="submit" className="ghost-button" disabled={!processDirty || processPending}>{t('inspector.saveProcess')}</button>
      </form>
    </section>
  );
}
