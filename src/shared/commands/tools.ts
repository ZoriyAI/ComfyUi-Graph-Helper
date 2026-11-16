/**
 * Turns the model's graph tool calls into checked graph commands (mutationFromTool) and ghost drafts
 * (proposalFromTool). The model's arguments are loose: ids may be numbers, ports may be given by handle, name or
 * index, so they are normalised here and then checked by the command schema. Main's agent uses it
 * (main/agent/tools.ts, buildTools.ts, turn.ts, prompt.ts).
 */
import type { CatalogView } from '../catalog/types';
import type { ProposalDraft } from '../contracts/proposals';
import { portsForClassType } from '../graph/ports';
import { mutationSchema, type GraphMutation } from './types';
import { emptyWorkflow } from '../workflow/codec';

/**
 * Optional lookups that let tolerant tool arguments (port indices, port names) resolve to handle ids.
 * Without them an index N resolves to `in-N` / `out-N`, which matches imported and catalog ports.
 */
export interface ToolContext {
  snapshot?: { nodes: Array<Record<string, any>>; subgraphs?: Array<{ id: string; nodes: Array<Record<string, any>> }> };
  catalog?: CatalogView;
}

/** Longest note kept on a ghost. */
const NOTE_MAX = 2000;

/** A string within `max` characters, else null; an over-long text is refused, not cut. */
function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.length > max) return null;
  return value;
}

/** An id as a string: numbers are accepted because models often send them unquoted. */
function str(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/** A node's ports: from the node on the canvas, else from its class in the catalog. */
function portsOf(nodeId: string, direction: 'input' | 'output', context?: ToolContext): Array<{ id: string; name: string }> {
  const node = context?.snapshot?.nodes.find((item) => String(item.id) === nodeId);
  const key = direction === 'input' ? 'inputs' : 'outputs';
  if (node && Array.isArray(node.data?.[key])) return node.data[key];
  const classType = node?.data?.comfyType;
  if (typeof classType === 'string' && context?.catalog) return portsForClassType(classType, context.catalog)[key];
  return [];
}

/** A handle id from a handle, a port name, or a slot index. */
function resolveHandle(nodeId: string, direction: 'input' | 'output', handle: unknown, index: unknown, context?: ToolContext): string | undefined {
  const prefix = direction === 'input' ? 'in' : 'out';
  const ports = portsOf(nodeId, direction, context);
  const given = str(handle);
  if (given !== undefined) {
    if (/^(in|out)-/.test(given)) return given;
    const named = ports.find((port) => port.name === given);
    if (named) return named.id;
    if (/^\d+$/.test(given)) return ports[Number(given)]?.id ?? `${prefix}-${given}`;
    return given;
  }
  const slot = num(index);
  if (slot === undefined || !Number.isInteger(slot) || slot < 0) return undefined;
  return ports[slot]?.id ?? `${prefix}-${slot}`;
}

/** The extra boundary slots of createSubgraph; null when one of them cannot be resolved. */
function subgraphIO(value: unknown, direction: 'input' | 'output', context?: ToolContext) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const list = [];
  for (const item of value) {
    const io = record(item);
    const nodeId = str(io?.nodeId);
    if (!io) return null;
    if (!nodeId && io.handle === undefined && io.index === undefined && io.slot === undefined) {
      const name = str(io.name); const type = str(io.type);
      if (!name || !type) return null;
      list.push({ name, type }); continue;
    }
    if (!nodeId) return null;
    const handle = resolveHandle(nodeId, direction, io.handle, io.index ?? io.slot, context);
    if (!handle) return null;
    const port = portsOf(nodeId, direction, context).find((item) => item.id === handle) as { name?: string; dataType?: string } | undefined;
    const name = str(io.name) ?? port?.name;
    const type = str(io.type) ?? port?.dataType;
    if (!name || !type) return null;
    list.push({ name, type, nodeId, handle });
  }
  return list;
}

/** The unchecked command for one build tool call, or null when a required argument is missing. */
function draft(name: string, input: Record<string, unknown>, context?: ToolContext): unknown {
  if (name === 'clearCanvas') return { type: 'import-workflow', document: emptyWorkflow() };
  if (name === 'createGraphSet') {
    if (!Array.isArray(input.graphs) || input.graphs.length === 0 || input.graphs.length > 12) return null;
    const graphs = input.graphs.map(record);
    if (graphs.some((graph) => !graph || typeof graph.name !== 'string' || !graph.name.trim() || graph.name.length > 200 || (graph.description !== undefined && (typeof graph.description !== 'string' || graph.description.length > 4000)))) return null;
    const right = Math.max(0, ...(context?.snapshot?.nodes ?? []).map(node => (Number(node.position?.x) || 0) + (Number(node.width) || 300)));
    return { type: 'batch', label: 'subgraph', edits: graphs.flatMap((graph, index) => [
      { type: 'create-subgraph', name: graph!.name, description: graph!.description ?? '', nodeIds: [], inputs: [], outputs: [], widgets: [], upgradeToV1: true },
      { type: 'move-node', nodeId: `@${index * 2}`, x: right + 100 + (index % 3) * 400, y: 100 + Math.floor(index / 3) * 320 },
    ]) };
  }
  if (name === 'addNode' && typeof input.nodeType === 'string') {
    return {
      type: 'add-node',
      nodeType: input.nodeType,
      title: typeof input.title === 'string' ? input.title : undefined,
      x: num(input.x),
      y: num(input.y),
      parameters: record(input.parameters),
    };
  }
  if (name === 'annotateNode' && typeof input.nodeId === 'string' && typeof input.annotation === 'string') {
    return { type: 'annotate-node', nodeId: input.nodeId, annotation: input.annotation };
  }
  if (name === 'setComponentDocumentation') {
    const purpose = text(input.purpose, 20000);
    const usage = text(input.usage, 20000);
    if ((input.ownerKind !== 'node' && input.ownerKind !== 'subgraph') || typeof input.ownerId !== 'string' || purpose == null || usage == null) {
      return null;
    }
    return { type: 'set-component', ownerKind: input.ownerKind, ownerId: input.ownerId, purpose, usage };
  }
  if (name === 'setProcess') {
    const title = text(input.title, 500);
    const notes = text(input.notes, 20000);
    if (title == null || notes == null) return null;
    return { type: 'set-process', title, notes };
  }
  if (name === 'connectNodes') {
    // Both { source, target, sourceHandle, targetHandle } and { sourceNodeId, targetNodeId, *Handle | *Index }.
    const source = str(input.sourceNodeId ?? input.source);
    const target = str(input.targetNodeId ?? input.target);
    if (!source || !target) return null;
    const sourceHandle = resolveHandle(source, 'output', input.sourceHandle, input.sourceOutputIndex ?? input.sourceIndex, context);
    const targetHandle = resolveHandle(target, 'input', input.targetHandle, input.targetInputIndex ?? input.targetIndex, context);
    if (!sourceHandle || !targetHandle) return null;
    return { type: 'connect', source, target, sourceHandle, targetHandle };
  }
  if (name === 'setParameter') {
    const nodeId = str(input.nodeId);
    const key = str(input.key);
    if (!nodeId || !key || !('value' in input)) return null;
    const widgetIndex = num(input.widgetIndex);
    return { type: 'set-parameter', nodeId, key, value: input.value, ...(widgetIndex !== undefined ? { widgetIndex } : {}) };
  }
  if (name === 'removeNode') {
    const nodeId = str(input.nodeId);
    return nodeId ? { type: 'remove-node', nodeId } : null;
  }
  if (name === 'createSubgraph') {
    const nodeIds = Array.isArray(input.nodeIds) ? input.nodeIds.map(str) : null;
    if (!nodeIds || nodeIds.some((id) => id === undefined)) return null;
    const inputs = subgraphIO(input.inputs, 'input', context);
    const outputs = subgraphIO(input.outputs, 'output', context);
    if (!inputs || !outputs) return null;
    return { type: 'create-subgraph', name: input.name, nodeIds, inputs, outputs,
      ...(input.widgets !== undefined ? { widgets: input.widgets } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.upgradeToV1 !== undefined ? { upgradeToV1: input.upgradeToV1 } : {}),
    };
  }
  if (name === 'insertBlueprint') return { type: 'insert-blueprint', templateId: input.templateId, name: input.name, description: input.description, x: num(input.x) ?? 300, y: num(input.y) ?? 200, destinationDefinitionId: str(input.inSubgraph), upgradeToV1: input.upgradeToV1 };
  if (name === 'configureSubgraph') return { type: 'configure-subgraph', definitionId: input.definitionId, name: input.name, description: input.description ?? '', widgets: input.widgets ?? [] };
  if (name === 'insertSubgraph') {
    return {
      type: 'insert-subgraph',
      definitionId: input.definitionId,
      x: num(input.x) ?? 300,
      y: num(input.y) ?? 200,
      title: typeof input.title === 'string' ? input.title : undefined,
    };
  }
  return null;
}

/** Map a model tool call onto a graph command. Tool text is stored as data. Invalid arguments map to null. */
export function mutationFromTool(name: string, args: Record<string, unknown> | undefined, context?: ToolContext): GraphMutation | null {
  const definitionId = str(args?.inSubgraph);
  const definition = definitionId ? context?.snapshot?.subgraphs?.find((item) => item.id === definitionId) : undefined;
  const scopedContext = definition ? { ...context, snapshot: { nodes: definition.nodes } } : context;
  let candidate = draft(name, args ?? {}, scopedContext);
  if (!candidate) return null;
  if (args?.inSubgraph !== undefined && name !== 'insertBlueprint') {
    if (!definitionId) return null;
    candidate = { type: 'edit-in-subgraph', definitionId, edit: candidate };
  }
  const parsed = mutationSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/** Each proposal tool and the build tool whose arguments it shares. */
const PROPOSAL_TOOLS: Record<string, { build: string; kind: ProposalDraft['kind'] }> = {
  proposeNode: { build: 'addNode', kind: 'add-node' },
  proposeConnection: { build: 'connectNodes', kind: 'connect' },
  proposeParameter: { build: 'setParameter', kind: 'set-parameter' },
  proposeSubgraph: { build: 'createSubgraph', kind: 'create-subgraph' },
};

/**
 * Map a proposal tool call to a ghost draft. Arguments are those of the build twin plus `note`.
 * The caller adds projectId, runId and revisionId and stores it with createProposal.
 */
export function proposalFromTool(name: string, args: Record<string, unknown> | undefined, context?: ToolContext): ProposalDraft | null {
  const spec = PROPOSAL_TOOLS[name];
  if (!spec) return null;
  const { note, ...rest } = args ?? {};
  const payload = mutationFromTool(spec.build, rest, context);
  if (!payload || payload.type !== spec.kind) return null;
  return { kind: spec.kind, payload, note: typeof note === 'string' ? note.slice(0, NOTE_MAX) : '' };
}
