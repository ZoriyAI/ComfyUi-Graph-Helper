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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isStreaming && inputRef.current) inputRef.current.focus();
  }, [isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed && !disabled && !isStreaming) {
      onSend(trimmed);
      setInput('');
    }
  };

  return (
    <form className="chat-form" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        type="text"
        aria-label="Chat message"
        value={input}
        onChange={(e) => setInput(e.target.value)}
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
