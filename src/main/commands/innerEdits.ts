/**
 * Edits inside a subgraph definition (the `edit-in-subgraph` command) and the id counters of definitions.
 * Used only by commands/commit.ts: applyInnerEdit for the command, keepDefinitionCounters on undo and redo.
 * Shaped after ComfyUI's own numbering so an exported workflow opens there unchanged; details follow below.
 */
import type { GraphMutation } from '../../shared/commands/types';
import type { CatalogView } from '../../shared/catalog/types';
import { portsCompatible } from '../../shared/graph/linkTypes';
import {
  SUBGRAPH_INPUT_NODE_ID,
  SUBGRAPH_OUTPUT_NODE_ID,
  nestsItself,
  type SubgraphDefinition,
} from '../../shared/graph/subgraphs';
import {
  WORKFLOW_FORMAT_V1,
  makeEdge,
  liftGroups,
  monotonicCounter,
  numericSlot,
  type GraphSnapshot,
  type WorkflowDocumentState,
} from '../../shared/workflow/codec';
import { retargetDissolvedWidgets, retargetWrappedWidgets } from './dissolvedWidgets';
import { GraphOpError, Ids, SUBGRAPH_ERRORS, instanceNode } from './graphOps';
import { lastNativeRerouteId } from '../../shared/workflow/nativeReroutes';

/**
 * Editing the inner graph of a subgraph definition (`edit-in-subgraph`).
 *
 * The edit runs through the same rules as on the root canvas, on a working graph made of the definition's own
 * nodes and edges. Ids come from the definition's own counters (`state.lastNodeId`, `state.lastLinkId`), as in
 * ComfyUI, where a definition numbers its nodes and links from 1: a new inner node gets the next id of its
 * definition, never one an inner node had before (also after an undo), and the exported definition keeps
 * counters ComfyUI can go on from.
 *
 * The boundary of a definition is the input pseudo-node -10 (one output per input slot, `out-<slot>`) and the
 * output pseudo-node -20 (one input per output slot, `in-<slot>`). Removing an inner node removes its links,
 * those to the boundary included; the slots stay, so every instance keeps its ports and the links to them,
 * as ComfyUI does.
 */

type Node = Record<string, any>;
type Edge = Record<string, any>;
type InnerEdit = Extract<GraphMutation, { type: 'edit-in-subgraph' }>;

/** Refusal sentences of inner edits that the root rules do not already have (codes the renderer translates). */
export const INNER_ERRORS = {
  selfNesting: 'A subgraph cannot be placed inside itself.',
} as const;

/** Applies one root-canvas mutation to a graph; commit.ts passes its own applyMutation. */
export type ApplyLevel = (
  snapshot: GraphSnapshot,
  actionId: string,
  payload: GraphMutation,
  catalog: CatalogView,
) => { snapshot: GraphSnapshot; result: Record<string, unknown> };

/** The ids that are whole numbers; other ids (pseudo-nodes, drafts) do not count for the counter. */
function numericIds(values: unknown[]): number[] {
  return values.flatMap((value) => (/^\d+$/.test(String(value)) ? [Number(value)] : []));
}

/** Every link id an edge carries, in any of the three places one can be stored, so no used id is reused. */
function linkIdsOf(edges: Edge[]): number[] {
  return edges.flatMap((edge) => {
    const ids: number[] = [];
    if (typeof edge.data?.linkId === 'number') ids.push(edge.data.linkId);
    const stored = edge.data?.comfyLink;
    if (stored && typeof stored === 'object' && !Array.isArray(stored) && typeof stored.id === 'number') ids.push(stored.id);
    if (typeof edge.id === 'string' && /^link-\d+$/.test(edge.id)) ids.push(Number(edge.id.slice(5)));
    return ids;
  });
}

function stateOf(definition: SubgraphDefinition): Record<string, unknown> {
  const state = definition.raw?.state;
  return state && typeof state === 'object' && !Array.isArray(state) ? state as Record<string, unknown> : {};
}

/** The highest node and link ids a definition has used: its stored counters, or more when its graph holds more. */
export function definitionCounters(definition: SubgraphDefinition): { lastNodeId: number; lastLinkId: number; lastGroupId: number; lastRerouteId: number } {
  const state = stateOf(definition);
  return {
    lastNodeId: monotonicCounter(state.lastNodeId, numericIds(definition.nodes.map((node) => node.id))),
    lastLinkId: monotonicCounter(state.lastLinkId, linkIdsOf(definition.edges)),
    lastGroupId: monotonicCounter(state.lastGroupId, numericIds((definition.groups ?? liftGroups(definition.raw.groups, definition.nodes)).map((group) => group.id))),
    lastRerouteId: lastNativeRerouteId(definition.raw),
  };
}

/** A copy of the definition whose stored counters are at least `counters`. Other native state fields stay. */
function withCounters(definition: SubgraphDefinition, counters: ReturnType<typeof definitionCounters>): SubgraphDefinition {
  const state = stateOf(definition);
  const lastNodeId = monotonicCounter(state.lastNodeId, [counters.lastNodeId]);
  const lastLinkId = monotonicCounter(state.lastLinkId, [counters.lastLinkId]);
  const lastGroupId = monotonicCounter(state.lastGroupId, [counters.lastGroupId]);
  const lastRerouteId = Math.max(lastNativeRerouteId(definition.raw), counters.lastRerouteId);
  if (state.lastNodeId === lastNodeId && state.lastLinkId === lastLinkId && state.lastGroupId === lastGroupId && state.lastRerouteId === lastRerouteId) return definition;
  return { ...definition, raw: { ...definition.raw, state: { ...state, lastNodeId, lastLinkId, lastGroupId, lastRerouteId } } };
}

/**
 * Undo restores an earlier snapshot, but the definitions keep the counters they have now, so a node added
 * after an undo never takes the id of a node the undo took away (the root canvas does the same).
 */
export function keepDefinitionCounters(restored: SubgraphDefinition[] | undefined, current: SubgraphDefinition[] | undefined): SubgraphDefinition[] | undefined {
  if (!restored || !current) return restored;
  const now = new Map(current.filter((item) => !item.opaque).map((item) => [item.id, definitionCounters(item)]));
  return restored.map((item) => {
    const counters = item.opaque ? undefined : now.get(item.id);
    return counters ? withCounters(item, counters) : item;
  });
}

/** The data type of one port of a node, by handle, or null when the node has no such port. */
function portOf(node: Node | undefined, side: 'inputs' | 'outputs', handle: string): { dataType: string } | null {
  const ports = Array.isArray(node?.data?.[side]) ? node!.data[side] : [];
  const found = ports.find((item: { id?: string }) => item.id === handle);
  return found && typeof found.dataType === 'string' ? { dataType: found.dataType } : null;
}

/** A link that starts at an input slot (-10) or ends at an output slot (-20) of the open definition. */
function connectBoundary(
  definition: SubgraphDefinition,
  work: GraphSnapshot,
  edit: Extract<InnerEdit['edit'], { type: 'connect' }>,
): { snapshot: GraphSnapshot; result: Record<string, unknown> } {
  const sourceHandle = String(edit.sourceHandle ?? '');
  const targetHandle = String(edit.targetHandle ?? '');
  let sourceType: string;
  if (edit.source === SUBGRAPH_INPUT_NODE_ID) {
    const slot = /^out-\d+$/.test(sourceHandle) ? definition.inputs[numericSlot(sourceHandle)!] : undefined;
    if (!slot) throw new GraphOpError(SUBGRAPH_ERRORS.slotMissing);
    sourceType = slot.type;
  } else {
    const source = work.nodes.find((node) => String(node.id) === edit.source);
    if (!source) throw new GraphOpError('Source node was not found.');
    const output = portOf(source, 'outputs', sourceHandle);
    if (!output) throw new GraphOpError('Source handle is not an output on that node.');
    sourceType = output.dataType;
  }
  let targetType: string;
  if (edit.target === SUBGRAPH_OUTPUT_NODE_ID) {
    const slot = /^in-\d+$/.test(targetHandle) ? definition.outputs[numericSlot(targetHandle)!] : undefined;
    if (!slot) throw new GraphOpError(SUBGRAPH_ERRORS.slotMissing);
    targetType = slot.type;
  } else {
    const target = work.nodes.find((node) => String(node.id) === edit.target);
    if (!target) throw new GraphOpError('Target node was not found.');
    const input = portOf(target, 'inputs', targetHandle);
    if (!input) throw new GraphOpError('Target handle is not an input on that node.');
    targetType = input.dataType;
  }
  if (!portsCompatible(sourceType, targetType)) throw new GraphOpError(SUBGRAPH_ERRORS.portType);
  const linkId = new Ids(work).link();
  // An input, and an output slot, take one link: the one that held it is replaced, as in ComfyUI.
  const replaced = work.edges.filter((edge) => String(edge.target) === edit.target && String(edge.targetHandle) === targetHandle);
  const created = makeEdge(linkId, edit.source, sourceHandle, edit.target, targetHandle, sourceType, WORKFLOW_FORMAT_V1);
  return {
    snapshot: { ...work, edges: [...work.edges.filter((edge) => !replaced.includes(edge)), created] },
    result: { edgeId: created.id, linkId, ...(replaced.length > 0 ? { replacedEdgeIds: replaced.map((edge) => String(edge.id)) } : {}) },
  };
}

/** Places an instance of another definition inside this one; refused when it would end up inside itself. */
function insertNested(
  definitions: SubgraphDefinition[],
  holder: SubgraphDefinition,
  work: GraphSnapshot,
  edit: Extract<InnerEdit['edit'], { type: 'insert-subgraph' }>,
  catalog: CatalogView,
): { snapshot: GraphSnapshot; result: Record<string, unknown> } {
  const placed = definitions.find((item) => !item.opaque && item.id === edit.definitionId);
  if (!placed) throw new GraphOpError(SUBGRAPH_ERRORS.definitionMissing);
  if (nestsItself(definitions, holder.id, placed.id)) throw new GraphOpError(INNER_ERRORS.selfNesting);
  const nodeId = new Ids(work).node(new Set(work.nodes.map((node) => String(node.id))));
  return {
    snapshot: { ...work, nodes: [...work.nodes, instanceNode(nodeId, placed, edit.x, edit.y, edit.title, catalog)] },
    result: { definitionId: placed.id, nodeId },
  };
}

/**
 * One edit inside a definition. Only that definition changes; the root canvas and the other definitions keep
 * their nodes and edges. Throws GraphOpError for a refusal (and lets the root rules' own refusals through).
 */
export function applyInnerEdit(
  snapshot: GraphSnapshot,
  actionId: string,
  payload: InnerEdit,
  catalog: CatalogView,
  applyLevel: ApplyLevel,
): { snapshot: GraphSnapshot; result: Record<string, unknown> } {
  const definitions = snapshot.subgraphs ?? [];
  const definition = definitions.find((item) => !item.opaque && item.id === payload.definitionId);
  if (!definition) throw new GraphOpError(SUBGRAPH_ERRORS.definitionMissing);
  const before = definitionCounters(definition);
  // The definition's graph with its own counters: the root rules allocate ids from them.
  const document: WorkflowDocumentState = {
    formatVersion: WORKFLOW_FORMAT_V1,
    raw: { ...structuredClone(definition.raw), state: { ...stateOf(definition), ...before } },
  };
  const work: GraphSnapshot = {
    nodes: definition.nodes.map((node) => ({ ...node, data: { ...node.data }, position: { ...node.position } })),
    edges: definition.edges.map((edge) => ({ ...edge })),
    document,
    subgraphs: payload.edit.type === 'dissolve-subgraph' ? definitions : [],
    groups: structuredClone(definition.groups ?? liftGroups(definition.raw.groups, definition.nodes)),
  };
  const edit = payload.edit;
  const boundary = (id: string) => id === SUBGRAPH_INPUT_NODE_ID || id === SUBGRAPH_OUTPUT_NODE_ID;
  const applied = edit.type === 'connect' && (boundary(edit.source) || boundary(edit.target))
    ? connectBoundary(definition, work, edit)
    : edit.type === 'insert-subgraph'
      ? insertNested(definitions, definition, work, edit, catalog)
      : applyLevel(work, actionId, edit as GraphMutation, catalog);
  const nodes = applied.snapshot.nodes as Node[];
  const edges = applied.snapshot.edges as Edge[];
  // The counters only grow: what the edit used, or what the definition had before, whichever is higher.
  const present = new Set(nodes.map((node) => String(node.id)));
  const groups = (applied.snapshot.groups ?? work.groups ?? []).map((group) => ({ ...group, nodeIds: group.nodeIds.filter((id) => present.has(id)) }));
  const raw = applied.snapshot.document?.raw ?? definition.raw;
  const used = definitionCounters({ ...definition, nodes, edges, groups, raw });
  const updated = withCounters({ ...definition, nodes, edges, groups, raw }, {
    lastNodeId: Math.max(before.lastNodeId, used.lastNodeId),
    lastLinkId: Math.max(before.lastLinkId, used.lastLinkId),
    lastGroupId: Math.max(before.lastGroupId, used.lastGroupId),
    lastRerouteId: Math.max(before.lastRerouteId, used.lastRerouteId),
  });
  const next: GraphSnapshot = { ...snapshot, subgraphs: [
    ...definitions.map((item) => (item === definition ? updated : item)),
    ...(edit.type === 'dissolve-subgraph' ? [] : applied.snapshot.subgraphs ?? []),
  ] };
  if (edit.type === 'create-subgraph') {
    const isolated = structuredClone(next);
    retargetWrappedWidgets(isolated, definition.id, String(applied.result.definitionId), String(applied.result.nodeId), catalog);
    return { snapshot: isolated, result: { definitionId: definition.id, edit: edit.type, ...applied.result } };
  }
  if (edit.type === 'dissolve-subgraph') {
    const isolated = structuredClone(next);
    const instance = definition.nodes.find((node) => String(node.id) === edit.nodeId)!;
    const removed = definitions.find((item) => item.id === instance.data?.comfyType)!;
    retargetDissolvedWidgets(isolated, definition.id, instance, removed, applied.result.nodeIdMap as Record<string, string>);
    const stillUsed = [...isolated.nodes, ...isolated.subgraphs!.filter((item) => item.id !== removed.id).flatMap((item) => item.nodes)]
      .some((node) => node.data?.comfyType === removed.id);
    if (!stillUsed) isolated.subgraphs = isolated.subgraphs!.filter((item) => item.id !== removed.id);
    return { snapshot: isolated, result: { ...applied.result, definitionRemoved: !stillUsed, definitionId: definition.id, dissolvedDefinitionId: removed.id, edit: edit.type } };
  }
  return { snapshot: next, result: { definitionId: definition.id, edit: edit.type, ...applied.result } };
}
