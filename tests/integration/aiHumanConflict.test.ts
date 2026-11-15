/**
 * Protects the stale-response guard of the renderer's action executor (graphService, actionExecutor, revision store).
 * An assistant action planned before a person's manual edit must be refused when it arrives, and applied when
 * nothing changed in between. Without this the assistant could quietly overwrite what the person just did.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGraphStore } from '../../src/renderer/state/graphState';
import { useRevisionStore } from '../../src/renderer/state/revisionState';
import { getGraphService } from '../../src/renderer/services/graph/graphService';
import { getActionExecutor } from '../../src/renderer/services/actions/actionExecutor';
import { GraphAction } from '../../src/renderer/types/revisions';

describe('AI+Human Conflict Detection', () => {
  beforeEach(() => {
    // Reset all stores
    useGraphStore.setState({
      nodes: [],
      edges: [],
      selectedNodeIds: [],
      selectedEdgeIds: [],
    });

    useRevisionStore.setState({
      revisions: [],
      currentRevisionId: null,
    });
  });

  it('should reject AI action when graph was modified manually after planning', async () => {
    const graphService = getGraphService();
    const executor = getActionExecutor();

    // 1. Initial state - add a node manually
    graphService.addNode({
      nodeType: 'LoadImage',
      source: 'user',
      x: 100,
      y: 100,
    });

    // 2. AI captures base revision (simulating LLM thinking time)
    const baseRevision = graphService.createRevision('system', 'AI planning state');
    
    // 3. User makes manual edit AFTER AI planned but BEFORE AI executes
    graphService.addNode({
      nodeType: 'SaveImage',
      source: 'user',
      x: 400,
      y: 100,
    });

    // 4. AI attempts to execute action based on stale state
    const aiAction: GraphAction = {
      id: 'action-delayed',
      type: 'add-node',
      timestamp: Date.now(),
      beforeRevisionId: baseRevision.id, // References OLD state
      payload: {
        nodeType: 'KSampler',
        x: 250,
        y: 150,
      },
      source: 'ai',
      status: 'pending',
    };

    await executor.queueAction(aiAction);

    // 5. VERIFY: Action should be rejected due to conflict
    expect(aiAction.status).toBe('conflict');
    expect(aiAction.error).toContain('changed');

    // 6. VERIFY: Only user nodes exist (AI action was not applied)
    const { nodes } = useGraphStore.getState();
    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.data.comfyType)).toEqual(['LoadImage', 'SaveImage']);
  });

  it('should apply AI action when no manual edits occurred', async () => {
    const graphService = getGraphService();
    const executor = getActionExecutor();

    // 1. Initial state
    graphService.addNode({
      nodeType: 'LoadImage',
      source: 'user',
      x: 100,
      y: 100,
    });

    // 2. AI captures base revision
    const baseRevision = graphService.createRevision('system', 'AI planning state');

    // 3. NO manual edits (graph unchanged)

    // 4. AI executes action
    const aiAction: GraphAction = {
      id: 'action-valid',
      type: 'add-node',
      timestamp: Date.now(),
      beforeRevisionId: baseRevision.id,
      payload: {
        nodeType: 'KSampler',
        x: 250,
        y: 150,
      },
      source: 'ai',
      status: 'pending',
    };

    await executor.queueAction(aiAction);

    // 5. VERIFY: Action should be applied
    expect(aiAction.status).toBe('applied');

    // 6. VERIFY: Both nodes exist
    const { nodes } = useGraphStore.getState();
    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.data.comfyType)).toEqual(['LoadImage', 'KSampler']);
  });

  it('should track operation source correctly', () => {
    const graphService = getGraphService();

    // Manual operation
    graphService.addNode({
      nodeType: 'LoadImage',
      source: 'user',
      x: 100,
      y: 100,
    });

    // AI operation
    graphService.addNode({
      nodeType: 'KSampler',
      source: 'ai',
      x: 400,
      y: 100,
    });

    // VERIFY: Revisions track source
    const { revisions } = useRevisionStore.getState();
    
    const userRevisions = revisions.filter((r) => r.source === 'user');
    const aiRevisions = revisions.filter((r) => r.source === 'ai');

    expect(userRevisions.length).toBeGreaterThan(0);
    expect(aiRevisions.length).toBeGreaterThan(0);
  });
});
