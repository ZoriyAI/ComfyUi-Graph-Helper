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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-panel">
      <div className="chat-header">
        Chat
        {isStreaming ? (
          <span className="stream-state">{isPaused ? 'Paused' : 'Streaming'}</span>
        ) : null}
      </div>
      <div className="chat-log">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <strong>No messages yet</strong>
            <p>The canvas starts with a labeled demo graph. Choose TEST fixture for a scripted reply, or OpenAI for a live session key.</p>
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
      <div className="chat-compose">
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
