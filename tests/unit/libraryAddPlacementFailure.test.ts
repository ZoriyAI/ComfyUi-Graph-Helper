/**
 * Checks that adding a node from the library tells the person when the placement step fails (it used to throw
 * outside the try, so nothing was shown and the add looked silently ignored).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addNodeFromLibrary } from '../../src/renderer/components/library/NodeLibrary';
import { placeNewNode } from '../../src/renderer/components/graph/placeNode';
import { showToast } from '../../src/renderer/ui/toastStore';
import { useGraphStore } from '../../src/renderer/state/graphState';
import { useCanvasStore } from '../../src/renderer/components/graph/canvasStore';

vi.mock('../../src/renderer/components/graph/placeNode', () => ({ placeNewNode: vi.fn() }));
vi.mock('../../src/renderer/ui/toastStore', () => ({ showToast: vi.fn() }));

const commitCommand = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', { electronAPI: { commitCommand }, requestAnimationFrame: vi.fn() });
  useGraphStore.setState({ nodes: [], edges: [], subgraphs: [], activeSubgraphId: null } as never);
  useCanvasStore.setState({ replay: null });
});

describe('library add when placement fails', () => {
  it('shows the "add failed" toast and commits nothing', async () => {
    vi.mocked(placeNewNode).mockRejectedValueOnce(new Error('no canvas'));
    await addNodeFromLibrary({ classType: 'KSampler', displayName: 'KSampler' }, { added: 'Added', failed: 'Failed' });
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ id: 'library-add', tone: 'error', title: 'Failed' }));
    expect(commitCommand).not.toHaveBeenCalled();
  });
});
