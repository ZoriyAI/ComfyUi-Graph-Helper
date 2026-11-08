import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, Crosshair, MessageCircleQuestion } from 'lucide-react';
import { objectKey, type Explanation, type ExplanationAspect, type ObjectRef } from '../../../shared/contracts';
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
import { ASPECTS, groupByAspect, isGlobalOwner, isStale, missingAspects, safeSourceUrl } from './explainModel';
import styles from './ExplainPanel.module.css';

const EMPTY: Explanation[] = [];

const ITEM_MOTION = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.16 },
} as const;

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
      <span>{t('explain.source')}:</span>
      <span className={styles.url} title={url}>{url}</span>
      <button
        type="button"
        className={`${styles.button} ${styles.iconButton}`}
        aria-label={String(copied ? t('explain.copied') : t('explain.copyLink'))}
        title={String(copied ? t('explain.copied') : t('explain.copyLink'))}
        onClick={() => void copy()}
      >
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      </button>
    </div>
  );
}

function ExplanationItem({ item, currentRevisionId }: { item: Explanation; currentRevisionId: string | null }) {
  const { t } = useTranslation();
  const stale = isStale(item, currentRevisionId);
  const url = item.provenance === 'web' ? safeSourceUrl(item.sourceUrl) : null;
  return (
    <article className={styles.item} data-provenance={item.provenance} data-stale={stale}>
      <div className={styles.meta}>
        <ProvenanceBadge provenance={item.provenance} />
        {stale ? <span className={styles.stale}>{t('knowledge.stale')}</span> : null}
      </div>
      <p className={styles.itemText}>{item.text}</p>
      {url ? <SourceLink url={url} /> : null}
      <div className={styles.meta}>
        {item.revisionId
          ? <span className={styles.mono}>{t('explain.revision', { revision: item.revisionId })}</span>
          : <span>{t('explain.global')}</span>}
      </div>
    </article>
  );
}

function AspectGroups({ list, currentRevisionId }: { list: Explanation[]; currentRevisionId: string | null }) {
  const { t } = useTranslation();
  return (
    <>
      {groupByAspect(list).map((group) => (
        <section key={group.aspect} className={styles.section} data-aspect={group.aspect}>
          <h3 className={styles.sectionTitle}>{t(aspectLabelKey(group.aspect))}</h3>
          <AnimatePresence initial={false}>
            {group.items.map((item) => (
              <motion.div key={item.id} {...ITEM_MOTION}>
                <ExplanationItem item={item} currentRevisionId={currentRevisionId} />
              </motion.div>
            ))}
          </AnimatePresence>
        </section>
      ))}
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
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            disabled={!text.trim() || state.kind === 'saving'}
            onClick={() => void save()}
          >
            {t('explain.addSave')}
          </button>
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
                  <ProvenanceBadge provenance={item.provenance} />
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
 * Chat workstream: explanations for uiState.focusRef, grouped by aspect, each with its provenance,
 * the revision it was written for, and a stale marker. Missing aspects can be asked for; a person can add a note.
 */
export default function ExplainPanel() {
  const { t, i18n } = useTranslation();
  const focus = useUiStore((state) => state.focusRef);
  const selection = useUiStore((state) => state.selection);
  const setFocus = useUiStore((state) => state.setFocus);
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const currentRevisionId = useRevisionStore((state) => state.currentRevisionId);
  const loadExplanations = useKnowledgeStore((state) => state.loadExplanations);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'failed'>('idle');

  const node = focus?.kind === 'node' ? nodes.find((item) => item.id === focus.id) : undefined;
  const classType = focus?.kind === 'node' ? focus.classType ?? node?.data.comfyType : undefined;
  const classRef: ObjectRef | null = classType ? { kind: 'nodeClass', id: classType, classType } : null;
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

  const label = useMemo(
    () => (focus ? objectLabel(focus, { nodes, edges }, String(t('explain.processName'))) : ''),
    [focus, nodes, edges, t],
  );

  if (!focus) {
    return (
      <section className={`explain-panel ${styles.panel}`} aria-labelledby="explain-title">
        <h2 className={styles.name} id="explain-title">{t('explain.title')}</h2>
        <div className={styles.empty}>
          <strong>{t('explain.emptyTitle')}</strong>
          <p>{t('explain.emptyBody')}</p>
          {selection.length > 0 ? (
            <div className={styles.buttons}>
              <button type="button" className={styles.button} onClick={() => setFocus(selection[0])}>
                <Crosshair size={14} aria-hidden="true" />
                {t('explain.explainSelection')}
              </button>
            </div>
          ) : null}
        </div>
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

      <AspectGroups list={own} currentRevisionId={currentRevisionId} />

      {classRef && shared.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('explain.classKnowledge', { classType })}</h3>
          <AspectGroups list={shared} currentRevisionId={currentRevisionId} />
        </section>
      ) : null}

      {missing.length > 0 ? (
        <section className={styles.section} aria-labelledby="explain-missing-title">
          <h3 className={styles.sectionTitle} id="explain-missing-title">{t('explain.missingTitle')}</h3>
          <div className={styles.buttons}>
            {missing.map((aspect) => (
              <button key={aspect} type="button" className={styles.button} onClick={() => ask(aspect)}>
                <MessageCircleQuestion size={14} aria-hidden="true" />
                {t('explain.explainAspect', { aspect: t(aspectLabelKey(aspect)) })}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <AddNote owner={focus} label={label} />
      <History />
    </section>
  );
}
