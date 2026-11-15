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

export type CloudListProvider = 'openai' | 'anthropic' | 'google' | 'compatible';

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
/** A window size a list gave, when it is a sane number of tokens. */
function windowOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 256 && value <= 16_000_000 ? Math.floor(value) : undefined;
}

export function parseAnthropicList(json: unknown): ModelChoice[] | null {
  const data = record(json)?.data;
  if (!Array.isArray(data)) return null;
  const out: ModelChoice[] = [];
  for (const item of data) {
    const row = record(item);
    const id = usableId(row?.id);
    if (!id) continue;
    const label = text(row?.display_name).slice(0, 200);
    // The Models API says each model's input window (max_input_tokens) and whether it takes tools.
    const window = windowOf(row?.max_input_tokens);
    out.push({ id, ...(label && label !== id ? { label } : {}), ...(window ? { contextLength: window } : {}) });
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
    const window = windowOf(row?.inputTokenLimit);
    out.push({ id, ...(label && label !== id ? { label } : {}), ...(window ? { contextLength: window } : {}) });
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

/** Models that cannot chat (embeddings, speech, image, rerankers): never offered as the assistant's model. */
const NOT_CHAT_ID = /(^|[/:_.-])(text-)?embed(ding)?s?([/:_.-]|$)|nomic-embed|(^|[/_-])bge-|(^|[/_-])e5-|mxbai-embed|all-minilm|snowflake-arctic-embed|rerank|whisper|(^|[/_-])tts([/_-]|$)|dall-e|stable-diffusion|flux/i;

export function isLocalChatModel(id: string): boolean {
  return !NOT_CHAT_ID.test(id);
}

/** LM Studio's REST list (`GET /api/v0/models`): `{data:[{id, type:"llm"|"vlm"|"embeddings", ...}]}`. Ids that are not chat models. */
export function lmStudioNonChat(json: unknown): Set<string> {
  const out = new Set<string>();
  const data = record(json)?.data;
  if (!Array.isArray(data)) return out;
  for (const item of data) {
    const row = record(item);
    const id = text(row?.id);
    const type = text(row?.type);
    if (id && type && type !== 'llm' && type !== 'vlm') out.add(id);
  }
  return out;
}

/** What Ollama's `POST /api/show` says about one model: capabilities and the window the model was trained for. */
export interface OllamaShowFacts {
  tools?: boolean;
  vision?: boolean;
  thinking?: boolean;
  /** The model's own maximum window (model_info "<arch>.context_length"); not the window the server loads it with. */
  contextLength?: number;
  /** Whether the model can chat at all ("completion"); embeddings answer false. */
  chat?: boolean;
}

export function parseOllamaShow(json: unknown): OllamaShowFacts {
  const row = record(json);
  const facts: OllamaShowFacts = {};
  if (Array.isArray(row?.capabilities)) {
    const caps = new Set(row.capabilities.filter((cap): cap is string => typeof cap === 'string'));
    facts.tools = caps.has('tools');
    facts.vision = caps.has('vision');
    facts.thinking = caps.has('thinking');
    facts.chat = caps.has('completion');
  }
  const info = record(row?.model_info);
  if (info) {
    for (const [key, value] of Object.entries(info)) {
      if (key.endsWith('.context_length') && typeof value === 'number' && Number.isFinite(value) && value >= 256) {
        facts.contextLength = Math.floor(value);
        break;
      }
    }
  }
  return facts;
}

/** At most this many models are asked about one by one; a server with more lists the rest without capabilities. */
const SHOW_LIMIT = 40;

async function postJson(fetchImpl: Fetch, url: string, body: unknown, headers: Record<string, string>, timeoutMs: number): Promise<JsonRead> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    const response = await fetchImpl(url, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), redirect: 'error', signal: controller.signal });
    if (!response.ok) return { ok: false, error: modelListHttpError(response.status) };
    const text = await response.text();
    if (text.length > MAX_BODY_CHARS) return { ok: false, error: MODEL_LIST_SHAPE };
    return { ok: true, json: JSON.parse(text) };
  } catch {
    return { ok: false, error: MODEL_LIST_UNREAD };
  } finally {
    clearTimeout(timer);
  }
}

/** Ollama's facts for one model, or null when the server is not Ollama or does not say. */
export async function readOllamaShow(origin: string, model: string, fetchImpl: Fetch, headers: Record<string, string> = {}, timeoutMs = 4000): Promise<OllamaShowFacts | null> {
  const read = await postJson(fetchImpl, `${origin}/api/show`, { model }, headers, timeoutMs);
  return read.ok ? parseOllamaShow(read.json) : null;
}

/** Said when a server of the person's own refused the list for want of a key. */
export const MODEL_LIST_NEEDS_KEY = 'The server asks for a key.';

/**
 * A local OpenAI-compatible server: `GET {base}/models`. When that fails and the base looks like Ollama, its own
 * `GET {origin}/api/tags`. When both answer, the tags add parameter size and family to the list, and Ollama's
 * `/api/show` adds what each model can do (tools, vision, thinking) and its own maximum window. Models that cannot
 * chat (embeddings and the like) are left out. `key`: the key pasted for this server's address, for a server that
 * asks for one; nothing is sent otherwise.
 */
export async function listLocalModels(base: string, fetchImpl: Fetch, timeoutMs = MODEL_LIST_TIMEOUT_MS, key: string | null = null): Promise<ModelListResult> {
  const root = trimSlash(base.trim());
  const origin = ollamaOrigin(root);
  const auth: Record<string, string> = key ? { authorization: `Bearer ${key}` } : {};
  const tagsRead = origin ? getJson(fetchImpl, `${origin}/api/tags`, auth, timeoutMs) : Promise.resolve(null);
  // LM Studio says which of its models are embeddings; any other server answers 404 here, which changes nothing.
  const typesRead = origin ? getJson(fetchImpl, `${origin}/api/v0/models`, auth, Math.min(timeoutMs, 3000)) : Promise.resolve(null);
  const [listed, tags, types] = await Promise.all([getJson(fetchImpl, `${root}/models`, auth, timeoutMs), tagsRead, typesRead]);
  const tagModels = tags && tags.ok ? parseOllamaTags(tags.json) : null;
  const nonChat = types && types.ok ? lmStudioNonChat(types.json) : new Set<string>();
  const source = new URL(root).origin;
  let models: ModelChoice[] | null = null;
  if (listed.ok) {
    const parsed = parseOpenAiList(listed.json);
    if (parsed) models = withDetails(parsed, tagModels);
  }
  if (!models && tagModels) models = tagModels;
  if (!models) {
    if (!listed.ok && listed.error === MODEL_LIST_REFUSED) return { ok: false, error: key ? MODEL_LIST_REFUSED : MODEL_LIST_NEEDS_KEY };
    return { ok: false, error: listed.ok ? MODEL_LIST_SHAPE : listed.error };
  }
  models = models.filter((model) => isLocalChatModel(model.id) && !nonChat.has(model.id));
  if (origin && tagModels) models = await withOllamaFacts(models, origin, fetchImpl, auth);
  return { ok: true, models, source };
}

/** Ollama only: what each listed model can do, asked in parallel; a model Ollama says cannot chat is left out. */
async function withOllamaFacts(models: ModelChoice[], origin: string, fetchImpl: Fetch, headers: Record<string, string>): Promise<ModelChoice[]> {
  const asked = models.slice(0, SHOW_LIMIT);
  const facts = await Promise.all(asked.map((model) => readOllamaShow(origin, model.id, fetchImpl, headers).catch(() => null)));
  const out: ModelChoice[] = [];
  models.forEach((model, index) => {
    const fact = index < asked.length ? facts[index] : null;
    if (!fact) {
      out.push(model);
      return;
    }
    if (fact.chat === false) return;
    out.push({
      ...model,
      ...(fact.tools !== undefined ? { tools: fact.tools } : {}),
      ...(fact.vision !== undefined ? { vision: fact.vision } : {}),
      ...(fact.thinking !== undefined ? { thinking: fact.thinking } : {}),
      ...(fact.contextLength !== undefined ? { contextLength: fact.contextLength } : {}),
    });
  });
  // Models that call tools come first, those that cannot come last: the assistant needs tools.
  const rank = (model: ModelChoice) => (model.tools === true ? 0 : model.tools === false ? 2 : 1);
  return out.map((model, index) => ({ model, index })).sort((a, b) => rank(a.model) - rank(b.model) || a.index - b.index).map((item) => item.model);
}

/** The list request for one cloud provider: URL and the headers that carry the key. */
export function cloudListRequest(provider: CloudListProvider, base: string, key: string): { url: string; headers: Record<string, string> } {
  const root = trimSlash(base);
  if (provider === 'anthropic') return { url: `${root}/models?limit=1000`, headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } };
  if (provider === 'google') return { url: `${root}/models?pageSize=200`, headers: { 'x-goog-api-key': key } };
  return { url: `${root}/models`, headers: { authorization: `Bearer ${key}` } };
}

/** Cloud: the official or configured https base, with the key main holds. The caller checks https and the key. */
export async function listCloudModels(provider: CloudListProvider, base: string, key: string, fetchImpl: Fetch, timeoutMs = MODEL_LIST_TIMEOUT_MS, extraHeaders: Record<string, string> = {}): Promise<ModelListResult> {
  const request = cloudListRequest(provider, base, key);
  const read = await getJson(fetchImpl, request.url, { ...extraHeaders, ...request.headers }, timeoutMs);
  if (!read.ok) return read;
  const models = provider === 'anthropic'
    ? parseAnthropicList(read.json)
    : provider === 'google'
      ? parseGoogleList(read.json)
      : provider === 'compatible'
        // A gateway lists every kind of model; those that cannot chat are left out by their names.
        ? parseOpenAiList(read.json)?.filter((model) => isOpenAiChatModel(model.id) && isLocalChatModel(model.id)) ?? null
        : parseOpenAiList(read.json)?.filter((model) => isOpenAiChatModel(model.id)) ?? null;
  if (!models) return { ok: false, error: MODEL_LIST_SHAPE };
  return { ok: true, models, source: new URL(base).host };
}
