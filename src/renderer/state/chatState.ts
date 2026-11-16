/**
 * The chat on screen: its messages and whether a turn is streaming or paused.
 *
 * Who uses it: services/llm/chatService.ts writes it; components/chat (ChatDock, Message, MessageInput), the live
 * build strip, PrivacySection (the message count), App.tsx, appCommands.ts and buildGuard.ts read it.
 */
import { create } from 'zustand';
import { ChatMessage } from '../types/chat';

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  isPaused: boolean;
  historyState: 'idle' | 'loading' | 'loaded' | 'error';
  clearEpoch: number;

  // Actions
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  setStreaming: (streaming: boolean) => void;
  setPaused: (paused: boolean) => void;
  clearChat: () => void;
}

/** The chat's messages, oldest first, and the turn's streaming and paused state. */
export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  isPaused: false,
  historyState: 'idle',
  clearEpoch: 0,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    })),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setPaused: (paused) => set({ isPaused: paused }),

  clearChat: () => set(state => ({ messages: [], isStreaming: false, isPaused: false, historyState: 'loaded', clearEpoch: state.clearEpoch + 1 })),
}));
