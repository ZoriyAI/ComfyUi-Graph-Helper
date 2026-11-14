import { getJson, MODEL_LIST_REFUSED, MODEL_LIST_SHAPE, ollamaOrigin } from './modelList';

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

/** llama.cpp's server: `GET /props` → `default_generation_settings.n_ctx` (tools/server/README.md). */
export function parseLlamaCppProps(json: unknown): number | null {
  const settings = (json as { default_generation_settings?: { n_ctx?: unknown } } | null)?.default_generation_settings;
  return sane(settings?.n_ctx);
}

/**
 * LM Studio's REST API: `GET /api/v1/models` → `models[]` with `key` and `loaded_instances[].config.context_length`
 * (lmstudio.ai/docs/developer/rest/list). Only a loaded instance says the window it was loaded with.
 */
export function parseLmStudioModels(json: unknown, model: string): number | null {
  const rows = (json as { models?: unknown } | null)?.models;
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as { key?: unknown; loaded_instances?: unknown };
    const instances = Array.isArray(record.loaded_instances) ? record.loaded_instances as Array<{ id?: unknown; config?: { context_length?: unknown } }> : [];
    const matches = record.key === model || instances.some((instance) => instance?.id === model);
    if (!matches) continue;
    for (const instance of instances) {
      const window = sane(instance?.config?.context_length);
      if (window !== null) return window;
    }
  }
  return null;
}

/** vLLM: `GET /v1/models` → `data[]` with `id` and `max_model_len` (ModelCard in its OpenAI server). */
export function parseVllmModels(json: unknown, model: string): number | null {
  const rows = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(rows)) return null;
  const row = rows.find((item) => item && typeof item === 'object' && ((item as { id?: unknown }).id === model || (item as { root?: unknown }).root === model)) as { max_model_len?: unknown } | undefined;
  return sane(row?.max_model_len);
}

function sane(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 256 && value <= 16_000_000 ? Math.floor(value) : null;
}

/**
 * When the server is not Ollama: the window as llama.cpp, LM Studio or vLLM say it, read-only GET requests to the
 * address the person entered, with a short timeout each. Null when none of them answers with a number.
 */
export async function readOtherServerContext(base: string, model: string, fetchImpl: Fetch, timeoutMs = 1500): Promise<number | null> {
  const trimmed = base.trim().replace(/\/+$/, '');
  const origin = ollamaOrigin(trimmed);
  if (!origin || model.trim() === '') return null;
  const reads: Array<[string, (json: unknown) => number | null]> = [
    [`${origin}/props`, parseLlamaCppProps],
    [`${origin}/api/v1/models`, (json) => parseLmStudioModels(json, model)],
    [`${origin}/v1/models`, (json) => parseVllmModels(json, model)],
  ];
  for (const [url, parse] of reads) {
    try {
      const read = await getJson(fetchImpl, url, {}, timeoutMs);
      if (!read.ok) continue;
      const window = parse(read.json);
      if (window !== null) return window;
    } catch {
      // The next kind of server is asked.
    }
  }
  return null;
}

/**
 * Servers that answered the question with "no such thing" (LM Studio, vLLM, llama.cpp: an HTTP error or another
 * shape). They are not asked again in this run: polling them would only fill their own log with errors.
 */
const notOllama = new Set<string>();
/** Origins (not Ollama) where llama.cpp, LM Studio and vLLM reads gave no number: not asked again in this run. */
const noOtherWindow = new Set<string>();

/** The other kinds of server, asked once per origin and model until one gives a number. */
async function otherOnce(origin: string, base: string, model: string, fetchImpl: Fetch, timeoutMs: number): Promise<number | 'unsupported'> {
  const key = `${origin}|${model}`;
  if (noOtherWindow.has(key)) return 'unsupported';
  const window = await readOtherServerContext(base, model, fetchImpl, timeoutMs);
  if (window === null) noOtherWindow.add(key);
  return window ?? 'unsupported';
}

/** For tests: forget which servers were found not to answer. */
export function resetLocalContextMemory(): void {
  notOllama.clear();
  noOtherWindow.clear();
}

/**
 * One read of the loaded window: the number, null when the model is not loaded right now (or the server did not
 * answer in time), or 'unsupported' when the server is not one that lists its loaded models. Never throws.
 */
export async function probeLoadedContext(base: string, model: string, fetchImpl: Fetch, timeoutMs = 1500): Promise<number | null | 'unsupported'> {
  const origin = ollamaOrigin(base.trim().replace(/\/+$/, ''));
  if (!origin || model.trim() === '') return 'unsupported';
  if (notOllama.has(origin)) return await otherOnce(origin, base, model, fetchImpl, timeoutMs);
  try {
    const read = await getJson(fetchImpl, `${origin}/api/ps`, {}, timeoutMs);
    if (!read.ok) {
      // "No such address" means another kind of server. No answer, or a server error, may be a slow moment
      // (a model being loaded): those are asked again.
      if (/HTTP (404|405|410|501)\b/.test(read.error) || read.error === MODEL_LIST_SHAPE || read.error === MODEL_LIST_REFUSED) {
        notOllama.add(origin);
        return await otherOnce(origin, base, model, fetchImpl, timeoutMs);
      }
      return null;
    }
    if (!Array.isArray((read.json as { models?: unknown } | null)?.models)) {
      notOllama.add(origin);
      return await otherOnce(origin, base, model, fetchImpl, timeoutMs);
    }
    return parseOllamaPs(read.json, model);
  } catch {
    return null;
  }
}

/** One read of the loaded window, or null (not Ollama, not loaded, no answer in time). Never throws. */
export async function readLoadedContext(base: string, model: string, fetchImpl: Fetch, timeoutMs = 1500): Promise<number | null> {
  const read = await probeLoadedContext(base, model, fetchImpl, timeoutMs);
  return typeof read === 'number' ? read : null;
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
      const window = await probeLoadedContext(base, model, fetchImpl);
      if (done) return;
      if (window !== null) {
        // A number ends the watch; so does a server that does not list its loaded models.
        finish(typeof window === 'number' ? window : null);
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
