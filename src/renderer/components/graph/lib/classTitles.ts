import { create } from 'zustand';

/**
 * The readable name of every node class the catalog knows ("Load Checkpoint" for CheckpointLoaderSimple), so a
 * node without its own title is named as the library names it wherever a person reads it: on the canvas, in
 * Properties, in check messages and the export guard, in the tour and in explanations.
 */
interface ClassTitles {
  titles: Record<string, string>;
  set: (titles: Record<string, string>) => void;
}

export const useClassTitleStore = create<ClassTitles>((set) => ({
  titles: {},
  set: (titles) => set({ titles }),
}));

/** The catalog name of a class; '' when the catalog has none (or no readable one). */
export function classTitleOf(classType: unknown): string {
  if (typeof classType !== 'string' || !classType) return '';
  return useClassTitleStore.getState().titles[classType] ?? '';
}

let loading = 0;

/** Reads the names again (start, after a sync, after a catalog file is loaded). The newest read wins. */
export async function loadClassTitles(): Promise<void> {
  const bridge = typeof window === 'undefined' ? undefined : window.electronAPI;
  if (!bridge?.searchNodeTypes) return;
  const mine = ++loading;
  const found = await bridge.searchNodeTypes({ query: '', limit: 10000 }).catch(() => null);
  if (!found || mine !== loading) return;
  const titles: Record<string, string> = {};
  for (const item of found) {
    const name = item.displayName?.trim();
    if (name && name !== item.classType) titles[item.classType] = name;
  }
  useClassTitleStore.getState().set(titles);
}
