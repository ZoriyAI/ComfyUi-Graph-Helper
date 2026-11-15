import type { AgentTurnContext } from '../../shared/contracts';
import { useDockStore } from '../state/dockState';
import { useProviderStore } from '../state/providerState';
import { useUiStore } from '../state/uiState';

/**
 * The one way any part of the interface asks the helper a question.
 * The canvas context menu, the library and the shell call `requestAsk`; the chat dock subscribes with `onAsk`,
 * shows the message as the person's own and sends it with the turn context.
 */
export interface AskRequest {
  context: AgentTurnContext;
  /** The visible message, in the interface language. Data, not instructions. */
  message: string;
}

type Listener = (request: AskRequest) => void;

const listeners = new Set<Listener>();
let pending: AskRequest[] = [];

/**
 * The question and its answer appear in the chat, so the chat must be on screen: a question asked from the canvas
 * while the dock showed the Inspector used to wait unseen until the person opened the Assistant tab.
 * "Show both" already shows the chat and stays as it is.
 */
function revealChat(): void {
  const dock = useDockStore.getState();
  if (!dock.collapsed && (dock.split || dock.tab === 'assistant')) return;
  dock.show('chat');
}

export function requestAsk(request: AskRequest): void {
  // No assistant chosen: a question about an object is answered from the app's built-in knowledge in the Explain
  // tab, and nothing is posted to the chat (it would only say that nothing was sent).
  const about = request.context.objectRef;
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
