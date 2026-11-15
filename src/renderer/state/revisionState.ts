/**
 * The revision the window shows (`currentRevisionId`), and an in-window list of snapshots.
 *
 * Who uses it: services/commands/projection.ts sets the current revision from each projection; chatService.ts saves
 * it with every chat message; the canvas layers and ExplainPanel read it. The `revisions` list is filled only by
 * the legacy services/graph/graphService.ts and its tests; the real history lives in main (see state/undoState.ts).
 */
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

/** The current revision id and the legacy snapshot list. */
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
