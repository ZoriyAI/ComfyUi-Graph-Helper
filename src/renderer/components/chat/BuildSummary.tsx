/**
 * The closing line of a build turn: what was made and the next steps (tour, check, export). Message.tsx renders it
 * under the BuildCard of an assistant message. It waits until the canvas has revealed every step, so the chat does
 * not announce a finished graph that is still appearing.
 */
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleCheck, Compass, FileCheck2, FolderOutput } from 'lucide-react';
import type { ToolCall } from '../../types/chat';
import { runCommand, useCommandStates } from '../../commands/registry';
import { useCanvasStore } from '../graph/canvasStore';
import { buildCounts, buildSummary, callStepKey, type Translate } from './buildSteps';
import { followInLog } from './followLog';
import Button from '../../ui/Button';
import styles from './BuildSummary.module.css';

/** The commands a finished build leads to, in the order a newcomer needs them. */
const NEXT = [
  { id: 'graph.tour', labelKey: 'chat.summaryTour', Icon: Compass },
  { id: 'graph.check', labelKey: 'chat.summaryCheck', Icon: FileCheck2 },
  { id: 'file.export', labelKey: 'chat.summarySave', Icon: FolderOutput },
] as const;
const NEXT_IDS = NEXT.map((item) => item.id);

/**
 * Closes a build turn: a count of nodes and links made (see buildSummary) and what to do next, through the same
 * commands as the menu bar (tour, check, export), so a button here behaves exactly like the menu item.
 */
export default function BuildSummary({ calls, stopped = false }: { calls: ToolCall[]; stopped?: boolean }) {
  const { t } = useTranslation();
  const translate: Translate = (key, options) => String(options ? t(key, options) : t(key));
  const states = useCommandStates(NEXT_IDS);
  // The summary shows only once the canvas has shown every step, not while it still reveals them at reading pace.
  const revealing = useCanvasStore((state) => state.queue.some((item) => calls.some((call) => callStepKey(call) === item.key)));
  const text = buildSummary(buildCounts(calls), translate, stopped);
  const shown = Boolean(text) && !revealing;
  const box = useRef<HTMLElement>(null);
  // The summary appears after the last step is revealed, with no new message to scroll the chat: bring it in view.
  useEffect(() => {
    if (shown) followInLog(box.current);
  }, [shown]);
  if (!shown) return null;
  return (
    <section ref={box} className={styles.summary} aria-label={String(t('chat.summaryLabel'))} data-build-summary>
      <p className={styles.text}>
        <CircleCheck className={styles.icon} size={14} aria-hidden="true" />
        <span>{text}</span>
      </p>
      <div className={styles.next}>
        <span className={styles.nextLabel}>{t('chat.summaryNext')}</span>
        {NEXT.map(({ id, labelKey, Icon }, index) => (
          <Button
            key={id}
            variant="subtle"
            size="sm"
            icon={<Icon size={13} />}
            disabled={states[index] ? !states[index].enabled : true}
            onClick={() => void runCommand(id)}
          >
            {t(labelKey)}
          </Button>
        ))}
      </div>
    </section>
  );
}
