import { create } from 'zustand';

export const TAB_MIN = 280;
export const TAB_MAX = 440;
export const SPLIT_MIN = 560;
export const SPLIT_MAX = 720;
export const CANVAS_MIN = 560;
const SEPARATOR = 8;

export type DockTab = 'inspector' | 'assistant';

export function canUseSplit(viewport: number): boolean {
  return viewport >= 1280 && viewport - SEPARATOR - SPLIT_MIN >= CANVAS_MIN;
}

export function dockRange(split: boolean, viewport: number): { min: number; max: number } {
  const maxByCanvas = Math.max(0, viewport - SEPARATOR - CANVAS_MIN);
  if (split) return { min: SPLIT_MIN, max: Math.min(SPLIT_MAX, maxByCanvas) };
  return { min: TAB_MIN, max: Math.min(TAB_MAX, Math.max(TAB_MIN, maxByCanvas)) };
}

interface DockUi {
  collapsed: boolean;
  tab: DockTab;
  split: boolean;
  width: number;
  setCollapsed: (value: boolean) => void;
  setSplit: (value: boolean) => void;
  setWidth: (value: number) => void;
  show: (tab: DockTab) => void;
}

export const useDockStore = create<DockUi>((set) => ({
  collapsed: false,
  tab: 'inspector',
  split: false,
  width: 336,
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
      tab,
      width: Math.min(range.max, Math.max(range.min, state.width)),
    };
  }),
}));
