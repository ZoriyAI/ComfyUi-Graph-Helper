import React from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { formatClock, redactDiagnostic, type AppLanguage } from '../../../shared/i18n';
import { useGraphStore } from '../../state/graphState';
import { useUiStore } from '../../state/uiState';
import type { ChatMessage } from '../../types/chat';
import MarkdownLite from './MarkdownLite';
import { objectLabel } from './objectLabel';
import ToolCard from './ToolCard';
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
        {isError ? (
          <div className={`message-body ${styles.body}`}>
            <div className={`message-summary ${styles.summary}`}>{t('chat.errorSummary')}</div>
            <div className={`message-diagnostic ${styles.diagnostic}`}>{redactDiagnostic(message.content)}</div>
          </div>
        ) : message.content || (streaming && toolCalls.length === 0) ? (
          <div className={`message-body ${styles.body}`}>
            {isUser ? (
              <span className={styles.userText}>{message.content}</span>
            ) : (
              <MarkdownLite text={message.content} />
            )}
            {streaming ? <span className={styles.cursor} aria-hidden="true" /> : null}
          </div>
        ) : null}
        {toolCalls.length > 0 ? (
          <div className={`tool-list ${styles.tools}`}>
            <AnimatePresence initial={false}>
              {toolCalls.map((call) => (
                <motion.div key={call.id} {...CARD_MOTION}>
                  <ToolCard call={call} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : null}
        <div className={`message-time ${styles.time}`}>{formatClock(message.timestamp, language)}</div>
      </div>
    </div>
  );
}
