import { afterEach, describe, expect, it, vi } from 'vitest';
import { commitManual, reportRefusal } from '../../src/renderer/components/graph/commit';
import { useToastStore } from '../../src/renderer/ui/toastStore';
import * as projection from '../../src/renderer/services/commands/projection';
import { useCanvasStore } from '../../src/renderer/components/graph/canvasStore';
import { revealSteps } from '../../src/renderer/components/graph/lib/graphDiff';

describe('canvas edit refusals', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows unexpected commit errors and always releases the manual-in-flight state', async () => {
    useToastStore.setState({ toasts: [] });
    useCanvasStore.setState({ replay: null, manualInFlight: 0 });
    vi.spyOn(projection, 'submitManual').mockRejectedValue(new Error('Fixture transport disconnected'));
    await expect(commitManual({ type: 'add-node', nodeType: 'KSampler' })).resolves.toBeNull();
    expect(useCanvasStore.getState().manualInFlight).toBe(0);
    expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
      tone: 'error', description: 'Fixture transport disconnected',
    });
  });
  it('shows a toast for a rejected or conflicting manual edit and nothing for an applied one', () => {
    useToastStore.setState({ toasts: [] });
    reportRefusal({ status: 'applied', result: {} });
    expect(useToastStore.getState().toasts).toHaveLength(0);
    reportRefusal({ status: 'rejected', result: { error: 'Port types cannot be connected.' } });
    const toast = useToastStore.getState().toasts.at(-1)!;
    expect(toast).toMatchObject({ id: 'canvas-edit-refused', tone: 'warn' });
    expect(typeof toast.description).toBe('string');
    reportRefusal({ status: 'conflict', result: null });
    expect(useToastStore.getState().toasts.filter((item) => item.open)).toHaveLength(1);
  });

  it('orders reveal steps: ready edges first, then each node with the edges it completes', () => {
    const steps = revealSteps({ addedNodes: ['a', 'b'], addedEdges: ['e0', 'e1'] }, [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e0', source: 'x', target: 'y' },
    ]);
    expect(steps).toEqual([{ kind: 'edge', id: 'e0' }, { kind: 'node', id: 'a' }, { kind: 'node', id: 'b' }, { kind: 'edge', id: 'e1' }]);
  });
});
