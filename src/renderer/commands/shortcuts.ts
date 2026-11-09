/**
 * Keyboard shortcuts as strings ('Mod+S', 'Mod+Shift+Z', 'F1', 'Delete'). `Mod` is Ctrl on Linux and
 * Windows and ⌘ on macOS. Letters and digits match by physical key (event.code), so Ctrl+S works the same
 * on a Russian layout where the key types «ы».
 */
export type Platform = 'mac' | 'other';

export interface ParsedShortcut {
  mod: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  /** The key token as written: 'S', '0', '=', '/', 'F1', 'Delete', 'Escape', ','. */
  key: string;
}

export interface KeyLike {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export function detectPlatform(source?: string): Platform {
  const text = source ?? (typeof navigator === 'undefined' ? '' : `${navigator.platform} ${navigator.userAgent}`);
  return /Mac|iPhone|iPad/i.test(text) ? 'mac' : 'other';
}

export function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split('+');
  // 'Mod+=' splits cleanly; 'Mod++' would leave an empty last part, which means the plus key.
  const rawKey = parts[parts.length - 1] === '' ? '+' : parts[parts.length - 1];
  const modifiers = new Set(parts.slice(0, -1).map((part) => part.toLowerCase()));
  return {
    mod: modifiers.has('mod'),
    ctrl: modifiers.has('ctrl'),
    shift: modifiers.has('shift'),
    alt: modifiers.has('alt'),
    key: rawKey.length === 1 ? rawKey.toUpperCase() : rawKey,
  };
}

/** Physical codes that produce a key token, so the match does not depend on the keyboard layout. */
function codesFor(key: string): string[] {
  if (/^[A-Z]$/.test(key)) return [`Key${key}`];
  if (/^[0-9]$/.test(key)) return [`Digit${key}`, `Numpad${key}`];
  switch (key) {
    case '=': return ['Equal', 'NumpadAdd'];
    case '+': return ['Equal', 'NumpadAdd'];
    case '-': return ['Minus', 'NumpadSubtract'];
    case '/': return ['Slash', 'NumpadDivide'];
    case ',': return ['Comma'];
    case '.': return ['Period'];
    default: return [];
  }
}

/** Key values that also count (the shifted '=' is '+', a numpad key, a layout without event.code). */
function keysFor(key: string): string[] {
  if (/^[A-Z]$/.test(key)) return [key, key.toLowerCase()];
  if (key === '=' || key === '+') return ['=', '+'];
  if (key === 'Delete') return ['Delete'];
  if (key === 'Escape') return ['Escape', 'Esc'];
  return [key];
}

/** True when the key event is this shortcut on this platform, with no extra modifiers held. */
export function matchesShortcut(event: KeyLike, shortcut: string, platform: Platform = detectPlatform()): boolean {
  const parsed = parseShortcut(shortcut);
  const wantMeta = parsed.mod && platform === 'mac';
  const wantCtrl = parsed.ctrl || (parsed.mod && platform !== 'mac');
  if (event.metaKey !== wantMeta || event.ctrlKey !== wantCtrl || event.altKey !== parsed.alt) return false;
  // Zoom in is written 'Mod+=' but people press Ctrl+Shift+= (that is, Ctrl++) just as often.
  const shiftFree = parsed.key === '=' || parsed.key === '+';
  if (!shiftFree && event.shiftKey !== parsed.shift) return false;
  const codes = codesFor(parsed.key);
  if (event.code && codes.includes(event.code)) return true;
  // Layout-independent keys (letters, digits) match only by code when a code is known.
  if (event.code && /^[A-Z0-9]$/.test(parsed.key) && /^(Key|Digit|Numpad)/.test(event.code)) return false;
  return keysFor(parsed.key).includes(event.key);
}

const MAC_SYMBOLS: Record<string, string> = { mod: '⌘', ctrl: '⌃', shift: '⇧', alt: '⌥' };
const KEY_NAMES: Record<string, { mac: string; other: string }> = {
  Delete: { mac: '⌫', other: 'Del' },
  Escape: { mac: 'Esc', other: 'Esc' },
  Enter: { mac: '↩', other: 'Enter' },
};

/** The shortcut as people read it: 'Ctrl+Shift+Z' on Linux and Windows, '⇧⌘Z' on macOS. */
export function formatShortcut(shortcut: string, platform: Platform = detectPlatform()): string {
  return shortcutKeys(shortcut, platform).join(platform === 'mac' ? '' : '+');
}

/** The separate key caps of a shortcut, for drawing each with <Kbd>. */
export function shortcutKeys(shortcut: string, platform: Platform = detectPlatform()): string[] {
  const parsed = parseShortcut(shortcut);
  const key = KEY_NAMES[parsed.key]?.[platform] ?? parsed.key;
  if (platform === 'mac') {
    // macOS order: ⌃ ⌥ ⇧ ⌘ then the key.
    const caps: string[] = [];
    if (parsed.ctrl) caps.push(MAC_SYMBOLS.ctrl);
    if (parsed.alt) caps.push(MAC_SYMBOLS.alt);
    if (parsed.shift) caps.push(MAC_SYMBOLS.shift);
    if (parsed.mod) caps.push(MAC_SYMBOLS.mod);
    return [...caps, key];
  }
  const caps: string[] = [];
  if (parsed.mod || parsed.ctrl) caps.push('Ctrl');
  if (parsed.alt) caps.push('Alt');
  if (parsed.shift) caps.push('Shift');
  return [...caps, key];
}
