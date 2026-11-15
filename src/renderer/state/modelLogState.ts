/**
 * The open state of the conversation log window (Help ▸ Conversation log).
 *
 * Who uses it: components/log/ModelLogDialog.tsx draws the window; commands/diagnosticsCommands.ts and
 * components/chat/Message.tsx (the log button on an answer) open it.
 */
import { create } from 'zustand';

/**
 * Whether the conversation log window is open, and which recorded turn it was opened for (an answer in the chat),
 * or null when it was opened from the menu.
 */
interface ModelLogUi {
  open: boolean;
  focusTurn: string | null;
  show: (turnId?: string | null) => void;
  hide: () => void;
}

/** The log window's open state and the turn it should show first. */
export const useModelLogStore = create<ModelLogUi>((set) => ({
  open: false,
  focusTurn: null,
  show: (turnId = null) => set({ open: true, focusTurn: turnId ?? null }),
  hide: () => set({ open: false }),
}));

/** Opens the conversation log, on one answer's record when its id is given. */
export function openModelLog(turnId?: string | null): void {
  useModelLogStore.getState().show(turnId ?? null);
}
