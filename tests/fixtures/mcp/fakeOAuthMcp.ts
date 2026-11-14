import { createHash, randomBytes } from 'crypto';
import * as http from 'http';

/**
 * TEST fixture: a fake OAuth authorization server and a fake MCP server on one loopback port, shaped like the
 * MCP server the app was built against: protected-resource metadata, RFC 8414 path-inserted authorization-server metadata,
 * dynamic registration, authorization code + PKCE S256, refresh tokens, and a Streamable HTTP endpoint that needs
 * the issued bearer. Plain `http`, no network beyond 127.0.0.1. Not a live server.
 */
export interface FakeOAuthMcpOptions {
  /** Lifetime of issued access tokens, in seconds. */
  accessTtlSeconds?: number;
  /** When set, the MCP endpoint answers every POST with a 307 to this URL (cross-origin redirect check). */
  redirectMcpTo?: string;
}

export interface FakeOAuthMcp {
  origin: string;
  mcpUrl: string;
  issuer: string;
  /** Every request as "METHOD /path" (no query, no headers, no bodies). */
  hits: string[];
  /** Registered clients by client_id. */
  clients: Map<string, { redirect_uris: string[]; token_endpoint_auth_method?: string }>;
  /** Tool calls the MCP endpoint answered. */
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
  /** Grants the token endpoint served, in order. */
  grants: string[];
  /** Authorization requests the /authorize endpoint accepted (query parameters). */
  authorizeRequests: Array<Record<string, string>>;
  /** Makes every access token issued so far invalid at the MCP endpoint. */
  expireAccessTokens(): void;
  /** Makes every refresh token issued so far invalid at the token endpoint. */
  revokeRefreshTokens(): void;
  /** From now on, answer authorized MCP requests with a 307 to `url` (null: stop). */
  redirectMcpTo(url: string | null): void;
  close(): Promise<void>;
}

const MCP_PATH = '/gateway_comfy/mcp';
const PRM_PATH = `/.well-known/oauth-protected-resource${MCP_PATH}`;
const AS_PATH = '/.well-known/oauth-authorization-server/mcp';

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function token(prefix: string): string {
  return `${prefix}-${base64url(randomBytes(18))}`;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(value));
}

function textResult(value: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

const TOOLS = ['studio_info', 'studio_capabilities', 'models', 'model_metadata'];

function toolAnswer(name: string, args: Record<string, unknown>) {
  if (name === 'studio_info') return textResult({ installation_id: 'fake-oauth-home', comfyui_url: null });
  if (name === 'studio_capabilities' && args.kind === 'packs') {
    return textResult({ items: [{ name: 'fake-pack', installed_state: 'installed', import_state: 'imported', version: '1.0', commit: null }], next_cursor: null });
  }
  if (name === 'studio_capabilities') {
    return textResult({
      items: [
        { class_type: 'KSampler', module: 'nodes', display_name: 'KSampler', category: 'sampling' },
        { class_type: 'LoraLoader', module: 'nodes', display_name: 'Load LoRA', category: 'loaders' },
      ],
      next_cursor: null,
    });
  }
  if (name === 'models') {
    return textResult({ items: [{ category: 'loras', filename: 'fake_style.safetensors', root_path: '/m/loras', size_bytes: 10 }], next_cursor: null });
  }
  if (name === 'model_metadata') return textResult({ model_explorer: 'unavailable', embedded_metadata: {}, civitai_sidecar: null });
  return { content: [{ type: 'text', text: `unknown tool ${name}` }], isError: true };
}

export async function startFakeOAuthMcp(options: FakeOAuthMcpOptions = {}): Promise<FakeOAuthMcp> {
  const accessTtl = options.accessTtlSeconds ?? 60;
  const hits: string[] = [];
  const clients = new Map<string, { redirect_uris: string[]; token_endpoint_auth_method?: string }>();
  const codes = new Map<string, { clientId: string; redirectUri: string; challenge: string }>();
  const access = new Map<string, number>();
  const refresh = new Map<string, string>();
  const toolCalls: FakeOAuthMcp['toolCalls'] = [];
  const grants: string[] = [];
  const authorizeRequests: FakeOAuthMcp['authorizeRequests'] = [];
  let origin = '';

  const issue = (clientId: string) => {
    const accessToken = token('fake-access');
    const refreshToken = token('fake-refresh');
    access.set(accessToken, Date.now() + accessTtl * 1000);
    refresh.set(refreshToken, clientId);
    return { access_token: accessToken, token_type: 'Bearer', expires_in: accessTtl, refresh_token: refreshToken };
  };

  const unauthorized = (res: http.ServerResponse) => {
    res.writeHead(401, { 'www-authenticate': `Bearer resource_metadata="${origin}${PRM_PATH}"`, 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid_token' }));
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', origin);
    hits.push(`${req.method} ${url.pathname}`);
    try {
      if (req.method === 'GET' && url.pathname === PRM_PATH) {
        sendJson(res, 200, { authorization_servers: [`${origin}/mcp`], resource: `${origin}${MCP_PATH}`, scopes_supported: [] });
        return;
      }
      if (req.method === 'GET' && url.pathname === AS_PATH) {
        sendJson(res, 200, {
          issuer: `${origin}/mcp`,
          authorization_endpoint: `${origin}/authorize/mcp-session`,
          token_endpoint: `${origin}/token`,
          registration_endpoint: `${origin}/register`,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
          scopes_supported: [],
        });
        return;
      }
      if (url.pathname === '/mcp/.well-known/oauth-authorization-server') {
        // That server answers the non-inserted variant with 401.
        unauthorized(res);
        return;
      }
      if (req.method === 'POST' && url.pathname === '/register') {
        const body = JSON.parse(await readBody(req)) as { redirect_uris?: unknown; token_endpoint_auth_method?: string };
        const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((uri): uri is string => typeof uri === 'string') : [];
        if (uris.length === 0 || !uris.every((uri) => /^http:\/\/127\.0\.0\.1:\d+\/callback$/.test(uri))) {
          sendJson(res, 400, { error: 'invalid_redirect_uri' });
          return;
        }
        const clientId = token('fake-client');
        clients.set(clientId, { redirect_uris: uris, token_endpoint_auth_method: body.token_endpoint_auth_method });
        sendJson(res, 201, { ...body, client_id: clientId, client_id_issued_at: Math.floor(Date.now() / 1000) });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/authorize/mcp-session') {
        const query = Object.fromEntries(url.searchParams.entries());
        const client = clients.get(query.client_id ?? '');
        if (!client || !client.redirect_uris.includes(query.redirect_uri ?? '')) {
          sendJson(res, 400, { error: 'invalid_request', error_description: 'unknown client or redirect_uri' });
          return;
        }
        if (query.response_type !== 'code' || !query.code_challenge || query.code_challenge_method !== 'S256' || !query.state) {
          sendJson(res, 400, { error: 'invalid_request', error_description: 'PKCE S256 and state are required' });
          return;
        }
        authorizeRequests.push(query);
        const code = token('fake-code');
        codes.set(code, { clientId: query.client_id, redirectUri: query.redirect_uri, challenge: query.code_challenge });
        const back = new URL(query.redirect_uri);
        back.searchParams.set('code', code);
        back.searchParams.set('state', query.state);
        res.writeHead(302, { location: back.toString() });
        res.end();
        return;
      }
      if (req.method === 'POST' && url.pathname === '/token') {
        const form = new URLSearchParams(await readBody(req));
        const grant = form.get('grant_type') ?? '';
        grants.push(grant);
        if (grant === 'authorization_code') {
          const record = codes.get(form.get('code') ?? '');
          codes.delete(form.get('code') ?? '');
          const verifier = form.get('code_verifier') ?? '';
          const challenge = base64url(createHash('sha256').update(verifier).digest());
          if (!record || record.clientId !== form.get('client_id') || record.redirectUri !== form.get('redirect_uri') || challenge !== record.challenge) {
            sendJson(res, 400, { error: 'invalid_grant' });
            return;
          }
          sendJson(res, 200, issue(record.clientId));
          return;
        }
        if (grant === 'refresh_token') {
          const presented = form.get('refresh_token') ?? '';
          const clientId = refresh.get(presented);
          if (!clientId || clientId !== form.get('client_id')) {
            sendJson(res, 400, { error: 'invalid_grant' });
            return;
          }
          refresh.delete(presented);
          sendJson(res, 200, issue(clientId));
          return;
        }
        sendJson(res, 400, { error: 'unsupported_grant_type' });
        return;
      }
      if (url.pathname === MCP_PATH) {
        const header = req.headers.authorization ?? '';
        const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
        const until = access.get(bearer);
        if (!until || until <= Date.now()) {
          await readBody(req);
          unauthorized(res);
          return;
        }
        if (options.redirectMcpTo) {
          await readBody(req);
          res.writeHead(307, { location: options.redirectMcpTo });
          res.end();
          return;
        }
        if (req.method === 'GET') {
          res.writeHead(405);
          res.end();
          return;
        }
        if (req.method === 'DELETE') {
          res.writeHead(200);
          res.end();
          return;
        }
        const message = JSON.parse(await readBody(req)) as { id?: number | string; method?: string; params?: Record<string, unknown> };
        if (message.id === undefined) {
          res.writeHead(202);
          res.end();
          return;
        }
        let result: unknown;
        if (message.method === 'initialize') {
          result = {
            protocolVersion: message.params?.protocolVersion,
            capabilities: { tools: {} },
            serverInfo: { name: 'fake-oauth-mcp', version: '0.0.0' },
          };
        } else if (message.method === 'tools/list') {
          result = { tools: TOOLS.map((name) => ({ name, inputSchema: { type: 'object' } })) };
        } else if (message.method === 'tools/call') {
          const name = String(message.params?.name ?? '');
          const args = (message.params?.arguments ?? {}) as Record<string, unknown>;
          toolCalls.push({ name, args });
          result = toolAnswer(name, args);
        } else if (message.method === 'ping') {
          result = {};
        } else {
          sendJson(res, 200, { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } });
          return;
        }
        sendJson(res, 200, { jsonrpc: '2.0', id: message.id, result }, { 'mcp-session-id': 'fake-session' });
        return;
      }
      res.writeHead(404);
      res.end();
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fake OAuth MCP server has no port');
  origin = `http://127.0.0.1:${address.port}`;
  return {
    origin,
    mcpUrl: `${origin}${MCP_PATH}`,
    issuer: `${origin}/mcp`,
    hits,
    clients,
    toolCalls,
    grants,
    authorizeRequests,
    expireAccessTokens: () => {
      for (const key of access.keys()) access.set(key, 0);
    },
    revokeRefreshTokens: () => refresh.clear(),
    redirectMcpTo: (url) => {
      options.redirectMcpTo = url ?? undefined;
    },
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    }),
  };
}
