/**
 * Reading the node and model catalog through an MCP server (src/main/mcp/client, src/shared/mcp/catalogSource):
 * paging node classes and model files, dropping cache files, taking object_info through comfy_api or the
 * server-reported native ComfyUI URL, and refusing that URL when a remote server points at this machine.
 * Why: the catalog is what the tutor knows about the person's nodes and models; a wrong or unsafe read misleads it.
 */
import http from 'http';
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { readCatalog } from '../../src/main/catalog/repository';
import { readCatalogViaMcp } from '../../src/main/mcp/client';
import {
  comfyUrlFromStudioInfo,
  isModelFile,
  parseLocalModelsMarkdown,
  readModelFiles,
  readNodeClasses,
  type McpSession,
  type McpToolCallResult,
} from '../../src/shared/mcp/catalogSource';

/** Wraps a value the way an MCP tool answers: one text content block holding JSON. */
function json(value: unknown): McpToolCallResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

const OBJECT_INFO = {
  KSampler: {
    input: { required: { model: ['MODEL'], seed: ['INT', { default: 0, control_after_generate: true }] } },
    input_order: { required: ['model', 'seed'] },
    output: ['LATENT'],
    output_name: ['LATENT'],
    python_module: 'nodes', display_name: 'KSampler', category: 'sampling',
  },
  // The full registry names these classes even when their widget definitions cannot be parsed.
  LoraLoader: { input: null, output: [], python_module: 'nodes', display_name: 'Load LoRA', category: 'loaders' },
  CustomThing: { input: null, output: [], python_module: 'custom_nodes.example', display_name: 'Custom', category: 'x' },
};

/** A deterministic stand-in for the home ComfyUI MCP server. Labelled test fixture, not a discovered environment. */
function fakeSession(options: { comfyUrl: string | null; comfyApiWorks: boolean; calls: string[] }): McpSession {
  return {
    async listTools() {
      return ['studio_info', 'studio_capabilities', 'models', 'comfy_api', 'list_local_models'].map((name) => ({ name }));
    },
    async callTool(name, args) {
      options.calls.push(`${name}:${JSON.stringify(args)}`);
      if (name === 'studio_info') return json({ comfyui_url: options.comfyUrl ?? undefined });
      if (name === 'studio_capabilities') {
        const page = args.cursor === '2' ? 2 : 1;
        return json({
          items: page === 1
            ? [
              { class_type: 'KSampler', module: 'nodes', display_name: 'KSampler', category: 'sampling' },
              { class_type: 'LoraLoader', module: 'nodes', display_name: 'Load LoRA', category: 'loaders' },
            ]
            : [{ class_type: 'CustomThing', module: 'custom_nodes.example', display_name: 'Custom', category: 'x' }],
          next_cursor: page === 1 ? '2' : undefined,
          total: 3,
        });
      }
      if (name === 'models') {
        return json({
          items: [
            { category: 'loras' },
            { category: 'loras', filename: 'style.safetensors', size_bytes: 1024 },
            { category: 'loras', filename: '.cache/huggingface/x.lock', size_bytes: 0 },
            { category: 'checkpoints', filename: 'base.ckpt' },
          ],
          next_cursor: '',
          total: 4,
        });
      }
      if (name === 'comfy_api') {
        return options.comfyApiWorks ? json(OBJECT_INFO) : json({ state: 'outcome_unknown', error: { code: 'COMFY_API_BODY_CAPACITY' } });
      }
      throw new Error(`unexpected tool ${name}`);
    },
    async close() {},
  };
}

/** Starts a plain HTTP server on a free 127.0.0.1 port that plays the native ComfyUI API. */
function listen(handler: http.RequestListener): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('no port');
      resolve({ origin: `http://127.0.0.1:${address.port}`, close: () => new Promise((done) => server.close(() => done())) });
    });
  });
}

describe('MCP catalog source', () => {
  it('pages node classes and model files and filters cache entries', async () => {
    const calls: string[] = [];
    const session = fakeSession({ comfyUrl: null, comfyApiWorks: false, calls });
    const classes = await readNodeClasses(session, 2);
    expect(classes.map((item) => item.classType)).toEqual(['KSampler', 'LoraLoader', 'CustomThing']);
    const files = await readModelFiles(session);
    expect(files).toEqual([
      { directory: 'loras', name: 'style.safetensors', sizeBytes: 1024 },
      { directory: 'checkpoints', name: 'base.ckpt', sizeBytes: null },
    ]);
    expect(isModelFile('.hidden.safetensors')).toBe(false);
    expect(isModelFile('sub/dir/model.gguf')).toBe(true);
    expect(isModelFile('readme.txt')).toBe(false);
  });

  it('parses the list_local_models markdown and the studio_info native URL', () => {
    const files = parseLocalModelsMarkdown('## loras (2)\n- a.safetensors\n- notes.txt\n\n## vae (1)\n- v.pt\n');
    expect(files).toEqual([
      { directory: 'loras', name: 'a.safetensors', sizeBytes: null },
      { directory: 'vae', name: 'v.pt', sizeBytes: null },
    ]);
    expect(comfyUrlFromStudioInfo({ comfyui_url: 'http://127.0.0.1:18188' })).toBe('http://127.0.0.1:18188');
    expect(comfyUrlFromStudioInfo({ comfyui_url: 'http://user:pw@host' })).toBeNull();
    expect(comfyUrlFromStudioInfo({})).toBeNull();
  });

  it.each([false, true])('refuses a remote MCP redirect to a local native endpoint (MCP definitions available: %s)', async (comfyApiWorks) => {
    // A remote server must not steer the app into reading a port on this machine: zero requests may reach it.
    const db = new Database(':memory:');
    migrate(db);
    let requests = 0;
    const server = await listen((_req, res) => { requests += 1; res.end('{}'); });
    const result = await readCatalogViaMcp(db, { url: 'https://mcp.example.test/mcp', token: null }, globalThis.fetch,
      async () => fakeSession({ comfyUrl: server.origin, comfyApiWorks, calls: [] }));
    await server.close();
    expect(result).toMatchObject({ ok: true, objectInfo: comfyApiWorks ? 'mcp' : 'none', nativeComfy: comfyApiWorks ? 'notTried' : 'notAllowed' });
    expect(requests).toBe(0);
    db.close();
  });

  it('stores classes and models, then falls back to the native URL for object_info', async () => {
    const server = await listen((req, res) => {
      res.setHeader('content-type', 'application/json');
      if (req.url === '/system_stats') res.end(JSON.stringify({ system: { comfyui_version: '0.9.9' }, devices: [{}] }));
      else if (req.url === '/object_info') res.end(JSON.stringify(OBJECT_INFO));
      else {
        res.statusCode = 404;
        res.end('{}');
      }
    });
    const db = new Database(':memory:');
    migrate(db);
    const calls: string[] = [];
    const result = await readCatalogViaMcp(
      db,
      { url: `${server.origin}/mcp`, token: 'secret-token' },
      globalThis.fetch,
      async () => fakeSession({ comfyUrl: server.origin, comfyApiWorks: false, calls }),
    );
    await server.close();
    expect(result).toMatchObject({ ok: true, tools: 5, nodes: 3, models: 2, objectInfo: 'native', comfyUrl: server.origin });
    expect((result as { skipped: string[] }).skipped).toEqual(['nodeDetailsMcp']);
    const catalog = readCatalog(db);
    const sampler = catalog.nodes.find((node) => node.classType === 'KSampler');
    expect(sampler).toMatchObject({ displayName: 'KSampler', category: 'sampling', pythonModule: 'nodes' });
    expect(sampler?.widgetOrder).toEqual(['seed', 'seed::control_after_generate']);
    expect(catalog.nodes.find((node) => node.classType === 'LoraLoader')).toMatchObject({ displayName: 'Load LoRA', inputs: [] });
    expect(catalog.models).toContainEqual({ directory: 'loras', name: 'style.safetensors', sizeBytes: 1024 });
    // The bearer token goes only into the transport header, never into a tool argument.
    expect(calls.some((call) => call.includes('secret-token'))).toBe(false);
    db.close();
  });

  it('reads object_info through comfy_api when the server can deliver it', async () => {
    const db = new Database(':memory:');
    migrate(db);
    const result = await readCatalogViaMcp(
      db,
      { url: 'https://mcp.example.test/mcp', token: null },
      globalThis.fetch,
      async () => fakeSession({ comfyUrl: null, comfyApiWorks: true, calls: [] }),
    );
    expect(result).toMatchObject({ ok: true, objectInfo: 'mcp', comfyUrl: null, skipped: [] });
    expect(readCatalog(db).nodes.find((node) => node.classType === 'KSampler')?.outputs).toEqual([{ name: 'LATENT', type: 'LATENT' }]);
    db.close();
  });

  it('reports an empty URL and a refused connection without touching the catalog', async () => {
    const db = new Database(':memory:');
    migrate(db);
    expect(await readCatalogViaMcp(db, { url: '', token: null }, globalThis.fetch)).toEqual({ ok: false, error: 'MCP server URL is empty.' });
    const refused = await readCatalogViaMcp(db, { url: 'https://x.test/mcp', token: 'bad' }, globalThis.fetch, async () => {
      throw new Error('HTTP 401 Unauthorized');
    });
    expect(refused).toEqual({ ok: false, error: 'MCP server refused the token.' });
    expect(readCatalog(db).models).toEqual([]);
    db.close();
  });
});
