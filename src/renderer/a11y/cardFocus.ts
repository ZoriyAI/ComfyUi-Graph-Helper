/**
 * Keyboard focus for the cards that open beside the library (a node class card, a model card).
 *
 * Who uses it: components/library/NodeLibrary.tsx and components/library/ModelLibrary.tsx.
 *
 * Why: a card opened from the keyboard (Space on a node row, Enter on a model row) appeared beside the list while
 * focus stayed in the list, and the card sits at the end of the page, so Tab never reached its buttons (Add to
 * canvas, close). A card the keyboard opened now takes focus on its title; closing it from inside gives focus back to
 * the list it came from. A card opened with the mouse leaves focus where it is.
 */

/** After the card has rendered, focus its title (`selector` names the card's title element). */
export function focusCardTitle(selector: string): void {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus());
  });
}

/** Closes a card; when focus was inside it, focus goes back to the list (`listSelector`). */
export function closeCard(cardSelector: string, listSelector: string, close: () => void): void {
  const inside = document.activeElement instanceof Element && document.activeElement.closest(cardSelector) !== null;
  close();
  if (inside) window.requestAnimationFrame(() => document.querySelector<HTMLElement>(listSelector)?.focus());
}
