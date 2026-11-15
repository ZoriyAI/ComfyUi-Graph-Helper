/**
 * Keyboard shortcuts as strings ('Mod+S', 'Mod+Shift+Z', 'F1', 'Delete'). `Mod` is Ctrl on Linux and
 * Windows and ⌘ on macOS. On a Latin layout a shortcut is the key marked with its letter or sign (AZERTY's Ctrl+A
 * is the key marked A); on a non-Latin layout it is the key in the same place as on a US keyboard, so Ctrl+S works
 * on a Russian layout where that key types a Cyrillic letter. See layoutToken.
 *
 * Who uses it: commands/hotkeys.ts (matching key presses), ui/Shortcut.tsx (drawing key caps) and
 * components/settings/sections/ShortcutsSection.tsx (recording a shortcut and naming the local key).
 */

/** The two ways shortcuts are written and drawn: macOS, and everything else. */
export type Platform = 'mac' | 'other';

/** A shortcut string split into its modifiers and its key. */
export interface ParsedShortcut {
  mod: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  /** The key token as written: 'S', '0', '=', '/', 'F1', 'Delete', 'Escape', ','. */
  key: string;
}

/** The parts of a keyboard event the matching reads (a real KeyboardEvent fits; tests pass plain objects). */
export interface KeyLike {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** macOS or not, from the browser's platform and user agent (or from `source` in tests). */
export function detectPlatform(source?: string): Platform {
  const text = source ?? (typeof navigator === 'undefined' ? '' : `${navigator.platform} ${navigator.userAgent}`);
  return /Mac|iPhone|iPad/i.test(text) ? 'mac' : 'other';
}

/** Splits 'Mod+Shift+Z' into modifiers and key; a single-character key is upper-cased. */
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

/** The physical key a US layout prints each sign on: the fallback for a layout whose own sign is not Latin. */
const CODE_KEYS: Record<string, string> = {
  Equal: '=', Minus: '-', Slash: '/', Comma: ',', Period: '.', Semicolon: ';', Quote: "'", Backquote: '`',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', NumpadAdd: '=', NumpadSubtract: '-', NumpadDivide: '/',
};
/** Signs a shortcut can be written with. A key whose value is one of these means that sign on any layout. */
const SIGNS = new Set(['=', '+', '-', '/', ',', '.', ';', "'", '`', '[', ']', '\\']);

/**
 * Which kind of letters the keyboard types now. Latin layouts (QWERTY, AZERTY, QWERTZ, Dvorak) are matched by the
 * letter or sign a key types, so Ctrl+Z is the key marked Z wherever it sits. A non-Latin layout (Russian, Greek,
 * Hebrew…) types no Latin letters, so its keys are matched by their place on a US keyboard: Ctrl+Z is the key that
 * types a Cyrillic letter there. The keyboard says which it is with every letter typed (noteLayout); before any
 * letter, Latin is assumed.
 */
let latinLayout = true;

/** Learns the layout from one key press: a letter key that types a Latin letter, or another letter. */
export function noteLayout(event: Pick<KeyLike, 'key' | 'code'>): void {
  if (!event.code || !/^Key[A-Z]$/.test(event.code) || typeof event.key !== 'string' || [...event.key].length !== 1) return;
  if (/^[a-z]$/i.test(event.key)) latinLayout = true;
  else if (/\p{L}/u.test(event.key)) latinLayout = false;
}

/** Whether the last letter typed was Latin. */
export function layoutIsLatin(): boolean {
  return latinLayout;
}

/** For tests: forget what the keyboard said. */
export function resetLayout(latin = true): void {
  latinLayout = latin;
}

/** One character outside ASCII (a Cyrillic or Greek letter, for example). */
function nonLatinChar(key: string): boolean {
  return [...key].length === 1 && /[^\u0000-\u007f]/.test(key);
}

/**
 * The key a press means on the person's own layout, as a shortcut token ('Z', '0', '/', 'Delete'), or null.
 * - Letters: the Latin letter typed; on a non-Latin layout, the letter of the same place on a US keyboard.
 * - Digits: the digit typed, or the digit of the key's place (AZERTY types digits only with Shift).
 * - Signs: the sign typed (QWERTZ types / with Shift+7); on a non-Latin layout, the sign of the key's place on a US
 *   keyboard (the Russian layout types a Cyrillic letter where US has «,» and «.» where US has «/»).
 */
export function layoutToken(event: KeyLike, latin: boolean = latinLayout): string | null {
  const key = event.key ?? '';
  const code = event.code ?? '';
  if (/^[a-z]$/i.test(key)) return key.toUpperCase();
  if (/^[0-9]$/.test(key)) return key;
  const place = /^Key[A-Z]$/.test(code) ? code.slice(3)
    : /^(Digit|Numpad)[0-9]$/.test(code) ? code.slice(-1)
      : CODE_KEYS[code] ?? null;
  if (SIGNS.has(key) && (latin || !place || /^[0-9]$/.test(place))) return key;
  if (place && /^[0-9]$/.test(place)) return place;
  if (place && (nonLatinChar(key) || key === '' || key === 'Unidentified' || (!latin && SIGNS.has(key)))) return place;
  if (key === ' ') return 'Space';
  return key.length > 1 ? key : null;
}

/** Key values that also count (the shifted '=' is '+', the numpad's '+'). */
function tokensFor(key: string): string[] {
  if (key === '=' || key === '+') return ['=', '+'];
  if (key === 'Escape') return ['Escape', 'Esc'];
  return [key];
}

/** True when the key event is this shortcut on this platform and keyboard layout, with no extra modifiers held. */
export function matchesShortcut(event: KeyLike, shortcut: string, platform: Platform = detectPlatform(), latin: boolean = latinLayout): boolean {
  const parsed = parseShortcut(shortcut);
  const wantMeta = parsed.mod && platform === 'mac';
  const wantCtrl = parsed.ctrl || (parsed.mod && platform !== 'mac');
  if (event.metaKey !== wantMeta || event.ctrlKey !== wantCtrl || event.altKey !== parsed.alt) return false;
  const token = layoutToken(event, latin);
  if (token === null || !tokensFor(parsed.key).includes(token)) return false;
  // A sign may need Shift to be typed at all on this layout (QWERTZ: / is Shift+7, zoom in is Ctrl++), so Shift is
  // free for signs unless the shortcut itself asks for it. Letters, digits and named keys must match Shift exactly.
  if (SIGNS.has(parsed.key) && !parsed.shift) return true;
  return event.shiftKey === parsed.shift;
}

/** macOS key-cap symbols for the modifiers, and short names of a few keys on each platform. */
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

/** Keys without a letter that may be recorded as a shortcut; and keys that are only modifiers. */
const NAMED_KEYS = new Set([
  'Delete', 'Backspace', 'Enter', 'Escape', 'Tab', 'Home', 'End', 'PageUp', 'PageDown', 'Insert',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);
const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'OS', 'Hyper', 'Super', 'CapsLock', 'Fn']);

/**
 * The shortcut string a key press records (Preferences ▸ Shortcuts), or null for a lone modifier or a key
 * that cannot be a shortcut. Keys are read as layoutToken reads them, so AZERTY records the letter it types and
 * a Russian layout records 'Mod+S' for the key in the US place of S.
 * Ctrl on Linux and Windows (⌘ on macOS) becomes `Mod`.
 */
export function chordFromEvent(event: KeyLike, platform: Platform = detectPlatform()): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null;
  let key: string | null = null;
  const token = layoutToken(event);
  if (token && (/^[A-Z0-9]$/.test(token) || SIGNS.has(token))) key = token === '+' ? '=' : token;
  else if (/^F([1-9]|1[0-2])$/.test(event.key)) key = event.key;
  else if (NAMED_KEYS.has(event.key)) key = event.key;
  else if (event.key === ' ' || event.code === 'Space') key = 'Space';
  else if (/^[a-z0-9]$/i.test(event.key)) key = event.key.toUpperCase();
  if (!key) return null;
  const parts: string[] = [];
  const mod = platform === 'mac' ? event.metaKey : event.ctrlKey;
  const ctrl = platform === 'mac' && event.ctrlKey;
  if (mod) parts.push('Mod');
  if (ctrl) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  parts.push(key);
  return parts.join('+');
}

/** Two shortcuts are the same chord: same modifiers, same key (order and case do not matter). */
export function sameChord(left: string, right: string): boolean {
  if (!left || !right) return false;
  const a = parseShortcut(left);
  const b = parseShortcut(right);
  const key = (value: string) => (value === '+' ? '=' : value);
  return a.mod === b.mod && a.ctrl === b.ctrl && a.shift === b.shift && a.alt === b.alt && key(a.key) === key(b.key);
}

/** A layout map as Chromium gives it (navigator.keyboard.getLayoutMap()): physical code → what the key types. */
export type LayoutMap = ReadonlyMap<string, string>;

/** The US place of each sign, for finding which key of a non-Latin layout stands there. */
const SIGN_CODES: Record<string, string> = {
  '=': 'Equal', '+': 'Equal', '-': 'Minus', '/': 'Slash', ',': 'Comma', '.': 'Period', ';': 'Semicolon', "'": 'Quote',
  '`': 'Backquote', '[': 'BracketLeft', ']': 'BracketRight', '\\': 'Backslash',
};

/**
 * What to press for a shortcut's key on this layout, when it is not simply the key marked with it:
 * - { kind: 'local', glyph }: a non-Latin layout, where the shortcut is the key in the US place (Ctrl+Z is the key
 *   that types a Cyrillic letter on a Russian layout), and `glyph` is what that key types;
 * - { kind: 'shift' }: a Latin layout that types the sign only with Shift or AltGr (QWERTZ's «/»);
 * - null: press the key marked with it, or the layout is not known.
 */
export function localKeyFor(shortcut: string, layout: LayoutMap | null | undefined): { kind: 'local'; glyph: string } | { kind: 'shift' } | null {
  if (!layout || layout.size === 0) return null;
  const key = parseShortcut(shortcut).key;
  // The Q key tells the layout's script: a Latin letter there (or no answer) means a Latin layout.
  const q = layout.get('KeyQ') ?? '';
  const latin = q === '' || /^[a-z]$/i.test(q);
  if (/^[A-Z]$/.test(key)) {
    if (latin) return null;
    const local = layout.get(`Key${key}`);
    return local && local.toLowerCase() !== key.toLowerCase() ? { kind: 'local', glyph: local } : null;
  }
  const code = SIGN_CODES[key];
  if (!code) return null;
  if (!latin) {
    const local = layout.get(code);
    return local && local !== key ? { kind: 'local', glyph: local } : null;
  }
  const typed = new Set(layout.values());
  if (typed.has(key) || (key === '=' && typed.has('+'))) return null;
  return { kind: 'shift' };
}

/** The current layout map, or null where the browser has none (tests, older engines). */
export async function readLayoutMap(): Promise<LayoutMap | null> {
  const keyboard = (globalThis as { navigator?: { keyboard?: { getLayoutMap?: () => Promise<LayoutMap> } } }).navigator?.keyboard;
  if (!keyboard?.getLayoutMap) return null;
  try {
    return await keyboard.getLayoutMap();
  } catch {
    return null;
  }
}

