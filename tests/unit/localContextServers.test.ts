import { beforeEach, describe, expect, it } from 'vitest';
import { probeLoadedContext, readOtherServerContext, resetLocalContextMemory } from '../../src/main/llm/localContext';

/** A small fake server: path → JSON body; anything else is 404. Records every request. */
function fakeServer(routes: Record<string, unknown>, seen: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    seen.push(`${init?.method ?? 'GET'} ${url.pathname}`);
    if (!(url.pathname in routes)) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(routes[url.pathname]), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

describe('the context window of a local server that is not Ollama (L1)', () => {
  beforeEach(() => resetLocalContextMemory());

  it('reads llama.cpp from /props', async () => {
    const seen: string[] = [];
    const fetchImpl = fakeServer({ '/props': { default_generation_settings: { n_ctx: 8192 }, total_slots: 1 } }, seen);
    await expect(probeLoadedContext('http://127.0.0.1:8080/v1', 'any.gguf', fetchImpl)).resolves.toBe(8192);
    expect(seen.every((line) => line.startsWith('GET '))).toBe(true);
  });

  it('reads LM Studio from a loaded instance in /api/v1/models', async () => {
    const fetchImpl = fakeServer({
      '/v1/models': { object: 'list', data: [{ id: 'qwen3-8b', object: 'model' }] },
      '/api/v1/models': { models: [
        { key: 'other', loaded_instances: [] },
        { key: 'qwen3-8b', max_context_length: 40960, loaded_instances: [{ id: 'qwen3-8b', config: { context_length: 4096 } }] },
      ] },
    });
    await expect(readOtherServerContext('http://127.0.0.1:1234/v1', 'qwen3-8b', fetchImpl)).resolves.toBe(4096);
  });

  it('reads vLLM from max_model_len in /v1/models', async () => {
    const fetchImpl = fakeServer({ '/v1/models': { object: 'list', data: [{ id: 'Qwen/Qwen3-8B', object: 'model', max_model_len: 32768 }] } });
    await expect(probeLoadedContext('http://127.0.0.1:8000/v1', 'Qwen/Qwen3-8B', fetchImpl)).resolves.toBe(32768);
  });

  it('says nothing when no server gives a number', async () => {
    const fetchImpl = fakeServer({ '/v1/models': { object: 'list', data: [{ id: 'm' }] } });
    await expect(probeLoadedContext('http://127.0.0.1:9000/v1', 'm', fetchImpl)).resolves.toBe('unsupported');
  });
});
