import type Database from 'better-sqlite3';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import type { McpSession, McpToolCallResult } from '../../shared/mcp/catalogSource';
import {
  comfyUrlFromStudioInfo,
  McpPageError,
  parseLocalModelsMarkdown,
  readNodeClassesPaged,
  toolPayload,
} from '../../shared/mcp/catalogSource';
import {
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

const CONNECT_TIMEOUT_MS = 15000;
/** One tool call may take this long; a stalled server must not hold a sync open forever. */
export const CALL_TIMEOUT_MS = 30_000;

export const MCP_HTTPS_ERROR = 'MCP server URL must use https unless it is on this machine.';

/**
 * The bearer token rides on every MCP request, so a URL off this machine must be https.
 * Returns the fixed error text, or null when the URL may be used.
 */
export function mcpUrlError(value: string): string | null {
  if (!value) return 'MCP server URL is empty.';
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'MCP server was not read.';
  }
  if (url.username || url.password) return 'MCP server was not read.';
  if (url.protocol === 'https:') return null;
  if (url.protocol === 'http:' && isLoopbackHost(url.hostname)) return null;
  return MCP_HTTPS_ERROR;
}

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
  /** Human-readable notes about what was not available on this server. */
  skipped: string[];
}

export interface McpReadFailure {
  ok: false;
  error: string;
}

export type McpSessionFactory = (url: string, token: string | null) => Promise<McpSession>;

/** Connects over Streamable HTTP. A token is sent as a bearer header and is never logged. */
export const connectStreamableHttp: McpSessionFactory = async (url, token) => {
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
  const client = new Client({ name: 'comfyui-graph-helper', version: '0.1.0' });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), CONNECT_TIMEOUT_MS);
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
      return result.tools.map((tool) => ({ name: tool.name }));
    },
    async callTool(name, args) {
      return (await client.callTool({ name, arguments: args }, { timeout: CALL_TIMEOUT_MS })) as McpToolCallResult;
    },
    async close() {
      await client.close();
    },
  };
};

/** Fixed messages only: a transport error text could echo request headers. */
export function failure(error: unknown): McpReadFailure {
  if (error instanceof McpRefusedError || error instanceof McpPageError) return { ok: false, error: error.message };
  const message = error instanceof Error ? error.message : '';
  if (/401|unauthorized/i.test(message)) return { ok: false, error: 'MCP server refused the token.' };
  return { ok: false, error: 'MCP server was not read.' };
}

/** What one catalog read learned beyond the counts the renderer sees. Stays in main. */
export interface CatalogReadDetail {
  result: McpReadSuccess;
  toolNames: Set<string>;
  identity: ServerIdentity;
}

/**
 * Reads the ComfyUI inventory through one MCP connection and stores it in the catalog tables.
 * Order: list tools; node classes and packs from studio_capabilities; model files from models or list_local_models;
 * then the full object_info either from comfy_api or, when the server names its native URL, from that URL by GET.
 * Nothing is queued and nothing is written on the server.
 */
export async function readCatalogViaMcp(
  db: Database.Database,
  config: { url: string; token: string | null },
  fetchImpl: typeof fetch,
  factory: McpSessionFactory = connectStreamableHttp,
): Promise<McpReadSuccess | McpReadFailure> {
  const opened = await openReadOnlySession(config, factory);
  if (!opened.ok) return opened;
  try {
    const detail = await readCatalogWithSession(db, opened.session, fetchImpl, Date.now());
    return 'ok' in detail ? detail : detail.result;
  } catch (error) {
    return failure(error);
  } finally {
    await opened.session.close().catch(() => undefined);
  }
}

/** Connects and wraps the session in the read-only allowlist. Every MCP call in the app goes through this. */
export async function openReadOnlySession(
  config: { url: string; token: string | null },
  factory: McpSessionFactory,
): Promise<{ ok: true; session: McpSession } | McpReadFailure> {
  const urlError = mcpUrlError(config.url);
  if (urlError) return { ok: false, error: urlError };
  try {
    return { ok: true, session: readOnlySession(await factory(config.url, config.token)) };
  } catch (error) {
    return failure(error);
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
): Promise<CatalogReadDetail | McpReadFailure> {
  const skipped: string[] = [];
  const tools = new Set((await session.listTools()).map((tool) => tool.name));
  if (tools.size === 0) return { ok: false, error: 'MCP server lists no tools.' };

  // Rows this run stores carry `now`; after a complete listing, older synced rows are gone from the server.
  let nodes = 0;
  let packs = 0;
  if (tools.has('studio_capabilities')) {
    const classes = await pagedOrNull(() => readNodeClassesPaged(session));
    if (classes) {
      nodes = upsertNodeClasses(db, classes.items, now);
      if (classes.complete) removeStaleNodeClasses(db, now);
    } else {
      skipped.push('node classes');
    }
    const packList = await pagedOrNull(() => readNodePacks(session));
    if (packList) packs = replaceNodePacks(db, packList.items, now, packList.complete);
    else skipped.push('node packs');
  } else {
    skipped.push('node classes');
  }

  let models = 0;
  if (tools.has('models')) {
    const listed = await pagedOrNull(() => readModelFilesWithRoots(session));
    if (listed) {
      models = upsertModelFiles(db, listed.items, now);
      if (listed.complete) removeStaleModelFiles(db, now);
    } else {
      skipped.push('model files');
    }
  } else if (tools.has('list_local_models')) {
    const result = await session.callTool('list_local_models', { action: 'list' });
    const payload = toolPayload(result);
    if (!result.isError && typeof payload === 'string') {
      models = upsertModelFiles(db, parseLocalModelsMarkdown(payload), now);
      removeStaleModelFiles(db, now);
    } else {
      skipped.push('model files');
    }
  } else {
    skipped.push('model files');
  }

  let objectInfo: McpReadSuccess['objectInfo'] = 'none';
  let comfyUrl: string | null = null;
  let identity: ServerIdentity = { installationId: null, comfyuiUrl: null };
  if (tools.has('studio_info')) {
    const payload = toolPayload(await session.callTool('studio_info', { action: 'describe' }));
    comfyUrl = comfyUrlFromStudioInfo(payload);
    identity = { ...identityFromStudioInfo(payload), comfyuiUrl: comfyUrl };
  }
  if (tools.has('comfy_api')) {
    const payload = toolPayload(await session.callTool('comfy_api', { method: 'GET', route: '/object_info' }));
    const read = payload && typeof payload === 'object' && !('error' in (payload as object)) ? payload : null;
    if (read) {
      try {
        upsertObjectInfo(db, parseObjectInfo(read), now);
        objectInfo = 'mcp';
      } catch {
        skipped.push('object_info through comfy_api');
      }
    } else {
      skipped.push('object_info through comfy_api');
    }
  }
  if (objectInfo === 'none' && comfyUrl) {
    // Only this machine or the origin the person saved: the server must not steer reads elsewhere.
    const nativeUrl = acceptedComfyUrl(comfyUrl, savedComfyOrigin(db));
    const native = nativeUrl ? await applyComfyRead(db, nativeUrl, fetchImpl) : null;
    if (native?.ok) objectInfo = 'native';
    else skipped.push('object_info from the native URL');
  }
  inferModelsFromNames(db);
  return {
    result: { ok: true, tools: tools.size, nodes, packs, models, objectInfo, comfyUrl, skipped },
    toolNames: tools,
    identity,
  };
}
