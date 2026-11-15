/**
 * Protects the node and model catalog read from ComfyUI directly or through the MCP server (main/comfy/direct,
 * main/mcp/sync, the catalog repository and the preview reader): facts about a model are dropped when its file
 * changes and kept when it does not, a read is published all at once or not at all, and a read or preview that
 * belongs to an address the person has just changed away from writes nothing. A person who switches servers must
 * never see the old server's models, previews or metadata mixed into the new one.
 */
import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PreviewReader } from '../../src/main/knowledge/preview';
import { describe, expect, it } from 'vitest';
import { migrate } from '../../src/main/settings/migrate';
import { acceptCatalogSource, catalogSourceKey, upsertModelFiles, writeModelEnrichment } from '../../src/main/catalog/repository';
import { collectComfyDirect, publishComfyDirect, readComfyDirect } from '../../src/main/comfy/direct';

import { ENRICH_FAILURES_KEY, HEADER_REFRESH_MS, readState, SyncService, writeState } from '../../src/main/mcp/sync';
import { readCatalogWithSession } from '../../src/main/mcp/client';
import type { McpSession, McpToolCallResult } from '../../src/shared/mcp/catalogSource';

/** An in-memory database with the schema. */
function open() { const db = new Database(':memory:'); migrate(db); return db; }
/** One enriched LoRA with web, preview and note facts, so a test can see which facts survive. */
function seed(db: Database.Database) {
  upsertModelFiles(db, [{ directory: 'loras', name: 'style.safetensors', sizeBytes: 10, rootPath: '/models/loras' }], 1);
  writeModelEnrichment(db, 'loras', 'style.safetensors', { kind: 'lora', baseModel: 'sdxl', baseModelEvidence: 'metadata', triggerWords: ['old'], description: 'old', sourceUrl: 'https://old.test', metadata: { old: 'yes' }, enrichedAt: 2, sha256: 'old' });
  db.prepare("UPDATE model_catalog SET web_family = 'sdxl', web_status = 'found', preview_file = 'old.webp', notes_json = '{\"old\":true}'").run();
}
// `run_open` is not published state: it marks that a run is in flight (set when it starts, removed when it ends,
// cancelled or not) so the next start can hold automatic sync after a run that never ended (sync.ts autoHeld).
function snapshot(db: Database.Database) { return ['node_catalog', 'node_packs', 'model_catalog', 'sync_state'].map(table => db.prepare(`SELECT * FROM ${table}${table === 'sync_state' ? " WHERE key <> 'run_open'" : ''} ORDER BY 1`).all()); }
/** A promise the test resolves by hand, to hold a request open while it cancels or switches address. */
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
/** object_info with one custom node class. */
const info = { NewNode: { input: { required: {} }, output: [], python_module: 'custom_nodes.new' } };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

describe('catalog identity and cancelled direct collection', () => {
  it.each([{ sizeBytes: 11, rootPath: '/models/loras' }, { sizeBytes: 10, rootPath: '/other/loras' }])('invalidates dependent facts for an observed replacement %j', replacement => {
    const db = open(); seed(db);
    upsertModelFiles(db, [{ directory: 'loras', name: 'style.safetensors', ...replacement, sidecarFile: 'new.json', sidecarSig: 'new' }], 3);
    expect(db.prepare('SELECT enriched_at, sha256, trigger_words, metadata_json, web_family, web_status, preview_file, sidecar_file, notes_json FROM model_catalog').get()).toEqual({ enriched_at: null, sha256: null, trigger_words: '[]', metadata_json: '{}', web_family: null, web_status: null, preview_file: null, sidecar_file: 'new.json', notes_json: '{}' });
    db.close();
  });
  it('retains cached facts with unchanged and weaker identity', () => {
    const db = open(); seed(db);
    upsertModelFiles(db, [{ directory: 'loras', name: 'style.safetensors', sizeBytes: null }], 3);
    expect(db.prepare('SELECT enriched_at, sha256, root_path FROM model_catalog').get()).toEqual({ enriched_at: 2, sha256: 'old', root_path: '/models/loras' }); db.close();
  });
  it.each(['/customnode/installed', '/experiment/models/loras'])('does not publish any table while %s is delayed or after cancellation', async delayed => {
    const db = open(); seed(db); const before = snapshot(db); let cancelled = false;
    const held = deferred<Response>(); const entered = deferred<void>();
    const fake = (async (input: URL | RequestInfo) => {
      const path = new URL(String(input)).pathname;
      if (path === delayed) { entered.resolve(); return held.promise; }
      if (path === '/system_stats') return response({ system: { comfyui_version: 'test' } });
      if (path === '/object_info') return response(info);
      if (path === '/customnode/installed') return response({ new: { ver: '1' } });
      if (path === '/experiment/models') return response([{ name: 'loras', folders: ['/new/loras'] }]);
      return response([{ name: 'new.safetensors', size: 5, pathIndex: 0 }]);
    }) as typeof fetch;
    const pending = readComfyDirect(db, 'http://comfy.test:8188', fake, 5, { cancelled: () => cancelled });
    await entered.promise; expect(snapshot(db)).toEqual(before);
    cancelled = true; held.resolve(response([])); await pending;
    expect(snapshot(db)).toEqual(before); db.close();
  });
});

/** Deterministic route fixture; no listener, Electron or model process is started. */
function directFetch(overrides: Partial<Record<string, () => Promise<Response>>> = {}): typeof fetch {
  return (async input => {
    const path = new URL(String(input)).pathname;
    if (overrides[path]) return overrides[path]!();
    if (path === '/system_stats') return response({ system: { comfyui_version: 'test' } });
    if (path === '/object_info') return response(info);
    if (path === '/customnode/installed') return response({ new: { ver: '1' } });
    if (path === '/experiment/models') return response([{ name: 'loras', folders: ['/models/loras'] }]);
    if (path === '/experiment/models/loras') return response([{ name: 'style.safetensors', size: 10, pathIndex: 0 }]);
    if (path.startsWith('/view_metadata/')) return response({ 'modelspec.description': 'fresh', ss_trigger_words: 'fresh' });
    return response({}, 404);
  }) as typeof fetch;
}
/** An MCP tool result carrying the payload as JSON text. */
const toolResult = (payload: unknown): McpToolCallResult => ({ content: [{ type: 'text', text: JSON.stringify(payload) }] });
/** A fake MCP session that answers the catalog tools with one install, one pack, one class and one LoRA. */
function catalogSession(overrides: Partial<McpSession> = {}): McpSession {
  return {
    listTools: async () => ['studio_info', 'studio_capabilities', 'models', 'model_metadata'].map(name => ({ name })),
    callTool: async (name, args) => {
      if (name === 'studio_info') return toolResult({ installation_id: 'install', comfyui_url: null });
      if (name === 'studio_capabilities') return toolResult({ items: args.kind === 'packs' ? [{ name: 'new' }] : [{ class_type: 'NewNode', module: 'custom_nodes.new' }] });
      if (name === 'models') return toolResult({ items: [{ category: 'loras', filename: 'style.safetensors', size_bytes: 10, root_path: '/models/loras' }] });
      return toolResult({ embedded_metadata: { 'modelspec.description': 'fresh' }, civitai_sidecar: null });
    },
    close: async () => undefined,
    ...overrides,
  };
}
/** A sync service bound to a mutable address, so a test can change the server while a sync runs. */
function syncService(address: { comfy: string; mcp?: string }, fetchImpl = directFetch(), extra: Partial<ConstructorParameters<typeof SyncService>[0]> = {}) {
  return new SyncService({ readUrl: () => address.mcp ?? '', readComfyOrigin: () => address.comfy, readAuthMode: () => 'none', token: () => null,
    signedIn: () => false, checkTokenOrigin: () => undefined, readLookupOnline: () => false,
    readEnrichment: () => ({ scope: 'loaders', perRun: 100, pauseMs: 0 }), fetchImpl, now: () => 1000, ...extra });
}

describe('source-aware publication boundaries', () => {
  it('keeps Windows path spelling and recent unchanged facts cached', () => {
    const db = open(); seed(db);
    db.prepare("UPDATE model_catalog SET root_path = 'C:\\Models\\Loras'").run();
    upsertModelFiles(db, [{ directory: 'loras', name: 'style.safetensors', sizeBytes: 10, rootPath: 'c:/models/loras/' }], 3);
    expect(db.prepare('SELECT enriched_at, sha256 FROM model_catalog').get()).toEqual({ enriched_at: 2, sha256: 'old' }); db.close();
  });
  it('invalidates same-name, same-size files when the source changes', () => {
    const db = open(); acceptCatalogSource(db, catalogSourceKey(['mcp', 'https://one.test/mcp'])); seed(db);
    upsertModelFiles(db, [{ directory: 'loras', name: 'style.safetensors', sizeBytes: 10 }], 3, { sourceKey: catalogSourceKey(['mcp', 'https://two.test/mcp']) });
    expect(db.prepare('SELECT enriched_at, sha256, metadata_json, root_path FROM model_catalog').get()).toEqual({ enriched_at: null, sha256: null, metadata_json: '{}', root_path: null }); db.close();
  });
  it('retains explicitly listed new preview facts after invalidation', () => {
    const db = open(); seed(db);
    upsertModelFiles(db, [{ directory: 'loras', name: 'style.safetensors', sizeBytes: 11, previewFile: 'new.webp', previewSig: 'new' }], 3);
    expect(db.prepare('SELECT preview_file, preview_sig, enriched_at FROM model_catalog').get()).toEqual({ preview_file: 'new.webp', preview_sig: 'new', enriched_at: null }); db.close();
  });
  it('rolls back all direct catalog tables, source and revision if provenance fails', async () => {
    const db = open(); seed(db); writeState(db, { catalog_source_key: 'old', catalog_revision: '7', library_url: 'old', last_sync_at: '1' });
    const before = snapshot(db);
    const collected = await collectComfyDirect('http://comfy.test:8188', directFetch());
    expect(collected.ok).toBe(true); if (!collected.ok) throw new Error(collected.error);
    expect(snapshot(db)).toEqual(before);
    expect(() => publishComfyDirect(db, collected, 5, { publishState: () => { writeState(db, { library_url: 'new' }); throw new Error('provenance failed'); } })).toThrow('provenance failed');
    expect(snapshot(db)).toEqual(before); db.close();
  });
  it('preserves failed-folder facts only for the same source, with warnings intact', async () => {
    const db = open();
    await readComfyDirect(db, 'http://one.test:8188', directFetch(), 1); seed(db);
    const broken = directFetch({ '/experiment/models/loras': async () => response({}, 500), '/models/loras': async () => response({}, 500) });
    const same = await readComfyDirect(db, 'http://one.test:8188', broken, 2);
    expect(same).toMatchObject({ ok: true, failedFolders: ['loras'] });
    expect(db.prepare('SELECT sha256 FROM model_catalog').get()).toEqual({ sha256: 'old' });
    const other = await readComfyDirect(db, 'http://two.test:8188', broken, 3);
    expect(other).toMatchObject({ ok: true, failedFolders: ['loras'] });
    expect(db.prepare('SELECT * FROM model_catalog').all()).toEqual([]); db.close();
  });
  it('retains same-source rows when models are unavailable, and uses module fallback without inventing manager errors', async () => {
    const db = open(); await readComfyDirect(db, 'http://one.test', directFetch(), 1); seed(db);
    const noModels = directFetch({ '/experiment/models': async () => response({}, 404), '/models': async () => response({}, 404), '/customnode/installed': async () => response({}, 404) });
    const result = await readComfyDirect(db, 'http://one.test', noModels, 2);
    expect(result).toMatchObject({ ok: true, modelListing: 'none', packsFrom: 'modules', warnings: ['ComfyUI did not list its model folders; models were not updated.'] });
    expect(db.prepare('SELECT sha256 FROM model_catalog').get()).toEqual({ sha256: 'old' }); db.close();
  });
  it.each(['/customnode/installed', '/experiment/models', '/experiment/models/loras'])('addressChanged aborts %s and leaves catalog and provenance unchanged', async delayed => {
    const db = open(); seed(db); writeState(db, { catalog_source_key: 'old', catalog_revision: '7', last_sync_at: '1', library_url: '', library_comfy_origin: 'http://old.test' });
    const before = snapshot(db); const entered = deferred<void>(); const held = deferred<Response>(); let signal: AbortSignal | undefined;
    const routes = directFetch();
    const fake = (async (input, init) => {
      if (new URL(String(input)).pathname === delayed) { signal = init?.signal ?? undefined; entered.resolve(); return held.promise; }
      return routes(input, init);
    }) as typeof fetch;
    const address = { comfy: 'http://old.test' }; const sync = syncService(address, fake); const revisions: number[] = [];
    sync.onStatus(status => revisions.push(status.catalogRevision ?? 0));
    const pending = sync.runSync(db); await entered.promise;
    expect(snapshot(db)).toEqual(before); address.comfy = 'http://new.test'; sync.addressChanged(db);
    expect(signal?.aborted).toBe(true); held.resolve(response([])); await pending;
    expect(snapshot(db)).toEqual(before); expect(new Set(revisions)).toEqual(new Set([7])); sync.stop(); db.close();
  });
  it.each(['/view_metadata/loras', '/experiment/models/preview/loras/0/style.safetensors'])('does not write first-batch metadata, preview or failure state after cancellation at %s', async delayed => {
    const db = open(); const entered = deferred<void>(); const held = deferred<Response>(); const fetchImpl = directFetch({ [delayed]: () => { entered.resolve(); return held.promise; } });
    const address = { comfy: 'http://old.test' }; const sync = syncService(address, fetchImpl);
    const pending = sync.runSync(db); await entered.promise;
    // Listing and provenance are already committed together before header/preview I/O.
    expect(readState(db)).toMatchObject({ library_comfy_origin: 'http://old.test', comfy_read_origin: 'http://old.test', last_sync_at: '1000', catalog_revision: '1' });
    const before = snapshot(db); address.comfy = 'http://new.test'; sync.addressChanged(db);
    held.resolve(delayed.includes('preview') ? new Response(new Uint8Array([1, 2]), { headers: { 'content-type': 'image/webp' } }) : response({ 'modelspec.description': 'obsolete' }));
    await pending; expect(snapshot(db)).toEqual(before);
    expect(readState(db)[ENRICH_FAILURES_KEY]).toBeUndefined();
    expect(db.prepare('SELECT enriched_at, preview_file FROM model_catalog').get()).toEqual({ enriched_at: null, preview_file: null }); sync.stop(); db.close();
  });
  it('refreshes same-size headers after 24h while caching recent unchanged identities', async () => {
    const db = open(); let now = 1000; let headers = 0;
    const fake = directFetch({ '/view_metadata/loras': async () => { headers += 1; return response({ 'modelspec.description': `read ${headers}` }); } });
    const sync = syncService({ comfy: 'http://comfy.test' }, fake, { now: () => now });
    await sync.runSync(db); expect(headers).toBe(1);
    now += HEADER_REFRESH_MS - 1; await sync.runSync(db); expect(headers).toBe(1);
    now += 1; await sync.runSync(db); expect(headers).toBe(2);
    expect(db.prepare('SELECT description FROM model_catalog').get()).toEqual({ description: 'read 2' }); sync.stop(); db.close();
  });
  it('advances revision after publication and accepted metadata, and never exposes endpoint credentials as source keys', async () => {
    const db = open(); const entered = deferred<void>(); const held = deferred<McpToolCallResult>();
    const base = catalogSession(); const session = catalogSession({ callTool: async (name, args) => {
      if (name === 'model_metadata') { entered.resolve(); return held.promise; }
      return base.callTool(name, args);
    } });
    const sync = syncService({ comfy: '', mcp: 'https://mcp.test/path?token=super-secret#fragment' }, directFetch(), { factory: async () => session });
    const revisions: number[] = []; sync.onStatus(status => revisions.push(status.catalogRevision ?? 0));
    const pending = sync.runSync(db); await entered.promise;
    expect(readState(db).catalog_revision).toBe('1'); expect(sync.status(db).catalogRevision).toBe(1);
    held.resolve(toolResult({ embedded_metadata: { 'modelspec.description': 'accepted' }, civitai_sidecar: null }));
    expect((await pending).catalogRevision).toBe(2);
    const sourceState = Object.entries(readState(db)).filter(([key]) => key.startsWith('catalog_source'));
    expect(JSON.stringify(sourceState)).not.toContain('super-secret');
    expect(JSON.stringify(sourceState)).not.toContain('mcp.test'); sync.stop(); db.close();
  });
  it('MCP collection is deferred and publication failures roll all catalog writes back', async () => {
    const db = open(); seed(db); const before = snapshot(db); const entered = deferred<void>(); const held = deferred<McpToolCallResult>();
    const base = catalogSession(); const session = catalogSession({ callTool: async (name, args) => {
      if (name === 'models') { entered.resolve(); return held.promise; }
      return base.callTool(name, args);
    } });
    const pending = readCatalogWithSession(db, session, directFetch(), 5, { mcpUrl: 'https://mcp.test/mcp', comfyOrigin: '', publishState: () => { writeState(db, { last_sync_at: '5' }); throw new Error('rollback MCP'); } });
    await entered.promise; expect(snapshot(db)).toEqual(before);
    held.resolve(toolResult({ items: [] })); await expect(pending).rejects.toThrow('rollback MCP'); expect(snapshot(db)).toEqual(before); db.close();
  });
  it('MCP address cancellation during collection cannot publish old sections or provenance', async () => {
    const db = open(); const entered = deferred<void>(); const held = deferred<McpToolCallResult>(); const base = catalogSession();
    const session = catalogSession({ callTool: async (name, args) => { if (name === 'models') { entered.resolve(); return held.promise; } return base.callTool(name, args); } });
    const address = { comfy: '', mcp: 'https://one.test/mcp' }; const sync = syncService(address, directFetch(), { factory: async () => session });
    const pending = sync.runSync(db); await entered.promise; const before = snapshot(db);
    address.mcp = 'https://two.test/mcp'; sync.addressChanged(db); held.resolve(toolResult({ items: [] })); await pending;
    expect(snapshot(db)).toEqual(before); sync.stop(); db.close();
  });
});

describe('remaining cancellation and source regressions', () => {
  it('publication callback failure rolls back the public direct-read wrapper', async () => {
    const db = open(); seed(db); const before = snapshot(db);
    await expect(readComfyDirect(db, 'http://comfy.test', directFetch(), 5, {
      publishState: () => { writeState(db, { last_sync_at: '5' }); throw new Error('failed state write'); },
    })).rejects.toThrow('failed state write');
    expect(snapshot(db)).toEqual(before); db.close();
  });
  it('keeps projects, graph revisions and user explanations during source replacement', async () => {
    const db = open();
    db.prepare("INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p', 'My project', 1, 1)").run();
    db.prepare("INSERT INTO graph_revisions (id, project_id, timestamp, nodes, edges, source) VALUES ('r', 'p', 1, '[]', '[]', 'user')").run();
    db.prepare("INSERT INTO explanations (id, project_id, owner_kind, owner_id, aspect, text, provenance, created_by, created_at) VALUES ('e', 'p', 'node', 'n', 'purpose', 'My explanation', 'user', 'user', 1)").run();
    const tables = ['projects', 'graph_revisions', 'explanations']; const before = tables.map(table => db.prepare(`SELECT * FROM ${table}`).all());
    await readComfyDirect(db, 'http://one.test', directFetch(), 1);
    await readComfyDirect(db, 'http://two.test', directFetch(), 2);
    expect(tables.map(table => db.prepare(`SELECT * FROM ${table}`).all())).toEqual(before); db.close();
  });
  it('retains installation identity when omitted, invalidates it when changed, and includes endpoint path/query', async () => {
    const db = open(); const base = catalogSession();
    const sessionWithId = (id: string | null) => catalogSession({ callTool: async (name, args) => name === 'studio_info' ? toolResult(id ? { installation_id: id } : {}) : base.callTool(name, args) });
    await readCatalogWithSession(db, sessionWithId('first'), directFetch(), 1, { mcpUrl: 'https://mcp.test/a?tenant=one#first' }); seed(db);
    const firstKey = readState(db).catalog_source_key;
    await readCatalogWithSession(db, sessionWithId(null), directFetch(), 2, { mcpUrl: 'https://mcp.test/a?tenant=one#second' });
    expect(readState(db).catalog_source_key).toBe(firstKey); expect(db.prepare('SELECT sha256 FROM model_catalog').get()).toEqual({ sha256: 'old' });
    await readCatalogWithSession(db, sessionWithId('second'), directFetch(), 3, { mcpUrl: 'https://mcp.test/a?tenant=one' });
    expect(readState(db).catalog_source_key).not.toBe(firstKey); expect(db.prepare('SELECT sha256 FROM model_catalog').get()).toEqual({ sha256: null }); seed(db);
    await readCatalogWithSession(db, sessionWithId(null), directFetch(), 4, { mcpUrl: 'https://mcp.test/a?tenant=two' });
    expect(db.prepare('SELECT sha256 FROM model_catalog').get()).toEqual({ sha256: null }); db.close();
  });
  it.each(['list_models', 'list_local_models'])('invalidates same-name facts across source changes for MCP profile %s', async tool => {
    const db = open(); const session = catalogSession({
      listTools: async () => [{ name: tool, inputSchema: { type: 'object', properties: tool === 'list_local_models' ? { action: { type: 'string' } } : {} } }],
      callTool: async () => toolResult(tool === 'list_models' ? { models: ['style.safetensors'] } : '## checkpoints\n- style.safetensors (1 MB)'),
    });
    await readCatalogWithSession(db, session, directFetch(), 1, { mcpUrl: 'https://one.test/mcp', comfyOrigin: '' });
    db.prepare("UPDATE model_catalog SET sha256 = 'old', enriched_at = 1").run();
    await readCatalogWithSession(db, session, directFetch(), 2, { mcpUrl: 'https://two.test/mcp', comfyOrigin: '' });
    expect(db.prepare('SELECT sha256, enriched_at FROM model_catalog').get()).toEqual({ sha256: null, enriched_at: null }); db.close();
  });
  it('does not write background metadata or backoff state after address change', async () => {
    const db = open(); const entered = deferred<void>(); const held = deferred<Response>(); let headers = 0;
    const fake = directFetch({
      '/experiment/models/loras': async () => response([{ name: 'a.safetensors', size: 10, pathIndex: 0 }, { name: 'b.safetensors', size: 10, pathIndex: 0 }]),
      '/view_metadata/loras': async () => { if (++headers === 2) { entered.resolve(); return held.promise; } return response({ 'modelspec.description': 'first' }); },
    });
    const address = { comfy: 'http://old.test' }; const sync = syncService(address, fake, { enrichLimit: 1, batchPauseMs: 0 });
    await sync.runSync(db); await entered.promise; const before = snapshot(db);
    address.comfy = 'http://new.test'; sync.addressChanged(db); held.resolve(response({}, 500));
    await new Promise(resolve => setImmediate(resolve));
    expect(snapshot(db)).toEqual(before); sync.stop(); db.close();
  });
  it('does not write delayed pack info or revision after address change', async () => {
    const db = open(); const entered = deferred<void>(); const held = deferred<McpToolCallResult>(); const base = catalogSession();
    const session = catalogSession({ listTools: async () => [...await base.listTools(), { name: 'workspace_files' }], callTool: async (name, args) => {
      if (name === 'studio_capabilities' && args.section === 'roots') return toolResult({ roots: { custom_node_roots: ['/srv/comfy/custom_nodes'] } });
      if (name === 'workspace_files') { if (String(args.absolute_path).endsWith('pyproject.toml')) { entered.resolve(); return held.promise; } return toolResult({ data_base64: '', complete: true }); }
      return base.callTool(name, args);
    } });
    const address = { comfy: '', mcp: 'https://old.test/mcp' }; const sync = syncService(address, directFetch(), { factory: async () => session });
    const pending = sync.runSync(db); await entered.promise; const before = snapshot(db);
    address.mcp = 'https://new.test/mcp'; sync.addressChanged(db); held.resolve(toolResult({ data_base64: Buffer.from('[project]\ndescription = "obsolete"').toString('base64'), complete: true }));
    await pending; expect(snapshot(db)).toEqual(before); expect(db.prepare('SELECT info_read_at FROM node_packs').get()).toEqual({ info_read_at: null }); sync.stop(); db.close();
  });
});

it('a cancelled first preview preserves the already published database contents', async () => {
  const db = open(); const entered = deferred<void>(); const held = deferred<Response>();
  const fake = directFetch({ '/experiment/models/preview/loras/0/style.safetensors': () => { entered.resolve(); return held.promise; } });
  const address = { comfy: 'http://old.test' }; const sync = syncService(address, fake);
  const pending = sync.runSync(db); await entered.promise; const before = snapshot(db);
  address.comfy = 'http://new.test'; sync.addressChanged(db);
  held.resolve(new Response(new Uint8Array([1, 2]), { headers: { 'content-type': 'image/webp' } })); await pending;
  const after = snapshot(db); sync.stop(); await new Promise(resolve => setImmediate(resolve)); db.close();
  expect(after).toEqual(before);
});

it('does not treat an oversized folder list as a complete empty inventory', async () => {
  const db = open(); await readComfyDirect(db, 'http://comfy.test', directFetch(), 1);
  upsertModelFiles(db, [{ directory: 'other', name: 'keep.safetensors', sizeBytes: 1 }], 1);
  const oversized = directFetch({ '/experiment/models': async () => response(Array.from({ length: 201 }, (_, index) => ({ name: `folder_${index}`, folders: [] }))) });
  expect(await readComfyDirect(db, 'http://comfy.test', oversized, 2)).toMatchObject({ ok: true, modelListing: 'none' });
  expect(db.prepare("SELECT name FROM model_catalog WHERE directory = 'other'").get()).toEqual({ name: 'keep.safetensors' }); db.close();
});

it('MCP failed folders preserve same-source rows and never inherit another source', async () => {
  const db = open(); const base = catalogSession();
  await readCatalogWithSession(db, base, directFetch(), 1, { mcpUrl: 'https://one.test/mcp', comfyOrigin: '' }); seed(db);
  const broken = catalogSession({ callTool: async (name, args) => {
    if (name === 'models') {
      if (args.category === 'loras') return { isError: true, content: [{ type: 'text', text: 'folder failed' }] };
      return toolResult({ items: args.category ? [] : [{ category: 'loras' }, { category: 'checkpoints' }] });
    }
    return base.callTool(name, args);
  } });
  const same = await readCatalogWithSession(db, broken, directFetch(), 2, { mcpUrl: 'https://one.test/mcp', comfyOrigin: '' });
  expect('result' in same && same.result.failedFolders).toEqual(['loras']);
  expect(db.prepare('SELECT sha256 FROM model_catalog').get()).toEqual({ sha256: 'old' });
  const other = await readCatalogWithSession(db, broken, directFetch(), 3, { mcpUrl: 'https://two.test/mcp', comfyOrigin: '' });
  expect('result' in other && other.result.failedFolders).toEqual(['loras']);
  expect(db.prepare('SELECT * FROM model_catalog').all()).toEqual([]); db.close();
});


it('preview bytes use source and observed model identity even when preview signature is unchanged', async () => {
  const db = open(); const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-preview-'));
  let reads = 0;
  upsertModelFiles(db, [{ directory: 'loras', name: 'style.safetensors', sizeBytes: 10, rootPath: '/models/loras', previewFile: 'comfyui-preview.webp', previewSig: '2' }]);
  writeState(db, { catalog_source_key: 'first' });
  const reader = new PreviewReader({ db: () => db, open: async () => null, cacheDir: folder,
    comfy: () => ({ origin: 'http://comfy.test', roots: { loras: ['/models/loras'] } }),
    fetchImpl: (async () => new Response(new Uint8Array([++reads, 0]), { headers: { 'content-type': 'image/webp' } })) as typeof fetch });
  try {
    expect((await reader.get('loras', 'style.safetensors'))?.bytes[0]).toBe(1);
    expect((await reader.get('loras', 'style.safetensors'))?.bytes[0]).toBe(1);
    writeState(db, { catalog_source_key: 'second' });
    expect((await reader.get('loras', 'style.safetensors'))?.bytes[0]).toBe(2);
    upsertModelFiles(db, [{ directory: 'loras', name: 'style.safetensors', sizeBytes: 11, rootPath: '/models/loras', previewFile: 'comfyui-preview.webp', previewSig: '2' }]);
    expect((await reader.get('loras', 'style.safetensors'))?.bytes[0]).toBe(3);
  } finally { reader.stop(); db.close(); fs.rmSync(folder, { recursive: true, force: true }); }
});

it('a delayed preview from a replaced source cannot cache bytes or reuse its old session', async () => {
  const db = open(); const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-preview-cancel-'));
  const entered = deferred<void>(); const held = deferred<McpToolCallResult>(); let opens = 0;
  upsertModelFiles(db, [{ directory: 'loras', name: 'style.safetensors', sizeBytes: 10, rootPath: '/models/loras', previewFile: 'style.webp', previewSig: '2' }]);
  writeState(db, { catalog_source_key: 'first' });
  const reader = new PreviewReader({ db: () => db, cacheDir: folder, mcpBinding: () => readState(db).catalog_source_key ?? null, open: async () => {
    const id = ++opens;
    return catalogSession({ callTool: async () => { if (id === 1) { entered.resolve(); return held.promise; } return toolResult({ data_base64: Buffer.from([2, 0]).toString('base64'), complete: true }); } });
  } });
  try {
    const obsolete = reader.get('loras', 'style.safetensors'); await entered.promise;
    writeState(db, { catalog_source_key: 'second' });
    const current = reader.get('loras', 'style.safetensors');
    held.resolve(toolResult({ data_base64: Buffer.from([1, 0]).toString('base64'), complete: true }));
    expect(await obsolete).toBeNull(); expect((await current)?.bytes[0]).toBe(2);
    expect(opens).toBe(2); expect(fs.readdirSync(folder)).toHaveLength(1);
  } finally { reader.stop(); db.close(); fs.rmSync(folder, { recursive: true, force: true }); }
});

/** A catalog published from MCP server one, with a LoRA preview, and a way to switch Settings to server two. */
function publishedMcpPreview() {
  const db = open();
  db.prepare("INSERT INTO settings (id, theme, motion, provider, model, comfy_origin, base_url, mcp_url, language, updated_at) VALUES (1, 'graphite', 'system', 'openai', 'x', '', '', 'https://one.test/mcp?tenant=one', 'en', 0)").run();
  upsertModelFiles(db, [{ directory: 'loras', name: 'style.safetensors', sizeBytes: 10, rootPath: '/models/loras', previewFile: 'style.webp', previewSig: '2' }]);
  writeState(db, { catalog_source_key: catalogSourceKey(['mcp', 'https://one.test/mcp?tenant=one'], 'one'),
    catalog_source_connection: catalogSourceKey(['mcp', 'https://one.test/mcp?tenant=one']), library_source: 'mcp', library_url: 'https://one.test/mcp?tenant=one', last_sync_at: '1' });
  const change = (url = 'https://two.test/mcp?tenant=two') => db.prepare('UPDATE settings SET mcp_url = ?').run(url);
  return { db, change };
}
const previewPayload = (byte = 1) => toolResult({ data_base64: Buffer.from([byte, 0]).toString('base64'), complete: true });

describe('preview binding before the next catalog publication', () => {
  it('suppresses an uncached A preview after Settings selects B with no new publication', async () => {
    const { db, change } = publishedMcpPreview(); const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-binding-')); let opens = 0;
    const reader = new PreviewReader({ db: () => db, cacheDir: folder, open: async () => { opens += 1; return catalogSession({ callTool: async () => previewPayload(2) }); } });
    try {
      const source = readState(db).catalog_source_key; change();
      expect(await reader.get('loras', 'style.safetensors')).toBeNull();
      expect(opens).toBe(0); expect(fs.readdirSync(folder)).toEqual([]); expect(readState(db).catalog_source_key).toBe(source);
    } finally { reader.stop(); db.close(); fs.rmSync(folder, { recursive: true, force: true }); }
  });
  it.each(['open', 'read'])('rejects Settings changes during delayed %s without another get', async delayed => {
    const { db, change } = publishedMcpPreview(); const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-binding-await-'));
    const entered = deferred<void>(); const heldOpen = deferred<McpSession | null>(); const heldRead = deferred<McpToolCallResult>(); let closes = 0; let reads = 0;
    const session = catalogSession({ close: async () => { closes += 1; }, callTool: async () => { reads += 1; if (delayed === 'read') { entered.resolve(); return heldRead.promise; } return previewPayload(2); } });
    const reader = new PreviewReader({ db: () => db, cacheDir: folder, open: async () => {
      if (delayed === 'open') { entered.resolve(); return heldOpen.promise; } return session;
    } });
    try {
      const pending = reader.get('loras', 'style.safetensors'); await entered.promise; change();
      if (delayed === 'open') heldOpen.resolve(session); else heldRead.resolve(previewPayload(2));
      expect(await pending).toBeNull(); expect(fs.readdirSync(folder)).toEqual([]); expect(closes).toBe(1);
      if (delayed === 'open') expect(reads).toBe(0);
    } finally { reader.stop(); db.close(); fs.rmSync(folder, { recursive: true, force: true }); }
  });
  it('preserves same-binding reads and cached A bytes while B is selected, then reads A after switching back', async () => {
    const { db, change } = publishedMcpPreview(); const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-binding-cache-')); let opens = 0; let reads = 0;
    const reader = new PreviewReader({ db: () => db, cacheDir: folder, open: async () => { opens += 1; return catalogSession({ callTool: async () => previewPayload(++reads) }); } });
    try {
      expect((await reader.get('loras', 'style.safetensors'))?.bytes[0]).toBe(1);
      change(); expect((await reader.get('loras', 'style.safetensors'))?.bytes[0]).toBe(1);
      expect(opens).toBe(1); expect(reads).toBe(1);
      fs.rmSync(path.join(folder, fs.readdirSync(folder)[0]));
      expect(await reader.get('loras', 'style.safetensors')).toBeNull(); expect(reads).toBe(1);
      change('https://one.test/mcp?tenant=one#fragment');
      expect((await reader.get('loras', 'style.safetensors'))?.bytes[0]).toBe(2);
      expect(opens).toBe(2);
    } finally { reader.stop(); db.close(); fs.rmSync(folder, { recursive: true, force: true }); }
  });
});
