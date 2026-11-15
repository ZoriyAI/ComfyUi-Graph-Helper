/**
 * Editing commands a person runs by hand from the node, link and group menus of the canvas (and their shortcuts):
 * bypass or mute nodes, write a note, place a node on a link, put another class in a node's place, and colour
 * nodes and groups. The engine (commit.ts applyMutation) hands these mutations here; each one becomes one revision,
 * so one undo step, however many nodes it touches. Editor nodes (Note, Markdown Note, Reroute, Primitive; see
 * shared/graph/editorNodes.ts) are built here too, because the catalog read from ComfyUI never lists them.
 *
 * Every refusal is a plain English sentence that shared/i18n/index.ts maps to a text on screen (EDIT_ERRORS).
 */
import type { GraphMutation } from '../../shared/commands/types';
import { NODE_PALETTE } from '../../shared/graph/palette';
import type { CatalogView } from '../../shared/catalog/types';
import { defaultParameters } from '../../shared/catalog/objectInfo';
import { portsCompatible } from '../../shared/graph/linkTypes';
import { portsForClassType, type PortDefinition } from '../../shared/graph/ports';
import {
  NOTE_NODE_TYPES,
  editorNodePorts,
  editorNodeRecord,
  isEditorNodeType,
} from '../../shared/graph/editorNodes';
import { groupBounding, widgetsFromParameters, type GraphSnapshot } from '../../shared/workflow/codec';

type Node = Record<string, any>;
type Edge = Record<string, any>;

/** Refusals of the editing commands; the renderer shows each as a sentence in the person's language. */
export const EDIT_ERRORS = {
  nodeMissing: 'Node was not found.',
  notANote: 'Only a note has text to write.',
  edgeMissing: 'Connection was not found.',
  noInputFits: 'The new node has no input for what this link carries.',
  noOutputFits: 'The new node has no output that fits where this link goes.',
  unknownClass: 'This node is not in your ComfyUI, so it cannot be placed here.',
  notReplaceable: 'Subgraphs, notes, reroutes and primitives cannot be replaced by another node.',
  sameClass: 'The node already is of that kind.',
  groupMissing: 'Group was not found.',
  primitiveToSocket: 'A Primitive feeds a field only, not a link input.',
  groupEmpty: 'A group keeps at least one node. To remove the group, use Remove group.',
} as const;

/** A refusal of an editing command; its message is one of EDIT_ERRORS and commit.ts turns it into `rejected`. */
export class EditOpError extends Error {}

function fail(message: string): never {
  throw new EditOpError(message);
}

/** The mutation types this module applies. */
const EDIT_OPS = new Set(['set-group-members', 'set-node-mode', 'set-note-text', 'insert-node-on-edge', 'replace-node', 'set-node-color', 'set-group-color']);

export function isEditOp(payload: GraphMutation): boolean {
  return EDIT_OPS.has(payload.type);
}

/** Applies one root-level mutation; commit.ts passes its own applyMutation so a composite edit reuses add and connect. */
export type ApplyLevel = (
  snapshot: GraphSnapshot,
  actionId: string,
  payload: GraphMutation,
  catalog: CatalogView,
) => { snapshot: GraphSnapshot; result: Record<string, unknown> };

/** ComfyUI's mode numbers: LGraphEventMode ALWAYS 0, NEVER 2 (muted), BYPASS 4. */
const MODE_NUMBER = { always: 0, mute: 2, bypass: 4 } as const;

/** Copies of nodes and edges deep enough to edit `data` and `position` without touching the stored revision. */
function cloneWork(snapshot: GraphSnapshot): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: snapshot.nodes.map((node) => ({ ...node, data: { ...node.data }, position: { ...node.position } })),
    edges: snapshot.edges.map((edge) => ({ ...edge })),
  };
}

/** The node's native record, made when the node never had one (an old project), so a flag can be written on it. */
function comfyOf(node: Node): Record<string, unknown> {
  if (node.data.comfy && typeof node.data.comfy === 'object') return { ...node.data.comfy };
  const classType = String(node.data?.comfyType ?? '');
  return {
    id: /^\d+$/.test(String(node.id)) ? Number(node.id) : node.id,
    type: classType,
    title: node.data?.title || classType,
    pos: [node.position?.x ?? 0, node.position?.y ?? 0],
    size: [200, 80],
    flags: {},
    order: 0,
    mode: 0,
    properties: {},
  };
}

function requireNodes(nodes: Node[], ids: string[]): Node[] {
  return ids.map((id) => nodes.find((node) => String(node.id) === id) ?? fail(EDIT_ERRORS.nodeMissing));
}

function isSubgraphInstance(node: Node): boolean {
  return node.data?.kind === 'subgraph-instance' || typeof node.data?.subgraphId === 'string';
}

/** The new node and its parts for add-node of an editor class; commit.ts pushes it as any added node. */
export function editorNode(classType: string, nodeId: string, title: string | undefined, x: number, y: number): Node | null {
  if (!isEditorNodeType(classType)) return null;
  const ports = editorNodePorts(classType);
  const shown = title || classType;
  return {
    id: nodeId,
    type: 'comfy',
    position: { x, y },
    data: {
      comfyType: classType,
      title: shown,
      inputs: ports.inputs,
      outputs: ports.outputs,
      parameters: {},
      annotations: [],
      comfy: editorNodeRecord(classType, Number(nodeId), shown, x, y),
    },
  };
}

/** The catalog spec of a widget input, or undefined when the input is a link socket or the class is unknown. */
function widgetInput(catalog: CatalogView, classType: string, name: string): { controlDefault?: string; type: string } | undefined {
  const spec = catalog.nodes.find((item) => item.classType === classType);
  const input = spec?.inputs.find((item) => item.name === name);
  return input && input.widget ? input : undefined;
}

/**
 * A link from a Primitive may only feed a field (a widget input), as in ComfyUI. Returns the refusal, or null.
 * An unknown target class cannot be checked and is allowed.
 */
export function refuseEditorLink(source: Node, target: Node, targetHandle: string, catalog: CatalogView): string | null {
  if (source.data?.comfyType !== 'PrimitiveNode') return null;
  const port = (target.data?.inputs as PortDefinition[] | undefined)?.find((item) => item.id === targetHandle);
  const targetClass = String(target.data?.comfyType ?? '');
  if (!port || !catalog.nodes.some((item) => item.classType === targetClass)) return null;
  return widgetInput(catalog, targetClass, port.name) ? null : EDIT_ERRORS.primitiveToSocket;
}

/**
 * After a link is made: a Reroute's output takes the type that comes in, and a Primitive takes the type, the name
 * and the current value of the field it feeds, as ComfyUI's frontend does when the graph is next opened there.
 * The link's own type follows the output.
 */
export function adoptLinkedType(nodes: Node[], edge: Edge, catalog: CatalogView): void {
  const source = nodes.find((node) => String(node.id) === String(edge.source));
  const target = nodes.find((node) => String(node.id) === String(edge.target));
  if (!source || !target) return;
  if (target.data?.comfyType === 'Reroute') {
    const incoming = String(edge.data?.dataType ?? '*');
    if (incoming && incoming !== '*') {
      target.data = {
        ...target.data,
        outputs: (target.data.outputs as PortDefinition[]).map((port, index) => (index === 0 ? { ...port, dataType: incoming } : port)),
        comfy: retypeOutput(comfyOf(target), incoming, ''),
      };
    }
  }
  if (source.data?.comfyType === 'PrimitiveNode') {
    const port = (target.data?.inputs as PortDefinition[] | undefined)?.find((item) => item.id === edge.targetHandle);
    if (!port) return;
    const type = port.dataType;
    const spec = widgetInput(catalog, String(target.data?.comfyType ?? ''), port.name);
    const value = (target.data?.parameters as Record<string, unknown> | undefined)?.[port.name];
    // A number or a choice gets ComfyUI's "control after generate" slot too (and a choice its filter slot).
    const values: unknown[] = [value ?? null];
    if (type === 'INT' || type === 'FLOAT' || type === 'COMBO' || spec?.controlDefault !== undefined) values.push('fixed');
    if (type === 'COMBO') values.push('');
    const comfy = retypeOutput(comfyOf(source), type, type, port.name);
    comfy.widgets_values = values;
    source.data = {
      ...source.data,
      outputs: (source.data.outputs as PortDefinition[]).map((item, index) => (index === 0 ? { ...item, name: type, dataType: type } : item)),
      comfy,
    };
    edge.data = { ...edge.data, dataType: type, ...(edge.data?.comfyLink && !Array.isArray(edge.data.comfyLink) ? { comfyLink: { ...edge.data.comfyLink, type } } : {}) };
  }
}

/** The native record with its first output renamed and retyped (and tied to a widget, for a Primitive). */
function retypeOutput(comfy: Record<string, unknown>, type: string, name: string, widget?: string): Record<string, unknown> {
  const outputs = Array.isArray(comfy.outputs) ? comfy.outputs as Array<Record<string, unknown>> : [];
  const first = { ...(outputs[0] ?? { links: [] }), name, type, ...(widget ? { widget: { name: widget } } : {}) };
  return { ...comfy, outputs: [first, ...outputs.slice(1)] };
}

function setNodeMode(snapshot: GraphSnapshot, payload: Extract<GraphMutation, { type: 'set-node-mode' }>) {
  const { nodes, edges } = cloneWork(snapshot);
  for (const node of requireNodes(nodes, payload.nodeIds)) {
    node.data = { ...node.data, comfy: { ...comfyOf(node), mode: MODE_NUMBER[payload.mode] } };
  }
  return { snapshot: { ...snapshot, nodes, edges }, result: { nodeIds: payload.nodeIds, mode: payload.mode } };
}

function setNoteText(snapshot: GraphSnapshot, payload: Extract<GraphMutation, { type: 'set-note-text' }>) {
  const { nodes, edges } = cloneWork(snapshot);
  const [node] = requireNodes(nodes, [payload.nodeId]);
  if (!NOTE_NODE_TYPES.has(String(node.data?.comfyType))) fail(EDIT_ERRORS.notANote);
  const comfy = comfyOf(node);
  const widgets = comfy.widgets_values;
  // A note saved by an older frontend keeps its text under a name; a current one in the first slot.
  if (widgets && typeof widgets === 'object' && !Array.isArray(widgets)) comfy.widgets_values = { ...widgets, text: payload.text };
  else comfy.widgets_values = [payload.text, ...(Array.isArray(widgets) ? widgets.slice(1) : [])];
  node.data = { ...node.data, comfy };
  return { snapshot: { ...snapshot, nodes, edges }, result: { nodeId: payload.nodeId } };
}

function setNodeColor(snapshot: GraphSnapshot, payload: Extract<GraphMutation, { type: 'set-node-color' }>) {
  const { nodes, edges } = cloneWork(snapshot);
  for (const node of requireNodes(nodes, payload.nodeIds)) {
    const comfy = comfyOf(node);
    if (payload.color) {
      comfy.color = NODE_PALETTE[payload.color].color;
      comfy.bgcolor = NODE_PALETTE[payload.color].bgcolor;
    } else {
      delete comfy.color;
      delete comfy.bgcolor;
    }
    node.data = { ...node.data, comfy };
  }
  return { snapshot: { ...snapshot, nodes, edges }, result: { nodeIds: payload.nodeIds, color: payload.color } };
}

function setGroupColor(snapshot: GraphSnapshot, payload: Extract<GraphMutation, { type: 'set-group-color' }>) {
  const groups = (snapshot.groups ?? []).map((group) => ({ ...group }));
  const group = groups.find((item) => String(item.id) === payload.groupId) ?? fail(EDIT_ERRORS.groupMissing);
  if (payload.color) group.color = NODE_PALETTE[payload.color].groupcolor;
  else delete group.color;
  return { snapshot: { ...snapshot, groups }, result: { groupId: payload.groupId, color: payload.color } };
}

/** Moves nodes into or out of a group; the frame is drawn around the members, so it grows or shrinks with them. */
function setGroupMembers(snapshot: GraphSnapshot, payload: Extract<GraphMutation, { type: 'set-group-members' }>) {
  const groups = (snapshot.groups ?? []).map((group) => ({ ...group }));
  const group = groups.find((item) => String(item.id) === payload.groupId) ?? fail(EDIT_ERRORS.groupMissing);
  requireNodes(snapshot.nodes as Node[], payload.add);
  const removed = new Set(payload.remove);
  const nodeIds = [...new Set([...group.nodeIds.filter((id) => !removed.has(id)), ...payload.add])];
  if (nodeIds.length === 0) fail(EDIT_ERRORS.groupEmpty);
  // A node belongs to one group: joining this one takes it out of the others (ComfyUI groups do not overlap here).
  const joined = new Set(payload.add);
  for (const other of groups) {
    if (other !== group) other.nodeIds = other.nodeIds.filter((id) => !joined.has(id));
  }
  group.nodeIds = nodeIds;
  group.bounding = groupBounding(snapshot.nodes.filter((node) => nodeIds.includes(String(node.id))) as Node[]);
  // A group left without nodes by the move goes away, as a group with no members cannot be drawn.
  const kept = groups.filter((item) => item.nodeIds.length > 0);
  return { snapshot: { ...snapshot, groups: kept }, result: { groupId: payload.groupId, nodeIds } };
}

/**
 * Places a new node on a link in one step: the node is added, the link's target is fed from the node's first
 * output that fits (which replaces the old link, since an input takes one link), and the link's source feeds the
 * node's first input that takes what the link carries.
 */
function insertOnEdge(
  snapshot: GraphSnapshot,
  actionId: string,
  payload: Extract<GraphMutation, { type: 'insert-node-on-edge' }>,
  catalog: CatalogView,
  apply: ApplyLevel,
) {
  const edge = snapshot.edges.find((item) => String(item.id) === payload.edgeId) ?? fail(EDIT_ERRORS.edgeMissing);
  if (!isEditorNodeType(payload.nodeType) && !catalog.nodes.some((item) => item.classType === payload.nodeType)) fail(EDIT_ERRORS.unknownClass);
  const carried = String(edge.data?.dataType ?? '*');
  const targetNode = snapshot.nodes.find((node) => String(node.id) === String(edge.target));
  const targetPort = (targetNode?.data?.inputs as PortDefinition[] | undefined)?.find((port) => port.id === edge.targetHandle);
  const wanted = targetPort?.dataType ?? carried;
  const added = apply(snapshot, `${actionId}:add`, { type: 'add-node', nodeType: payload.nodeType, title: payload.title, x: payload.x, y: payload.y }, catalog);
  const nodeId = String(added.result.nodeId);
  const fresh = added.snapshot.nodes.find((node) => String(node.id) === nodeId)!;
  const input = (fresh.data.inputs as PortDefinition[]).find((port) => portsCompatible(carried, port.dataType));
  if (!input) fail(EDIT_ERRORS.noInputFits);
  const output = (fresh.data.outputs as PortDefinition[]).find((port) => portsCompatible(port.dataType, wanted));
  if (!output) fail(EDIT_ERRORS.noOutputFits);
  const fed = apply(added.snapshot, `${actionId}:out`, {
    type: 'connect', source: nodeId, sourceHandle: output.id, target: String(edge.target), targetHandle: String(edge.targetHandle),
  }, catalog);
  const linked = apply(fed.snapshot, `${actionId}:in`, {
    type: 'connect', source: String(edge.source), sourceHandle: String(edge.sourceHandle), target: nodeId, targetHandle: input.id,
  }, catalog);
  // Connecting the new node to the target's input already replaced the old link (an input takes one link);
  // the filter makes sure it is gone in every case.
  const edges = linked.snapshot.edges.filter((item) => String(item.id) !== payload.edgeId);
  return { snapshot: { ...linked.snapshot, edges }, result: { nodeId, replacedEdgeId: payload.edgeId } };
}

/**
 * Another class in a node's place: the node keeps its id, place, title (unless one is given), run mode and colour;
 * field values carry over where the new class has a field of the same name that takes them; every link moves to an
 * input or output of the same name, else to the first free one of a type that fits, else it is dropped.
 */
function replaceNode(snapshot: GraphSnapshot, payload: Extract<GraphMutation, { type: 'replace-node' }>, catalog: CatalogView) {
  const { nodes, edges } = cloneWork(snapshot);
  const [node] = requireNodes(nodes, [payload.nodeId]);
  const oldClass = String(node.data?.comfyType ?? '');
  if (isSubgraphInstance(node) || isEditorNodeType(oldClass) || isEditorNodeType(payload.nodeType)) fail(EDIT_ERRORS.notReplaceable);
  if (oldClass === payload.nodeType) fail(EDIT_ERRORS.sameClass);
  const spec = catalog.nodes.find((item) => item.classType === payload.nodeType) ?? fail(EDIT_ERRORS.unknownClass);
  const ports = portsForClassType(payload.nodeType, catalog);
  const oldParameters = (node.data.parameters ?? {}) as Record<string, unknown>;
  const carried: Record<string, unknown> = {};
  for (const input of spec.inputs) {
    if (input.widget && Object.prototype.hasOwnProperty.call(oldParameters, input.name)) carried[input.name] = oldParameters[input.name];
  }
  let parameters = { ...defaultParameters(spec), ...carried };
  let placed = widgetsFromParameters(payload.nodeType, parameters, catalog);
  if (!placed.ok) {
    // A value the new field does not take (another list of choices): start from ComfyUI's defaults instead.
    parameters = defaultParameters(spec);
    placed = widgetsFromParameters(payload.nodeType, parameters, catalog);
  }
  const oldComfy = comfyOf(node);
  const title = payload.title || (node.data.title && node.data.title !== oldClass ? node.data.title : spec.displayName || payload.nodeType);
  const comfy: Record<string, unknown> = {
    id: oldComfy.id,
    type: payload.nodeType,
    title,
    pos: oldComfy.pos ?? [node.position?.x ?? 0, node.position?.y ?? 0],
    size: [200, 80],
    flags: oldComfy.flags ?? {},
    order: oldComfy.order ?? 0,
    mode: oldComfy.mode ?? 0,
    properties: { 'Node name for S&R': payload.nodeType },
    ...(oldComfy.color ? { color: oldComfy.color } : {}),
    ...(oldComfy.bgcolor ? { bgcolor: oldComfy.bgcolor } : {}),
  };
  if (placed.ok && spec.widgetOrderReliable !== false) comfy.widgets_values = placed.values;
  const oldInputs = (node.data.inputs ?? []) as PortDefinition[];
  const oldOutputs = (node.data.outputs ?? []) as PortDefinition[];
  const nodeId = String(node.id);
  const pick = (old: PortDefinition | undefined, fresh: PortDefinition[], taken: Set<string>, fits: (port: PortDefinition) => boolean) => {
    if (!old) return undefined;
    return fresh.find((port) => port.name === old.name && fits(port) && !taken.has(port.id))
      ?? fresh.find((port) => fits(port) && !taken.has(port.id));
  };
  const takenInputs = new Set<string>();
  const kept: Edge[] = [];
  let dropped = 0;
  // Incoming links first, in input order, so each finds the input of the same name before a later one takes it.
  const incoming = edges.filter((edge) => String(edge.target) === nodeId)
    .sort((a, b) => oldInputs.findIndex((port) => port.id === a.targetHandle) - oldInputs.findIndex((port) => port.id === b.targetHandle));
  const outgoing = edges.filter((edge) => String(edge.source) === nodeId);
  for (const edge of incoming) {
    const old = oldInputs.find((port) => port.id === edge.targetHandle);
    const carriedType = String(edge.data?.dataType ?? old?.dataType ?? '*');
    const next = pick(old, ports.inputs, takenInputs, (port) => portsCompatible(carriedType, port.dataType));
    if (!next) { dropped += 1; continue; }
    takenInputs.add(next.id);
    kept.push({ ...edge, targetHandle: next.id });
  }
  for (const edge of outgoing) {
    const old = oldOutputs.find((port) => port.id === edge.sourceHandle);
    const targetType = String(edge.data?.dataType ?? old?.dataType ?? '*');
    // An output feeds many links, so outputs are not taken by one.
    const next = pick(old, ports.outputs, new Set(), (port) => portsCompatible(port.dataType, targetType));
    if (!next) { dropped += 1; continue; }
    kept.push({ ...edge, sourceHandle: next.id, data: { ...edge.data, dataType: next.dataType } });
  }
  const others = edges.filter((edge) => String(edge.target) !== nodeId && String(edge.source) !== nodeId);
  // The node is now one the app made: its native slots are written fresh on export (codec addCreatedSlots).
  const { importedLinks: _imported, ...rest } = node.data;
  node.data = { ...rest, comfyType: payload.nodeType, title, inputs: ports.inputs, outputs: ports.outputs, parameters, comfy };
  return { snapshot: { ...snapshot, nodes, edges: [...others, ...kept] }, result: { nodeId, nodeType: payload.nodeType, droppedLinks: dropped } };
}

/** Applies one editing mutation; EditOpError carries the refusal. */
export function applyEditOp(
  snapshot: GraphSnapshot,
  actionId: string,
  payload: GraphMutation,
  catalog: CatalogView,
  apply: ApplyLevel,
): { snapshot: GraphSnapshot; result: Record<string, unknown> } {
  switch (payload.type) {
    case 'set-node-mode': return setNodeMode(snapshot, payload);
    case 'set-note-text': return setNoteText(snapshot, payload);
    case 'set-node-color': return setNodeColor(snapshot, payload);
    case 'set-group-color': return setGroupColor(snapshot, payload);
    case 'set-group-members': return setGroupMembers(snapshot, payload);
    case 'insert-node-on-edge': return insertOnEdge(snapshot, actionId, payload, catalog, apply);
    case 'replace-node': return replaceNode(snapshot, payload, catalog);
    default: return fail('Unknown edit.');
  }
}
