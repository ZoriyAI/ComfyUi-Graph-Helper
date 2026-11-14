import { randomUUID } from 'crypto';
import type { GraphMutation } from '../../shared/commands/types';
import { portsCompatible } from '../../shared/graph/linkTypes';
import {
  SUBGRAPH_INPUT_NODE_ID,
  SUBGRAPH_INSTANCE_KIND,
  SUBGRAPH_OUTPUT_NODE_ID,
  instancePorts,
  slotLabel,
  uniqueSlotName,
  type GroupRecord,
  type SubgraphDefinition,
  type SubgraphSlot,
} from '../../shared/graph/subgraphs';
import {
  WORKFLOW_FORMAT_V04,
  WORKFLOW_FORMAT_V1,
  groupBounding,
  makeEdge,
  nextLinkId,
  nextNodeId,
  rememberLinkId,
  rememberNodeId,
  type GraphSnapshot,
  type WorkflowDocumentState,
} from '../../shared/workflow/codec';

/** A refusal with a stable English message; commit turns it into a `rejected` response. */
export class GraphOpError extends Error {}

export const SUBGRAPH_ERRORS = {
  format: 'Subgraphs need workflow format 1.',
  nodeMissing: 'Node was not found.',
  nodeInside: 'A node is already inside a subgraph.',
  definitionMissing: 'Subgraph definition was not found.',
  notInstance: 'That node is not a subgraph instance.',
  portMissing: 'That port is not on the inner node.',
  portTaken: 'That inner input is already connected.',
  portType: 'Port types cannot be connected.',
  slotRepeated: 'A boundary slot repeats an inner port.',
  slotMissing: 'Subgraph slot was not found.',
  groupMissing: 'Group was not found.',
} as const;

type Node = Record<string, any>;
type Edge = Record<string, any>;

const GRAPH_OPS = new Set([
  'create-subgraph',
  'insert-subgraph',
  'add-subgraph-io',
  'remove-subgraph-io',
  'rename-subgraph-io',
  'rename-subgraph',
  'dissolve-subgraph',
  'add-group',
  'remove-group',
  // group rename.
  'rename-group',
]);

export function isGraphOp(payload: GraphMutation): boolean {
  return GRAPH_OPS.has(payload.type);
}

/** A blank format-1 document: the counters a canvas without an imported workflow allocates ids from. */
export function blankDocument(): WorkflowDocumentState {
  return { formatVersion: WORKFLOW_FORMAT_V1, raw: { state: { lastNodeId: 0, lastLinkId: 0, lastGroupId: 0, lastRerouteId: 0 } } };
}

/**
 * Allocates numeric node and link ids for one command, keeping the document counters monotonic.
 * A canvas with no document gets a blank one, so its ids start at 1 and never repeat after a removal.
 */
export class Ids {
  private nodeCounter: number;
  private linkCounter: number;

  constructor(private readonly work: GraphSnapshot) {
    if (!this.work.document) this.work.document = blankDocument();
    this.nodeCounter = nextNodeId(work);
    this.linkCounter = nextLinkId(work);
  }

  node(taken: Set<string>): string {
    while (taken.has(String(this.nodeCounter))) this.nodeCounter += 1;
    const id = this.nodeCounter;
    this.nodeCounter += 1;
    this.work.document = rememberNodeId(this.work.document!, id);
    return String(id);
  }

  link(): number {
    const id = this.linkCounter;
    this.linkCounter += 1;
    this.work.document = rememberLinkId(this.work.document!, id);
    return id;
  }
}

function fail(message: string): never {
  throw new GraphOpError(message);
}

function canvasFormat(work: GraphSnapshot) {
  return work.document?.formatVersion ?? WORKFLOW_FORMAT_V1;
}

function requireFormat1(work: GraphSnapshot): void {
  if (canvasFormat(work) === WORKFLOW_FORMAT_V04) fail(SUBGRAPH_ERRORS.format);
}

function findDefinition(work: GraphSnapshot, id: string): SubgraphDefinition {
  const definition = (work.subgraphs ?? []).find((item) => !item.opaque && item.id === id);
  if (!definition) fail(SUBGRAPH_ERRORS.definitionMissing);
  return definition;
}

function port(node: Node, direction: 'input' | 'output', handle: string): { name: string; dataType: string } | null {
  const list = Array.isArray(node.data?.[direction === 'input' ? 'inputs' : 'outputs']) ? node.data[direction === 'input' ? 'inputs' : 'outputs'] : [];
  const found = list.find((item: { id?: string }) => item.id === handle);
  if (!found) return null;
  return { name: typeof found.name === 'string' ? found.name : handle, dataType: typeof found.dataType === 'string' ? found.dataType : '*' };
}

function idValue(id: string): string | number {
  return /^\d+$/.test(id) ? Number(id) : id;
}

function centre(nodes: Node[]): { x: number; y: number; minX: number; maxX: number } {
  const xs = nodes.map((node) => node.position?.x ?? 0);
  const ys = nodes.map((node) => node.position?.y ?? 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  return { x: (minX + maxX) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, minX, maxX };
}

function comfySlots(definition: SubgraphDefinition, previous?: Record<string, any>, removed?: { direction: 'input' | 'output'; index: number }) {
  const take = (key: 'inputs' | 'outputs', slots: SubgraphSlot[], empty: (slot: SubgraphSlot) => Record<string, unknown>) => {
    let list: unknown[] = Array.isArray(previous?.[key]) ? [...previous![key]] : [];
    if (removed && (removed.direction === 'input') === (key === 'inputs')) list.splice(removed.index, 1);
    if (!previous || key in previous || slots.length > 0) {
      list = slots.map((slot, index) => {
        const old = list[index];
        const base = old && typeof old === 'object' ? { ...(old as Record<string, unknown>) } : empty(slot);
        const label = slotLabel(slot);
        const next: Record<string, unknown> = { ...base, name: slot.name, type: slot.type };
        if (label !== slot.name) next.label = label;
        else delete next.label;
        return next;
      });
      return list;
    }
    return undefined;
  };
  return {
    inputs: take('inputs', definition.inputs, () => ({ link: null })),
    outputs: take('outputs', definition.outputs, () => ({ links: [] })),
  };
}

export function instanceNode(id: string, definition: SubgraphDefinition, x: number, y: number, title?: string): Node {
  const ports = instancePorts(definition);
  const slots = comfySlots(definition);
  const name = title || definition.name;
  return {
    id,
    type: 'comfy',
    position: { x, y },
    data: {
      comfyType: definition.id,
      kind: SUBGRAPH_INSTANCE_KIND,
      subgraphId: definition.id,
      title: name,
      inputs: ports.inputs,
      outputs: ports.outputs,
      parameters: {},
      annotations: [],
      comfy: {
        id: idValue(id),
        type: definition.id,
        title: name,
        pos: [x, y],
        size: [220, Math.max(60, 26 * Math.max(definition.inputs.length, definition.outputs.length) + 40)],
        flags: {},
        order: 0,
        mode: 0,
        properties: {},
        inputs: slots.inputs,
        outputs: slots.outputs,
      },
    },
  };
}

/** Rebuild ports of every instance of a definition, on the canvas and inside definitions. */
function refreshInstances(work: GraphSnapshot, definition: SubgraphDefinition, removed?: { direction: 'input' | 'output'; index: number }): void {
  const refresh = (node: Node) => {
    if (node.data?.comfyType !== definition.id) return;
    const ports = instancePorts(definition);
    const comfy = node.data.comfy && typeof node.data.comfy === 'object' ? { ...node.data.comfy } : null;
    if (comfy) {
      const slots = comfySlots(definition, comfy, removed);
      if (slots.inputs) comfy.inputs = slots.inputs;
      if (slots.outputs) comfy.outputs = slots.outputs;
    }
    node.data = { ...node.data, kind: SUBGRAPH_INSTANCE_KIND, subgraphId: definition.id, inputs: ports.inputs, outputs: ports.outputs, ...(comfy ? { comfy } : {}) };
  };
  work.nodes.forEach(refresh);
  for (const item of work.subgraphs ?? []) item.nodes.forEach(refresh);
}

function slotIndex(handle: unknown): number {
  const match = /^(?:in|out)-(\d+)$/.exec(String(handle ?? ''));
  return match ? Number(match[1]) : -1;
}

function newDefinitionRaw(name: string, moved: Node[]): Record<string, unknown> {
  const box = centre(moved);
  return {
    version: 1,
    revision: 0,
    state: { lastNodeId: 0, lastLinkId: 0, lastGroupId: 0, lastRerouteId: 0 },
    config: {},
    name,
    inputNode: { id: -10, bounding: [box.minX - 240, box.y, 120, 60] },
    outputNode: { id: -20, bounding: [box.maxX + 300, box.y, 120, 60] },
    inputs: [],
    outputs: [],
    widgets: [],
    nodes: [],
    links: [],
    groups: [],
    extra: {},
  };
}

function createSubgraph(work: GraphSnapshot, ids: Ids, payload: Extract<GraphMutation, { type: 'create-subgraph' }>) {
  requireFormat1(work);
  const wanted = [...new Set(payload.nodeIds)];
  const canvasIds = new Set(work.nodes.map((node) => String(node.id)));
  for (const id of wanted) {
    if (canvasIds.has(id)) continue;
    const inside = (work.subgraphs ?? []).some((definition) => definition.nodes.some((node) => String(node.id) === id));
    fail(inside ? SUBGRAPH_ERRORS.nodeInside : SUBGRAPH_ERRORS.nodeMissing);
  }
  const set = new Set(wanted);
  const moved = work.nodes.filter((node) => set.has(String(node.id)));
  const innerEdges = work.edges.filter((edge) => set.has(String(edge.source)) && set.has(String(edge.target)));
  const incoming = work.edges.filter((edge) => !set.has(String(edge.source)) && set.has(String(edge.target)));
  const outgoing = work.edges.filter((edge) => set.has(String(edge.source)) && !set.has(String(edge.target)));
  const byId = new Map(moved.map((node) => [String(node.id), node]));

  const inputs: SubgraphSlot[] = [];
  const outputs: SubgraphSlot[] = [];
  const inputKeys: string[] = [];
  const outputKeys: string[] = [];
  const addSlot = (direction: 'input' | 'output', name: string, type: string, nodeId: string, handle: string, listed: boolean) => {
    const node = byId.get(nodeId);
    if (!node) fail(SUBGRAPH_ERRORS.portMissing);
    const found = port(node, direction, handle);
    if (!found) fail(SUBGRAPH_ERRORS.portMissing);
    const keys = direction === 'input' ? inputKeys : outputKeys;
    const key = `${nodeId}\u0000${handle}`;
    if (keys.includes(key)) {
      if (listed) fail(SUBGRAPH_ERRORS.slotRepeated);
      return;
    }
    if (direction === 'input') {
      if (innerEdges.some((edge) => String(edge.target) === nodeId && edge.targetHandle === handle)) fail(SUBGRAPH_ERRORS.portTaken);
      if (!portsCompatible(type, found.dataType)) fail(SUBGRAPH_ERRORS.portType);
    } else if (!portsCompatible(found.dataType, type)) {
      fail(SUBGRAPH_ERRORS.portType);
    }
    keys.push(key);
    const list = direction === 'input' ? inputs : outputs;
    const title = String(node.data?.title || node.data?.comfyType || '');
    list.push({ id: randomUUID(), name: uniqueSlotName(list, name || found.name, title), type: type || found.dataType });
  };
  for (const io of payload.inputs) addSlot('input', io.name, io.type, io.nodeId, io.handle, true);
  for (const io of payload.outputs) addSlot('output', io.name, io.type, io.nodeId, io.handle, true);
  // Every edge that crosses the boundary needs a slot; add one for each inner port the caller did not list.
  for (const edge of incoming) {
    const node = byId.get(String(edge.target))!;
    const found = port(node, 'input', String(edge.targetHandle ?? ''));
    addSlot('input', found?.name ?? String(edge.targetHandle), String(edge.data?.dataType ?? found?.dataType ?? '*'), String(edge.target), String(edge.targetHandle ?? ''), false);
  }
  for (const edge of outgoing) {
    const node = byId.get(String(edge.source))!;
    const found = port(node, 'output', String(edge.sourceHandle ?? ''));
    addSlot('output', found?.name ?? String(edge.sourceHandle), String(edge.data?.dataType ?? found?.dataType ?? '*'), String(edge.source), String(edge.sourceHandle ?? ''), false);
  }

  const boundary: Edge[] = [];
  inputKeys.forEach((key, index) => {
    const [nodeId, handle] = key.split('\u0000');
    boundary.push(makeEdge(ids.link(), SUBGRAPH_INPUT_NODE_ID, `out-${index}`, nodeId, handle, inputs[index].type, WORKFLOW_FORMAT_V1));
  });
  outputKeys.forEach((key, index) => {
    const [nodeId, handle] = key.split('\u0000');
    boundary.push(makeEdge(ids.link(), nodeId, handle, SUBGRAPH_OUTPUT_NODE_ID, `in-${index}`, outputs[index].type, WORKFLOW_FORMAT_V1));
  });

  const definition: SubgraphDefinition = {
    id: randomUUID(),
    name: payload.name,
    inputs,
    outputs,
    nodes: moved,
    edges: [...innerEdges, ...boundary],
    nestedIn: null,
    raw: newDefinitionRaw(payload.name, moved),
  };
  const box = centre(moved);
  const instanceId = ids.node(new Set([...canvasIds].filter((id) => !set.has(id))));
  const instance = instanceNode(instanceId, definition, box.x, box.y);
  for (const edge of incoming) {
    const index = inputKeys.indexOf(`${String(edge.target)}\u0000${String(edge.targetHandle ?? '')}`);
    edge.target = instanceId;
    edge.targetHandle = `in-${index}`;
  }
  for (const edge of outgoing) {
    const index = outputKeys.indexOf(`${String(edge.source)}\u0000${String(edge.sourceHandle ?? '')}`);
    edge.source = instanceId;
    edge.sourceHandle = `out-${index}`;
  }
  work.nodes = [...work.nodes.filter((node) => !set.has(String(node.id))), instance];
  work.edges = work.edges.filter((edge) => !innerEdges.includes(edge));
  work.subgraphs = [...(work.subgraphs ?? []), definition];
  work.groups = (work.groups ?? []).map((group) => {
    if (!group.nodeIds.some((id) => set.has(id))) return group;
    return { ...group, nodeIds: [...group.nodeIds.filter((id) => !set.has(id)), instanceId] };
  });
  return { definitionId: definition.id, nodeId: instanceId, inputs: inputs.length, outputs: outputs.length };
}

function insertSubgraph(work: GraphSnapshot, ids: Ids, payload: Extract<GraphMutation, { type: 'insert-subgraph' }>) {
  requireFormat1(work);
  const definition = findDefinition(work, payload.definitionId);
  const nodeId = ids.node(new Set(work.nodes.map((node) => String(node.id))));
  work.nodes = [...work.nodes, instanceNode(nodeId, definition, payload.x, payload.y, payload.title)];
  return { definitionId: definition.id, nodeId };
}

function addSubgraphIO(work: GraphSnapshot, ids: Ids, payload: Extract<GraphMutation, { type: 'add-subgraph-io' }>) {
  const definition = findDefinition(work, payload.definitionId);
  const node = definition.nodes.find((item) => String(item.id) === payload.nodeId);
  if (!node) fail(SUBGRAPH_ERRORS.nodeMissing);
  const found = port(node, payload.direction, payload.handle);
  if (!found) fail(SUBGRAPH_ERRORS.portMissing);
  const side = payload.direction === 'input' ? definition.inputs : definition.outputs;
  const slot: SubgraphSlot = { id: randomUUID(), name: uniqueSlotName(side, payload.name, String(node.data?.title || node.data?.comfyType || '')), type: payload.dataType };
  if (payload.direction === 'input') {
    if (definition.edges.some((edge) => String(edge.target) === payload.nodeId && edge.targetHandle === payload.handle)) fail(SUBGRAPH_ERRORS.portTaken);
    if (!portsCompatible(payload.dataType, found.dataType)) fail(SUBGRAPH_ERRORS.portType);
    definition.inputs.push(slot);
    definition.edges.push(makeEdge(ids.link(), SUBGRAPH_INPUT_NODE_ID, `out-${definition.inputs.length - 1}`, payload.nodeId, payload.handle, slot.type, WORKFLOW_FORMAT_V1));
  } else {
    if (!portsCompatible(found.dataType, payload.dataType)) fail(SUBGRAPH_ERRORS.portType);
    definition.outputs.push(slot);
    definition.edges.push(makeEdge(ids.link(), payload.nodeId, payload.handle, SUBGRAPH_OUTPUT_NODE_ID, `in-${definition.outputs.length - 1}`, slot.type, WORKFLOW_FORMAT_V1));
  }
  refreshInstances(work, definition);
  const index = (payload.direction === 'input' ? definition.inputs : definition.outputs).length - 1;
  return { definitionId: definition.id, slotId: slot.id, index };
}

/** Drop edges on slot `index` of a handle family and shift the later slots down by one. */
function dropSlotEdges(edges: Edge[], matches: (edge: Edge) => boolean, key: 'sourceHandle' | 'targetHandle', prefix: 'in' | 'out', index: number): Edge[] {
  return edges.flatMap((edge) => {
    if (!matches(edge)) return [edge];
    const slot = slotIndex(edge[key]);
    if (slot === index) return [];
    if (slot > index) return [{ ...edge, [key]: `${prefix}-${slot - 1}` }];
    return [edge];
  });
}

function removeSubgraphIO(work: GraphSnapshot, payload: Extract<GraphMutation, { type: 'remove-subgraph-io' }>) {
  const definition = findDefinition(work, payload.definitionId);
  const slots = payload.direction === 'input' ? definition.inputs : definition.outputs;
  const index = slots.findIndex((slot) => slot.id === payload.slotId);
  if (index < 0) fail(SUBGRAPH_ERRORS.slotMissing);
  slots.splice(index, 1);
  if (payload.direction === 'input') {
    definition.edges = dropSlotEdges(definition.edges, (edge) => String(edge.source) === SUBGRAPH_INPUT_NODE_ID, 'sourceHandle', 'out', index);
  } else {
    definition.edges = dropSlotEdges(definition.edges, (edge) => String(edge.target) === SUBGRAPH_OUTPUT_NODE_ID, 'targetHandle', 'in', index);
  }
  const rewire = (nodes: Node[], edges: Edge[]): Edge[] => {
    const instances = new Set(nodes.filter((node) => node.data?.comfyType === definition.id).map((node) => String(node.id)));
    if (instances.size === 0) return edges;
    return payload.direction === 'input'
      ? dropSlotEdges(edges, (edge) => instances.has(String(edge.target)), 'targetHandle', 'in', index)
      : dropSlotEdges(edges, (edge) => instances.has(String(edge.source)), 'sourceHandle', 'out', index);
  };
  work.edges = rewire(work.nodes, work.edges);
  for (const item of work.subgraphs ?? []) item.edges = rewire(item.nodes, item.edges);
  refreshInstances(work, definition, { direction: payload.direction, index });
  return { definitionId: definition.id, slotId: payload.slotId };
}

/** The slot keeps its name (links and promoted widgets use it); the name it shows becomes its `label`. */
function renameSubgraphIO(work: GraphSnapshot, payload: Extract<GraphMutation, { type: 'rename-subgraph-io' }>) {
  const definition = findDefinition(work, payload.definitionId);
  const slots = payload.direction === 'input' ? definition.inputs : definition.outputs;
  const index = slots.findIndex((slot) => slot.id === payload.slotId);
  if (index < 0) fail(SUBGRAPH_ERRORS.slotMissing);
  const slot = slots[index];
  const previous = slotLabel(slot);
  const label = payload.name.trim();
  const raw = { ...(slot.raw ?? {}) };
  if (label === slot.name) delete raw.label;
  else raw.label = label;
  slots[index] = { ...slot, raw };
  refreshInstances(work, definition);
  return { definitionId: definition.id, slotId: slot.id, name: label, previous };
}

function renameSubgraph(work: GraphSnapshot, payload: Extract<GraphMutation, { type: 'rename-subgraph' }>) {
  const definition = findDefinition(work, payload.definitionId);
  const previous = definition.name;
  definition.name = payload.name;
  const retitle = (node: Node) => {
    if (node.data?.comfyType !== definition.id || node.data?.title !== previous) return;
    const comfy = node.data.comfy && typeof node.data.comfy === 'object' ? { ...node.data.comfy } : null;
    if (comfy && comfy.title === previous) comfy.title = payload.name;
    node.data = { ...node.data, title: payload.name, ...(comfy ? { comfy } : {}) };
  };
  work.nodes.forEach(retitle);
  for (const item of work.subgraphs ?? []) item.nodes.forEach(retitle);
  return { definitionId: definition.id, name: payload.name };
}

/**
 * Values the instance holds for promoted widgets (`properties.proxyWidgets` = [[innerNodeId, widgetName], ...],
 * paired by position with the instance's widgets_values) go back to the inner nodes, so dissolving does not
 * reset what the person set on the instance. Inner nodes with keyed widgets_values take them by name;
 * positional ones by the index the inner node's own `widgets` list (when stored) gives the name.
 */
function promoteInstanceValues(instance: Node, restored: Node[], idMap: Map<string, string>): void {
  const comfy = instance.data?.comfy;
  const proxies = comfy?.properties?.proxyWidgets;
  const values = comfy?.widgets_values;
  if (!Array.isArray(proxies) || !Array.isArray(values)) return;
  proxies.forEach((pair: unknown, index: number) => {
    if (!Array.isArray(pair) || pair.length < 2 || index >= values.length) return;
    const target = restored.find((node) => String(node.id) === (idMap.get(String(pair[0])) ?? String(pair[0])));
    const inner = target?.data?.comfy;
    if (!target || !inner || typeof inner !== 'object') return;
    const name = String(pair[1]);
    const widgets = inner.widgets_values;
    if (widgets && typeof widgets === 'object' && !Array.isArray(widgets)) {
      inner.widgets_values = { ...widgets, [name]: values[index] };
      target.data.parameters = { ...(target.data.parameters ?? {}), [name]: values[index] };
      return;
    }
    const names = Array.isArray(inner.widgets) ? inner.widgets.map((item: { name?: unknown }) => String(item?.name ?? '')) : [];
    const slot = names.indexOf(name);
    if (Array.isArray(widgets) && slot >= 0 && slot < widgets.length) {
      const copy = widgets.slice();
      copy[slot] = values[index];
      inner.widgets_values = copy;
    }
  });
}

function dissolveSubgraph(work: GraphSnapshot, ids: Ids, payload: Extract<GraphMutation, { type: 'dissolve-subgraph' }>) {
  const instance = work.nodes.find((node) => String(node.id) === payload.nodeId);
  if (!instance) fail(SUBGRAPH_ERRORS.nodeMissing);
  const definition = (work.subgraphs ?? []).find((item) => !item.opaque && item.id === instance.data?.comfyType);
  if (!definition) fail(SUBGRAPH_ERRORS.notInstance);
  const format = canvasFormat(work);
  const taken = new Set(work.nodes.filter((node) => node !== instance).map((node) => String(node.id)));
  const box = definition.nodes.length > 0 ? centre(definition.nodes) : { x: 0, y: 0 };
  const dx = (instance.position?.x ?? 0) - box.x;
  const dy = (instance.position?.y ?? 0) - box.y;
  const idMap = new Map<string, string>();
  const restored = definition.nodes.map((inner) => {
    const original = String(inner.id);
    const id = taken.has(original) ? ids.node(taken) : original;
    taken.add(id);
    idMap.set(original, id);
    const position = { x: (inner.position?.x ?? 0) + dx, y: (inner.position?.y ?? 0) + dy };
    const copy: Node = structuredClone(inner);
    copy.id = id;
    copy.position = position;
    if (copy.data?.comfy && typeof copy.data.comfy === 'object') copy.data.comfy = { ...copy.data.comfy, id: idValue(id) };
    return copy;
  });
  promoteInstanceValues(instance, restored, idMap);
  const mapped = (id: unknown) => idMap.get(String(id)) ?? String(id);
  const isBoundary = (edge: Edge) => String(edge.source) === SUBGRAPH_INPUT_NODE_ID || String(edge.target) === SUBGRAPH_OUTPUT_NODE_ID;
  const created: Edge[] = [];
  for (const edge of definition.edges) {
    if (isBoundary(edge)) continue;
    created.push(makeEdge(ids.link(), mapped(edge.source), String(edge.sourceHandle), mapped(edge.target), String(edge.targetHandle), String(edge.data?.dataType ?? ''), format));
  }
  const instanceId = String(instance.id);
  const leaving = work.edges.filter((edge) => String(edge.source) === instanceId);
  for (const outer of work.edges.filter((edge) => String(edge.target) === instanceId)) {
    const slot = slotIndex(outer.targetHandle);
    const targets = definition.edges.filter((edge) => String(edge.source) === SUBGRAPH_INPUT_NODE_ID && slotIndex(edge.sourceHandle) === slot);
    for (const inner of targets) {
      const dataType = String(outer.data?.dataType ?? definition.inputs[slot]?.type ?? '');
      if (String(inner.target) === SUBGRAPH_OUTPUT_NODE_ID) {
        // A pass-through (input slot wired straight to an output slot): join the outer source to the outer targets.
        const outSlot = slotIndex(inner.targetHandle);
        for (const next of leaving.filter((edge) => slotIndex(edge.sourceHandle) === outSlot)) {
          created.push(makeEdge(ids.link(), String(outer.source), String(outer.sourceHandle), String(next.target), String(next.targetHandle), dataType, format));
        }
        continue;
      }
      created.push(makeEdge(ids.link(), String(outer.source), String(outer.sourceHandle), mapped(inner.target), String(inner.targetHandle), dataType, format));
    }
  }
  for (const outer of leaving) {
    const slot = slotIndex(outer.sourceHandle);
    const sources = definition.edges.filter((edge) => (
      String(edge.target) === SUBGRAPH_OUTPUT_NODE_ID && slotIndex(edge.targetHandle) === slot && String(edge.source) !== SUBGRAPH_INPUT_NODE_ID
    ));
    for (const inner of sources) {
      created.push(makeEdge(ids.link(), mapped(inner.source), String(inner.sourceHandle), String(outer.target), String(outer.targetHandle), String(outer.data?.dataType ?? definition.outputs[slot]?.type ?? ''), format));
    }
  }
  work.nodes = [...work.nodes.filter((node) => node !== instance), ...restored];
  work.edges = [...work.edges.filter((edge) => String(edge.source) !== instanceId && String(edge.target) !== instanceId), ...created];
  work.groups = (work.groups ?? []).map((group) => (
    group.nodeIds.includes(instanceId)
      ? { ...group, nodeIds: [...group.nodeIds.filter((id) => id !== instanceId), ...restored.map((node) => String(node.id))] }
      : group
  ));
  const stillUsed = work.nodes.some((node) => node.data?.comfyType === definition.id)
    || (work.subgraphs ?? []).some((item) => item !== definition && item.nodes.some((node) => node.data?.comfyType === definition.id));
  if (!stillUsed) work.subgraphs = (work.subgraphs ?? []).filter((item) => item !== definition);
  return { nodeId: payload.nodeId, definitionId: definition.id, nodeIds: restored.map((node) => String(node.id)), definitionRemoved: !stillUsed };
}

function nextGroupId(work: GraphSnapshot): string {
  const raw = work.document?.raw;
  const state = raw?.state && typeof raw.state === 'object' ? (raw.state as Record<string, unknown>) : {};
  const stored = typeof state.lastGroupId === 'number' ? state.lastGroupId : 0;
  const ids = (work.groups ?? []).flatMap((group) => {
    const rawId = group.raw?.id;
    const values = [group.id, rawId].filter((value) => /^\d+$/.test(String(value))).map(Number);
    return values;
  });
  return String(Math.max(stored, 0, ...ids) + 1);
}

function addGroup(work: GraphSnapshot, payload: Extract<GraphMutation, { type: 'add-group' }>) {
  const wanted = [...new Set(payload.nodeIds)];
  const members = wanted.map((id) => work.nodes.find((node) => String(node.id) === id));
  if (members.some((node) => !node)) fail(SUBGRAPH_ERRORS.nodeMissing);
  const group: GroupRecord = { id: nextGroupId(work), title: payload.title, nodeIds: wanted, bounding: groupBounding(members as Node[]) };
  if (payload.color !== undefined) group.color = payload.color;
  work.groups = [...(work.groups ?? []), group];
  return { groupId: group.id };
}

function removeGroup(work: GraphSnapshot, payload: Extract<GraphMutation, { type: 'remove-group' }>) {
  if (!(work.groups ?? []).some((group) => group.id === payload.groupId)) fail(SUBGRAPH_ERRORS.groupMissing);
  work.groups = (work.groups ?? []).filter((group) => group.id !== payload.groupId);
  return { groupId: payload.groupId };
}

// --- group rename (begin) ---
/** The title is the only change: members, colour, bounds and native fields stay; export writes `title` from it. */
function renameGroup(work: GraphSnapshot, payload: Extract<GraphMutation, { type: 'rename-group' }>) {
  const group = (work.groups ?? []).find((item) => item.id === payload.groupId);
  if (!group) fail(SUBGRAPH_ERRORS.groupMissing);
  const previous = group.title;
  group.title = payload.title.trim();
  return { groupId: group.id, title: group.title, previous };
}
// --- group rename (end) ---

/**
 * Apply a subgraph or group mutation to a copy of the snapshot. Inputs are never mutated.
 * Throws GraphOpError for a refusal.
 */
export function applyGraphOp(snapshot: GraphSnapshot, _actionId: string, payload: GraphMutation): { snapshot: GraphSnapshot; result: Record<string, unknown> } {
  const work: GraphSnapshot = {
    ...snapshot,
    nodes: structuredClone(snapshot.nodes),
    edges: structuredClone(snapshot.edges),
    subgraphs: structuredClone(snapshot.subgraphs ?? []),
    groups: structuredClone(snapshot.groups ?? []),
  };
  const ids = new Ids(work);
  let result: Record<string, unknown>;
  switch (payload.type) {
    case 'create-subgraph': result = createSubgraph(work, ids, payload); break;
    case 'insert-subgraph': result = insertSubgraph(work, ids, payload); break;
    case 'add-subgraph-io': result = addSubgraphIO(work, ids, payload); break;
    case 'remove-subgraph-io': result = removeSubgraphIO(work, payload); break;
    case 'rename-subgraph-io': result = renameSubgraphIO(work, payload); break;
    case 'rename-subgraph': result = renameSubgraph(work, payload); break;
    case 'dissolve-subgraph': result = dissolveSubgraph(work, ids, payload); break;
    case 'add-group': result = addGroup(work, payload); break;
    case 'remove-group': result = removeGroup(work, payload); break;
    case 'rename-group': result = renameGroup(work, payload); break;
    default: throw new Error(`Not a graph op: ${payload.type}`);
  }
  return { snapshot: work, result };
}
