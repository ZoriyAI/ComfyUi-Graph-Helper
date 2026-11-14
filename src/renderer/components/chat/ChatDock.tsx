import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { MessageCircle, Pause, Play } from 'lucide-react';
import EmptyState from '../../ui/EmptyState';
import type { AgentTurnContext, ObjectRef } from '../../../shared/contracts';
import { useChatStore } from '../../state/chatState';
import { useGraphStore } from '../../state/graphState';
import { useUiStore } from '../../state/uiState';
import { useProviderStore } from '../../state/providerState';
import { onAsk, type AskRequest } from '../../services/ask';
import { getChatService } from '../../services/llm/chatService';
import { useLessonStore } from '../../state/lessonState';
import LessonPanel from '../lessons/LessonPanel';
import Message from './Message';
import MessageInput, { type ComposerIntent } from './MessageInput';
import Button from '../../ui/Button';
import styles from './ChatDock.module.css';

/**
 * The conversation panel. Subscribes to services/ask.ts, sends messages with the
 * AgentTurnContext, renders tool and proposal cards, loads and saves history.
 *
 * Both props are optional. Without them the dock sends and pauses through getChatService().
 * `onSendMessage` only receives plain chat turns; turns that carry a context (Build mode, quick prompts,
 * ask requests) always go through the chat service so their context is not lost.
 */
export interface ChatDockProps {
  onSendMessage?: (content: string) => void;
  onPause?: () => void;
}

const PROCESS_REF: ObjectRef = { kind: 'process', id: 'process' };

const MESSAGE_MOTION = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.16 },
} as const;

export default function ChatDock({ onSendMessage, onPause }: ChatDockProps = {}) {
  const { t } = useTranslation();
  // The scripted TEST fixture says so in the empty chat; a real helper gets no such note.
  const provider = useProviderStore((state) => state.provider);
  const messages = useChatStore((state) => state.messages);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const isPaused = useChatStore((state) => state.isPaused);
  const nodeCount = useGraphStore((state) => state.nodes.length);
  // The third mode: lessons in place of the conversation. The person builds, the app follows along.
  const learning = useLessonStore((state) => state.learning);
  const setLearning = useLessonStore((state) => state.setLearning);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queue = useRef<AskRequest[]>([]);

  const send = useCallback((content: string, context?: Partial<AgentTurnContext>) => {
    if (!context && onSendMessage) {
      onSendMessage(content);
      return;
    }
    void getChatService().sendMessage(content, context);
  }, [onSendMessage]);

  useEffect(() => {
    void getChatService().loadHistory();
  }, []);

  // Ask requests from the canvas, library and shell. One turn runs at a time; later asks wait their turn.
  useEffect(() => onAsk((request) => {
    if (useChatStore.getState().isStreaming) {
      queue.current.push(request);
      return;
    }
    void getChatService().sendMessage(request.message, request.context);
  }), []);

  useEffect(() => {
    if (isStreaming) return;
    const next = queue.current.shift();
    if (next) void getChatService().sendMessage(next.message, next.context);
  }, [isStreaming]);

  useEffect(() => {
    const end = messagesEndRef.current;
    const log = end?.parentElement;
    if (!end || !log) return;
    const distance = log.scrollHeight - log.scrollTop - log.clientHeight;
    // A person reading older messages is left there, except when they just sent one: then they follow their message.
    const sentNow = messages[messages.length - 1]?.role === 'user';
    if (messages.length > 1 && distance >= 120 && !sentNow) return;
    const motionPolicy = document.documentElement.dataset.motion || 'system';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = motionPolicy === 'off' || motionPolicy === 'reduced' || (motionPolicy === 'system' && reduce) ? 'auto' : 'smooth';
    end.scrollIntoView({ behavior });
  }, [messages]);

  const togglePause = () => {
    if (onPause) {
      onPause();
      return;
    }
    const service = getChatService();
    void (useChatStore.getState().isPaused ? service.resume() : service.pause());
  };

  const sendComposer = (content: string, intent: ComposerIntent) => {
    send(content, intent === 'build' ? { intent: 'build' } : undefined);
  };

  const quickPrompts: Array<{ key: string; label: string; context: () => Partial<AgentTurnContext> }> = [
    { key: 'models', label: String(t('chat.quickModels')), context: () => ({ intent: 'chat' }) },
    { key: 'graph', label: String(t('chat.quickGraph')), context: () => ({ intent: 'ask', objectRef: PROCESS_REF }) },
    {
      key: 'next',
      label: String(t('chat.quickNext')),
      context: () => {
        const ui = useUiStore.getState();
        return { intent: 'ask', objectRef: ui.focusRef ?? ui.selection[0] ?? PROCESS_REF };
      },
    },
  ];

  const lastId = messages.length > 0 ? messages[messages.length - 1].id : null;

  return (
    <div className={`chat-panel ${styles.dock}`}>
      <div className={`chat-header ${styles.header}`}>
        <span className={styles.title}>{t('dock.assistant')}</span>
        {isStreaming ? (
          <div className={styles.run} role="group" aria-label={String(isPaused ? t('chat.runPaused') : t('chat.runStreaming'))}>
            <span className={styles.runDot} data-paused={isPaused} aria-hidden="true" />
            <span className="stream-state">{isPaused ? t('chat.paused') : t('chat.streaming')}</span>
            {/* Stop sits where Send is, in the composer; the header keeps the pause. */}
            <Button variant="subtle" size="sm" icon={isPaused ? <Play size={14} /> : <Pause size={14} />} onClick={togglePause}>
              {isPaused ? t('chat.resume') : t('chat.pause')}
            </Button>
          </div>
        ) : null}
      </div>
      {learning ? (
        <LessonPanel
          onAsk={(question) => {
            // A question about a step is an ordinary question: it and its answer are read in the conversation.
            setLearning(false);
            send(question, { intent: 'ask' });
          }}
        />
      ) : null}
      <div className={`chat-log ${styles.log}`} role="log" aria-label={String(t('chat.log'))} aria-live="polite" hidden={learning}>
        {messages.length === 0 ? (
          <EmptyState
            size="compact"
            className={`chat-empty ${styles.empty}`}
            icon={<MessageCircle size={18} />}
            title={String(t('chat.emptyTitle'))}
            footer={(
              <>
            <p className={styles.quickTitle}>{t('chat.quickTitle')}</p>
            <div className={styles.quick}>
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt.key}
                  type="button"
                  className={styles.quickButton}
                  disabled={isStreaming}
                  onClick={() => send(prompt.label, prompt.context())}
                >
                  {prompt.label}
                </button>
              ))}
            </div>
              </>
            )}
          >
            <p>{nodeCount === 0 ? t('chat.emptyWithoutGraph') : t('chat.emptyWithGraph')}</p>
            {provider === 'test' ? <p>{t('chat.testNote')}</p> : null}
          </EmptyState>
        ) : (
          <>
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div key={message.id} {...MESSAGE_MOTION}>
                  <Message message={message} streaming={isStreaming && message.role === 'assistant' && message.id === lastId} />
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      <div className="chat-compose">
        <MessageInput onSend={sendComposer} isStreaming={isStreaming} learning={learning} onLearning={setLearning} onStop={() => getChatService().cancel()} />
      </div>
    </div>
  );
}
