import type { CommandResponse, GraphMutation } from '../../../../shared/commands/types';
import type { GraphEdge, GraphNode } from '../../../types/graph';
import { useGraphStore } from '../../../state/graphState';
import { useProjectionStore } from '../../../services/commands/projection';
import { commitManual } from '../commit';
import { levelEdges, levelNodes, selectOnLevel } from './level';
import { commitEdits } from './editBatch';

/** Full native fragments stay local: copying must preserve data unknown to this app. */
export interface Fragment { nodes: GraphNode[]; edges: GraphEdge[] }
export const PASTE_OFFSET = 40;
let clipboard: Fragment | null = null;
let pastes = 0;
const listeners = new Set<() => void>();
export function subscribeClipboard(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function changed(): void { for (const listener of listeners) listener(); }
export function fragmentOf(nodes: GraphNode[], edges: GraphEdge[]): Fragment {
  const ids = new Set(nodes.map((node) => node.id));
  return structuredClone({ nodes, edges: edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) });
}
export function pasteEdits(fragment: Fragment, offset: number): GraphMutation[] {
  return [{ type: 'paste-selection', nodes: fragment.nodes as unknown as Record<string, unknown>[], edges: fragment.edges as unknown as Record<string, unknown>[], offsetX: offset, offsetY: offset }];
}
function selectedFragment(): Fragment | null {
  const nodes = levelNodes().filter((node) => node.selected);
  return nodes.length ? fragmentOf(nodes, levelEdges()) : null;
}
export function hasSelection(): boolean { return levelNodes().some((node) => node.selected); }
export function hasClipboard(): boolean { return Boolean(clipboard?.nodes.length); }
export const hasClipboardSelection = hasClipboard;
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
export async function cutSelection(): Promise<boolean> {
  const fragment = selectedFragment();
  if (!fragment) return false;
  const result = await commitEdits(fragment.nodes.map((node) => ({ type: 'remove-node', nodeId: node.id })), 'cut') as CommandResponse | null;
  if (result?.status !== 'applied' && result?.status !== 'historical') return false;
  clipboard = fragment;
  pastes = -1;
  changed();
  return true;
}
async function place(fragment: Fragment, offset: number, label: string): Promise<CommandResponse | null> {
  // Submission scopes synchronously, before awaiting the engine. Do not select another level after it completes.
  const original = useGraphStore.getState().activeSubgraphId;
  const graphKey = useProjectionStore.getState().graphKey;
  const result = await commitManual(pasteEdits(fragment, offset)[0], label) as CommandResponse | null;
  const ids = (result?.result as { nodeIds?: unknown } | null)?.nodeIds;
  if ((result?.status === 'applied' || result?.status === 'historical') && Array.isArray(ids) && original === useGraphStore.getState().activeSubgraphId && graphKey === useProjectionStore.getState().graphKey) selectOnLevel(ids.map(String));
  return result;
}
export async function pasteSelection(): Promise<CommandResponse | null> {
  if (!clipboard) return null;
  return place(clipboard, PASTE_OFFSET * ++pastes, 'paste');
}
export async function pasteClipboard(): Promise<string[]> {
  const result = await pasteSelection();
  const ids = (result?.result as { nodeIds?: unknown } | null)?.nodeIds;
  return Array.isArray(ids) ? ids.map(String) : [];
}
export async function duplicateSelection(): Promise<CommandResponse | null> {
  const fragment = selectedFragment();
  return fragment ? place(fragment, PASTE_OFFSET, 'duplicate') : null;
}
