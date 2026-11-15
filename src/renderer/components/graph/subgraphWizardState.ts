/** One local wizard draft, opened from the graph menu, library or Properties. */
import { create } from 'zustand';
import { useGraphStore } from '../../state/graphState';
import { useProjectionStore } from '../../services/commands/projection';
import { useCanvasStore } from './canvasStore';
import type { GraphNode, GraphEdge } from '../../types/graph';
import type { SubgraphDefinition } from '../../../shared/graph/subgraphs';

export interface SubgraphWizardRequest {
  id: string; levelId: string | null; revisionId: string; nodeIds: string[];
  nodes: GraphNode[]; edges: GraphEdge[]; definition?: SubgraphDefinition; legacy: boolean; templates?: boolean;
}
export const useSubgraphWizardStore = create<{ request: SubgraphWizardRequest | null; close: () => void }>((set) => ({ request: null, close: () => set({ request: null }) }));

export function openSubgraphWizard(nodeIds: string[] = [], definitionId?: string, templates = false): void {
  if (useCanvasStore.getState().replay) return;
  const graph = useGraphStore.getState();
  const definition = definitionId ? graph.subgraphs.find((item) => item.id === definitionId && !item.opaque) : undefined;
  if (definitionId && !definition) return;
  const level = graph.activeSubgraphId ? graph.subgraphs.find((item) => item.id === graph.activeSubgraphId) : null;
  useSubgraphWizardStore.setState({ request: {
    id: crypto.randomUUID(), levelId: graph.activeSubgraphId, revisionId: useProjectionStore.getState().currentRevisionId,
    nodeIds, templates, nodes: (definition?.nodes ?? level?.nodes ?? graph.nodes) as GraphNode[],
    edges: (definition?.edges ?? level?.edges ?? graph.edges) as GraphEdge[], definition,
    legacy: !graph.activeSubgraphId && graph.document?.formatVersion === 0.4,
  } });
}

export function openTaskWizard(): void { openSubgraphWizard([], undefined, true); }
