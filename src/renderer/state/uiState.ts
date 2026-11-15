/**
 * Interface state shared by the shell, the canvas and the dock: selection and focus, the library rail, the tour,
 * shell dialogs, settings and help requests.
 *
 * Who uses it: about forty-five files across the shell, canvas, dock, library, lessons, services and commands.
 * Other parts of the window read it and call its actions; they do not reshape it.
 */
import { create } from 'zustand';
import type { ObjectRef } from '../../shared/contracts';

/** The library rail's tabs. */
export type RailTab = 'nodes' | 'models' | 'subgraphs';

/** One stop of a guided tour or a step-by-step build. */
export interface TourStep {
  ref: ObjectRef;
  title: string;
  text: string;
}

/** Shell dialogs opened from the menu bar or a hotkey. */
export type ShellDialog = 'shortcuts' | 'about' | 'new-project' | 'export-guard' | 'help' | 'report-problem';

/**
 * What replaces the graph on screen once the person confirms; the "new-project" dialog asks for all of them.
 * 'open-file': a dropped file, File ▸ Recent or Examples, a file from the command line (commands/actions.ts openVia).
 */
export type ReplaceIntent = 'new-project' | 'open-project' | 'import-workflow' | 'open-file';

/** Settings sections, in the order of the Preferences window's navigation. The menu opens it on one. */
export const SETTINGS_SECTIONS = ['assistant', 'connection', 'browserAccess', 'sync', 'canvas', 'appearance', 'shortcuts', 'privacy', 'about'] as const;
/** One section of the Settings window. */
export type SettingsSection = typeof SETTINGS_SECTIONS[number];

/** A running tour: its stops, where it is, and whether it plays on its own. */
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
  /** The open shell dialog (shortcuts, about, the replace question, export guard, help); null when none. */
  dialog: ShellDialog | null;
  /** What the "new-project" dialog is asking about (New project, Open project, Open workflow). */
  replaceIntent: ReplaceIntent;
  /** The page the help reader shows (a wiki ref such as `start/Quick-Start`, or `@whats-new`); seq changes per request. */
  helpRequest: { page: string; seq: number } | null;

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
  /** Opens the help reader on a page (services/help.ts openHelp takes a context help id). */
  showHelp: (page: string) => void;
}

/**
 * The window width from which the library starts open (below it the rail starts as an icon strip): wide enough
 * for the library, the right panel at its narrowest and a usable canvas (state/frame.ts holdsBothPanels). It was
 * 1440, wider than the 1400 the app opens at, so a first start hid the library, the one place nodes come from.
 */
export const RAIL_AUTO_COLLAPSE = 1180;
/** The open library's width and its folded icon strip's width, in px. */
export const RAIL_WIDTH = 300;
export const RAIL_STRIP = 48;

function initialRailOpen(): boolean {
  return typeof window === 'undefined' ? true : window.innerWidth >= RAIL_AUTO_COLLAPSE;
}

/** The shared interface state. */
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
  helpRequest: null,

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
  showHelp: (page) => set((state) => ({ dialog: 'help', helpRequest: { page, seq: (state.helpRequest?.seq ?? 0) + 1 } })),
}));
