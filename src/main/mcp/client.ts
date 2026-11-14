import type Database from 'better-sqlite3';
import { Client, StreamableHTTPClientTransport, type OAuthClientProvider } from '@modelcontextprotocol/client';
import type { McpSession, McpToolCallResult } from '../../shared/mcp/catalogSource';
import {
  comfyUrlFromStudioInfo,
  McpPageError,
  parseLocalModelsMarkdown,
  readNodeClassesPaged,
  toolPayload,
} from '../../shared/mcp/catalogSource';
import {
  acceptCatalogSource,
  bumpCatalogRevision,
  catalogSourceKey,
  normalizedMcpEndpoint,
  sourceWithInstallation,
  removeStaleModelFilesIn,
  inferModelsFromNames,
  removeStaleModelFiles,
  removeStaleNodeClasses,
  replaceNodePacks,
  upsertModelFiles,
  upsertNodeClasses,
  upsertObjectInfo,
} from '../catalog/repository';
import { identityFromStudioInfo, readModelFilesWithRoots, readNodePacks, type ServerIdentity } from './inventory';
import { McpRefusedError, readOnlySession } from './readOnly';
import { parseObjectInfo } from '../../shared/catalog/objectInfo';
import { acceptedComfyUrl, applyComfyRead, isLoopbackHost } from '../comfy/read';
import { readSettings } from '../settings/repository';
import { comfyAddress, collectComfyDirect, type DirectReadSuccess } from '../comfy/direct';
import { readProfileModels, recognizeProfile, type McpProfile } from './profiles';
import { redactSecrets } from '../../shared/config/draft';
import { MCP_CALL_TIMEOUT_MS, MCP_CONNECT_TIMEOUT_MS } from '../../shared/config/preferences';
import { hasScheme, isPlausibleHost } from '../../shared/mcp/loopback';
import { cappedFetch, MCP_RESPONSE_MAX_BYTES } from '../net/capped';
import { APP_ID } from '../identity';

/** The handshake (initialize and the tool list). Generous: a ComfyUI that is generating answers slowly. */
export const CONNECT_TIMEOUT_MS = MCP_CONNECT_TIMEOUT_MS;

/** How the app introduces itself to an MCP server. Main sets the real version at start (setMcpClientVersion). */
let clientVersion = '0.0.0';

export function setMcpClientVersion(version: string): void {
  if (/^[0-9A-Za-z.+-]{1,40}$/.test(version)) clientVersion = version;
}

export function mcpClientInfo(): { name: string; version: string } {
  return { name: APP_ID, version: clientVersion };
}
/** One tool call may take this long; a stalled server must not hold a sync open forever. */
export const CALL_TIMEOUT_MS = MCP_CALL_TIMEOUT_MS;

export const MCP_HTTPS_ERROR = 'MCP server URL must use https unless it is on this machine.';

/*
 * What can be wrong with an MCP address, as a closed set of fixed English sentences (the codes). The renderer
 * translates each one (shared/i18n ERROR_KEYS and patterns); nothing else about the address is ever shown.
 */
/** Another computer's address typed without http:// or https:// (one on this computer is completed instead). */
export const MCP_URL_NO_SCHEME = 'MCP server URL has no http:// or https:// in front.';
/** A scheme that is not http or https, usually a typo such as `htp://`. */
export const MCP_URL_PROTOCOL = 'MCP server URL must start with http:// or https://.';
/** Text that is not an address at all. */
export const MCP_URL_NOT_ADDRESS = 'MCP server URL is not an address.';
/** A user name or password inside the address. */
export const MCP_URL_CREDENTIALS = 'MCP server URL must not carry a user name or password.';
/** A host that cannot be an address (`127.0.0.l`). */
export const mcpUrlBadHost = (host: string) => `MCP server URL host is not a valid address: ${host}.`;
/** The name does not resolve to any computer. */
export const mcpHostNotFound = (host: string) => `MCP server host was not found: ${host}.`;
/** Something answers at the origin, but the path gives 404. */
export const MCP_NO_SERVER_AT_PATH = 'The address answers, but there is no MCP server at this path.';
/** The address is ComfyUI's own (it answers /system_stats). */
export const MCP_IS_COMFYUI = 'This is the address of ComfyUI itself, not of its MCP server.';
/** Something answers, but not the MCP protocol (a web page, plain text, another service). */
export const MCP_NOT_MCP = 'The address answers, but not as an MCP server.';
/** No answer within the limit: the server may be busy, it is not called unreachable. */
export const mcpTooSlow = (seconds: number) => `MCP server answered too slowly: nothing came within ${seconds} s.`;

/** The handshake did not finish in time. Told apart from a refused connection (see explainConnectFailure). */
export class McpTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super('MCP connect timed out');
    this.name = 'McpTimeoutError';
  }
}

/**
 * The bearer token rides on every MCP request, so a URL off this machine must be https. Callers pass the address
 * after withLoopbackScheme. Returns the fixed error text, or null when the URL may be used.
 */
export function mcpUrlError(value: string): string | null {
  const text = value.trim();
  if (!text) return 'MCP server URL is empty.';
  if (!hasScheme(text)) {
    // `192.168.1.5:9000/mcp` or `comfy.local/mcp`: an address without its scheme; anything else is not an address.
    return /^[a-z0-9.[\]-]+(?::\d{1,5})?(?:\/\S*)?$/i.test(text) && /[.:]/.test(text) ? MCP_URL_NO_SCHEME : MCP_URL_NOT_ADDRESS;
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return MCP_URL_NOT_ADDRESS;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return MCP_URL_PROTOCOL;
  if (url.username || url.password) return MCP_URL_CREDENTIALS;
  // The host as typed: the URL parser silently turns `192.168.1` into 192.168.0.1, which is never what was meant.
  const typedHost = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?(\[[^\]]*\]|[^:/?#]*)/i.exec(text)?.[1] ?? url.hostname;
  if (!isPlausibleHost(typedHost)) return mcpUrlBadHost(typedHost);
  if (url.protocol === 'https:') return null;
  if (isLoopbackHost(url.hostname)) return null;
  return MCP_HTTPS_ERROR;
}

export type SkippedPart = 'nodeClasses' | 'nodePacks' | 'modelFiles' | 'nodeDetailsMcp' | 'nodeDetailsNative';

export interface McpReadSuccess {
  ok: true;
  /** Tool names the server listed. Shown to the user, not acted on. */
  tools: number;
  nodes: number;
  /** Node packs the server listed; 0 when it lists none. */
  packs: number;
  models: number;
  /** Where the full object_info came from: this MCP connection, the native URL the server named, or nowhere. */
  objectInfo: 'mcp' | 'native' | 'none';
  comfyUrl: string | null;
  /**
   * What was not available on this server, as codes (never shown as they are; the sync turns what matters into
   * translated warnings): nodeClasses, nodePacks, modelFiles, nodeDetailsMcp (comfy_api), nodeDetailsNative.
   */
  skipped: SkippedPart[];
  /** Listings whose pages failed, so they were not updated: 'node classes', 'node packs', 'model files'. */
  failedSections?: string[];
  /** Model folders (loras, checkpoints …) whose listing failed while the others were read; their old list stays. */
  failedFolders?: string[];
  /** The native object_info read: done, ComfyUI did not answer, the URL was not allowed, or not needed/possible. */
  nativeComfy?: 'ok' | 'unreachable' | 'notAllowed' | 'notTried';
}

export interface McpReadFailure {
  ok: false;
  error: string;
}

/**
 * Opens a session. Auth source: a manual bearer `token`, or else an OAuth `authProvider` (the SDK then adds the
 * bearer, refreshes on 401, and never follows a redirect to another origin).
 */
export type McpSessionFactory = (url: string, token: string | null, authProvider?: OAuthClientProvider | null) => Promise<McpSession>;

/** Sync error when the stored OAuth sign-in no longer works. Same sentence as oauth.ts SIGN_IN_AGAIN. */
export const MCP_SIGN_IN_AGAIN = 'MCP sign-in has expired. Sign in through the browser again.';
/** The server answered 401 to a connection that carried no credentials: it wants a browser sign-in or a token. */
export const MCP_NEEDS_SIGN_IN = 'MCP server requires sign-in.';
export const mcpUnreachableError = (host: string) => `MCP server unreachable: ${host}.`;

const NETWORK_CODE = /^(ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|EHOSTUNREACH|ENETUNREACH|EPIPE|UND_ERR_[A-Z_]+)$/;
const NETWORK_MESSAGE = /fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|EHOSTUNREACH|ENETUNREACH|socket hang up|network|^timeout$/i;

/** True when an error (or one of its causes) says the server could not be reached at all. */
export function isNetworkError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === 'object'; depth += 1) {
    const { code, message, cause } = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (typeof code === 'string' && NETWORK_CODE.test(code)) return true;
    if (typeof message === 'string' && NETWORK_MESSAGE.test(message)) return true;
    current = cause;
  }
  return false;
}

/** Connects over Streamable HTTP. A token is sent as a bearer header and is never logged. */
export const connectStreamableHttp: McpSessionFactory = async (url, token, authProvider) => {
  // Every answer is capped as it arrives: a broken or hostile server cannot fill memory with one reply.
  const fetch = cappedFetch(MCP_RESPONSE_MAX_BYTES);
  const transport = new StreamableHTTPClientTransport(new URL(url), token
    ? { requestInit: { headers: { Authorization: `Bearer ${token}` } }, fetch }
    : authProvider ? { authProvider, fetch } : { fetch });
  const client = new Client(mcpClientInfo());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new McpTimeoutError(CONNECT_TIMEOUT_MS)), CONNECT_TIMEOUT_MS);
  });
  try {
    await Promise.race([client.connect(transport), timeout]);
  } catch (error) {
    // A connect that lost the race may still finish later; close it so no transport is left open.
    await client.close().catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(timer);
  }
  return {
    async listTools() {
      const result = await client.listTools(undefined, { timeout: CALL_TIMEOUT_MS });
      return result.tools.map((tool) => ({ name: tool.name, inputSchema: tool.inputSchema }));
    },
    async callTool(name, args, options) {
      return (await client.callTool({ name, arguments: args }, { timeout: options?.timeoutMs ?? CALL_TIMEOUT_MS })) as McpToolCallResult;
    },
    async close() {
      await client.close();
    },
  };
};

/**
 * Fixed messages only: a transport error text could echo request headers. A 401 means "refused the token" when
 * credentials were sent and "requires sign-in" when none were: the server, not the app, decides whether it wants any.
 */
export function failure(error: unknown, options: { authenticated?: boolean } = {}): McpReadFailure {
  if (error instanceof McpRefusedError || error instanceof McpPageError) return { ok: false, error: redactSecrets(error.message) };
  if (isUnauthorized(error)) {
    return { ok: false, error: options.authenticated === false ? MCP_NEEDS_SIGN_IN : 'MCP server refused the token.' };
  }
  return { ok: false, error: 'MCP server was not read.' };
}

/** A 401 from the server: the SDK's HTTP error carries the status; older shapes only say so in the text. */
export function isUnauthorized(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { status, statusCode, name, message } = error as { status?: unknown; statusCode?: unknown; name?: unknown; message?: unknown };
  if (status === 401 || statusCode === 401) return true;
  return /\b401\b|unauthorized/i.test(`${typeof name === 'string' ? name : ''} ${typeof message === 'string' ? message : ''}`);
}

/**
 * The server answers, but lists none of the tools of a kind the app knows how to read (profiles.ts). Nothing is read
 * from it; with a ComfyUI address in Settings the sync reads everything from ComfyUI instead.
 */
export const MCP_UNKNOWN_SERVER = 'The MCP server answers, but the app does not know its tools, so nothing was read from it. Enter the ComfyUI address in Settings ▸ Connection: the app then reads everything from ComfyUI itself.';
/** A server that lists models only, and no ComfyUI address to read the nodes from. */
export const MCP_NODES_NEED_COMFY = 'Models were read through MCP, but not the nodes: this MCP server does not list them. Enter the ComfyUI address in Settings ▸ Connection to read the nodes from ComfyUI.';
/** A server that lists models only, and the ComfyUI address did not answer (its own sentence follows). */
export const MCP_NODES_COMFY_FAILED = 'Models were read through MCP, but not the nodes: ComfyUI did not answer at the address in Settings.';

/** What one catalog read learned beyond the counts the renderer sees. Stays in main. */
export interface CatalogReadDetail {
  result: McpReadSuccess;
  toolNames: Set<string>;
  identity: ServerIdentity;
  /** Which kind of server this was (profiles.ts). */
  profile: McpProfile;
  /** The ComfyUI address read for the nodes, when the server gives models only. */
  direct: DirectReadSuccess | null;
  /** Sentences about the ComfyUI part of the read (the MCP part's own come from catalogWarnings). */
  warnings: string[];
}

/** Where a catalog read may take what the server does not give. */
export interface CatalogReadContext {
  /** The MCP address: a ComfyUI address the server names on "this computer" is read only when the server is here too. */
  mcpUrl?: string;
  /** Settings ▸ Connection ▸ ComfyUI address ('' when not set). */
  comfyOrigin?: string;
  signal?: AbortSignal;
  isCurrent?: () => boolean;
  /** Synchronous provenance writes; called inside accepted publication. */
  publishState?: (detail: CatalogReadDetail) => void;
}

/**
 * Reads the ComfyUI inventory through one MCP connection and stores it in the catalog tables.
 * Order: list tools; node classes and packs from studio_capabilities; model files from models or list_local_models;
 * then the full object_info either from comfy_api or, when the server names its native URL, from that URL by GET.
 * Nothing is queued and nothing is written on the server.
 */
export async function readCatalogViaMcp(
  db: Database.Database,
  config: { url: string; token: string | null; authProvider?: OAuthClientProvider | null },
  fetchImpl: typeof fetch,
  factory: McpSessionFactory = connectStreamableHttp,
): Promise<McpReadSuccess | McpReadFailure> {
  const opened = await openReadOnlySession(config, factory);
  if (!opened.ok) return opened;
  try {
    const detail = await readCatalogWithSession(db, opened.session, fetchImpl, Date.now(), { mcpUrl: config.url });
    return 'ok' in detail ? detail : detail.result;
  } catch (error) {
    return failure(error);
  } finally {
    await opened.session.close().catch(() => undefined);
  }
}

/** Connects and wraps the session in the read-only allowlist. Every MCP call in the app goes through this. */
export async function openReadOnlySession(
  config: { url: string; token: string | null; authProvider?: OAuthClientProvider | null },
  factory: McpSessionFactory,
): Promise<{ ok: true; session: McpSession } | McpReadFailure> {
  const urlError = mcpUrlError(config.url);
  if (urlError) return { ok: false, error: urlError };
  // A manual token wins; the OAuth provider is used only without one.
  const authProvider = config.token ? null : config.authProvider ?? null;
  try {
    return { ok: true, session: readOnlySession(await factory(config.url, config.token, authProvider)) };
  } catch (error) {
    if (authProvider && (authProvider as { signInRequired?: boolean }).signInRequired) return { ok: false, error: MCP_SIGN_IN_AGAIN };
    return failure(error, { authenticated: config.token != null || authProvider != null });
  }
}

/** A paged listing, or null when one of its pages failed. Transport errors and refusals still throw. */
async function pagedOrNull<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof McpPageError) return null;
    throw error;
  }
}

function savedComfyOrigin(db: Database.Database): string | null {
  try {
    const read = readSettings(db);
    return read.source === 'corrupt' ? null : read.values.comfyOrigin || null;
  } catch {
    return null;
  }
}

/** The catalog part of a read on an already open, read-only session. Throws on transport errors. */
export async function readCatalogWithSession(
  db: Database.Database,
  session: McpSession,
  fetchImpl: typeof fetch,
  now: number,
  context: CatalogReadContext = {},
): Promise<CatalogReadDetail | McpReadFailure> {
  const checkCurrent = () => {
    if (context.signal?.aborted || context.isCurrent?.() === false) throw new Error('Catalog collection cancelled');
  };
  // Check each awaited MCP page too: a fake/remote session may still resolve after close().
  const connected = session;
  session = {
    listTools: async () => { checkCurrent(); const result = await connected.listTools(); checkCurrent(); return result; },
    callTool: async (name, args) => { checkCurrent(); const result = await connected.callTool(name, args); checkCurrent(); return result; },
    close: () => connected.close(),
  };
  const skipped: SkippedPart[] = [];
  const failedSections: string[] = [];
  const failedFolders: string[] = [];
  const listed = await session.listTools();
  const tools = new Set(listed.map((tool) => tool.name));
  if (tools.size === 0) return { ok: false, error: 'MCP server lists no tools.' };
  const profile = recognizeProfile(listed);
  if (profile === null) return { ok: false, error: MCP_UNKNOWN_SERVER };
  const comfyOrigin = context.comfyOrigin ?? savedComfyOrigin(db) ?? '';
  const checkedComfy = comfyAddress(comfyOrigin);
  const capturedComfyOrigin = checkedComfy.ok ? checkedComfy.origin.origin : null;
  const writes: Array<() => void> = [];
  let identity: ServerIdentity = { installationId: null, comfyuiUrl: null };
  let comfyUrl: string | null = null;
  if (tools.has('studio_info')) {
    const payload = toolPayload(await session.callTool('studio_info', { action: 'describe' }));
    comfyUrl = comfyUrlFromStudioInfo(payload);
    identity = { ...identityFromStudioInfo(payload), comfyuiUrl: comfyUrl };
  }
  const endpoint = context.mcpUrl ? normalizedMcpEndpoint(context.mcpUrl) : '';
  const publish = (detail: CatalogReadDetail, actualComfyOrigin: string | null) => {
    checkCurrent();
    const parts = ['mcp', endpoint, ...(actualComfyOrigin ? [actualComfyOrigin] : [])];
    const sourceKey = sourceWithInstallation(db, parts, identity.installationId);
    db.transaction(() => {
      checkCurrent();
      // A caller without a captured endpoint cannot establish a new source identity.
      if (endpoint) acceptCatalogSource(db, sourceKey);
      for (const write of writes) write();
      inferModelsFromNames(db);
      if (endpoint) {
        const state = db.prepare('INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
        state.run('catalog_source_connection', catalogSourceKey(parts));
        if (identity.installationId) state.run('catalog_source_installation', identity.installationId);
      }
      bumpCatalogRevision(db);
      context.publishState?.(detail);
    }).immediate();
  };

  if (profile !== 'catalog') {
    // Models from the server; node classes and packs from the ComfyUI address in Settings.
    const listedModels = await readProfileModels(profile, session);
    if (listedModels.models !== null) writes.push(() => {
      upsertModelFiles(db, listedModels.files, now);
      if (!listedModels.partial) {
        if (listedModels.directories) removeStaleModelFilesIn(db, now, listedModels.directories);
        else removeStaleModelFiles(db, now);
      }
    });
    if (listedModels.models === null) {
      skipped.push('modelFiles');
      failedSections.push('model files');
    }
    const warnings: string[] = [];
    let direct: DirectReadSuccess | null = null;
    if (comfyOrigin) {
      const read = await collectComfyDirect(comfyOrigin, fetchImpl, { models: false, signal: context.signal, cancelled: () => context.isCurrent?.() === false });
      if (read.ok) {
        const { parsed: _parsed, files: _files, packRows: _packs, ...result } = read;
        direct = result;
        writes.push(() => {
          upsertObjectInfo(db, read.parsed, now);
          removeStaleNodeClasses(db, now);
          replaceNodePacks(db, read.packRows, now, true);
        });
      }
      else warnings.push(MCP_NODES_COMFY_FAILED, read.error);
    } else {
      warnings.push(MCP_NODES_NEED_COMFY);
    }
    if (!direct) skipped.push('nodeClasses', 'nodePacks');
    const detail: CatalogReadDetail = {
      result: {
        ok: true,
        tools: tools.size,
        nodes: direct?.nodes ?? 0,
        packs: direct?.packs ?? 0,
        models: listedModels.models ?? 0,
        objectInfo: direct ? 'native' : 'none',
        comfyUrl: direct?.origin ?? null,
        skipped,
        failedSections,
        failedFolders,
        nativeComfy: direct ? 'ok' : comfyOrigin ? 'unreachable' : 'notTried',
      },
      toolNames: tools,
      identity: { installationId: null, comfyuiUrl: null },
      profile,
      direct,
      warnings,
    };
    publish(detail, direct?.origin ?? capturedComfyOrigin);
    return detail;
  }

  // Rows this run stores carry `now`; after a complete listing, older synced rows are gone from the server.
  let nodes = 0;
  let packs = 0;
  if (tools.has('studio_capabilities')) {
    const classes = await pagedOrNull(() => readNodeClassesPaged(session));
    if (classes) {
      nodes = classes.items.length;
      writes.push(() => {
        upsertNodeClasses(db, classes.items, now);
        if (classes.complete) removeStaleNodeClasses(db, now);
      });
    } else {
      skipped.push('nodeClasses');
      failedSections.push('node classes');
    }
    const packList = await pagedOrNull(() => readNodePacks(session));
    if (packList) {
      packs = packList.items.length;
      writes.push(() => { replaceNodePacks(db, packList.items, now, packList.complete); });
    }
    else {
      skipped.push('nodePacks');
      failedSections.push('node packs');
    }
  } else {
    skipped.push('nodeClasses');
  }

  let models = 0;
  if (tools.has('models')) {
    const listed = await pagedOrNull(() => readModelFilesWithRoots(session));
    if (listed) {
      models = listed.items.length;
      writes.push(() => {
        upsertModelFiles(db, listed.items, now);
        if (listed.complete) removeStaleModelFiles(db, now);
      });
      failedFolders.push(...listed.failedFolders);
    } else {
      skipped.push('modelFiles');
      failedSections.push('model files');
    }
  } else if (tools.has('list_local_models')) {
    const result = await session.callTool('list_local_models', { action: 'list' });
    const payload = toolPayload(result);
    if (!result.isError && typeof payload === 'string' && /^## /m.test(payload)) {
      const files = parseLocalModelsMarkdown(payload);
      models = files.length;
      writes.push(() => {
        upsertModelFiles(db, files, now);
        if (!/Partial listing/i.test(payload)) removeStaleModelFiles(db, now);
      });
    } else {
      skipped.push('modelFiles');
    }
  } else {
    skipped.push('modelFiles');
  }

  let objectInfo: McpReadSuccess['objectInfo'] = 'none';
  if (tools.has('comfy_api')) {
    const payload = toolPayload(await session.callTool('comfy_api', { method: 'GET', route: '/object_info' }));
    const read = payload && typeof payload === 'object' && !('error' in (payload as object)) ? payload : null;
    if (read) {
      try {
        const parsed = parseObjectInfo(read);
        writes.push(() => { upsertObjectInfo(db, parsed, now); });
        objectInfo = 'mcp';
      } catch {
        skipped.push('nodeDetailsMcp');
      }
    } else {
      skipped.push('nodeDetailsMcp');
    }
  }
  let actualComfyOrigin: string | null = null;
  let nativeComfy: NonNullable<McpReadSuccess['nativeComfy']> = 'notTried';
  if (objectInfo === 'none' && (comfyUrl || comfyOrigin)) {
    // The address the server named, when it is the saved one or both are on this computer; else the saved one.
    // The server must not steer reads elsewhere.
    const nativeUrl = (comfyUrl ? acceptedComfyUrl(comfyUrl, comfyOrigin, context.mcpUrl) : null) ?? (comfyOrigin || null);
    const checkedNative = comfyAddress(nativeUrl ?? '');
    actualComfyOrigin = checkedNative.ok ? checkedNative.origin.origin : null;
    const native = nativeUrl ? await applyComfyRead(db, nativeUrl, fetchImpl, { signal: context.signal, collect: (parsed) => { writes.push(() => { upsertObjectInfo(db, parsed, now); }); } }) : null;
    if (native?.ok) { objectInfo = 'native'; actualComfyOrigin = new URL(nativeUrl!).origin; }
    else skipped.push('nodeDetailsNative');
    nativeComfy = native?.ok ? 'ok' : nativeUrl ? 'unreachable' : 'notAllowed';
  }
  const detail: CatalogReadDetail = {
    result: { ok: true, tools: tools.size, nodes, packs, models, objectInfo, comfyUrl, skipped, failedSections, failedFolders, nativeComfy },
    toolNames: tools,
    identity,
    profile,
    direct: null,
    warnings: [],
  };
  publish(detail, actualComfyOrigin);
  return detail;
}
