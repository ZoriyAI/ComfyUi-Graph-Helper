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

  setSelection: (refs: ObjectRef[]) => void;
  setFocus: (ref: ObjectRef | null) => void;
  setContextTarget: (ref: ObjectRef | null) => void;
  setRail: (open: boolean, tab?: RailTab) => void;
  setFollowAgent: (value: boolean) => void;
  startTour: (steps: TourStep[], playing?: boolean) => void;
  setTourIndex: (index: number) => void;
  setTourPlaying: (playing: boolean) => void;
  stopTour: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selection: [],
  focusRef: null,
  contextTarget: null,
  railOpen: true,
  railTab: 'nodes',
  followAgent: false,
  tour: null,

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
}));
