/** Verifies scoped model release, cancellation races, timeout handling and explicit resumption. */
import { describe, expect, it, vi } from 'vitest';
import { AssistantMemoryLifecycle } from '../../src/main/llm/memoryLifecycle';

function server(initial = ['assistant:latest', 'comfy-helper:latest'], confirm = true) {
  let loaded = [...initial];
  const unloaded: string[] = [];
  const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith('/api/ps')) return Response.json({ models: loaded.map(name => ({ name })) });
    const body = JSON.parse(String(init?.body));
    expect(body.keep_alive).toBe(0); unloaded.push(body.model);
    if (confirm) loaded = loaded.filter(name => name !== `${body.model}:latest` && name !== body.model);
    return Response.json({ done: true });
  }) as unknown as typeof fetch;
  return { transport, unloaded };
}
const config = { provider: 'local', baseURL: 'http://localhost:11434/v1', model: 'assistant' };

describe('assistant memory handoff', () => {
  it('cancels own requests first, coalesces release, verifies unload, and leaves unrelated models alone', async () => {
    const s = server(); const memory = new AssistantMemoryLifecycle(s.transport);
    memory.track(config); memory.track(config);
    memory.track({ provider: 'openai', model: 'cloud' });
    let signal: AbortSignal | undefined;
    await memory.fetch(async (_input, init) => { signal = init?.signal ?? undefined; return Response.json({}); })('http://localhost/test');
    const removeStop = memory.onStop(() => { expect(signal?.aborted).toBe(true); expect(s.unloaded).toHaveLength(0); });
    const one = memory.release(); expect(memory.release()).toBe(one);
    expect(memory.resume().paused).toBe(true);
    const result = await one;
    expect(result).toEqual({ phase: 'released', paused: true, models: [{ name: 'assistant', released: true }] });
    expect(s.unloaded).toEqual(['assistant']);
    expect(memory.isPaused()).toBe(true); removeStop();
    memory.track({ ...config, model: 'background' });
    expect(await memory.release()).toMatchObject({ phase: 'released', models: [] });
    expect(s.unloaded).toHaveLength(1);
  });

  it('old clients remain cancelled after explicit resume while new requests can run', async () => {
    const memory = new AssistantMemoryLifecycle(server().transport);
    const base = vi.fn(async () => Response.json({}));
    const old = memory.fetch(base);
    await memory.release(); memory.resume();
    expect(() => old('http://localhost/test')).toThrow();
    expect(base).not.toHaveBeenCalled();
    await memory.fetch(base)('http://localhost/test');
    expect(base).toHaveBeenCalledOnce();
  });

  it('never claims success when the server still lists the model and retries it later', async () => {
    const s = server(['assistant:latest'], false); const memory = new AssistantMemoryLifecycle(s.transport);
    memory.track(config);
    expect(await memory.release()).toMatchObject({ phase: 'partial', paused: true, models: [{ name: 'assistant', released: false }] });
    await memory.release(); expect(s.unloaded).toEqual(['assistant', 'assistant']);
  });

  it('bounds a stalled server and does not stop or reconfigure any shared service', async () => {
    const memory = new AssistantMemoryLifecycle(async () => await new Promise(() => {}), 25);
    memory.track(config);
    expect(await memory.release()).toMatchObject({ phase: 'partial', models: [{ name: 'assistant', released: false }] });
    expect(memory.isPaused()).toBe(true);
  });

  it('postpones unloading if an own consumer cannot be stopped', async () => {
    const s = server(); const memory = new AssistantMemoryLifecycle(s.transport, 25);
    memory.track(config); memory.onStop(() => { throw new Error('still active'); });
    expect(await memory.release()).toMatchObject({ phase: 'partial', error: 'stop-failed', paused: true });
    expect(s.unloaded).toHaveLength(0);
  });
});

it('sends an explicit expiry even if the just-cancelled model has not appeared in /api/ps yet', async () => {
  const s = server([]); const memory = new AssistantMemoryLifecycle(s.transport);
  memory.track(config); expect((await memory.release()).phase).toBe('released');
  expect(s.unloaded).toEqual(['assistant']);
});
