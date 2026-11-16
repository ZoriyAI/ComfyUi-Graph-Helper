/** Exercises synchronization failures, incomplete counts and resumable file enrichment. */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate } from '../../src/main/settings/migrate';
import { readCatalogWithSession } from '../../src/main/mcp/client';
import { comfyMetadataSession } from '../../src/main/comfy/direct';
import { ALL_FAILED_CONNECTION, MAX_METADATA_RECOVERY_PROBES, METADATA_CONNECTION_LOST, SyncService } from '../../src/main/mcp/sync';
import type { McpSession, McpToolCallResult } from '../../src/shared/mcp/catalogSource';

const json = (value: unknown): McpToolCallResult => ({ structuredContent: value });
const response = (value: unknown) => new Response(JSON.stringify(value));
import { headerBytes } from '../fixtures/modelHeader';

const origin = 'http://127.0.0.1:8188';

/** Labelled fixture: reproduces the owner's paged catalog and a permanently disconnected MCP metadata reader. */
function fixture(options: { native?: boolean; disconnected?: boolean; reportedOrigin?: string; metadataMissing?: boolean; missingFiles?: string[]; batch?: number; files?: string[]; headers?: Record<string, Buffer>; sidecars?: boolean; invalidMetadata?: boolean } = {}) {
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
      listTools: async () => ['studio_info', 'studio_capabilities', 'models', 'comfy_api', 'model_metadata', ...(options.headers ? ['workspace_files'] : [])].map(name => ({ name })),
      callTool: async (name, args) => {
        calls.push({ name, args });
        if (name === 'studio_info') return json({ installation_id: 'fixture', comfyui_url: options.native === false ? null : options.reportedOrigin ?? origin });
        if (name === 'comfy_api') return json({ error: 'catalog_available_via_native' });
        if (name === 'studio_capabilities' && args.kind === 'packs') return json({ items: [{ name: 'fixture', installed_state: 'installed', import_state: 'imported' }] });
        if (name === 'studio_capabilities') {
          const start = Number(args.cursor ?? 0), limit = Number(args.limit ?? 100);
          return json({ items: Object.keys(classes).slice(start, start + limit).map(class_type => ({ class_type, module: 'custom_nodes.fixture' })), next_cursor: start + limit < 3375 ? String(start + limit) : null });
        }
        if (name === 'models') return json({ items: (options.files ?? ['a', 'b', 'c']).flatMap(n => [
          { category: 'loras', filename: `${n}.safetensors`, root_path: '/models/loras', size_bytes: options.headers?.[n]?.length ?? 10 },
          ...(options.sidecars ? [{ category: 'loras', filename: `${n}.metadata.json`, root_path: '/models/loras', size_bytes: 100 }] : []),
        ]), complete: true });
        if (name === 'workspace_files') {
          const file = String(args.absolute_path).split('/').pop() ?? '';
          const bytes = file.endsWith('.metadata.json') ? Buffer.from(JSON.stringify({ description: 'Author description', baseModel: 'SDXL 1.0', trainedWords: ['flower'] })) : options.headers?.[file.replace('.safetensors', '')];
          if (!bytes) throw new Error('Missing fixture file');
          const start = Number(args.offset), length = Number(args.length);
          return json({ data_base64: bytes.subarray(start, start + length).toString('base64'), size_bytes: bytes.length, next_offset: Math.min(bytes.length, start + length), complete: start + length >= bytes.length });
        }
        if (name === 'model_metadata') {
          if (options.invalidMetadata) return json({ unsupported: true });
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
    if (url.startsWith(`${origin}/view_metadata/loras`) && (options.metadataMissing || options.missingFiles?.includes(new URL(url).searchParams.get('filename') ?? ''))) return new Response('{}', { status: 404 });
    if (url.startsWith(`${origin}/view_metadata/loras`)) return response({ ss_base_model_version: 'sdxl_base_v1-0' });
    throw new Error(`Unexpected fixture URL ${url}`);
  }) as typeof fetch;
  const sync = new SyncService({ readUrl: () => 'http://127.0.0.1:9000/mcp', readComfyOrigin: () => '', token: () => null,
    checkTokenOrigin: () => undefined, factory, fetchImpl, reconnectPauseMs: 0, batchPauseMs: 0,
    readEnrichment: () => ({ scope: 'loaders', perRun: options.batch ?? 100, pauseMs: 0 }), log: () => undefined });
  return { db, classes, calls, urls, factory, fetchImpl, sync, connections: () => connections };
}

describe('owner-reported sync scan amplification and disconnected metadata reader', () => {
  it('requires an actual supported JSON metadata response to prove recovery', async () => {
    let requests = 0;
    const session = comfyMetadataSession(origin, (async () => { requests++; return response([]); }) as typeof fetch, undefined, { allowMissing: false });
    await expect(session.callTool('model_metadata', { category: 'loras', name: 'a.sft' })).rejects.toMatchObject({ failure: 'notFound' });
    expect(requests).toBe(0);
    await expect(session.callTool('model_metadata', { category: 'loras', name: 'a.safetensors' })).rejects.toMatchObject({ failure: 'shape' });
    expect(requests).toBe(1);
  });
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

  it.each([1, 100])('continues past an unavailable first native header after MCP loss, including batch size %i', async (batch) => {
    // Native ComfyUI returns 404 both for headers above 1 MiB and headers without __metadata__.
    const f = fixture({ disconnected: true, missingFiles: ['a.safetensors'], batch });
    try {
      await f.sync.runSync(f.db); await f.sync.whenEnrichmentDone();
      const status = f.sync.status(f.db);
      expect(status).toMatchObject({ state: 'idle', progress: null, metadata: { done: 2, total: 3 } });
      expect(status.warnings).not.toContain(METADATA_CONNECTION_LOST);
      expect(status.unreadable).toEqual([expect.objectContaining({ kind: 'model', name: 'a.safetensors', reason: 'unreadable' })]);
      expect(f.db.prepare('SELECT name FROM model_catalog WHERE enriched_at IS NOT NULL ORDER BY name').all()).toEqual([{ name: 'b.safetensors' }, { name: 'c.safetensors' }]);
      expect(f.calls.filter(c => c.name === 'model_metadata')).toHaveLength(2);
      // A successful recovery probe is consumed once when the normal iteration reaches that file.
      expect(f.urls.filter(url => url.includes('/view_metadata/'))).toHaveLength(3);
      // Once only the unavailable file remains, verify the route against known metadata, not an old flag.
      f.db.prepare("DELETE FROM sync_state WHERE key = 'enrich_failures'").run();
      const prior = f.db.prepare('SELECT name, enriched_at FROM model_catalog ORDER BY name').all();
      await f.sync.runSync(f.db); await f.sync.whenEnrichmentDone();
      expect(f.sync.status(f.db).warnings).not.toContain(METADATA_CONNECTION_LOST);
      expect(f.sync.status(f.db).unreadable).toHaveLength(1);
      expect(f.db.prepare('SELECT name, enriched_at FROM model_catalog ORDER BY name').all()).toEqual(prior);
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
    const f = fixture({ disconnected: true, metadataMissing: true, files: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] });
    try {
      await f.sync.runSync(f.db); await f.sync.whenEnrichmentDone();
      expect(f.sync.status(f.db)).toMatchObject({ state: 'error', lastError: ALL_FAILED_CONNECTION, metadata: { done: 0, total: 8 }, unreadable: [] });
      expect(f.urls.filter(url => url.includes('/view_metadata/'))).toHaveLength(1 + MAX_METADATA_RECOVERY_PROBES);
    } finally { f.sync.stop(); f.db.close(); }
  });

  it('does not probe later files while native ComfyUI is offline', async () => {
    const f = fixture({ disconnected: true });
    let requests = 0;
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes('/view_metadata/')) { requests++; throw new TypeError('fetch failed'); }
      return f.fetchImpl(input, init);
    }) as typeof fetch;
    try {
      await f.sync.runSync(f.db, fetchImpl); await f.sync.whenEnrichmentDone();
      expect(requests).toBe(1);
      expect(f.sync.status(f.db)).toMatchObject({ lastError: ALL_FAILED_CONNECTION, metadata: { done: 0, total: 3 }, unreadable: [] });
    } finally { f.sync.stop(); f.db.close(); }
  });

  it('discards a recovery probe completed after cancellation', async () => {
    const f = fixture({ disconnected: true, missingFiles: ['a.safetensors'] });
    let release!: () => void, entered!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const waiting = new Promise<void>(resolve => { entered = resolve; });
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes('filename=b.safetensors')) { entered(); await held; }
      return f.fetchImpl(input, init);
    }) as typeof fetch;
    try {
      const pending = f.sync.runSync(f.db, fetchImpl);
      await waiting;
      f.sync.stop(); release(); await pending;
      expect(f.db.prepare('SELECT count(*) AS n FROM model_catalog WHERE enriched_at IS NOT NULL').get()).toEqual({ n: 0 });
      expect(f.sync.status(f.db).unreadable).toEqual([]);
    } finally { release?.(); f.sync.stop(); f.db.close(); }
  });

});


describe('metadata-free headers and independent descriptions', () => {
  it('recovers a disconnected metadata endpoint without reconnect loops, including metadata-free and large headers', async () => {
    const f = fixture({ disconnected: true, metadataMissing: true, headers: { a: headerBytes(), b: headerBytes({ description: 'x'.repeat(2 * 1024 * 1024) }), c: headerBytes() }, sidecars: true });
    try {
      await f.sync.runSync(f.db); await f.sync.whenEnrichmentDone();
      expect(f.sync.status(f.db)).toMatchObject({ metadata: { done: 3, total: 3 }, metadataReport: { pending: 0, failed: 0, skipped: 0 }, unreadable: [] });
      expect(f.sync.status(f.db).warnings).not.toContain(METADATA_CONNECTION_LOST);
      expect(f.calls.filter(c => c.name === 'model_metadata')).toHaveLength(1);
      expect(f.db.prepare('SELECT description FROM model_catalog ORDER BY name').all()).toEqual(Array(3).fill({ description: 'Author description' }));
    } finally { f.sync.stop(); f.db.close(); }
  });
  it('keeps sidecar facts when the header is invalid without counting it as read', async () => {
    const bad = Buffer.alloc(100); bad.writeBigUInt64LE(2n); bad.write('{}', 8);
    const f = fixture({ files: ['a'], invalidMetadata: true, headers: { a: bad }, sidecars: true });
    try {
      await f.sync.runSync(f.db); await f.sync.whenEnrichmentDone();
      expect(f.db.prepare('SELECT description, enriched_at FROM model_catalog').get()).toEqual({ description: 'Author description', enriched_at: null });
      expect(f.sync.status(f.db)).toMatchObject({ metadata: { done: 0, total: 1 }, metadataReport: { pending: 0, failed: 1, skipped: 0 } });
    } finally { f.sync.stop(); f.db.close(); }
  });
  it('counts untouched files as pending after a connection outage', async () => {
    const f = fixture({ native: false, disconnected: true });
    try {
      await f.sync.runSync(f.db); await f.sync.whenEnrichmentDone();
      expect(f.sync.status(f.db)).toMatchObject({ metadata: { done: 0, total: 3 }, metadataReport: { pending: 3, failed: 0, skipped: 0 } });
    } finally { f.sync.stop(); f.db.close(); }
  });
});
