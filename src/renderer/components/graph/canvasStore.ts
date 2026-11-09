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

/** localStorage key that remembers whether description cards are on. */
export const DESCRIPTIONS_KEY = 'helper.canvas.descriptions';

function readDescriptionsOn(): boolean {
  try {
    return typeof window === 'undefined' || window.localStorage.getItem(DESCRIPTIONS_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writeDescriptionsOn(on: boolean): void {
  try {
    window.localStorage.setItem(DESCRIPTIONS_KEY, on ? 'on' : 'off');
  } catch {
    // Storage can be unavailable; the toggle still works for this session.
  }
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
  /** Description cards under the nodes: all on or off (remembered in localStorage). */
  descriptionsOn: boolean;
  /** Nodes whose card the person closed; a dot on the node brings it back. */
  hiddenDescriptions: Record<string, true>;
  /** Nodes whose card is expanded. */
  expandedDescriptions: Record<string, true>;

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
  setDescriptionsOn: (on: boolean) => void;
  hideDescription: (nodeId: string) => void;
  showDescription: (nodeId: string) => void;
  setDescriptionExpanded: (nodeId: string, expanded: boolean) => void;
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
  descriptionsOn: readDescriptionsOn(),
  hiddenDescriptions: {},
  expandedDescriptions: {},

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
  setDescriptionsOn: (descriptionsOn) => {
    writeDescriptionsOn(descriptionsOn);
    set({ descriptionsOn });
  },
  hideDescription: (nodeId) => set((state) => ({
    hiddenDescriptions: withIds(state.hiddenDescriptions, [nodeId]),
    expandedDescriptions: withoutIds(state.expandedDescriptions, [nodeId]),
  })),
  showDescription: (nodeId) => set((state) => ({ hiddenDescriptions: withoutIds(state.hiddenDescriptions, [nodeId]) })),
  setDescriptionExpanded: (nodeId, expanded) => set((state) => ({
    expandedDescriptions: expanded ? withIds(state.expandedDescriptions, [nodeId]) : withoutIds(state.expandedDescriptions, [nodeId]),
  })),
}));
