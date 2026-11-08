import React, { useState, useRef, useEffect } from 'react';

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
      <textarea
        ref={inputRef}
        aria-label="Chat message"
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
        placeholder="Ask for a graph change"
        disabled={disabled || isStreaming}
      />
      {isStreaming && !isPaused ? (
        <button type="button" className="pause-button" onClick={onPause}>
          Pause
        </button>
      ) : null}
      <button type="submit" className="send-button" disabled={!input.trim() || disabled || isStreaming}>
        Send
      </button>
    </form>
  );
}
