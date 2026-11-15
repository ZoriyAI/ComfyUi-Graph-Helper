/**
 * The graph on screen: nodes, links, subgraphs, groups and the process notes, as the last projection from main
 * brought them, plus which subgraph level the canvas shows.
 *
 * Who uses it: nearly the whole window (about fifty files): the canvas, the inspector, the library, lessons, the
 * chat and commands. services/commands/projection.ts is the one place that replaces the graph from main; the
 * add, update and remove actions here edit only the window's copy and are used by the legacy graph service and tests.
 */
import { create } from 'zustand';
import type { ComponentRecord, ProcessMeta } from '../../shared/components/model';
import { EMPTY_PROCESS } from '../../shared/components/model';
import type { WorkflowDocumentState } from '../../shared/workflow/codec';
import type { GroupRecord, SubgraphDefinition } from '../../shared/graph/subgraphs';
import { GraphNode, GraphEdge } from '../types/graph';

interface GraphState {
  /** Nodes and links of the root graph, as React Flow draws them. */
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** The components (named blocks) and the process title and notes the person wrote about the graph. */
  components: ComponentRecord[];
  process: ProcessMeta;
  /** The opened workflow file's format version and raw JSON, as main keeps them. */
  document: WorkflowDocumentState | null;
  /** Modelled subgraph definitions from the projection snapshot. */
  subgraphs: SubgraphDefinition[];
  /** Root-canvas groups from the projection snapshot. */
  groups: GroupRecord[];
  /** Breadcrumb: definition ids entered from the root, outermost first. */
  subgraphPath: string[];
  /** The definition the canvas shows, or null for the root graph. Always the last entry of subgraphPath. */
  activeSubgraphId: string | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  zoom: number;

  // Actions
  setNodes: (nodes: GraphNode[]) => void;
  setEdges: (edges: GraphEdge[]) => void;
  addNode: (node: GraphNode) => void;
  updateNode: (id: string, data: Partial<GraphNode['data']>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: GraphEdge) => void;
  removeEdge: (id: string) => void;
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  clearGraph: () => void;
  loadGraph: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  setZoom: (zoom: number) => void;
  /** Open a definition from the current level (pushes onto the breadcrumb). */
  enterSubgraph: (definitionId: string) => void;
  /** Go back to breadcrumb depth `depth` (0 = root). */
  exitSubgraph: (depth?: number) => void;
}

/** The graph on screen; see the header for who writes it. */
export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  edges: [],
  components: [],
  process: { ...EMPTY_PROCESS },
  document: null,
  subgraphs: [],
  groups: [],
  subgraphPath: [],
  activeSubgraphId: null,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  zoom: 1,

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges }),

  addNode: (node) =>
    set((state) => ({ nodes: [...state.nodes, node] })),

  updateNode: (id, data) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      ),
    })),

  removeNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      edges: state.edges.filter(
        (edge) => edge.source !== id && edge.target !== id
      ),
    })),

  addEdge: (edge) =>
    set((state) => ({ edges: [...state.edges, edge] })),

  removeEdge: (id) =>
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== id),
    })),

  setSelection: (nodeIds, edgeIds) =>
    set({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds }),

  clearGraph: () =>
    set({ nodes: [], edges: [], selectedNodeIds: [], selectedEdgeIds: [] }),

  loadGraph: (nodes, edges) =>
    set({ nodes, edges, selectedNodeIds: [], selectedEdgeIds: [] }),

  setZoom: (zoom) => set({ zoom }),

  enterSubgraph: (definitionId) =>
    set((state) => {
      if (!state.subgraphs.some((item) => item.id === definitionId && !item.opaque)) return {};
      if (state.activeSubgraphId === definitionId) return {};
      const subgraphPath = [...state.subgraphPath, definitionId];
      return { subgraphPath, activeSubgraphId: definitionId };
    }),

  exitSubgraph: (depth = 0) =>
    set((state) => {
      const subgraphPath = state.subgraphPath.slice(0, Math.max(0, depth));
      return { subgraphPath, activeSubgraphId: subgraphPath[subgraphPath.length - 1] ?? null };
    }),
}));

/** Drops breadcrumb entries whose definitions no longer exist (after a dissolve or an import). */
export function pruneSubgraphPath(path: string[], subgraphs: SubgraphDefinition[]): string[] {
  const known = new Set(subgraphs.filter((item) => !item.opaque).map((item) => item.id));
  const kept: string[] = [];
  for (const id of path) {
    if (!known.has(id)) break;
    kept.push(id);
  }
  return kept;
}
