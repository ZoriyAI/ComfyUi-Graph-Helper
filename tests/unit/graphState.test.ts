/**
 * The basic node actions of the renderer's graph store (state/graphState.ts, read by the canvas, the panels and the
 * services that apply projections): add, remove, update and clear. Every view of the graph a person sees is drawn
 * from this store, so these must change exactly the node asked for.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGraphStore } from '../../src/renderer/state/graphState';
import { GraphNode } from '../../src/renderer/types/graph';

describe('Graph State', () => {
  beforeEach(() => {
    // Reset store before each test
    useGraphStore.setState({
      nodes: [],
      edges: [],
      selectedNodeIds: [],
      selectedEdgeIds: [],
    });
  });

  it('should add a node', () => {
    const node: GraphNode = {
      id: 'test-1',
      type: 'comfy',
      position: { x: 0, y: 0 },
      data: {
        comfyType: 'TestNode',
        inputs: [],
        outputs: [],
        parameters: {},
      },
    };

    useGraphStore.getState().addNode(node);
    
    const state = useGraphStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].id).toBe('test-1');
  });

  it('should remove a node', () => {
    const node: GraphNode = {
      id: 'test-1',
      type: 'comfy',
      position: { x: 0, y: 0 },
      data: {
        comfyType: 'TestNode',
        inputs: [],
        outputs: [],
        parameters: {},
      },
    };

    useGraphStore.getState().addNode(node);
    useGraphStore.getState().removeNode('test-1');
    
    const state = useGraphStore.getState();
    expect(state.nodes).toHaveLength(0);
  });

  it('should update node data', () => {
    const node: GraphNode = {
      id: 'test-1',
      type: 'comfy',
      position: { x: 0, y: 0 },
      data: {
        comfyType: 'TestNode',
        inputs: [],
        outputs: [],
        parameters: { value: 10 },
      },
    };

    useGraphStore.getState().addNode(node);
    useGraphStore.getState().updateNode('test-1', { parameters: { value: 20 } });
    
    const state = useGraphStore.getState();
    expect(state.nodes[0].data.parameters.value).toBe(20);
  });

  it('should clear graph', () => {
    const node: GraphNode = {
      id: 'test-1',
      type: 'comfy',
      position: { x: 0, y: 0 },
      data: {
        comfyType: 'TestNode',
        inputs: [],
        outputs: [],
        parameters: {},
      },
    };

    useGraphStore.getState().addNode(node);
    useGraphStore.getState().clearGraph();
    
    const state = useGraphStore.getState();
    expect(state.nodes).toHaveLength(0);
    expect(state.edges).toHaveLength(0);
  });
});
