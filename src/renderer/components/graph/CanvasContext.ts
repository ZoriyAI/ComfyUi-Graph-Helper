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
}

export const CanvasViewContext = createContext<CanvasView>({
  edges: [],
  plan: null,
  flowing: new Set(),
  readOnly: false,
  inDefinition: false,
  emptyRequired: new Set(),
  errorNodes: new Set(),
});

export function useCanvasView(): CanvasView {
  return useContext(CanvasViewContext);
}
