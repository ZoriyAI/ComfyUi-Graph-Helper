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
    const end = messagesEndRef.current;
    const log = end?.parentElement;
    if (!end || !log) return;
    const distance = log.scrollHeight - log.scrollTop - log.clientHeight;
    if (messages.length > 1 && distance >= 120) return;
    const motion = document.documentElement.dataset.motion || 'system';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = motion === 'off' || motion === 'reduced' || (motion === 'system' && reduce) ? 'auto' : 'smooth';
    end.scrollIntoView({ behavior });
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
            <p>The graph is empty. Import a workflow or describe a change. TEST fixture replies are scripted and are not a live model.</p>
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
