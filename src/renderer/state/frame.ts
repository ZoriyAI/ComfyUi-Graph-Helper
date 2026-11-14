import { CANVAS_MIN, SPLIT_MIN, TAB_MIN, useDockStore } from './dockState';
import { RAIL_WIDTH, useUiStore } from './uiState';

/**
 * The window frame: the library on the left, the canvas, the right panel. Each side panel has a width it cannot
 * go under, so in a narrow window the two of them together squeezed the canvas to a strip (180 px in the smallest
 * window) and everything that floats over the canvas stuck out of it. The rule here: both panels are open only
 * while the canvas keeps its minimum; otherwise the one the person just opened stays and the other folds to its
 * strip of icons, one click away.
 */

/** Whether the window holds the library, the right panel at its narrowest and a usable canvas side by side. */
export function holdsBothPanels(viewport: number, split: boolean): boolean {
  return viewport - RAIL_WIDTH - (split ? SPLIT_MIN : TAB_MIN) >= CANVAS_MIN;
}

export interface FrameState { railOpen: boolean; dockCollapsed: boolean; split: boolean }

/**
 * Which panel gives way: the one the person did not just open. When it is the window that shrank, the library
 * folds, because the right panel holds the conversation.
 */
export function panelToFold(viewport: number, state: FrameState, opened: 'rail' | 'dock' | 'window'): 'rail' | 'dock' | null {
  if (!state.railOpen || state.dockCollapsed) return null;
  if (holdsBothPanels(viewport, state.split)) return null;
  return opened === 'rail' ? 'dock' : 'rail';
}

/** Applies the rule on every opening of a panel and every change of the window width. Returns the cleanup. */
export function installFrameBalance(): () => void {
  const apply = (opened: 'rail' | 'dock' | 'window') => {
    const ui = useUiStore.getState();
    const dock = useDockStore.getState();
    const fold = panelToFold(window.innerWidth, { railOpen: ui.railOpen, dockCollapsed: dock.collapsed, split: dock.split }, opened);
    if (fold === 'rail') ui.setRail(false);
    else if (fold === 'dock') dock.setCollapsed(true);
  };
  const offRail = useUiStore.subscribe((state, before) => {
    if (state.railOpen && !before.railOpen) apply('rail');
  });
  const offDock = useDockStore.subscribe((state, before) => {
    if ((!state.collapsed && before.collapsed) || (state.split && !before.split)) apply('dock');
  });
  const onResize = () => apply('window');
  window.addEventListener('resize', onResize);
  apply('window');
  return () => {
    offRail();
    offDock();
    window.removeEventListener('resize', onResize);
  };
}
