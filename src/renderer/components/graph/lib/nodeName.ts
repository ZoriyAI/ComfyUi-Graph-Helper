import { useGraphStore } from '../../../state/graphState';
import { classTitleOf } from './classTitles';

/**
 * The name a person reads for a node: its own title; for a subgraph without one, the subgraph's name; else the
 * class name. A workflow from ComfyUI often carries no title for a nested subgraph; the node then arrives with
 * its class as its title, and the class of a subgraph is the subgraph's id. Without this the node was called
 * "bbbbbbbb-0000-4000-8000-000000000002" on the canvas, in Properties, in menus and in the helper's steps.
 */
export interface NamedNodeData { title?: unknown; comfyType?: unknown; subgraphId?: unknown }

export function subgraphNameOf(data: NamedNodeData | undefined): string {
  if (!data) return '';
  const id = String(data.subgraphId ?? data.comfyType ?? '');
  if (!id) return '';
  return useGraphStore.getState().subgraphs.find((item) => item.id === id)?.name ?? '';
}

/** Whether the node carries a title a person gave it, as opposed to its class or its subgraph's id put there. */
export function hasOwnTitle(data: NamedNodeData | undefined): boolean {
  if (!data || !data.title) return false;
  return data.title !== data.comfyType && data.title !== data.subgraphId;
}

/**
 * `classTitle` is the catalog's readable name for the class ("Load Checkpoint"), when the caller has it; else the
 * name the catalog gave the class (classTitles.ts). A node whose title is only its class (a workflow from ComfyUI
 * stores no title for a node nobody renamed) is named by that readable name, as the library names it; the export
 * still writes no title for it.
 */
export function nodeDisplayName(data: NamedNodeData | undefined, classTitle?: string): string {
  if (!data) return '';
  const subgraph = subgraphNameOf(data);
  if (hasOwnTitle(data)) return String(data.title);
  return String(subgraph || classTitle || classTitleOf(data.comfyType) || data.title || data.comfyType || '');
}
