import React from 'react';
import ChatDock, { type ChatDockProps } from './ChatDock';

/** Kept for the current dock frame, which mounts ChatPanel. New code mounts ChatDock. */
export default function ChatPanel(props: ChatDockProps) {
  return <ChatDock {...props} />;
}
