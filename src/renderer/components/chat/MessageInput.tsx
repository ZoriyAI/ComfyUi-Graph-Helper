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
    // Focus input when not streaming
    if (!isStreaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type a message..."
        disabled={disabled || isStreaming}
        style={{
          flex: 1,
          padding: '10px 12px',
          border: '1px solid #ccc',
          borderRadius: '8px',
          fontSize: '14px',
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={(e) => (e.target.style.borderColor = '#1a73e8')}
        onBlur={(e) => (e.target.style.borderColor = '#ccc')}
      />

      {isStreaming && !isPaused && (
        <button
          type="button"
          onClick={onPause}
          style={{
            padding: '10px 16px',
            background: '#ff9800',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f57c00')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#ff9800')}
        >
          ⏸ Pause
        </button>
      )}

      <button
        type="submit"
        disabled={!input.trim() || disabled || isStreaming}
        style={{
          padding: '10px 16px',
          background:
            disabled || isStreaming || !input.trim() ? '#ccc' : '#1a73e8',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor:
            disabled || isStreaming || !input.trim()
              ? 'not-allowed'
              : 'pointer',
          fontSize: '14px',
          fontWeight: 500,
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!disabled && !isStreaming && input.trim()) {
            e.currentTarget.style.background = '#1565c0';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isStreaming && input.trim()) {
            e.currentTarget.style.background = '#1a73e8';
          }
        }}
      >
        Send
      </button>
    </form>
  );
}
