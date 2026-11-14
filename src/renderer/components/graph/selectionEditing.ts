import type { CommandResponse, GraphMutation } from '../../../shared/commands/types';
import { commitManual } from './commit';
import { levelEdges, levelNodes, selectOnLevel } from './lib/level';
import type { GraphEdge, GraphNode } from '../../types/graph';

/** An in-app clipboard: graph data, not text, so ComfyUI fields and links survive intact. */
interface ClipboardSelection { nodes: GraphNode[]; edges: GraphEdge[] }

function pastePayload(fragment: ClipboardSelection): GraphMutation {
  return {
    type: 'paste-selection',
    nodes: fragment.nodes as unknown as Array<Record<string, unknown>>,
    edges: fragment.edges as unknown as Array<Record<string, unknown>>,
    offsetX: 32,
    offsetY: 32,
  };
}

let clipboard: ClipboardSelection | null = null;
const listeners = new Set<() => void>();

function changed(): void {
  for (const listener of listeners) listener();
}

/** Lets the shared command registry refresh the enabled state of Paste immediately after Copy/Cut. */
export function subscribeClipboard(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function selectedFragment(): ClipboardSelection | null {
  const nodes = levelNodes().filter((node) => node.selected);
  if (nodes.length === 0) return null;
  const ids = new Set(nodes.map((node) => node.id));
  const edges = levelEdges().filter((edge) => ids.has(edge.source) && ids.has(edge.target));
  return structuredClone({ nodes, edges });
}

export function hasClipboardSelection(): boolean {
  return clipboard !== null;
}

export async function removeSelection(nodeIds: string[], edgeIds: string[]): Promise<CommandResponse | null> {
  if (nodeIds.length === 0 && edgeIds.length === 0) return null;
  return commitManual({ type: 'remove-selection', nodeIds, edgeIds }, 'remove-selection') as Promise<CommandResponse | null>;
}

export function copySelection(): boolean {
  const fragment = selectedFragment();
  if (!fragment) return false;
  clipboard = fragment;
  changed();
  return true;
}

export async function cutSelection(): Promise<boolean> {
  const fragment = selectedFragment();
  if (!fragment) return false;
  const result = await removeSelection(fragment.nodes.map((node) => String(node.id)), []);
  if (result?.status !== 'applied' && result?.status !== 'historical') return false;
  clipboard = fragment;
  changed();
  return true;
}

export async function pasteSelection(): Promise<CommandResponse | null> {
  if (!clipboard) return null;
  const result = await commitManual(pastePayload(structuredClone(clipboard)), 'paste') as CommandResponse | null;
  const nodeIds = result?.status === 'applied' || result?.status === 'historical'
    ? (result.result as { nodeIds?: unknown } | null)?.nodeIds
    : undefined;
  if (Array.isArray(nodeIds)) selectOnLevel(nodeIds.map(String));
  return result;
}

export async function duplicateSelection(): Promise<CommandResponse | null> {
  const fragment = selectedFragment();
  if (!fragment) return null;
  const result = await commitManual(pastePayload(fragment), 'duplicate') as CommandResponse | null;
  const nodeIds = result?.status === 'applied' || result?.status === 'historical'
    ? (result.result as { nodeIds?: unknown } | null)?.nodeIds
    : undefined;
  if (Array.isArray(nodeIds)) selectOnLevel(nodeIds.map(String));
  return result;
}
