/** Read the displayed copy's values without mutating the shared native subgraph definition. */
import type { GraphMutation } from '../../../../shared/commands/types';
import { SUBGRAPH_INPUT_NODE_ID, type SubgraphDefinition } from '../../../../shared/graph/subgraphs';
import { ownPromotedValue, promotedFields, promotedInputSlot } from '../../../../shared/workflow/comfyLook';
import type { GraphEdge, GraphNode } from '../../../types/graph';
import { useMemo } from 'react';
import { useGraphStore } from '../../../state/graphState';

export interface InstanceGraphSource {
  nodes: GraphNode[];
  edges: GraphEdge[];
  subgraphs: SubgraphDefinition[];
  subgraphPath: string[];
  subgraphInstancePath: Array<string | null>;
}
export interface ParameterOwner { definitionId: string | null; nodeId: string; widgetIndex: number }
export const parameterAddress = (nodeId: string, field: string): string => JSON.stringify([nodeId, field]);
type Comfy = { widgets_values?: unknown; properties?: Record<string, unknown>; widgets?: Array<{ name?: string }> };
const comfyOf = (node: GraphNode): Comfy => (node.data.comfy ?? {}) as Comfy;

/** Stop at a removed copy as well as a removed definition; never silently turn its progress into a template's. */
export function validInstanceDepth(source: InstanceGraphSource): number {
  let nodes: readonly { id?: unknown; data?: Record<string, unknown> }[] = source.nodes;
  for (let index = 0; index < source.subgraphPath.length; index += 1) {
    const definition = source.subgraphs.find(item => item.id === source.subgraphPath[index] && !item.opaque);
    if (!definition) return index;
    const instanceId = source.subgraphInstancePath[index];
    if (instanceId && !nodes.some(node => String(node.id) === instanceId && (node.data?.subgraphId ?? node.data?.comfyType) === definition.id)) return index;
    nodes = definition.nodes;
  }
  return source.subgraphPath.length;
}

/** IDs are serialized as a tuple, not joined with delimiters that could collide. Root progress remains compatible. */
export function lessonContextKey(source: InstanceGraphSource, projectId: string, graphKey: string): string {
  if (source.subgraphPath.length === 0) return '';
  return JSON.stringify([projectId, graphKey, source.subgraphPath.map((id, index) => [id, source.subgraphInstancePath[index] ?? null])]);
}

export interface InstanceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  definition: SubgraphDefinition | null;
  /** A displayed field's real owner, including a proxy promoted through several nested copies. */
  owners: Map<string, ParameterOwner>;
  /** Inputs supplied by an external wire: their runtime value is unknown to static lesson checking. */
  external: Set<string>;
}

function targetField(node: GraphNode, name: string): { name: string; index?: number } | null {
  if (node.data.kind !== 'subgraph-instance') return { name };
  const all = promotedFields(node.data);
  const exact = all.filter(field => `${field.nodeId}::${field.name}` === name);
  const fields = exact.length ? exact : all.filter(field => field.name === name);
  return fields.length === 1 ? { name: `widgets::${fields[0].index}`, index: fields[0].index } : null;
}

function override(node: GraphNode, name: string, index: number | undefined, value: unknown): GraphNode {
  const comfy = comfyOf(node);
  const widgets = comfy.widgets_values;
  if (index !== undefined) {
    const next = Array.isArray(widgets) ? widgets.slice() : [];
    next[index] = value;
    return { ...node, data: { ...node.data, comfy: { ...comfy, widgets_values: next } } };
  }
  // Parameters are the renderer's named view. Native positional slots stay intact for serialization.
  return { ...node, data: { ...node.data, parameters: { ...node.data.parameters, [name]: value } } };
}

/** Effective fields and their edit destinations at the selected level; all native definitions stay untouched. */
export function instanceGraph(source: InstanceGraphSource): InstanceGraph {
  let view: InstanceGraph = { nodes: source.nodes, edges: source.edges, definition: null, owners: new Map(), external: new Set() };
  const depth = validInstanceDepth(source);
  for (let level = 0; level < depth; level += 1) {
    const definition = source.subgraphs.find(item => item.id === source.subgraphPath[level])!;
    const instance = view.nodes.find(node => node.id === source.subgraphInstancePath[level]);
    const nodes = definition.nodes as GraphNode[];
    const next: InstanceGraph = { nodes: nodes.slice(), edges: definition.edges as GraphEdge[], definition, owners: new Map(), external: new Set() };
    if (instance) {
      const setField = (nodeId: string, name: string, value: unknown, owner: ParameterOwner | null, external: boolean, held: boolean) => {
        const at = next.nodes.findIndex(node => node.id === nodeId);
        if (at < 0) return;
        const target = targetField(next.nodes[at], name);
        if (!target) return;
        const address = parameterAddress(nodeId, target.name);
        if (external) next.external.add(address);
        if (owner) next.owners.set(address, owner);
        if (held && !external) next.nodes[at] = override(next.nodes[at], target.name, target.index, value);
      };
      for (const field of promotedFields(instance.data)) {
        const address = parameterAddress(instance.id, `widgets::${field.index}`);
        const slots = comfyOf(instance).widgets_values;
        const owner = view.owners.get(address) ?? (Array.isArray(slots) && field.index < slots.length
          ? { definitionId: view.definition?.id ?? null, nodeId: instance.id, widgetIndex: field.index } : null);
        const value = ownPromotedValue(instance.data, field);
        const slot = promotedInputSlot(field, definition);
        const external = view.external.has(address) || (slot >= 0 && view.edges.some(edge => edge.target === instance.id && edge.targetHandle === `in-${slot}`));
        if (field.nodeId !== '-1') setField(field.nodeId, field.name, value.value, owner, external, value.held);
        else for (const edge of next.edges.filter(edge => edge.source === SUBGRAPH_INPUT_NODE_ID && edge.sourceHandle === `out-${slot}`)) {
          const target = nodes.find(node => node.id === edge.target);
          const port = target?.data.inputs?.find(port => port.id === edge.targetHandle);
          if (port) setField(edge.target, port.name, value.value, owner, external, value.held);
        }
      }
      // A connected boundary need not have any promoted widget. Never judge its fallback as a runtime value.
      for (const edge of next.edges.filter(edge => edge.source === SUBGRAPH_INPUT_NODE_ID)) {
        const slot = /^out-(\d+)$/.exec(String(edge.sourceHandle))?.[1];
        if (slot === undefined || !view.edges.some(link => link.target === instance.id && link.targetHandle === `in-${slot}`)) continue;
        const node = nodes.find(node => node.id === edge.target);
        const port = node?.data.inputs?.find(port => port.id === edge.targetHandle);
        if (port) setField(edge.target, port.name, undefined, null, true, false);
      }
    }
    view = next;
  }
  return view;
}

/** A promoted setting writes to its owning copy, not to a same-numbered node in the open definition. */
export function instanceParameterMutation(view: InstanceGraph, nodeId: string, field: string, value: unknown): GraphMutation | null {
  const address = parameterAddress(nodeId, field);
  if (view.external.has(address)) return null;
  const owner = view.owners.get(address);
  if (!owner) return view.definition
    ? { type: 'edit-in-subgraph', definitionId: view.definition.id, edit: { type: 'set-parameter', nodeId, key: field, value } }
    : { type: 'set-parameter', nodeId, key: field, value };
  const edit = { type: 'set-parameter' as const, nodeId: owner.nodeId, key: `widgets::${owner.widgetIndex}`, widgetIndex: owner.widgetIndex, value };
  return owner.definitionId ? { type: 'edit-in-subgraph', definitionId: owner.definitionId, edit } : edit;
}

/** A shared view for the canvas, inspector and lessons: each reads the same selected copy. */
export function useInstanceGraph(): InstanceGraph {
  const nodes = useGraphStore(state => state.nodes);
  const edges = useGraphStore(state => state.edges);
  const subgraphs = useGraphStore(state => state.subgraphs);
  const subgraphPath = useGraphStore(state => state.subgraphPath);
  const subgraphInstancePath = useGraphStore(state => state.subgraphInstancePath);
  return useMemo(() => instanceGraph({ nodes, edges, subgraphs, subgraphPath, subgraphInstancePath }), [nodes, edges, subgraphs, subgraphPath, subgraphInstancePath]);
}
