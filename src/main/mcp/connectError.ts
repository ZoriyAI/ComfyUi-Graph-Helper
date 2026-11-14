/**
 * Why a connection to an MCP address did not work, as one of the fixed sentences in client.ts. Used by Settings ▸
 * Connection "Check" (detect.ts) and by the sync, so both say the same thing. The only extra request ever made is
 * one GET of `/system_stats` on the same origin, to tell the person they typed ComfyUI's own address; it reads and
 * changes nothing, and no sign-in or client registration is ever started from here.
 */
import { CALL_TIMEOUT_MS, failure, isUnauthorized, MCP_IS_COMFYUI, MCP_NO_SERVER_AT_PATH, MCP_NOT_MCP, McpTimeoutError, mcpHostNotFound, mcpTooSlow, mcpUnreachableError } from './client';
import { McpRefusedError } from './readOnly';
import { McpPageError } from '../../shared/mcp/catalogSource';

/** The ComfyUI check waits at most this long: it is a hint, never the reason a check is slow. */
export const COMFY_PROBE_TIMEOUT_MS = 4_000;

const REFUSED_CODES = /^(ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|EPIPE|ETIMEDOUT|UND_ERR_SOCKET|UND_ERR_CONNECT_TIMEOUT)$/;
const NOT_FOUND_CODES = /^(ENOTFOUND|EAI_AGAIN|EAI_NONAME)$/;

/** Walks an error and its causes; returns the first value `pick` finds. */
function findInChain<T>(error: unknown, pick: (item: Record<string, unknown>) => T | undefined): T | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 8 && current && typeof current === 'object'; depth += 1) {
    const found = pick(current as Record<string, unknown>);
    if (found !== undefined) return found;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export type ConnectFailureKind = 'timeout' | 'hostNotFound' | 'refused' | 'httpStatus' | 'notMcp' | 'auth' | 'other';

/** What kind of failure this is, from the error alone (no network). Exported for tests. */
export function connectFailureKind(error: unknown): { kind: ConnectFailureKind; status?: number; timeoutMs?: number } {
  if (error instanceof McpTimeoutError) return { kind: 'timeout', timeoutMs: error.timeoutMs };
  if (isUnauthorized(error)) return { kind: 'auth' };
  const sdkTimeout = findInChain(error, (item) => (item.code === 'REQUEST_TIMEOUT' ? true : undefined));
  if (sdkTimeout) {
    const data = (error as { data?: { timeout?: unknown } }).data;
    return { kind: 'timeout', timeoutMs: typeof data?.timeout === 'number' ? data.timeout : CALL_TIMEOUT_MS };
  }
  const code = findInChain(error, (item) => (typeof item.code === 'string' && (NOT_FOUND_CODES.test(item.code) || REFUSED_CODES.test(item.code)) ? item.code : undefined));
  if (code) return { kind: NOT_FOUND_CODES.test(code) ? 'hostNotFound' : 'refused' };
  if (findInChain(error, (item) => (typeof item.message === 'string' && /fetch failed|socket hang up|other side closed/i.test(item.message) ? true : undefined))) {
    return { kind: 'refused' };
  }
  const status = findInChain(error, (item) => {
    const value = (item as { status?: unknown }).status;
    return typeof value === 'number' && value >= 300 && value < 600 ? value : undefined;
  });
  if (status !== undefined) return { kind: 'httpStatus', status };
  const unexpected = findInChain(error, (item) => (
    item.code === 'CLIENT_HTTP_UNEXPECTED_CONTENT' || item.name === 'SyntaxError' || item.name === 'ZodError' || item.name === '$ZodError'
      ? true : undefined
  ));
  if (unexpected) return { kind: 'notMcp' };
  return { kind: 'other' };
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Whether the origin of `url` answers like ComfyUI does: GET /system_stats with a `system` object. */
export async function isComfyUiOrigin(url: string, fetchImpl: typeof fetch): Promise<boolean> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COMFY_PROBE_TIMEOUT_MS);
  timer.unref?.();
  try {
    const response = await fetchImpl(`${origin}/system_stats`, { method: 'GET', redirect: 'manual', signal: controller.signal });
    if (response.status !== 200) return false;
    const text = await response.text();
    if (text.length > 1_000_000) return false;
    const body = JSON.parse(text) as unknown;
    return Boolean(body && typeof body === 'object' && (body as { system?: unknown }).system && typeof (body as { system?: unknown }).system === 'object');
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The fixed sentence for a connection that did not work. `authenticated`: whether credentials were sent (a 401 then
 * means "refused" rather than "needs sign-in").
 */
export async function explainConnectFailure(
  error: unknown,
  url: string,
  options: { authenticated?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<string> {
  if (error instanceof McpRefusedError || error instanceof McpPageError) return failure(error).error;
  const found = connectFailureKind(error);
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  switch (found.kind) {
    case 'timeout':
      return mcpTooSlow(Math.round((found.timeoutMs ?? CALL_TIMEOUT_MS) / 1000));
    case 'auth':
      return failure(error, { authenticated: options.authenticated }).error;
    case 'hostNotFound':
      return mcpHostNotFound(new URL(url).hostname);
    case 'refused':
      return mcpUnreachableError(hostOf(url));
    case 'httpStatus':
      if (await isComfyUiOrigin(url, fetchImpl)) return MCP_IS_COMFYUI;
      return found.status === 404 ? MCP_NO_SERVER_AT_PATH : MCP_NOT_MCP;
    case 'notMcp':
      return (await isComfyUiOrigin(url, fetchImpl)) ? MCP_IS_COMFYUI : MCP_NOT_MCP;
    default:
      return failure(error, { authenticated: options.authenticated }).error;
  }
}

/** The same without the ComfyUI probe, for places that cannot wait (a failure in the middle of a run). */
export function explainFailureNow(error: unknown, url: string): string {
  if (error instanceof McpRefusedError || error instanceof McpPageError) return failure(error).error;
  const found = connectFailureKind(error);
  if (found.kind === 'timeout') return mcpTooSlow(Math.round((found.timeoutMs ?? CALL_TIMEOUT_MS) / 1000));
  if (found.kind === 'hostNotFound') {
    try {
      return mcpHostNotFound(new URL(url).hostname);
    } catch {
      return failure(error).error;
    }
  }
  if (found.kind === 'refused') return mcpUnreachableError(hostOf(url));
  if (found.kind === 'httpStatus') return found.status === 404 ? MCP_NO_SERVER_AT_PATH : MCP_NOT_MCP;
  if (found.kind === 'notMcp') return MCP_NOT_MCP;
  return failure(error).error;
}
