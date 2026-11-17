/** Checks that project file refresh requests coalesce without losing final state. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshProjectFile, useProjectFileStore } from '../../src/renderer/services/projectFile';
import type { ProjectFileState } from '../../src/shared/contracts/projectFile';

const state = (dirty: boolean): ProjectFileState => ({ graphKey: 'g', filePath: '/tmp/project.nodewise', fileName: 'project.nodewise', dirty, empty: false, title: '' });
afterEach(() => { vi.unstubAllGlobals(); useProjectFileStore.getState().set(null); });

describe('project file status under many explanation loads', () => {
  it('coalesces concurrent reads and returns the trailing state to every caller', async () => {
    let finish!: (state: ProjectFileState) => void;
    const read = vi.fn().mockImplementationOnce(() => new Promise<ProjectFileState>(resolve => { finish = resolve; })).mockResolvedValue(state(true));
    vi.stubGlobal('window', { electronAPI: { projectFileState: read } });
    const requests = Array.from({ length: 1000 }, () => refreshProjectFile());
    expect(read).toHaveBeenCalledTimes(1);
    finish(state(false));
    expect(await Promise.all(requests)).toEqual(Array.from({ length: 1000 }, () => state(true)));
    expect(read).toHaveBeenCalledTimes(2);
    expect(useProjectFileStore.getState().state?.dirty).toBe(true);
  });

  it('allows a fresh read after failure and after a saved file becomes clean', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(state(true)).mockResolvedValueOnce(state(false));
    vi.stubGlobal('window', { electronAPI: { projectFileState: read } });
    expect(await refreshProjectFile()).toBeNull();
    expect((await refreshProjectFile())?.dirty).toBe(true);
    expect((await refreshProjectFile())?.dirty).toBe(false);
    expect(read).toHaveBeenCalledTimes(3);
  });
});
