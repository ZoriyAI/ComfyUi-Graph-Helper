import { create } from 'zustand';
import type { ObjectRef } from '../../../shared/contracts/objects';
import type { RevisionSnapshot, RevisionSummary } from '../../../shared/contracts/revisions';
import type { AgentViewport } from '../../../shared/contracts/agent';
import type { ConnectFrom } from './lib/connectAssist';
import type { BuildItem, BuildStepInfo } from './lib/buildQueue';

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

/** Where a canvas toggle is remembered: Preferences ▸ Canvas in SQLite (state/preferencesBridge installs it). */
export type CanvasPersist = (patch: { showDescriptions?: boolean; showMinimap?: boolean }) => void;

let persist: CanvasPersist | null = null;

/** Installs (or removes) the writer the description and minimap toggles save through. */
export function setCanvasPersist(next: CanvasPersist | null): void {
  persist = next;
}

function remember(patch: { showDescriptions?: boolean; showMinimap?: boolean }): void {
  try {
    persist?.(patch);
  } catch {
    // The toggle still works for this session.
  }
}

export interface BuildCallout {
  /** The node the bubble points at. */
  nodeId: string;
  title: string;
  text: string;
  /** The build item the callout is about (node id, edge id, param key); absent for older callers. */
  key?: string;
  kind?: BuildItem['kind'];
  /** Tool name of the step (addNode, connectNodes, …), for the label. */
  toolName?: string;
  step?: { index: number; total: number };
  change?: BuildItem['change'];
}

/** The live build of the current agent run: how many steps are on screen and what the last one said. */
export interface LiveBuild {
  runId: string | null;
  shown: number;
  why: string;
}

/** A node the agent removed, fading out where it stood. */
export interface FadingNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
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
  /** Step-by-step build: node and edge ids waiting their turn, hidden until revealed (derived from `queue`). */
  pending: string[];
  /** Step-by-step build: everything waiting its turn, in order. */
  queue: BuildItem[];
  /** What build-step chunks said, by item key. */
  stepInfo: Record<string, BuildStepInfo>;
  live: LiveBuild;
  fading: FadingNode[];
  callout: BuildCallout | null;
  /** The canvas camera and size, for the agent's turn context. */
  viewport: AgentViewport | null;
  /** A request to centre a node (the chat's "Show"); the nonce makes a repeat request count. */
  centerRequest: { nodeId: string; nonce: number } | null;
  /** Manual commits in flight; their projections do not start a build reveal. */
  manualInFlight: number;
  replay: ReplayState | null;
  /** Add-node search: open, and where the node goes (flow coordinates) when picked. */
  addSearch: { open: boolean; at: { x: number; y: number } | null };
  /** Description cards under the nodes: all on or off (remembered in Preferences ▸ Canvas). */
  descriptionsOn: boolean;
  /** The minimap in the canvas corner (remembered in Preferences ▸ Canvas). */
  minimapOn: boolean;
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
  setQueue: (items: BuildItem[]) => void;
  noteBuildStep: (key: string, info: BuildStepInfo) => void;
  setLive: (live: LiveBuild) => void;
  addFading: (nodes: FadingNode[]) => void;
  clearFading: (ids: string[]) => void;
  setCallout: (callout: BuildCallout | null) => void;
  setViewport: (viewport: AgentViewport) => void;
  requestCenter: (nodeId: string) => void;
  beginManual: () => void;
  endManual: () => void;
  setReplay: (replay: ReplayState | null) => void;
  patchReplay: (patch: Partial<ReplayState>) => void;
  openAddSearch: (at: { x: number; y: number } | null) => void;
  closeAddSearch: () => void;
  setDescriptionsOn: (on: boolean) => void;
  setMinimapOn: (on: boolean) => void;
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
  queue: [],
  stepInfo: {},
  live: { runId: null, shown: 0, why: '' },
  fading: [],
  callout: null,
  viewport: null,
  centerRequest: null,
  manualInFlight: 0,
  replay: null,
  addSearch: { open: false, at: null },
  descriptionsOn: true,
  minimapOn: true,
  hiddenDescriptions: {},
  expandedDescriptions: {},

  setConnectFrom: (connectFrom, pinned = false) => set({ connectFrom, connectPinned: connectFrom ? pinned : false }),
  setFocusedPort: (focusedPort) => set({ focusedPort }),
  markAdded: (ids) => set((state) => ({ justAdded: withIds(state.justAdded, ids) })),
  clearAdded: (ids) => set((state) => ({ justAdded: withoutIds(state.justAdded, ids) })),
  markAiTouched: (ids) => set((state) => ({ aiTouched: withIds(state.aiTouched, ids) })),
  clearAiTouched: (ids) => set((state) => ({ aiTouched: withoutIds(state.aiTouched, ids) })),
  setPending: (pending) => set((state) => ({ pending, queue: state.queue.filter((item) => item.kind === 'param' || pending.includes(item.key)) })),
  setQueue: (queue) => set({ queue, pending: queue.filter((item) => item.kind !== 'param').map((item) => item.key) }),
  noteBuildStep: (key, info) => set((state) => {
    const stepInfo = { ...state.stepInfo, [key]: info };
    // The step may already be on screen (motion off, or a slow chunk): give its callout the agent's words now.
    const callout = state.callout && state.callout.key === key && info.why
      ? { ...state.callout, text: info.why, toolName: info.toolName }
      : state.callout;
    const live = callout !== state.callout && info.why ? { ...state.live, why: info.why } : state.live;
    return { stepInfo, callout, live };
  }),
  setLive: (live) => set({ live }),
  addFading: (nodes) => set((state) => ({ fading: [...state.fading.filter((item) => !nodes.some((node) => node.id === item.id)), ...nodes] })),
  clearFading: (ids) => set((state) => ({ fading: state.fading.filter((item) => !ids.includes(item.id)) })),
  setCallout: (callout) => set({ callout }),
  setViewport: (viewport) => set((state) => (
    state.viewport && state.viewport.x === viewport.x && state.viewport.y === viewport.y && state.viewport.zoom === viewport.zoom
      && state.viewport.width === viewport.width && state.viewport.height === viewport.height
      ? {}
      : { viewport }
  )),
  requestCenter: (nodeId) => set((state) => ({ centerRequest: { nodeId, nonce: (state.centerRequest?.nonce ?? 0) + 1 } })),
  beginManual: () => set((state) => ({ manualInFlight: state.manualInFlight + 1 })),
  endManual: () => set((state) => ({ manualInFlight: Math.max(0, state.manualInFlight - 1) })),
  setReplay: (replay) => set({ replay }),
  patchReplay: (patch) => set((state) => (state.replay ? { replay: { ...state.replay, ...patch } } : {})),
  openAddSearch: (at) => set({ addSearch: { open: true, at } }),
  closeAddSearch: () => set({ addSearch: { open: false, at: null } }),
  setDescriptionsOn: (descriptionsOn) => {
    set({ descriptionsOn });
    remember({ showDescriptions: descriptionsOn });
  },
  setMinimapOn: (minimapOn) => {
    set({ minimapOn });
    remember({ showMinimap: minimapOn });
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
