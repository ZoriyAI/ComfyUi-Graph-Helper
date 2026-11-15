/**
 * Copy, cut, paste and duplicate of canvas nodes. The clipboard lives in this module, not in the system clipboard,
 * so a copied node keeps every field of the workflow, including data this app does not know. Used by
 * GraphContextMenu, the app commands (commands/appCommands.ts, the Edit menu and shortcuts) and selectionEditing.ts.
 */
import type { CommandResponse, GraphMutation } from '../../../../shared/commands/types';
import type { GraphEdge, GraphNode } from '../../../types/graph';
import { useGraphStore } from '../../../state/graphState';
import { useProjectionStore } from '../../../services/commands/projection';
import { commitManual } from '../commit';
import { levelEdges, levelNodes, selectOnLevel } from './level';
import { commitEdits } from './editBatch';

/**
 * A copied piece of the graph: whole nodes and only the edges between them. Full native fragments stay local:
 * copying must preserve data unknown to this app.
 */
export interface Fragment { nodes: GraphNode[]; edges: GraphEdge[] }
/** Each paste of the same fragment lands this many flow units further right and down, so copies do not stack. */
export const PASTE_OFFSET = 40;
let clipboard: Fragment | null = null;
/** Pastes since the last copy or cut; the next paste's offset is PASTE_OFFSET times this plus one. */
let pastes = 0;
const listeners = new Set<() => void>();
/** Calls `listener` whenever the clipboard content changes (menus enable Paste); returns the unsubscribe. */
export function subscribeClipboard(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function changed(): void { for (const listener of listeners) listener(); }
/** A deep copy of the nodes and the edges whose both ends are among them, so later edits do not change the copy. */
export function fragmentOf(nodes: GraphNode[], edges: GraphEdge[]): Fragment {
  const ids = new Set(nodes.map((node) => node.id));
  return structuredClone({ nodes, edges: edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) });
}
/** The engine mutation that pastes a fragment shifted by `offset` on both axes. */
export function pasteEdits(fragment: Fragment, offset: number): GraphMutation[] {
  return [{ type: 'paste-selection', nodes: fragment.nodes as unknown as Record<string, unknown>[], edges: fragment.edges as unknown as Record<string, unknown>[], offsetX: offset, offsetY: offset }];
}
function selectedFragment(): Fragment | null {
  const nodes = levelNodes().filter((node) => node.selected);
  return nodes.length ? fragmentOf(nodes, levelEdges()) : null;
}
/** Whether any node is selected on the level on screen (Copy, Cut and Duplicate need one). */
export function hasSelection(): boolean { return levelNodes().some((node) => node.selected); }
export function hasClipboard(): boolean { return Boolean(clipboard?.nodes.length); }
/** Old name of hasClipboard, still exported through selectionEditing.ts. */
export const hasClipboardSelection = hasClipboard;
/** Copies the selected nodes of the level on screen; false when nothing is selected. */
export function copySelection(): boolean {
  const fragment = selectedFragment();
  if (!fragment) return false;
  clipboard = fragment;
  pastes = 0;
  changed();
  return true;
}
/** Compatibility seam; deletion uses the same atomic batch as canvas/menu deletion. */
export function removeSelection(nodeIds: string[], edgeIds: string[]): Promise<CommandResponse | null> {
  const removed = new Set(nodeIds);
  const edges = levelEdges().filter((edge) => edgeIds.includes(edge.id) && !removed.has(edge.source) && !removed.has(edge.target));
  return commitEdits([
    ...nodeIds.map((nodeId) => ({ type: 'remove-node' as const, nodeId })),
    ...edges.map((edge) => ({ type: 'remove-edge' as const, edgeId: edge.id })),
  ], 'delete') as Promise<CommandResponse | null>;
}
/** Removes the selected nodes in one undoable step and keeps them for Paste; false when nothing was removed. */
export async function cutSelection(): Promise<boolean> {
  const fragment = selectedFragment();
  if (!fragment) return false;
  const result = await commitEdits(fragment.nodes.map((node) => ({ type: 'remove-node', nodeId: node.id })), 'cut') as CommandResponse | null;
  if (result?.status !== 'applied' && result?.status !== 'historical') return false;
  clipboard = fragment;
  // After a cut the first paste goes back exactly where the nodes were (offset 0), not 40 units off.
  pastes = -1;
  changed();
  return true;
}
/** Pastes a fragment and selects the new nodes, unless the person has meanwhile moved to another level or graph. */
async function place(fragment: Fragment, offset: number, label: string): Promise<CommandResponse | null> {
  // Submission scopes synchronously, before awaiting the engine. Do not select another level after it completes.
  const original = useGraphStore.getState().activeSubgraphId;
  const graphKey = useProjectionStore.getState().graphKey;
  const result = await commitManual(pasteEdits(fragment, offset)[0], label) as CommandResponse | null;
  const ids = (result?.result as { nodeIds?: unknown } | null)?.nodeIds;
  if ((result?.status === 'applied' || result?.status === 'historical') && Array.isArray(ids) && original === useGraphStore.getState().activeSubgraphId && graphKey === useProjectionStore.getState().graphKey) selectOnLevel(ids.map(String));
  return result;
}
/** Pastes the clipboard, one PASTE_OFFSET further each time; null when the clipboard is empty. */
export async function pasteSelection(): Promise<CommandResponse | null> {
  if (!clipboard) return null;
  return place(clipboard, PASTE_OFFSET * ++pastes, 'paste');
}
/** Pastes the clipboard and returns the ids of the new nodes ([] when nothing was pasted). */
export async function pasteClipboard(): Promise<string[]> {
  const result = await pasteSelection();
  const ids = (result?.result as { nodeIds?: unknown } | null)?.nodeIds;
  return Array.isArray(ids) ? ids.map(String) : [];
}
/** Copies the selection in place, one PASTE_OFFSET off, without touching the clipboard. */
export async function duplicateSelection(): Promise<CommandResponse | null> {
  const fragment = selectedFragment();
  return fragment ? place(fragment, PASTE_OFFSET, 'duplicate') : null;
}
