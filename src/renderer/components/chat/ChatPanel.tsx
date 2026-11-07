import React, { useRef, useEffect } from 'react';
import { useChatStore } from '../../state/chatState';
import Message from './Message';
import MessageInput from './MessageInput';

interface ChatPanelProps {
  onSendMessage: (content: string) => void;
  onPause: () => void;
}

export default function ChatPanel({ onSendMessage, onPause }: ChatPanelProps) {
  const { messages, isStreaming, isPaused } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderLeft: '1px solid #e0e0e0',
        background: 'white',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #e0e0e0',
          fontWeight: 600,
          fontSize: '16px',
          background: '#fafafa',
        }}
      >
        Chat
        {isStreaming && (
          <span
            style={{
              marginLeft: '8px',
              fontSize: '12px',
              color: '#666',
              fontWeight: 400,
            }}
          >
            {isPaused ? '⏸ Paused' : '⏳ Streaming...'}
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: '#999',
              padding: '20px',
            }}
          >
            <div>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>💬</div>
              <div style={{ fontSize: '14px' }}>
                Start a conversation to build your workflow
              </div>
              <div style={{ fontSize: '12px', marginTop: '8px' }}>
                Try: "Add a KSampler node" or "Connect these nodes"
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid #e0e0e0',
          background: '#fafafa',
        }}
      >
        <MessageInput
          onSend={onSendMessage}
          onPause={onPause}
          isStreaming={isStreaming}
          isPaused={isPaused}
        />
      </div>
    </div>
  );
}
