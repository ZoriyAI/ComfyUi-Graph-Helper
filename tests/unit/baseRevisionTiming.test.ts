/**
 * Protects conflict detection in the renderer action executor (services/actions/actionExecutor): the base revision
 * is taken before the model thinks, so a tool call that arrives after a manual edit is refused and the edit stays.
 * Only renderer/services/llm/tools.ts calls this executor, and nothing in src imports that file; the live app
 * checks revisions in main/commands/commit instead.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGraphStore } from '../../src/renderer/state/graphState';
import { useRevisionStore } from '../../src/renderer/state/revisionState';
import { getGraphService } from '../../src/renderer/services/graph/graphService';
import { getActionExecutor } from '../../src/renderer/services/actions/actionExecutor';
import { GraphAction } from '../../src/renderer/types/revisions';

describe('Base Revision Timing', () => {
  beforeEach(() => {
    useGraphStore.setState({ nodes: [], edges: [] });
    useRevisionStore.setState({ revisions: [], currentRevisionId: null });
  });

  it('should detect conflict when graph changes after base revision captured', async () => {
    console.log('\n=== TEST: Base revision timing ===');

    const graphService = getGraphService();
    const executor = getActionExecutor();

    // Step 1: Capture base revision (simulates: before sending to model)
    const baseRev = graphService.createRevision('system', 'Before AI turn');
    console.log(`[TEST] Base revision captured: ${baseRev.id}`);

    // Step 2: Simulate human manual edit (during model "thinking")
    console.log('[TEST] Human edits graph');
    const { addNode } = useGraphStore.getState();
    addNode({
      id: 'manual-node',
      type: 'comfy',
      position: { x: 0, y: 0 },
      data: {
        comfyType: 'HumanNode',
        title: 'Manual',
        inputs: [],
        outputs: [],
        parameters: {},
      },
    });

    // Step 3: AI tool call arrives (using old base revision)
    console.log('[TEST] AI tool call with stale base revision');
    const action: GraphAction = {
      id: 'a-stale',
      type: 'add-node',
      timestamp: Date.now(),
      beforeRevisionId: baseRev.id,
      payload: { nodeType: 'AINode', title: 'Should be rejected' },
      source: 'ai',
      status: 'pending',
    };

    await executor.queueAction(action);

    // Verify conflict detected
    expect(action.status).toBe('conflict');
    expect(action.error).toContain('changed');

    // Verify only manual node in graph
    const { nodes } = useGraphStore.getState();
    expect(nodes.length).toBe(1);
    expect(nodes[0].data.comfyType).toBe('HumanNode');

    console.log('[TEST] ✓ Conflict detected, stale action rejected\n');
  });

  it('should apply AI action when no manual edits occurred', async () => {
    const graphService = getGraphService();
    const executor = getActionExecutor();

    // Capture base revision
    const baseRev = graphService.createRevision('system', 'Before AI turn');

    // AI tool call arrives (no intervening manual edits)
    const action: GraphAction = {
      id: 'a-valid',
      type: 'add-node',
      timestamp: Date.now(),
      beforeRevisionId: baseRev.id,
      payload: { nodeType: 'AINode', title: 'Should succeed' },
      source: 'ai',
      status: 'pending',
    };

    await executor.queueAction(action);

    // Verify applied
    expect(action.status).toBe('applied');

    const { nodes } = useGraphStore.getState();
    expect(nodes.length).toBe(1);
    expect(nodes[0].data.comfyType).toBe('AINode');

    console.log('[TEST] ✓ No conflict, action applied\n');
  });
});
