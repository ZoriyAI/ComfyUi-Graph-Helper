import React from 'react';
import { motion } from 'motion/react';
import { ChatMessage } from '../../types/chat';
import { useMotionPolicy } from '../../ui/policy';

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
  const policy = useMotionPolicy();

  return (
    <motion.div
      className={`message-row${isUser ? ' is-user' : ''}`}
      initial={policy.instant ? false : { opacity: 0, y: policy.shift }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: policy.enter, ease: [0.2, 0, 0, 1] }}
    >
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
    </motion.div>
  );
}
