/**
 * A thin alias of ChatDock under its older name. No file in src imports it today (shell/Dock.tsx mounts ChatDock
 * directly); it stays so an older dock frame that still mounts ChatPanel keeps working.
 */
import React from 'react';
import ChatDock, { type ChatDockProps } from './ChatDock';

/** ChatDock under its old name, same props. New code mounts ChatDock. */
export default function ChatPanel(props: ChatDockProps) {
  return <ChatDock {...props} />;
}
