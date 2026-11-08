import type { AgentTurnContext } from '../../shared/contracts';

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

export function requestAsk(request: AskRequest): void {
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
