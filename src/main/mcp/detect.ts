/**
 * What an MCP server wants from a connection, found out by trying rather than assumed, so Settings ▸ Connection can
 * offer the person the right choice: no sign-in, a pasted token, or the browser sign-in. Nothing is written anywhere.
 * Used by ipc.ts for the Settings > Connection "Check" button (detectMcpAuth).
 */

import { connectStreamableHttp, MCP_NEEDS_SIGN_IN, mcpClientInfo, mcpUrlError, type McpReadFailure, type McpSessionFactory } from './client';
import { explainConnectFailure } from './connectError';
import { withLoopbackScheme } from '../../shared/mcp/loopback';
import type { McpAuthProbe } from '../../shared/contracts/mcpAuth';
import { recognizeProfile, type McpProfile } from './profiles';

/** Protective: metadata documents are small; a server that answers slowly is reported as such, not waited for. */
export const METADATA_TIMEOUT_MS = 5_000;

export type { McpAuthProbe };

/**
 * Connects once without credentials. Accepted: 'none'. Refused with 401: when a token is held it is tried next
 * and the answer says whether the server accepted it; otherwise 'oauth' when the server publishes OAuth metadata
 * (RFC 9728 resource metadata named in WWW-Authenticate, or the well-known documents on its origin), else 'token'.
 * Unreachable servers and other failures come back as fixed sentences.
 */
export async function detectMcpAuth(
  url: string,
  options: { token?: string | null; factory?: McpSessionFactory; fetchImpl?: typeof fetch } = {},
): Promise<McpAuthProbe> {
  const typed = url.trim();
  const completed = withLoopbackScheme(typed);
  // `127.0.0.1:9000/mcp` becomes `http://127.0.0.1:9000/mcp`; the answer names the completed address for the form.
  const probe = await detectAt(completed, options);
  return completed !== typed ? { ...probe, completedUrl: completed } : probe;
}

/** detectMcpAuth on an address already completed with its scheme. */
async function detectAt(
  url: string,
  options: { token?: string | null; factory?: McpSessionFactory; fetchImpl?: typeof fetch },
): Promise<McpAuthProbe> {
  const factory = options.factory ?? connectStreamableHttp;
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  const urlError = mcpUrlError(url);
  if (urlError) return { ok: false, error: urlError };
  const attempt = async (token: string | null): Promise<{ tools: number; profile: McpProfile | null } | McpReadFailure> => {
    try {
      const session = await factory(url, token, null);
      try {
        const listed = await session.listTools();
        return { tools: listed.length, profile: recognizeProfile(listed) };
      } finally {
        await session.close().catch(() => undefined);
      }
    } catch (error) {
      return { ok: false, error: await explainConnectFailure(error, url, { authenticated: token != null, fetchImpl }) };
    }
  };
  const anonymous = await attempt(null);
  if ('tools' in anonymous) return { ok: true, mode: 'none', tools: anonymous.tools, profile: anonymous.profile };
  if (anonymous.error !== MCP_NEEDS_SIGN_IN) return anonymous;
  if (options.token) {
    const withToken = await attempt(options.token);
    if ('tools' in withToken) return { ok: true, mode: 'token', tokenAccepted: true, tools: withToken.tools, profile: withToken.profile };
    if (withToken.error === 'MCP server refused the token.') return { ok: true, mode: 'token', tokenAccepted: false };
    return withToken;
  }
  return { ok: true, mode: (await advertisesOAuth(url, fetchImpl)) ? 'oauth' : 'token' };
}

/** One request for a metadata document: no redirect followed, a short time limit, a body that is not JSON reads as null. */
async function fetchJson(fetchImpl: typeof fetch, target: string, init: RequestInit = {}): Promise<{ status: number; headers: Headers; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);
  timer.unref?.();
  try {
    const response = await fetchImpl(target, { ...init, signal: controller.signal, redirect: 'manual' });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, headers: response.headers, body };
  } finally {
    clearTimeout(timer);
  }
}

/** Protected-resource metadata (names authorization servers) or authorization-server metadata (names its endpoint). */
function isOAuthMetadata(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const record = body as Record<string, unknown>;
  return Array.isArray(record.authorization_servers) || typeof record.authorization_endpoint === 'string';
}

/**
 * Whether the server publishes OAuth metadata. A metadata address named by the server is followed only on the
 * server's own host (any port), so a 401 header cannot send the app to read an arbitrary address.
 */
export async function advertisesOAuth(url: string, fetchImpl: typeof fetch): Promise<boolean> {
  const endpoint = new URL(url);
  const candidates: string[] = [];
  try {
    const probe = await fetchJson(fetchImpl, url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: mcpClientInfo() } }),
    });
    const header = probe.headers.get('www-authenticate') ?? '';
    const named = /resource_metadata="?([^",\s]+)"?/i.exec(header)?.[1];
    if (named) {
      try {
        const metadata = new URL(named);
        if (metadata.hostname === endpoint.hostname && (metadata.protocol === 'https:' || metadata.protocol === endpoint.protocol)) candidates.push(metadata.toString());
      } catch {
        // A header that does not hold an address is ignored.
      }
    }
  } catch {
    // The 401 itself was already seen by the connect; a failing probe only loses the header hint.
  }
  const path = endpoint.pathname.replace(/\/$/, '');
  for (const suffix of [path, '']) {
    candidates.push(`${endpoint.origin}/.well-known/oauth-protected-resource${suffix}`);
    candidates.push(`${endpoint.origin}/.well-known/oauth-authorization-server${suffix}`);
  }
  for (const candidate of [...new Set(candidates)]) {
    try {
      const document = await fetchJson(fetchImpl, candidate);
      if (document.status === 200 && isOAuthMetadata(document.body)) return true;
    } catch {
      // Not published there; try the next place.
    }
  }
  return false;
}
