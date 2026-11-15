import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { CircleCheck, Crosshair, Lightbulb, ListChecks, MessageCircleQuestion, TriangleAlert } from 'lucide-react';
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
import styles from './CheckPanel.module.css';
import EmptyState from '../../ui/EmptyState';

const ROW_MOTION = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.16 },
} as const;

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

  return (
    <section className={`check-panel ${styles.panel}`} aria-labelledby="check-title" data-project={projectId}>
      <div className={styles.head}>
        {/* The dock tab already says "Check"; the heading names the region for screen readers only. */}
        <h2 className="sr-only" id="check-title">{t('explain.checkTitle')}</h2>
        {report && count > 0 ? <span className={styles.count}>{t('explain.checkCount', { count })}</span> : null}
      </div>
      {(() => {
        const runButton = (
          <button type="button" className={`${styles.button} ${styles.primary}`} disabled={checking} onClick={() => void run()}>
            <ListChecks size={14} aria-hidden="true" />
            {checking ? t('explain.checkRunning') : t('check.run')}
          </button>
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
            <div className={styles.buttons}>{runButton}</div>
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
      {groups.map((group) => (
        <section key={group.type} className={styles.group} aria-labelledby={`check-group-${group.type}`} data-check-group={group.type}>
          <h3 className={styles.groupTitle} id={`check-group-${group.type}`}>
            <TriangleAlert size={14} aria-hidden="true" />
            {t(group.titleKey)} ({group.findings.length})
          </h3>
          <ul className={styles.list}>
            <AnimatePresence initial={false}>
              {group.findings.map((finding) => {
                const text = findingText(finding);
                return (
                  <motion.li key={finding.key} className={styles.row} data-type={finding.type} {...ROW_MOTION}>
                    <p className={styles.text} title={idsHint(finding)}>{text}</p>
                    <div className={styles.buttons}>
                      <button type="button" className={styles.button} onClick={() => show(finding)}>
                        <Crosshair size={14} aria-hidden="true" />
                        {t('explain.checkShow')}
                      </button>
                      <button type="button" className={styles.button} onClick={() => askWhy(finding)}>
                        <MessageCircleQuestion size={14} aria-hidden="true" />
                        {t('explain.checkAskWhy')}
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </section>
      ))}
      {advice.length > 0 ? (
        <section className={`${styles.group} ${styles.advice}`} aria-labelledby="check-group-promptNotes" data-check-group="promptNotes">
          <h3 className={styles.groupTitle} id="check-group-promptNotes">
            <Lightbulb size={14} aria-hidden="true" />
            {t('check.promptNotes')} ({advice.length})
          </h3>
          <p className={styles.note}>{t('check.promptNotesLead')}</p>
          <ul className={styles.list}>
            {advice.map((finding) => (
              <li key={finding.key} className={styles.row} data-type={finding.type}>
                <p className={styles.text} title={idsHint(finding)}>{findingText(finding)}</p>
                <div className={styles.buttons}>
                  <button type="button" className={styles.button} onClick={() => show(finding)}>
                    <Crosshair size={14} aria-hidden="true" />
                    {t('explain.checkShow')}
                  </button>
                  <button type="button" className={styles.button} onClick={() => askWhy(finding)}>
                    <MessageCircleQuestion size={14} aria-hidden="true" />
                    {t('explain.checkAskWhy')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
