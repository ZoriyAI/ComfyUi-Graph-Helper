import { create } from 'zustand';
import type { ObjectRef } from '../../../shared/contracts/objects';
import type { RevisionSnapshot, RevisionSummary } from '../../../shared/contracts/revisions';
import type { AgentViewport } from '../../../shared/contracts/agent';
import type { ConnectFrom } from './lib/connectAssist';
import type { BuildItem, BuildStepInfo } from './lib/buildQueue';
import { descriptionsPatch, type DescriptionsMode } from '../../../shared/config/preferences';
import { nextDescriptionsMode } from './lib/description';
import { useGraphStore } from '../../state/graphState';
import { useProjectionStore } from '../../services/commands/projection';

/**
 * Whether a card is hidden, expanded or collapsed is remembered per graph and per subgraph view, not by node id
 * alone: node 4 of a new project, or node 4 inside a subgraph, is another node than node 4 a moment ago.
 * The scope is the graph on screen (Projection.graphKey) and the open subgraph; with neither (tests, the first
 * frame) a key is the bare node id.
 */
export function descriptionScopeOf(graphKey: string, subgraphId: string | null | undefined): string {
  return [graphKey, subgraphId ?? ''].filter(Boolean).join('|');
}

export function descriptionScope(): string {
  return descriptionScopeOf(useProjectionStore.getState().graphKey, useGraphStore.getState().activeSubgraphId);
}

export function descriptionKey(nodeId: string, scope: string = descriptionScope()): string {
  return scope ? `${scope}#${nodeId}` : nodeId;
}

/** The scope as a hook, so a card re-reads its remembered state when the graph or the subgraph view changes. */
export function useDescriptionScope(): string {
  const graphKey = useProjectionStore((state) => state.graphKey);
  const subgraphId = useGraphStore((state) => state.activeSubgraphId);
  return descriptionScopeOf(graphKey, subgraphId);
}

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
export type CanvasPersist = (patch: CanvasPatch) => void;
export interface CanvasPatch {
  showDescriptions?: boolean;
  descriptions?: DescriptionsMode;
  showMinimap?: boolean;
}

let persist: CanvasPersist | null = null;

/** Installs (or removes) the writer the description and minimap toggles save through. */
export function setCanvasPersist(next: CanvasPersist | null): void {
  persist = next;
}

function remember(patch: CanvasPatch): void {
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
  /** The step (by `shown`) the `why` belongs to: the strip shows it only beside that step's number. */
  whyAt?: number;
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
  centerRequest: { nodeId: string; nonce: number; subgraphId?: string } | null;
  /** Manual commits in flight; their projections do not start a build reveal. */
  manualInFlight: number;
  replay: ReplayState | null;
  /** Add-node search: open, and where the node goes (flow coordinates) when picked. */
  /** `query` is typed into the search as it opens (a lesson asking for a node by name). */
  /**
   * The add-node search. `linkFrom`: a link was dropped on empty canvas from this port; the search lists the nodes
   * that can take it, and the chosen one is connected.
   */
  addSearch: { open: boolean; at: { x: number; y: number } | null; query?: string; linkFrom?: ConnectFrom };
  /** Description cards under the nodes: own / all / off (remembered in Preferences ▸ Canvas). */
  descriptionsMode: DescriptionsMode;
  /** True unless the mode is off (the toolbar button's pressed state; kept for older readers). */
  descriptionsOn: boolean;
  /** The minimap in the canvas corner (remembered in Preferences ▸ Canvas). */
  minimapOn: boolean;
  /** View ▸ Pin nodes: nodes cannot be dragged (fields, links and the view still work). A chip says so while on. */
  nodesPinned: boolean;
  /** A link being dragged from a port: compatible ports glow and the rest dim while it lasts. */
  linkDrag: ConnectFrom | null;
  /** Nodes whose card the person closed; a dot on the node brings it back. */
  hiddenDescriptions: Record<string, true>;
  /** Nodes whose card is expanded. */
  expandedDescriptions: Record<string, true>;
  /** Selected nodes whose card the person collapsed (selection no longer expands it until it is reselected). */
  collapsedDescriptions: Record<string, true>;
  /** The node the pointer rests on (after the hover delay), whose card shows on demand. */
  hoveredDescription: string | null;
  /** The node with keyboard focus, whose card shows on demand. */
  focusedDescription: string | null;
  /** The node the live build revealed last; its card shows on demand once the bubble is gone. */
  revealedDescription: string | null;

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
  requestCenter: (nodeId: string, subgraphId?: string) => void;
  beginManual: () => void;
  endManual: () => void;
  setReplay: (replay: ReplayState | null) => void;
  patchReplay: (patch: Partial<ReplayState>) => void;
  openAddSearch: (at: { x: number; y: number } | null, query?: string, linkFrom?: ConnectFrom) => void;
  closeAddSearch: () => void;
  setDescriptionsOn: (on: boolean) => void;
  setDescriptionsMode: (mode: DescriptionsMode) => void;
  cycleDescriptionsMode: () => void;
  setHoveredDescription: (nodeId: string | null) => void;
  setFocusedDescription: (nodeId: string | null) => void;
  /** Escape: every expanded card collapses, hover and build reveals let go. */
  collapseDescriptions: (selected: string[]) => void;
  /** Forget the person's collapse of cards whose node is no longer selected. */
  keepCollapsed: (selected: string[]) => void;
  setMinimapOn: (on: boolean) => void;
  setNodesPinned: (on: boolean) => void;
  setLinkDrag: (from: ConnectFrom | null) => void;
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

export const useCanvasStore = create<CanvasState>((set, get) => ({
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
  descriptionsMode: 'own',
  descriptionsOn: true,
  minimapOn: true,
  nodesPinned: false,
  linkDrag: null,
  hiddenDescriptions: {},
  expandedDescriptions: {},
  collapsedDescriptions: {},
  hoveredDescription: null,
  focusedDescription: null,
  revealedDescription: null,

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
    const live = callout !== state.callout && info.why ? { ...state.live, why: info.why, whyAt: state.live.shown } : state.live;
    return { stepInfo, callout, live };
  }),
  setLive: (live) => set({ live }),
  addFading: (nodes) => set((state) => ({ fading: [...state.fading.filter((item) => !nodes.some((node) => node.id === item.id)), ...nodes] })),
  clearFading: (ids) => set((state) => ({ fading: state.fading.filter((item) => !ids.includes(item.id)) })),
  setCallout: (callout) => set(callout && (callout.kind ?? 'node') === 'node' ? { callout, revealedDescription: callout.nodeId } : { callout }),
  setViewport: (viewport) => set((state) => (
    state.viewport && state.viewport.x === viewport.x && state.viewport.y === viewport.y && state.viewport.zoom === viewport.zoom
      && state.viewport.width === viewport.width && state.viewport.height === viewport.height
      ? {}
      : { viewport }
  )),
  requestCenter: (nodeId, subgraphId) => set((state) => ({ centerRequest: { nodeId, subgraphId, nonce: (state.centerRequest?.nonce ?? 0) + 1 } })),
  beginManual: () => set((state) => ({ manualInFlight: state.manualInFlight + 1 })),
  endManual: () => set((state) => ({ manualInFlight: Math.max(0, state.manualInFlight - 1) })),
  setReplay: (replay) => set({ replay }),
  patchReplay: (patch) => set((state) => (state.replay ? { replay: { ...state.replay, ...patch } } : {})),
  openAddSearch: (at, query, linkFrom) => set({ addSearch: { open: true, at, ...(query ? { query } : {}), ...(linkFrom ? { linkFrom } : {}) } }),
  closeAddSearch: () => set({ addSearch: { open: false, at: null } }),
  setDescriptionsOn: (on) => {
    const current = get().descriptionsMode;
    get().setDescriptionsMode(on ? (current === 'off' ? 'own' : current) : 'off');
  },
  setDescriptionsMode: (descriptionsMode) => {
    set({ descriptionsMode, descriptionsOn: descriptionsMode !== 'off' });
    remember(descriptionsPatch(descriptionsMode));
  },
  cycleDescriptionsMode: () => get().setDescriptionsMode(nextDescriptionsMode(get().descriptionsMode)),
  setHoveredDescription: (hoveredDescription) => set((state) => (state.hoveredDescription === hoveredDescription ? {} : { hoveredDescription })),
  setFocusedDescription: (focusedDescription) => set((state) => (state.focusedDescription === focusedDescription ? {} : { focusedDescription })),
  collapseDescriptions: (selected) => set({
    expandedDescriptions: {},
    collapsedDescriptions: withIds({}, selected.map((id) => descriptionKey(id))),
    hoveredDescription: null,
    revealedDescription: null,
  }),
  keepCollapsed: (selected) => set((state) => {
    const keys = selected.map((id) => descriptionKey(id));
    const kept = Object.keys(state.collapsedDescriptions).filter((key) => keys.includes(key));
    return kept.length === Object.keys(state.collapsedDescriptions).length ? {} : { collapsedDescriptions: withIds({}, kept) };
  }),
  setNodesPinned: (nodesPinned) => set({ nodesPinned }),
  setLinkDrag: (linkDrag) => set({ linkDrag }),
  setMinimapOn: (minimapOn) => {
    set({ minimapOn });
    remember({ showMinimap: minimapOn });
  },
  hideDescription: (nodeId) => set((state) => {
    const key = descriptionKey(nodeId);
    return {
      hiddenDescriptions: withIds(state.hiddenDescriptions, [key]),
      expandedDescriptions: withoutIds(state.expandedDescriptions, [key]),
    };
  }),
  showDescription: (nodeId) => set((state) => ({ hiddenDescriptions: withoutIds(state.hiddenDescriptions, [descriptionKey(nodeId)]) })),
  setDescriptionExpanded: (nodeId, expanded) => set((state) => {
    const key = descriptionKey(nodeId);
    return {
      expandedDescriptions: expanded ? withIds(state.expandedDescriptions, [key]) : withoutIds(state.expandedDescriptions, [key]),
      collapsedDescriptions: expanded ? withoutIds(state.collapsedDescriptions, [key]) : withIds(state.collapsedDescriptions, [key]),
    };
  }),
}));
