import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate } from '../../src/main/settings/migrate';
import { readCatalogWithSession } from '../../src/main/mcp/client';
import { ALL_FAILED_CONNECTION, METADATA_CONNECTION_LOST, SyncService } from '../../src/main/mcp/sync';
import type { McpSession, McpToolCallResult } from '../../src/shared/mcp/catalogSource';

const json = (value: unknown): McpToolCallResult => ({ structuredContent: value });
const response = (value: unknown) => new Response(JSON.stringify(value));
const origin = 'http://127.0.0.1:8188';

/** Labelled fixture: reproduces the owner's paged catalog and a permanently disconnected MCP metadata reader. */
function fixture(options: { native?: boolean; disconnected?: boolean; reportedOrigin?: string; metadataMissing?: boolean } = {}) {
  const db = new Database(':memory:');
  migrate(db);
  const classes = Object.fromEntries(Array.from({ length: 3375 }, (_, i) => [`Node${i}`, {
    input: { required: {} }, output: [], python_module: 'custom_nodes.fixture', display_name: `Node ${i}`, category: 'fixture',
  }]));
  // Malformed widget definitions must still leave the class discoverable, just as the MCP class list does.
  classes.Node0.input = null as unknown as typeof classes.Node0.input;
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const urls: string[] = [];
  let connections = 0;
  const factory = async (): Promise<McpSession> => {
    connections += 1;
    return {
      listTools: async () => ['studio_info', 'studio_capabilities', 'models', 'comfy_api', 'model_metadata'].map(name => ({ name })),
      callTool: async (name, args) => {
        calls.push({ name, args });
        if (name === 'studio_info') return json({ installation_id: 'fixture', comfyui_url: options.native === false ? null : options.reportedOrigin ?? origin });
        if (name === 'comfy_api') return json({ error: 'catalog_available_via_native' });
        if (name === 'studio_capabilities' && args.kind === 'packs') return json({ items: [{ name: 'fixture', installed_state: 'installed', import_state: 'imported' }] });
        if (name === 'studio_capabilities') {
          const start = Number(args.cursor ?? 0), limit = Number(args.limit ?? 100);
          return json({ items: Object.keys(classes).slice(start, start + limit).map(class_type => ({ class_type, module: 'custom_nodes.fixture' })), next_cursor: start + limit < 3375 ? String(start + limit) : null });
        }
        if (name === 'models') return json({ items: ['a', 'b', 'c'].map(n => ({ category: 'loras', filename: `${n}.safetensors`, root_path: '/models/loras', size_bytes: 10 })), complete: true });
        if (name === 'model_metadata') {
          if (options.disconnected) throw new Error('Not connected');
          return json({ embedded_metadata: {}, civitai_sidecar: null });
        }
        throw new Error(`Unexpected fixture tool ${name}`);
      },
      close: async () => undefined,
    };
  };
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input); urls.push(url);
    if (url === `${origin}/system_stats`) return response({ system: { comfyui_version: 'fixture' } });
    if (url === `${origin}/object_info`) return response(classes);
    if (url.startsWith(`${origin}/view_metadata/loras`) && options.metadataMissing) return new Response('{}', { status: 404 });
    if (url.startsWith(`${origin}/view_metadata/loras`)) return response({ ss_base_model_version: 'sdxl_base_v1-0' });
    throw new Error(`Unexpected fixture URL ${url}`);
  }) as typeof fetch;
  const sync = new SyncService({ readUrl: () => 'http://127.0.0.1:9000/mcp', readComfyOrigin: () => '', token: () => null,
    checkTokenOrigin: () => undefined, factory, fetchImpl, reconnectPauseMs: 0, batchPauseMs: 0,
    readEnrichment: () => ({ scope: 'loaders', perRun: 100, pauseMs: 0 }), log: () => undefined });
  return { db, classes, calls, urls, factory, fetchImpl, sync, connections: () => connections };
}

describe('owner-reported sync scan amplification and disconnected metadata reader', () => {
  it('reuses full object_info for all class names, including malformed definitions, without 34 class-page calls', async () => {
    const f = fixture();
    try {
      const result = await readCatalogWithSession(f.db, await f.factory(), f.fetchImpl, 1, { mcpUrl: 'http://127.0.0.1:9000/mcp' });
      expect('result' in result && result.result.nodes).toBe(3375);
      expect(f.calls.filter(c => c.name === 'studio_capabilities' && c.args.kind === 'classes')).toHaveLength(0);
      expect(f.urls.filter(url => url.endsWith('/object_info'))).toHaveLength(1);
      expect(f.db.prepare("SELECT count(*) AS n FROM node_catalog WHERE python_module = 'custom_nodes.fixture'").get()).toEqual({ n: 3375 });
      expect(f.db.prepare("SELECT python_module FROM node_catalog WHERE class_type = 'Node0'").get()).toEqual({ python_module: 'custom_nodes.fixture' });
    } finally { f.sync.stop(); f.db.close(); }
  });

  it('finishes every header through the verified native origin when reconnecting MCP still says Not connected', async () => {
    const f = fixture({ disconnected: true });
    try {
      await f.sync.runSync(f.db); await f.sync.whenEnrichmentDone();
      const status = f.sync.status(f.db);
      expect(status).toMatchObject({ state: 'idle', progress: null, metadata: { done: 3, total: 3 } });
      expect(status.warnings).not.toContain(METADATA_CONNECTION_LOST);
      expect(f.calls.filter(c => c.name === 'model_metadata')).toHaveLength(2);
      expect(f.urls.filter(url => url.includes('/view_metadata/'))).toHaveLength(3);
      const before = f.urls.filter(url => url.includes('/view_metadata/')).length;
      await f.sync.runSync(f.db); await f.sync.whenEnrichmentDone();
      expect(f.urls.filter(url => url.includes('/view_metadata/'))).toHaveLength(before);
    } finally { f.sync.stop(); f.db.close(); }
  });

  it('keeps paged discovery and a truthful connection error when no verified native address exists', async () => {
    const f = fixture({ native: false, disconnected: true });
    try {
      await f.sync.runSync(f.db); await f.sync.whenEnrichmentDone();
      expect(f.calls.filter(c => c.name === 'studio_capabilities' && c.args.kind === 'classes')).toHaveLength(34);
      expect(f.urls).toEqual([]);
      expect(f.sync.status(f.db).lastError).toBe(ALL_FAILED_CONNECTION);
    } finally { f.sync.stop(); f.db.close(); }
  });
  it('never uses a server-reported unrelated origin for fallback', async () => {
    const f = fixture({ disconnected: true, reportedOrigin: 'http://untrusted.test:8188' });
    try {
      await f.sync.runSync(f.db); await f.sync.whenEnrichmentDone();
      expect(f.urls).toEqual([]);
      expect(f.sync.status(f.db).lastError).toBe(ALL_FAILED_CONNECTION);
    } finally { f.sync.stop(); f.db.close(); }
  });

  it('does not publish a late native header after the run is stopped', async () => {
    const f = fixture({ disconnected: true });
    let release!: () => void, entered!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const waiting = new Promise<void>(resolve => { entered = resolve; });
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes('/view_metadata/')) { entered(); await held; }
      return f.fetchImpl(input, init);
    }) as typeof fetch;
    try {
      const pending = f.sync.runSync(f.db, fetchImpl);
      await waiting;
      const before = f.db.prepare('SELECT directory, name, enriched_at FROM model_catalog ORDER BY name').all();
      f.sync.stop(); release(); await pending;
      expect(f.db.prepare('SELECT directory, name, enriched_at FROM model_catalog ORDER BY name').all()).toEqual(before);
      expect(f.sync.status(f.db).progress).toBeNull();
    } finally { release?.(); f.sync.stop(); f.db.close(); }
  });

  it('does not count an unsupported native metadata route as a successful fallback', async () => {
    const f = fixture({ disconnected: true, metadataMissing: true });
    try {
      await f.sync.runSync(f.db); await f.sync.whenEnrichmentDone();
      expect(f.sync.status(f.db)).toMatchObject({ state: 'error', lastError: ALL_FAILED_CONNECTION, metadata: { done: 0, total: 3 } });
    } finally { f.sync.stop(); f.db.close(); }
  });

});
