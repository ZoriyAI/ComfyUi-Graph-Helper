/**
 * The readable name of every node class the catalog knows ("Load Checkpoint" for CheckpointLoaderSimple), so a
 * node without its own title is named as the library names it wherever a person reads it: on the canvas, in
 * Properties, in check messages and the export guard, in the tour and in explanations. nodeName.ts reads it;
 * services/catalogWatch.ts reloads it when the catalog changes.
 */
import { create } from 'zustand';

interface ClassTitles {
  titles: Record<string, string>;
  set: (titles: Record<string, string>) => void;
}

/** Class type to catalog display name; empty until loadClassTitles has read the catalog. */
export const useClassTitleStore = create<ClassTitles>((set) => ({
  titles: {},
  set: (titles) => set({ titles }),
}));

/** The catalog name of a class; '' when the catalog has none (or no readable one). */
export function classTitleOf(classType: unknown): string {
  if (typeof classType !== 'string' || !classType) return '';
  return useClassTitleStore.getState().titles[classType] ?? '';
}

/** Counter of reads in flight, so an older read that answers late does not overwrite a newer one. */
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
    // A display name equal to the class type adds nothing; leaving it out keeps classTitleOf's '' meaning "none".
    if (name && name !== item.classType) titles[item.classType] = name;
  }
  useClassTitleStore.getState().set(titles);
}
