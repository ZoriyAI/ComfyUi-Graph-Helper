/** Task-specific guided entry into real ComfyUI blueprints, the configured assistant and teacher lesson authoring. */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Layers, Sparkles, X } from 'lucide-react';
import { BLUEPRINTS, BLUEPRINT_SOURCE, blueprintFacts, TYPE_HELP } from '../../../shared/templates/catalog';
import type { ModelSummary, NodeClassSummary } from '../../../shared/contracts';
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from '../../ui/Dialog';
import Button from '../../ui/Button';
import IconButton from '../../ui/IconButton';
import { useProjectionStore } from '../../services/commands/projection';
import { useGraphStore } from '../../state/graphState';
import { useProviderStore } from '../../state/providerState';
import { useUiStore } from '../../state/uiState';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { requestAsk } from '../../services/ask';
import { requestWorkspacePanel } from '../../commands/events';
import { useCanvasStore } from './canvasStore';
import { useSubgraphWizardStore, type SubgraphWizardRequest } from './subgraphWizardState';
import { commitManual } from './commit';
import { placeNewNode } from './placeNode';
import { captureEditOrigin, requireEditOrigin } from './lib/editOrigin';
import { revealNewNode } from './lib/reveal';
import ExtensionDraftCard from '../chat/ExtensionDraftCard';
import type { ExtensionDraft } from '../../../shared/contracts/extensions';
import styles from './SubgraphWizard.module.css';

const FAMILIES = ['image', 'video', 'audio', '3d', 'text', 'local-ai', 'extension'] as const;
export default function TaskWizard({ request }: { request: SubgraphWizardRequest }) {
  const { t, i18n } = useTranslation(); const language = i18n.language.startsWith('en') ? 'en' : 'ru';
  const [family, setFamily] = useState<(typeof FAMILIES)[number]>('image'); const [query, setQuery] = useState('');
  const [templateId, setTemplateId] = useState(''); const [step, setStep] = useState(0); const [goal, setGoal] = useState('');
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [upgrade, setUpgrade] = useState(false);
  const [enter, setEnter] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [starter, setStarter] = useState<ExtensionDraft | null>(null);
  const [catalog, setCatalog] = useState<{ classes: NodeClassSummary[]; models: ModelSummary[] } | null>(null);
  const close = useSubgraphWizardStore((s) => s.close); const provider = useProviderStore((s) => s.provider);
  const sync = useKnowledgeStore((s) => s.sync); const revision = useProjectionStore((s) => s.currentRevisionId);
  const level = useGraphStore((s) => s.activeSubgraphId); const replay = useCanvasStore((s) => Boolean(s.replay));
  const stale = revision !== request.revisionId || level !== request.levelId || replay;
  const entries = useMemo(() => BLUEPRINTS.filter((entry) => entry.family === family && `${entry.title.en} ${entry.title.ru} ${entry.id} ${entry.category}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim())), [family, query]);
  const template = BLUEPRINTS.find((entry) => entry.id === templateId); const facts = template ? blueprintFacts(template) : null;
  useEffect(() => { let alive = true; void Promise.all([window.electronAPI.searchNodeTypes({ query: '', limit: 10000 }), window.electronAPI.searchModels({ query: '', limit: 10000 })]).then(([classes, models]) => { if (alive) setCatalog({ classes, models }); }).catch(() => { if (alive) setCatalog(null); }); return () => { alive = false; }; }, [sync?.lastSyncAt]);
  const missingClasses = facts?.classes.filter((type) => catalog && !catalog.classes.some((c) => c.classType === type)) ?? [];
  const missingModels = facts?.models.filter((model) => catalog && !catalog.models.some((m) => m.directory === model.directory && (m.name === model.name || m.name.endsWith(`/${model.name}`)))) ?? [];
  const paid = facts?.api || facts?.classes.some((type) => catalog?.classes.find((c) => c.classType === type)?.marks?.includes('api'));
  const select = (id: string) => { const entry = BLUEPRINTS.find((b) => b.id === id)!; setTemplateId(id); setName(entry.title[language]); setDescription(entry.description[language]); setError(''); };
  const ask = (teacher: boolean) => {
    if (stale || busy) return;
    if (!provider) { useUiStore.getState().openSettings('assistant'); return; }
    const intro = String(t(teacher ? 'taskWizard.teacherRequest' : 'taskWizard.agentRequest'));
    const message = [intro, `${t('taskWizard.goal')}: ${goal || description || t(`taskWizard.family.${family}`)}`, template ? `Blueprint: ${template.id} (${template.title[language]}). ${t('taskWizard.inspectFirst')}` : t(family === 'extension' ? 'extension.request' : 'taskWizard.localAiRequest'), request.levelId ? `Destination definitionId: ${request.levelId}. Preserve existing user nodes; create a new editable variation.` : '', t('taskWizard.agentStages')].filter(Boolean).join('\n');
    close(); requestAsk({ context: { intent: teacher ? 'ask' : 'build', language, selection: [] }, message }); requestWorkspacePanel('assistant');
  };
  const create = async () => {
    if (!template || !name.trim() || stale || busy || (request.legacy && !upgrade)) return;
    const origin = captureEditOrigin(); setBusy(true); setError('');
    try {
      const pos = await placeNewNode(null, { size: { width: 320, height: 240 } }); if (!requireEditOrigin(origin) || useProjectionStore.getState().currentRevisionId !== request.revisionId) return;
      const result = await commitManual({ type: 'insert-blueprint', templateId: template.id, name: name.trim(), description, x: pos.x, y: pos.y, ...(request.levelId ? { destinationDefinitionId: request.levelId } : {}), upgradeToV1: upgrade }, 'task-wizard') as { status?: string; result?: { nodeId?: string; definitionId?: string } } | null;
      if (result?.status !== 'applied') { setError(String(t('subgraphWizard.failed'))); return; }
      close(); requestWorkspacePanel('canvas'); if (enter && result.result?.definitionId) useGraphStore.getState().enterSubgraph(result.result.definitionId); else revealNewNode(result.result?.nodeId ?? null);
    } catch { setError(String(t('subgraphWizard.failed'))); } finally { setBusy(false); }
  };
  const ports = (side: 'inputs' | 'outputs') => <section><h3>{t(`subgraphWizard.${side}`)}</h3>{facts?.[side].map((port, index) => <div key={`${side}-${index}`} className={styles.templatePort}><strong>{port.name} <code>{port.type}</code></strong><p>{TYPE_HELP[port.type]?.[language] ?? t('taskWizard.nativeType')}</p></div>)}</section>;
  return <DialogRoot open onOpenChange={(open) => { if (!open && !busy) close(); }}><DialogPortal><DialogOverlay /><DialogContent className={styles.dialog} aria-describedby="task-wizard-description">
    <header className={styles.header}><IconButton className={styles.close} label={String(t('subgraphWizard.close'))} disabled={busy} onClick={close}><X size={20} /></IconButton><DialogTitle className={styles.title}><Layers size={18} />{t('taskWizard.title')}</DialogTitle><DialogDescription id="task-wizard-description" className={styles.hint}>{t('taskWizard.lead', { count: BLUEPRINTS.length })}</DialogDescription></header>
    <p className={styles.stepCount}>{t('subgraphWizard.stepCount', { current: step + 1, total: 3 })} · {t(`taskWizard.step${step}`)}</p>
    <div className={styles.body}>
      {stale ? <p role="alert" className={styles.error}>{t('subgraphWizard.changed')}</p> : null}
      {step === 0 ? <><div className={styles.families} role="group" aria-label={String(t('taskWizard.chooseTask'))}>{FAMILIES.map((id) => <button type="button" aria-pressed={family === id} key={id} onClick={() => { setFamily(id); setTemplateId(''); setQuery(''); }}>{t(`taskWizard.family.${id}`)}</button>)}</div>
        {family === 'local-ai' || family === 'extension' ? <div className={styles.templatePort}><h3>{t(family === 'extension' ? 'extension.title' : 'taskWizard.localAiTitle')}</h3><p>{t(family === 'extension' ? 'extension.lead' : 'taskWizard.localAiLead')}</p><Button disabled={busy} onClick={() => { setBusy(true); void window.electronAPI.extensionStarter().then(setStarter).catch(() => setError(String(t('extension.failed')))).finally(() => setBusy(false)); }}>{t('extension.starter')}</Button>{starter ? <ExtensionDraftCard draft={starter} /> : null}</div> : <><label className={styles.field}>{t('taskWizard.search')}<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} /></label><div className={styles.templateList} role="listbox" aria-label={String(t('taskWizard.templates'))}>{entries.map((entry) => <button type="button" key={entry.id} role="option" aria-selected={templateId === entry.id} onClick={() => select(entry.id)}><strong>{entry.title[language]}</strong><small>{entry.title.en} · {entry.category}</small></button>)}</div><p className={styles.hint}>{t('taskWizard.matchCount', { count: entries.length })}</p></>}
        <Button size="sm" onClick={() => useSubgraphWizardStore.setState({ request: { ...request, templates: false } })}>{t('taskWizard.custom')}</Button>
      </> : null}
      {step === 1 ? <><label className={styles.field}>{t('taskWizard.goal')}<textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} maxLength={4000} placeholder={String(t('taskWizard.goalHint'))} /></label>{template ? <><label className={styles.field}>{t('subgraphWizard.name')}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} /></label><label className={styles.field}>{t('subgraphWizard.purpose')}<textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} /></label>{ports('inputs')}{ports('outputs')}</> : <p>{t(family === 'extension' ? 'extension.lead' : 'taskWizard.localAiLead')}</p>}</> : null}
      {step === 2 ? <><h3>{name || t(`taskWizard.family.${family}`)}</h3><p>{goal || description}</p><ol className={styles.teachingSteps}><li>{t('taskWizard.stageInputs')}</li><li>{t('taskWizard.stageInner')}</li><li>{t('taskWizard.stageExperiment')}</li><li>{t('taskWizard.stageExport')}</li></ol>
        {facts ? <><h3>{t('taskWizard.requirements')}</h3><p>{t('taskWizard.nativeCount', { nodes: facts.definitions.reduce((n, d) => n + d.nodes.length, 0), graphs: facts.definitions.length })}</p><p className={styles.hint}>{t('taskWizard.nativeControls')}</p>{paid ? <p role="note" className={styles.error}>{t('taskWizard.paid')}</p> : null}<p>{!catalog || sync?.lastSyncAt == null ? t('taskWizard.unverified') : missingClasses.length + missingModels.length ? t('taskWizard.missing') : t('taskWizard.catalogPresent')}</p><details><summary>{t('taskWizard.classes', { count: facts.classes.length })}</summary><ul>{facts.classes.map((type) => <li key={type}>{type} {catalog && sync?.lastSyncAt != null ? missingClasses.includes(type) ? '— ' + t('taskWizard.notFound') : '✓' : ''}</li>)}</ul></details><details><summary>{t('taskWizard.models', { count: facts.models.length })}</summary><ul>{facts.models.map((model) => <li key={`${model.directory}/${model.name}`}><code>{model.directory}/{model.name}</code> {catalog && sync?.lastSyncAt != null && missingModels.includes(model) ? '— ' + t('taskWizard.notFound') : ''}</li>)}</ul></details><p className={styles.hint}>{t('taskWizard.packs')}: {facts.packs.join(', ') || t('taskWizard.packsNotSpecified')}<br />Comfy-Org/workflow_templates · MIT · {BLUEPRINT_SOURCE.commit.slice(0, 12)}</p><label className={styles.check}><input type="checkbox" checked={enter} onChange={(e) => setEnter(e.target.checked)} />{t('subgraphWizard.enter')}</label></> : null}
        {request.legacy ? <label className={styles.check}><input type="checkbox" checked={upgrade} onChange={(e) => setUpgrade(e.target.checked)} />{t('subgraphWizard.upgrade')}</label> : null}
        <p className={styles.hint}>{provider ? t('taskWizard.agentConfigured', { provider }) : t('taskWizard.agentSetup')}</p><div className={styles.agentActions}><Button disabled={stale || busy} icon={<Sparkles size={16} />} onClick={() => ask(false)}>{t(provider ? 'taskWizard.withAgent' : 'taskWizard.configureAgent')}</Button><Button disabled={stale || busy} icon={<BookOpen size={16} />} onClick={() => ask(true)}>{t('taskWizard.teacher')}</Button></div>
      </> : null}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    </div>
    <footer className={styles.footer}><Button variant="subtle" disabled={busy} onClick={close}>{t('subgraphWizard.cancel')}</Button><span />{step > 0 ? <Button disabled={busy} onClick={() => setStep(step - 1)}>{t('subgraphWizard.back')}</Button> : null}{step < 2 ? <Button variant="primary" disabled={busy || stale || (step === 0 && !template && family !== 'local-ai' && family !== 'extension') || (step === 1 && template != null && !name.trim())} onClick={() => setStep(step + 1)}>{t('subgraphWizard.next')}</Button> : template ? <Button variant="primary" loading={busy} disabled={stale || !name.trim() || (request.legacy && !upgrade)} onClick={() => void create()}>{t('taskWizard.create')}</Button> : null}</footer>
  </DialogContent></DialogPortal></DialogRoot>;
}
