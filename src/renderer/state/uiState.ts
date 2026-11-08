import { create } from 'zustand';
import type { ObjectRef } from '../../shared/contracts';

/**
 * Interface state shared by the shell, the canvas and the dock.
 * Owned by the Shell workstream; other workstreams read and call actions, they do not reshape it.
 */
export type RailTab = 'nodes' | 'models' | 'subgraphs';

/** One stop of a guided tour or a step-by-step build. */
export interface TourStep {
  ref: ObjectRef;
  title: string;
  text: string;
}

export interface TourState {
  steps: TourStep[];
  index: number;
  playing: boolean;
}

interface UiState {
  /** Objects the person has selected on the canvas, as ObjectRefs. */
  selection: ObjectRef[];
  /** The object the dock is explaining and the canvas is highlighting. */
  focusRef: ObjectRef | null;
  /** The object under the open context menu. */
  contextTarget: ObjectRef | null;
  railOpen: boolean;
  railTab: RailTab;
  /** When true the viewport follows the agent's commits; any manual action turns it off. */
  followAgent: boolean;
  tour: TourState | null;
  /** Revision sequence at the last project open/save; the app bar shows "unsaved" when the graph moved past it. */
  savedRevSeq: number | null;
  /** Bumped when the local catalog changes outside sync (catalog snapshot import); libraries re-read. */
  catalogVersion: number;

  setSelection: (refs: ObjectRef[]) => void;
  setFocus: (ref: ObjectRef | null) => void;
  setContextTarget: (ref: ObjectRef | null) => void;
  setRail: (open: boolean, tab?: RailTab) => void;
  setFollowAgent: (value: boolean) => void;
  startTour: (steps: TourStep[], playing?: boolean) => void;
  setTourIndex: (index: number) => void;
  setTourPlaying: (playing: boolean) => void;
  stopTour: () => void;
  markSaved: (revSeq: number) => void;
  bumpCatalog: () => void;
}

/** Below this window width the rail starts as an icon strip, so the canvas keeps room for explanatory animation. */
export const RAIL_AUTO_COLLAPSE = 1440;
export const RAIL_WIDTH = 300;
export const RAIL_STRIP = 48;

function initialRailOpen(): boolean {
  return typeof window === 'undefined' ? true : window.innerWidth >= RAIL_AUTO_COLLAPSE;
}

/** True when the displayed revision is not the one last opened or saved. */
export function isDirty(savedRevSeq: number | null, revSeq: number): boolean {
  return savedRevSeq !== null && revSeq !== savedRevSeq;
}

export const useUiStore = create<UiState>((set) => ({
  selection: [],
  focusRef: null,
  contextTarget: null,
  railOpen: initialRailOpen(),
  railTab: 'nodes',
  followAgent: false,
  tour: null,
  savedRevSeq: null,
  catalogVersion: 0,

  setSelection: (selection) => set({ selection }),
  setFocus: (focusRef) => set({ focusRef }),
  setContextTarget: (contextTarget) => set({ contextTarget }),
  setRail: (railOpen, railTab) => set((state) => ({ railOpen, railTab: railTab ?? state.railTab })),
  setFollowAgent: (followAgent) => set({ followAgent }),
  startTour: (steps, playing = false) => set({ tour: steps.length > 0 ? { steps, index: 0, playing } : null }),
  setTourIndex: (index) => set((state) => (
    state.tour ? { tour: { ...state.tour, index: Math.min(state.tour.steps.length - 1, Math.max(0, index)) } } : {}
  )),
  setTourPlaying: (playing) => set((state) => (state.tour ? { tour: { ...state.tour, playing } } : {})),
  stopTour: () => set({ tour: null }),
  markSaved: (savedRevSeq) => set({ savedRevSeq }),
  bumpCatalog: () => set((state) => ({ catalogVersion: state.catalogVersion + 1 })),
}));
