import { getJson, ollamaOrigin } from './modelList';

/**
 * How much text a model on the person's own server can hold at once.
 *
 * A local server loads a model with a fixed context window, and the request cannot change it: the
 * OpenAI-compatible endpoint has no field for it. Ollama decides the window on the server (4k tokens under
 * 24 GiB of VRAM, 32k up to 48 GiB, or whatever OLLAMA_CONTEXT_LENGTH or the Modelfile says) and silently drops
 * what does not fit. The helper's request (instructions, the graph, tool descriptions) is several thousand
 * tokens, so a small window means the model answers without having read the question.
 *
 * Ollama's `GET /api/ps` lists the models loaded right now with the window each was loaded with. That is the
 * only place the real number shows, and only while the model is loaded, so the reader polls while a request is
 * in flight (a server set to unload after every answer shows the model only then).
 */

type Fetch = typeof fetch;

export { COMPACT_WINDOW, MIN_WORKING_WINDOW, RECOMMENDED_WINDOW } from '../../shared/agent/contextWindow';

/** JSON carries more characters per token than prose; this leans to the safe (larger) side for request size. */
const CHARS_PER_TOKEN_JSON = 3.3;

/** Tokens a request body of this many characters needs, roughly. */
export function estimateRequestTokens(bodyChars: number): number {
  return Math.ceil(Math.max(0, bodyChars) / CHARS_PER_TOKEN_JSON);
}

function tagged(name: string): string {
  const trimmed = name.trim();
  // "llama3.2" and "llama3.2:latest" are the same model to Ollama.
  const last = trimmed.split('/').pop() ?? trimmed;
  return last.includes(':') ? trimmed : `${trimmed}:latest`;
}

/** The context window `model` is loaded with, from an `/api/ps` answer, or null when it is not listed. */
export function parseOllamaPs(json: unknown, model: string): number | null {
  const rows = (json as { models?: unknown } | null)?.models;
  if (!Array.isArray(rows)) return null;
  const wanted = tagged(model);
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as { name?: unknown; model?: unknown; context_length?: unknown };
    const names = [record.name, record.model].filter((value): value is string => typeof value === 'string').map(tagged);
    if (!names.includes(wanted)) continue;
    const window = record.context_length;
    if (typeof window === 'number' && Number.isFinite(window) && window >= 256 && window <= 16_000_000) return Math.floor(window);
  }
  return null;
}

/** One read of the loaded window, or null (not Ollama, not loaded, no answer in time). Never throws. */
export async function readLoadedContext(base: string, model: string, fetchImpl: Fetch, timeoutMs = 1500): Promise<number | null> {
  const origin = ollamaOrigin(base.trim().replace(/\/+$/, ''));
  if (!origin || model.trim() === '') return null;
  try {
    const read = await getJson(fetchImpl, `${origin}/api/ps`, {}, timeoutMs);
    return read.ok ? parseOllamaPs(read.json, model) : null;
  } catch {
    return null;
  }
}

/**
 * Watches for the model to show up as loaded while a request runs: asks every `everyMs` until the window is
 * seen, the signal aborts or `maxMs` passed. Resolves to the window or null. Never throws.
 */
export function watchLoadedContext(
  base: string,
  model: string,
  fetchImpl: Fetch,
  options: { signal?: AbortSignal; everyMs?: number; maxMs?: number } = {},
): Promise<number | null> {
  const everyMs = options.everyMs ?? 500;
  const deadline = Date.now() + (options.maxMs ?? 120_000);
  if (!ollamaOrigin(base.trim().replace(/\/+$/, ''))) return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    let timer: NodeJS.Timeout | null = null;
    const finish = (value: number | null) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      resolve(value);
    };
    const onAbort = () => finish(null);
    if (options.signal?.aborted) {
      resolve(null);
      return;
    }
    options.signal?.addEventListener('abort', onAbort);
    const tick = async () => {
      if (done) return;
      const window = await readLoadedContext(base, model, fetchImpl);
      if (done) return;
      if (window !== null) {
        finish(window);
        return;
      }
      if (Date.now() >= deadline) {
        finish(null);
        return;
      }
      timer = setTimeout(() => void tick(), everyMs);
      timer.unref?.();
    };
    void tick();
  });
}

/** Room a turn needs beyond its request: a tool result or two and the answer. */
const WORKING_ROOM = 2_500;

export interface ContextFit {
  /** The window the model is loaded with on the server. */
  window: number;
  /**
   * Tokens the helper's request needs: the larger of the estimate from its size and what the server counted.
   * When the server stopped at the window's edge the real need is unknown and this is not above the window.
   */
  needed: number;
  /** 'cut': the request does not fit and the server dropped part of it. 'tight': it fits with little room left. */
  state: 'ok' | 'tight' | 'cut';
}

/**
 * Whether a request fits the loaded window. `counted` is what the server said it read (its prompt token count):
 * a count at the very edge of the window means it stopped there. `bodyChars` 0 judges by the count alone.
 */
export function contextFit(window: number, bodyChars: number, counted: number | null): ContextFit {
  const estimated = estimateRequestTokens(bodyChars);
  const filled = counted !== null && counted >= window - 64;
  const needed = Math.max(estimated, counted ?? 0);
  if (estimated > window || filled) return { window, needed, state: 'cut' };
  // A turn needs room for tool results and the answer, and a build adds a few hundred tokens per step.
  if (needed > window * 0.8 || window - needed < WORKING_ROOM) return { window, needed, state: 'tight' };
  return { window, needed, state: 'ok' };
}
