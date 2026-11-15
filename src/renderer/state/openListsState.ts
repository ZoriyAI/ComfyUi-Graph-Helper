import { create } from 'zustand';

/**
 * File ▸ Recent and File ▸ Examples as the window last read them from main (main/ipc/openIpc.ts).
 *
 * Who uses it: the File menu's two submenus and the welcome card's "Recent" and "Examples" rows.
 * Why a store: the menu bar is drawn from command states and cannot wait for IPC while it opens, so the lists are
 * read at start, after every open or save, and after ComfyUI is read again (examples depend on its node list).
 */

/** One remembered file as the menu shows it: its name, and its full path as a hint. */
export interface RecentEntry {
  path: string;
  name: string;
  kind: 'project' | 'workflow';
  at: number;
}

interface OpenListsState {
  recent: RecentEntry[];
  /** Lesson ids whose example graph this ComfyUI can build. */
  examples: string[];
  set: (recent: RecentEntry[], examples: string[]) => void;
}

export const useOpenListsStore = create<OpenListsState>((set) => ({
  recent: [],
  examples: [],
  set: (recent, examples) => set({ recent, examples }),
}));
