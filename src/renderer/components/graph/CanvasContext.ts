/**
 * The canvas view context: what every node and link on the level on screen needs (its edges, the connect plan, the
 * check's marks, the attention focus). CanvasFlow computes it once and provides it; node cards, ports, boundary and
 * subgraph nodes, TypedEdge and the connect-assist and description layers read it with useCanvasView. One context
 * value instead of per-node store reads keeps a big graph from recomputing the same sets in every node.
 */
import { createContext, useContext } from 'react';
import type { GraphEdge } from '../../types/graph';
import type { ConnectPlan } from './lib/connectAssist';

/** What every node on the current canvas level needs to know, computed once by CanvasFlow. */
export interface CanvasView {
  /** Edges of the level on screen (root graph, a definition, or a replayed revision). */
  edges: GraphEdge[];
  /** "What connects here" plan, when the assist is on. */
  plan: ConnectPlan | null;
  /** True for a replayed revision: nothing on the canvas commits. */
  readOnly: boolean;
  /** True while a subgraph definition is open. */
  inDefinition: boolean;
  /** Edges carrying flow pulses (see lib/flow.ts). */
  flowing: Set<string>;
  /** Keys `${nodeId}:${portName}` of required inputs the last graph check found empty. */
  emptyRequired: Set<string>;
  /** Nodes the last graph check flagged (missing class, base-model mismatch). */
  errorNodes: Set<string>;
  /**
   * The nodes a tour step or a lesson step is about (motion package): every other node and every link that does not
   * join two of them steps back. Null when nothing asks for attention.
   */
  focusNodes: Set<string> | null;
}

/** The context CanvasFlow fills; the default (empty, editable) only shows outside a canvas, as in a unit test. */
export const CanvasViewContext = createContext<CanvasView>({
  edges: [],
  plan: null,
  flowing: new Set(),
  readOnly: false,
  inDefinition: false,
  emptyRequired: new Set(),
  errorNodes: new Set(),
  focusNodes: null,
});

/** The current level's CanvasView, for a component drawn inside CanvasFlow. */
export function useCanvasView(): CanvasView {
  return useContext(CanvasViewContext);
}
