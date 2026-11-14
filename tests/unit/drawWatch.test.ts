import { describe, expect, it, vi } from 'vitest';
import { useProjectionStore } from '../../src/renderer/services/commands/projection';
import { installDrawWatch } from '../../src/renderer/services/start/drawWatch';

describe('the window tells main once a graph is drawn', () => {
  it('tells each new revision after it was painted, once', () => {
    const frames: Array<() => void> = [];
    vi.stubGlobal('requestAnimationFrame', (run: () => void) => { frames.push(run); return frames.length; });
    const graphDrawn = vi.fn(async () => ({ ok: true }));
    const off = installDrawWatch({ graphDrawn });
    useProjectionStore.setState({ currentRevisionId: 'rev-1' });
    expect(graphDrawn).not.toHaveBeenCalled();
    while (frames.length > 0) frames.shift()!();
    expect(graphDrawn).toHaveBeenCalledWith('rev-1');
    useProjectionStore.setState({ currentRevisionId: 'rev-1' });
    while (frames.length > 0) frames.shift()!();
    expect(graphDrawn).toHaveBeenCalledTimes(1);
    off();
    vi.unstubAllGlobals();
  });
});
