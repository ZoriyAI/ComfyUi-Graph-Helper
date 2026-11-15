/**
 * Protects the renderer command system (commands/registry, shortcuts and hotkeys): commands register and unregister
 * cleanly, a disabled one never runs, shortcuts parse and show the way each platform writes them, letters match by
 * physical key on a Russian layout, and only the global shortcuts fire while a field or dialog has focus. A person
 * typing a prompt must not trigger Delete or Select all on the canvas by accident.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addCommandStateSource,
  allCommands,
  getCommand,
  isChecked,
  isEnabled,
  registerCommands,
  runCommand,
  type Command,
} from '../../src/renderer/commands/registry';
import { formatShortcut, matchesShortcut, parseShortcut, shortcutKeys, detectPlatform, type KeyLike } from '../../src/renderer/commands/shortcuts';
import { commandForKey, GLOBAL_SHORTCUTS, shortcutAllowed, type FocusContext } from '../../src/renderer/commands/hotkeys';

/** A key event with no modifiers unless the test sets them. */
function key(partial: Partial<KeyLike> & { key: string }): KeyLike {
  return { code: undefined, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...partial };
}

// Where focus can be: the canvas, a text field, or an open dialog or menu.
const canvas: FocusContext = { editable: false, layerOpen: false };
const field: FocusContext = { editable: true, layerOpen: false };
const dialog: FocusContext = { editable: false, layerOpen: true };

let cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups) cleanup();
  cleanups = [];
});

/** Registers commands for one test; afterEach removes them again. */
function register(list: Command[]) {
  cleanups.push(registerCommands(list));
}

describe('command registry', () => {
  it('wires enabled, checked and run, and refuses to run a disabled command', async () => {
    let on = true;
    let pressed = false;
    const run = vi.fn(() => {
      pressed = !pressed;
    });
    register([
      { id: 't.toggle', group: 'view', labelKey: 'menu.minimap', enabled: () => on, checked: () => pressed, run },
      { id: 't.plain', group: 'file', labelKey: 'menu.quit', enabled: () => true, run: () => undefined },
    ]);
    expect(isEnabled('t.toggle')).toBe(true);
    expect(isChecked('t.toggle')).toBe(false);
    expect(isChecked('t.plain')).toBeUndefined();
    expect(await runCommand('t.toggle')).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(isChecked('t.toggle')).toBe(true);
    on = false;
    expect(isEnabled('t.toggle')).toBe(false);
    expect(await runCommand('t.toggle')).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
    expect(await runCommand('t.missing')).toBe(false);
  });

  it('treats a throwing enabled() as off and awaits async commands', async () => {
    const order: string[] = [];
    register([
      { id: 't.broken', group: 'edit', labelKey: 'menu.selectAll', enabled: () => { throw new Error('no store'); }, run: () => undefined },
      {
        id: 't.async', group: 'file', labelKey: 'menu.newProject', enabled: () => true,
        run: async () => {
          await Promise.resolve();
          order.push('ran');
        },
      },
    ]);
    expect(isEnabled('t.broken')).toBe(false);
    await runCommand('t.async');
    expect(order).toEqual(['ran']);
  });

  it('unregisters exactly the commands it added, keeping a later replacement', () => {
    const first: Command = { id: 't.same', group: 'help', labelKey: 'menu.about', enabled: () => true, run: () => undefined };
    const off = registerCommands([first]);
    const second: Command = { ...first, labelKey: 'menu.shortcuts' };
    register([second]);
    off();
    expect(getCommand('t.same')?.labelKey).toBe('menu.shortcuts');
    expect(allCommands().some((command) => command.id === 't.same')).toBe(true);
  });

  it('subscribes a state source once, at once, and unsubscribes it', () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.fn((listener: () => void) => {
      expect(typeof listener).toBe('function');
      return unsubscribe;
    });
    const off = addCommandStateSource(subscribe);
    expect(subscribe).toHaveBeenCalledTimes(1);
    off();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('shortcut parsing and labels', () => {
  it('parses modifiers and keys', () => {
    expect(parseShortcut('Mod+Shift+Z')).toEqual({ mod: true, ctrl: false, shift: true, alt: false, key: 'Z' });
    expect(parseShortcut('Mod+=')).toMatchObject({ mod: true, key: '=' });
    expect(parseShortcut('Mod+-')).toMatchObject({ mod: true, key: '-' });
    expect(parseShortcut('Mod+,')).toMatchObject({ mod: true, key: ',' });
    expect(parseShortcut('F1')).toEqual({ mod: false, ctrl: false, shift: false, alt: false, key: 'F1' });
    expect(parseShortcut('Mod+s').key).toBe('S');
  });

  it('labels shortcuts for Linux and Windows', () => {
    expect(formatShortcut('Mod+S', 'other')).toBe('Ctrl+S');
    expect(formatShortcut('Mod+Shift+Z', 'other')).toBe('Ctrl+Shift+Z');
    expect(formatShortcut('Delete', 'other')).toBe('Del');
    expect(formatShortcut('Escape', 'other')).toBe('Esc');
    expect(shortcutKeys('Mod+Shift+C', 'other')).toEqual(['Ctrl', 'Shift', 'C']);
  });

  it('labels shortcuts for macOS with symbols in the system order', () => {
    expect(formatShortcut('Mod+S', 'mac')).toBe('⌘S');
    expect(formatShortcut('Mod+Shift+Z', 'mac')).toBe('⇧⌘Z');
    expect(formatShortcut('Delete', 'mac')).toBe('⌫');
    expect(shortcutKeys('Mod+Alt+K', 'mac')).toEqual(['⌥', '⌘', 'K']);
  });

  it('detects the platform', () => {
    expect(detectPlatform('MacIntel Mozilla/5.0 (Macintosh)')).toBe('mac');
    expect(detectPlatform('Linux x86_64')).toBe('other');
    expect(detectPlatform('Win32')).toBe('other');
  });
});

describe('shortcut matching', () => {
  it('maps Mod to Ctrl off macOS and to ⌘ on macOS', () => {
    expect(matchesShortcut(key({ key: 's', code: 'KeyS', ctrlKey: true }), 'Mod+S', 'other')).toBe(true);
    expect(matchesShortcut(key({ key: 's', code: 'KeyS', metaKey: true }), 'Mod+S', 'other')).toBe(false);
    expect(matchesShortcut(key({ key: 's', code: 'KeyS', metaKey: true }), 'Mod+S', 'mac')).toBe(true);
    expect(matchesShortcut(key({ key: 's', code: 'KeyS', ctrlKey: true }), 'Mod+S', 'mac')).toBe(false);
  });

  it('requires the exact modifier set', () => {
    expect(matchesShortcut(key({ key: 'Z', code: 'KeyZ', ctrlKey: true, shiftKey: true }), 'Mod+Z', 'other')).toBe(false);
    expect(matchesShortcut(key({ key: 'Z', code: 'KeyZ', ctrlKey: true, shiftKey: true }), 'Mod+Shift+Z', 'other')).toBe(true);
    expect(matchesShortcut(key({ key: 'z', code: 'KeyZ', ctrlKey: true }), 'Mod+Shift+Z', 'other')).toBe(false);
    expect(matchesShortcut(key({ key: 'i', code: 'KeyI', ctrlKey: true, altKey: true }), 'Mod+I', 'other')).toBe(false);
    expect(matchesShortcut(key({ key: 'i', code: 'KeyI' }), 'Mod+I', 'other')).toBe(false);
  });

  it('matches letters by physical key on a Russian layout', () => {
    expect(matchesShortcut(key({ key: 'ы', code: 'KeyS', ctrlKey: true }), 'Mod+S', 'other')).toBe(true);
    expect(matchesShortcut(key({ key: 'ш', code: 'KeyI', ctrlKey: true }), 'Mod+S', 'other')).toBe(false);
  });

  it('matches zoom keys with or without Shift, and the numpad', () => {
    expect(matchesShortcut(key({ key: '=', code: 'Equal', ctrlKey: true }), 'Mod+=', 'other')).toBe(true);
    expect(matchesShortcut(key({ key: '+', code: 'Equal', ctrlKey: true, shiftKey: true }), 'Mod+=', 'other')).toBe(true);
    expect(matchesShortcut(key({ key: '+', code: 'NumpadAdd', ctrlKey: true }), 'Mod+=', 'other')).toBe(true);
    expect(matchesShortcut(key({ key: '-', code: 'Minus', ctrlKey: true }), 'Mod+-', 'other')).toBe(true);
    expect(matchesShortcut(key({ key: '0', code: 'Digit0', ctrlKey: true }), 'Mod+0', 'other')).toBe(true);
    expect(matchesShortcut(key({ key: '/', code: 'Slash', ctrlKey: true }), 'Mod+/', 'other')).toBe(true);
  });

  it('matches named keys', () => {
    expect(matchesShortcut(key({ key: 'F1', code: 'F1' }), 'F1', 'other')).toBe(true);
    expect(matchesShortcut(key({ key: 'F1', code: 'F1', shiftKey: true }), 'F1', 'other')).toBe(false);
    expect(matchesShortcut(key({ key: 'Escape', code: 'Escape' }), 'Escape', 'other')).toBe(true);
    expect(matchesShortcut(key({ key: 'Delete', code: 'Delete' }), 'Delete', 'other')).toBe(true);
  });
});

describe('hotkey focus rules', () => {
  const ran: string[] = [];
  const make = (id: string, shortcut: string, extra: Partial<Command> = {}): Command => ({
    id, group: 'file', labelKey: 'menu.quit', shortcut, enabled: () => true, run: () => void ran.push(id), ...extra,
  });
  const commands = [
    make('save', 'Mod+S'),
    make('selectAll', 'Mod+A'),
    make('check', 'Mod+Shift+C'),
    make('stop', 'Escape'),
    make('help', 'F1'),
    make('delete', 'Delete', { shortcutDisplayOnly: true }),
    make('off', 'Mod+Z', { enabled: () => false }),
  ];

  it('keeps the global shortcuts working in fields and dialogs', () => {
    for (const shortcut of ['Mod+S', 'Mod+O', 'Mod+N', 'Mod+Shift+C']) {
      expect(GLOBAL_SHORTCUTS.has(shortcut)).toBe(true);
      expect(shortcutAllowed(shortcut, field)).toBe(true);
      expect(shortcutAllowed(shortcut, dialog)).toBe(true);
    }
  });

  it('leaves other shortcuts to fields and open menus or dialogs', () => {
    expect(shortcutAllowed('Mod+A', canvas)).toBe(true);
    expect(shortcutAllowed('Mod+A', field)).toBe(false);
    expect(shortcutAllowed('Mod+A', dialog)).toBe(false);
    // F1 (the shortcuts window) is help: it also works while typing, but not over an open dialog.
    expect(shortcutAllowed('F1', field)).toBe(true);
    expect(shortcutAllowed('F1', dialog)).toBe(false);
    // Escape belongs to the open layer (Radix closes it) and to the field.
    expect(shortcutAllowed('Escape', canvas)).toBe(true);
    expect(shortcutAllowed('Escape', dialog)).toBe(false);
    expect(shortcutAllowed('Escape', field)).toBe(false);
  });

  it('finds the enabled command for a key in context', () => {
    const ctrl = (letter: string, extra: Partial<KeyLike> = {}) => key({ key: letter.toLowerCase(), code: `Key${letter}`, ctrlKey: true, ...extra });
    expect(commandForKey(ctrl('S'), field, commands, 'other')?.id).toBe('save');
    expect(commandForKey(ctrl('A'), canvas, commands, 'other')?.id).toBe('selectAll');
    expect(commandForKey(ctrl('A'), field, commands, 'other')).toBeNull();
    expect(commandForKey(ctrl('C', { shiftKey: true }), dialog, commands, 'other')?.id).toBe('check');
    expect(commandForKey(ctrl('C'), canvas, commands, 'other')).toBeNull();
    expect(commandForKey(key({ key: 'F1', code: 'F1' }), canvas, commands, 'other')?.id).toBe('help');
    expect(commandForKey(key({ key: 'Escape', code: 'Escape' }), canvas, commands, 'other')?.id).toBe('stop');
    // React Flow owns Delete on the canvas; the command only shows the key.
    expect(commandForKey(key({ key: 'Delete', code: 'Delete' }), canvas, commands, 'other')).toBeNull();
    // A disabled command swallows nothing.
    expect(commandForKey(ctrl('Z'), canvas, commands, 'other')).toBeNull();
  });
});
