import { beforeEach, describe, expect, it } from 'vitest';
import { getGraphService } from '../../src/renderer/services/graph/graphService';
import { useGraphStore } from '../../src/renderer/state/graphState';
import { useRevisionStore } from '../../src/renderer/state/revisionState';

describe('revision conflict detection', () => {
  beforeEach(() => {
    useGraphStore.setState({
      nodes: [],
      edges: [],
      selectedNodeIds: [],
      selectedEdgeIds: [],
    });
    useRevisionStore.setState({ revisions: [], currentRevisionId: null });
  });

  it('ignores React Flow measurement fields and detects real edits', () => {
    const graph = getGraphService();
    const node = graph.addNode({
      nodeType: 'TestNode',
      title: 'AI Test Node',
      x: 10,
      y: 20,
      source: 'ai',
    });
    const revisionId = useRevisionStore.getState().currentRevisionId;
    expect(revisionId).toBeTruthy();
    expect(graph.hasChangedSince(revisionId!)).toBe(false);

    useGraphStore.setState({
      nodes: useGraphStore.getState().nodes.map((current) => ({
        ...current,
        measured: { width: 180, height: 90 },
        selected: true,
        width: 180,
        height: 90,
      })),
    });
    expect(graph.hasChangedSince(revisionId!)).toBe(false);

    useGraphStore.getState().updateNode(node.id, { annotations: ['AI added annotation'] });
    expect(graph.hasChangedSince(revisionId!)).toBe(true);
  });

  it('treats a missing base revision as a conflict', () => {
    expect(getGraphService().hasChangedSince('rev-missing')).toBe(true);
  });
});
