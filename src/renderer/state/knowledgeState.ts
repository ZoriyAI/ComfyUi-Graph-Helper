import { create } from 'zustand';
import type { Explanation, GraphCheckReport, ObjectRef, SyncStatus } from '../../shared/contracts';
import { objectKey } from '../../shared/contracts';
import { DESKTOP_PROJECT_ID } from '../../shared/project';

/**
 * Knowledge the interface shows: sync status, explanations by object, the last graph check.
 * Owned by the Chat workstream; the shell reads `sync` for its indicator.
 */
interface KnowledgeState {
  sync: SyncStatus | null;
  explanations: Record<string, Explanation[]>;
  check: GraphCheckReport | null;
  checking: boolean;
  setSync: (status: SyncStatus) => void;
  loadExplanations: (owner: ObjectRef, projectId?: string) => Promise<Explanation[]>;
  addExplanation: (explanation: Explanation) => void;
  runCheck: (projectId?: string) => Promise<GraphCheckReport>;
}

export const useKnowledgeStore = create<KnowledgeState>((set) => ({
  sync: null,
  explanations: {},
  check: null,
  checking: false,
  setSync: (sync) => set({ sync }),
  loadExplanations: async (owner, projectId = DESKTOP_PROJECT_ID) => {
    const list = await window.electronAPI.listExplanations({ projectId, owner });
    set((state) => ({ explanations: { ...state.explanations, [objectKey(owner)]: list } }));
    return list;
  },
  addExplanation: (explanation) => set((state) => {
    const key = objectKey(explanation.owner);
    const current = state.explanations[key] ?? [];
    return { explanations: { ...state.explanations, [key]: [...current.filter((item) => item.id !== explanation.id), explanation] } };
  }),
  runCheck: async (projectId = DESKTOP_PROJECT_ID) => {
    set({ checking: true });
    try {
      const check = await window.electronAPI.checkGraph(projectId);
      set({ check });
      return check;
    } finally {
      set({ checking: false });
    }
  },
}));

let subscribed = false;

/** Reads the sync status once and keeps it current from main-process pushes. Safe to call more than once. */
export function startSyncSubscription(): void {
  if (subscribed) return;
  subscribed = true;
  void window.electronAPI.syncStatus().then((status) => useKnowledgeStore.getState().setSync(status)).catch(() => undefined);
  window.electronAPI.onSyncEvent((status) => useKnowledgeStore.getState().setSync(status));
}
