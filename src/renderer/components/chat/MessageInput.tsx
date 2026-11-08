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

export default function MessageInput({ onSend, isStreaming, disabled = false }: MessageInputProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [intent, setIntent] = useState<ComposerIntent>('ask');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

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

  const moveIntent = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const next = (index + step + INTENTS.length) % INTENTS.length;
    setIntent(INTENTS[next]);
    optionRefs.current[next]?.focus();
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
        <div className={styles.intent} role="radiogroup" aria-label={String(t('chat.intentLabel'))}>
          {INTENTS.map((item, index) => (
            <button
              key={item}
              ref={(element) => { optionRefs.current[index] = element; }}
              type="button"
              role="radio"
              aria-checked={intent === item}
              tabIndex={intent === item ? 0 : -1}
              className={styles.intentOption}
              data-intent={item}
              onClick={() => setIntent(item)}
              onKeyDown={(event) => moveIntent(event, index)}
            >
              {item === 'ask' ? t('chat.intentAsk') : t('chat.intentBuild')}
            </button>
          ))}
        </div>
        <span className={styles.intentHint}>{intent === 'ask' ? t('chat.intentAskHint') : t('chat.intentBuildHint')}</span>
      </div>
      <div className={styles.row}>
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
          <p id="composer-keys" className="field-hint">{t('chat.keys')}</p>
        </div>
        <button type="submit" className="send-button" disabled={!input.trim() || disabled || isStreaming}>
          {t('chat.send')}
        </button>
      </div>
    </form>
  );
}
