import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import * as http from 'http';
import { migrate } from '../../src/main/settings/migrate';
import { connectStreamableHttp, MCP_SIGN_IN_AGAIN, openReadOnlySession } from '../../src/main/mcp/client';
import {
  clientRecordName,
  McpOAuthManager,
  SIGN_IN_TIMEOUT,
  startLoopbackRedirect,
  tokensRecordName,
  type SecretVault,
} from '../../src/main/mcp/oauth';
import { SyncService } from '../../src/main/mcp/sync';
import { isReadOnlyCall } from '../../src/main/mcp/readOnly';
import { startFakeOAuthMcp, type FakeOAuthMcp } from '../fixtures/mcp/fakeOAuthMcp';

/** TEST fixture only: a fake OAuth + MCP server on 127.0.0.1 (tests/fixtures/mcp/fakeOAuthMcp.ts). No real network. */

function openDb(url: string): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  db.prepare("INSERT INTO settings (id, theme, motion, provider, model, comfy_origin, base_url, mcp_url, language, updated_at) VALUES (1, 'dark', 'system', 'openai', 'x', '', '', ?, 'en', 0)").run(url);
  return db;
}

/** Stands in for safeStorage with a proven OS store: reversible, never contains the plaintext, `v11` like a keyring cipher. */
const provenVault: SecretVault = {
  decision: async () => ({ persist: true }),
  encrypt: async (plain) => Buffer.concat([Buffer.from('v11'), Buffer.from(plain, 'utf8').map((byte) => byte ^ 0x5a)]),
  decrypt: async (cipher) => Buffer.from(cipher.subarray(3).map((byte) => byte ^ 0x5a)).toString('utf8'),
};

/** No OS password manager proved encryption: nothing may be written. */
const unprovenVault: SecretVault = {
  decision: async () => ({ persist: false }),
  encrypt: async () => {
    throw new Error('must not encrypt without a proven store');
  },
  decrypt: async () => null,
};

/** TEST stand-in for the system browser: GET the authorization URL and follow redirects to the loopback callback. */
async function followLikeABrowser(start: string): Promise<number> {
  let current = start;
  let status = 0;
  for (let hop = 0; hop < 5; hop += 1) {
    const response = await fetch(current, { redirect: 'manual' });
    await response.arrayBuffer();
    status = response.status;
    const location = response.headers.get('location');
    if (status < 300 || status >= 400 || !location) return status;
    current = new URL(location, current).toString();
  }
  return status;
}

let fake: FakeOAuthMcp;
let opened: string[];

function manager(db: Database.Database, vault: SecretVault = provenVault, open?: (url: string) => Promise<void>) {
  return new McpOAuthManager({
    db: () => db,
    vault,
    openExternal: open ?? (async (url) => {
      opened.push(url);
      void followLikeABrowser(url);
    }),
    language: () => 'en',
    now: () => Date.now(),
    loginTimeoutMs: 5000,
  });
}

function secretNames(db: Database.Database): string[] {
  return (db.prepare('SELECT name FROM secret_records ORDER BY name').all() as Array<{ name: string }>).map((row) => row.name);
}

beforeEach(async () => {
  fake = await startFakeOAuthMcp({ accessTtlSeconds: 120 });
  opened = [];
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fake.close();
});

describe('MCP OAuth sign-in', () => {
  it('signs in through the browser: path-inserted discovery, registration, PKCE S256, tokens as ciphertext', async () => {
    const db = openDb(fake.mcpUrl);
    const logs: unknown[][] = [];
    for (const level of ['log', 'warn', 'error', 'info', 'debug'] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logs.push(args);
      });
    }
    const oauth = manager(db);
    expect(await oauth.status(fake.mcpUrl)).toEqual({ state: 'none', persisted: false });

    const result = await oauth.login(fake.mcpUrl);
    expect(result.ok).toBe(true);
    expect(result.ok && typeof result.expiresAt === 'number').toBe(true);

    // Discovery found the RFC 8414 path-inserted metadata; the non-inserted variant (401 on the owner's server) was not needed.
    expect(fake.hits).toContain('GET /.well-known/oauth-protected-resource/home_comfyui/mcp');
    expect(fake.hits).toContain('GET /.well-known/oauth-authorization-server/mcp');
    expect(fake.hits).not.toContain('GET /mcp/.well-known/oauth-authorization-server');
    expect(fake.hits).toContain('POST /register');
    expect(fake.clients.size).toBe(1);
    const [client] = [...fake.clients.values()];
    expect(client.token_endpoint_auth_method).toBe('none');
    expect(client.redirect_uris[0]).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    expect(opened).toHaveLength(1);
    expect(new URL(opened[0]).origin).toBe(fake.origin);
    const request = fake.authorizeRequests[0];
    expect(request.code_challenge_method).toBe('S256');
    expect(request.code_challenge.length).toBeGreaterThan(40);
    expect(request.state.length).toBeGreaterThan(20);
    expect(request.resource).toBe(fake.mcpUrl);
    expect(fake.grants).toEqual(['authorization_code']);

    const status = await oauth.status(fake.mcpUrl);
    expect(status).toMatchObject({ state: 'authorized', persisted: true });
    expect(status.expiresAt).toBeGreaterThan(Date.now());
    expect(oauth.signedIn(fake.mcpUrl)).toBe(true);

    const origin = fake.origin;
    expect(secretNames(db)).toEqual([clientRecordName(origin), tokensRecordName(origin)].sort());
    const access = oauth.entry(origin).tokens!.value.access_token;
    const refresh = oauth.entry(origin).tokens!.value.refresh_token!;
    for (const row of db.prepare('SELECT ciphertext FROM secret_records').all() as Array<{ ciphertext: Buffer }>) {
      expect(row.ciphertext.includes(Buffer.from(access))).toBe(false);
      expect(row.ciphertext.includes(Buffer.from(refresh))).toBe(false);
    }
    // Status never carries a token, and nothing was logged with one.
    expect(JSON.stringify(status)).not.toContain(access);
    expect(JSON.stringify(logs)).not.toContain(access);
    expect(JSON.stringify(logs)).not.toContain(refresh);

    // A second manager on the same profile reads the ciphertext back.
    const restarted = manager(db);
    expect(await restarted.status(fake.mcpUrl)).toMatchObject({ state: 'authorized', persisted: true });
  });

  it('keeps tokens in memory only when the OS store did not prove encryption', async () => {
    const db = openDb(fake.mcpUrl);
    const oauth = manager(db, unprovenVault);
    expect((await oauth.login(fake.mcpUrl)).ok).toBe(true);
    expect(await oauth.status(fake.mcpUrl)).toMatchObject({ state: 'authorized', persisted: false });
    expect(secretNames(db)).toEqual([]);
    // After a restart nothing is left.
    expect(await manager(db, unprovenVault).status(fake.mcpUrl)).toEqual({ state: 'none', persisted: false });
  });

  it('moves through none → pending → authorized → none (sign out)', async () => {
    const db = openDb(fake.mcpUrl);
    let release: (() => void) | null = null;
    const oauth = manager(db, provenVault, async (url) => {
      // The "browser" waits until the test looked at the pending state.
      release = () => void followLikeABrowser(url);
    });
    expect((await oauth.status(fake.mcpUrl)).state).toBe('none');
    const login = oauth.login(fake.mcpUrl);
    await vi.waitFor(() => expect(release).not.toBeNull());
    expect((await oauth.status(fake.mcpUrl)).state).toBe('pending');
    release!();
    expect((await login).ok).toBe(true);
    expect((await oauth.status(fake.mcpUrl)).state).toBe('authorized');

    expect(await oauth.logout(fake.mcpUrl)).toEqual({ state: 'none', persisted: false });
    expect(secretNames(db)).toEqual([]);
    expect(oauth.signedIn(fake.mcpUrl)).toBe(false);
  });

  it('signs in again on the registered loopback port without a new registration', async () => {
    const db = openDb(fake.mcpUrl);
    const oauth = manager(db);
    expect((await oauth.login(fake.mcpUrl)).ok).toBe(true);
    fake.expireAccessTokens();
    fake.revokeRefreshTokens();
    expect((await oauth.login(fake.mcpUrl)).ok).toBe(true);
    expect(fake.clients.size).toBe(1);
    expect(opened).toHaveLength(2);
  });

  it('refreshes an expired access token in a background session without opening the browser', async () => {
    const db = openDb(fake.mcpUrl);
    const oauth = manager(db);
    expect((await oauth.login(fake.mcpUrl)).ok).toBe(true);
    const before = oauth.entry(fake.origin).tokens!.value.access_token;
    fake.expireAccessTokens();

    const provider = await oauth.backgroundProvider(fake.mcpUrl);
    expect(provider).not.toBeNull();
    const session = await openReadOnlySession({ url: fake.mcpUrl, token: null, authProvider: provider }, connectStreamableHttp);
    expect(session.ok).toBe(true);
    if (!session.ok) return;
    expect((await session.session.listTools()).map((tool) => tool.name)).toContain('studio_info');
    await session.session.close();

    expect(fake.grants).toEqual(['authorization_code', 'refresh_token']);
    expect(oauth.entry(fake.origin).tokens!.value.access_token).not.toBe(before);
    expect(opened).toHaveLength(1);
    expect((await oauth.status(fake.mcpUrl)).state).toBe('authorized');
  });

  it('turns a failed refresh into "expired" and a sync error that asks to sign in again', async () => {
    const db = openDb(fake.mcpUrl);
    const oauth = manager(db);
    expect((await oauth.login(fake.mcpUrl)).ok).toBe(true);
    fake.expireAccessTokens();
    fake.revokeRefreshTokens();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const sync = new SyncService({
      token: () => null,
      readUrl: () => fake.mcpUrl,
      authProvider: (url) => oauth.backgroundProvider(url),
      signedIn: (url) => oauth.signedIn(url),
      factory: connectStreamableHttp,
      fetchImpl: (async () => { throw new Error('no network in unit tests'); }) as unknown as typeof fetch,
      now: () => 1_700_000_000_000,
    });
    const status = await sync.runSync(db);
    expect(status).toMatchObject({ state: 'error', lastError: MCP_SIGN_IN_AGAIN, signedIn: false });
    expect((await oauth.status(fake.mcpUrl)).state).toBe('expired');
    expect(opened).toHaveLength(1);
  });

  it('syncs with the browser sign-in when no manual token is held', async () => {
    const db = openDb(fake.mcpUrl);
    const oauth = manager(db);
    expect((await oauth.login(fake.mcpUrl)).ok).toBe(true);
    const sync = new SyncService({
      token: () => null,
      readUrl: () => fake.mcpUrl,
      authProvider: (url) => oauth.backgroundProvider(url),
      signedIn: (url) => oauth.signedIn(url),
      factory: connectStreamableHttp,
      fetchImpl: (async () => { throw new Error('no network in unit tests'); }) as unknown as typeof fetch,
      now: () => 1_700_000_000_000,
    });
    const status = await sync.runSync(db);
    expect(status).toMatchObject({ state: 'idle', lastError: null, tokenHeld: false, signedIn: true });
    expect(status.counts.nodeClasses).toBe(2);
    expect(status.counts.models).toBe(1);
    expect(fake.toolCalls.length).toBeGreaterThan(0);
    for (const call of fake.toolCalls) expect(isReadOnlyCall(call.name, call.args), call.name).toBe(true);
  });

  it('does not follow a redirect to another origin, so the bearer never leaves the MCP origin', async () => {
    const seen: Array<string | undefined> = [];
    const other = http.createServer((req, res) => {
      seen.push(req.headers.authorization);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    });
    await new Promise<void>((resolve) => other.listen(0, '127.0.0.1', resolve));
    const port = (other.address() as { port: number }).port;
    try {
      const db = openDb(fake.mcpUrl);
      const oauth = manager(db);
      expect((await oauth.login(fake.mcpUrl)).ok).toBe(true);
      fake.redirectMcpTo(`http://localhost:${port}/steal`);
      const provider = await oauth.backgroundProvider(fake.mcpUrl);
      const viaOAuth = await openReadOnlySession({ url: fake.mcpUrl, token: null, authProvider: provider }, connectStreamableHttp);
      expect(viaOAuth.ok).toBe(false);
      // The manual-token path uses the same transport and the same rule.
      const viaToken = await openReadOnlySession({ url: fake.mcpUrl, token: oauth.entry(fake.origin).tokens!.value.access_token }, connectStreamableHttp);
      expect(viaToken.ok).toBe(false);
      expect(seen).toEqual([]);
    } finally {
      fake.redirectMcpTo(null);
      await new Promise<void>((resolve) => other.close(() => resolve()));
    }
  });

  it('prefers a manual token over the stored sign-in', async () => {
    const db = openDb(fake.mcpUrl);
    const oauth = manager(db);
    expect((await oauth.login(fake.mcpUrl)).ok).toBe(true);
    const provider = await oauth.backgroundProvider(fake.mcpUrl);
    const seen: Array<{ token: string | null; provider: unknown }> = [];
    await openReadOnlySession({ url: fake.mcpUrl, token: 'manual-token', authProvider: provider }, async (_url, token, authProvider) => {
      seen.push({ token, provider: authProvider });
      return { listTools: async () => [], callTool: async () => ({ content: [] }), close: async () => undefined };
    });
    expect(seen).toEqual([{ token: 'manual-token', provider: null }]);
  });
});

describe('loopback redirect listener', () => {
  it('rejects a wrong state, accepts the right one once, and then stops listening', async () => {
    const redirect = await startLoopbackRedirect({ timeoutMs: 5000, language: () => 'ru' });
    expect(redirect.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    const wrong = await fetch(`${redirect.url}?code=evil&state=not-the-state`);
    expect(wrong.status).toBe(400);
    expect(await wrong.text()).toContain('Вход не завершён');
    const right = await fetch(`${redirect.url}?code=good-code&state=${encodeURIComponent(redirect.state)}`);
    expect(right.status).toBe(200);
    expect(await right.text()).toContain('Можно вернуться в приложение');
    await expect(redirect.code).resolves.toBe('good-code');
    await vi.waitFor(async () => {
      await expect(fetch(`${redirect.url}?code=again&state=${encodeURIComponent(redirect.state)}`)).rejects.toThrow();
    });
  });

  it('gives up after the timeout', async () => {
    const redirect = await startLoopbackRedirect({ timeoutMs: 50, language: () => 'en' });
    await expect(redirect.code).rejects.toThrow(SIGN_IN_TIMEOUT);
  });
});
