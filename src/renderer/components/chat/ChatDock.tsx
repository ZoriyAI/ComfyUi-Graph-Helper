import React from 'react';
import ChatPanel from './ChatPanel';

/**
 * Chat workstream: the conversation panel. Subscribes to services/ask.ts, sends messages with the
 * AgentTurnContext, renders tool and proposal cards, loads and saves history.
 */
export interface ChatDockProps {
  onSendMessage: (content: string) => void;
  onPause: () => void;
}

export default function ChatDock(props: ChatDockProps) {
  return <ChatPanel {...props} />;
}
