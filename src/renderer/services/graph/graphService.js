import { useGraphStore } from '../../state/graphState';
import { useRevisionStore } from '../../state/revisionState';
/**
 * Unified graph service for all graph operations
 * Used by both manual UI actions and AI tool calls
 */
export class GraphService {
    /**
     * Create a revision snapshot of current graph state
     */
    createRevision(source, description) {
        const { nodes, edges } = useGraphStore.getState();
        const { currentRevisionId } = useRevisionStore.getState();
        const revision = {
            id: `rev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            // Deep copy to prevent mutations
            nodes: JSON.parse(JSON.stringify(nodes)),
            edges: JSON.parse(JSON.stringify(edges)),
            parentRevisionId: currentRevisionId || undefined,
            description,
            source,
        };
        useRevisionStore.getState().addRevision(revision);
        return revision;
    }
    /**
     * Check if graph state has changed since a revision
     */
    hasChangedSince(revisionId) {
        const revision = useRevisionStore.getState().getRevision(revisionId);
        if (!revision)
            return true;
        const { nodes, edges } = useGraphStore.getState();
        // Simple comparison via JSON stringify
        return (JSON.stringify(nodes) !== JSON.stringify(revision.nodes) ||
            JSON.stringify(edges) !== JSON.stringify(revision.edges));
    }
    /**
     * Restore graph to a specific revision
     */
    restoreRevision(revisionId) {
        const revision = useRevisionStore.getState().getRevision(revisionId);
        if (!revision) {
            console.error(`[GraphService] Revision ${revisionId} not found`);
            return false;
        }
        useGraphStore.setState({
            nodes: JSON.parse(JSON.stringify(revision.nodes)),
            edges: JSON.parse(JSON.stringify(revision.edges)),
        });
        useRevisionStore.getState().setCurrentRevision(revisionId);
        return true;
    }
    /**
     * Add a node to the graph
     * @unified Used by both manual UI and AI tools
     */
    addNode(args) {
        const { nodeType, title, x = 300, y = 200, parameters = {}, source } = args;
        // Create revision BEFORE change
        this.createRevision(source, `Add ${nodeType} node`);
        const inputs = this.inferInputs(nodeType);
        const outputs = this.inferOutputs(nodeType);
        const node = {
            id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'comfy',
            position: { x, y },
            data: {
                comfyType: nodeType,
                title: title || nodeType,
                inputs,
                outputs,
                parameters,
            },
        };
        useGraphStore.getState().addNode(node);
        // Create revision AFTER change
        this.createRevision(source, `Added ${nodeType} node (${node.id})`);
        console.log(`[GraphService] Added node ${node.id} (source: ${source})`);
        return node;
    }
    /**
     * Remove a node from the graph
     * @unified Used by both manual UI and AI tools
     */
    removeNode(nodeId, source) {
        const { nodes } = useGraphStore.getState();
        const exists = nodes.some((n) => n.id === nodeId);
        if (!exists) {
            console.warn(`[GraphService] Node ${nodeId} not found`);
            return false;
        }
        this.createRevision(source, `Remove node ${nodeId}`);
        useGraphStore.getState().removeNode(nodeId);
        this.createRevision(source, `Removed node ${nodeId}`);
        console.log(`[GraphService] Removed node ${nodeId} (source: ${source})`);
        return true;
    }
    /**
     * Update node parameters
     * @unified Used by both manual UI and AI tools
     */
    updateNode(nodeId, parameters, source) {
        const { nodes } = useGraphStore.getState();
        const exists = nodes.some((n) => n.id === nodeId);
        if (!exists) {
            console.warn(`[GraphService] Node ${nodeId} not found`);
            return false;
        }
        this.createRevision(source, `Update node ${nodeId}`);
        useGraphStore.getState().updateNode(nodeId, { parameters });
        this.createRevision(source, `Updated node ${nodeId}`);
        console.log(`[GraphService] Updated node ${nodeId} (source: ${source})`);
        return true;
    }
    /**
     * Add annotation to a node
     * @unified Used by both manual UI and AI tools
     */
    annotateNode(nodeId, annotation, source) {
        const { nodes } = useGraphStore.getState();
        // Handle LATEST_NODE placeholder (for test fixtures)
        let targetNodeId = nodeId;
        if (nodeId === 'LATEST_NODE') {
            // Find most recently added node (highest timestamp in ID)
            const sortedNodes = [...nodes].sort((a, b) => {
                const aTime = parseInt(a.id.split('-')[1]) || 0;
                const bTime = parseInt(b.id.split('-')[1]) || 0;
                return bTime - aTime;
            });
            if (sortedNodes.length > 0) {
                targetNodeId = sortedNodes[0].id;
                console.log(`[GraphService] Resolved LATEST_NODE to ${targetNodeId}`);
            }
        }
        const node = nodes.find((n) => n.id === targetNodeId);
        if (!node) {
            console.warn(`[GraphService] Node ${targetNodeId} not found`);
            return false;
        }
        this.createRevision(source, `Annotate node ${targetNodeId}`);
        const annotations = node.data.annotations || [];
        useGraphStore.getState().updateNode(targetNodeId, {
            annotations: [...annotations, annotation],
        });
        this.createRevision(source, `Annotated node ${targetNodeId}`);
        console.log(`[GraphService] Annotated node ${targetNodeId} (source: ${source})`);
        return true;
    }
    /**
     * Connect two nodes
     * @unified Used by both manual UI and AI tools
     */
    connectNodes(args) {
        const { sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex, source } = args;
        const { nodes } = useGraphStore.getState();
        const sourceNode = nodes.find((n) => n.id === sourceNodeId);
        const targetNode = nodes.find((n) => n.id === targetNodeId);
        if (!sourceNode || !targetNode) {
            console.error('[GraphService] Source or target node not found');
            return null;
        }
        const sourceOutput = sourceNode.data.outputs[sourceOutputIndex];
        const targetInput = targetNode.data.inputs[targetInputIndex];
        if (!sourceOutput || !targetInput) {
            console.error('[GraphService] Source output or target input not found');
            return null;
        }
        this.createRevision(source, `Connect ${sourceNodeId} to ${targetNodeId}`);
        const edge = {
            id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            source: sourceNodeId,
            target: targetNodeId,
            sourceHandle: sourceOutput.id,
            targetHandle: targetInput.id,
            data: {
                dataType: sourceOutput.dataType,
            },
        };
        useGraphStore.getState().addEdge(edge);
        this.createRevision(source, `Connected ${sourceNodeId} to ${targetNodeId}`);
        console.log(`[GraphService] Connected ${sourceNodeId} to ${targetNodeId} (source: ${source})`);
        return edge;
    }
    /**
     * Get current graph state as JSON (for LLM context)
     */
    getCurrentGraphState() {
        const { nodes, edges } = useGraphStore.getState();
        return JSON.stringify({
            nodes: nodes.map((n) => ({
                id: n.id,
                type: n.data.comfyType,
                title: n.data.title,
                parameters: n.data.parameters,
                position: n.position,
            })),
            edges: edges.map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
            })),
        }, null, 2);
    }
    /**
     * Get available node IDs (for LLM context)
     */
    getAvailableNodeIds() {
        const { nodes } = useGraphStore.getState();
        return nodes.map((n) => n.id);
    }
    /**
     * Infer inputs based on node type
     * TODO: Replace with MCP discovery
     */
    inferInputs(nodeType) {
        const inputMap = {
            KSampler: [
                { id: 'in-0', name: 'model', dataType: 'MODEL', optional: false },
                { id: 'in-1', name: 'positive', dataType: 'CONDITIONING', optional: false },
                { id: 'in-2', name: 'negative', dataType: 'CONDITIONING', optional: false },
                { id: 'in-3', name: 'latent_image', dataType: 'LATENT', optional: false },
            ],
            VAEDecode: [
                { id: 'in-0', name: 'samples', dataType: 'LATENT', optional: false },
                { id: 'in-1', name: 'vae', dataType: 'VAE', optional: false },
            ],
            SaveImage: [
                { id: 'in-0', name: 'images', dataType: 'IMAGE', optional: false },
            ],
            CLIPTextEncode: [
                { id: 'in-0', name: 'clip', dataType: 'CLIP', optional: false },
                { id: 'in-1', name: 'text', dataType: 'STRING', optional: false },
            ],
        };
        return inputMap[nodeType] || [];
    }
    /**
     * Infer outputs based on node type
     * TODO: Replace with MCP discovery
     */
    inferOutputs(nodeType) {
        const outputMap = {
            LoadImage: [{ id: 'out-0', name: 'IMAGE', dataType: 'IMAGE', optional: false }],
            KSampler: [{ id: 'out-0', name: 'LATENT', dataType: 'LATENT', optional: false }],
            VAEDecode: [{ id: 'out-0', name: 'IMAGE', dataType: 'IMAGE', optional: false }],
            CLIPTextEncode: [
                { id: 'out-0', name: 'CONDITIONING', dataType: 'CONDITIONING', optional: false },
            ],
            CheckpointLoaderSimple: [
                { id: 'out-0', name: 'MODEL', dataType: 'MODEL', optional: false },
                { id: 'out-1', name: 'CLIP', dataType: 'CLIP', optional: false },
                { id: 'out-2', name: 'VAE', dataType: 'VAE', optional: false },
            ],
        };
        return outputMap[nodeType] || [
            { id: 'out-0', name: 'OUTPUT', dataType: 'unknown', optional: false },
        ];
    }
}
// Singleton instance
let graphServiceInstance = null;
export function getGraphService() {
    if (!graphServiceInstance) {
        graphServiceInstance = new GraphService();
    }
    return graphServiceInstance;
}
