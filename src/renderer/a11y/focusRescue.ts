/**
 * Focus rescue: when keyboard focus falls to the page body, it is put back on a sensible element.
 *
 * Who uses it: App.tsx installs it once for the main window; commands/hotkeys.ts uses `focusRegion` for F6.
 *
 * Why: after many actions the element that had focus disappeared or was switched off (a deleted node or link, a
 * lesson step's button, a dialog opened from a menu whose item is gone, the chat field while an answer streams,
 * entering or leaving a subgraph). Focus then went to the page body, and the next Tab started again at the menu
 * bar, 40 to 100 presses away from where the person was. One rule now covers all of them: focus goes back to the
 * last element the person used in that area if it can still take focus, else to a place the area marked for
 * this (data-focus-fallback), else to an earlier one, else to the element nearest to where the lost one was (a node next to the deleted node), else to the area's entry element.
 * A click on an empty spot, or a focus change while the window is in the background, is left alone.
 */
import { REGIONS, entryOf, nextRegion, regionIndexOf, usable } from './regions';

/** Where an element was on screen, to find its nearest neighbour after it is gone. */
export interface Spot { x: number; y: number }

interface Remembered { element: HTMLElement; region: number; spot: Spot | null; nodeLike: boolean }

/** How many recent elements are kept per area. */
const HISTORY = 6;

/**
 * Picks the element to rescue focus to from the remembered history (newest last) of the area that lost focus.
 * Pure over its inputs, so it is tested without a browser.
 */
export function pickRescue<T>(history: T[], isUsable: (item: T) => boolean): T | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (isUsable(history[index])) return history[index];
  }
  return null;
}

/** The candidate whose centre is nearest to `spot` (a node beside the deleted one). */
export function nearest<T>(spot: Spot, candidates: Array<{ item: T; spot: Spot }>): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = Math.hypot(candidate.spot.x - spot.x, candidate.spot.y - spot.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate.item;
    }
  }
  return best;
}

/** Menus, dialogs and lists that float above the window manage focus themselves (Radix returns it on close). */
const LAYER = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="menubar"], .select-content, [data-radix-popper-content-wrapper]';

function centre(element: Element): Spot | null {
  const box = element.getBoundingClientRect();
  return box.width > 0 ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
}

const histories = new Map<number, Remembered[]>();
let lastRegion = -1;

function remember(element: Element | null): void {
  if (!(element instanceof HTMLElement) || element === document.body || element.closest(LAYER)) return;
  const region = regionIndexOf(element);
  if (region < 0) return;
  const list = (histories.get(region) ?? []).filter((item) => item.element !== element && item.element.isConnected);
  list.push({ element, region, spot: centre(element), nodeLike: element.matches('.react-flow__node, .react-flow__edge, .react-flow__handle') });
  histories.set(region, list.slice(-HISTORY));
  lastRegion = region;
}

/** The element focus goes to for one area: its history, then the nearest node, then its entry element. */
function targetFor(region: number): HTMLElement | null {
  const area = document.querySelector(REGIONS[region]?.selector ?? '');
  if (!area) return null;
  const list = histories.get(region) ?? [];
  const lost = list[list.length - 1];
  if (lost && usable(lost.element)) return lost.element;
  // The element is gone: a place the area marked for this (a lesson's new step title) comes before older history.
  const marked = Array.from(area.querySelectorAll('[data-focus-fallback]')).find(usable);
  if (marked) return marked;
  // A deleted node or link: the node nearest to where it was, before anything used earlier.
  if (lost?.spot && lost.nodeLike) {
    const nodes = Array.from(area.querySelectorAll('.react-flow__node')).filter(usable)
      .map((item) => ({ item: item as HTMLElement, spot: centre(item) }))
      .filter((candidate): candidate is { item: HTMLElement; spot: Spot } => candidate.spot !== null);
    const near = nearest(lost.spot, nodes);
    if (near) return near;
  }
  const kept = pickRescue(list, (item) => usable(item.element));
  if (kept) return kept.element;
  return entryOf(area);
}

/** Moves focus into an area (F6): the element last used there, else its entry element. */
export function focusRegion(region: number): boolean {
  const target = targetFor(region);
  if (!target) return false;
  target.focus({ preventScroll: false });
  return document.activeElement === target;
}

/** F6 / Shift+F6: the next or previous area that can take focus. */
export function cycleRegion(direction: 1 | -1): void {
  const current = regionIndexOf(document.activeElement);
  const able = REGIONS.map((region, index) => {
    const area = document.querySelector(region.selector);
    return Boolean(area && usable(area as HTMLElement) && targetFor(index));
  });
  const next = nextRegion(current, direction, able);
  if (next >= 0) focusRegion(next);
}

/** Installs the rescue on the window; returns the function that removes it. */
export function installFocusRescue(): () => void {
  let pointerAt = 0;
  let scheduled = 0;
  const check = () => {
    scheduled = 0;
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement) return;
    // A click on an empty spot moves focus nowhere on purpose; a window in the background is not ours to change.
    if (Date.now() - pointerAt < 600 || !document.hasFocus()) return;
    // An open dialog or menu owns focus; it returns focus itself when it closes.
    if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"]')) return;
    if (lastRegion < 0) return;
    const target = targetFor(lastRegion);
    if (target) target.focus({ preventScroll: true });
  };
  // Two frames: Radix and React finish moving focus (or putting it back) before the check runs.
  const schedule = () => {
    if (scheduled) return;
    scheduled = window.requestAnimationFrame(() => { scheduled = window.requestAnimationFrame(check); });
  };
  const onFocusIn = (event: FocusEvent) => remember(event.target as Element | null);
  const onFocusOut = () => schedule();
  const onPointer = () => { pointerAt = Date.now(); };
  // A focused element that is switched off or removed fires no focusout in every case; a change in the page
  // schedules the same cheap check (it does nothing while something has focus).
  const observer = new MutationObserver(() => {
    if (document.activeElement === document.body) schedule();
  });
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', onFocusOut, true);
  window.addEventListener('pointerdown', onPointer, true);
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'inert'] });
  return () => {
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('focusout', onFocusOut, true);
    window.removeEventListener('pointerdown', onPointer, true);
    observer.disconnect();
    if (scheduled) window.cancelAnimationFrame(scheduled);
  };
}
