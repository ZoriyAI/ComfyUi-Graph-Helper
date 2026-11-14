import { afterEach, describe, expect, it } from 'vitest';
import { chordFromEvent, layoutToken, matchesShortcut, noteLayout, resetLayout, type KeyLike } from '../../src/renderer/commands/shortcuts';
import { commandForKey, type FocusContext } from '../../src/renderer/commands/hotkeys';
import type { Command } from '../../src/renderer/commands/registry';

/** A press with Ctrl held (Linux and Windows), as Chromium reports it on the given layout. */
function ctrl(key: string, code: string, extra: Partial<KeyLike> = {}): KeyLike {
  return { key, code, ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, ...extra };
}

const canvas: FocusContext = { editable: false, layerOpen: false };

/** The app's shortcuts that layouts can confuse, in registry order. */
function commands(): Command[] {
  const make = (id: string, shortcut: string): Command => ({ id, group: 'edit', labelKey: id, shortcut, enabled: () => true, run: () => undefined } as unknown as Command);
  return [
    make('file.quit', 'Mod+Q'),
    make('edit.undo', 'Mod+Z'),
    make('edit.redo', 'Mod+Shift+Z'),
    make('edit.selectAll', 'Mod+A'),
    make('view.zoomIn', 'Mod+='),
    make('view.zoomOut', 'Mod+-'),
    make('view.zoomReset', 'Mod+0'),
    make('help.shortcuts', 'Mod+/'),
    make('file.settings', 'Mod+,'),
    make('graph.layout', 'Mod+Shift+L'),
  ];
}

function commandFor(event: KeyLike): string | null {
  return commandForKey(event, canvas, commands(), 'other')?.id ?? null;
}

afterEach(() => resetLayout());

describe('shortcuts on French AZERTY', () => {
  it('Ctrl+A selects all and never quits; Ctrl+Z undoes; Ctrl+Q quits', () => {
    // AZERTY swaps A/Q and Z/W: the key marked A sits where US has Q.
    expect(commandFor(ctrl('a', 'KeyQ'))).toBe('edit.selectAll');
    expect(commandFor(ctrl('z', 'KeyW'))).toBe('edit.undo');
    expect(commandFor(ctrl('Z', 'KeyW', { shiftKey: true }))).toBe('edit.redo');
    expect(commandFor(ctrl('q', 'KeyA'))).toBe('file.quit');
    // The key in US Z's place types W on AZERTY: nothing.
    expect(commandFor(ctrl('w', 'KeyZ'))).toBeNull();
  });

  it('digits typed with Shift on AZERTY still count by their place', () => {
    // Ctrl+0 on AZERTY: the key types «à» without Shift.
    expect(commandFor(ctrl('à', 'Digit0'))).toBe('view.zoomReset');
    // «-» sits on the 6 key: zoom out, not a digit.
    expect(commandFor(ctrl('-', 'Digit6'))).toBe('view.zoomOut');
    // «,» sits where US has M.
    expect(commandFor(ctrl(',', 'KeyM'))).toBe('file.settings');
  });
});

describe('shortcuts on German QWERTZ', () => {
  it('Ctrl+Z undoes and Ctrl+Y does nothing', () => {
    expect(commandFor(ctrl('z', 'KeyY'))).toBe('edit.undo');
    expect(commandFor(ctrl('y', 'KeyZ'))).toBeNull();
  });

  it('signs work where QWERTZ puts them, with the Shift they need', () => {
    // «-» sits in US «/»'s place: zoom out, never the shortcut list.
    expect(commandFor(ctrl('-', 'Slash'))).toBe('view.zoomOut');
    // «/» is Shift+7.
    expect(commandFor(ctrl('/', 'Digit7', { shiftKey: true }))).toBe('help.shortcuts');
    // «+» has its own key in US «]»'s place: zoom in.
    expect(commandFor(ctrl('+', 'BracketRight'))).toBe('view.zoomIn');
  });
});

describe('shortcuts on Dvorak', () => {
  it('a shortcut is the key marked with its letter', () => {
    expect(commandFor(ctrl('z', 'Slash'))).toBe('edit.undo');
    expect(commandFor(ctrl('a', 'KeyA'))).toBe('edit.selectAll');
    expect(commandFor(ctrl('q', 'KeyX'))).toBe('file.quit');
    // Dvorak «'» sits where US has Q: not Quit.
    expect(commandFor(ctrl("'", 'KeyQ'))).toBeNull();
    expect(commandFor(ctrl(',', 'KeyW'))).toBe('file.settings');
  });
});

describe('shortcuts on the Russian layout (keys in their US places)', () => {
  it('letters work by place', () => {
    expect(commandFor(ctrl('я', 'KeyZ'))).toBe('edit.undo');
    expect(commandFor(ctrl('Я', 'KeyZ', { shiftKey: true }))).toBe('edit.redo');
    expect(commandFor(ctrl('ф', 'KeyA'))).toBe('edit.selectAll');
    expect(commandFor(ctrl('й', 'KeyQ'))).toBe('file.quit');
    expect(commandFor(ctrl('Д', 'KeyL', { shiftKey: true }))).toBe('graph.layout');
  });

  it('signs work by place, also where the Russian key types a Latin sign', () => {
    expect(commandFor(ctrl('б', 'Comma'))).toBe('file.settings');
    // The US «/» key types «.» on the Russian layout: once the keyboard has typed a Russian letter, it is «/».
    noteLayout({ key: 'ы', code: 'KeyS' });
    expect(commandFor(ctrl('.', 'Slash'))).toBe('help.shortcuts');
    expect(commandFor(ctrl('-', 'Minus'))).toBe('view.zoomOut');
    expect(commandFor(ctrl('=', 'Equal'))).toBe('view.zoomIn');
    // Back on a Latin layout, «.» is a full stop again.
    noteLayout({ key: 's', code: 'KeyS' });
    expect(commandFor(ctrl('.', 'Slash'))).toBeNull();
  });

  it('records the key by place, so a recorded shortcut works on both layouts', () => {
    const russian = ctrl('ы', 'KeyS', { shiftKey: true });
    expect(chordFromEvent(russian, 'other')).toBe('Mod+Shift+S');
    expect(matchesShortcut(ctrl('S', 'KeyS', { shiftKey: true }), 'Mod+Shift+S', 'other')).toBe(true);
  });
});

describe('recording a shortcut on a Latin layout', () => {
  it('records the letter the key types', () => {
    expect(chordFromEvent(ctrl('a', 'KeyQ'), 'other')).toBe('Mod+A');
    expect(chordFromEvent(ctrl('z', 'KeyY'), 'other')).toBe('Mod+Z');
    expect(chordFromEvent(ctrl('-', 'Slash'), 'other')).toBe('Mod+-');
    expect(chordFromEvent(ctrl('+', 'NumpadAdd'), 'other')).toBe('Mod+=');
  });

  it('reads named keys and the space bar', () => {
    expect(layoutToken({ key: 'Delete', code: 'Delete', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false })).toBe('Delete');
    expect(layoutToken({ key: ' ', code: 'Space', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false })).toBe('Space');
    expect(layoutToken({ key: 'Unidentified', code: 'KeyK', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })).toBe('K');
  });
});

describe('what the Shortcuts section says to press on this layout', () => {
  const us = new Map([['KeyQ', 'q'], ['KeyZ', 'z'], ['Slash', '/'], ['Comma', ','], ['Equal', '='], ['Minus', '-']]);
  const qwertz = new Map([['KeyQ', 'q'], ['KeyZ', 'y'], ['KeyY', 'z'], ['Slash', '-'], ['Comma', ','], ['BracketRight', '+'], ['Digit7', '7']]);
  const russian = new Map([['KeyQ', 'й'], ['KeyZ', 'я'], ['Slash', '.'], ['Comma', 'б'], ['Equal', '='], ['Minus', '-']]);

  it('says nothing where the key is marked with the shortcut', () => {
    // Imported here so the module under test is the same one the section uses.
    return import('../../src/renderer/commands/shortcuts').then(({ localKeyFor }) => {
      expect(localKeyFor('Mod+Z', us)).toBeNull();
      expect(localKeyFor('Mod+/', us)).toBeNull();
      expect(localKeyFor('Mod+Z', qwertz)).toBeNull();
      expect(localKeyFor('Mod+=', qwertz)).toBeNull();
      expect(localKeyFor('Mod+Z', null)).toBeNull();
      expect(localKeyFor('F1', russian)).toBeNull();
    });
  });

  it('names the local key on a non-Latin layout and Shift where a sign needs it', async () => {
    const { localKeyFor } = await import('../../src/renderer/commands/shortcuts');
    expect(localKeyFor('Mod+Z', russian)).toEqual({ kind: 'key', key: 'я' });
    expect(localKeyFor('Mod+,', russian)).toEqual({ kind: 'key', key: 'б' });
    expect(localKeyFor('Mod+/', russian)).toEqual({ kind: 'key', key: '.' });
    expect(localKeyFor('Mod+-', russian)).toBeNull();
    expect(localKeyFor('Mod+/', qwertz)).toEqual({ kind: 'shift' });
  });
});
