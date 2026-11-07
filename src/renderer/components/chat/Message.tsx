import React from 'react';
import { ChatMessage } from '../../types/chat';

interface MessageProps {
  message: ChatMessage;
}

export default function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '12px',
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          padding: '10px 14px',
          borderRadius: '12px',
          background: isUser ? '#1a73e8' : '#f0f0f0',
          color: isUser ? 'white' : '#333',
          fontSize: '14px',
          lineHeight: '1.5',
        }}
      >
        {/* Message content */}
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message.content}
        </div>

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div
            style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: `1px solid ${isUser ? 'rgba(255,255,255,0.3)' : '#ddd'}`,
              fontSize: '12px',
              opacity: 0.9,
            }}
          >
            {message.toolCalls.map((tool) => (
              <div key={tool.id} style={{ marginTop: '4px' }}>
                🔧 {tool.name}
                {tool.status === 'pending' && ' ⏳'}
                {tool.status === 'success' && ' ✓'}
                {tool.status === 'error' && ` ✗ ${tool.error || 'Error'}`}
              </div>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div
          style={{
            fontSize: '10px',
            marginTop: '6px',
            opacity: 0.7,
            textAlign: 'right',
          }}
        >
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
