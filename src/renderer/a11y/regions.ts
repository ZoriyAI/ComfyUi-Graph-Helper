/**
 * The areas of the main window, in the order F6 visits them, and the element each area hands focus to.
 *
 * Who uses it: a11y/focusRescue.ts, both for F6 and Shift+F6 (its `cycleRegion`, called from commands/hotkeys.ts)
 * and to find which area lost focus and its fallback element when the element that had focus is gone.
 *
 * Why: the canvas holds a Tab stop for every node and field, so a keyboard user needed 40 to 100 presses of Tab to
 * go from the library to the right panel. F6 moves between areas the way desktop programs do, and lands on the
 * element the person last used in that area.
 */

/** One area: its name and the selector that finds it. Its entry element is chosen by `entryOf`. */
export interface Region {
  name: 'menubar' | 'toolbar' | 'library' | 'canvas' | 'dock' | 'status';
  selector: string;
}

/** F6 order: top to bottom, left to right, as the window is laid out. */
export const REGIONS: Region[] = [
  { name: 'menubar', selector: '[role="menubar"]' },
  { name: 'toolbar', selector: '.workspace-toolbar' },
  { name: 'library', selector: '#library-rail' },
  { name: 'canvas', selector: '.react-flow' },
  { name: 'dock', selector: '#tool-dock' },
  { name: 'status', selector: 'footer' },
];

/**
 * The next area to visit from `current` (-1 when focus is in no area) in `direction`, skipping areas that are
 * not on screen or have nothing to focus (`usable[i]` false). Returns -1 when no area can take focus.
 */
export function nextRegion(current: number, direction: 1 | -1, usable: boolean[]): number {
  const count = usable.length;
  if (count === 0) return -1;
  let index = current < 0 ? (direction === 1 ? -1 : count) : current;
  for (let step = 0; step < count; step += 1) {
    index = (index + direction + count) % count;
    if (usable[index]) return index;
  }
  return -1;
}

/** The area an element belongs to, or -1. */
export function regionIndexOf(element: Element | null): number {
  if (!element) return -1;
  return REGIONS.findIndex((region) => element.closest(region.selector) !== null);
}

/** Elements the Tab key can reach; the last resort for an area's entry element. */
const TABBABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Whether a person can put focus on this element now: connected, shown, not disabled. */
export function usable(element: Element | null | undefined): element is HTMLElement {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false;
  if ((element as HTMLButtonElement).disabled) return false;
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

/**
 * The element an area hands focus to when nothing better is known: a marked fallback (`data-focus-fallback`),
 * on the canvas the selected node or else the first node, in the right panel its open tab, else the first
 * element Tab would reach.
 */
export function entryOf(area: Element): HTMLElement | null {
  const marked = Array.from(area.querySelectorAll('[data-focus-fallback]')).find(usable);
  if (marked) return marked;
  if (area.matches('.react-flow')) {
    const node = area.querySelector('.react-flow__node.selected') ?? area.querySelector('.react-flow__node');
    if (usable(node)) return node;
  }
  const tab = area.querySelector('[role="tab"][aria-selected="true"]');
  if (usable(tab) && area.matches('#tool-dock, #library-rail')) return tab;
  return Array.from(area.querySelectorAll(TABBABLE)).find(usable) ?? null;
}
