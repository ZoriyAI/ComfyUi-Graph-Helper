import React from 'react';
import { ChatMessage } from '../../types/chat';

const STATUS_LABEL = {
  pending: 'pending',
  success: 'applied',
  error: 'failed',
} as const;

interface MessageProps {
  message: ChatMessage;
}

export default function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`message-row${isUser ? ' is-user' : ''}`}>
      <div className={`message-bubble${!isUser && message.content.startsWith('Error') ? ' is-error' : ''}`}>
        <div className="message-body">{message.content}</div>
        {message.toolCalls && message.toolCalls.length > 0 ? (
          <div className="tool-list">
            {message.toolCalls.map((tool) => (
              <div key={tool.id} className="tool-row" data-tool-name={tool.name} data-tool-status={tool.status}>
                <span className="tool-name">{tool.name}</span>
                <span className="tool-status" data-state={tool.status}>
                  {STATUS_LABEL[tool.status as keyof typeof STATUS_LABEL] || tool.status}
                  {tool.status === 'error' && tool.error ? `: ${tool.error}` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="message-time">{new Date(message.timestamp).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
