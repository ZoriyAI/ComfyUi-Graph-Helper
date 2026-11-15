/**
 * The project file of the graph on screen, as main knows it (main/projectFiles.ts): its path, and whether the graph
 * is in it as it stands. Main keeps it per graph in SQLite, so it is the same after a reload or a restart, and an
 * undo back to exactly the saved content clears the mark.
 *
 * Who uses it: commands/actions.ts (ask before replacing an unsaved graph), commands/appCommands.ts (installs the
 * watch) and components/shell/Toolbar.tsx (the unsaved mark).
 */
import { create } from 'zustand';
import type { ProjectFileState } from '../../shared/contracts/projectFile';
import { useProjectionStore } from './commands/projection';

interface ProjectFileStore {
  state: ProjectFileState | null;
  set: (state: ProjectFileState | null) => void;
}

/** The last project file state main reported; null until it has answered. */
export const useProjectFileStore = create<ProjectFileStore>((set) => ({
  state: null,
  set: (state) => set({ state }),
}));

/** Counts reads, so an older answer arriving late does not overwrite a newer one. */
let seq = 0;

/** Reads the state again (newest answer wins). */
export async function refreshProjectFile(): Promise<ProjectFileState | null> {
  const bridge = window.electronAPI;
  if (!bridge?.projectFileState) return null;
  const mine = ++seq;
  const state = await bridge.projectFileState().catch(() => null);
  if (state && mine === seq) useProjectFileStore.getState().set(state);
  return state;
}

/** True when the graph on screen is not in a project file as it stands. Until main answered: false. */
export function graphIsDirty(): boolean {
  return useProjectFileStore.getState().state?.dirty ?? false;
}

/** Keeps the state in step with the head the canvas shows. Returns the unsubscribe. */
export function installProjectFileWatch(): () => void {
  let head = useProjectionStore.getState().currentRevisionId;
  void refreshProjectFile();
  return useProjectionStore.subscribe((projection) => {
    if (projection.currentRevisionId === head) return;
    head = projection.currentRevisionId;
    void refreshProjectFile();
  });
}
