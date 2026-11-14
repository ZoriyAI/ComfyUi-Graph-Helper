import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelReplacement, confirmReplacement, importWorkflowFile, openProjectFile } from '../../src/renderer/commands/actions';
import { useProjectionStore } from '../../src/renderer/services/commands/projection';
import { useGraphStore } from '../../src/renderer/state/graphState';
import { useUiStore } from '../../src/renderer/state/uiState';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';

const importWorkflow = vi.fn(async () => ({ status: 'cancelled' as const }));
const openProject = vi.fn(async () => ({ status: 'cancelled' as const }));

function reset(savedRevSeq: number, savedToFile: boolean): void {
  useProjectionStore.setState({ projectId: DESKTOP_PROJECT_ID, revSeq: 2, currentRevisionId: 'rev-2', activeRun: null, graphKey: '' });
  useUiStore.setState({ savedRevSeq, savedToFile, dialog: null });
  useGraphStore.setState({
    nodes: [{ id: '1', type: 'comfy', position: { x: 0, y: 0 }, data: { comfyType: 'KSampler', inputs: [], outputs: [], parameters: {} } }],
    edges: [],
  });
}

describe('unsaved graph replacement guard', () => {
  beforeEach(() => {
    importWorkflow.mockClear();
    openProject.mockClear();
    vi.stubGlobal('window', { electronAPI: { importWorkflow, openProject } });
    reset(1, false);
  });

  it('waits for confirmation before importing over unsaved work', async () => {
    importWorkflowFile();
    expect(useUiStore.getState().dialog).toBe('replace-project');
    expect(importWorkflow).not.toHaveBeenCalled();
    await confirmReplacement();
    expect(importWorkflow).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().dialog).toBeNull();
  });

  it('cancels project opening without touching the file dialog', () => {
    openProjectFile();
    expect(useUiStore.getState().dialog).toBe('replace-project');
    cancelReplacement();
    expect(useUiStore.getState().dialog).toBeNull();
    expect(openProject).not.toHaveBeenCalled();
  });

  it('opens directly when the current graph is saved', () => {
    reset(2, true);
    importWorkflowFile();
    expect(useUiStore.getState().dialog).toBeNull();
    expect(importWorkflow).toHaveBeenCalledTimes(1);
  });
});
