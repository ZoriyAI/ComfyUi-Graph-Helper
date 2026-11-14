import { carriesSecret } from '../config/draft';
import { GRAPH_PAGE_DEFAULT, PROMPT_FULL_GRAPH_NODES } from './limits';

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
  /** Connections in the whole graph. */
  totalEdges: number;
  /** The selection, the object asked about and recently touched nodes: listed in full even in a compact prompt. */
  focusIds?: string[];
}

export interface SummarizeOptions {
  /** Node ids the person has selected (the projection itself does not carry the selection). */
  selectedIds?: readonly string[];
  /** Nodes listed even past the cap: the selection, the object asked about, nodes touched recently. */
  priorityIds?: readonly string[];
  /** First node of the page in graph order. Default 0. */
  offset?: number;
  /** Nodes per page. Default: every node (the prompt); getGraph pages by 200 unless asked for more. */
  limit?: number;
  /** Only these nodes (and the connections that touch them). Overrides offset. */
  ids?: readonly string[];
  /** Preferences ▸ Privacy ▸ "Send field values" off: the summary carries no widget values at all. */
  omitValues?: boolean;
  /**
   * getGraph: titles, notes and widget values are returned whole. The prompt (false) shortens a very long value
   * and marks it with "[+N chars]" so the model knows getGraph({ ids }) has the rest.
   */
  fullText?: boolean;
  /**
   * The widgets_values slot names of a class, from the installed catalog (when reliable). A value stored by
   * position in an imported workflow is then named (seed, steps, cfg) instead of widget[N].
   */
  widgetNames?: (classType: string) => readonly string[] | null | undefined;
}

/** Default page size of the getGraph tool (no maximum). */
export const GRAPH_PAGE_LIMIT = GRAPH_PAGE_DEFAULT;
/**
 * In the prompt only, a single title or note longer than this is shortened with a visible "[+N chars]" marker;
 * getGraph returns it whole. Keeps one pasted essay from crowding out the rest of the graph.
 */
const TEXT_CAP = 500;
/** In the prompt only, one widget value longer than this is shortened with a visible marker; getGraph returns it whole. */
export const PARAMETER_CAP = 2000;
/**
 * Widget names that name a credential, even when the value itself looks harmless: `api_key`, `token`, a field called
 * `key` or `auth` or ending in `_key` (`FAL_KEY`), and `<service>key` (`civitaikey`). `keyframe` and `monkey` are not.
 */
const SECRET_NAME = /(api[_-]?key|token|secret|password|passwd|authorization|credential|bearer)|(?:^|[_\-\s])(?:key|auth)$|(?:openai|civitai|fal|replicate|elevenlabs|gemini|google|anthropic|stability|runway|hf|huggingface|groq|kling|luma)[_\-]?key/i;

/** True when a field looks like it holds a key or token: by its name, or by its value. */
export function isSecretField(name: string, value: unknown): boolean {
  const text = valueText(value).replace(/\s+/g, ' ').trim();
  if (text === '' || text === 'null' || text === 'undefined') return false;
  return SECRET_NAME.test(name) || carriesSecret({ [name]: text }) || carriesSecret({ value: text });
}

/** Clips and redacts free text that came from the graph. */
export function safeText(value: unknown, cap = TEXT_CAP): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed === '') return '';
  if (carriesSecret({ value: trimmed })) return '[redacted]';
  return clip(trimmed, cap);
}

/** Shortens text past `cap` and says how much is left out, so the omission is never silent. */
function clip(text: string, cap: number): string {
  return text.length > cap ? `${text.slice(0, cap)}… [+${text.length - cap} chars]` : text;
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
 * One widget value as the model may see it: stringified, whitespace folded, past `cap` characters shortened with
 * a "[+N chars]" marker (no cap by default), and "[redacted]" when the value or the widget name looks like a secret.
 */
export function safeParameter(name: string, value: unknown, cap = Number.POSITIVE_INFINITY): string {
  const text = valueText(value).replace(/\s+/g, ' ').trim();
  if (SECRET_NAME.test(name) || carriesSecret({ [name]: text }) || carriesSecret({ value: text })) return '[redacted]';
  return clip(text, cap);
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
  return value.map((port, slot) => {
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

function parametersOf(data: Loose, cap: number, names?: readonly string[] | null): GraphParameterSummary[] {
  const named = record(data.parameters);
  const list: GraphParameterSummary[] = [];
  if (named && Object.keys(named).length > 0) {
    for (const [name, value] of Object.entries(named)) list.push({ name: safeText(name, 200) || name, value: safeParameter(name, value, cap) });
  } else {
    const comfy = record(data.comfy);
    const widgets = comfy?.widgets_values;
    if (Array.isArray(widgets)) {
      // Named by the class's widget order when the catalog knows it and the counts agree; else by position.
      const named = names && names.length === widgets.length ? names : null;
      widgets.forEach((value, index) => {
        const name = named?.[index] || `widget[${index}]`;
        list.push({ name, value: safeParameter(name, value, cap) });
      });
    } else if (record(widgets)) {
      for (const [name, value] of Object.entries(record(widgets)!)) list.push({ name, value: safeParameter(name, value, cap) });
    }
  }
  return list;
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
  const textCap = options.fullText ? Number.POSITIVE_INFINITY : TEXT_CAP;
  const valueCap = options.fullText ? Number.POSITIVE_INFINITY : PARAMETER_CAP;
  const purposes = new Map<string, unknown>();
  for (const item of components.map(record)) {
    if (item?.ownerKind === 'node' && typeof item.ownerId === 'string' && !purposes.has(item.ownerId)) purposes.set(item.ownerId, item.purpose);
  }
  const purposeOf = (id: string): string => safeText(purposes.get(id), textCap);
  const all: GraphNodeSummary[] = rawNodes.map((raw) => {
    const node = record(raw) ?? {};
    const data = record(node.data) ?? {};
    const id = String(node.id ?? '');
    return {
      id,
      classType: safeText(data.comfyType ?? node.type, 120) || 'unknown',
      title: safeText(data.title, textCap),
      inputs: ports(data.inputs, 'in'),
      outputs: ports(data.outputs, 'out'),
      purpose: purposeOf(id),
      parameters: options.omitValues ? [] : parametersOf(data, valueCap, options.widgetNames?.(String(data.comfyType ?? node.type ?? ''))),
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
  const groups = (Array.isArray(snapshot?.groups) ? snapshot!.groups as unknown[] : []).map((raw) => {
    const group = record(raw) ?? {};
    return {
      id: String(group.id ?? ''),
      title: safeText(group.title, textCap),
      nodeIds: Array.isArray(group.nodeIds) ? group.nodeIds.map(String) : [],
    };
  });
  const subgraphs = (Array.isArray(snapshot?.subgraphs) ? snapshot!.subgraphs as unknown[] : []).map((raw) => {
    const definition = record(raw) ?? {};
    const id = String(definition.id ?? '');
    return {
      id,
      name: safeText(definition.name, textCap),
      instances: all.filter((node) => node.subgraphId === id || node.classType === id).map((node) => node.id),
      inner: Array.isArray(definition.nodes) ? definition.nodes.length : 0,
    };
  });
  const total = all.length;
  const requested = options.limit === undefined || !Number.isFinite(options.limit) ? total : Math.floor(options.limit);
  const limit = Math.max(1, requested);
  const priority = new Set([...(options.priorityIds ?? []), ...selected].map(String));
  const focusIds = all.filter((node) => priority.has(node.id) || node.selected).map((node) => node.id);
  let listed: GraphNodeSummary[];
  let offset = 0;
  let nextOffset: number | null = null;
  if (options.ids && options.ids.length > 0) {
    // Exactly the nodes asked for, however many.
    const wanted = new Set(options.ids.map(String));
    listed = all.filter((node) => wanted.has(node.id));
  } else {
    offset = Math.min(Math.max(0, Math.floor(options.offset ?? 0)), total);
    listed = all.slice(offset, offset + limit);
    nextOffset = offset + limit < total ? offset + limit : null;
    // The selection, the object asked about, and recently touched nodes are always listed, whatever the page.
    const shown = new Set(listed.map((node) => node.id));
    const focus = new Set(focusIds);
    listed = [...listed, ...all.filter((node) => focus.has(node.id) && !shown.has(node.id))];
  }
  const listedIds = new Set(listed.map((node) => node.id));
  // Every connection that touches a listed node; nothing is dropped.
  const touching = edges.filter((edge) => listedIds.has(edge.source) || listedIds.has(edge.target));
  return {
    nodes: listed,
    edges: touching,
    groups,
    subgraphs,
    processTitle: safeText(record(snapshot?.process)?.title, textCap),
    omittedNodes: Math.max(0, total - listed.length),
    omittedEdges: Math.max(0, edges.length - touching.length),
    totalNodes: total,
    totalEdges: edges.length,
    offset,
    nextOffset,
    ...(focusIds.length > 0 ? { focusIds } : {}),
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

/** One short line per node for a large graph: id, class, title and flags. */
function compactLine(node: GraphNodeSummary): string {
  const parts = [`- ${node.id} ${node.classType}`];
  if (node.title && node.title !== node.classType) parts.push(`"${node.title}"`);
  const flags = [node.selected ? 'selected' : '', node.locked ? 'locked' : '', node.mode, node.subgraphId ? `subgraph ${node.subgraphId}` : '']
    .filter((flag) => flag !== '');
  if (flags.length > 0) parts.push(`[${flags.join(', ')}]`);
  return parts.join(' ');
}

export interface GraphTextOptions {
  /** Up to this many listed nodes, every node is written in full; past it, compact lines. Default 300. */
  fullNodes?: number;
  /**
   * A small context window: a short plan of the graph instead of the whole graph. Each node by id, class, title
   * and flags, each connection by id and port name, no positions, sizes, ports or field values (the focus nodes
   * are still written in full). The model reads the rest with getGraph({ ids }).
   */
  plan?: boolean;
}

/** The short plan of the graph for a small context window (see GraphTextOptions.plan). */
function planText(summary: GraphSummary): string {
  const focus = new Set(summary.focusIds ?? []);
  const links = summary.edges.map((edge) => `- ${edge.source}.${edge.sourceName || edge.sourceHandle} -> ${edge.target}.${edge.targetName || edge.targetHandle}`);
  const detailed = summary.nodes.filter((node) => focus.has(node.id));
  return [
    summary.processTitle ? `Process: ${summary.processTitle}` : '',
    `A short plan of the graph (${summary.totalNodes} nodes, ${summary.totalEdges} connections): no positions, ports or field values here. Call getGraph({ ids: [...] }) for the nodes you need before you answer about their fields or change them.`,
    'Nodes:',
    ...summary.nodes.map(compactLine),
    summary.omittedNodes > 0 ? `(${summary.omittedNodes} more nodes not listed; getGraph returns them)` : '',
    links.length > 0 ? 'Connections:' : 'No connections yet.',
    ...links,
    detailed.length > 0 ? 'In full (selected, asked about, or touched recently):' : '',
    ...detailed.flatMap(nodeLine),
  ].filter((line) => line !== '').join('\n');
}

/**
 * Compact text form of the summary for the system prompt. Up to 300 nodes the whole graph is written out (fields
 * per the privacy preference, ports, every connection). A larger graph lists every node by id, class and title,
 * writes the focus nodes (selection, asked about, recently touched) in full, and tells the model to read fields
 * and connections with getGraph({ offset }). Nothing is left out without saying so.
 */
export function graphSummaryText(summary: GraphSummary, options: GraphTextOptions = {}): string {
  if (summary.nodes.length === 0) return summary.totalNodes > 0 ? `The graph has ${summary.totalNodes} nodes; call getGraph({ offset: 0 }) to read them.` : 'The graph is empty.';
  if (options.plan) return planText(summary);
  const fullNodes = options.fullNodes ?? PROMPT_FULL_GRAPH_NODES;
  const compact = summary.nodes.length > fullNodes;
  const focus = new Set(summary.focusIds ?? []);
  const lines = compact ? summary.nodes.map(compactLine) : summary.nodes.flatMap(nodeLine);
  if (summary.omittedNodes > 0) {
    const page = summary.nextOffset !== null ? `getGraph({ offset: ${summary.nextOffset} })` : 'getGraph with ids';
    lines.push(`(${summary.omittedNodes} more nodes not listed; call ${page} to read them)`);
  }
  const groups = summary.groups.map((group) => `- group ${group.id}${group.title ? ` "${group.title}"` : ''}: nodes ${group.nodeIds.join(', ') || 'none'}`);
  const subgraphs = summary.subgraphs.map((item) => `- subgraph ${item.id}${item.name ? ` "${item.name}"` : ''}: ${item.inner} inner nodes, instances ${item.instances.join(', ') || 'none'}`);
  const tail = [
    groups.length > 0 ? 'Groups:' : '',
    ...groups,
    subgraphs.length > 0 ? 'Subgraphs:' : '',
    ...subgraphs,
  ];
  if (compact) {
    const detailed = summary.nodes.filter((node) => focus.has(node.id));
    return [
      summary.processTitle ? `Process: ${summary.processTitle}` : '',
      `The graph has ${summary.totalNodes} nodes and ${summary.totalEdges} connections, more than ${fullNodes}, so every node is listed compactly here (id, class, "title", flags).`,
      'Ports, fields and connections are not written here: call getGraph({ offset: 0 }) and follow nextOffset until it is null to read them all, or getGraph({ ids: [...] }) for specific nodes. Read before you change an existing part of the graph.',
      'Nodes:',
      ...lines,
      detailed.length > 0 ? 'In full (selected, asked about, or touched recently):' : '',
      ...detailed.flatMap(nodeLine),
      ...tail,
    ].filter((line) => line !== '').join('\n');
  }
  const links = summary.edges.map((edge) => {
    const from = `${edge.source}.${edge.sourceName || edge.sourceHandle}`;
    const to = `${edge.target}.${edge.targetName || edge.targetHandle}`;
    return `- ${from} -> ${to}${edge.type ? ` (${edge.type})` : ''}`;
  });
  if (summary.omittedEdges > 0) links.push(`(${summary.omittedEdges} more connections between nodes not listed here; getGraph returns them)`);
  return [
    summary.processTitle ? `Process: ${summary.processTitle}` : '',
    'Nodes (fields are the widget values the person sees; a value ending in "[+N chars]" was shortened here, getGraph({ ids }) returns it whole):',
    ...lines,
    links.length > 0 ? 'Connections:' : 'No connections yet.',
    ...links,
    ...tail,
  ].filter((line) => line !== '').join('\n');
}
