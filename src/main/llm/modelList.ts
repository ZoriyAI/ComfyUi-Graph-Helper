import type { ModelChoice, ModelListResult } from '../../shared/contracts/pickers';

/**
 * Reads which models a provider or a local server offers, so Settings ▸ Assistant can offer a list to pick from.
 * Only GET requests. A cloud key is attached here in main and never comes back; every error is a fixed sentence.
 */

export const MODEL_LIST_TIMEOUT_MS = 8_000;
/** A list of a few hundred models is tens of KB; anything far bigger is not a model list. */
const MAX_BODY_CHARS = 8 * 1024 * 1024;

export const MODEL_LIST_UNREAD = 'The model list could not be read.';
export const MODEL_LIST_TIMEOUT = 'The server did not send the model list in time.';
export const MODEL_LIST_UNREACHABLE = 'The server did not answer.';
export const MODEL_LIST_REFUSED = 'The provider refused the key.';
export const MODEL_LIST_SHAPE = 'The server answered without a model list.';
export const modelListHttpError = (status: number) => `The server answered HTTP ${status} to the model list request.`;

export type CloudListProvider = 'openai' | 'anthropic' | 'google';

type Fetch = typeof fetch;
type JsonRead = { ok: true; json: unknown } | { ok: false; error: string };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Model ids are short printable strings; anything else from a server is dropped. */
function usableId(value: unknown): string {
  const id = text(value);
  return id.length > 0 && id.length <= 300 && !/[\u0000-\u001f]/.test(id) ? id : '';
}

function byId(models: ModelChoice[]): ModelChoice[] {
  const seen = new Map<string, ModelChoice>();
  for (const model of models) if (!seen.has(model.id)) seen.set(model.id, model);
  return [...seen.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** GET with a time limit and no redirects: a redirect could carry a key header to another host. */
export async function getJson(fetchImpl: Fetch, url: string, headers: Record<string, string>, timeoutMs: number): Promise<JsonRead> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    const response = await fetchImpl(url, { method: 'GET', headers: { accept: 'application/json', ...headers }, redirect: 'error', signal: controller.signal });
    if (response.status === 401 || response.status === 403) return { ok: false, error: MODEL_LIST_REFUSED };
    if (!response.ok) return { ok: false, error: modelListHttpError(response.status) };
    const body = await response.text();
    if (body.length > MAX_BODY_CHARS) return { ok: false, error: MODEL_LIST_SHAPE };
    try {
      return { ok: true, json: JSON.parse(body) };
    } catch {
      return { ok: false, error: MODEL_LIST_SHAPE };
    }
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, error: MODEL_LIST_TIMEOUT };
    // The transport error text could echo the request; only its kind is kept.
    const code = (error as { cause?: { code?: unknown } })?.cause?.code;
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EHOSTUNREACH' || code === 'ECONNRESET') return { ok: false, error: MODEL_LIST_UNREACHABLE };
    return { ok: false, error: MODEL_LIST_UNREAD };
  } finally {
    clearTimeout(timer);
  }
}

/** `{data:[{id}]}`: OpenAI and every OpenAI-compatible server (Ollama, LM Studio, vLLM). Null when not that shape. */
export function parseOpenAiList(json: unknown): ModelChoice[] | null {
  const data = record(json)?.data;
  if (!Array.isArray(data)) return null;
  return byId(data.map((item) => usableId(record(item)?.id)).filter(Boolean).map((id) => ({ id })));
}

/** Ids of OpenAI models that are not chat models; the assistant cannot use them. */
const OPENAI_NOT_CHAT = /(embedding|tts|whisper|dall-e|image|realtime|moderation|transcribe|audio)/i;

export function isOpenAiChatModel(id: string): boolean {
  return !OPENAI_NOT_CHAT.test(id);
}

/** Parameter size and family, e.g. "14.8B · qwen3". */
function ollamaDetail(details: unknown): string | undefined {
  const row = record(details);
  if (!row) return undefined;
  const parts = [text(row.parameter_size), text(row.family)].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/** Ollama's own `GET /api/tags`: `{models:[{name, details:{parameter_size, family}}]}`. */
export function parseOllamaTags(json: unknown): ModelChoice[] | null {
  const models = record(json)?.models;
  if (!Array.isArray(models)) return null;
  const out: ModelChoice[] = [];
  for (const item of models) {
    const row = record(item);
    const id = usableId(row?.name ?? row?.model);
    if (!id) continue;
    const detail = ollamaDetail(row?.details);
    out.push(detail ? { id, detail } : { id });
  }
  return byId(out);
}

/**
 * The MCP server's `ollama_models` payload: Ollama tags plus `capabilities` and `allowed`. A model the server
 * marks `allowed: false` is not offered.
 */
export function parseOllamaCatalog(json: unknown): ModelChoice[] {
  const models = record(json)?.models;
  if (!Array.isArray(models)) return [];
  const out: ModelChoice[] = [];
  for (const item of models) {
    const row = record(item);
    const id = usableId(row?.name ?? row?.model);
    if (!id || row?.allowed === false) continue;
    const choice: ModelChoice = { id };
    const detail = ollamaDetail(row?.details);
    if (detail) choice.detail = detail;
    if (Array.isArray(row?.capabilities)) {
      const caps = new Set(row.capabilities.filter((cap): cap is string => typeof cap === 'string'));
      choice.tools = caps.has('tools');
      choice.vision = caps.has('vision');
      choice.thinking = caps.has('thinking');
    }
    out.push(choice);
  }
  return byId(out);
}

/** Anthropic `GET /v1/models`: `{data:[{id, display_name}]}`. */
export function parseAnthropicList(json: unknown): ModelChoice[] | null {
  const data = record(json)?.data;
  if (!Array.isArray(data)) return null;
  const out: ModelChoice[] = [];
  for (const item of data) {
    const row = record(item);
    const id = usableId(row?.id);
    if (!id) continue;
    const label = text(row?.display_name).slice(0, 200);
    out.push(label && label !== id ? { id, label } : { id });
  }
  return byId(out);
}

/**
 * Google `GET /v1beta/models`: `{models:[{name:"models/gemini-…", displayName, supportedGenerationMethods}]}`.
 * Only models that answer generateContent can chat; the `models/` prefix is not part of the id the SDK takes.
 */
export function parseGoogleList(json: unknown): ModelChoice[] | null {
  const models = record(json)?.models;
  if (!Array.isArray(models)) return null;
  const out: ModelChoice[] = [];
  for (const item of models) {
    const row = record(item);
    const methods = Array.isArray(row?.supportedGenerationMethods) ? row.supportedGenerationMethods : [];
    if (!methods.includes('generateContent')) continue;
    const id = usableId(text(row?.name).replace(/^models\//, ''));
    if (!id) continue;
    const label = text(row?.displayName).slice(0, 200);
    out.push(label && label !== id ? { id, label } : { id });
  }
  return byId(out);
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * The server origin when the base URL has the shape Ollama's OpenAI-compatible endpoint has (the origin, or the
 * origin plus /v1), else null. Its own `/api/tags` is then worth asking.
 */
export function ollamaOrigin(base: string): string | null {
  try {
    const url = new URL(base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const path = trimSlash(url.pathname);
    return path === '' || path === '/v1' ? url.origin : null;
  } catch {
    return null;
  }
}

/** Joins details from /api/tags onto the ids /v1/models gave. */
function withDetails(models: ModelChoice[], tags: ModelChoice[] | null): ModelChoice[] {
  if (!tags || tags.length === 0) return models;
  const detail = new Map(tags.map((tag) => [tag.id, tag.detail]));
  return models.map((model) => (detail.get(model.id) ? { ...model, detail: detail.get(model.id) } : model));
}

/**
 * A local OpenAI-compatible server: `GET {base}/models`. When that fails and the base looks like Ollama, its own
 * `GET {origin}/api/tags`. When both answer, the tags add parameter size and family to the list.
 * The base URL is the person's own server (configured or found on this computer); no key is sent.
 */
export async function listLocalModels(base: string, fetchImpl: Fetch, timeoutMs = MODEL_LIST_TIMEOUT_MS): Promise<ModelListResult> {
  const root = trimSlash(base.trim());
  const origin = ollamaOrigin(root);
  const tagsRead = origin ? getJson(fetchImpl, `${origin}/api/tags`, {}, timeoutMs) : Promise.resolve(null);
  const [listed, tags] = await Promise.all([getJson(fetchImpl, `${root}/models`, {}, timeoutMs), tagsRead]);
  const tagModels = tags && tags.ok ? parseOllamaTags(tags.json) : null;
  const source = new URL(root).origin;
  if (listed.ok) {
    const models = parseOpenAiList(listed.json);
    if (models) return { ok: true, models: withDetails(models, tagModels), source };
  }
  if (tagModels) return { ok: true, models: tagModels, source };
  return { ok: false, error: listed.ok ? MODEL_LIST_SHAPE : listed.error };
}

/** The list request for one cloud provider: URL and the headers that carry the key. */
export function cloudListRequest(provider: CloudListProvider, base: string, key: string): { url: string; headers: Record<string, string> } {
  const root = trimSlash(base);
  if (provider === 'anthropic') return { url: `${root}/models?limit=1000`, headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } };
  if (provider === 'google') return { url: `${root}/models?pageSize=200`, headers: { 'x-goog-api-key': key } };
  return { url: `${root}/models`, headers: { authorization: `Bearer ${key}` } };
}

/** Cloud: the official or configured https base, with the key main holds. The caller checks https and the key. */
export async function listCloudModels(provider: CloudListProvider, base: string, key: string, fetchImpl: Fetch, timeoutMs = MODEL_LIST_TIMEOUT_MS): Promise<ModelListResult> {
  const request = cloudListRequest(provider, base, key);
  const read = await getJson(fetchImpl, request.url, request.headers, timeoutMs);
  if (!read.ok) return read;
  const models = provider === 'anthropic'
    ? parseAnthropicList(read.json)
    : provider === 'google'
      ? parseGoogleList(read.json)
      : parseOpenAiList(read.json)?.filter((model) => isOpenAiChatModel(model.id)) ?? null;
  if (!models) return { ok: false, error: MODEL_LIST_SHAPE };
  return { ok: true, models, source: new URL(base).host };
}
