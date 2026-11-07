import { create } from 'zustand';
import { GraphRevision } from '../types/revisions';

interface RevisionState {
  revisions: GraphRevision[];
  currentRevisionId: string | null;

  addRevision: (revision: GraphRevision) => void;
  getRevision: (id: string) => GraphRevision | undefined;
  getCurrentRevision: () => GraphRevision | undefined;
  setCurrentRevision: (id: string) => void;
}

export const useRevisionStore = create<RevisionState>((set, get) => ({
  revisions: [],
  currentRevisionId: null,

  addRevision: (revision) =>
    set((state) => ({
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
