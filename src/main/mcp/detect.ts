/**
 * What an MCP server wants from a connection, found out by trying rather than assumed, so Settings ▸ Connection can
 * offer the person the right choice: no sign-in, a pasted token, or the browser sign-in. Nothing is written anywhere.
 */

import { connectStreamableHttp, failure, isNetworkError, MCP_NEEDS_SIGN_IN, mcpUnreachableError, mcpUrlError, type McpSessionFactory } from './client';
import type { McpAuthProbe } from '../../shared/contracts/mcpAuth';

/** Protective: metadata documents are small; a server that answers slowly is reported as such, not waited for. */
export const METADATA_TIMEOUT_MS = 5_000;

export type { McpAuthProbe };

/**
 * Connects once without credentials. Accepted: 'none'. Refused with 401: 'oauth' when the server publishes OAuth
 * metadata (RFC 9728 resource metadata named in WWW-Authenticate, or the well-known documents on its origin), else
 * 'token'. Unreachable servers and other failures come back as fixed sentences.
 */
export async function detectMcpAuth(
  url: string,
  factory: McpSessionFactory = connectStreamableHttp,
  fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args),
): Promise<McpAuthProbe> {
  const urlError = mcpUrlError(url);
  if (urlError) return { ok: false, error: urlError };
  try {
    const session = await factory(url, null, null);
    try {
      const tools = (await session.listTools()).length;
      return { ok: true, mode: 'none', tools };
    } finally {
      await session.close().catch(() => undefined);
    }
  } catch (error) {
    if (isNetworkError(error)) return { ok: false, error: mcpUnreachableError(hostOf(url)) };
    const classified = failure(error, { authenticated: false });
    if (classified.error !== MCP_NEEDS_SIGN_IN) return classified;
  }
  return { ok: true, mode: (await advertisesOAuth(url, fetchImpl)) ? 'oauth' : 'token' };
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

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
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'comfyui-graph-helper', version: '0.1.0' } } }),
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
