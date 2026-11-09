import { describe, expect, it } from 'vitest';
import { buildAppCommands } from '../../src/renderer/commands/appCommands';
import { catalogLeaves, en, ru } from '../../src/shared/i18n';

describe('app commands', () => {
  const commands = buildAppCommands();
  const keys = new Set(catalogLeaves(en));
  const ruKeys = new Set(catalogLeaves(ru));

  it('have unique ids and unique shortcuts', () => {
    const ids = commands.map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);
    const shortcuts = commands.flatMap((command) => (command.shortcut ? [command.shortcut] : []));
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
  });

  it('label every command in both languages', () => {
    for (const command of commands) {
      expect(keys.has(command.labelKey), command.labelKey).toBe(true);
      expect(ruKeys.has(command.labelKey), command.labelKey).toBe(true);
      if (command.hintKey) expect(keys.has(command.hintKey), command.hintKey).toBe(true);
    }
  });

  it('cover the menus the brief asks for, with their default shortcuts', () => {
    const byId = new Map(commands.map((command) => [command.id, command]));
    const expected: Record<string, string> = {
      'file.new': 'Mod+N', 'file.open': 'Mod+O', 'file.save': 'Mod+S', 'file.import': 'Mod+I', 'file.export': 'Mod+E',
      'edit.undo': 'Mod+Z', 'edit.redo': 'Mod+Shift+Z', 'edit.selectAll': 'Mod+A', 'edit.delete': 'Delete',
      'graph.addNode': 'Mod+K', 'graph.createSubgraph': 'Mod+G', 'graph.check': 'Mod+Shift+C',
      'view.rail': 'Mod+B', 'view.dock': 'Mod+J', 'view.zoomReset': 'Mod+0', 'view.zoomIn': 'Mod+=', 'view.zoomOut': 'Mod+-',
      'assistant.focusChat': 'Mod+/', 'help.shortcuts': 'F1', 'view.stopExplaining': 'Escape',
    };
    for (const [id, shortcut] of Object.entries(expected)) expect(byId.get(id)?.shortcut, id).toBe(shortcut);
    for (const id of ['file.catalog', 'graph.dissolveSubgraph', 'graph.addGroup', 'view.fit', 'view.showBoth', 'view.descriptions',
      'view.minimap', 'view.followAgent', 'graph.tour', 'graph.replay', 'graph.acceptAll', 'assistant.askSelection', 'assistant.pause',
      'assistant.resume', 'assistant.end', 'assistant.provider.none', 'assistant.provider.test', 'sync.now', 'sync.auto', 'sync.settings',
      'file.settings', 'help.about']) {
      expect(byId.has(id), id).toBe(true);
    }
    // Undo and redo go through the engine; with no history they are off and say so.
    expect(byId.get('edit.undo')?.enabled()).toBe(false);
    expect(byId.get('edit.undo')?.hint).toBeTypeOf('function');
    expect(byId.get('edit.redo')?.hint).toBeTypeOf('function');
  });
});
