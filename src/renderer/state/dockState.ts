import { create } from 'zustand';

/** Single-tab dock width range (px). */
export const TAB_MIN = 320;
export const TAB_MAX = 720;
export const TAB_DEFAULT = 336;
/** "Show both" (inspector and chat side by side). */
export const SPLIT_MIN = 560;
export const SPLIT_MAX = 720;
/** The canvas never gets narrower than this because of the dock. */
export const CANVAS_MIN = 560;

/** 'assistant' is the chat tab (the id e2e tests and other parts of the window use). */
export type DockTab = 'assistant' | 'explain' | 'inspector' | 'check';
/** 'chat' is accepted as another name for the assistant tab. */
export type DockTabAlias = DockTab | 'chat';

export const DOCK_TABS: readonly DockTab[] = ['assistant', 'explain', 'inspector', 'check'];

export function normalizeDockTab(tab: string): DockTab {
  if (tab === 'chat') return 'assistant';
  return (DOCK_TABS as readonly string[]).includes(tab) ? (tab as DockTab) : 'inspector';
}

export function canUseSplit(viewport: number): boolean {
  return viewport >= 1280 && viewport - SPLIT_MIN >= CANVAS_MIN;
}

/** Allowed dock widths. `reserved` is what the rest of the frame (rail) already takes. */
export function dockRange(split: boolean, viewport: number, reserved = 0): { min: number; max: number } {
  const room = viewport - CANVAS_MIN - reserved;
  if (split) {
    return { min: SPLIT_MIN, max: Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, room)) };
  }
  return { min: TAB_MIN, max: Math.max(TAB_MIN, Math.min(TAB_MAX, room)) };
}

interface DockUi {
  collapsed: boolean;
  tab: DockTab;
  split: boolean;
  width: number;
  setCollapsed: (value: boolean) => void;
  setSplit: (value: boolean) => void;
  setWidth: (value: number) => void;
  /** Opens the dock on a tab; 'chat' means the assistant tab. */
  show: (tab: DockTabAlias) => void;
}

export const useDockStore = create<DockUi>((set) => ({
  collapsed: false,
  // A first start opens on the assistant: an empty Properties tab says nothing to a newcomer.
  tab: 'assistant',
  split: false,
  width: TAB_DEFAULT,
  setCollapsed: (collapsed) => set({ collapsed }),
  setSplit: (split) => set((state) => {
    const range = dockRange(split, window.innerWidth);
    const width = Math.min(range.max, Math.max(range.min, split ? Math.max(state.width, SPLIT_MIN) : state.width));
    return { split, collapsed: split ? false : state.collapsed, width };
  }),
  setWidth: (width) => set({ width }),
  show: (tab) => set((state) => {
    const range = dockRange(false, window.innerWidth);
    return {
      collapsed: false,
      split: false,
      tab: normalizeDockTab(tab),
      width: Math.min(range.max, Math.max(range.min, state.width)),
    };
  }),
}));
