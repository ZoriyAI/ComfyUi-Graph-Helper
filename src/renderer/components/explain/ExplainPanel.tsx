import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, Crosshair, Lightbulb, MessageCircleQuestion } from 'lucide-react';
import EmptyState from '../../ui/EmptyState';
import { objectKey, objectScope, type Explanation, type ExplanationAspect, type ObjectRef } from '../../../shared/contracts';
import { aspectLabelKey } from '../../../shared/knowledge/labels';
import { redactDiagnostic } from '../../../shared/i18n';
import { DESKTOP_PROJECT_ID } from '../../../shared/project';
import { useGraphStore } from '../../state/graphState';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { useRevisionStore } from '../../state/revisionState';
import { useUiStore } from '../../state/uiState';
import { requestAsk } from '../../services/ask';
import { turnLanguage } from '../../services/llm/chatModel';
import { objectLabel } from '../chat/objectLabel';
import ProvenanceBadge from './ProvenanceBadge';
import { ASPECTS, explanationScope, groupByAspect, isGlobalOwner, isStale, missingAspects, shownSourceUrl } from './explainModel';
import { edgeDataType, linkTypeRef } from '../graph/lib/linkTypeKnowledge';
import Button from '../../ui/Button';
import IconButton from '../../ui/IconButton';
import styles from './ExplainPanel.module.css';

const EMPTY: Explanation[] = [];

const ITEM_MOTION = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
} as const;

/** "https://docs.comfy.org/built-in-nodes/KSampler" as the site in full and the path after it, with a break point after each slash. */
function addressParts(url: string): React.ReactNode {
  const match = /^(https?:\/\/)([^/]+)(.*)$/.exec(url);
  if (!match) return url;
  const path = match[3].split(/(?<=\/)/);
  return (
    <>
      <span className={styles.host}>{match[2]}</span>
      {path.map((part, index) => <React.Fragment key={index}>{part}<wbr /></React.Fragment>)}
    </>
  );
}

function SourceLink({ url }: { url: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className={styles.source}>
      <span className={styles.sourceLabel}>{t('explain.source')}:</span>
      {/* The address is read as a site and a path, and breaks only after a slash, never inside a word. */}
      <span className={styles.url} title={url}>{addressParts(url)}</span>
      <IconButton size="sm" label={String(copied ? t('explain.copied') : t('explain.copyLink'))} onClick={() => void copy()}>
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      </IconButton>
    </div>
  );
}

function ExplanationItem({ item, currentRevisionId, scopeSaid = false }: { item: Explanation; currentRevisionId: string | null; scopeSaid?: boolean }) {
  const { t } = useTranslation();
  const removeNote = useKnowledgeStore((state) => state.removeNote);
  const stale = isStale(item, currentRevisionId);
  const url = shownSourceUrl(item);
  const scope = explanationScope(item);
  return (
    <article className={styles.item} data-provenance={item.provenance} data-by={item.createdBy} data-stale={stale}>
      <div className={styles.meta}>
        <ProvenanceBadge provenance={item.provenance} by={item.createdBy} />
        {stale ? <span className={styles.stale}>{t('knowledge.stale')}</span> : null}
      </div>
      <p className={styles.itemText}>{item.text}</p>
      {url ? <SourceLink url={url} /> : null}
      {scopeSaid && scope === 'global' && item.createdBy !== 'user' ? null : (
        <div className={styles.meta}>
          {scopeSaid && scope === 'global' ? null : (
            <span>{t(scope === 'graph' ? 'explain.scopeGraph' : scope === 'project' ? 'explain.scopeProject' : 'explain.global')}</span>
          )}
          {item.createdBy === 'user' ? (
            <Button size="sm" quiet onClick={() => void removeNote(item)}>{t('explain.deleteNote')}</Button>
          ) : null}
        </div>
      )}
    </article>
  );
}

/** One action that removes what the assistant wrote about this object, in every project (P0 of the review). */
function RemoveAssistantWords({ owner, list }: { owner: ObjectRef; list: readonly Explanation[] }) {
  const { t } = useTranslation();
  const removeAssistant = useKnowledgeStore((state) => state.removeAssistant);
  if (!list.some((item) => item.createdBy === 'ai')) return null;
  return (
    <div className={styles.buttons}>
      <Button size="sm" quiet onClick={() => void removeAssistant(owner)} data-remove-assistant>{t('explain.removeAssistant')}</Button>
    </div>
  );
}

function AspectGroups({ list, currentRevisionId }: { list: Explanation[]; currentRevisionId: string | null }) {
  const { t } = useTranslation();
  return (
    <>
      {groupByAspect(list).map((group) => {
        // When every explanation of a topic is general knowledge, that is said once, beside the topic.
        const allGlobal = group.items.length > 0 && group.items.every((item) => !item.revisionId);
        return (
          <section key={group.aspect} className={styles.section} data-aspect={group.aspect}>
            <h3 className={styles.sectionTitle}>
              <span>{t(aspectLabelKey(group.aspect))}</span>
              {allGlobal ? <span className={styles.scope}>{t('explain.global')}</span> : null}
            </h3>
            <AnimatePresence initial={false}>
              {group.items.map((item) => (
                <motion.div key={item.id} {...ITEM_MOTION}>
                  <ExplanationItem item={item} currentRevisionId={currentRevisionId} scopeSaid={allGlobal} />
                </motion.div>
              ))}
            </AnimatePresence>
          </section>
        );
      })}
    </>
  );
}

function AddNote({ owner, label }: { owner: ObjectRef; label: string }) {
  const { t } = useTranslation();
  const saveExplanation = useKnowledgeStore((state) => state.saveExplanation);
  const currentRevisionId = useRevisionStore((state) => state.currentRevisionId);
  const [aspect, setAspect] = useState<ExplanationAspect>('what');
  const [text, setText] = useState('');
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'saved' } | { kind: 'error'; message: string }>({ kind: 'idle' });
  const key = objectKey(owner);

  useEffect(() => {
    setText('');
    setState({ kind: 'idle' });
  }, [key]);

  const save = async () => {
    const body = text.trim();
    if (!body) return;
    setState({ kind: 'saving' });
    const global = isGlobalOwner(owner);
    try {
      await saveExplanation({
        projectId: global ? null : DESKTOP_PROJECT_ID,
        owner,
        aspect,
        text: body,
        provenance: 'user',
        sourceUrl: null,
        revisionId: global ? null : currentRevisionId || null,
        createdBy: 'user',
      });
      setText('');
      setState({ kind: 'saved' });
    } catch (error) {
      setState({ kind: 'error', message: redactDiagnostic(error instanceof Error ? error.message : String(error)) });
    }
  };

  const fieldId = `explain-note-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  return (
    <section className={styles.section} aria-labelledby={`${fieldId}-title`}>
      <h3 className={styles.sectionTitle} id={`${fieldId}-title`}>{t('explain.addTitle')}</h3>
      <div className={styles.form} data-note-owner={key} title={label}>
        <label className={styles.label} htmlFor={`${fieldId}-aspect`}>{t('explain.addAspect')}</label>
        <select
          id={`${fieldId}-aspect`}
          className={styles.field}
          value={aspect}
          onChange={(event) => setAspect(event.target.value as ExplanationAspect)}
        >
          {ASPECTS.map((item) => <option key={item} value={item}>{t(aspectLabelKey(item))}</option>)}
        </select>
        <label className={styles.label} htmlFor={`${fieldId}-text`}>{t('explain.addText')}</label>
        <textarea
          id={`${fieldId}-text`}
          className={styles.field}
          value={text}
          maxLength={20000}
          onChange={(event) => setText(event.target.value)}
        />
        <div className={styles.buttons}>
          <Button variant="subtle" size="sm" disabled={!text.trim() || state.kind === 'saving'} onClick={() => void save()}>
            {t('explain.addSave')}
          </Button>
        </div>
        {state.kind === 'saved' ? <p className={styles.ok} role="status">{t('explain.addSaved')}</p> : null}
        {state.kind === 'error' ? <p className={styles.error} role="status">{t('explain.addFailed', { error: state.message })}</p> : null}
      </div>
    </section>
  );
}

function History() {
  const { t } = useTranslation();
  const recent = useKnowledgeStore((state) => state.recent);
  const loadRecent = useKnowledgeStore((state) => state.loadRecent);
  const setFocus = useUiStore((state) => state.setFocus);
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);

  useEffect(() => {
    void loadRecent().catch(() => undefined);
  }, [loadRecent]);

  return (
    <section className={styles.section} aria-labelledby="explain-history-title">
      <h3 className={styles.sectionTitle} id="explain-history-title">{t('explain.historyTitle')}</h3>
      {recent.length === 0 ? (
        <p className={styles.note}>{t('explain.historyEmpty')}</p>
      ) : (
        <ul className={styles.history}>
          {recent.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => setFocus(item.owner)}>
                <span className={styles.meta}>
                  <ProvenanceBadge provenance={item.provenance} by={item.createdBy} />
                  <span>{t(aspectLabelKey(item.aspect))}</span>
                  <span>·</span>
                  <span>{objectLabel(item.owner, { nodes, edges }, String(t('explain.processName')))}</span>
                </span>
                <span className={styles.snippet}>{item.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Explanations for uiState.focusRef, grouped by aspect, each with its provenance,
 * the revision it was written for, and a stale marker. Missing aspects can be asked for; a person can add a note.
 */
export default function ExplainPanel() {
  const { t, i18n } = useTranslation();
  const focus = useUiStore((state) => state.focusRef);
  const selection = useUiStore((state) => state.selection);
  const setFocus = useUiStore((state) => state.setFocus);
  const rootNodes = useGraphStore((state) => state.nodes);
  const rootEdges = useGraphStore((state) => state.edges);
  const subgraphs = useGraphStore((state) => state.subgraphs);
  // An object inside a subgraph definition is looked up among that definition's nodes and links.
  const focusScope = focus ? objectScope(focus) : '';
  const scoped = focusScope ? subgraphs.find((item) => item.id === focusScope) : undefined;
  const nodes = (scoped ? scoped.nodes : rootNodes) as typeof rootNodes;
  const edges = (scoped ? scoped.edges : rootEdges) as typeof rootEdges;
  const currentRevisionId = useRevisionStore((state) => state.currentRevisionId);
  const loadExplanations = useKnowledgeStore((state) => state.loadExplanations);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'failed'>('idle');

  const node = focus?.kind === 'node' ? nodes.find((item) => item.id === focus.id) : undefined;
  const classType = focus?.kind === 'node' ? focus.classType ?? node?.data.comfyType : undefined;
  const edge = focus?.kind === 'edge' ? edges.find((item) => item.id === focus.id) : undefined;
  const edgeOutputType = edge ? nodes.find((item) => item.id === edge.source)?.data.outputs.find((port) => port.id === edge.sourceHandle)?.dataType : undefined;
  // A node shares its class knowledge; an edge shares the knowledge about the data type it carries.
  // A port shares the knowledge about the data type it takes or gives (built-in knowledge, also with no assistant).
  const portNode = focus?.kind === 'port' && focus.nodeId ? nodes.find((item) => item.id === focus.nodeId) : undefined;
  const portList = portNode ? (focus?.direction === 'output' ? portNode.data.outputs : portNode.data.inputs) : undefined;
  const portType = focus?.kind === 'port' ? portList?.find((port) => port.name === focus.portName || port.id === focus.id)?.dataType : undefined;
  const classRef: ObjectRef | null = classType
    ? { kind: 'nodeClass', id: classType, classType }
    : edge ? linkTypeRef(edgeDataType(edge, edgeOutputType)) : portType ? linkTypeRef(portType) : null;
  const sharedTitle = classType ?? classRef?.id;
  const focusKey = focus ? objectKey(focus) : null;
  const classKey = classRef ? objectKey(classRef) : null;

  const own = useKnowledgeStore((state) => (focusKey ? state.explanations[focusKey] ?? EMPTY : EMPTY));
  const shared = useKnowledgeStore((state) => (classKey ? state.explanations[classKey] ?? EMPTY : EMPTY));

  useEffect(() => {
    if (!focus) return;
    let live = true;
    setLoadState('loading');
    const work: Array<Promise<unknown>> = [loadExplanations(focus)];
    if (classRef) work.push(loadExplanations(classRef));
    Promise.all(work)
      .then(() => { if (live) setLoadState('idle'); })
      .catch(() => { if (live) setLoadState('failed'); });
    return () => { live = false; };
    // Keys stand for the refs: a new ref object for the same object must not reload.
  }, [focusKey, classKey, loadExplanations]);

  // The tab follows the selection: one selected object becomes the one explained (owner's list).
  const selectedKey = selection.length === 1 ? objectKey(selection[0]) : null;
  useEffect(() => {
    if (selectedKey && selectedKey !== focusKey) setFocus(selection[0]);
    // Only a change of the selection moves the tab; a question asked about another object keeps its answer.
  }, [selectedKey]);
  // The object was deleted or the graph replaced: the tab says so instead of explaining what is gone.
  const gone = (focus?.kind === 'node' && !node) || (focus?.kind === 'edge' && !edge);

  const label = useMemo(
    () => (focus ? objectLabel(focus, { nodes, edges }, String(t('explain.processName'))) : ''),
    [focus, nodes, edges, t],
  );

  if (!focus) {
    return (
      <section className={`explain-panel ${styles.panel}`} aria-labelledby="explain-title">
        {/* The dock tab already says "Explain"; the heading names the region for screen readers only. */}
        <h2 className="sr-only" id="explain-title">{t('explain.title')}</h2>
        <EmptyState
          size="compact"
          className={styles.empty}
          icon={<Lightbulb size={18} />}
          title={String(t('explain.emptyTitle'))}
          actions={selection.length > 0 ? (
            <button type="button" className={styles.button} onClick={() => setFocus(selection[0])}>
              <Crosshair size={14} aria-hidden="true" />
              {t('explain.explainSelection')}
            </button>
          ) : undefined}
        >
          <p>{t('explain.emptyBody')}</p>
        </EmptyState>
        <History />
      </section>
    );
  }

  const missing = missingAspects([...own, ...shared]);
  const ask = (aspect: ExplanationAspect) => {
    requestAsk({
      context: { intent: 'ask', objectRef: focus, selection, language: turnLanguage(i18n.language) },
      message: String(t(`explain.ask.${aspect}`, { object: label })),
    });
  };

  return (
    <section className={`explain-panel ${styles.panel}`} aria-labelledby="explain-title" data-focus={focusKey ?? undefined}>
      <header className={styles.head}>
        <span className={styles.kind}>{t(`explain.objectKind.${focus.kind}`)}</span>
        <h2 className={styles.name} id="explain-title">{label}</h2>
        {classType && classType !== label ? <span className={styles.mono}>{classType}</span> : null}
        {focus.kind === 'model' && focus.directory ? <span className={styles.mono}>{focus.directory}</span> : null}
      </header>

      {loadState === 'loading' && own.length === 0 && shared.length === 0 ? <p className={styles.note}>{t('explain.loading')}</p> : null}
      {loadState === 'failed' ? <p className={styles.error} role="status">{t('explain.loadFailed')}</p> : null}
      {gone ? <p className={styles.note} role="status" data-explain-gone>{t('explain.gone')}</p> : null}

      <AspectGroups list={own} currentRevisionId={currentRevisionId} />
      <RemoveAssistantWords owner={focus} list={own} />

      {classRef && shared.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            {classType ? t('explain.classKnowledge', { classType }) : t('explain.typeKnowledge', { type: sharedTitle ?? classRef.id })}
          </h3>
          <AspectGroups list={shared} currentRevisionId={currentRevisionId} />
          <RemoveAssistantWords owner={classRef} list={shared} />
        </section>
      ) : null}

      {missing.length > 0 ? (
        <section className={styles.section} aria-labelledby="explain-missing-title">
          <h3 className={styles.sectionTitle} id="explain-missing-title">{t('explain.missingTitle')}</h3>
          <div className={styles.buttons}>
            {missing.map((aspect) => (
              <Button key={aspect} variant="subtle" size="sm" icon={<MessageCircleQuestion size={14} />} onClick={() => ask(aspect)}>
                {t('explain.explainAspect', { aspect: t(aspectLabelKey(aspect)) })}
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      <AddNote owner={focus} label={label} />
      <History />
    </section>
  );
}
