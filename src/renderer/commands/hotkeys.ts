import { allCommands, isEnabled, runCommand, type Command } from './registry';
import { detectPlatform, matchesShortcut, type KeyLike, type Platform } from './shortcuts';

/** Shortcuts that still work while typing in a field or inside an open menu or dialog. */
export const GLOBAL_SHORTCUTS = new Set(['Escape', 'Mod+S', 'Mod+O', 'Mod+N', 'Mod+Shift+C']);

export interface FocusContext {
  /** Focus is in an input, textarea, select or contenteditable element. */
  editable: boolean;
  /** A Radix menu, listbox or dialog is open (or holds focus). */
  layerOpen: boolean;
}

/** Where the key went, read from the DOM. */
export function focusContext(target: EventTarget | null, doc: Document = document): FocusContext {
  const element = target instanceof Element ? target : null;
  const editable = Boolean(element && (
    element.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
    || (element instanceof HTMLElement && element.isContentEditable)
  ));
  const layerOpen = Boolean(
    element?.closest('[role="menu"], [role="menubar"] [aria-expanded="true"], [role="dialog"], [role="listbox"]')
    || doc.querySelector('[role="menu"][data-state="open"], [role="dialog"][data-state="open"], .select-content[data-state="open"]'),
  );
  return { editable, layerOpen };
}

/** True when a command's shortcut may run in this focus context. */
export function shortcutAllowed(shortcut: string, context: FocusContext): boolean {
  if (GLOBAL_SHORTCUTS.has(shortcut)) {
    // Escape belongs to the open menu or dialog (Radix closes it); it stops explanations only on the canvas.
    if (shortcut === 'Escape') return !context.layerOpen && !context.editable;
    return true;
  }
  return !context.editable && !context.layerOpen;
}

/** The enabled command whose shortcut this key event is, if any may run here. */
export function commandForKey(event: KeyLike, context: FocusContext, commands: Command[], platform: Platform): Command | null {
  for (const command of commands) {
    if (!command.shortcut || command.shortcutDisplayOnly) continue;
    if (!matchesShortcut(event, command.shortcut, platform)) continue;
    if (!shortcutAllowed(command.shortcut, context)) return null;
    return isEnabled(command.id) ? command : null;
  }
  return null;
}

/** The menu bar's first menu, which Alt and F10 focus the way a desktop menu bar does. */
function menuBarTrigger(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="menubar"] [role="menuitem"]');
}

/** The element that had focus before the menu bar took it; focus goes back there after a command. */
let beforeMenuBar: HTMLElement | null = null;

export function rememberFocusBeforeMenuBar(element: Element | null): void {
  if (element instanceof HTMLElement && !element.closest('[role="menubar"]') && element !== document.body) beforeMenuBar = element;
}

export function restoreFocusAfterMenuBar(): void {
  const target = beforeMenuBar;
  beforeMenuBar = null;
  if (target && target.isConnected) target.focus({ preventScroll: true });
  else if (document.activeElement instanceof HTMLElement && document.activeElement.closest('[role="menubar"]')) document.activeElement.blur();
}

function toggleMenuBarFocus(): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.closest('[role="menubar"]')) {
    restoreFocusAfterMenuBar();
    return;
  }
  const trigger = menuBarTrigger();
  if (!trigger) return;
  rememberFocusBeforeMenuBar(active);
  trigger.focus();
}

/**
 * The one window keydown listener: shortcuts of registered commands, and Alt / F10 to reach the menu bar.
 * React Flow keeps Delete and Backspace on the canvas (with its onBeforeDelete guard), so Edit ▸ Delete
 * only shows that key.
 */
export function installHotkeys(platform: Platform = detectPlatform()): () => void {
  let altAlone = false;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Alt') {
      altAlone = !event.ctrlKey && !event.shiftKey && !event.metaKey && !event.repeat;
      return;
    }
    altAlone = false;
    if (event.defaultPrevented || event.isComposing) return;
    if (event.key === 'F10' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      toggleMenuBarFocus();
      return;
    }
    const command = commandForKey(event, focusContext(event.target), allCommands(), platform);
    if (!command) return;
    event.preventDefault();
    void runCommand(command.id);
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key !== 'Alt') return;
    const alone = altAlone;
    altAlone = false;
    if (!alone) return;
    const context = focusContext(event.target);
    // Inside an open menu, dialog or list, Alt belongs to it.
    if (context.layerOpen) return;
    event.preventDefault();
    toggleMenuBarFocus();
  };

  const onPointerDown = () => {
    altAlone = false;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('pointerdown', onPointerDown, true);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('pointerdown', onPointerDown, true);
  };
}
