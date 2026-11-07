import { create } from 'zustand';
import { ChatMessage } from '../types/chat';

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  isPaused: boolean;

  // Actions
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  setStreaming: (streaming: boolean) => void;
  setPaused: (paused: boolean) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  isPaused: false,

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

  clearChat: () => set({ messages: [], isStreaming: false, isPaused: false }),
}));
