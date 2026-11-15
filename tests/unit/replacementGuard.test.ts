/**
 * Protects the question asked before an imported workflow or an opened project replaces the graph on screen.
 * The main process's "dirty" flag decides, not the visible node count: a person who deleted every node has
 * still changed the project and must not lose that change to Open or Import without being asked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importWorkflowFile, importWorkflowNow, openProjectFile } from '../../src/renderer/commands/actions';
import { useGraphStore } from '../../src/renderer/state/graphState';
import { useUiStore } from '../../src/renderer/state/uiState';

const importWorkflow = vi.fn(async () => ({ status: 'cancelled' as const }));
const openProject = vi.fn(async () => ({ status: 'cancelled' as const }));
const projectFileState = vi.fn(async () => ({ dirty: true, empty: false, graphKey: 'g', filePath: null, fileName: null, title: '' }));

describe('unsaved graph replacement guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', { electronAPI: { importWorkflow, openProject, projectFileState } });
    useUiStore.setState({ dialog: null });
    useGraphStore.setState({ nodes: [], edges: [] });
    projectFileState.mockResolvedValue({ dirty: true, empty: false, graphKey: 'g', filePath: null, fileName: null, title: '' });
  });
  it('waits for confirmation even after deleting the last root node', async () => {
    await importWorkflowFile();
    expect(useUiStore.getState()).toMatchObject({ dialog: 'new-project', replaceIntent: 'import-workflow' });
    expect(importWorkflow).not.toHaveBeenCalled();
    await importWorkflowNow();
    expect(importWorkflow).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().dialog).toBeNull();
  });
  it('cancels opening without touching the file dialog', async () => {
    await openProjectFile();
    expect(useUiStore.getState()).toMatchObject({ dialog: 'new-project', replaceIntent: 'open-project' });
    useUiStore.getState().setDialog(null);
    expect(openProject).not.toHaveBeenCalled();
  });
  it.each([false, true])('opens directly when authoritative dirty is false (empty=%s)', async (empty) => {
    projectFileState.mockResolvedValue({ dirty: false, empty, graphKey: 'g', filePath: null, fileName: null, title: '' });
    await importWorkflowFile();
    expect(useUiStore.getState().dialog).toBeNull();
    expect(importWorkflow).toHaveBeenCalledTimes(1);
  });
});
