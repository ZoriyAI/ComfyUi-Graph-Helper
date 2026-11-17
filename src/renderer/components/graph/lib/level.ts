/**
 * The level on screen, for code outside React Flow (commands, placement, the library, the clipboard, edit batching):
 * the root graph, or the inner graph of the open subgraph definition. The canvas (CanvasFlow) registers what it draws
 * inside a definition (with the selection and the sizes React Flow measured) and how to select there; everything
 * else reads the root graph from the graph store as before.
 */
import { instanceGraph } from './instanceContext';
import { modelledSubgraphs, type SubgraphDefinition } from '../../../../shared/graph/subgraphs';
import { useGraphStore } from '../../../state/graphState';
import { useUiStore } from '../../../state/uiState';
import type { BoundaryNode, GraphEdge, GraphNode } from '../../../types/graph';

/** What the canvas draws inside the open definition, and how to select there. */
interface InnerView {
  definitionId: string;
  instanceKey?: string;
  nodes: Array<GraphNode | BoundaryNode>;
  edges: GraphEdge[];
  select: (nodeIds: string[] | 'all') => void;
}

let innerView: InnerView | null = null;

/** CanvasFlow: what it draws inside the open definition, or null at the root and in a replay. */
export function setInnerView(view: InnerView | null): void {
  innerView = view;
}

/** The modelled definition the canvas shows, or undefined at the root. */
export function openDefinition(): SubgraphDefinition | undefined {
  const graph = useGraphStore.getState();
  if (!graph.activeSubgraphId) return undefined;
  return modelledSubgraphs(graph.subgraphs).find((item) => item.id === graph.activeSubgraphId);
}

/** The registered inner view, only if it belongs to the definition open now (it can lag one render behind). */
function currentInner(): InnerView | null {
  const definition = openDefinition();
  const graph = useGraphStore.getState();
  const sameCopy = innerView?.instanceKey === undefined || innerView.instanceKey === JSON.stringify([graph.subgraphPath, graph.subgraphInstancePath]);
  return definition && innerView?.definitionId === definition.id && sameCopy ? innerView : null;
}

/** Nodes of the level on screen (never the boundary pseudo-nodes), with their selection. */
export function levelNodes(): GraphNode[] {
  const definition = openDefinition();
  if (!definition) return useGraphStore.getState().nodes;
  const inner = currentInner();
  if (inner) return inner.nodes.filter((node): node is GraphNode => node.type !== 'boundary');
  // Not drawn yet: the saved inner graph, with the selection the canvas last reported.
  const selected = new Set(useUiStore.getState().selection.filter((ref) => ref.kind === 'node').map((ref) => ref.id));
  return instanceGraph(useGraphStore.getState()).nodes.map((node) => ({ ...node, type: 'comfy', selected: selected.has(String(node.id)) }) as unknown as GraphNode);
}

/** Links of the level on screen, with their selection. */
export function levelEdges(): GraphEdge[] {
  const definition = openDefinition();
  if (!definition) return useGraphStore.getState().edges;
  return currentInner()?.edges ?? (definition.edges as GraphEdge[]);
}

/** Everything a new node must keep clear of on the level on screen: its nodes and, inside a subgraph, the slot edges. */
export function levelObstacles(): Array<GraphNode | BoundaryNode> {
  const inner = currentInner();
  return inner ? inner.nodes : levelNodes();
}

/** Selects nodes on the level on screen ('all' = every node). */
export function selectOnLevel(nodeIds: string[] | 'all'): void {
  const inner = currentInner();
  if (inner) {
    inner.select(nodeIds);
    return;
  }
  const wanted = nodeIds === 'all' ? null : new Set(nodeIds);
  useGraphStore.setState((state) => ({ nodes: state.nodes.map((node) => {
    const selected = wanted ? wanted.has(node.id) : true;
    return node.selected === selected ? node : { ...node, selected };
  }) }));
  if (wanted) useUiStore.getState().setSelection([...wanted].map((id) => ({ kind: 'node' as const, id })));
}
