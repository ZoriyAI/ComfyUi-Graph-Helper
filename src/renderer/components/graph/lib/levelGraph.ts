/**
 * The nodes and edges of the level on screen, with the canvas selection: the root graph, or the inner graph of
 * the open subgraph definition. Inside a definition the canvas keeps its own selection, which it reports to
 * uiState as ObjectRefs; the Properties panel (Inspector) and the model card (library/ModelCard.tsx) read it from
 * here, so an inner node can be inspected and its fields edited (commitManual saves those edits in the definition).
 * The React twin of level.ts, which serves code outside React.
 */
import { useMemo } from 'react';
import { useGraphStore } from '../../../state/graphState';
import { useUiStore } from '../../../state/uiState';
import type { GraphEdge, GraphNode } from '../../../types/graph';

/** The level on screen as a React hook: its nodes, its edges and whether it is inside a definition. */
export function useLevelGraph(): { nodes: GraphNode[]; edges: GraphEdge[]; inDefinition: boolean } {
  const rootNodes = useGraphStore((state) => state.nodes);
  const rootEdges = useGraphStore((state) => state.edges);
  const subgraphs = useGraphStore((state) => state.subgraphs);
  const activeSubgraphId = useGraphStore((state) => state.activeSubgraphId);
  const selection = useUiStore((state) => state.selection);
  return useMemo(() => {
    const definition = activeSubgraphId ? subgraphs.find((item) => item.id === activeSubgraphId && !item.opaque) : undefined;
    if (!definition) return { nodes: rootNodes, edges: rootEdges, inDefinition: false };
    const nodeIds = new Set(selection.filter((ref) => ref.kind === 'node').map((ref) => ref.id));
    const edgeIds = new Set(selection.filter((ref) => ref.kind === 'edge').map((ref) => ref.id));
    return {
      nodes: definition.nodes.map((node) => ({ ...node, type: 'comfy', selected: nodeIds.has(String(node.id)) }) as unknown as GraphNode),
      edges: definition.edges.map((edge) => ({ ...edge, selected: edgeIds.has(String(edge.id)) }) as unknown as GraphEdge),
      inDefinition: true,
    };
  }, [rootNodes, rootEdges, subgraphs, activeSubgraphId, selection]);
}
