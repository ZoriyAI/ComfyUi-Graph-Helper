/**
 * The nodes a person added lately from the node search, shown first while the search box is empty (AddNodeSearch).
 * A convenience of this viewer only, so it lives in the browser storage of the window; when the storage is not
 * available (a private profile, a test) the list is simply empty.
 */
import type { NodeClassSummary } from '../../../../shared/contracts/knowledge';

const KEY = 'graph-helper.recent-nodes';
/** How many recent nodes the empty search shows. */
export const RECENT_LIMIT = 6;

/** The recent nodes, newest first. */
export function recentNodes(): NodeClassSummary[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is NodeClassSummary => Boolean(item) && typeof item === 'object' && typeof (item as NodeClassSummary).classType === 'string')
      .slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

/** Puts a node at the head of the recent list. */
export function rememberRecentNode(item: NodeClassSummary): void {
  try {
    const kept = recentNodes().filter((entry) => entry.classType !== item.classType);
    const entry: NodeClassSummary = { classType: item.classType, displayName: item.displayName, category: item.category, pack: item.pack, detailed: item.detailed };
    if (item.description) entry.description = item.description;
    if (item.editor) entry.editor = true;
    window.localStorage.setItem(KEY, JSON.stringify([entry, ...kept].slice(0, RECENT_LIMIT)));
  } catch {
    // No storage in this window: the search works without a recent list.
  }
}
