/**
 * The chat composer: the Ask / Build / Learn mode strip, the message field with recall of earlier messages, and
 * Send (or Stop while the helper answers). ChatDock.tsx renders it at the bottom of the dock. The field stays
 * focusable while an answer streams, so keyboard focus is never thrown to the page.
 */
import React, { useState, useRef, useEffect } from 'react';
import { usePreferencesStore } from '../../state/preferencesState';
import { useChatStore } from '../../state/chatState';
import { recallStep } from '../../services/llm/recall';
import { useTranslation } from 'react-i18next';
import { ArrowUp, Square } from 'lucide-react';
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
  /** Ends the helper's run; shown in Send's place while it answers. */
  onStop?: () => void;
}

/** The two composer modes, in the order of their buttons. Learn is a third button, shown only with onLearning. */
const INTENTS: readonly ComposerIntent[] = ['ask', 'build'];

/**
 * Chat composer: the Ask/Build mode with one line on what it does, then the message field with a round primary Send
 * on its right. Send says why it is off (nothing written, or the helper is still answering) in its tooltip, which also
 * carries the Enter / Shift+Enter help.
 */
export default function MessageInput({ onSend, isStreaming, disabled = false, learning = false, onLearning, onStop }: MessageInputProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  /** Which earlier message ↑ brought back (0 is the newest), or null. */
  const recalled = useRef<number | null>(null);
  // "When I ask for a change" in Settings picks the mode the composer opens in; Ask itself never builds.
  const [intent, setIntent] = useState<ComposerIntent>(() => usePreferencesStore.getState().preferences.assistant.defaultIntent);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // When an answer ends, focus returns to the field; offsetParent is null while the field is hidden (Learn mode).
  useEffect(() => {
    const field = inputRef.current;
    if (!isStreaming && field && field.offsetParent !== null) field.focus();
  }, [isStreaming]);

  const canSend = Boolean(input.trim()) && !disabled && !isStreaming;

  const submit = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled && !isStreaming) {
      onSend(trimmed, intent);
      recalled.current = null;
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
        {/* Each mode says what it is, Learn included (there is no field under it, so the strip stays short). */}
        <span className={styles.intentHint}>
          {learning ? t('lessons.modeHint') : intent === 'ask' ? t('chat.intentAskHint') : t('chat.intentBuildHint')}
        </span>
      </div>
      <div className={`composer-field ${styles.field}`} hidden={learning}>
        <textarea
          ref={inputRef}
          aria-label={String(t('chat.messageLabel'))}
          aria-describedby="composer-keys"
          rows={2}
          value={input}
          onChange={(event) => {
            recalled.current = null;
            setInput(event.target.value);
          }}
          onKeyDown={(event) => {
            // An IME is still composing a word (keyCode 229 in some browsers): Enter belongs to it, not to Send.
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            // Read-only while an answer streams: no recall into it either.
            if (isStreaming && event.key !== 'Tab') return;
            // ↑ / ↓ in an empty box (or on a recalled message) bring back earlier messages of the person.
            if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && (input === '' || recalled.current !== null) && !event.shiftKey) {
              const sent = useChatStore.getState().messages.filter((message) => message.role === 'user').map((message) => message.content);
              const step = recallStep(sent, recalled.current, event.key === 'ArrowUp' ? 'up' : 'down');
              if (step.position === null && recalled.current === null) return;
              event.preventDefault();
              recalled.current = step.position;
              setInput(step.text);
              return;
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={String(t(intent === 'ask' ? 'chat.placeholderAsk' : 'chat.placeholder'))}
          // While an answer streams the field stays focusable (read-only), so keyboard focus is not thrown to the page.
          disabled={disabled}
          readOnly={isStreaming}
          aria-busy={isStreaming || undefined}
        />
        {isStreaming && onStop ? (
          // While the helper answers, Stop takes Send's place: the one control at the end of the field.
          <Hint label={String(t('chat.stopHint'))} side="top">
            <button type="button" className={`stop-button ${styles.send} ${styles.stop}`} aria-label={String(t('chat.stop'))} onClick={onStop}>
              <Square size={14} fill="currentColor" aria-hidden="true" />
            </button>
          </Hint>
        ) : (
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
        )}
        {/* The key help is in Send's tooltip for the eye; screen readers hear it with the field. */}
        <span id="composer-keys" className="sr-only">{t('chat.keys')}</span>
      </div>
    </form>
  );
}
