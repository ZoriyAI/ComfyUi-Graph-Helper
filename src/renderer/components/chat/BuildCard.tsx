/**
 * The build card of the chat: every graph change of one assistant turn as a numbered timeline of plain sentences.
 * Message.tsx renders it for the build calls of an assistant message. It follows the canvas reveal queue
 * (canvasStore) so the chat and the canvas show the same step while the build plays out at reading pace.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, Boxes, CircleAlert, Hammer, Link2, ListTree, Plus, SlidersHorizontal, StickyNote, Trash2, Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { ObjectRef } from '../../../shared/contracts';
import type { ToolCall } from '../../types/chat';
import { useGraphStore } from '../../state/graphState';
import { useUiStore } from '../../state/uiState';
import { useCanvasStore } from '../graph/canvasStore';
import { buildTargetRef } from './toolPresentation';
import { buildProgress, callStepKey, stepError, stepSentence, stepWhy, type Translate } from './buildSteps';
import { useStepNames } from './stepNames';
import { followInLog } from './followLog';
import Button from '../../ui/Button';
import ProposalCard from './ProposalCard';
import styles from './BuildCard.module.css';

/** One icon per graph tool, so a long timeline can be scanned by kind of change. Unknown tools get a hammer. */
const STEP_ICONS: Record<string, LucideIcon> = {
  addNode: Plus,
  connectNodes: Link2,
  setParameter: SlidersHorizontal,
  removeNode: Trash2,
  createSubgraph: Boxes,
  insertSubgraph: Boxes,
  insertBlueprint: Boxes,
  annotateNode: StickyNote,
  setComponentDocumentation: BookOpen,
  setProcess: Workflow,
};

/** A long build shows its last steps; the earlier ones open on request. */
const VISIBLE_TAIL = 20;

type StepState = 'done' | 'running' | 'waiting' | 'failed';

/** The node a step is about, for centring the canvas: the node itself, or an edge's target. */
function centreNode(target: ObjectRef): string | null {
  if (target.kind === 'node') return target.id;
  if (target.kind === 'edge') return useGraphStore.getState().edges.find((edge) => edge.id === target.id)?.target ?? null;
  return null;
}

/** Selects the step's object and asks the canvas to centre on its node. */
function showOnCanvas(target: ObjectRef): void {
  useUiStore.getState().setFocus(target);
  const nodeId = centreNode(target);
  if (nodeId) useCanvasStore.getState().requestCenter(nodeId);
}

interface StepProps {
  call: ToolCall;
  state: StepState;
  sentence: string;
  showWhy: boolean;
  onPick: () => void;
  hidden: boolean;
}

function Step({ call, state, sentence, showWhy, onPick, hidden }: StepProps) {
  const { t } = useTranslation();
  const translate: Translate = (key, options) => String(options ? t(key, options) : t(key));
  const Icon = state === 'failed' ? CircleAlert : STEP_ICONS[call.toolName] ?? Hammer;
  const target = buildTargetRef(call);
  const why = stepWhy(call);
  const error = stepError(call, translate);
  const line = (
    <>
      {/* A step still to come is a small hollow dot on the rail, not one more icon in a column of the same glyph. */}
      {state === 'waiting' ? <span className={styles.waitDot} aria-hidden="true" /> : <Icon className={styles.icon} size={14} aria-hidden="true" />}
      <span className={styles.sentence}>{sentence}</span>
    </>
  );
  return (
    <li
      className={styles.step}
      data-tool-name={call.toolName}
      data-tool-status={call.status}
      data-tool-kind="build"
      data-step-state={state}
      aria-current={state === 'running' ? 'step' : undefined}
      hidden={hidden}
    >
      {target ? (
        <button
          type="button"
          className={styles.line}
          aria-label={String(t('chat.buildStepShow', { step: sentence }))}
          title={String(t('chat.buildStepShow', { step: sentence }))}
          onClick={() => {
            onPick();
            showOnCanvas(target);
          }}
        >
          {line}
        </button>
      ) : (
        <div className={styles.line}>{line}</div>
      )}
      {/* A change to what the person made: not applied, a grey draft with Accept and Reject. */}
      {call.proposalId ? <ProposalCard proposalId={call.proposalId} result={call.result} /> : null}
      {/* Dimmed with an hourglass for the eye; said in words for a screen reader. */}
      {state === 'waiting' ? <span className="sr-only">{t('chat.buildWaiting')}</span> : null}
      {why && showWhy && call.status !== 'error' ? (
        <p className={styles.why} data-build-why>
          <span className={styles.whyLabel}>{t('chat.toolWhy')}</span>
          {why}
        </p>
      ) : null}
      {error ? (
        <div className={`tool-diagnostic ${styles.error}`}>
          <p>{error.summary}</p>
          {error.detail ? (
            <details className={styles.detail}>
              <summary>{t('chat.stepError.detail')}</summary>
              <p>{error.detail}</p>
            </details>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Every graph change of one assistant message as one card: a title with the step count (chat.buildTitle) and a
 * timeline with one sentence per step. The step the canvas is showing is marked with its position (chat.buildProgress)
 * and its reason; the others show their reason on request. Clicking a step shows its node on the canvas. Steps still
 * waiting their turn on the canvas are dimmed.
 */
export default function BuildCard({ calls, live }: { calls: ToolCall[]; live: boolean }) {
  const { t } = useTranslation();
  const translate: Translate = (key, options) => String(options ? t(key, options) : t(key));
  const names = useStepNames();
  const shownKey = useCanvasStore((state) => state.callout?.key ?? null);
  const queue = useCanvasStore((state) => state.queue);
  const [allWhy, setAllWhy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const queuedKeys = useMemo(() => new Set(queue.map((item) => item.key)), [queue]);
  const ownKeys = useMemo(() => new Set(calls.map(callStepKey).filter((key): key is string => key !== null)), [calls]);
  // The card is live while its turn streams or while the canvas still reveals its steps.
  const revealing = queue.some((item) => ownKeys.has(item.key));
  const active = live || revealing;
  const progress = buildProgress(calls, { shownKey: active ? shownKey : null, queuedKeys }, active);
  const failed = calls.filter((call) => call.status === 'error').length;
  // The running step is never hidden: if it falls before the visible tail, the list starts at it instead.
  const hiddenBefore = showAll ? 0 : Math.max(0, calls.length - VISIBLE_TAIL);
  const firstShown = progress.running >= 0 && progress.running < hiddenBefore ? progress.running : hiddenBefore;
  const anyWhy = calls.some((call) => stepWhy(call) !== '');
  const list = useRef<HTMLOListElement>(null);
  // While the build runs, the chat keeps the step the canvas is showing in view (unless the person scrolled away).
  useEffect(() => {
    if (!active || progress.running < 0) return;
    followInLog(list.current?.querySelector<HTMLElement>('[data-step-state="running"]') ?? null);
  }, [active, progress.running]);

  return (
    <section className={styles.card} aria-label={String(t('chat.buildTitle', { count: calls.length }))} data-build-card data-live={active ? 'true' : undefined}>
      <header className={styles.head}>
        <Hammer className={styles.headIcon} size={14} aria-hidden="true" />
        <span className={styles.title}>{t('chat.buildTitle', { count: calls.length })}</span>
        {active && progress.running >= 0 ? (
          <span className={styles.progress} data-build-progress>
            {t('chat.buildProgress', { index: progress.running + 1, count: calls.length })}
          </span>
        ) : null}
        {failed > 0 ? <span className={styles.failed}>{t('chat.buildFailedCount', { count: failed })}</span> : null}
      </header>
      {firstShown > 0 ? (
        <Button variant="ghost" size="sm" className={styles.more} icon={<ListTree size={13} />} onClick={() => setShowAll(true)}>
          {t('chat.buildEarlier', { count: firstShown })}
        </Button>
      ) : null}
      <ol ref={list} className={styles.steps} aria-label={String(t('chat.buildListLabel'))}>
        {calls.map((call, index) => {
          const state: StepState = call.status === 'error'
            ? 'failed'
            : index === progress.running ? 'running' : progress.waiting.has(index) ? 'waiting' : 'done';
          return (
            <Step
              key={call.id}
              call={call}
              state={state}
              sentence={stepSentence(call, translate, names)}
              showWhy={allWhy || state === 'running' || picked === call.id}
              onPick={() => setPicked(call.id)}
              hidden={index < firstShown}
            />
          );
        })}
      </ol>
      {anyWhy || (showAll && calls.length > VISIBLE_TAIL) ? (
        <div className={styles.foot}>
          {anyWhy ? (
            <Button variant="ghost" size="sm" className={styles.more} aria-expanded={allWhy} onClick={() => setAllWhy((open) => !open)}>
              {allWhy ? t('chat.buildWhyHide') : t('chat.buildWhyShow')}
            </Button>
          ) : null}
          {showAll && calls.length > VISIBLE_TAIL ? (
            <Button variant="ghost" size="sm" className={styles.more} onClick={() => setShowAll(false)}>{t('chat.buildCollapse')}</Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
