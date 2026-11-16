/** Reads local model residency and performs bounded, verified load and unload requests. */
import { getJson, ollamaOrigin } from './modelList';
import type { LocalModelAction, LocalModelStatus } from '../../shared/contracts/localModels';

const UNAVAILABLE = 'Ollama model management is unavailable at this address.';
const UNCONFIRMED = 'Ollama did not confirm the model action.';
const size = (value: unknown): number | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
const tag = (name: string) => name.split('/').pop()?.includes(':') ? name.trim() : `${name.trim()}:latest`;

/** A bounded read of the actual loaded models. An empty list is a valid idle server. */
export async function localModelStatus(base: string, fetchImpl: typeof fetch): Promise<LocalModelStatus> {
  const origin = ollamaOrigin(base);
  if (!origin) return { ok: false, error: UNAVAILABLE };
  const result = await getJson(fetchImpl, `${origin}/api/ps`, {}, 5000);
  const models: unknown = result.ok ? (result.json as { models?: unknown })?.models : null;
  if (!Array.isArray(models)) return { ok: false, error: UNAVAILABLE };
  return { ok: true, at: Date.now(), models: models.slice(0, 100).flatMap(item => {
    if (!item || typeof item !== 'object' || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 300) return [];
    return [{ name: item.name, bytes: size(item.size), vramBytes: size(item.size_vram), contextTokens: size(item.context_length) }];
  }) };
}

/** Explicit load/unload; require a native status reply first, and verify the final state instead of trusting HTTP200. */
export async function controlLocalModel(base: string, model: string, action: LocalModelAction, fetchImpl: typeof fetch, ensureUnload = false): Promise<LocalModelStatus> {
  const origin = ollamaOrigin(base);
  if (!origin || !model.trim() || model.length > 300 || !['load', 'unload'].includes(action)) return { ok: false, error: UNAVAILABLE };
  const before = await localModelStatus(base, fetchImpl);
  if (!before.ok) return before;
  if (action === 'unload' && !ensureUnload && !before.models.some(item => tag(item.name) === tag(model))) return before;
  try {
    const response = await fetchImpl(`${origin}/api/generate`, { method: 'POST', redirect: 'error',
      headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({ model, prompt: '', stream: false, keep_alive: action === 'unload' ? 0 : '10m' }) });
    const body: unknown = await response.json();
    if (!response.ok || !body || typeof body !== 'object' || 'error' in body) return { ok: false, error: UNCONFIRMED };
    const after = await localModelStatus(base, fetchImpl);
    if (!after.ok) return after;
    const loaded = after.models.some(item => tag(item.name) === tag(model));
    return loaded === (action === 'load') ? after : { ok: false, error: UNCONFIRMED };
  } catch { return { ok: false, error: UNCONFIRMED }; }
}
