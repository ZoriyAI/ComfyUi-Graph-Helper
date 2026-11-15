import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  allCommands,
  defaultShortcutOf,
  getCommand,
  registerCommands,
  setShortcutOverrides,
  shortcutOverrides,
  type Command,
} from '../../src/renderer/commands/registry';
import { chordFromEvent, matchesShortcut, sameChord, type KeyLike } from '../../src/renderer/commands/shortcuts';
import { commandForKey, type FocusContext } from '../../src/renderer/commands/hotkeys';
import { LEGACY_CANVAS_KEYS, legacyCanvasPatch, migrateLegacyCanvas } from '../../src/renderer/state/preferencesBridge';
import { stepDelayMs } from '../../src/renderer/components/graph/lib/buildQueue';
import { shortcutConflicts } from '../../src/renderer/components/settings/sections/ShortcutsSection';
import { applyAppearance } from '../../src/renderer/state/preferencesState';

function key(partial: Partial<KeyLike> & { key: string }): KeyLike {
  return { code: undefined, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...partial };
}

const canvas: FocusContext = { editable: false, layerOpen: false };

let cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups) cleanup();
  cleanups = [];
  setShortcutOverrides({});
});

function register(list: Command[]) {
  cleanups.push(registerCommands(list));
}

describe('shortcut overrides (Preferences ▸ Shortcuts)', () => {
  it('replace a default for menus, the shortcuts list and the hotkeys', () => {
    const fit = vi.fn();
    const quit = vi.fn();
    register([
      { id: 't.fit', group: 'view', labelKey: 'contextMenu.fit', shortcut: 'Shift+1', enabled: () => true, run: fit },
      { id: 't.quit', group: 'file', labelKey: 'menu.quit', shortcut: 'Mod+Q', enabled: () => true, run: quit },
      { id: 't.delete', group: 'edit', labelKey: 'menu.deleteSelection', shortcut: 'Delete', shortcutDisplayOnly: true, enabled: () => true, run: () => undefined },
    ]);
    const shift1 = key({ key: '!', code: 'Digit1', shiftKey: true });
    const shift2 = key({ key: '@', code: 'Digit2', shiftKey: true });
    expect(commandForKey(shift1, canvas, allCommands(), 'other')?.id).toBe('t.fit');
    expect(commandForKey(shift2, canvas, allCommands(), 'other')).toBeNull();

    const before = getCommand('t.fit');
    setShortcutOverrides({ 't.fit': 'Shift+2', 't.quit': '' });
    expect(shortcutOverrides()).toEqual({ 't.fit': 'Shift+2', 't.quit': '' });
    const fitView = getCommand('t.fit');
    expect(fitView).toMatchObject({ shortcut: 'Shift+2', defaultShortcut: 'Shift+1' });
    // One identity per override set, so surfaces do not re-render for nothing.
    expect(getCommand('t.fit')).toBe(fitView);
    expect(fitView).not.toBe(before);
    expect(getCommand('t.quit')?.shortcut).toBeUndefined();
    expect(defaultShortcutOf('t.fit')).toBe('Shift+1');
    expect(allCommands().find((command) => command.id === 't.fit')?.shortcut).toBe('Shift+2');
    expect(commandForKey(shift2, canvas, allCommands(), 'other')?.id).toBe('t.fit');
    expect(commandForKey(shift1, canvas, allCommands(), 'other')).toBeNull();
    expect(commandForKey(key({ key: 'q', code: 'KeyQ', ctrlKey: true }), canvas, allCommands(), 'other')).toBeNull();

    // An override equal to the default is the default; an override of a display-only key makes it live.
    setShortcutOverrides({ 't.fit': 'Shift+1', 't.delete': 'Mod+Backspace' });
    expect(getCommand('t.fit')).toBe(before);
    expect(getCommand('t.delete')).toMatchObject({ shortcut: 'Mod+Backspace', shortcutDisplayOnly: false });
    setShortcutOverrides({});
    expect(getCommand('t.fit')?.shortcut).toBe('Shift+1');
  });

  it('records a chord from a key press, by physical key', () => {
    expect(chordFromEvent(key({ key: 'Shift', code: 'ShiftLeft', shiftKey: true }), 'other')).toBeNull();
    expect(chordFromEvent(key({ key: '@', code: 'Digit2', shiftKey: true }), 'other')).toBe('Shift+2');
    // Russian layout: the S key types «ы» but records as S.
    expect(chordFromEvent(key({ key: 'ы', code: 'KeyS', ctrlKey: true }), 'other')).toBe('Mod+S');
    expect(chordFromEvent(key({ key: 's', code: 'KeyS', metaKey: true }), 'mac')).toBe('Mod+S');
    expect(chordFromEvent(key({ key: 's', code: 'KeyS', ctrlKey: true }), 'mac')).toBe('Ctrl+S');
    expect(chordFromEvent(key({ key: 'F5', code: 'F5' }), 'other')).toBe('F5');
    expect(chordFromEvent(key({ key: '=', code: 'Equal', ctrlKey: true, altKey: true }), 'other')).toBe('Mod+Alt+=');
    expect(chordFromEvent(key({ key: 'Delete', code: 'Delete' }), 'other')).toBe('Delete');
    expect(chordFromEvent(key({ key: 'Dead', code: 'IntlBackslash' }), 'other')).toBeNull();
    // What is recorded matches the same press later.
    const press = key({ key: 'k', code: 'KeyK', ctrlKey: true, shiftKey: true });
    expect(matchesShortcut(press, chordFromEvent(press, 'other')!, 'other')).toBe(true);
    expect(sameChord('Mod+Shift+K', 'Shift+Mod+K')).toBe(true);
    expect(sameChord('Mod+K', 'Mod+Shift+K')).toBe(false);
    expect(sameChord('', 'Mod+K')).toBe(false);
  });

  it('marks both rows of a conflict', () => {
    expect(shortcutConflicts([
      { id: 'a', chord: 'Mod+K' },
      { id: 'b', chord: 'Mod+k' },
      { id: 'c', chord: 'Mod+J' },
      { id: 'd', chord: '' },
      { id: 'e', chord: '' },
    ])).toEqual({ a: ['b'], b: ['a'] });
  });
});

describe('canvas preferences', () => {
  function memoryStorage(initial: Record<string, string>) {
    const map = new Map(Object.entries(initial));
    return {
      map,
      getItem: (name: string) => map.get(name) ?? null,
      removeItem: (name: string) => { map.delete(name); },
    };
  }

  it('reads the old localStorage keys once, saves them, then deletes them', async () => {
    const storage = memoryStorage({ [LEGACY_CANVAS_KEYS.showDescriptions]: 'off', [LEGACY_CANVAS_KEYS.showMinimap]: 'on', other: 'kept' });
    expect(legacyCanvasPatch(storage)).toEqual({
      patch: { showDescriptions: false, showMinimap: true },
      keys: [LEGACY_CANVAS_KEYS.showDescriptions, LEGACY_CANVAS_KEYS.showMinimap],
    });
    const saved: unknown[] = [];
    expect(await migrateLegacyCanvas(storage, async (patch) => { saved.push(patch); return true; })).toBe(true);
    expect(saved).toEqual([{ canvas: { showDescriptions: false, showMinimap: true } }]);
    expect([...storage.map.keys()]).toEqual(['other']);
    // Nothing left: the second start does nothing.
    expect(await migrateLegacyCanvas(storage, async () => { throw new Error('not called'); })).toBe(false);
  });

  it('keeps the old keys when the save fails, and survives an unreadable store', async () => {
    const storage = memoryStorage({ [LEGACY_CANVAS_KEYS.showMinimap]: 'off' });
    expect(await migrateLegacyCanvas(storage, async () => false)).toBe(false);
    expect(storage.map.has(LEGACY_CANVAS_KEYS.showMinimap)).toBe(true);
    const broken = { getItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
    expect(legacyCanvasPatch(broken)).toEqual({ patch: {}, keys: [] });
    expect(legacyCanvasPatch(null)).toEqual({ patch: {}, keys: [] });
    // A garbage value is removed without changing preferences.
    const garbage = memoryStorage({ [LEGACY_CANVAS_KEYS.showDescriptions]: 'maybe' });
    expect(await migrateLegacyCanvas(garbage, async () => { throw new Error('not called'); })).toBe(true);
    expect(garbage.map.size).toBe(0);
  });

  it('paces a live build from the preference', () => {
    expect(stepDelayMs({ revealMs: 320, motion: 'full', follow: false, queued: 1 })).toBe(820);
    expect(stepDelayMs({ revealMs: 320, motion: 'full', follow: false, queued: 1, paceMs: 1640 })).toBe(1640);
    expect(stepDelayMs({ revealMs: 320, motion: 'full', follow: true, queued: 1, paceMs: 400 })).toBe(640);
    expect(stepDelayMs({ revealMs: 0, motion: 'reduced', follow: false, queued: 1, paceMs: 1640 })).toBe(1000);
    expect(stepDelayMs({ revealMs: 320, motion: 'off', follow: false, queued: 1, paceMs: 2000 })).toBe(0);
  });

  it('puts appearance on <html> attributes', () => {
    const dataset: Record<string, string> = {};
    const root = { dataset } as unknown as HTMLElement;
    applyAppearance({ accent: 'violet', density: 'compact', reduceGlow: true, interfaceScale: 100 }, root);
    expect(dataset).toEqual({ accent: 'violet', density: 'compact', glow: 'reduced' });
    applyAppearance({ accent: 'cyan', density: 'comfortable', reduceGlow: false, interfaceScale: 100 }, root);
    expect(dataset).toEqual({ accent: 'cyan', density: 'comfortable' });
  });
});
