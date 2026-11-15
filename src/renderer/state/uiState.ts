import { create } from 'zustand';
import type { ObjectRef } from '../../shared/contracts';

/**
 * Interface state shared by the shell, the canvas and the dock.
 * Other parts of the window read it and call its actions; they do not reshape it.
 */
export type RailTab = 'nodes' | 'models' | 'subgraphs';

/** One stop of a guided tour or a step-by-step build. */
export interface TourStep {
  ref: ObjectRef;
  title: string;
  text: string;
}

/** Shell dialogs opened from the menu bar or a hotkey. */
export type ShellDialog = 'shortcuts' | 'about' | 'new-project' | 'export-guard' | 'help-guide' | 'help-troubleshooting' | 'help-whatsnew' | 'help-content';

/** What replaces the graph on screen once the person confirms: the "new-project" dialog asks for all three. */
export type ReplaceIntent = 'new-project' | 'open-project' | 'import-workflow';

/** Settings sections, in the order of the Preferences window's navigation. The menu opens it on one. */
export const SETTINGS_SECTIONS = ['assistant', 'connection', 'sync', 'canvas', 'appearance', 'shortcuts', 'privacy', 'about'] as const;
export type SettingsSection = typeof SETTINGS_SECTIONS[number];

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
  /** Bumped when the local catalog changes outside sync (catalog snapshot import); libraries re-read. */
  catalogVersion: number;
  /** A request to open the settings dialog (the seq changes each time), from the menu or a hotkey. */
  settingsRequest: { section: SettingsSection | null; seq: number } | null;
  /** The open shell dialog (shortcuts, about, new-project confirmation); null when none. */
  dialog: ShellDialog | null;
  /** What the "new-project" dialog is asking about (New project, Open project, Open workflow). */
  replaceIntent: ReplaceIntent;

  setSelection: (refs: ObjectRef[]) => void;
  setFocus: (ref: ObjectRef | null) => void;
  setContextTarget: (ref: ObjectRef | null) => void;
  setRail: (open: boolean, tab?: RailTab) => void;
  setFollowAgent: (value: boolean) => void;
  startTour: (steps: TourStep[], playing?: boolean) => void;
  setTourIndex: (index: number) => void;
  setTourPlaying: (playing: boolean) => void;
  stopTour: () => void;
  bumpCatalog: () => void;
  openSettings: (section?: SettingsSection) => void;
  setDialog: (dialog: ShellDialog | null) => void;
  /** Asks before the graph on screen, which is in no project file as it stands, is replaced. */
  askReplace: (intent: ReplaceIntent) => void;
}

/** Below this window width the rail starts as an icon strip, so the canvas keeps room for explanatory animation. */
export const RAIL_AUTO_COLLAPSE = 1440;
export const RAIL_WIDTH = 300;
export const RAIL_STRIP = 48;

function initialRailOpen(): boolean {
  return typeof window === 'undefined' ? true : window.innerWidth >= RAIL_AUTO_COLLAPSE;
}

export const useUiStore = create<UiState>((set) => ({
  selection: [],
  focusRef: null,
  contextTarget: null,
  railOpen: initialRailOpen(),
  railTab: 'nodes',
  followAgent: true,
  tour: null,
  catalogVersion: 0,
  settingsRequest: null,
  dialog: null,
  replaceIntent: 'new-project',

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
  bumpCatalog: () => set((state) => ({ catalogVersion: state.catalogVersion + 1 })),
  openSettings: (section) => set((state) => ({ settingsRequest: { section: section ?? null, seq: (state.settingsRequest?.seq ?? 0) + 1 } })),
  setDialog: (dialog) => set({ dialog }),
  askReplace: (replaceIntent) => set({ replaceIntent, dialog: 'new-project' }),
}));
