import { create } from 'zustand';
import type { Explanation, ExplanationInput, GraphCheckReport, ObjectRef, SyncStatus } from '../../shared/contracts';
import { objectKey } from '../../shared/contracts';
import { DESKTOP_PROJECT_ID } from '../../shared/project';
import { isGraphOwnerKind } from '../../shared/knowledge/projectExplanations';
import { checkFindingCount } from '../components/check/checkModel';
import { recentExplanations } from '../components/explain/explainModel';

export { checkFindingCount } from '../components/check/checkModel';

/** How many explanations the Explain panel history shows. */
export const RECENT_EXPLANATIONS = 20;

/**
 * Knowledge the interface shows: sync status, explanations by object, the last graph check.
 * The shell reads `sync` for its indicator.
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
  /** Loads every owner already loaded again, e.g. after the interface language changed the built-in knowledge. */
  reloadExplanations: () => Promise<void>;
  /**
   * Another graph is on screen: what was loaded for objects of the graph (nodes, ports, links, groups, subgraphs,
   * the process) is dropped at once, so no card shows the old graph's words on a new node with the same number,
   * and read again for the new graph. Knowledge of classes, models and types stays.
   */
  graphChanged: () => Promise<void>;
  addExplanation: (explanation: Explanation) => void;
  loadRecent: (projectId?: string) => Promise<Explanation[]>;
  /** Saves through knowledge:save-explanation and adds the stored record to the cache. */
  saveExplanation: (input: ExplanationInput) => Promise<Explanation>;
  /** Removes one note the person wrote and forgets it here. */
  removeNote: (item: Explanation) => Promise<void>;
  /** Removes what the assistant wrote about one object (in every project) and reads that object again. */
  removeAssistant: (owner: ObjectRef) => Promise<void>;
  runCheck: (projectId?: string) => Promise<GraphCheckReport>;
}

/** Owners loaded so far, so a reload can ask for them again. */
const loadedOwners = new Map<string, { owner: ObjectRef; projectId: string }>();

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  sync: null,
  explanations: {},
  check: null,
  checking: false,
  recent: [],
  setSync: (sync) => set({ sync }),
  loadExplanations: async (owner, projectId = DESKTOP_PROJECT_ID) => {
    loadedOwners.set(objectKey(owner), { owner, projectId });
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
  reloadExplanations: async () => {
    await Promise.all([...loadedOwners.values()].map(({ owner, projectId }) => get().loadExplanations(owner, projectId).catch(() => [])));
  },
  graphChanged: async () => {
    set((state) => ({
      explanations: Object.fromEntries(Object.entries(state.explanations).filter(([key]) => !isGraphOwnerKind(key.slice(0, key.indexOf(':'))))),
      recent: state.recent.filter((item) => !isGraphOwnerKind(item.owner.kind)),
    }));
    await Promise.all([get().reloadExplanations(), get().loadRecent().catch(() => [])]);
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
  removeNote: async (item) => {
    await window.electronAPI.deleteExplanation(item.id);
    set((state) => {
      const key = objectKey(item.owner);
      return {
        explanations: { ...state.explanations, [key]: (state.explanations[key] ?? []).filter((entry) => entry.id !== item.id) },
        recent: state.recent.filter((entry) => entry.id !== item.id),
      };
    });
  },
  removeAssistant: async (owner) => {
    await window.electronAPI.deleteAssistantExplanations(owner);
    const key = objectKey(owner);
    set((state) => ({
      explanations: { ...state.explanations, [key]: (state.explanations[key] ?? []).filter((entry) => entry.createdBy !== 'ai') },
      recent: state.recent.filter((entry) => !(entry.createdBy === 'ai' && objectKey(entry.owner) === key)),
    }));
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
