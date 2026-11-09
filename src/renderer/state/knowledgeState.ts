import { create } from 'zustand';
import type { Explanation, ExplanationInput, GraphCheckReport, ObjectRef, SyncStatus } from '../../shared/contracts';
import { objectKey } from '../../shared/contracts';
import { DESKTOP_PROJECT_ID } from '../../shared/project';
import { checkFindingCount } from '../components/check/checkModel';
import { recentExplanations } from '../components/explain/explainModel';

export { checkFindingCount } from '../components/check/checkModel';

/** How many explanations the Explain panel history shows. */
export const RECENT_EXPLANATIONS = 20;

/**
 * Knowledge the interface shows: sync status, explanations by object, the last graph check.
 * Owned by the Chat workstream; the shell reads `sync` for its indicator.
 */
interface KnowledgeState {
  sync: SyncStatus | null;
  explanations: Record<string, Explanation[]>;
  check: GraphCheckReport | null;
  checking: boolean;
  /** The newest explanations of the project (global knowledge included), newest first. */
  recent: Explanation[];
  setSync: (status: SyncStatus) => void;
  loadExplanations: (owner: ObjectRef, projectId?: string) => Promise<Explanation[]>;
  addExplanation: (explanation: Explanation) => void;
  loadRecent: (projectId?: string) => Promise<Explanation[]>;
  /** Saves through knowledge:save-explanation and adds the stored record to the cache. */
  saveExplanation: (input: ExplanationInput) => Promise<Explanation>;
  runCheck: (projectId?: string) => Promise<GraphCheckReport>;
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  sync: null,
  explanations: {},
  check: null,
  checking: false,
  recent: [],
  setSync: (sync) => set({ sync }),
  loadExplanations: async (owner, projectId = DESKTOP_PROJECT_ID) => {
    const list = await window.electronAPI.listExplanations({ projectId, owner });
    set((state) => {
      const ids = new Set(list.map((item) => item.id));
      return {
        explanations: { ...state.explanations, [objectKey(owner)]: list },
        recent: recentExplanations([...list, ...state.recent.filter((item) => !ids.has(item.id))], RECENT_EXPLANATIONS),
      };
    });
    return list;
  },
  addExplanation: (explanation) => set((state) => {
    const key = objectKey(explanation.owner);
    const current = state.explanations[key] ?? [];
    return {
      explanations: { ...state.explanations, [key]: [...current.filter((item) => item.id !== explanation.id), explanation] },
      recent: recentExplanations([explanation, ...state.recent.filter((item) => item.id !== explanation.id)], RECENT_EXPLANATIONS),
    };
  }),
  loadRecent: async (projectId = DESKTOP_PROJECT_ID) => {
    const list = await window.electronAPI.listExplanations({ projectId });
    const recent = recentExplanations(list, RECENT_EXPLANATIONS);
    set({ recent });
    return recent;
  },
  saveExplanation: async (input) => {
    const saved = await window.electronAPI.saveExplanation(input);
    get().addExplanation(saved);
    return saved;
  },
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

/** Finding count of the last check, or null before the first check. For the AppBar badge. */
export function selectCheckCount(state: Pick<KnowledgeState, 'check'>): number | null {
  return state.check ? checkFindingCount(state.check) : null;
}

let subscribed = false;

/** Reads the sync status once and keeps it current from main-process pushes. Safe to call more than once. */
/**
 * Re-reads the sync status. Main pushes a status only around a sync run, so a saved MCP address or a token held in
 * Settings would otherwise keep showing "Set the MCP server address in Settings first" until the next run.
 */
export function refreshSyncStatus(): void {
  void window.electronAPI.syncStatus().then((status) => useKnowledgeStore.getState().setSync(status)).catch(() => undefined);
}

export function startSyncSubscription(): void {
  if (subscribed) return;
  subscribed = true;
  void window.electronAPI.syncStatus().then((status) => useKnowledgeStore.getState().setSync(status)).catch(() => undefined);
  window.electronAPI.onSyncEvent((status) => useKnowledgeStore.getState().setSync(status));
}
