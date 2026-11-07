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
export interface ComfyNodeData {
  comfyType: string; // ComfyUI class_type
  title?: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  parameters: Record<string, unknown>;
  annotations?: string[];
  locked?: boolean;
  // Preserve original ComfyUI data for roundtrip
  comfyData?: Record<string, unknown>;
}

/**
 * Internal node type (React Flow format)
 */
export type GraphNode = Node<ComfyNodeData, 'comfy'>;

/**
 * Data stored in each edge
 */
export interface EdgeData {
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
