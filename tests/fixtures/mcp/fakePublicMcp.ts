/**
 * MCP servers of other kinds than the catalog one, speaking Streamable HTTP with JSON answers, as the public servers
 * list their tools (names and input schemas copied in shape from their sources):
 * - 'modelList': artokun/comfyui-mcp 0.52 (`list_local_models` with an `action` enum; markdown answer).
 * - 'checkpointList': joenorton/comfyui-mcp-server (`list_models` with no arguments; `{models, count, default}`).
 * - 'foreign': a server about something else entirely.
 * Each also lists tools that act (queue, download, install); the app must never call them. Labelled fixture.
 * Used by the comfyDirect and mcpProfiles integration tests and mcp-profiles.test.ts (e2e), which check that the
 * app recognizes such a server, reads its model list and calls nothing else.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export type PublicKind = 'modelList' | 'checkpointList' | 'foreign';

/** One request the fake received: the JSON-RPC method and, for tools/call, the tool and its arguments. */
export interface PublicMcpCall {
  method: string;
  tool?: string;
  args?: Record<string, unknown>;
}

export interface PublicMcp {
  url: string;
  calls: PublicMcpCall[];
  close: () => Promise<void>;
}

// A JSON schema for an object with the given properties, the shape MCP tool inputs use.
const obj = (properties: Record<string, unknown> = {}, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });

const TOOLS: Record<PublicKind, Array<{ name: string; inputSchema: Record<string, unknown> }>> = {
  modelList: [
    { name: 'list_local_models', inputSchema: obj({ action: { type: 'string', enum: ['list', 'remove', 'embeddings', 'list_paths', 'add_path', 'remove_path'] }, model_type: { type: 'string' } }, ['action']) },
    { name: 'get_system_stats', inputSchema: obj() },
    { name: 'get_node_info', inputSchema: obj({ node_type: { type: 'string' } }) },
    { name: 'model_metadata', inputSchema: obj({ action: { type: 'string', enum: ['read', 'propose', 'fetch_civitai'] }, category: { type: 'string' }, name: { type: 'string' } }, ['action']) },
    { name: 'enqueue_workflow', inputSchema: obj({ workflow: { type: 'object' } }, ['workflow']) },
    { name: 'download_model', inputSchema: obj({ action: { type: 'string' }, url: { type: 'string' } }, ['action']) },
    { name: 'install_custom_node', inputSchema: obj({ id: { type: 'string' } }, ['id']) },
    { name: 'clear_vram', inputSchema: obj() },
  ],
  checkpointList: [
    { name: 'list_models', inputSchema: obj() },
    { name: 'get_defaults', inputSchema: obj() },
    { name: 'set_defaults', inputSchema: obj({ image: { type: 'object' }, persist: { type: 'boolean' } }) },
    { name: 'list_workflows', inputSchema: obj() },
    { name: 'run_workflow', inputSchema: obj({ workflow_id: { type: 'string' } }, ['workflow_id']) },
    { name: 'generate_image', inputSchema: obj({ prompt: { type: 'string' } }, ['prompt']) },
    { name: 'cancel_job', inputSchema: obj({ prompt_id: { type: 'string' } }, ['prompt_id']) },
  ],
  foreign: [
    { name: 'search_web', inputSchema: obj({ query: { type: 'string' } }, ['query']) },
    { name: 'read_page', inputSchema: obj({ url: { type: 'string' } }, ['url']) },
  ],
};

/** The tools of each kind that only read; the app calls at most these. */
export const PUBLIC_READ_TOOLS: Record<PublicKind, string[]> = {
  modelList: ['list_local_models'],
  checkpointList: ['list_models'],
  foreign: [],
};

/** What `list_local_models` action "list" answers: markdown by folder, sizes when it read its disk. */
export const MODEL_LIST_MARKDOWN = [
  '## checkpoints (2)',
  '- sd_xl_base_1.0.safetensors (6616.6 MB) — modified 2026-03-01T10:00:00.000Z',
  '- juggernautXL_v9.safetensors',
  '',
  '## loras (2)',
  '- add-detail-xl.safetensors (217.8 MB) — modified 2026-04-01T10:00:00.000Z',
  '    trigger words: detailed  ·  base: SDXL 1.0',
  '    civitai: https://civitai.com/models/1?modelVersionId=2',
  '- pixel-art-xl.safetensors (162.1 MB) — modified 2026-04-02T10:00:00.000Z',
  '',
].join('\n');

/** What `list_models` of the checkpointList kind answers; its `default` is the last entry. */
export const CHECKPOINT_LIST = ['sd_xl_base_1.0.safetensors', 'juggernautXL_v9.safetensors', 'v1-5-pruned-emaonly.ckpt'];

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** The answer to one tool call: only the read tool of each kind answers, every other call gets an MCP error. */
function answer(kind: PublicKind, tool: string, args: Record<string, unknown>): unknown {
  const text = (value: unknown, isError = false) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }], isError });
  if (kind === 'modelList' && tool === 'list_local_models' && args.action === 'list') return text(MODEL_LIST_MARKDOWN);
  if (kind === 'checkpointList' && tool === 'list_models') {
    const value = { models: CHECKPOINT_LIST, count: CHECKPOINT_LIST.length, default: 'v1-5-pruned-emaonly.ckpt' };
    return { ...text(value), structuredContent: value };
  }
  return text(`The fixture does not answer ${tool}.`, true);
}

/**
 * Starts a fake of the given kind on a free 127.0.0.1 port at /mcp. Sessions are checked like a real Streamable
 * HTTP server: every request after initialize must carry the session id, or it gets 404.
 */
export async function startPublicMcp(kind: PublicKind): Promise<PublicMcp> {
  const calls: PublicMcpCall[] = [];
  const sessions = new Set<string>();
  let counter = 0;
  const server = http.createServer(async (req, res) => {
    if ((req.url ?? '').split('?')[0] !== '/mcp') {
      res.writeHead(404);
      res.end();
      return;
    }
    if (req.method === 'GET') {
      res.writeHead(405, { allow: 'POST, DELETE' });
      res.end();
      return;
    }
    if (req.method === 'DELETE') {
      res.writeHead(200);
      res.end();
      return;
    }
    let message: { id?: string | number; method?: string; params?: Record<string, unknown> };
    try {
      message = JSON.parse(await readBody(req));
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    const method = message.method ?? '';
    const params = message.params ?? {};
    const call: PublicMcpCall = { method };
    if (method === 'tools/call') {
      call.tool = String(params.name);
      call.args = (params.arguments as Record<string, unknown>) ?? {};
    }
    calls.push(call);
    // A message without an id is a notification: accepted, never answered.
    if (message.id === undefined) {
      res.writeHead(202);
      res.end();
      return;
    }
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    let result: unknown;
    if (method === 'initialize') {
      const id = `public-${++counter}`;
      sessions.add(id);
      headers['mcp-session-id'] = id;
      result = { protocolVersion: String(params.protocolVersion ?? '2025-06-18'), capabilities: { tools: { listChanged: false } }, serverInfo: { name: `fixture-${kind}`, version: '0.0.1' } };
    } else {
      const id = req.headers['mcp-session-id'];
      if (typeof id !== 'string' || !sessions.has(id)) {
        res.writeHead(404, headers);
        res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32001, message: 'Session not found' } }));
        return;
      }
      if (method === 'tools/list') result = { tools: TOOLS[kind].map((tool) => ({ ...tool, description: `Fixture ${tool.name}` })) };
      else if (method === 'tools/call') result = answer(kind, call.tool ?? '', call.args ?? {});
      else if (method === 'ping') result = {};
      else {
        res.writeHead(200, headers);
        res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } }));
        return;
      }
    }
    res.writeHead(200, headers);
    res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    calls,
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    }),
  };
}
