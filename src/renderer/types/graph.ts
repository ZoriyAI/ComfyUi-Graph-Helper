import { Node, Edge } from '@xyflow/react';

/**
 * Port definition for node inputs/outputs
 */
export interface PortDefinition {
  id: string;
  name: string;
  dataType: string;
  optional: boolean;
}

/**
 * Data stored in each node
 */
export interface ComfyNodeData extends Record<string, unknown> {
  comfyType: string; // ComfyUI class_type
  title?: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  parameters: Record<string, unknown>;
  annotations?: string[];
  locked?: boolean;
  /** Local sample marker. Not a ComfyUI field and not sent as catalog metadata. */
  demo?: boolean;
  /** 'subgraph-instance' for an instance of a subgraph definition (see shared/graph/subgraphs.ts). */
  kind?: string;
  /** For instances: the definition id (equals comfyType). */
  subgraphId?: string;
  // Preserve original ComfyUI data for roundtrip
  comfyData?: Record<string, unknown>;
}

/**
 * Internal node type (React Flow format)
 */
export type GraphNode = Node<ComfyNodeData, 'comfy'>;

/** Data of the subgraph boundary pseudo-nodes shown while a definition is open. */
export interface BoundaryNodeData extends Record<string, unknown> {
  direction: 'input' | 'output';
  name: string;
  /** Inputs of the definition appear as outputs of the input boundary node, and the reverse. */
  ports: PortDefinition[];
}

export type BoundaryNode = Node<BoundaryNodeData, 'boundary'>;

/**
 * Data stored in each edge
 */
export interface EdgeData extends Record<string, unknown> {
  dataType: string;
  // Preserve original ComfyUI data for roundtrip
  comfyData?: Record<string, unknown>;
}

/**
 * Internal edge type (React Flow format)
 */
export type GraphEdge = Edge<EdgeData>;

/**
 * Complete graph state
 */
export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
