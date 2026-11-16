/** Supported native Ollama operations, using only a labelled in-memory HTTP fixture. */
import { describe, expect, it } from 'vitest';
import { createWindowVariant, WINDOW_VARIANT_LIMIT, WINDOW_VARIANT_UNVERIFIED } from '../../src/main/llm/localContext';
import { controlLocalModel, localModelStatus } from '../../src/main/llm/localModels';
import { compactToolNames } from '../../src/main/agent/turn';

const base = 'http://127.0.0.1:29444/v1';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function fixture(options: { maximum?: number; actual?: number; ignoreAction?: boolean; ignoreStyle?: boolean } = {}) {
  const calls: Array<{ route: string; body: Record<string, any> }> = [];
  let loaded = [{ name: 'fixture:latest', size: 8_000_000_000, size_vram: 7_000_000_000, context_length: 8192 }];
  let parameters: Record<string, number> = {};
  const fetchImpl = (async (url, init) => {
    const route = new URL(String(url)).pathname;
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, any>;
    calls.push({ route, body });
    if (route === '/api/ps') return json({ models: loaded });
    if (route === '/api/show') return json({ model_info: { 'fixture.context_length': options.maximum ?? 65_536 },
      parameters: options.ignoreStyle ? '' : Object.entries(parameters).map(([key, value]) => `${key} ${value}`).join('\n') });
    if (route === '/api/create') { parameters = body.parameters; return json({ status: 'success' }); }
    if (route === '/api/generate') {
      if (!options.ignoreAction) {
        const name = body.model.includes(':') ? body.model : `${body.model}:latest`;
        loaded = loaded.filter(model => model.name !== name);
        if (body.keep_alive !== 0) loaded.push({ name, size: 8_000_000_000, size_vram: 7_000_000_000, context_length: options.actual ?? parameters.num_ctx ?? 8192 });
      }
      return json({ done: true });
    }
    return json({}, 404);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe('automatic context and explained model presets', () => {
  it('scales to measured request, checks native model cap, applies style and verifies loaded window', async () => {
    const f = fixture();
    expect(await createWindowVariant(base, 'fixture:latest', 0, f.fetchImpl, 1000, 20_000, 'focused')).toEqual({
      ok: true, model: 'fixture:latest-ctx32k-focused', requestedTokens: 32768, contextTokens: 32768,
    });
    expect(f.calls.find(call => call.route === '/api/create')?.body).toMatchObject({ from: 'fixture:latest', parameters: { num_ctx: 32768, temperature: 0.2, top_p: 0.9 } });
    expect(f.calls.filter(call => call.route === '/api/generate').every(call => call.body.prompt === '')).toBe(true);
  });

  it('does not change a model if the measured request or selected mode exceeds its limit', async () => {
    const f = fixture({ maximum: 8192 });
    expect(await createWindowVariant(base, 'fixture', 32768, f.fetchImpl)).toEqual({ ok: false, error: WINDOW_VARIANT_LIMIT });
    expect(await createWindowVariant(base, 'fixture', 0, f.fetchImpl, 1000, 8000)).toEqual({ ok: false, error: WINDOW_VARIANT_LIMIT });
    expect(f.calls.every(call => call.route === '/api/show')).toBe(true);
  });

  it('rejects a successful HTTP response if the actual window or generation parameters were not applied', async () => {
    expect(await createWindowVariant(base, 'fixture', 16384, fixture({ actual: 8192 }).fetchImpl)).toEqual({ ok: false, error: WINDOW_VARIANT_UNVERIFIED });
    const f = fixture({ ignoreStyle: true });
    expect(await createWindowVariant(base, 'fixture', 16384, f.fetchImpl, 1000, 0, 'creative')).toEqual({ ok: false, error: WINDOW_VARIANT_UNVERIFIED });
    expect(f.calls.some(call => call.route === '/api/generate')).toBe(false);
  });

  it('does not create or load on an arbitrary compatible server', async () => {
    const asked: string[] = [];
    const fake = (async url => { asked.push(new URL(String(url)).pathname); return json({ status: 'ok' }); }) as typeof fetch;
    expect((await createWindowVariant(base, 'fixture', 0, fake)).ok).toBe(false);
    expect(asked).toEqual(['/api/show']);
    const count = asked.length;
    expect((await createWindowVariant(base, 'fixture:cloud', 0, fake)).ok).toBe(false);
    expect(asked).toHaveLength(count);
  });

  it('keeps requested blueprint and resource tools without granting build permissions to Ask', () => {
    const ask = compactToolNames(false, 'Изучи шаблон и субграф: assessResources, inspectBlueprint');
    expect(ask).toEqual(expect.arrayContaining(['assessResources', 'searchBlueprints', 'inspectBlueprint', 'proposeSubgraph']));
    expect(ask).not.toContain('insertBlueprint');
    expect(ask).not.toContain('createSubgraph');
    expect(compactToolNames(true, 'Собери шаблон и субграф')).toEqual(expect.arrayContaining(['insertBlueprint', 'createSubgraph']));
  });
});

describe('model monitoring and lifecycle', () => {
  it('status is read-only and returns real memory and context; unloading and loading require matching readback', async () => {
    const f = fixture();
    expect(await localModelStatus(base, f.fetchImpl)).toMatchObject({ ok: true, models: [{ name: 'fixture:latest', bytes: 8_000_000_000, vramBytes: 7_000_000_000, contextTokens: 8192 }] });
    expect(f.calls.map(call => call.route)).toEqual(['/api/ps']);
    expect(await controlLocalModel(base, 'fixture', 'unload', f.fetchImpl)).toMatchObject({ ok: true, models: [] });
    expect(await controlLocalModel(base, 'fixture', 'load', f.fetchImpl)).toMatchObject({ ok: true, models: [{ name: 'fixture:latest' }] });
    expect(f.calls.filter(call => call.route === '/api/generate').map(call => call.body.keep_alive)).toEqual([0, '10m']);
  });

  it('reports failure when a server acknowledges unload without unloading, and refuses a non-native endpoint', async () => {
    expect((await controlLocalModel(base, 'fixture', 'unload', fixture({ ignoreAction: true }).fetchImpl)).ok).toBe(false);
    const asked: string[] = [];
    const fake = (async url => { asked.push(String(url)); return json({ data: [] }); }) as typeof fetch;
    expect((await controlLocalModel(base, 'fixture', 'unload', fake)).ok).toBe(false);
    expect(asked).toEqual(['http://127.0.0.1:29444/api/ps']);
  });
});
