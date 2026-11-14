import type Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import * as http from 'http';
import type { AddressInfo } from 'net';
import {
  Client,
  StreamableHTTPClientTransport,
  type OAuthClientMetadata,
  type OAuthClientProvider,
  type OAuthDiscoveryState,
  type StoredOAuthClientInformation,
  type StoredOAuthTokens,
} from '@modelcontextprotocol/client';
import type { McpOAuthLoginResult, McpOAuthStatus } from '../../shared/contracts/mcpAuth';
import { en, ru } from '../../shared/i18n/catalog';
import { isUnprotectedCipher } from '../../shared/config/secretPolicy';
import { forgetSecret, readSecretCipher, saveNamedSecretIfProven } from '../settings/repository';
import { isLoopbackHost } from '../comfy/read';
import { isNetworkError, MCP_SIGN_IN_AGAIN, mcpClientInfo, mcpUnreachableError, mcpUrlError } from './client';
import { redactSecrets } from '../../shared/config/draft';
import { DISPLAY_NAME } from '../identity';

/**
 * OAuth sign-in to the configured MCP server (authorization code + PKCE S256, dynamic client registration,
 * public client, refresh tokens) on top of the MCP client SDK's OAuth machinery.
 *
 * Secrets in this module (client registration, access and refresh tokens, PKCE verifier) never leave main:
 * they are not logged, not returned over IPC (only `McpOAuthStatus`), and the access token is sent only to the
 * MCP URL it was issued for (the SDK transport refuses cross-origin redirects). Tokens and the client record are
 * written to `secret_records` as safeStorage ciphertext only when the OS password manager proved encryption;
 * otherwise they live in memory for this session.
 */

export const CLIENT_NAME = DISPLAY_NAME;
export const LOGIN_TIMEOUT_MS = 5 * 60_000;
const CONNECT_TIMEOUT_MS = 30_000;

export const SIGN_IN_TIMEOUT = 'Sign-in did not finish in time.';
export const SIGN_IN_DENIED = 'Sign-in was cancelled in the browser.';
export const SIGN_IN_CANCELLED = 'Sign-in was cancelled.';
export const SIGN_IN_FAILED = 'Sign-in did not finish.';
export const SIGN_IN_BROWSER = 'The browser could not be opened.';
/** Sync error when stored tokens no longer work and a background run may not open the browser. */
export const SIGN_IN_AGAIN = MCP_SIGN_IN_AGAIN;

/** Thrown by a background provider instead of opening the browser. */
export class McpSignInRequiredError extends Error {
  constructor() {
    super(SIGN_IN_AGAIN);
    this.name = 'McpSignInRequiredError';
  }
}

export interface SecretVault {
  /** Whether the OS password manager proved encryption (the same probe the model key uses). */
  decision(): Promise<{ persist: boolean }>;
  encrypt(plain: string): Promise<Buffer>;
  /** Plaintext, or null when the OS store did not open the ciphertext. */
  decrypt(cipher: Buffer): Promise<string | null>;
}

export interface McpOAuthDeps {
  db: () => Database.Database;
  vault: SecretVault;
  /** Opens the authorization URL in the system browser. Never inside the app window. */
  openExternal: (url: string) => Promise<void>;
  language: () => 'en' | 'ru';
  now: () => number;
  loginTimeoutMs?: number;
  connectTimeoutMs?: number;
}

export const clientRecordName = (origin: string) => `mcp-oauth-client:${origin}`;
export const tokensRecordName = (origin: string) => `mcp-oauth-tokens:${origin}`;

interface OriginEntry {
  client?: StoredOAuthClientInformation;
  tokens?: { value: StoredOAuthTokens; obtainedAt: number };
  persisted: { client: boolean; tokens: boolean };
  /** A background refresh failed and the browser is needed again. */
  expired: boolean;
}

function originOf(url: string): string {
  return new URL(url).origin;
}

function base64url(bytes: Buffer): string {
  return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function isClientRecord(value: unknown): value is StoredOAuthClientInformation {
  return !!value && typeof value === 'object' && typeof (value as { client_id?: unknown }).client_id === 'string';
}

function isTokensRecord(value: unknown): value is { value: StoredOAuthTokens; obtainedAt: number } {
  if (!value || typeof value !== 'object') return false;
  const record = value as { value?: { access_token?: unknown; token_type?: unknown }; obtainedAt?: unknown };
  return typeof record.obtainedAt === 'number' && typeof record.value?.access_token === 'string' && typeof record.value?.token_type === 'string';
}

/** The loopback port a stored client registered, so the next login can listen there and keep the registration. */
function registeredLoopbackPort(client: StoredOAuthClientInformation | undefined): number | undefined {
  const uris = (client as { redirect_uris?: unknown } | undefined)?.redirect_uris;
  if (!Array.isArray(uris)) return undefined;
  for (const uri of uris) {
    try {
      const parsed = new URL(String(uri));
      if (parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1' && parsed.port) return Number(parsed.port);
    } catch {
      // Not a URL.
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------------------------
// Loopback redirect listener
// ---------------------------------------------------------------------------------------------------------------

export interface LoopbackRedirect {
  url: string;
  state: string;
  /** Resolves with the authorization code once the browser comes back with the right state. */
  code: Promise<string>;
  /** Stops the listener and rejects a pending `code` with SIGN_IN_CANCELLED. */
  cancel(): void;
  close(): void;
}

function callbackPage(language: 'en' | 'ru', ok: boolean): string {
  const copy = language === 'en' ? en.settings : ru.settings;
  const text = ok ? copy.oauthCallbackDone : copy.oauthCallbackFailed;
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${CLIENT_NAME}</title></head>`
    + `<body style="font-family:system-ui,sans-serif;margin:3rem;line-height:1.5"><p>${text}</p></body></html>`;
}

/**
 * Listens on 127.0.0.1 for one OAuth redirect. Single use: the first request to /callback with the expected
 * state ends it; a wrong state gets 400 and the listener keeps waiting; after `timeoutMs` it gives up.
 */
export async function startLoopbackRedirect(options: {
  timeoutMs: number;
  language: () => 'en' | 'ru';
  preferredPort?: number;
  state?: string;
}): Promise<LoopbackRedirect> {
  const state = options.state ?? base64url(randomBytes(32));
  let settle: { resolve: (code: string) => void; reject: (error: Error) => void } | null = null;
  const code = new Promise<string>((resolve, reject) => {
    settle = { resolve, reject };
  });
  // A listener that nobody awaited (e.g. a login that failed before the browser) must not raise unhandled rejections.
  code.catch(() => undefined);
  let finished = false;
  const server = http.createServer((req, res) => {
    const send = (status: number, ok: boolean) => {
      res.writeHead(status, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
        'referrer-policy': 'no-referrer',
      });
      res.end(callbackPage(options.language(), ok));
    };
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method !== 'GET' || url.pathname !== '/callback' || finished) {
      res.writeHead(404);
      res.end();
      return;
    }
    if (url.searchParams.get('state') !== state) {
      send(400, false);
      return;
    }
    const error = url.searchParams.get('error');
    const value = url.searchParams.get('code');
    if (error || !value) {
      send(400, false);
      finish(new Error(SIGN_IN_DENIED));
      return;
    }
    send(200, true);
    finish(null, value);
  });
  const timer = setTimeout(() => finish(new Error(SIGN_IN_TIMEOUT)), options.timeoutMs);
  timer.unref?.();
  function finish(error: Error | null, value?: string) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (error) settle?.reject(error);
    else settle?.resolve(value ?? '');
    // Let the response flush, then stop listening.
    setImmediate(() => server.close());
  }
  const listen = (port: number) => new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
  try {
    if (options.preferredPort) await listen(options.preferredPort);
    else await listen(0);
  } catch {
    // The registered port is taken: a random one means a new registration.
    await listen(0);
  }
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/callback`,
    state,
    code,
    cancel: () => finish(new Error(SIGN_IN_CANCELLED)),
    close: () => {
      finished = true;
      clearTimeout(timer);
      server.close();
      settle?.reject(new Error(SIGN_IN_CANCELLED));
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------------------------------------------

type ProviderMode =
  | { interactive: true; redirect: LoopbackRedirect; openExternal: (url: string) => Promise<void> }
  | { interactive: false };

/**
 * `OAuthClientProvider` for one MCP URL. Interactive (a login): redirects open the system browser and the loopback
 * listener takes the code. Background (a sync): a needed redirect throws McpSignInRequiredError and marks the
 * origin expired instead of opening anything.
 */
export class McpOAuthProvider implements OAuthClientProvider {
  readonly origin: string;
  /** Set when a background run needed the browser. */
  signInRequired = false;
  /** Set when an interactive run opened the browser. */
  redirected = false;
  private verifier: string | null = null;
  private discovery: OAuthDiscoveryState | undefined;

  constructor(readonly serverUrl: string, private readonly manager: McpOAuthManager, private readonly mode: ProviderMode) {
    this.origin = originOf(serverUrl);
  }

  get redirectUrl(): string {
    if (this.mode.interactive) return this.mode.redirect.url;
    const uris = (this.manager.entry(this.origin).client as { redirect_uris?: unknown } | undefined)?.redirect_uris;
    return Array.isArray(uris) && typeof uris[0] === 'string' ? uris[0] : 'http://127.0.0.1/callback';
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: CLIENT_NAME,
      redirect_uris: [this.redirectUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  }

  state(): string {
    return this.mode.interactive ? this.mode.redirect.state : base64url(randomBytes(32));
  }

  clientInformation(): StoredOAuthClientInformation | undefined {
    const client = this.manager.entry(this.origin).client;
    if (!this.mode.interactive) {
      // A background run must not register a client it cannot finish a login for.
      if (!client) throw this.needSignIn();
      return client;
    }
    // A registration made for another loopback port does not match this redirect URI: register again.
    const uris = (client as { redirect_uris?: unknown } | undefined)?.redirect_uris;
    if (client && Array.isArray(uris) && !uris.includes(this.redirectUrl)) return undefined;
    return client;
  }

  async saveClientInformation(info: StoredOAuthClientInformation): Promise<void> {
    await this.manager.saveClient(this.origin, info);
  }

  tokens(): StoredOAuthTokens | undefined {
    return this.manager.entry(this.origin).tokens?.value;
  }

  async saveTokens(tokens: StoredOAuthTokens): Promise<void> {
    await this.manager.saveTokens(this.origin, tokens);
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    if (!this.mode.interactive) throw this.needSignIn();
    const secure = authorizationUrl.protocol === 'https:' || (authorizationUrl.protocol === 'http:' && isLoopbackHost(authorizationUrl.hostname));
    if (!secure) throw new Error(SIGN_IN_FAILED);
    this.redirected = true;
    try {
      await this.mode.openExternal(authorizationUrl.toString());
    } catch (error) {
      // The person said no to the site before the browser opened (main/signInSite.ts).
      if (error instanceof Error && error.message === SIGN_IN_CANCELLED) throw error;
      throw new Error(SIGN_IN_BROWSER);
    }
  }

  saveCodeVerifier(codeVerifier: string): void {
    this.verifier = codeVerifier;
  }

  codeVerifier(): string {
    if (!this.verifier) throw new Error(SIGN_IN_FAILED);
    return this.verifier;
  }

  saveDiscoveryState(state: OAuthDiscoveryState): void {
    this.discovery = state;
  }

  discoveryState(): OAuthDiscoveryState | undefined {
    return this.discovery;
  }

  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): Promise<void> {
    if (scope === 'all' || scope === 'client') await this.manager.clearClient(this.origin);
    if (scope === 'all' || scope === 'tokens') await this.manager.clearTokens(this.origin);
    if (scope === 'all' || scope === 'verifier') this.verifier = null;
    if (scope === 'all' || scope === 'discovery') this.discovery = undefined;
  }

  private needSignIn(): McpSignInRequiredError {
    this.signInRequired = true;
    this.manager.markExpired(this.origin);
    return new McpSignInRequiredError();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Manager: storage per MCP origin, login, logout, status
// ---------------------------------------------------------------------------------------------------------------

export class McpOAuthManager {
  private readonly entries = new Map<string, OriginEntry>();
  private readonly loading = new Map<string, Promise<OriginEntry>>();
  private readonly pending = new Map<string, LoopbackRedirect>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly deps: McpOAuthDeps) {}

  /** Called after a login, logout or expiry, so the sync status can be pushed again. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // A listener must not break the login.
      }
    }
  }

  /** The in-memory entry; empty until `load` ran for the origin. */
  entry(origin: string): OriginEntry {
    let entry = this.entries.get(origin);
    if (!entry) {
      entry = { persisted: { client: false, tokens: false }, expired: false };
      this.entries.set(origin, entry);
    }
    return entry;
  }

  /** Reads the stored ciphertext for an origin once per process. */
  async load(origin: string): Promise<OriginEntry> {
    const existing = this.loading.get(origin);
    if (existing) return existing;
    const loaded = this.readStored(origin).catch(() => this.entry(origin));
    this.loading.set(origin, loaded);
    return loaded;
  }

  private async readStored(origin: string): Promise<OriginEntry> {
    const entry = this.entry(origin);
    const decision = await this.deps.vault.decision();
    if (!decision.persist) return entry;
    const open = async (name: string): Promise<unknown> => {
      const cipher = readSecretCipher(this.deps.db(), name);
      if (!cipher || isUnprotectedCipher(cipher)) return undefined;
      try {
        const plain = await this.deps.vault.decrypt(cipher);
        return plain ? JSON.parse(plain) : undefined;
      } catch {
        return undefined;
      }
    };
    const client = await open(clientRecordName(origin));
    if (!entry.client && isClientRecord(client)) {
      entry.client = client;
      entry.persisted.client = true;
    }
    const tokens = await open(tokensRecordName(origin));
    if (!entry.tokens && isTokensRecord(tokens)) {
      entry.tokens = tokens;
      entry.persisted.tokens = true;
    }
    return entry;
  }

  /** Memory always; ciphertext in secret_records only when the OS store proved encryption. */
  private async persist(name: string, value: unknown): Promise<boolean> {
    const db = this.deps.db();
    const plain = JSON.stringify(value);
    try {
      const decision = await this.deps.vault.decision();
      if (decision.persist) {
        const cipher = await this.deps.vault.encrypt(plain);
        if (saveNamedSecretIfProven(db, decision, name, plain, cipher).status === 'stored') return true;
      }
    } catch {
      // Fall through: memory only.
    }
    // Not proven: an older record for this name must not outlive the new value.
    forgetSecret(db, name);
    return false;
  }

  async saveClient(origin: string, info: StoredOAuthClientInformation): Promise<void> {
    const entry = this.entry(origin);
    entry.client = info;
    entry.persisted.client = await this.persist(clientRecordName(origin), info);
  }

  async saveTokens(origin: string, tokens: StoredOAuthTokens): Promise<void> {
    const entry = this.entry(origin);
    const record = { value: tokens, obtainedAt: this.deps.now() };
    entry.tokens = record;
    entry.expired = false;
    entry.persisted.tokens = await this.persist(tokensRecordName(origin), record);
    this.changed();
  }

  async clearClient(origin: string): Promise<void> {
    const entry = this.entry(origin);
    entry.client = undefined;
    entry.persisted.client = false;
    forgetSecret(this.deps.db(), clientRecordName(origin));
  }

  async clearTokens(origin: string): Promise<void> {
    const entry = this.entry(origin);
    entry.tokens = undefined;
    entry.persisted.tokens = false;
    forgetSecret(this.deps.db(), tokensRecordName(origin));
  }

  markExpired(origin: string): void {
    const entry = this.entry(origin);
    if (!entry.expired) {
      entry.expired = true;
      this.changed();
    }
  }

  /** True when tokens for the URL's origin are in memory and not known to be expired. Sync check, no I/O. */
  signedIn(url: string): boolean {
    try {
      const entry = this.entries.get(originOf(url));
      return !!entry?.tokens && !entry.expired;
    } catch {
      return false;
    }
  }

  async status(url: string): Promise<McpOAuthStatus> {
    let origin: string;
    try {
      origin = originOf(url);
    } catch {
      return { state: 'none', persisted: false };
    }
    const entry = await this.load(origin);
    if (this.pending.has(origin)) return { state: 'pending', persisted: false };
    const tokens = entry.tokens;
    const expiresIn = Number(tokens?.value.expires_in);
    const expiresAt = tokens && Number.isFinite(expiresIn) && expiresIn > 0 ? tokens.obtainedAt + expiresIn * 1000 : undefined;
    if (entry.expired) return { state: 'expired', persisted: false };
    if (!tokens) return { state: 'none', persisted: false };
    const lapsed = expiresAt !== undefined && expiresAt <= this.deps.now() && !tokens.value.refresh_token;
    return { state: lapsed ? 'expired' : 'authorized', ...(expiresAt !== undefined ? { expiresAt } : {}), persisted: entry.persisted.tokens };
  }

  /**
   * A provider for a background session, or null when nothing is stored for the URL's origin (then the sync falls
   * back to the manual token or no auth). Never opens the browser.
   */
  async backgroundProvider(url: string): Promise<McpOAuthProvider | null> {
    let origin: string;
    try {
      origin = originOf(url);
    } catch {
      return null;
    }
    const entry = await this.load(origin);
    if (!entry.tokens || !entry.client) return null;
    return new McpOAuthProvider(url, this, { interactive: false });
  }

  /**
   * Signs in through the system browser: connect with the provider; when the server wants authorization the SDK
   * discovers metadata, registers (once per origin), and calls redirectToAuthorization; the loopback listener takes
   * the code, `transport.finishAuth(code)` exchanges it with the PKCE verifier, and a second connect proves the token.
   */
  async login(url: string): Promise<McpOAuthLoginResult> {
    const urlError = mcpUrlError(url);
    if (urlError) return { ok: false, error: urlError };
    const origin = originOf(url);
    this.pending.get(origin)?.cancel();
    const entry = await this.load(origin);
    // Whether a sign-in is needed is the server's call: one that accepts a plain connection gets no OAuth hunt.
    const plain = await this.connectOnce(url, null);
    if (!plain.error) {
      entry.expired = false;
      this.changed();
      return { ok: true, anonymous: true };
    }
    if (isNetworkError(plain.error)) return { ok: false, error: mcpUnreachableError(new URL(url).host) };
    let redirect: LoopbackRedirect;
    try {
      redirect = await startLoopbackRedirect({
        timeoutMs: this.deps.loginTimeoutMs ?? LOGIN_TIMEOUT_MS,
        language: this.deps.language,
        preferredPort: registeredLoopbackPort(entry.client),
      });
    } catch {
      return { ok: false, error: SIGN_IN_FAILED };
    }
    this.pending.set(origin, redirect);
    this.changed();
    const provider = new McpOAuthProvider(url, this, { interactive: true, redirect, openExternal: this.deps.openExternal });
    try {
      const first = await this.connectOnce(url, provider);
      if (first.error) {
        if (!provider.redirected) throw first.error;
        const code = await redirect.code;
        await first.transport.finishAuth(code);
        const second = await this.connectOnce(url, provider);
        if (second.error) throw second.error;
      }
      entry.expired = false;
      if (this.pending.get(origin) === redirect) this.pending.delete(origin);
      const status = await this.status(url);
      return { ok: true, ...(status.expiresAt !== undefined ? { expiresAt: status.expiresAt } : {}) };
    } catch (error) {
      // The fixed sentence reaches the person; the cause goes to the log for "Copy diagnostics", without secrets.
      const cause = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.warn(`[MCP OAuth] sign-in did not finish: ${redactSecrets(cause).slice(0, 300)}`);
      return { ok: false, error: loginError(error) };
    } finally {
      redirect.close();
      if (this.pending.get(origin) === redirect) this.pending.delete(origin);
      this.changed();
    }
  }

  /** Forgets tokens and the client registration for the URL's origin, in memory and in secret_records. */
  async logout(url: string): Promise<McpOAuthStatus> {
    let origin: string;
    try {
      origin = originOf(url);
    } catch {
      return { state: 'none', persisted: false };
    }
    await this.load(origin);
    this.pending.get(origin)?.cancel();
    await this.clearTokens(origin);
    await this.clearClient(origin);
    this.entry(origin).expired = false;
    this.changed();
    return this.status(url);
  }

  /**
   * Forgets every sign-in this process holds, for every address, and cancels one in progress. The stored rows are
   * removed by the caller (settings/forgetAll.ts deletes every secret record).
   */
  signedInOrigins(): string[] {
    return [...this.entries.entries()].filter(([, entry]) => entry.tokens).map(([origin]) => origin);
  }

  forgetAll(): void {
    for (const redirect of this.pending.values()) redirect.cancel();
    this.pending.clear();
    this.entries.clear();
    this.loading.clear();
    this.changed();
  }

  /** One connect attempt; with `provider` null the connection carries no credentials at all. */
  private async connectOnce(url: string, provider: McpOAuthProvider | null): Promise<{ transport: StreamableHTTPClientTransport; error: unknown }> {
    const transport = new StreamableHTTPClientTransport(new URL(url), provider ? { authProvider: provider } : undefined);
    const client = new Client(mcpClientInfo());
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(SIGN_IN_FAILED)), this.deps.connectTimeoutMs ?? CONNECT_TIMEOUT_MS);
    });
    try {
      await Promise.race([client.connect(transport), timeout]);
      return { transport, error: null };
    } catch (error) {
      return { transport, error: error ?? new Error(SIGN_IN_FAILED) };
    } finally {
      clearTimeout(timer);
      await client.close().catch(() => undefined);
    }
  }
}

/** Fixed sentences only: SDK errors can carry URLs and server text. */
function loginError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  for (const known of [SIGN_IN_TIMEOUT, SIGN_IN_DENIED, SIGN_IN_CANCELLED, SIGN_IN_BROWSER]) {
    if (message === known) return known;
  }
  return SIGN_IN_FAILED;
}

// ---------------------------------------------------------------------------------------------------------------
// App-wide instance (configured by setupIPC with Electron's safeStorage and shell)
// ---------------------------------------------------------------------------------------------------------------

let manager: McpOAuthManager | null = null;

export function configureMcpOAuth(deps: McpOAuthDeps): McpOAuthManager {
  manager = new McpOAuthManager(deps);
  return manager;
}

export function mcpOAuth(): McpOAuthManager | null {
  return manager;
}

export async function loginToMcp(url: string): Promise<McpOAuthLoginResult> {
  if (!manager) return { ok: false, error: SIGN_IN_FAILED };
  return manager.login(url);
}

export async function logoutFromMcp(url: string): Promise<McpOAuthStatus> {
  if (!manager) return { state: 'none', persisted: false };
  return manager.logout(url);
}

export async function oauthStatus(url: string): Promise<McpOAuthStatus> {
  if (!manager || !url) return { state: 'none', persisted: false };
  return manager.status(url);
}
