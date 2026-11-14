import { afterEach, describe, expect, it, vi } from 'vitest';

type Listener = (event: unknown, chunk: unknown) => void;
const listeners = new Map<string, Set<Listener>>();
let exposed: Record<string, any> = {};
let reply: () => Promise<unknown> = async () => undefined;
const invokes: unknown[][] = [];

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: (_name: string, api: Record<string, any>) => { exposed = api; } },
  ipcRenderer: {
    on(channel: string, listener: Listener) {
      if (!listeners.has(channel)) listeners.set(channel, new Set());
      listeners.get(channel)!.add(listener);
    },
    removeListener(channel: string, listener: Listener) {
      listeners.get(channel)?.delete(listener);
    },
    invoke(...args: unknown[]) {
      invokes.push(args);
      return reply();
    },
    send() {},
  },
}));

const count = () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0);
const emit = (channel: string, chunk: unknown) => [...(listeners.get(channel) ?? [])].forEach((listener) => listener({}, chunk));
const run = { projectId: 'p', runId: 'r', expectedRevisionId: 'x' };

afterEach(() => vi.useRealTimers());

describe('preload stream listener', () => {
  it('keeps chunks that arrive after the reply and removes the listener on done', async () => {
    vi.useFakeTimers();
    await import('../../src/preload/index');
    const seen: unknown[] = [];
    reply = async () => undefined;
    await exposed.llmStreamChat([], [], (chunk: unknown) => seen.push(chunk), run);
    const channel = invokes[invokes.length - 1][3] as string;
    // The reply came first; the chunks still reach the chat.
    emit(channel, { type: 'tool-result', content: 1 });
    emit(channel, { type: 'done' });
    expect(seen).toEqual([{ type: 'tool-result', content: 1 }, { type: 'done' }]);
    expect(count()).toBe(0);
  });

  it('lets chunks after a stream error through briefly, then releases; never piles up', async () => {
    vi.useFakeTimers();
    await import('../../src/preload/index');
    const seen: unknown[] = [];
    reply = () => new Promise(() => undefined);
    void exposed.llmStreamChat([], [], (chunk: unknown) => seen.push(chunk), run);
    const channel = invokes[invokes.length - 1][3] as string;
    emit(channel, { type: 'error', content: 'model' });
    emit(channel, { type: 'projection', content: {} });
    expect(seen).toHaveLength(2);
    vi.advanceTimersByTime(5_000);
    expect(count()).toBe(0);

    reply = async () => { throw new Error('boom'); };
    await expect(exposed.llmStreamChat([], [], () => undefined, run)).rejects.toThrow('boom');
    reply = async () => undefined;
    for (let turn = 0; turn < 5; turn++) await exposed.llmStreamChat([], [], () => undefined, run);
    expect(count()).toBe(6);
    vi.advanceTimersByTime(60_000);
    expect(count()).toBe(0);
  });
});
