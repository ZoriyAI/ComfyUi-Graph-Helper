/**
 * Small pieces around files and history: the save and redo shortcuts (appCommands, hotkeys), the toast shown after a
 * workflow is opened (shell/notices), the words the history replay speaks (graph/lib/replay), and the tracker that
 * lets a save wait for edits still on their way to main (services/commands/pending). A person relies on Ctrl+S
 * saving what they just typed and on a toast that names what is missing in their own language.
 */
import { describe, expect, it } from 'vitest';
import { buildAppCommands } from '../../src/renderer/commands/appCommands';
import { commandForKey } from '../../src/renderer/commands/hotkeys';
import { describeNote } from '../../src/renderer/components/shell/notices';
import { replayStepText } from '../../src/renderer/components/graph/lib/replay';
import { pendingCommits, trackCommit, whenSettled } from '../../src/renderer/services/commands/pending';
import { createTranslator } from '../../src/shared/i18n';

const key = (over: Partial<{ key: string; code: string; ctrlKey: boolean; shiftKey: boolean }>) => ({ key: '', code: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...over });
// Focus on the canvas itself: not in a text field, and no menu, dialog or list open over it.
const canvas = { editable: false, layerOpen: false };

describe('file commands and shortcuts', () => {
  const commands = buildAppCommands().map((command) => ({ ...command, enabled: () => true }));

  it('Ctrl+S saves, Ctrl+Shift+S saves as, both even while typing in a field', () => {
    expect(commandForKey(key({ key: 's', code: 'KeyS', ctrlKey: true }), canvas, commands, 'other')?.id).toBe('file.save');
    expect(commandForKey(key({ key: 'S', code: 'KeyS', ctrlKey: true, shiftKey: true }), canvas, commands, 'other')?.id).toBe('file.saveAs');
    expect(commandForKey(key({ key: 'S', code: 'KeyS', ctrlKey: true, shiftKey: true }), { editable: true, layerOpen: false }, commands, 'other')?.id).toBe('file.saveAs');
  });

  it('Ctrl+Y redoes as Ctrl+Shift+Z does', () => {
    expect(commandForKey(key({ key: 'y', code: 'KeyY', ctrlKey: true }), canvas, commands, 'other')?.id).toBe('edit.redo');
    expect(commandForKey(key({ key: 'Z', code: 'KeyZ', ctrlKey: true, shiftKey: true }), canvas, commands, 'other')?.id).toBe('edit.redo');
    expect(commands.find((command) => command.id === 'edit.redo')?.altShortcuts).toEqual(['Mod+Y']);
  });
});

describe('the import toast', () => {
  const t = createTranslator('ru');

  it('names two missing nodes and counts the rest, with a button that opens Check', () => {
    let opened = 0;
    const toast = describeNote({ kind: 'imported', version: '0.4', missingNodes: ['FloatConstant', 'GetNode', 'SetNode', 'VHS_LoadVideo'], missingModels: [] }, t, { openCheck: () => { opened += 1; } });
    expect(toast.title).toBe('Workflow открыт.');
    expect(toast.description).toBe('Не хватает нод: 4 (FloatConstant, GetNode и ещё 2). Все модели на месте.');
    toast.action?.onSelect();
    expect(toast.action?.label).toBe('Открыть проверку');
    expect(opened).toBe(1);
  });

  it('lists up to two names in full and says so when nothing is missing', () => {
    const two = describeNote({ kind: 'imported', version: '1', missingNodes: ['A', 'B'], missingModels: ['loras/x.safetensors'] }, t);
    expect(two.description).toBe('Не хватает нод: A и B. Не хватает моделей: loras/x.safetensors.');
    const none = describeNote({ kind: 'imported', version: '1', missingNodes: [], missingModels: [] }, t);
    expect(none.tone).toBe('success');
    expect(none.action).toBeUndefined();
  });
});

describe('history replay words', () => {
  const t = createTranslator('ru');
  const say = (row: Parameters<typeof replayStepText>[0]) => {
    const step = replayStepText(row);
    return t(step.key, step.values);
  };

  it('uses the history sentences, never a command name', () => {
    expect(say({ id: 'a', revSeq: 1, timestamp: 0, description: 'Initial', source: 'system', actor: null })).toBe('начало');
    expect(say({ id: 'b', revSeq: 2, timestamp: 0, description: 'add-node', source: 'user', actor: 'manual', payload: { type: 'add-node', nodeType: 'KSampler' } })).toBe('добавление ноды KSampler');
    expect(say({ id: 'c', revSeq: 3, timestamp: 0, description: 'restore-revision', source: 'user', actor: 'manual', payload: { type: 'restore-revision' }, restoredRevisionId: 'b' })).toBe('возврат к прежней версии');
    expect(say({ id: 'd', revSeq: 4, timestamp: 0, description: 'something-new', source: 'ai', actor: 'ai', payload: { type: 'something-new' } })).toBe('изменение графа');
  });
});

describe('edits that are still landing', () => {
  it('whenSettled waits for every tracked edit', async () => {
    let release!: () => void;
    const slow = trackCommit(() => new Promise<void>((resolve) => { release = resolve; }));
    expect(pendingCommits()).toBe(1);
    let settled = false;
    const waiting = whenSettled().then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    release();
    await slow;
    await waiting;
    expect(settled).toBe(true);
    expect(pendingCommits()).toBe(0);
  });

  it('a failed edit settles too', async () => {
    await expect(trackCommit(() => Promise.reject(new Error('no')))).rejects.toThrow('no');
    expect(pendingCommits()).toBe(0);
    await whenSettled();
  });
});
