/**
 * The Check tab of the dock: runs the graph check, lists the findings by type, shows each on the canvas and lets
 * the person ask the helper why. shell/Dock.tsx mounts it; tests/unit/explainCheckRender.test.ts renders it.
 * Advice about prompts is listed apart and never counted, because the graph still runs with it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { CircleCheck, Crosshair, Lightbulb, ListChecks, MessageCircleQuestion, OctagonAlert, TriangleAlert } from 'lucide-react';
import type { BaseModelFamily } from '../../../shared/contracts';
import { familyLabelKey } from '../../../shared/knowledge/labels';
import { redactDiagnostic } from '../../../shared/i18n';
import { useGraphStore } from '../../state/graphState';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { useUiStore } from '../../state/uiState';
import { useCanvasStore } from '../graph/canvasStore';
import { requestAsk } from '../../services/ask';
import { turnLanguage } from '../../services/llm/chatModel';
import { adviceOf, checkFindingCount, findingNodeIds, groupCheckReport, nodeNamer, type CheckFinding } from './checkModel';
import Button from '../../ui/Button';
import IconButton from '../../ui/IconButton';
import styles from './CheckPanel.module.css';
import EmptyState from '../../ui/EmptyState';
import ResourcePanel from './ResourcePanel';
import SearchField from '../../ui/SearchField';

/** A finding row rises into place; a fixed one fades out. */
const ROW_MOTION = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
} as const;

/** The kinds of finding that stop a graph from running: the colour and icon of errors. The rest are warnings. */
const STOPPERS = new Set(['missingNodes', 'typeMismatches', 'unknownNodeTypes']);

/** The names in a finding («Load LoRA», "KSampler") stand out from the sentence around them. */
function withNames(text: string): React.ReactNode[] {
  return text.split(/(«[^»]+»|"[^"\n]+"|“[^”\n]+”)/g).map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part));
}

/**
 * One finding: a severity icon, the sentence (a press on it shows the place on the canvas) and, at its end, a
 * quiet "Ask why". The whole row is the "Show" button, so seven findings are not fourteen identical buttons.
 */
function FindingRow({ finding, text, hint, onShow, onAsk }: { finding: CheckFinding; text: string; hint?: string; onShow: () => void; onAsk: () => void }) {
  const { t } = useTranslation();
  const Icon = finding.type === 'promptNotes' ? Lightbulb : STOPPERS.has(finding.type) ? OctagonAlert : TriangleAlert;
  const textId = `check-finding-${finding.key.replace(/[^\w-]/g, '_')}`;
  return (
    <>
      {/* Accessibility: the button is named by the finding it shows (the words on it), then by what it does. */}
      <button type="button" className={styles.show} title={hint} onClick={onShow}>
        <Icon className={styles.severity} size={14} aria-hidden="true" />
        <span className={styles.text} id={textId}>{withNames(text)}</span>
        <span className="sr-only">{`. ${String(t('explain.checkShow'))}`}</span>
        <Crosshair className={styles.showMark} size={14} aria-hidden="true" />
      </button>
      {/* Its name is its tooltip (IconButton): the panel also renders where no tooltip provider is mounted. */}
      <IconButton size="sm" className={styles.ask} label={String(t('explain.checkAskWhy'))} aria-describedby={textId} onClick={onAsk}>
        <MessageCircleQuestion size={15} aria-hidden="true" />
      </IconButton>
    </>
  );
}

/** Hundreds of findings stay searchable without mounting thousands of animated rows. */
function FindingPages({ items, reset, label, children }: { items: CheckFinding[]; reset: unknown; label: string; children: (item: CheckFinding) => React.ReactNode }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [reset]);
  const current = Math.min(page, Math.max(0, Math.ceil(items.length / 50) - 1));
  const start = current * 50;
  return <>
    <ul className={styles.list}><AnimatePresence initial={false}>{items.slice(start, start + 50).map(children)}</AnimatePresence></ul>
    {items.length > 50 ? <nav className={styles.runRow} aria-label={label}>
      <Button size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>{t('check.previousFindings')}</Button>
      <span className={styles.note} role="status">{t('check.findingsRange', { from: start + 1, to: Math.min(start + 50, items.length), total: items.length })}</span>
      <Button size="sm" disabled={start + 50 >= items.length} onClick={() => setPage(current + 1)}>{t('check.nextFindings')}</Button>
    </nav> : null}
  </>;
}

/**
 * The pre-export check. Runs knowledge:check-graph through the knowledge store, lists findings
 * by type, focuses each on the canvas, and lets the person ask why. The count lives in useKnowledgeStore().check.
 */
export default function CheckPanel({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation();
  const report = useKnowledgeStore((state) => state.check);
  const checking = useKnowledgeStore((state) => state.checking);
  const runCheck = useKnowledgeStore((state) => state.runCheck);
  const setFocus = useUiStore((state) => state.setFocus);
  const nodes = useGraphStore((state) => state.nodes);
  const definitions = useGraphStore((state) => state.subgraphs);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // The report names inputs; the canvas needs their handle ids, at the top level or inside a subgraph.
  const resolvePort = useCallback((nodeId: string, inputName: string, subgraphId?: string) => {
    const level = subgraphId ? definitions.find((item) => item.id === subgraphId)?.nodes ?? [] : nodes;
    const node = level.find((item) => item.id === nodeId);
    return node?.data.inputs.find((port: { name: string; id: string }) => port.name === inputName)?.id;
  }, [nodes, definitions]);

  const run = async () => {
    setError(null);
    try {
      await runCheck(projectId);
    } catch (reason) {
      setError(redactDiagnostic(reason instanceof Error ? reason.message : String(reason)));
    }
  };

  /**
   * "Show": the object the row is about becomes the one the Explain panel and the canvas speak of, and for a node
   * or one of its ports the canvas goes to the node and selects it, so it is found without looking for it.
   */
  const show = (finding: CheckFinding) => {
    const graph = useGraphStore.getState();
    if (finding.ref.subgraphId) graph.enterSubgraph(finding.ref.subgraphId);
    else graph.exitSubgraph();
    setFocus(finding.ref);
    const nodeId = finding.ref.kind === 'node' ? finding.ref.id : finding.ref.kind === 'port' ? finding.ref.nodeId : undefined;
    if (nodeId) useCanvasStore.getState().requestCenter(nodeId, finding.ref.subgraphId);
  };

  // Base model families are stored as codes; the sentence gets their translated names.
  const findingText = (finding: CheckFinding): string => {
    const values: Record<string, string> = { ...finding.values };
    if (finding.type === 'baseModelMismatches') {
      values.modelBase = String(t(familyLabelKey(finding.values.modelBase as BaseModelFamily)));
      values.otherBase = String(t(familyLabelKey(finding.values.otherBase as BaseModelFamily)));
    }
    return String(t(finding.textKey, values));
  };

  const askWhy = (finding: CheckFinding) => {
    requestAsk({
      context: {
        intent: 'ask',
        objectRef: finding.ref,
        selection: useUiStore.getState().selection,
        language: turnLanguage(i18n.language),
      },
      message: String(t('explain.checkAskMessage', { finding: findingText(finding) })),
    });
  };

  const count = checkFindingCount(report);
  // Findings name nodes by their titles on the canvas; the ids stay in each row's tooltip.
  const groups = report ? groupCheckReport(report, resolvePort, nodeNamer(nodes, definitions)) : [];
  // Advice about the descriptions stands apart: the graph runs with it, so it is not a problem and not counted.
  const advice = report ? adviceOf(report, nodeNamer(nodes, definitions)) : [];
  const idsHint = (finding: CheckFinding): string | undefined => {
    const ids = findingNodeIds(finding.values);
    return ids.length > 0 ? String(t('check.nodeIds', { count: ids.length, ids: ids.join(', ') })) : undefined;
  };
  const needle = query.trim().toLocaleLowerCase();
  const matches = (finding: CheckFinding) => !needle || `${findingText(finding)} ${findingNodeIds(finding.values).join(' ')}`.toLocaleLowerCase().includes(needle);
  const filteredGroups = groups.map(group => ({ ...group, findings: group.findings.filter(matches) })).filter(group => group.findings.length);
  const filteredAdvice = advice.filter(matches);

  return (
    <section className={`check-panel ${styles.panel}`} aria-labelledby="check-title" data-project={projectId}>
      {/* The dock tab already says "Check"; the heading names the region for screen readers only. */}
      <h2 className="sr-only" id="check-title">{t('explain.checkTitle')}</h2>
      <ResourcePanel projectId={projectId} />
      {(() => {
        // Before the first check it is the one thing to do here; afterwards checking again steps back.
        const runButton = (
          <Button variant={report ? 'subtle' : 'primary'} quiet size="sm" icon={<ListChecks size={14} />} disabled={checking} onClick={() => void run()}>
            {checking ? t('explain.checkRunning') : t('check.run')}
          </Button>
        );
        // Not checked yet: the same empty state as every dock tab; afterwards the intro and the button stay on top.
        if (!report && !error) {
          return (
            <EmptyState size="compact" icon={<ListChecks size={18} />} title={String(t('explain.checkNotRun'))} actions={runButton}>
              <p>{t('explain.checkIntro')}</p>
            </EmptyState>
          );
        }
        return (
          <>
            <p className={styles.intro}>{t('explain.checkIntro')}</p>
            <div className={styles.runRow}>
              {runButton}
              {report && count > 0 ? <span className={styles.count}>{t('explain.checkCount', { count })}</span> : null}
            </div>
          </>
        );
      })()}
      {error ? <p className={styles.error} role="status">{t('explain.checkFailed', { error })}</p> : null}
      {report && count === 0 ? (
        <div className={styles.clear} role="status">
          <CircleCheck size={16} aria-hidden="true" />
          <span>{t('check.ok')}</span>
        </div>
      ) : null}
      {count + advice.length > 0 ? <SearchField value={query} onValueChange={setQuery} label={String(t('check.searchFindings'))} clearLabel={String(t('check.clearFindingsSearch'))} placeholder={String(t('check.searchFindings'))} /> : null}
      {needle && !filteredGroups.length && !filteredAdvice.length ? <p role="status">{t('check.noMatchingFindings')}</p> : null}
      {filteredGroups.map((group) => (
        <section key={group.type} className={styles.group} aria-labelledby={`check-group-${group.type}`} data-check-group={group.type}>
          <h3 className={styles.groupTitle} id={`check-group-${group.type}`} data-stops={STOPPERS.has(group.type) ? 'true' : undefined}>
            {STOPPERS.has(group.type) ? <OctagonAlert size={14} aria-hidden="true" /> : <TriangleAlert size={14} aria-hidden="true" />}
            {t(group.titleKey)} ({group.findings.length})
          </h3>
          <FindingPages key={`${group.type}:${query}`} items={group.findings} reset={report} label={String(t(group.titleKey))}>
              {(finding) => {
                const text = findingText(finding);
                return (
                  <motion.li key={finding.key} className={styles.row} data-type={finding.type} {...ROW_MOTION}>
                    <FindingRow finding={finding} text={text} hint={idsHint(finding)} onShow={() => show(finding)} onAsk={() => askWhy(finding)} />
                  </motion.li>
                );
              }}
          </FindingPages>
        </section>
      ))}
      {filteredAdvice.length > 0 ? (
        <section className={`${styles.group} ${styles.advice}`} aria-labelledby="check-group-promptNotes" data-check-group="promptNotes">
          <h3 className={styles.groupTitle} id="check-group-promptNotes">
            <Lightbulb size={14} aria-hidden="true" />
            {t('check.promptNotes')} ({filteredAdvice.length})
          </h3>
          <p className={styles.note}>{t('check.promptNotesLead')}</p>
          <FindingPages key={`advice:${query}`} items={filteredAdvice} reset={report} label={String(t('check.promptNotes'))}>
            {(finding) => (
              <li key={finding.key} className={styles.row} data-type={finding.type}>
                <FindingRow finding={finding} text={findingText(finding)} hint={idsHint(finding)} onShow={() => show(finding)} onAsk={() => askWhy(finding)} />
              </li>
            )}
          </FindingPages>
        </section>
      ) : null}
    </section>
  );
}
