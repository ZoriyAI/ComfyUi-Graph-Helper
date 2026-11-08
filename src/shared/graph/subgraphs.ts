/**
 * Native subgraphs and groups as the projection snapshot carries them.
 *
 * A subgraph definition holds inner nodes and edges in the same React Flow shape as the canvas.
 * Boundary connections are inner edges whose source is SUBGRAPH_INPUT_NODE_ID (handle `out-<slot>`)
 * or whose target is SUBGRAPH_OUTPUT_NODE_ID (handle `in-<slot>`), matching ComfyUI_frontend, where
 * the subgraph input node is -10 and the output node is -20 inside the definition's links.
 *
 * Instance nodes on the canvas (or inside another definition) are ordinary nodes with
 * `data.comfyType = definition.id`, `data.subgraphId = definition.id`, `data.kind = 'subgraph-instance'`,
 * inputs `in-<i>` and outputs `out-<i>` in definition slot order.
 */
import type { PortDefinition } from './ports';

export const SUBGRAPH_INPUT_NODE_ID = '-10';
export const SUBGRAPH_OUTPUT_NODE_ID = '-20';
export const SUBGRAPH_INSTANCE_KIND = 'subgraph-instance';

/** One boundary slot of a definition. */
export interface SubgraphSlot {
  /** Slot uuid as ComfyUI_frontend writes it. */
  id: string;
  name: string;
  type: string;
  /** Unknown native fields (label, localized_name, pos, ...), kept for lossless export. */
  raw?: Record<string, unknown>;
}

export interface SubgraphDefinition {
  /** Definition uuid; instance nodes use it as their class type. Synthetic for opaque entries. */
  id: string;
  name: string;
  inputs: SubgraphSlot[];
  outputs: SubgraphSlot[];
  nodes: Array<Record<string, any>>;
  edges: Array<Record<string, any>>;
  /**
   * Id of the definition whose own `definitions.subgraphs` held this one at import; null = root list.
   * New definitions are always root-level, as ComfyUI_frontend flattens them on save.
   */
  nestedIn: string | null;
  /**
   * True when the entry could not be modelled (no id, or a repeated id). It is exported verbatim from `raw`,
   * gets no component record, and cannot be edited or instantiated.
   */
  opaque?: true;
  /** Native fields we do not model (version, state, revision, config, extra, inputNode, outputNode, widgets, groups, ...). */
  raw: Record<string, unknown>;
}

/** A visual rectangle around member nodes. Bounds are computed at export from member positions. */
export interface GroupRecord {
  id: string;
  title: string;
  nodeIds: string[];
  color?: string;
  /** Last known native bounding [x, y, w, h]; kept while every member still sits inside it. */
  bounding?: [number, number, number, number];
  raw?: Record<string, unknown>;
}

/** The mutation input shape for a boundary slot: which inner node port it maps to. */
export interface SubgraphIO {
  name: string;
  type: string;
  nodeId: string;
  handle: string;
}

export function instancePorts(definition: Pick<SubgraphDefinition, 'inputs' | 'outputs'>): { inputs: PortDefinition[]; outputs: PortDefinition[] } {
  return {
    inputs: definition.inputs.map((slot, index) => ({ id: `in-${index}`, name: slot.name, dataType: slot.type, optional: false })),
    outputs: definition.outputs.map((slot, index) => ({ id: `out-${index}`, name: slot.name, dataType: slot.type, optional: false })),
  };
}

export function isSubgraphInstance(node: Record<string, any>, definitions: SubgraphDefinition[]): boolean {
  const type = node?.data?.comfyType;
  return typeof type === 'string' && definitions.some((item) => !item.opaque && item.id === type);
}

/** Definitions that can be documented, instantiated, and edited. */
export function modelledSubgraphs(definitions: SubgraphDefinition[] | undefined): SubgraphDefinition[] {
  return (definitions ?? []).filter((item) => !item.opaque);
}
