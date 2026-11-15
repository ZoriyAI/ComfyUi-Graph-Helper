/**
 * Spoken canvas: the names a screen reader gives to the nodes and links of the canvas, and which links take
 * keyboard focus.
 *
 * Who uses it: CanvasFlow, which passes the result to React Flow as `ariaLabel`, `ariaRoleDescription`-like
 * attributes and `focusable` on each node and edge.
 *
 * Why: React Flow names a link "Edge from 1 to 2" (English, with internal ids) and leaves a node without a name,
 * so a screen reader read the whole card text or a meaningless id. A link was also a Tab stop of its own, and every
 * link came before the first node, so a keyboard user crossed all links before reaching any node. A link is now a
 * Tab stop only while one of its ends (or the link itself) is selected: select a node, then its links are reachable.
 */
import { nodeDisplayName, type NamedNodeData } from './nodeName';
import { nodeRunMode } from '../../../../shared/graph/layout';
import type { ClassPresence } from '../../../../shared/workflow/comfyLook';

/** The translator shape the module needs: a key and its values to one string. */
export type Say = (key: string, values?: Record<string, unknown>) => string;

/** The parts of a canvas node this module reads (a real node, a subgraph copy or a boundary node). */
export interface SpokenNodeInput {
  id: string;
  type?: string;
  selected?: boolean;
  data: Record<string, unknown>;
}

/** The parts of a canvas link this module reads. */
export interface SpokenEdgeInput {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  selected?: boolean;
  data?: { dataType?: string } & Record<string, unknown>;
}

interface PortLike { id?: string; name?: string; dataType?: string }

function ports(data: Record<string, unknown>, side: 'inputs' | 'outputs'): PortLike[] {
  const list = data[side] ?? data.ports;
  return Array.isArray(list) ? (list as PortLike[]) : [];
}

/** The name a person sees on the node card: its own title, else the catalog's readable name, else the class. */
export function spokenTitle(node: SpokenNodeInput, classTitle?: string): string {
  if (node.type === 'boundary') return String(node.data.name ?? '');
  const data = node.data as NamedNodeData & { comfyType?: string };
  return nodeDisplayName(data, classTitle) || String(data.comfyType ?? node.id);
}

/**
 * The accessible name of one node: title, class (when it differs), kind and marks, and how many inputs are linked.
 * Example: "KSampler, KSampler (Advanced), bypassed, inputs linked: 2 of 4, outputs: 1".
 */
export function nodeSpeech(
  node: SpokenNodeInput,
  say: Say,
  context: { classTitle?: string; presence?: ClassPresence; linkedInputs?: number; error?: boolean } = {},
): string {
  const title = spokenTitle(node, context.classTitle);
  if (node.type === 'boundary') return say('a11y.boundary', { name: title });
  const data = node.data as { comfyType?: string; kind?: string; locked?: boolean };
  const parts: string[] = [title];
  if (data.kind === 'subgraph-instance') parts.push(say('node.subgraph'));
  else if (data.comfyType && data.comfyType !== title) parts.push(data.comfyType);
  const mode = nodeRunMode(node.data as { comfy?: unknown });
  if (mode === 'bypassed') parts.push(say('node.bypassed'));
  if (mode === 'muted') parts.push(say('node.muted'));
  if (context.presence === 'missing') parts.push(say('importLook.missing'));
  if (data.locked) parts.push(say('node.locked'));
  if (context.error) parts.push(say('node.error'));
  const inputs = ports(node.data, 'inputs').length;
  const outputs = ports(node.data, 'outputs').length;
  if (inputs > 0) parts.push(say('a11y.inputsLinked', { linked: context.linkedInputs ?? 0, count: inputs }));
  if (outputs > 0) parts.push(say('a11y.outputs', { count: outputs }));
  return parts.join(', ');
}

/** How many inputs of each node have a link coming in (by node id). */
export function linkedInputCounts(edges: SpokenEdgeInput[]): Map<string, number> {
  const seen = new Map<string, Set<string>>();
  for (const edge of edges) {
    const set = seen.get(edge.target) ?? new Set<string>();
    set.add(edge.targetHandle ?? edge.id);
    seen.set(edge.target, set);
  }
  return new Map(Array.from(seen, ([id, set]) => [id, set.size]));
}

function portName(node: SpokenNodeInput | undefined, side: 'inputs' | 'outputs', handle: string | null | undefined): string {
  if (!handle) return '';
  const port = node ? ports(node.data, side).find((item) => item.id === handle) : undefined;
  return port?.name ?? handle;
}

/**
 * The accessible name of one link, in the words of the canvas:
 * "Link from Load Checkpoint · CLIP to Positive · clip, type CLIP".
 */
export function edgeSpeech(edge: SpokenEdgeInput, nodes: Map<string, SpokenNodeInput>, say: Say, titles: Map<string, string>): string {
  const from = nodes.get(edge.source);
  const to = nodes.get(edge.target);
  return say('a11y.edge', {
    from: titles.get(edge.source) ?? edge.source,
    output: portName(from, 'outputs', edge.sourceHandle),
    to: titles.get(edge.target) ?? edge.target,
    input: portName(to, 'inputs', edge.targetHandle),
    type: edge.data?.dataType ?? '',
  });
}

/** A link is a Tab stop only while it or one of its two nodes is selected. */
export function edgeFocusable(edge: SpokenEdgeInput, selectedNodes: Set<string>): boolean {
  return Boolean(edge.selected) || selectedNodes.has(edge.source) || selectedNodes.has(edge.target);
}
