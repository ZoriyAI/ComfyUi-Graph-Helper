import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { CircleCheck, Crosshair, ListChecks, MessageCircleQuestion, TriangleAlert } from 'lucide-react';
import type { BaseModelFamily } from '../../../shared/contracts';
import { familyLabelKey } from '../../../shared/knowledge/labels';
import { redactDiagnostic } from '../../../shared/i18n';
import { useGraphStore } from '../../state/graphState';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { useUiStore } from '../../state/uiState';
import { requestAsk } from '../../services/ask';
import { turnLanguage } from '../../services/llm/chatModel';
import { checkFindingCount, groupCheckReport, type CheckFinding } from './checkModel';
import styles from './CheckPanel.module.css';

const ROW_MOTION = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.16 },
} as const;

/**
 * Chat workstream: the pre-export check. Runs knowledge:check-graph through the knowledge store, lists findings
 * by type, focuses each on the canvas, and lets the person ask why. The count lives in useKnowledgeStore().check.
 */
export default function CheckPanel({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation();
  const report = useKnowledgeStore((state) => state.check);
  const checking = useKnowledgeStore((state) => state.checking);
  const runCheck = useKnowledgeStore((state) => state.runCheck);
  const setFocus = useUiStore((state) => state.setFocus);
  const nodes = useGraphStore((state) => state.nodes);
  const [error, setError] = useState<string | null>(null);

  const resolvePort = useCallback((nodeId: string, inputName: string) => {
    const node = nodes.find((item) => item.id === nodeId);
    return node?.data.inputs.find((port) => port.name === inputName)?.id;
  }, [nodes]);

  const run = async () => {
    setError(null);
    try {
      await runCheck(projectId);
    } catch (reason) {
      setError(redactDiagnostic(reason instanceof Error ? reason.message : String(reason)));
    }
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
  const groups = report ? groupCheckReport(report, resolvePort) : [];

  return (
    <section className={`check-panel ${styles.panel}`} aria-labelledby="check-title" data-project={projectId}>
      <div className={styles.head}>
        <h2 className={styles.title} id="check-title">{t('explain.checkTitle')}</h2>
        {report && count > 0 ? <span className={styles.count}>{t('explain.checkCount', { count })}</span> : null}
      </div>
      <p className={styles.intro}>{t('explain.checkIntro')}</p>
      <div className={styles.buttons}>
        <button type="button" className={`${styles.button} ${styles.primary}`} disabled={checking} onClick={() => void run()}>
          <ListChecks size={14} aria-hidden="true" />
          {checking ? t('explain.checkRunning') : t('check.run')}
        </button>
      </div>
      {error ? <p className={styles.error} role="status">{t('explain.checkFailed', { error })}</p> : null}
      {!report && !error ? <p className={styles.note}>{t('explain.checkNotRun')}</p> : null}
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
                    <p className={styles.text}>{text}</p>
                    <div className={styles.buttons}>
                      <button type="button" className={styles.button} onClick={() => setFocus(finding.ref)}>
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
    </section>
  );
}
