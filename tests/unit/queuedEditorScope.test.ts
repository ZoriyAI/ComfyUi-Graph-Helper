import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queueEdit, queueNudge, NUDGE_REST_MS } from '../../src/renderer/components/graph/lib/editBatch';
import { useProjectionStore, setManualGate } from '../../src/renderer/services/commands/projection';
import { useGraphStore } from '../../src/renderer/state/graphState';
import { useCanvasStore } from '../../src/renderer/components/graph/canvasStore';
import { pendingCommits } from '../../src/renderer/services/commands/pending';

// Typed with the request main receives, so the tests can read back what was sent.
const command = vi.fn(async (_request: { payload: unknown }) => ({ status: 'applied', projection: null, result: {} }));
const node = { id: '1', type: 'comfy', position: { x: 0, y: 0 }, data: { comfyType: 'Reroute', inputs: [], outputs: [], parameters: {} } };
const definition = (id: string) => ({ id, name: id, nodes: [structuredClone(node)], edges: [], inputs: [], outputs: [], nestedIn: null, raw: {} });

describe('queued gestures retain their originating graph and definition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal('window', { setTimeout, clearTimeout, electronAPI: { commitCommand: command } });
    useProjectionStore.setState({ projectId: 'desktop', graphKey: 'first', currentRevisionId: 'rev-1' });
    useGraphStore.setState({ nodes: [node] as never, subgraphs: [definition('A'), definition('B')], activeSubgraphId: 'A', edges: [] });
    useCanvasStore.setState({ replay: null });
    setManualGate(null);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); setManualGate(null); });
  it('sends nudges to A after B with the same local node id is opened', async () => {
    queueNudge('1', 20, 40);
    useGraphStore.setState({ activeSubgraphId: 'B' });
    await vi.advanceTimersByTimeAsync(NUDGE_REST_MS);
    expect(command).toHaveBeenCalledTimes(1);
    expect(command.mock.calls[0][0].payload).toMatchObject({ type: 'edit-in-subgraph', definitionId: 'A', edit: { type: 'move-node', nodeId: '1', x: 20, y: 40 } });
    expect(pendingCommits()).toBe(0);
  });
  it('captures same-tick edits before a level switch', async () => {
    queueEdit({ type: 'remove-node', nodeId: '1' }, 'delete');
    useGraphStore.setState({ activeSubgraphId: null });
    await vi.runAllTimersAsync();
    expect(command.mock.calls[0][0].payload).toMatchObject({ type: 'edit-in-subgraph', definitionId: 'A' });
  });
  it.each(['replacement', 'replay'])('does not apply a delayed edit after %s', async (change) => {
    queueNudge('1', 20, 40);
    if (change === 'replacement') useProjectionStore.setState({ graphKey: 'other' });
    else setManualGate(() => false);
    await vi.advanceTimersByTimeAsync(NUDGE_REST_MS);
    expect(command).not.toHaveBeenCalled();
    expect(pendingCommits()).toBe(0);
  });
});
