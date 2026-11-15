/** Four-step native ComfyUI subgraph constructor. A request identity owns the draft until explicitly closed. */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Plus, X } from 'lucide-react';
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from '../../ui/Dialog';
import Button from '../../ui/Button';
import { useProjectionStore } from '../../services/commands/projection';
import { useGraphStore } from '../../state/graphState';
import { useCanvasStore } from './canvasStore';
import { useNodeInfoStore } from './nodeInfo';
import { nodeLayout, displayValue } from '../fields/fieldModel';
import { isServiceData } from '../../../shared/workflow/comfyLook';
import { commitManual } from './commit';
import { runSyncNow } from '../sync/SyncIndicator';
import { useSubgraphWizardStore, type SubgraphWizardRequest } from './subgraphWizardState';
import type { GraphMutation } from '../../../shared/commands/types';
import styles from './SubgraphWizard.module.css';

type Slot = { id: string; name: string; type: string; nodeId?: string; handle?: string };
const keyOf = (nodeId: string, name: string) => JSON.stringify([nodeId, name]);
const STEPS = ['contents', 'ports', 'controls', 'review'] as const;

function Wizard({ request }: { request: SubgraphWizardRequest }) {
  const { t } = useTranslation();
  const close = useSubgraphWizardStore((state) => state.close);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(request.definition?.name ?? '');
  const [description, setDescription] = useState(String(request.definition?.raw.description ?? ''));
  const [selected, setSelected] = useState(request.definition ? request.nodes.map((node) => node.id) : request.nodeIds);
  const [inputs, setInputs] = useState<Slot[]>([]); const [outputs, setOutputs] = useState<Slot[]>([]);
  const [widgets, setWidgets] = useState<string[]>(() => {
    const raw = request.definition?.raw.widgets;
    return Array.isArray(raw) ? raw.flatMap((field) => typeof field?.id === 'string' && typeof field.name === 'string' ? [keyOf(field.id, field.name)] : []) : [];
  });
  const [enter, setEnter] = useState(true); const [upgrade, setUpgrade] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const revision = useProjectionStore((state) => state.currentRevisionId);
  const level = useGraphStore((state) => state.activeSubgraphId);
  const replay = useCanvasStore((state) => Boolean(state.replay));
  const details = useNodeInfoStore((state) => state.details);
  const nodes = useMemo(() => request.nodes.filter((node) => selected.includes(node.id)), [request, selected]);
  const classes = useMemo(() => [...new Set(request.nodes.map((node) => node.data.comfyType))], [request]);
  useEffect(() => { for (const type of classes) void useNodeInfoStore.getState().request(type); }, [classes]);
  const candidates = useMemo(() => nodes.flatMap((node) => nodeLayout(node.data, details[node.data.comfyType]).fields
    .filter((field) => !field.name.includes('::') && !isServiceData(field.value) && field.value !== undefined && field.value !== null)
    .map((field) => ({ key: keyOf(node.id, field.name), nodeId: node.id, name: field.name, value: field.value, title: node.data.title || node.data.comfyType }))), [nodes, details]);
  const chosen = widgets.filter((key) => selected.includes((JSON.parse(key) as [string, string])[0]));
  const stale = revision !== request.revisionId || level !== request.levelId || replay;
  const slotsValid = [...inputs, ...outputs].every((slot) => slot.name.trim() && slot.type.trim());
  const valid = name.trim() !== '' && slotsValid && (!request.legacy || request.definition || upgrade);
  const targets = (direction: 'input' | 'output') => nodes.flatMap((node) => node.data[direction === 'input' ? 'inputs' : 'outputs']
    .filter((port) => direction === 'output' || !request.edges.some((edge) => selected.includes(edge.source) && edge.target === node.id && edge.targetHandle === port.id))
    .map((port) => ({ nodeId: node.id, handle: port.id, name: port.name, type: port.dataType, title: node.data.title || node.data.comfyType })));
  const portEditor = (direction: 'input' | 'output', list: Slot[], set: React.Dispatch<React.SetStateAction<Slot[]>>) => (
    <section className={styles.portSection} aria-label={String(t(`subgraphWizard.${direction}s`))}>
      <h3>{t(`subgraphWizard.${direction}s`)}</h3>
      {request.definition ? <p className={styles.hint}>{request.definition[direction === 'input' ? 'inputs' : 'outputs'].map((slot) => `${slot.name} · ${slot.type}`).join(', ') || t('subgraphWizard.none')}</p> : null}
      {list.map((slot, index) => <div key={slot.id} className={styles.portRow}>
        <input aria-label={String(t('subgraphWizard.portName', { side: t(`subgraphWizard.${direction}`), index: index + 1 }))} value={slot.name} maxLength={200} onChange={(event) => set(list.map((item) => item.id === slot.id ? { ...item, name: event.target.value } : item))} />
        <input aria-label={String(t('subgraphWizard.portType', { side: t(`subgraphWizard.${direction}`), index: index + 1 }))} value={slot.type} maxLength={200} list="subgraph-types" onChange={(event) => set(list.map((item) => item.id === slot.id ? { ...item, type: event.target.value } : item))} />
        <select aria-label={String(t('subgraphWizard.portTarget', { side: t(`subgraphWizard.${direction}`), index: index + 1 }))} value={slot.nodeId ? keyOf(slot.nodeId, slot.handle!) : ''} onChange={(event) => {
          const target = targets(direction).find((item) => keyOf(item.nodeId, item.handle) === event.target.value);
          set(list.map((item) => item.id !== slot.id ? item : target ? { ...item, nodeId: target.nodeId, handle: target.handle, type: target.type, name: item.name || target.name } : { id: item.id, name: item.name, type: item.type }));
        }}><option value="">{t('subgraphWizard.connectLater')}</option>{targets(direction).map((target) => <option key={keyOf(target.nodeId, target.handle)} value={keyOf(target.nodeId, target.handle)}>{target.title} · {target.name}</option>)}</select>
        <Button size="sm" aria-label={String(t('subgraphWizard.removePort'))} onClick={() => set(list.filter((item) => item.id !== slot.id))}><X size={14} /></Button>
      </div>)}
      <Button size="sm" icon={<Plus size={14} />} onClick={() => set([...list, { id: crypto.randomUUID(), name: '', type: '*' }])}>{t(`subgraphWizard.add${direction === 'input' ? 'Input' : 'Output'}`)}</Button>
    </section>
  );
  const save = async () => {
    if (!valid || stale || busy) return;
    setBusy(true); setError('');
    const fields = chosen.map((key) => { const [nodeId, fieldName] = JSON.parse(key) as [string, string]; return { nodeId, name: fieldName }; });
    const io = (list: Slot[]) => list.map(({ id: _id, ...slot }) => ({ ...slot, name: slot.name.trim(), type: slot.type.trim() }));
    const payload: GraphMutation = request.definition
      ? { type: 'configure-subgraph', definitionId: request.definition.id, name: name.trim(), description, widgets: fields }
      : { type: 'create-subgraph', name: name.trim(), description, nodeIds: selected, inputs: io(inputs), outputs: io(outputs), widgets: fields, upgradeToV1: upgrade };
    try {
      // A new definition and any extra interface ports are one undoable revision.
      const edits: GraphMutation[] = [payload];
      if (request.definition) for (const [direction, list] of [['input', inputs], ['output', outputs]] as const) {
        for (const slot of list) edits.push({ type: 'add-subgraph-io', definitionId: request.definition.id, direction, name: slot.name.trim(), dataType: slot.type.trim(), ...(slot.nodeId ? { nodeId: slot.nodeId, handle: slot.handle } : {}) });
      }
      const result = await commitManual(edits.length > 1 ? { type: 'batch', label: 'subgraph', edits } : payload) as { status?: string; result?: { definitionId?: string } } | null;
      if (result?.status !== 'applied') { setError(String(t('subgraphWizard.failed'))); return; }
      const definitionId = request.definition?.id ?? String((result.result as { definitionId?: string })?.definitionId ?? '');
      close(); if (enter && definitionId) useGraphStore.getState().enterSubgraph(definitionId);
    } catch { setError(String(t('subgraphWizard.failed'))); } finally { setBusy(false); }
  };
  return <DialogRoot open onOpenChange={(open) => { if (!open && !busy) close(); }}><DialogPortal><DialogOverlay /><DialogContent className={styles.dialog} aria-describedby="subgraph-wizard-lead">
    <header className={styles.header}><DialogTitle className={styles.title}><Layers size={18} />{t(request.definition ? 'subgraphWizard.editTitle' : 'subgraphWizard.title')}</DialogTitle><DialogDescription id="subgraph-wizard-lead" className={styles.hint}>{t('subgraphWizard.lead')}</DialogDescription></header>
    <ol className={styles.steps} aria-label={String(t('subgraphWizard.steps'))}>{STEPS.map((key, index) => <li key={key} aria-current={index === step ? 'step' : undefined}><span>{index + 1}</span>{t(`subgraphWizard.${key}`)}</li>)}</ol>
    <div className={styles.body}>
      {stale ? <p role="alert" className={styles.error}>{t('subgraphWizard.changed')}</p> : null}
      {step === 0 ? <>
        <label className={styles.field}>{t('subgraphWizard.name')}<input value={name} maxLength={200} onChange={(event) => setName(event.target.value)} autoFocus /></label>
        <label className={styles.field}>{t('subgraphWizard.purpose')}<textarea value={description} maxLength={4000} rows={3} onChange={(event) => setDescription(event.target.value)} /></label>
        {request.definition ? <p>{t('subgraphWizard.editContents')}</p> : <>
          <p className={styles.hint}>{t('subgraphWizard.contentsHint')}</p>
          <Button size="sm" onClick={() => setSelected([])}>{t('subgraphWizard.empty')}</Button>
          <div className={styles.nodeList}>{request.nodes.map((node) => <label key={node.id} className={styles.check}><input type="checkbox" checked={selected.includes(node.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, node.id] : selected.filter((id) => id !== node.id))} /><span>{node.data.title || node.data.comfyType}<small>{node.data.comfyType}</small></span></label>)}</div>
        </>}
        {request.legacy && !request.definition ? <label className={styles.check}><input type="checkbox" checked={upgrade} onChange={(event) => setUpgrade(event.target.checked)} />{t('subgraphWizard.upgrade')}</label> : null}
      </> : null}
      {step === 1 ? <><p className={styles.hint}>{t('subgraphWizard.portsHint')}</p>{portEditor('input', inputs, setInputs)}{portEditor('output', outputs, setOutputs)}<datalist id="subgraph-types">{['MODEL', 'CLIP', 'VAE', 'LATENT', 'IMAGE', 'MASK', 'CONDITIONING', 'STRING', 'INT', 'FLOAT', 'BOOLEAN', 'AUDIO', '*'].map((type) => <option key={type} value={type} />)}</datalist></> : null}
      {step === 2 ? <><p className={styles.hint}>{t('subgraphWizard.controlsHint')}</p>{candidates.length === 0 ? <p>{t('subgraphWizard.noControls')}</p> : candidates.map((field) => <label key={field.key} className={styles.check}><input type="checkbox" checked={chosen.includes(field.key)} onChange={(event) => setWidgets(event.target.checked ? [...chosen, field.key] : chosen.filter((key) => key !== field.key))} /><span>{field.title} · {field.name}<small>{displayValue(field.value).slice(0, 120)}</small></span></label>)}{chosen.filter((key) => !candidates.some((field) => field.key === key)).map((key) => <label key={key} className={styles.check}><input type="checkbox" checked onChange={() => setWidgets(chosen.filter((item) => item !== key))} />{t('subgraphWizard.unknownControl', { name: (JSON.parse(key) as [string, string])[1] })}</label>)}<Button size="sm" onClick={() => void runSyncNow()}>{t('subgraphWizard.readCatalog')}</Button></> : null}
      {step === 3 ? <><div className={styles.preview}><h3><Layers size={16} />{name || t('subgraphWizard.title')}</h3><p>{description}</p><div className={styles.previewPorts}><span>{[...(request.definition?.inputs ?? []), ...inputs].map((slot) => `${slot.name} · ${slot.type}`).join('\n') || t('subgraphWizard.none')}</span><span>{[...(request.definition?.outputs ?? []), ...outputs].map((slot) => `${slot.name} · ${slot.type}`).join('\n') || t('subgraphWizard.none')}</span></div>{candidates.filter((field) => chosen.includes(field.key)).map((field) => <p key={field.key}>{field.name} <strong>{displayValue(field.value).slice(0, 80)}</strong></p>)}</div><p>{t('subgraphWizard.summary', { nodes: nodes.length, controls: chosen.length })}</p><p className={styles.hint}>{t('subgraphWizard.execution')}</p><label className={styles.check}><input type="checkbox" checked={enter} onChange={(event) => setEnter(event.target.checked)} />{t('subgraphWizard.enter')}</label></> : null}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    </div>
    <footer className={styles.footer}><Button variant="subtle" disabled={busy} onClick={close}>{t('subgraphWizard.cancel')}</Button><span />{step > 0 ? <Button disabled={busy} onClick={() => setStep(step - 1)}>{t('subgraphWizard.back')}</Button> : null}{step < 3 ? <Button variant="primary" disabled={stale || busy || (step === 0 && (!name.trim() || (request.legacy && !request.definition && !upgrade))) || (step === 1 && !slotsValid)} onClick={() => setStep(step + 1)}>{t('subgraphWizard.next')}</Button> : <Button variant="primary" disabled={stale || !valid} loading={busy} onClick={() => void save()}>{t(request.definition ? 'subgraphWizard.save' : 'subgraphWizard.create')}</Button>}</footer>
  </DialogContent></DialogPortal></DialogRoot>;
}

export default function SubgraphWizard() {
  const request = useSubgraphWizardStore((state) => state.request);
  return request ? <Wizard key={request.id} request={request} /> : null;
}
