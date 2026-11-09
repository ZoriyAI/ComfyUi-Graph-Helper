import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './MessageInput.module.css';

/** Composer mode. Ask sends a chat turn (answers and ghost suggestions); Build sends intent build. */
export type ComposerIntent = 'ask' | 'build';

interface MessageInputProps {
  onSend: (content: string, intent: ComposerIntent) => void;
  isStreaming: boolean;
  disabled?: boolean;
}

const INTENTS: readonly ComposerIntent[] = ['ask', 'build'];

/** Chat composer: the Ask/Build mode and its hint on top, the full-width message field, then key help and Send. */
export default function MessageInput({ onSend, isStreaming, disabled = false }: MessageInputProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [intent, setIntent] = useState<ComposerIntent>('ask');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const field = inputRef.current;
    if (!isStreaming && field && field.offsetParent !== null) field.focus();
  }, [isStreaming]);

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
              aria-pressed={intent === item}
              className={styles.intentOption}
              data-intent={item}
              onClick={() => setIntent(item)}
            >
              {item === 'ask' ? t('chat.intentAsk') : t('chat.intentBuild')}
            </button>
          ))}
        </div>
        <span className={styles.intentHint}>{intent === 'ask' ? t('chat.intentAskHint') : t('chat.intentBuildHint')}</span>
      </div>
      <div className={`composer-field ${styles.field}`}>
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
          placeholder={String(t('chat.placeholder'))}
          disabled={disabled || isStreaming}
        />
      </div>
      <div className={styles.row}>
        <p id="composer-keys" className={`field-hint ${styles.keys}`}>{t('chat.keys')}</p>
        <button type="submit" className="send-button" disabled={!input.trim() || disabled || isStreaming}>
          {t('chat.send')}
        </button>
      </div>
    </form>
  );
}
