/**
 * An older in-window graph service: it edits the graph store directly and records snapshots in the revision store.
 *
 * Who uses it: services/actions/actionExecutor.ts and services/llm/tools.ts, which nothing in the app imports, and
 * the conflict tests (tests/integration/aiHumanConflict.test.ts, tests/unit/revisionConflict.test.ts,
 * tests/unit/baseRevisionTiming.test.ts). The app itself commits every edit through main
 * (services/commands/projection.ts), and the assistant's build tools run in main.
 */
import { GraphNode, GraphEdge, PortDefinition } from '../../types/graph';
import { useGraphStore } from '../../state/graphState';
import { useRevisionStore } from '../../state/revisionState';
import { GraphRevision } from '../../types/revisions';

/** The fields of a node that make up the workflow (what counts as a change). */
function semanticNode(node: GraphNode) {
  return {
    id: node.id,
    type: node.type,
    x: node.position?.x ?? null,
    y: node.position?.y ?? null,
    comfyType: node.data?.comfyType ?? null,
    title: node.data?.title ?? null,
    parameters: node.data?.parameters ?? {},
    annotations: node.data?.annotations ?? [],
    inputs: node.data?.inputs ?? [],
    outputs: node.data?.outputs ?? [],
    locked: node.data?.locked ?? false,
  };
}

/** The fields of a link that make up the workflow. */
function semanticEdge(edge: GraphEdge) {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
    dataType: edge.data?.dataType ?? null,
  };
}

/**
 * Graph operations on the window's graph store, each wrapped in a snapshot before and after.
 * Kept for the legacy executor and its conflict tests; the app's own edits do not go through it.
 */
export class GraphService {
  /**
   * Create a revision snapshot of current graph state
   */
  createRevision(
    source: 'user' | 'ai' | 'import' | 'system',
    description?: string
  ): GraphRevision {
    const { nodes, edges } = useGraphStore.getState();
    const { currentRevisionId } = useRevisionStore.getState();

    const revision: GraphRevision = {
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
  hasChangedSince(revisionId: string): boolean {
    const revision = useRevisionStore.getState().getRevision(revisionId);
    if (!revision) return true;

    const { nodes, edges } = useGraphStore.getState();

    // Compare workflow fields only. React Flow writes measured size and
    // selection onto the same node objects between tool calls; those are not edits.
    return (
      JSON.stringify(nodes.map(semanticNode)) !== JSON.stringify(revision.nodes.map(semanticNode)) ||
      JSON.stringify(edges.map(semanticEdge)) !== JSON.stringify(revision.edges.map(semanticEdge))
    );
  }

  /**
   * Restore graph to a specific revision
   */
  restoreRevision(revisionId: string): boolean {
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
   * Add a node to the graph (legacy path: used by the action executor and tests only).
   */
  addNode(args: {
    nodeType: string;
    title?: string;
    x?: number;
    y?: number;
    parameters?: Record<string, unknown>;
    source: 'user' | 'ai';
  }): GraphNode {
    const { nodeType, title, x = 300, y = 200, parameters = {}, source } = args;

    // Create revision BEFORE change
    this.createRevision(source, `Add ${nodeType} node`);

    const inputs = this.inferInputs(nodeType);
    const outputs = this.inferOutputs(nodeType);

    const node: GraphNode = {
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
   * Remove a node from the graph (legacy path: used by the action executor and tests only).
   */
  removeNode(nodeId: string, source: 'user' | 'ai'): boolean {
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
   * Update node parameters (legacy path: used by the action executor and tests only).
   */
  updateNode(
    nodeId: string,
    parameters: Record<string, unknown>,
    source: 'user' | 'ai'
  ): boolean {
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
   * Add annotation to a node (legacy path: used by the action executor and tests only).
   */
  annotateNode(nodeId: string, annotation: string, source: 'user' | 'ai'): boolean {
    const { nodes } = useGraphStore.getState();
    const targetNodeId = nodeId;
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
   * Connect two nodes (legacy path: used by the action executor and tests only).
   */
  connectNodes(args: {
    sourceNodeId: string;
    sourceOutputIndex: number;
    targetNodeId: string;
    targetInputIndex: number;
    source: 'user' | 'ai';
  }): GraphEdge | null {
    const { sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex, source } =
      args;
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

    const edge: GraphEdge = {
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

    console.log(
      `[GraphService] Connected ${sourceNodeId} to ${targetNodeId} (source: ${source})`
    );
    return edge;
  }

  /**
   * Get current graph state as JSON (for LLM context)
   */
  getCurrentGraphState(): string {
    const { nodes, edges } = useGraphStore.getState();
    return JSON.stringify(
      {
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
      },
      null,
      2
    );
  }

  /**
   * Get available node IDs (for LLM context)
   */
  getAvailableNodeIds(): string[] {
    const { nodes } = useGraphStore.getState();
    return nodes.map((n) => n.id);
  }

  /**
   * A small fixed table of inputs for a few core classes. The real port lists come from the catalog read from
   * ComfyUI; this table only serves the legacy path.
   */
  private inferInputs(nodeType: string): PortDefinition[] {
    const inputMap: Record<string, PortDefinition[]> = {
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
   * A small fixed table of outputs for a few core classes; any other class gets one 'unknown' output.
   */
  private inferOutputs(nodeType: string): PortDefinition[] {
    const outputMap: Record<string, PortDefinition[]> = {
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

// One service per window.
let graphServiceInstance: GraphService | null = null;

/** The window's one GraphService, made on first use. */
export function getGraphService(): GraphService {
  if (!graphServiceInstance) {
    graphServiceInstance = new GraphService();
  }
  return graphServiceInstance;
}
