import { isToolsUnsupportedError } from './providerErrors';

/**
 * Why a helper turn failed, as a small closed set the chat can say in one plain sentence with the next step.
 * The provider's own words never become the message: they go to the conversation log, and a short redacted copy
 * travels as `details` for a collapsed "what the server said".
 */
export const TURN_ERROR_KINDS = ['no-key', 'key', 'needs-key', 'model', 'rate', 'server', 'unreachable', 'unreadable', 'not-a-model', 'no-tools', 'storage', 'unknown'] as const;
export type TurnErrorKind = typeof TURN_ERROR_KINDS[number];

export interface TurnError {
  kind: TurnErrorKind;
  /** For 'rate': how long the server asked to wait, when it said so. */
  retryAfterSeconds?: number;
  /** The provider's words, redacted and short. Never shown as the message itself. */
  details: string;
}

/** Kinds whose next step is in Settings ▸ Assistant (the key, the address, the model). */
export const SETTINGS_KINDS: ReadonlySet<TurnErrorKind> = new Set(['no-key', 'key', 'needs-key', 'model', 'unreachable', 'not-a-model', 'no-tools']);

export const DETAILS_CAP = 300;

type ErrorLike = {
  name?: unknown;
  message?: unknown;
  statusCode?: unknown;
  status?: unknown;
  responseHeaders?: unknown;
  cause?: unknown;
  lastError?: unknown;
  code?: unknown;
};

function asRecord(value: unknown): ErrorLike | null {
  return value && typeof value === 'object' ? value as ErrorLike : null;
}

/** The error and what it wraps (a retry's last error, causes), outermost first, at most a few levels. */
function chain(error: unknown): ErrorLike[] {
  const out: ErrorLike[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 6; depth += 1) {
    const record = asRecord(current);
    if (!record || out.includes(record)) break;
    out.push(record);
    current = record.lastError ?? record.cause;
  }
  return out;
}

function messageOf(error: unknown): string {
  if (typeof error === 'string') return error;
  return chain(error).map((item) => (typeof item.message === 'string' ? item.message : '')).filter(Boolean).join(' | ');
}

function statusOf(items: ErrorLike[]): number | null {
  for (const item of items) {
    const status = typeof item.statusCode === 'number' ? item.statusCode : typeof item.status === 'number' ? item.status : null;
    if (status !== null && status >= 100 && status < 600) return status;
  }
  return null;
}

function header(headers: unknown, name: string): string | null {
  if (!headers || typeof headers !== 'object') return null;
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (key.toLowerCase() === name && typeof value === 'string') return value;
  }
  return null;
}

/** Seconds from Retry-After (seconds or an HTTP date) or retry-after-ms; null when absent or unreasonable. */
export function retryAfterSeconds(headers: unknown, now = Date.now()): number | null {
  const ms = header(headers, 'retry-after-ms');
  if (ms !== null && Number.isFinite(Number(ms))) return clampSeconds(Number(ms) / 1000);
  const value = header(headers, 'retry-after');
  if (value === null) return null;
  if (/^\s*\d+(?:\.\d+)?\s*$/.test(value)) return clampSeconds(Number(value));
  const date = Date.parse(value);
  return Number.isFinite(date) ? clampSeconds((date - now) / 1000) : null;
}

function clampSeconds(seconds: number): number | null {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(3600, Math.max(1, Math.ceil(seconds)));
}

/** "try again in 20s" inside the server's words, when there was no header. */
function secondsInText(text: string): number | null {
  const found = /(?:try again|retry) in (\d+(?:\.\d+)?)\s*(ms|s|sec|seconds?)\b/i.exec(text);
  if (!found) return null;
  const value = Number(found[1]);
  return clampSeconds(found[2].toLowerCase() === 'ms' ? value / 1000 : value);
}

/** The provider's words for a model it does not have (any more). */
const MODEL_GONE = /model_not_found|model[ _-]?not[ _-]?found|no such model|unknown model|model .{1,120} (?:does not exist|not found|is not found|has been (?:deprecated|decommissioned|retired|shut down))|(?:deprecated|decommissioned|retired) model|is not supported for generateContent/i;

const UNREACHABLE = /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|EHOSTUNREACH|ENETUNREACH|other side closed|socket hang up|fetch failed|Cannot connect to API|network error|timed? ?out|UND_ERR_/i;
const UNREADABLE_NAMES = /JSONParseError|TypeValidationError|InvalidResponseDataError|NoContentGeneratedError|InvalidStreamPart/i;
const UNREADABLE_TEXT = /JSON parsing failed|Unexpected token|is not valid JSON|Expected property name|Invalid JSON response/i;

/**
 * Sorts a failed turn into a kind. `redact` hides secrets in the details (the app's redaction). A message alone
 * (a string) is sorted by its words.
 */
export function classifyTurnError(error: unknown, redact: (text: string) => string = (text) => text, now = Date.now()): TurnError {
  const items = typeof error === 'string' ? [] : chain(error);
  const text = messageOf(error);
  const details = redact(text.length > DETAILS_CAP ? `${text.slice(0, DETAILS_CAP)}…` : text);
  const known = items.map((item) => (typeof item.name === 'string' ? item.name : '')).join(' ');
  const explicit = items.map((item) => (typeof (item as { kind?: unknown }).kind === 'string' ? (item as { kind: string }).kind : '')).find((kind) => (TURN_ERROR_KINDS as readonly string[]).includes(kind));
  if (explicit) return { kind: explicit as TurnErrorKind, details };
  if (isToolsUnsupportedError(text)) return { kind: 'no-tools', details };
  const status = statusOf(items) ?? (/\b(401|403|429|5\d\d)\b/.exec(text)?.[1] ? Number(/\b(401|403|429|5\d\d)\b/.exec(text)![1]) : null);
  // No key at all: nothing was sent anywhere, so the sentence must not blame a server.
  if (status === null && /has no key|no api key|api key is missing/i.test(text)) return { kind: 'no-key', details };
  // A retired or mistyped model: the provider answers 404 (or 400) and names the model.
  if (MODEL_GONE.test(text) || (status === 404 && /\bmodel\b/i.test(text))) return { kind: 'model', details };
  if (status === 401 || status === 403 || /invalid[_ ]api[_ ]key|incorrect api key|unauthori[sz]ed|authentication|has no key|no api key|api key is missing/i.test(text)) return { kind: 'key', details };
  if (status === 429 || /rate limit|too many requests/i.test(text)) {
    const headers = items.map((item) => item.responseHeaders).find(Boolean);
    const seconds = retryAfterSeconds(headers, now) ?? secondsInText(text);
    return seconds !== null ? { kind: 'rate', retryAfterSeconds: seconds, details } : { kind: 'rate', details };
  }
  if (status !== null && status >= 500) return { kind: 'server', details };
  if (UNREADABLE_NAMES.test(known) || UNREADABLE_TEXT.test(text)) return { kind: 'unreadable', details };
  if (UNREACHABLE.test(text) || items.some((item) => typeof item.code === 'string' && UNREACHABLE.test(item.code))) return { kind: 'unreachable', details };
  return { kind: 'unknown', details };
}

/** Reads a TurnError from an error chunk's content without trusting its shape; null when it carries none. */
export function parseTurnError(input: unknown): TurnError | null {
  const record = asRecord(input) as Record<string, unknown> | null;
  if (!record) return null;
  const nested = asRecord(record.error) as Record<string, unknown> | null;
  const source = nested && typeof nested.kind === 'string' ? nested : record;
  const kind = source.kind;
  if (typeof kind !== 'string' || !(TURN_ERROR_KINDS as readonly string[]).includes(kind)) return null;
  const seconds = Number(source.retryAfterSeconds);
  const details = typeof source.details === 'string' ? source.details.slice(0, DETAILS_CAP + 1) : typeof source.message === 'string' ? source.message.slice(0, DETAILS_CAP + 1) : '';
  return {
    kind: kind as TurnErrorKind,
    ...(Number.isFinite(seconds) && seconds > 0 ? { retryAfterSeconds: Math.round(seconds) } : {}),
    details,
  };
}
