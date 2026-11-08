import { carriesSecret } from '../config/draft';

/**
 * A read-only summary of the graph for the model: ids, class types, titles, ports, connections.
 * Widget values and parameters are never copied: a key typed into a field must not reach a prompt.
 */
export interface GraphPortSummary { slot: number; name: string; type: string }
export interface GraphNodeSummary {
  id: string;
  classType: string;
  title: string;
  inputs: GraphPortSummary[];
  outputs: GraphPortSummary[];
  purpose: string;
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
export interface GraphSummary {
  nodes: GraphNodeSummary[];
  edges: GraphEdgeSummary[];
  processTitle: string;
  omittedNodes: number;
  omittedEdges: number;
}

const NODE_CAP = 60;
const EDGE_CAP = 120;
const TEXT_CAP = 160;

/** Clips and redacts free text that came from the graph. */
export function safeText(value: unknown, cap = TEXT_CAP): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed === '') return '';
  if (carriesSecret({ value: trimmed })) return '[redacted]';
  return trimmed.length > cap ? `${trimmed.slice(0, cap)}…` : trimmed;
}

function record(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
}

function ports(value: unknown): GraphPortSummary[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).map((port, slot) => {
    const item = record(port) ?? {};
    return { slot, name: safeText(item.name, 80), type: safeText(item.dataType ?? item.type, 40) };
  });
}

function slotName(list: GraphPortSummary[], handle: string): string {
  const slot = /^\d+$/.test(handle) ? Number(handle) : -1;
  return list[slot]?.name ?? list.find((port) => port.name === handle)?.name ?? '';
}

export function summarizeGraph(snapshot: { nodes?: unknown; edges?: unknown; components?: unknown; process?: unknown } | null | undefined): GraphSummary {
  const rawNodes = Array.isArray(snapshot?.nodes) ? snapshot!.nodes as unknown[] : [];
  const rawEdges = Array.isArray(snapshot?.edges) ? snapshot!.edges as unknown[] : [];
  const components = Array.isArray(snapshot?.components) ? snapshot!.components as unknown[] : [];
  const purposeOf = (id: string): string => {
    const found = components.map(record).find((item) => item?.ownerKind === 'node' && item?.ownerId === id);
    return safeText(found?.purpose);
  };
  const all = rawNodes.map((raw) => {
    const node = record(raw) ?? {};
    const data = record(node.data) ?? {};
    const id = String(node.id ?? '');
    return {
      id,
      classType: safeText(data.comfyType ?? node.type, 120) || 'unknown',
      title: safeText(data.title),
      inputs: ports(data.inputs),
      outputs: ports(data.outputs),
      purpose: purposeOf(id),
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
  return {
    nodes: all.slice(0, NODE_CAP),
    edges: edges.slice(0, EDGE_CAP),
    processTitle: safeText(record(snapshot?.process)?.title),
    omittedNodes: Math.max(0, all.length - NODE_CAP),
    omittedEdges: Math.max(0, edges.length - EDGE_CAP),
  };
}

/** Compact text form of the summary for the system prompt. */
export function graphSummaryText(summary: GraphSummary): string {
  if (summary.nodes.length === 0) return 'The graph is empty.';
  const lines = summary.nodes.map((node) => {
    const parts = [`- ${node.id} ${node.classType}`];
    if (node.title && node.title !== node.classType) parts.push(`"${node.title}"`);
    if (node.purpose) parts.push(`purpose: ${node.purpose}`);
    return parts.join(' ');
  });
  if (summary.omittedNodes > 0) lines.push(`(${summary.omittedNodes} more nodes not listed; call getGraph)`);
  const links = summary.edges.map((edge) => {
    const from = `${edge.source}.${edge.sourceName || edge.sourceHandle}`;
    const to = `${edge.target}.${edge.targetName || edge.targetHandle}`;
    return `- ${from} -> ${to}${edge.type ? ` (${edge.type})` : ''}`;
  });
  if (summary.omittedEdges > 0) links.push(`(${summary.omittedEdges} more connections not listed)`);
  return [
    summary.processTitle ? `Process: ${summary.processTitle}` : '',
    'Nodes:',
    ...lines,
    links.length > 0 ? 'Connections:' : 'No connections yet.',
    ...links,
  ].filter((line) => line !== '').join('\n');
}
