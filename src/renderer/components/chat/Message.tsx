import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatClock, redactDiagnostic, type AppLanguage } from '../../../shared/i18n';
import { ChatMessage } from '../../types/chat';

interface MessageProps {
  message: ChatMessage;
}

export default function Message({ message }: MessageProps) {
  const { t, i18n } = useTranslation();
  const isUser = message.role === 'user';
  const isError = !isUser && message.content.startsWith('Error');
  const language: AppLanguage = i18n.resolvedLanguage === 'ru' ? 'ru' : 'en';
  const statusLabel = (status: string) => {
    if (status === 'pending') return t('chat.toolPending');
    if (status === 'success') return t('chat.toolSuccess');
    if (status === 'error') return t('chat.toolFailed');
    return status;
  };

  return (
    <div className={`message-row${isUser ? ' is-user' : ''}`}>
      <div className={`message-bubble${isError ? ' is-error' : ''}`}>
        {isError ? (
          <div className="message-body">
            <div className="message-summary">{t('chat.errorSummary')}</div>
            <div className="message-diagnostic">{redactDiagnostic(message.content)}</div>
          </div>
        ) : (
          <div className="message-body">{message.content}</div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 ? (
          <div className="tool-list">
            {message.toolCalls.map((tool) => (
              <div key={tool.id} className="tool-row" data-tool-name={tool.name} data-tool-status={tool.status}>
                <span className="tool-name">{tool.name}</span>
                <span className="tool-status" data-state={tool.status}>{statusLabel(tool.status)}</span>
                {tool.status === 'error' && tool.error ? <span className="tool-diagnostic">{redactDiagnostic(tool.error)}</span> : null}
              </div>
            ))}
          </div>
        ) : null}
        <div className="message-time">{formatClock(message.timestamp, language)}</div>
      </div>
    </div>
  );
}
