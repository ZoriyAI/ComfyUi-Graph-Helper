import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface MessageInputProps {
  onSend: (content: string) => void;
  onPause: () => void;
  isStreaming: boolean;
  isPaused: boolean;
  disabled?: boolean;
}

export default function MessageInput({
  onSend,
  onPause,
  isStreaming,
  isPaused,
  disabled = false,
}: MessageInputProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const field = inputRef.current;
    if (!isStreaming && field && field.offsetParent !== null) field.focus();
  }, [isStreaming]);

  const submit = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled && !isStreaming) {
      onSend(trimmed);
      setInput('');
    }
  };

  return (
    <form
      className="chat-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="composer-field">
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
      {isStreaming && !isPaused ? (
        <button type="button" className="pause-button" onClick={onPause}>
          {t('chat.pause')}
        </button>
      ) : null}
      <button type="submit" className="send-button" disabled={!input.trim() || disabled || isStreaming}>
        {t('chat.send')}
      </button>
    </form>
  );
}
