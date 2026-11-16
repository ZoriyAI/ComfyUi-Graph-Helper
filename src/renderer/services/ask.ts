/**
 * The one way any part of the interface asks the helper a question.
 *
 * Who uses it: components/graph/askAbout.ts (the canvas), the library (NodeLibrary, ModelLibrary), ExplainPanel and
 * CheckPanel call `requestAsk`; components/chat/ChatDock.tsx subscribes with `onAsk`, shows the message as the
 * person's own and sends it with the turn context. Why a queue: a question asked before the chat dock has mounted
 * waits for it instead of being lost.
 */
import type { AgentTurnContext } from '../../shared/contracts';
import { useDockStore } from '../state/dockState';
import { useProviderStore } from '../state/providerState';
import { useUiStore } from '../state/uiState';
import { requestWorkspacePanel } from '../commands/events';

/** One question for the helper: the message the person sees and the context the turn is sent with. */
export interface AskRequest {
  context: AgentTurnContext;
  /** The visible message, in the interface language. Data, not instructions. */
  message: string;
}

type Listener = (request: AskRequest) => void;

const listeners = new Set<Listener>();
/** Questions asked while no chat was listening; the first listener gets them. */
let pending: AskRequest[] = [];

/**
 * The question and its answer appear in the chat, so the chat must be on screen: a question asked from the canvas
 * while the dock showed the Inspector used to wait unseen until the person opened the Assistant tab.
 * "Show both" already shows the chat and stays as it is.
 */
function revealChat(): void {
  // The dock can still be logically open while a phone shows the canvas tab.
  requestWorkspacePanel('assistant');
  const dock = useDockStore.getState();
  if (!dock.collapsed && (dock.split || dock.tab === 'assistant')) return;
  dock.show('chat');
}

/** Asks the helper: shows the chat and hands the question to it (or to the Explain tab without an assistant). */
export function requestAsk(request: AskRequest): void {
  // No assistant chosen: a question about an object is answered from the app's built-in knowledge in the Explain
  // tab, and nothing is posted to the chat (it would only say that nothing was sent).
  const about = request.context.objectRef;
  if (request.context.intent === 'build' && useProviderStore.getState().provider === '') {
    useUiStore.getState().openSettings('assistant');
    return;
  }
  if (about && useProviderStore.getState().provider === '') {
    useUiStore.getState().setFocus(about);
    useDockStore.getState().show('explain');
    return;
  }
  revealChat();
  if (listeners.size === 0) {
    pending.push(request);
    return;
  }
  for (const listener of listeners) listener(request);
}

/** The chat dock listens for questions here; questions that waited are delivered at once. */
export function onAsk(listener: Listener): () => void {
  listeners.add(listener);
  if (pending.length > 0) {
    const queue = pending;
    pending = [];
    for (const request of queue) listener(request);
  }
  return () => {
    listeners.delete(listener);
  };
}
