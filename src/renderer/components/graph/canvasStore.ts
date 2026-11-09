import { create } from 'zustand';
import type { ObjectRef } from '../../../shared/contracts/objects';
import type { RevisionSnapshot, RevisionSummary } from '../../../shared/contracts/revisions';
import type { ConnectFrom } from './lib/connectAssist';

/**
 * Ephemeral canvas state: what the explanatory layers are showing right now.
 * Lives inside components/graph because nothing outside the canvas reads it; persistent and shared
 * state stays in graphState / uiState / proposalsState.
 */
export interface ReplayState {
  revisions: RevisionSummary[];
  index: number;
  playing: boolean;
  snapshot: RevisionSnapshot | null;
  loading: boolean;
}

export interface BuildCallout {
  nodeId: string;
  title: string;
  text: string;
}

interface CanvasState {
  /** "What connects here": the port being explained; null when the assist is off. */
  connectFrom: ConnectFrom | null;
  /** True when the assist was chosen from the context menu: it stays until Escape or a pane click. */
  connectPinned: boolean;
  /** The port handle that has keyboard focus, for the selection and Shift+F10. */
  focusedPort: ObjectRef | null;
  /** Ids (nodes and edges) that appeared in the last projection and play the reveal once. */
  justAdded: Record<string, true>;
  /** Nodes an agent commit touched; they pulse once. */
  aiTouched: Record<string, true>;
  /** Step-by-step build: ids waiting their turn, hidden until revealed. */
  pending: string[];
  callout: BuildCallout | null;
  /** Manual commits in flight; their projections do not start a build reveal. */
  manualInFlight: number;
  replay: ReplayState | null;
  /** Add-node search: open, and where the node goes (flow coordinates) when picked. */
  addSearch: { open: boolean; at: { x: number; y: number } | null };

  setConnectFrom: (from: ConnectFrom | null, pinned?: boolean) => void;
  setFocusedPort: (ref: ObjectRef | null) => void;
  markAdded: (ids: string[]) => void;
  clearAdded: (ids: string[]) => void;
  markAiTouched: (ids: string[]) => void;
  clearAiTouched: (ids: string[]) => void;
  setPending: (ids: string[]) => void;
  setCallout: (callout: BuildCallout | null) => void;
  beginManual: () => void;
  endManual: () => void;
  setReplay: (replay: ReplayState | null) => void;
  patchReplay: (patch: Partial<ReplayState>) => void;
  openAddSearch: (at: { x: number; y: number } | null) => void;
  closeAddSearch: () => void;
}

function withIds(record: Record<string, true>, ids: string[]): Record<string, true> {
  const next = { ...record };
  for (const id of ids) next[id] = true;
  return next;
}

function withoutIds(record: Record<string, true>, ids: string[]): Record<string, true> {
  const next = { ...record };
  for (const id of ids) delete next[id];
  return next;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  connectFrom: null,
  connectPinned: false,
  focusedPort: null,
  justAdded: {},
  aiTouched: {},
  pending: [],
  callout: null,
  manualInFlight: 0,
  replay: null,
  addSearch: { open: false, at: null },

  setConnectFrom: (connectFrom, pinned = false) => set({ connectFrom, connectPinned: connectFrom ? pinned : false }),
  setFocusedPort: (focusedPort) => set({ focusedPort }),
  markAdded: (ids) => set((state) => ({ justAdded: withIds(state.justAdded, ids) })),
  clearAdded: (ids) => set((state) => ({ justAdded: withoutIds(state.justAdded, ids) })),
  markAiTouched: (ids) => set((state) => ({ aiTouched: withIds(state.aiTouched, ids) })),
  clearAiTouched: (ids) => set((state) => ({ aiTouched: withoutIds(state.aiTouched, ids) })),
  setPending: (pending) => set({ pending }),
  setCallout: (callout) => set({ callout }),
  beginManual: () => set((state) => ({ manualInFlight: state.manualInFlight + 1 })),
  endManual: () => set((state) => ({ manualInFlight: Math.max(0, state.manualInFlight - 1) })),
  setReplay: (replay) => set({ replay }),
  patchReplay: (patch) => set((state) => (state.replay ? { replay: { ...state.replay, ...patch } } : {})),
  openAddSearch: (at) => set({ addSearch: { open: true, at } }),
  closeAddSearch: () => set({ addSearch: { open: false, at: null } }),
}));
