import { carriesSecret } from '../config/draft';

/**
 * A read-only summary of the graph for the model: ids, class types, titles, ports, connections, every widget
 * value, positions, sizes, the selection, groups and subgraph instances. The agent sees what the person sees.
 * The only filter is redaction: a value that looks like a key or token becomes "[redacted]" and never reaches a prompt.
 */
/** `handle` is what connectNodes takes (in-N / out-N, in socket order). */
export interface GraphPortSummary { slot: number; handle: string; name: string; type: string }
export interface GraphParameterSummary { name: string; value: string }
export interface GraphNodeSummary {
  id: string;
  classType: string;
  title: string;
  inputs: GraphPortSummary[];
  outputs: GraphPortSummary[];
  purpose: string;
  /** Widget values by name (or widget[N] for positional values), clipped and redacted. */
  parameters: GraphParameterSummary[];
  /** Canvas position, rounded. */
  position: { x: number; y: number } | null;
  /** Size on the canvas when known, rounded. */
  size: { width: number; height: number } | null;
  selected: boolean;
  /** Pinned in ComfyUI or not draggable here. */
  locked: boolean;
  /** "bypassed" or "muted" when the node does not run; empty otherwise. */
  mode: string;
  /** Subgraph definition id when the node is a subgraph instance. */
  subgraphId: string;
}
export interface GraphEdgeSummary {
  id: string;
  source: string;
  sourceHandle: string;
  sourceName: string;
  target: string;
  targetHandle: string;
  targetName: string;
  type: string;
}
export interface GraphGroupSummary { id: string; title: string; nodeIds: string[] }
export interface GraphSubgraphSummary { id: string; name: string; instances: string[]; inner: number }
export interface GraphSummary {
  nodes: GraphNodeSummary[];
  edges: GraphEdgeSummary[];
  groups: GraphGroupSummary[];
  subgraphs: GraphSubgraphSummary[];
  processTitle: string;
  omittedNodes: number;
  omittedEdges: number;
  /** Nodes in the whole graph. */
  totalNodes: number;
  /** Where this page starts in graph order. */
  offset: number;
  /** The offset of the next page, or null when the listing reached the end. */
  nextOffset: number | null;
}

export interface SummarizeOptions {
  /** Node ids the person has selected (the projection itself does not carry the selection). */
  selectedIds?: readonly string[];
  /** Nodes listed even past the cap: the selection, the object asked about, nodes touched recently. */
  priorityIds?: readonly string[];
  /** First node of the page in graph order. Default 0. */
  offset?: number;
  /** Nodes per page. Default 60 (the prompt); getGraph uses 200. */
  limit?: number;
  /** Only these nodes (and the connections that touch them). Overrides offset. */
  ids?: readonly string[];
  /** Preferences ▸ Privacy ▸ "Send field values" off: the summary carries no widget values at all. */
  omitValues?: boolean;
}

/** Nodes the prompt lists before it asks the model to page with getGraph. */
export const PROMPT_NODE_CAP = 60;
/** Default page size of the getGraph tool. */
export const GRAPH_PAGE_LIMIT = 200;
const PRIORITY_CAP = 40;
const EDGE_CAP = 120;
const TEXT_CAP = 160;
/** Each widget value is clipped to this many characters. */
export const PARAMETER_CAP = 200;
const PARAMETERS_PER_NODE = 40;
/** Widget names that name a credential, even when the value itself looks harmless. */
const SECRET_NAME = /(api[_-]?key|token|secret|password|passwd|authorization|credential|bearer)/i;

/** Clips and redacts free text that came from the graph. */
export function safeText(value: unknown, cap = TEXT_CAP): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed === '') return '';
  if (carriesSecret({ value: trimmed })) return '[redacted]';
  return trimmed.length > cap ? `${trimmed.slice(0, cap)}…` : trimmed;
}

function valueText(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

/**
 * One widget value as the model may see it: stringified, whitespace folded, clipped to 200 characters, and
 * "[redacted]" when the value or the widget name looks like a secret.
 */
export function safeParameter(name: string, value: unknown, cap = PARAMETER_CAP): string {
  const text = valueText(value).replace(/\s+/g, ' ').trim();
  if (SECRET_NAME.test(name) || carriesSecret({ [name]: text }) || carriesSecret({ value: text })) return '[redacted]';
  return text.length > cap ? `${text.slice(0, cap)}…` : text;
}

type Loose = Record<string, unknown>;

function record(value: unknown): Loose | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Loose : null;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function ports(value: unknown, prefix: 'in' | 'out'): GraphPortSummary[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).map((port, slot) => {
    const item = record(port) ?? {};
    const handle = typeof item.id === 'string' && /^(in|out)-\d+$/.test(item.id) ? item.id : `${prefix}-${slot}`;
    return { slot, handle, name: safeText(item.name, 80), type: safeText(item.dataType ?? item.type, 40) };
  });
}

/** Port name for a handle: "out-2", "in-0", "2", or the name itself. */
export function slotName(list: GraphPortSummary[], handle: string): string {
  const match = /^(?:in-|out-)?(\d+)$/.exec(handle);
  const slot = match ? Number(match[1]) : -1;
  return list[slot]?.name ?? list.find((port) => port.name === handle)?.name ?? '';
}

function parametersOf(data: Loose): GraphParameterSummary[] {
  const named = record(data.parameters);
  const list: GraphParameterSummary[] = [];
  if (named && Object.keys(named).length > 0) {
    for (const [name, value] of Object.entries(named)) list.push({ name: safeText(name, 80) || name.slice(0, 80), value: safeParameter(name, value) });
  } else {
    const comfy = record(data.comfy);
    const widgets = comfy?.widgets_values;
    if (Array.isArray(widgets)) {
      widgets.forEach((value, index) => list.push({ name: `widget[${index}]`, value: safeParameter(`widget[${index}]`, value) }));
    } else if (record(widgets)) {
      for (const [name, value] of Object.entries(record(widgets)!)) list.push({ name: name.slice(0, 80), value: safeParameter(name, value) });
    }
  }
  return list.slice(0, PARAMETERS_PER_NODE);
}

function positionOf(node: Loose): { x: number; y: number } | null {
  const position = record(node.position);
  const x = finite(position?.x);
  const y = finite(position?.y);
  return x === null || y === null ? null : { x: Math.round(x), y: Math.round(y) };
}

function sizeOf(node: Loose, data: Loose): { width: number; height: number } | null {
  const measured = record(node.measured);
  const width = finite(measured?.width) ?? finite(node.width);
  const height = finite(measured?.height) ?? finite(node.height);
  if (width !== null && height !== null) return { width: Math.round(width), height: Math.round(height) };
  const size = record(data.comfy)?.size;
  if (Array.isArray(size) && finite(size[0]) !== null && finite(size[1]) !== null) {
    return { width: Math.round(size[0] as number), height: Math.round(size[1] as number) };
  }
  return null;
}

function lockedOf(node: Loose, data: Loose): boolean {
  if (node.draggable === false || data.locked === true) return true;
  const flags = record(record(data.comfy)?.flags);
  return flags?.pinned === true;
}

function modeOf(data: Loose): string {
  const mode = record(data.comfy)?.mode;
  if (mode === 4) return 'bypassed';
  if (mode === 2) return 'muted';
  return '';
}

export function summarizeGraph(
  snapshot: { nodes?: unknown; edges?: unknown; components?: unknown; process?: unknown; groups?: unknown; subgraphs?: unknown } | null | undefined,
  options: SummarizeOptions = {},
): GraphSummary {
  const rawNodes = Array.isArray(snapshot?.nodes) ? snapshot!.nodes as unknown[] : [];
  const rawEdges = Array.isArray(snapshot?.edges) ? snapshot!.edges as unknown[] : [];
  const components = Array.isArray(snapshot?.components) ? snapshot!.components as unknown[] : [];
  const selected = new Set(options.selectedIds ?? []);
  const purposeOf = (id: string): string => {
    const found = components.map(record).find((item) => item?.ownerKind === 'node' && item?.ownerId === id);
    return safeText(found?.purpose);
  };
  const all: GraphNodeSummary[] = rawNodes.map((raw) => {
    const node = record(raw) ?? {};
    const data = record(node.data) ?? {};
    const id = String(node.id ?? '');
    return {
      id,
      classType: safeText(data.comfyType ?? node.type, 120) || 'unknown',
      title: safeText(data.title),
      inputs: ports(data.inputs, 'in'),
      outputs: ports(data.outputs, 'out'),
      purpose: purposeOf(id),
      parameters: options.omitValues ? [] : parametersOf(data),
      position: positionOf(node),
      size: sizeOf(node, data),
      selected: selected.has(id) || node.selected === true,
      locked: lockedOf(node, data),
      mode: modeOf(data),
      subgraphId: data.kind === 'subgraph-instance' ? safeText(data.subgraphId ?? data.comfyType, 120) : '',
    };
  });
  const byId = new Map(all.map((node) => [node.id, node]));
  const edges = rawEdges.map((raw) => {
    const edge = record(raw) ?? {};
    const data = record(edge.data) ?? {};
    const source = String(edge.source ?? '');
    const target = String(edge.target ?? '');
    const sourceHandle = String(edge.sourceHandle ?? '');
    const targetHandle = String(edge.targetHandle ?? '');
    return {
      id: String(edge.id ?? ''),
      source,
      sourceHandle,
      sourceName: slotName(byId.get(source)?.outputs ?? [], sourceHandle),
      target,
      targetHandle,
      targetName: slotName(byId.get(target)?.inputs ?? [], targetHandle),
      type: safeText(data.dataType, 40),
    };
  });
  const groups = (Array.isArray(snapshot?.groups) ? snapshot!.groups as unknown[] : []).slice(0, 40).map((raw) => {
    const group = record(raw) ?? {};
    return {
      id: String(group.id ?? ''),
      title: safeText(group.title),
      nodeIds: Array.isArray(group.nodeIds) ? group.nodeIds.slice(0, 60).map(String) : [],
    };
  });
  const subgraphs = (Array.isArray(snapshot?.subgraphs) ? snapshot!.subgraphs as unknown[] : []).slice(0, 40).map((raw) => {
    const definition = record(raw) ?? {};
    const id = String(definition.id ?? '');
    return {
      id,
      name: safeText(definition.name),
      instances: all.filter((node) => node.subgraphId === id || node.classType === id).map((node) => node.id),
      inner: Array.isArray(definition.nodes) ? definition.nodes.length : 0,
    };
  });
  const total = all.length;
  const limit = Math.max(1, Math.floor(options.limit ?? PROMPT_NODE_CAP));
  let listed: GraphNodeSummary[];
  let offset = 0;
  let nextOffset: number | null = null;
  if (options.ids && options.ids.length > 0) {
    const wanted = new Set(options.ids.map(String));
    listed = all.filter((node) => wanted.has(node.id)).slice(0, limit);
  } else {
    offset = Math.min(Math.max(0, Math.floor(options.offset ?? 0)), total);
    listed = all.slice(offset, offset + limit);
    nextOffset = offset + limit < total ? offset + limit : null;
    // The selection, the object asked about, and recently touched nodes are always listed, even past the cap.
    const shown = new Set(listed.map((node) => node.id));
    const priority = new Set([...(options.priorityIds ?? []), ...selected].map(String));
    const extra = all.filter((node) => (priority.has(node.id) || node.selected) && !shown.has(node.id)).slice(0, PRIORITY_CAP);
    listed = [...listed, ...extra];
  }
  const listedIds = new Set(listed.map((node) => node.id));
  const touching = edges.filter((edge) => listedIds.has(edge.source) || listedIds.has(edge.target));
  const edgeCap = Math.max(EDGE_CAP, limit * 2);
  return {
    nodes: listed,
    edges: touching.slice(0, edgeCap),
    groups,
    subgraphs,
    processTitle: safeText(record(snapshot?.process)?.title),
    omittedNodes: Math.max(0, total - listed.length),
    omittedEdges: Math.max(0, edges.length - Math.min(touching.length, edgeCap)),
    totalNodes: total,
    offset,
    nextOffset,
  };
}

function portsText(list: GraphPortSummary[]): string {
  return list.map((port) => `${port.name || port.type || '?'} (${port.handle})`).join(', ');
}

function nodeLine(node: GraphNodeSummary): string[] {
  const parts = [`- ${node.id} ${node.classType}`];
  if (node.title && node.title !== node.classType) parts.push(`"${node.title}"`);
  if (node.position) parts.push(`at (${node.position.x},${node.position.y})`);
  if (node.size) parts.push(`${node.size.width}x${node.size.height}`);
  const flags = [node.selected ? 'selected' : '', node.locked ? 'locked' : '', node.mode, node.subgraphId ? `subgraph ${node.subgraphId}` : '']
    .filter((flag) => flag !== '');
  if (flags.length > 0) parts.push(`[${flags.join(', ')}]`);
  if (node.purpose) parts.push(`purpose: ${node.purpose}`);
  const lines = [parts.join(' ')];
  const io = [
    node.inputs.length > 0 ? `inputs: ${portsText(node.inputs)}` : '',
    node.outputs.length > 0 ? `outputs: ${portsText(node.outputs)}` : '',
  ].filter((part) => part !== '');
  if (io.length > 0) lines.push(`  ${io.join('; ')}`);
  if (node.parameters.length > 0) {
    lines.push(`  fields: ${node.parameters.map((item) => `${item.name}=${item.value}`).join('; ')}`);
  }
  return lines;
}

/** Compact text form of the summary for the system prompt. */
export function graphSummaryText(summary: GraphSummary): string {
  if (summary.nodes.length === 0) return 'The graph is empty.';
  const lines = summary.nodes.flatMap(nodeLine);
  if (summary.omittedNodes > 0) {
    const page = summary.nextOffset !== null ? `getGraph({ offset: ${summary.nextOffset} })` : 'getGraph with ids';
    lines.push(`(${summary.omittedNodes} more nodes not listed; call ${page} to read them)`);
  }
  const links = summary.edges.map((edge) => {
    const from = `${edge.source}.${edge.sourceName || edge.sourceHandle}`;
    const to = `${edge.target}.${edge.targetName || edge.targetHandle}`;
    return `- ${from} -> ${to}${edge.type ? ` (${edge.type})` : ''}`;
  });
  if (summary.omittedEdges > 0) links.push(`(${summary.omittedEdges} more connections not listed)`);
  const groups = summary.groups.map((group) => `- group ${group.id}${group.title ? ` "${group.title}"` : ''}: nodes ${group.nodeIds.join(', ') || 'none'}`);
  const subgraphs = summary.subgraphs.map((item) => `- subgraph ${item.id}${item.name ? ` "${item.name}"` : ''}: ${item.inner} inner nodes, instances ${item.instances.join(', ') || 'none'}`);
  return [
    summary.processTitle ? `Process: ${summary.processTitle}` : '',
    'Nodes (fields are the widget values the person sees):',
    ...lines,
    links.length > 0 ? 'Connections:' : 'No connections yet.',
    ...links,
    groups.length > 0 ? 'Groups:' : '',
    ...groups,
    subgraphs.length > 0 ? 'Subgraphs:' : '',
    ...subgraphs,
  ].filter((line) => line !== '').join('\n');
}
