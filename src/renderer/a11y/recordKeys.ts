/**
 * Which keys Settings ▸ Keyboard shortcuts may record as a shortcut.
 *
 * Who uses it: settings/sections/ShortcutsSection.tsx while a shortcut is being recorded.
 *
 * Why: the recorder took every key. Tab, meant to move on, was recorded as the shortcut (so a keyboard user was
 * trapped and a command took over Tab for good), and a plain letter was accepted, which then fired while the person
 * moved around the window. Now Tab and Shift+Tab leave the recorder and move focus as usual, and a key that moves
 * around the window or types text is refused unless a modifier is held with it
 * (Shift is enough for a letter or digit, as the default Shift+1 shows; navigation keys need Ctrl, Alt or Meta).
 */

/** The parts of a key event this module reads. */
export interface RecordKey { key: string; code?: string; ctrlKey: boolean; altKey: boolean; metaKey: boolean; shiftKey: boolean }

/** What the recorder does with a key: record it, refuse it (and say why), or stop and let the key move focus. */
export type RecordVerdict = 'record' | 'refuse' | 'leave';

/** Keys that move around the window or type text; they need Ctrl, Alt or Meta to be a shortcut. */
const NAVIGATION = new Set(['Enter', ' ', 'Spacebar', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);

/** Decides what the shortcut recorder does with one key press (see the header for the rules). */
export function recordVerdict(event: RecordKey): RecordVerdict {
  if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) return 'leave';
  if (event.ctrlKey || event.altKey || event.metaKey) return 'record';
  if (NAVIGATION.has(event.key) || event.code === 'Space') return 'refuse';
  // A letter, a digit or a sign typed alone. With Shift it stays allowed: the default Fit view is Shift+1.
  if (event.key.length === 1 && !event.shiftKey) return 'refuse';
  return 'record';
}
