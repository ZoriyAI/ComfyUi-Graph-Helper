/**
 * Checks that two commands sharing one keyboard chord both work: when the first match is disabled or not allowed in
 * the current focus, the key goes to the next command with that chord instead of doing nothing.
 */
import { describe, expect, it } from 'vitest';
import { commandForKey, type FocusContext } from '../../src/renderer/commands/hotkeys';
import type { Command } from '../../src/renderer/commands/registry';

const canvas: FocusContext = { editable: false, layerOpen: false };
const field: FocusContext = { editable: true, layerOpen: false };
const ctrlK = { key: 'k', code: 'KeyK', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false };

/** A command with the given chord and enabled state. */
function command(id: string, enabled: boolean, shortcut = 'Mod+K'): Command {
  return { id, labelKey: id, group: 'edit', shortcut, enabled: () => enabled, run: () => undefined };
}

describe('two commands on one chord', () => {
  it('skips a disabled first match and takes the next enabled one', () => {
    expect(commandForKey(ctrlK, canvas, [command('first', false), command('second', true)], 'other')?.id).toBe('second');
    expect(commandForKey(ctrlK, canvas, [command('first', true), command('second', true)], 'other')?.id).toBe('first');
    expect(commandForKey(ctrlK, canvas, [command('first', false), command('second', false)], 'other')).toBeNull();
  });

  it('does the same for a shortcut that also works while typing, and runs nothing not allowed there', () => {
    expect(commandForKey(ctrlK, field, [command('canvasOnly', true), command('alsoCanvasOnly', true)], 'other')).toBeNull();
    const save = { key: 's', code: 'KeyS', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false };
    expect(commandForKey(save, field, [command('a', false, 'Mod+S'), command('b', true, 'Mod+S')], 'other')?.id).toBe('b');
  });
});
