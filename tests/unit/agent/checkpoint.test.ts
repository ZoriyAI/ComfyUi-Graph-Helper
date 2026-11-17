/**
 * Renderer side of the step checkpoint: a 'turn-paused' chunk puts an open Continue / Stop card on the turn's
 * message and leaves the chat paused; Continue resumes the same run and sends "continue" with the same context.
 * A long build that hits the step limit must wait for the person, and Continue must not start a second run.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('checkpoint card (renderer chat service)', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    vi.restoreAllMocks();
  });

  it('reads the chunk defensively', async () => {
    const { parseTurnPaused } = await import('../../../src/renderer/services/llm/chatService');
    expect(parseTurnPaused({ reason: 'step-limit', steps: 60, canContinue: true })).toEqual({ reason: 'step-limit', steps: 60 });
    expect(parseTurnPaused({ reason: 'failure-streak', steps: 7, failures: 3 })).toEqual({ reason: 'failure-streak', steps: 7, failures: 3 });
    expect(parseTurnPaused({ reason: 'other', steps: 1 })).toBeNull();
    expect(parseTurnPaused('nope')).toBeNull();
  });

  it('shows an open card on turn-paused, keeps the chat paused, and Continue resumes the same run with "continue"', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const calls: Array<{ history: Array<{ role: string; content: string }>; run: { runId: string }; context: { intent: string } }> = [];
    const projection = { projectId: 'desktop', graphKey: 'graph-1', currentRevisionId: 'r1', revSeq: 1, snapshot: { nodes: [], edges: [] }, activeRun: { runId: 'run-1', status: 'paused' } };
    const api = {
      llmGetConfig: async () => ({ provider: 'test', model: 'test-fixture', baseURL: '' }),
      startRun: vi.fn(async () => ({ runId: 'run-1', baseRevisionId: 'r0', expectedRevisionId: 'r1', projection })),
      resumeRun: vi.fn(async () => ({ runId: 'run-1', baseRevisionId: 'r0', expectedRevisionId: 'r2', projection })),
      saveChatMessage: async () => ({ ok: true }),
      llmStreamChat: async (history: any, _specs: unknown, onChunk: (chunk: { type: string; content?: unknown }) => void, run: any, context: any) => {
        calls.push({ history, run, context });
        if (calls.length === 1) {
          onChunk({ type: 'text-delta', content: { text: 'Building.' } });
          onChunk({ type: 'turn-paused', content: { reason: 'step-limit', steps: 60, canContinue: true } });
        } else {
          onChunk({ type: 'text-delta', content: { text: 'Done.' } });
        }
        onChunk({ type: 'done' });
      },
    };
    // The chat service talks to the main process only through window.electronAPI, so a fake preload is enough.
    (globalThis as { window?: unknown }).window = { electronAPI: api };
    const { ChatService } = await import('../../../src/renderer/services/llm/chatService');
    const { useChatStore } = await import('../../../src/renderer/state/chatState');
    useChatStore.getState().clearChat();
    const service = new ChatService();

    await service.sendMessage('Build a long chain', { intent: 'build' });
    const paused = useChatStore.getState().messages.find((message) => message.checkpoint);
    expect(paused?.checkpoint).toMatchObject({ reason: 'step-limit', steps: 60, state: 'open', context: { intent: 'build' } });
    expect(useChatStore.getState().isPaused).toBe(true);

    await service.continueFromCheckpoint(paused!.id);
    expect(api.resumeRun).toHaveBeenCalledTimes(1);
    expect(api.startRun).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
    expect(calls[1].run.runId).toBe('run-1');
    expect(calls[1].context.intent).toBe('build');
    expect(calls[1].history[calls[1].history.length - 1]).toEqual({ role: 'user', content: 'continue' });
    const state = useChatStore.getState();
    expect(state.messages.find((message) => message.id === paused!.id)?.checkpoint?.state).toBe('continued');
    expect(state.isPaused).toBe(false);
    // Continue on a card that is no longer open does nothing.
    await service.continueFromCheckpoint(paused!.id);
    expect(calls).toHaveLength(2);
  });
});
