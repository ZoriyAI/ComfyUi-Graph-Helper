import { create } from 'zustand';
export const useChatStore = create((set) => ({
    messages: [],
    isStreaming: false,
    isPaused: false,
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    updateMessage: (id, updates) => set((state) => ({
        messages: state.messages.map((msg) => msg.id === id ? { ...msg, ...updates } : msg),
    })),
    setStreaming: (streaming) => set({ isStreaming: streaming }),
    setPaused: (paused) => set({ isPaused: paused }),
    clearChat: () => set({ messages: [], isStreaming: false, isPaused: false }),
}));
