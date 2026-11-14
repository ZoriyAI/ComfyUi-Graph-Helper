import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp } from 'lucide-react';
import Hint from '../../ui/Hint';
import Kbd from '../../ui/Kbd';
import styles from './MessageInput.module.css';

/** Composer mode. Ask sends a chat turn (answers and ghost suggestions); Build sends intent build. */
export type ComposerIntent = 'ask' | 'build';

interface MessageInputProps {
  onSend: (content: string, intent: ComposerIntent) => void;
  isStreaming: boolean;
  disabled?: boolean;
  /** The panel is in its third mode, "Learn": lessons take the place of the conversation and of the field. */
  learning?: boolean;
  onLearning?: (learning: boolean) => void;
}

const INTENTS: readonly ComposerIntent[] = ['ask', 'build'];

/**
 * Chat composer: the Ask/Build mode with one line on what it does, then the message field with a round primary Send
 * on its right. Send says why it is off (nothing written, or the helper is still answering) in its tooltip, which also
 * carries the Enter / Shift+Enter help.
 */
export default function MessageInput({ onSend, isStreaming, disabled = false, learning = false, onLearning }: MessageInputProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [intent, setIntent] = useState<ComposerIntent>('ask');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const field = inputRef.current;
    if (!isStreaming && field && field.offsetParent !== null) field.focus();
  }, [isStreaming]);

  const canSend = Boolean(input.trim()) && !disabled && !isStreaming;

  const submit = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled && !isStreaming) {
      onSend(trimmed, intent);
      setInput('');
    }
  };

  return (
    <form
      className={`chat-form ${styles.form}`}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className={styles.intentRow}>
        <div className={styles.intent} role="group" aria-label={String(t('chat.intentLabel'))}>
          {INTENTS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={!learning && intent === item}
              className={styles.intentOption}
              data-intent={item}
              onClick={() => {
                setIntent(item);
                onLearning?.(false);
              }}
            >
              {item === 'ask' ? t('chat.intentAsk') : t('chat.intentBuild')}
            </button>
          ))}
          {onLearning ? (
            <button type="button" aria-pressed={learning} className={styles.intentOption} data-intent="learn" onClick={() => onLearning(true)}>
              {t('lessons.mode')}
            </button>
          ) : null}
        </div>
        <span className={styles.intentHint}>{learning ? t('lessons.modeHint') : intent === 'ask' ? t('chat.intentAskHint') : t('chat.intentBuildHint')}</span>
      </div>
      <div className={`composer-field ${styles.field}`} hidden={learning}>
        <textarea
          ref={inputRef}
          aria-label={String(t('chat.messageLabel'))}
          aria-describedby="composer-keys"
          rows={2}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={String(t(intent === 'ask' ? 'chat.placeholderAsk' : 'chat.placeholder'))}
          disabled={disabled || isStreaming}
        />
        <Hint label={String(isStreaming ? t('chat.sendBusy') : t('chat.sendHint'))} side="top" shortcut={isStreaming ? undefined : <Kbd>Enter</Kbd>}>
          <button
            type="submit"
            className={`send-button ${styles.send}`}
            aria-label={String(t('chat.send'))}
            disabled={!canSend}
          >
            <ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </Hint>
        {/* The key help is in Send's tooltip for the eye; screen readers hear it with the field. */}
        <span id="composer-keys" className="sr-only">{t('chat.keys')}</span>
      </div>
    </form>
  );
}
