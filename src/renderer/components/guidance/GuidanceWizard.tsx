/** Practical, source-linked guidance with real tool hand-offs and a resumable place. */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, ExternalLink, LifeBuoy, Search, Sparkles, X } from 'lucide-react';
import { GUIDE_CATEGORIES, GUIDE_PROBLEMS, searchGuides, type GuideAction, type GuideProblem } from '../../../shared/guidance/catalog';
import { verifyGuide, type GuideVerification } from '../../../shared/guidance/verification';
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from '../../ui/Dialog';
import Button from '../../ui/Button';
import IconButton from '../../ui/IconButton';
import { showToast } from '../../ui/Toast';
import { useUiStore } from '../../state/uiState';
import { useJourneyStore } from '../../state/journeyState';
import { useProviderStore } from '../../state/providerState';
import { useGraphStore } from '../../state/graphState';
import { useProjectionStore } from '../../services/commands/projection';
import { requestAsk } from '../../services/ask';
import { runCommand } from '../../commands/registry';
import { requestWorkspacePanel } from '../../commands/events';
import { openSubgraphWizard, openTaskWizard } from '../graph/subgraphWizardState';
import { useCanvasStore } from '../graph/canvasStore';
import { levelNodes } from '../graph/lib/level';
import { guideObjectIsCurrent, guideResultObserved, retargetGuidance, useGuidanceStore, type GuideRequest } from './guidanceState';
import styles from './GuidanceWizard.module.css';

function flowParts(problem: GuideProblem): string[] {
  if (problem.id === 'p30') return ['image', 'encode', 'latent'];
  if (problem.id === 'p49') return ['image', 'vision', 'text'];
  if (problem.id === 'p50') return ['text', 'embedding', 'vector'];
  if (problem.action === 'sync') return ['catalog', 'read', 'description'];
  if (problem.category === 'subgraphs') return ['input', 'inner', 'result'];
  if (problem.category === 'performance') return ['model', 'settings', 'memory'];
  return ['input', 'process', 'result'];
}

function GuideFlow({ problem }: { problem: GuideProblem }) {
  const { t } = useTranslation();
  const [part, setPart] = useState(0);
  const parts = flowParts(problem);
  return <section className={styles.flow} aria-label={String(t('guidance.flowTitle'))}>
    <h3>{t('guidance.flowTitle')}</h3>
    <ol className={styles.flowNodes}>{parts.map((key, i) => <li key={key}>
      <button type="button" aria-pressed={i === part} onClick={() => setPart(i)}>{t(`guidance.parts.${key}.name`)}</button>
      {i < parts.length - 1 ? <ArrowRight size={18} aria-hidden="true" /> : null}
    </li>)}</ol>
    <p className={styles.flowDetail} aria-live="polite" key={part}>{t(`guidance.parts.${parts[part]}.detail`)}</p>
    <p className={styles.note}>{t('guidance.flowHint')}</p>
  </section>;
}

function GuideSteps({ request, problem }: { request: GuideRequest; problem: GuideProblem }) {
  const { t, i18n } = useTranslation(); const language = i18n.language.startsWith('en') ? 'en' : 'ru';
  const { update, close } = useGuidanceStore();
  const provider = useProviderStore((s) => s.provider);
  const replay = useCanvasStore((s) => Boolean(s.replay));
  const nodes = useGraphStore(s => s.nodes); const definitions = useGraphStore(s => s.subgraphs);
  const revision = useProjectionStore(s => s.currentRevisionId);
  const [verification, setVerification] = useState<GuideVerification | null>(null);
  const [checking, setChecking] = useState(false); const checkTicket = useRef(0);
  useEffect(() => { checkTicket.current += 1; setVerification(null); setChecking(false); }, [problem.id, revision]);
  useEffect(() => () => { checkTicket.current += 1; }, []);
  const targets = [{ id: null as string | null, nodes }, ...definitions.filter(d => !d.opaque).map(d => ({ id: d.id, nodes: d.nodes }))]
    .flatMap(level => level.nodes.filter(node => problem.targets.some(part => String(node.data.comfyType).toLowerCase().includes(part.toLowerCase())))
      .map(node => ({ node, level: level.id }))).slice(0, 12);
  // Re-check the target after a navigation, removal or graph replacement while this guide was tucked away.
  useGraphStore((s) => s.activeSubgraphId); useProjectionStore((s) => s.currentRevisionId);
  const stale = !guideObjectIsCurrent(request);
  const act = async (action: GuideAction = problem.action) => {
    if (!guideObjectIsCurrent(request) && request.objectRef) return;
    close();
    const ui = useUiStore.getState();
    switch (action) {
      case 'check': case 'resources': await runCommand('graph.check'); break;
      case 'nodes': ui.setRail(true, 'nodes'); break;
      case 'models': ui.setRail(true, 'models'); break;
      case 'services': ui.openSettings('services'); break;
      case 'sync': ui.setDialog('sync-problems'); break;
      case 'templates': openTaskWizard(problem.template); break;
      case 'connection': ui.openSettings('connection'); break;
      case 'memory': ui.openSettings('assistant'); break;
      case 'error': useJourneyStore.getState().open('error'); break;
      case 'export': await runCommand('file.export'); break;
      case 'comfy': {
        if (!await window.electronAPI.comfyAddressKnown()) ui.openSettings('connection');
        else await window.electronAPI.openJourneyLink('comfyui');
        break;
      }
      case 'constructor': {
        const selected = levelNodes().filter((node) => node.selected);
        const instance = selected.length === 1 && selected[0].data.kind === 'subgraph-instance' ? selected[0] : undefined;
        openSubgraphWizard(instance ? [] : selected.map((node) => node.id), instance ? instance.data.subgraphId ?? instance.data.comfyType : undefined);
        break;
      }
      case 'import': await runCommand('file.import'); break;
      case 'canvas': if (request.objectRef) ui.setFocus(request.objectRef); requestWorkspacePanel('canvas'); break;
    }
  };
  const perform = (action: GuideAction) => { void act(action).catch(() => showToast({ id: 'guide-action', tone: 'error', title: String(t('guidance.actionFailed')) })); };
  const showTarget = (target: typeof targets[number]) => {
    close(); const graph = useGraphStore.getState(); graph.exitSubgraph();
    if (target.level) graph.enterSubgraph(target.level);
    const ref = { kind: 'node' as const, id: target.node.id, classType: target.node.data.comfyType, ...(target.level ? { subgraphId: target.level } : {}) };
    useUiStore.getState().setFocus(ref); retargetGuidance(ref);
    requestWorkspacePanel('canvas'); useCanvasStore.getState().requestCenter(target.node.id, target.level ?? undefined);
  };
  const verify = async () => {
    if (checking) return;
    const ticket = ++checkTicket.current; setChecking(true);
    const project = useProjectionStore.getState().projectId;
    try {
      const result = problem.verify.kind === 'graph'
        ? verifyGuide(problem, { graph: await window.electronAPI.checkGraph(project), nodes: nodes.length })
        : problem.verify.kind === 'sync' ? verifyGuide(problem, { sync: await window.electronAPI.syncStatus() })
          : verifyGuide(problem, {});
      if (ticket === checkTicket.current) setVerification(result);
    } catch { if (ticket === checkTicket.current) setVerification({ state: 'unavailable' }); }
    finally { if (ticket === checkTicket.current) setChecking(false); }
  };
  const ask = (build: boolean) => {
    if (!guideObjectIsCurrent(request) || (build && useCanvasStore.getState().replay)) return;
    close();
    if (!useProviderStore.getState().provider) { useUiStore.getState().openSettings('assistant'); return; }
    if (request.objectRef) useUiStore.getState().setFocus(request.objectRef);
    requestAsk({ context: { intent: build ? 'chat' : 'ask', language, ...(request.objectRef ? { objectRef: request.objectRef } : {}), selection: request.objectRef ? [request.objectRef] : [] }, message: [t(build ? 'guidance.fix' : 'guidance.ask'), problem.title[language], problem.why[language], problem.prepare[language], problem.check[language], problem.expected[language]].join('\n\n') });
  };
  const mutatingAction = ['constructor', 'templates', 'import'].includes(problem.action);
  return <>
    <nav className={styles.steps} aria-label={String(t('guidance.progress', { current: request.step + 1 }))}>
      {[0, 1, 2].map((n) => <button type="button" key={n} aria-current={request.step === n ? 'step' : undefined} onClick={() => update({ step: n })}><span>{n + 1}</span>{t(`guidance.step${n}`)}</button>)}
    </nav>
    <div className={styles.body} key={`${problem.id}-${request.step}`}>
      <button type="button" className={styles.back} onClick={() => update({ problemId: '', step: 0 })}><ArrowLeft size={16} />{t('guidance.back')}</button>
      <h2 className={styles.problemTitle}>{problem.title[language]}</h2>
      {stale ? <p role="alert" className={styles.warning}>{t('guidance.stale')}</p> : null}
      {request.step === 0 ? <><h3>{t('guidance.cause')}</h3><p>{problem.why[language]}</p><GuideFlow problem={problem} /><button type="button" className={styles.source} title={problem.source} onClick={() => void window.electronAPI.openGuideSource(problem.id).then((result) => { if (!result.ok) throw new Error('unavailable'); }).catch(() => showToast({ id: 'guide-source', tone: 'error', title: String(t('projectLinks.unavailable')) }))}>{t('guidance.source')}<ExternalLink size={14} aria-hidden="true" /></button></> : null}
      {request.step === 1 ? <><ol className={styles.procedure}><li><h3>{t('guidance.prepare')}</h3><p>{problem.prepare[language]}</p><Button disabled={stale || (replay && mutatingAction)} onClick={() => perform(problem.action)}>{t(`guidance.actions.${problem.action}`)}</Button></li><li><h3>{t('guidance.check')}</h3><p>{problem.check[language]}</p><Button disabled={stale || (replay && ['constructor', 'templates', 'import', 'export'].includes(problem.followUp))} onClick={() => perform(problem.followUp)}>{t(`guidance.actions.${problem.followUp}`)}</Button></li></ol><p className={styles.note}>{t('guidance.returnHint')}</p>
        {problem.targets.length > 0 ? <section className={styles.targets}><h3>{t('guidance.relatedNodes')}</h3>{targets.length ? targets.map(target => <Button key={`${target.level}/${target.node.id}`} onClick={() => showTarget(target)}>{target.node.data.label || target.node.data.comfyType} #{target.node.id}{target.level ? ` · ${t('guidance.innerNode')}` : ''}</Button>) : <p>{t('guidance.noRelatedNodes')}</p>}</section> : null}
      </> : null}
      {request.step === 2 ? <><div className={styles.expected}><Check size={20} aria-hidden="true" /><div><h3>{t('guidance.expected')}</h3><p>{problem.expected[language]}</p></div></div>
        <Button disabled={checking || stale || replay} onClick={() => void verify()}>{t(checking ? 'guidance.checkingResult' : 'guidance.verifyResult')}</Button>
        {verification ? <p className={styles.verification} role="status">{t(`guidance.verification.${verification.state}`, { count: verification.count ?? 0 })}</p> : null}
        <label className={styles.confirm}><input type="checkbox" checked={guideResultObserved(request, revision)} onChange={event => update({ observed: event.target.checked })} />{t('guidance.confirmResult')}</label>
        <Button variant="subtle" onClick={() => { update({ step: 1, observed: false }); setVerification(null); }}>{t('guidance.notYet')}</Button>
      </> : null}
      {replay && (request.step > 0 || provider) ? <p className={styles.note}>{t('guidance.replay')}</p> : null}
      <section className={styles.agent}>
        <p className={styles.note}>{t(provider ? 'guidance.agentNote' : 'guidance.noAgent')}</p>
        <div className={styles.agentButtons}><Button disabled={stale} icon={<Sparkles size={16} />} onClick={() => ask(false)}>{t(provider ? 'guidance.agent' : 'guidance.setupAgent')}</Button>{provider ? <Button disabled={stale || replay} onClick={() => ask(true)}>{t('guidance.agentFix')}</Button> : null}</div>
      </section>
    </div>
    <footer className={styles.footer}>
      <Button variant="subtle" onClick={close}>{t('menu.close')}</Button>
      {request.step > 0 ? <Button onClick={() => update({ step: request.step - 1 })}>{t('guidance.previous')}</Button> : null}
      {request.step < 2 ? <Button variant="primary" quiet onClick={() => update({ step: request.step + 1 })}>{t('guidance.next')}</Button> : <Button disabled={!guideResultObserved(request, revision)} onClick={() => { close(); useGuidanceStore.setState({ request: null }); showToast({ id: 'guidance-completed', tone: 'info', title: String(t('guidance.done')) }); }}>{t('guidance.solved')}</Button>}
    </footer>
  </>;
}

export default function GuidanceWizard() {
  const { t, i18n } = useTranslation(); const language = i18n.language.startsWith('en') ? 'en' : 'ru';
  const { open, request, update, close } = useGuidanceStore();
  if (!request) return null;
  const problem = GUIDE_PROBLEMS.find((p) => p.id === request.problemId);
  const entries = searchGuides(request.query, request.category);
  return <DialogRoot open={open} onOpenChange={(value) => { if (!value) close(); }}><DialogPortal><DialogOverlay /><DialogContent className={styles.dialog} aria-describedby="guidance-lead">
    <header className={styles.header}><IconButton className={styles.close} label={String(t('guidance.close'))} onClick={close}><X size={20} /></IconButton><DialogTitle className={styles.title}><LifeBuoy size={22} aria-hidden="true" />{t('guidance.title')}</DialogTitle><DialogDescription id="guidance-lead" className={styles.note}>{t('guidance.lead')}</DialogDescription></header>
    {problem ? <GuideSteps request={request} problem={problem} /> : <div className={styles.body}>
      <label className={styles.search}>{t('guidance.search')}<span><Search size={18} aria-hidden="true" /><input type="search" value={request.query} placeholder={String(t('guidance.placeholder'))} onChange={(event) => update({ query: event.target.value })} /></span></label>
      <div className={styles.categories} role="group" aria-label={String(t('guidance.all'))}><button type="button" aria-pressed={!request.category} onClick={() => update({ category: '' })}>{t('guidance.all')}</button>{GUIDE_CATEGORIES.map((category) => <button type="button" key={category} aria-pressed={request.category === category} onClick={() => update({ category })}>{t(`guidance.categories.${category}`)}</button>)}</div>
      <p className={styles.note} role="status">{t('guidance.count', { count: entries.length })}</p>
      <div className={styles.problems}>{entries.map((entry) => <button type="button" key={entry.id} onClick={() => update({ problemId: entry.id, step: 0 })}><span>{entry.title[language]}</span><ArrowRight size={17} aria-hidden="true" /><small>{t(`guidance.categories.${entry.category}`)}</small></button>)}</div>
      {!entries.length ? <div className={styles.empty}><p>{t('guidance.empty')}</p><Button onClick={() => update({ query: '', category: '' })}>{t('guidance.clear')}</Button></div> : null}
    </div>}
  </DialogContent></DialogPortal></DialogRoot>;
}
