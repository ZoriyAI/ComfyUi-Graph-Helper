import { describe, expect, it, vi } from 'vitest';

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

describe('preload stream listener', () => {
  it('removes the per-turn listener on done, on error, and when the call settles', async () => {
    await import('../../src/preload/index');
    const run = { projectId: 'p', runId: 'r', expectedRevisionId: 'x' };
    const seen: unknown[] = [];

    let release!: () => void;
    reply = () => new Promise((resolve) => { release = () => resolve(undefined); });
    const first = exposed.llmStreamChat([], [], (chunk: unknown) => seen.push(chunk), run);
    const channel = invokes[0][3] as string;
    emit(channel, { type: 'text', content: 'a' });
    expect(count()).toBe(1);
    emit(channel, { type: 'done' });
    expect(count()).toBe(0);
    release();
    await first;

    reply = async () => { throw new Error('boom'); };
    await expect(exposed.llmStreamChat([], [], () => undefined, run)).rejects.toThrow('boom');
    expect(count()).toBe(0);

    reply = async () => undefined;
    for (let turn = 0; turn < 5; turn++) await exposed.llmStreamChat([], [], () => undefined, run);
    expect(count()).toBe(0);
    expect(seen).toEqual([{ type: 'text', content: 'a' }, { type: 'done' }]);
  });
});
