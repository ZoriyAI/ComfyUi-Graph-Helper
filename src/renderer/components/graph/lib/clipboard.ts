import type { GraphMutation } from '../../../../shared/commands/types';
import type { NodeClassDetail } from '../../../../shared/contracts/knowledge';
import type { GraphEdge, GraphNode } from '../../../types/graph';
import { fieldValue } from '../../fields/fieldModel';
import { useNodeInfoStore } from '../nodeInfo';
import { hasOwnTitle } from './nodeName';
import { levelEdges, levelNodes, selectOnLevel } from './level';
import { commitEdits, type BatchLabel } from './editBatch';

/**
 * Copy, cut, paste and duplicate of nodes, on the level on screen (the main canvas or an open subgraph). What is
 * copied is a fragment: the nodes (class, own title, field values, place) and the links between them. A paste is
 * ONE history step: new nodes with new ids, 40 px down and right of the originals (further on each repeat), with
 * their inner links, and the pasted nodes selected.
 */
export const PASTE_OFFSET = 40;

export interface FragmentNode {
  key: string;
  /** A node class, or a subgraph instance (then `definitionId`). */
  nodeType: string;
  definitionId?: string;
  title?: string;
  parameters: Record<string, unknown>;
  x: number;
  y: number;
}

export interface Fragment {
  nodes: FragmentNode[];
  edges: Array<{ source: string; sourceHandle: string; target: string; targetHandle: string }>;
}

let clipboard: Fragment | null = null;
let pastes = 0;

/** The values a node holds by field name: the commands' parameters, else an imported node's stored widget list. */
export function nodeValues(node: GraphNode, detail: NodeClassDetail | null | undefined): Record<string, unknown> {
  const data = node.data;
  const values: Record<string, unknown> = { ...(data.parameters ?? {}) };
  const order = detail && detail.widgetOrderReliable !== false ? detail.widgetOrder : undefined;
  for (const input of detail?.inputs ?? []) {
    if (!input.widget || input.name in values) continue;
    const value = fieldValue(data, input.name, order);
    if (value !== undefined && value !== null) values[input.name] = value;
  }
  return values;
}

/** The fragment of the given nodes: themselves and the links that run between them. */
export function fragmentOf(nodes: GraphNode[], edges: GraphEdge[], details: Record<string, NodeClassDetail | null | undefined> = {}): Fragment {
  const ids = new Set(nodes.map((node) => node.id));
  return {
    nodes: nodes.map((node) => {
      const instance = node.data.kind === 'subgraph-instance';
      const definitionId = instance ? String((node.data as { subgraphId?: unknown }).subgraphId ?? node.data.comfyType) : undefined;
      return {
        key: node.id,
        nodeType: node.data.comfyType,
        ...(definitionId ? { definitionId } : {}),
        ...(hasOwnTitle(node.data) ? { title: String(node.data.title) } : {}),
        parameters: instance ? {} : nodeValues(node, details[node.data.comfyType]),
        x: node.position.x,
        y: node.position.y,
      };
    }),
    edges: edges
      .filter((edge) => ids.has(edge.source) && ids.has(edge.target) && edge.sourceHandle && edge.targetHandle)
      .map((edge) => ({ source: edge.source, sourceHandle: String(edge.sourceHandle), target: edge.target, targetHandle: String(edge.targetHandle) })),
  };
}

/** The edits of a paste: one add per node ("@k" is the k-th new node), then the links between the new nodes. */
export function pasteEdits(fragment: Fragment, offset: number): GraphMutation[] {
  const index = new Map(fragment.nodes.map((node, at) => [node.key, at]));
  const adds: GraphMutation[] = fragment.nodes.map((node) => (node.definitionId
    ? { type: 'insert-subgraph', definitionId: node.definitionId, x: node.x + offset, y: node.y + offset, ...(node.title ? { title: node.title } : {}) }
    : {
      type: 'add-node',
      nodeType: node.nodeType,
      ...(node.title ? { title: node.title } : {}),
      x: node.x + offset,
      y: node.y + offset,
      ...(Object.keys(node.parameters).length > 0 ? { parameters: node.parameters } : {}),
    }));
  const links: GraphMutation[] = fragment.edges.map((edge) => ({
    type: 'connect',
    source: `@${index.get(edge.source)}`,
    sourceHandle: edge.sourceHandle,
    target: `@${index.get(edge.target)}`,
    targetHandle: edge.targetHandle,
  }));
  return [...adds, ...links];
}

/** The selected nodes of the level on screen, without the subgraph's input and output boundary. */
function selectedLevelNodes(): GraphNode[] {
  return levelNodes().filter((node) => node.selected);
}

/** What is selected, with the catalog details of its classes (asked for when not read yet). */
async function selectedFragment(): Promise<Fragment | null> {
  const nodes = selectedLevelNodes();
  if (nodes.length === 0) return null;
  const info = useNodeInfoStore.getState();
  const details: Record<string, NodeClassDetail | null | undefined> = {};
  for (const type of new Set(nodes.map((node) => node.data.comfyType))) details[type] = await info.request(type).catch(() => null);
  return fragmentOf(nodes, levelEdges(), details);
}

export function hasClipboard(): boolean {
  return clipboard !== null && clipboard.nodes.length > 0;
}

export function hasSelection(): boolean {
  return selectedLevelNodes().length > 0;
}

/** Edit ▸ Copy (Ctrl+C). */
export async function copySelection(): Promise<boolean> {
  const fragment = await selectedFragment();
  if (!fragment) return false;
  clipboard = fragment;
  pastes = 0;
  return true;
}

async function place(fragment: Fragment, offset: number, label: BatchLabel): Promise<string[]> {
  const result = await commitEdits(pasteEdits(fragment, offset), label) as { status?: string; result?: { nodeId?: unknown; nodeIds?: unknown } } | null;
  if (result?.status !== 'applied') return [];
  const ids = Array.isArray(result.result?.nodeIds)
    ? result.result.nodeIds.map(String)
    : result.result?.nodeId !== undefined ? [String(result.result.nodeId)] : [];
  if (ids.length > 0) selectOnLevel(ids);
  return ids;
}

/** Edit ▸ Paste (Ctrl+V): the copied nodes again, each paste a little further down and right. */
export async function pasteClipboard(): Promise<string[]> {
  if (!clipboard) return [];
  pastes += 1;
  return place(clipboard, PASTE_OFFSET * pastes, 'paste');
}

/** Edit ▸ Duplicate (Ctrl+D): the selection copied and pasted at once; the clipboard is left as it was. */
export async function duplicateSelection(): Promise<string[]> {
  const fragment = await selectedFragment();
  if (!fragment) return [];
  return place(fragment, PASTE_OFFSET, 'duplicate');
}

/** Edit ▸ Cut (Ctrl+X): copied, then removed in one step; a later paste puts the nodes back where they were. */
export async function cutSelection(): Promise<boolean> {
  const fragment = await selectedFragment();
  if (!fragment) return false;
  clipboard = fragment;
  pastes = -1;
  await commitEdits(fragment.nodes.map((node) => ({ type: 'remove-node', nodeId: node.key })), 'cut');
  return true;
}
