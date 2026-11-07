import { create } from 'zustand';
export const useGraphStore = create((set) => ({
    nodes: [],
    edges: [],
    selectedNodeIds: [],
    selectedEdgeIds: [],
    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
    updateNode: (id, data) => set((state) => ({
        nodes: state.nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, ...data } } : node),
    })),
    removeNode: (id) => set((state) => ({
        nodes: state.nodes.filter((node) => node.id !== id),
        edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id),
    })),
    addEdge: (edge) => set((state) => ({ edges: [...state.edges, edge] })),
    removeEdge: (id) => set((state) => ({
        edges: state.edges.filter((edge) => edge.id !== id),
    })),
    setSelection: (nodeIds, edgeIds) => set({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds }),
    clearGraph: () => set({ nodes: [], edges: [], selectedNodeIds: [], selectedEdgeIds: [] }),
    loadGraph: (nodes, edges) => set({ nodes, edges, selectedNodeIds: [], selectedEdgeIds: [] }),
}));
