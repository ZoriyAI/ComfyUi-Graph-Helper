import { create } from 'zustand';
export const useRevisionStore = create((set, get) => ({
    revisions: [],
    currentRevisionId: null,
    addRevision: (revision) => set((state) => ({
        revisions: [...state.revisions, revision],
        currentRevisionId: revision.id,
    })),
    getRevision: (id) => {
        const state = get();
        return state.revisions.find((r) => r.id === id);
    },
    getCurrentRevision: () => {
        const state = get();
        return state.currentRevisionId
            ? state.revisions.find((r) => r.id === state.currentRevisionId)
            : undefined;
    },
    setCurrentRevision: (id) => set({ currentRevisionId: id }),
}));
