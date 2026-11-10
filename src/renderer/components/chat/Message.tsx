import React from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { PauseCircle, Play, ScrollText, Square, TriangleAlert } from 'lucide-react';
import { formatClock, redactDiagnostic, type AppLanguage } from '../../../shared/i18n';
import { useGraphStore } from '../../state/graphState';
import { useUiStore } from '../../state/uiState';
import { useChatStore } from '../../state/chatState';
import { getChatService } from '../../services/llm/chatService';
import { openModelLog } from '../../state/modelLogState';
import type { ChatMessage, TurnCheckpoint, TurnNotice } from '../../types/chat';
import { RECOMMENDED_WINDOW } from '../../../shared/agent/contextWindow';
import MarkdownLite from './MarkdownLite';
import { objectLabel } from './objectLabel';
import ToolCard from './ToolCard';
import BuildCard from './BuildCard';
import BuildSummary from './BuildSummary';
import QuietGroup from './QuietGroup';
import { groupToolCalls } from './buildSteps';
import styles from './Message.module.css';

interface MessageProps {
  message: ChatMessage;
  /** True while this is the assistant message the stream is writing into. */
  streaming?: boolean;
}

const CARD_MOTION = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.16 },
} as const;

/**
 * The card of a turn that paused at a guard: why (step checkpoint or failed tools), and Continue / Stop while it
 * is open. Continue resumes the same run and sends "continue"; Stop cancels the run.
 */
function CheckpointCard({ messageId, checkpoint }: { messageId: string; checkpoint: TurnCheckpoint }) {
  const { t } = useTranslation();
  const busy = useChatStore((state) => state.isStreaming);
  const reason = checkpoint.reason === 'failure-streak'
    ? t('chat.checkpointFailures', { failures: checkpoint.failures ?? 3, steps: checkpoint.steps })
    : t('chat.checkpointSteps', { steps: checkpoint.steps });
  const outcome = checkpoint.state === 'continued' ? t('chat.checkpointContinued') : checkpoint.state === 'stopped' ? t('chat.checkpointStopped') : '';
  return (
    <div className={`turn-checkpoint ${styles.checkpoint}`} role="group" aria-label={String(t('chat.checkpointLabel'))} data-reason={checkpoint.reason} data-state={checkpoint.state}>
      <div className={styles.checkpointHead}>
        <PauseCircle size={14} aria-hidden="true" />
        <span className="checkpoint-reason">{reason}</span>
      </div>
      {checkpoint.state === 'open' ? (
        <>
          <p className={styles.checkpointHint}>{checkpoint.reason === 'failure-streak' ? t('chat.checkpointFailuresHint') : t('chat.checkpointStepsHint')}</p>
          <div className={styles.checkpointActions}>
            <button type="button" className={`checkpoint-continue ${styles.checkpointButton}`} disabled={busy} onClick={() => void getChatService().continueFromCheckpoint(messageId)}>
              <Play size={12} aria-hidden="true" />
              {t('chat.continue')}
            </button>
            <button type="button" className={`checkpoint-stop ${styles.checkpointButton}`} title={String(t('chat.stopHint'))} onClick={() => getChatService().stopAtCheckpoint(messageId)}>
              <Square size={12} aria-hidden="true" />
              {t('chat.stop')}
            </button>
          </div>
        </>
      ) : outcome ? <p className={`checkpoint-outcome ${styles.checkpointHint}`}>{outcome}</p> : null}
    </div>
  );
}

/**
 * What the app noticed about the turn, said by the app and not by the model: the model on the person's own
 * server reads only what fits its context window, so an answer after a cut request cannot be trusted. The card
 * gives the two numbers, what it means and what to change, and leads to the record of this answer.
 */
function NoticeCard({ notice, logId }: { notice: TurnNotice; logId?: string }) {
  const { t } = useTranslation();
  const values = { model: notice.model, window: notice.window, needed: notice.needed, recommended: RECOMMENDED_WINDOW };
  return (
    <div className={`turn-notice ${styles.notice}`} role="note" data-notice={notice.code} data-state={notice.state}>
      <div className={styles.noticeHead}>
        <TriangleAlert size={14} aria-hidden="true" />
        <span>{t(notice.state === 'cut' ? 'chat.windowCutTitle' : 'chat.windowTightTitle')}</span>
      </div>
      {/* When the server stopped at the window's edge nobody knows how much the request really needed. */}
      <p className={styles.noticeText}>{t(notice.state === 'tight' ? 'chat.windowTightBody' : notice.needed > notice.window ? 'chat.windowCutBody' : 'chat.windowCutBodyEdge', values)}</p>
      <p className={styles.noticeText}>{t('chat.windowFix', values)}</p>
      {notice.compact ? null : <p className={styles.noticeText}>{t('chat.windowNextCompact')}</p>}
      {logId ? (
        <button type="button" className={`message-log-open ${styles.logOpen}`} onClick={() => openModelLog(logId)}>
          <ScrollText size={13} aria-hidden="true" />
          {t('chat.openLogForNotice')}
        </button>
      ) : null}
    </div>
  );
}

export default function Message({ message, streaming = false }: MessageProps) {
  const { t, i18n } = useTranslation();
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const setFocus = useUiStore((state) => state.setFocus);
  const isUser = message.role === 'user';
  const isError = !isUser && message.content.startsWith('Error');
  const language: AppLanguage = i18n.resolvedLanguage === 'ru' ? 'ru' : 'en';
  const about = isUser ? message.context?.objectRef : undefined;
  const aboutLabel = about ? objectLabel(about, { nodes, edges }, String(t('explain.processName'))) : '';
  const toolCalls = message.toolCalls ?? [];
  const segments = groupToolCalls(toolCalls);
  const build = segments.find((segment) => segment.type === 'build');
  // A build is over when its turn stopped streaming and did not pause at a checkpoint that may still continue.
  const buildOver = !streaming && (!message.checkpoint || message.checkpoint.state === 'stopped' || message.checkpoint.state === 'closed');

  const body = (
    isError ? (
      <div className={`message-body ${styles.body}`}>
        <div className={`message-summary ${styles.summary}`}>{t('chat.errorSummary')}</div>
        <div className={`message-diagnostic ${styles.diagnostic}`}>{redactDiagnostic(message.content)}</div>
        {message.logId ? (
          // What exactly was sent and what the server said is in this answer's record: one click away.
          <button type="button" className={`message-log-open ${styles.logOpen}`} onClick={() => openModelLog(message.logId)}>
            <ScrollText size={13} aria-hidden="true" />
            {t('chat.openLogForError')}
          </button>
        ) : null}
      </div>
    ) : message.content || (streaming && toolCalls.length === 0) ? (
      <div className={`message-body ${styles.body}`}>
        {isUser ? (
          <span className={`${styles.userText} chat-words`}>{message.content}</span>
        ) : (
          <MarkdownLite text={message.content} className="chat-words" />
        )}
        {streaming ? <span className={styles.cursor} aria-hidden="true" /> : null}
      </div>
    ) : null
  );
  // In a build turn the helper's words come after its steps: what it did, then what it says about it.
  const textFirst = !build;

  return (
    <div className={`message-row${isUser ? ' is-user' : ''} ${styles.row}${isUser ? ` ${styles.user}` : ''}`} data-role={message.role}>
      <div
        className={`message-bubble${isError ? ' is-error' : ''} ${styles.bubble}${isError ? ` ${styles.error}` : ''}`}
        aria-label={String(isUser ? t('chat.you') : t('chat.assistantRole'))}
        role="group"
      >
        {about ? (
          <div className={styles.chips}>
            <button type="button" className={styles.about} title={aboutLabel} onClick={() => setFocus(about)}>
              {t('chat.aboutChip', { object: aboutLabel })}
            </button>
          </div>
        ) : null}
        {textFirst ? body : null}
        {toolCalls.length > 0 ? (
          <div className={`tool-list ${styles.tools}`}>
            <AnimatePresence initial={false}>
              {segments.map((segment) => {
                if (segment.type === 'build') {
                  return (
                    <motion.div key="build" {...CARD_MOTION}>
                      <BuildCard calls={segment.calls} live={streaming} />
                    </motion.div>
                  );
                }
                if (segment.type === 'quiet') {
                  return (
                    <motion.div key="quiet" {...CARD_MOTION}>
                      <QuietGroup calls={segment.calls} />
                    </motion.div>
                  );
                }
                return (
                  <motion.div key={segment.call.id} {...CARD_MOTION}>
                    <ToolCard call={segment.call} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : null}
        {textFirst ? null : body}
        {(message.notices ?? []).map((notice) => <NoticeCard key={`${notice.code}-${notice.state}`} notice={notice} logId={message.logId} />)}
        {message.checkpoint ? <CheckpointCard messageId={message.id} checkpoint={message.checkpoint} /> : null}
        {build && build.type === 'build' && buildOver ? <BuildSummary calls={build.calls} stopped={message.checkpoint?.state === 'stopped'} /> : null}
        <div className={`message-time ${styles.time}`}>
          {!isUser && message.logId && !streaming ? (
            <button
              type="button"
              className={`message-log ${styles.logLink}`}
              title={String(t('chat.openLog'))}
              aria-label={String(t('chat.openLog'))}
              onClick={() => openModelLog(message.logId)}
            >
              <ScrollText size={12} aria-hidden="true" />
            </button>
          ) : null}
          <span>{formatClock(message.timestamp, language)}</span>
        </div>
      </div>
    </div>
  );
}
