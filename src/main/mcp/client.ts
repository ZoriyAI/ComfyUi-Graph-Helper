import type Database from 'better-sqlite3';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import type { McpSession, McpToolCallResult } from '../../shared/mcp/catalogSource';
import {
  comfyUrlFromStudioInfo,
  parseLocalModelsMarkdown,
  readModelFiles,
  readNodeClasses,
  toolPayload,
  type McpModelFile,
} from '../../shared/mcp/catalogSource';
import { upsertModelFiles, upsertNodeClasses, upsertObjectInfo } from '../catalog/repository';
import { parseObjectInfo } from '../../shared/catalog/objectInfo';
import { applyComfyRead } from '../comfy/read';

const CONNECT_TIMEOUT_MS = 15000;

export interface McpReadSuccess {
  ok: true;
  /** Tool names the server listed. Shown to the user, not acted on. */
  tools: number;
  nodes: number;
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
  const timer = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), CONNECT_TIMEOUT_MS));
  await Promise.race([client.connect(transport), timer]);
  return {
    async listTools() {
      const result = await client.listTools();
      return result.tools.map((tool) => ({ name: tool.name }));
    },
    async callTool(name, args) {
      return (await client.callTool({ name, arguments: args })) as McpToolCallResult;
    },
    async close() {
      await client.close();
    },
  };
};

function failure(error: unknown): McpReadFailure {
  const message = error instanceof Error ? error.message : '';
  if (/401|unauthorized/i.test(message)) return { ok: false, error: 'MCP server refused the token.' };
  return { ok: false, error: 'MCP server was not read.' };
}

/**
 * Reads the ComfyUI inventory through one MCP connection and stores it in the catalog tables.
 * Order: list tools; node classes from studio_capabilities; model files from models or list_local_models;
 * then the full object_info either from comfy_api or, when the server names its native URL, from that URL by GET.
 * Nothing is queued and nothing is written on the server.
 */
export async function readCatalogViaMcp(
  db: Database.Database,
  config: { url: string; token: string | null },
  fetchImpl: typeof fetch,
  factory: McpSessionFactory = connectStreamableHttp,
): Promise<McpReadSuccess | McpReadFailure> {
  if (!config.url) return { ok: false, error: 'MCP server URL is empty.' };
  let session: McpSession;
  try {
    session = await factory(config.url, config.token);
  } catch (error) {
    return failure(error);
  }
  const skipped: string[] = [];
  try {
    const tools = new Set((await session.listTools()).map((tool) => tool.name));
    if (tools.size === 0) return { ok: false, error: 'MCP server lists no tools.' };

    let nodes = 0;
    if (tools.has('studio_capabilities')) {
      const classes = await readNodeClasses(session);
      nodes = upsertNodeClasses(db, classes);
    } else {
      skipped.push('node classes');
    }

    let files: McpModelFile[] = [];
    if (tools.has('models')) {
      files = await readModelFiles(session);
    } else if (tools.has('list_local_models')) {
      const payload = toolPayload(await session.callTool('list_local_models', { action: 'list' }));
      files = typeof payload === 'string' ? parseLocalModelsMarkdown(payload) : [];
    } else {
      skipped.push('model files');
    }
    const models = upsertModelFiles(db, files);

    let objectInfo: McpReadSuccess['objectInfo'] = 'none';
    let comfyUrl: string | null = null;
    if (tools.has('studio_info')) {
      comfyUrl = comfyUrlFromStudioInfo(toolPayload(await session.callTool('studio_info', { action: 'describe' })));
    }
    if (tools.has('comfy_api')) {
      const payload = toolPayload(await session.callTool('comfy_api', { method: 'GET', route: '/object_info' }));
      const read = payload && typeof payload === 'object' && !('error' in (payload as object)) ? payload : null;
      if (read) {
        try {
          upsertObjectInfo(db, parseObjectInfo(read));
          objectInfo = 'mcp';
        } catch {
          skipped.push('object_info through comfy_api');
        }
      } else {
        skipped.push('object_info through comfy_api');
      }
    }
    if (objectInfo === 'none' && comfyUrl) {
      const native = await applyComfyRead(db, comfyUrl, fetchImpl);
      if (native.ok) objectInfo = 'native';
      else skipped.push('object_info from the native URL');
    }
    return { ok: true, tools: tools.size, nodes, models, objectInfo, comfyUrl, skipped };
  } catch (error) {
    return failure(error);
  } finally {
    await session.close().catch(() => undefined);
  }
}
