import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatStore } from '../../src/renderer/state/chatState';
import { useGraphStore } from '../../src/renderer/state/graphState';
import { ChatService } from '../../src/renderer/services/llm/chatService';
import { useProjectionStore } from '../../src/renderer/services/commands/projection';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';

/** Pause → Resume keeps the run; Cancel stops the main stream first; an old turn cannot end a newer one. */

const projection = (runId: string | null, status: 'running' | 'paused' = 'running') => ({
  projectId: DESKTOP_PROJECT_ID,
  snapshot: { nodes: [], edges: [] },
  currentRevisionId: 'rev-1',
  revSeq: 1,
  activeRun: runId ? { runId, status, expectedRevisionId: 'rev-1' } : null,
});

const calls: string[] = [];
const api = {
  llmGetConfig: vi.fn(async () => ({ provider: 'test', model: 'x', baseURL: '' })),
  startRun: vi.fn(async () => ({ runId: 'run-new', baseRevisionId: 'rev-1', expectedRevisionId: 'rev-1', projection: projection('run-new') })),
  resumeRun: vi.fn(async () => ({ runId: 'run-paused', baseRevisionId: 'rev-0', expectedRevisionId: 'rev-1', projection: projection('run-paused') })),
  pauseRun: vi.fn(async () => ({ status: 'applied', projection: projection('run-paused', 'paused'), result: null })),
  cancelRun: vi.fn(async () => { calls.push('cancelRun'); return { status: 'applied', projection: projection(null), result: null }; }),
  closeRun: vi.fn(),
  llmCancel: vi.fn(async () => { calls.push('llmCancel'); return { cancelled: 1 }; }),
  llmStreamChat: vi.fn(),
  saveChatMessage: vi.fn(async () => ({ ok: true })),
};
(globalThis as any).window = { electronAPI: api };

describe('chat run lifecycle', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], isStreaming: false, isPaused: false });
    useGraphStore.setState({ nodes: [], edges: [] });
    useProjectionStore.setState({ projectId: DESKTOP_PROJECT_ID, revSeq: 0, currentRevisionId: '', activeRun: null });
    vi.clearAllMocks();
    calls.length = 0;
  });

  it('resume continues the same run instead of starting a new one', async () => {
    const service = new ChatService();
    await service.resume();
    api.llmStreamChat.mockImplementation(async (_m: unknown, _s: unknown, onChunk: (chunk: unknown) => void) => onChunk({ type: 'done' }));
    await service.sendMessage('continue');
    expect(api.startRun).not.toHaveBeenCalled();
    expect(api.llmStreamChat.mock.calls[0][3]).toMatchObject({ runId: 'run-paused' });
    // The run is closed by main, not by the renderer.
    expect(api.closeRun).not.toHaveBeenCalled();
    // The next turn starts a new run again.
    await service.sendMessage('new topic');
    expect(api.startRun).toHaveBeenCalledTimes(1);
  });

  it('cancel aborts the main stream, then cancels the run; the old turn cannot flip a new turn', async () => {
    const service = new ChatService();
    let releaseFirst: () => void = () => undefined;
    let firstChunk: (chunk: unknown) => void = () => undefined;
    api.llmStreamChat.mockImplementationOnce(async (_m: unknown, _s: unknown, onChunk: (chunk: unknown) => void) => {
      firstChunk = onChunk;
      await new Promise<void>((resolve) => { releaseFirst = resolve; });
    });
    const first = service.sendMessage('long one');
    await vi.waitFor(() => expect(api.llmStreamChat).toHaveBeenCalledTimes(1));
    service.cancel();
    await vi.waitFor(() => expect(calls).toEqual(['llmCancel', 'cancelRun']));
    expect(api.llmCancel).toHaveBeenCalledWith('run-new');
    expect(useChatStore.getState().isStreaming).toBe(false);

    let releaseSecond: () => void = () => undefined;
    api.llmStreamChat.mockImplementationOnce(async () => { await new Promise<void>((resolve) => { releaseSecond = resolve; }); });
    const second = service.sendMessage('next one');
    await vi.waitFor(() => expect(api.llmStreamChat).toHaveBeenCalledTimes(2));
    expect(useChatStore.getState().isStreaming).toBe(true);
    // The cancelled turn ends late: it must not end the new turn's streaming state.
    firstChunk({ type: 'done' });
    releaseFirst();
    await first;
    expect(useChatStore.getState().isStreaming).toBe(true);
    releaseSecond();
    await second;
    expect(useChatStore.getState().isStreaming).toBe(false);
  });
});
