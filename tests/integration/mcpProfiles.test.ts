import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { migrate } from '../../src/main/settings/migrate';
import { MCP_UNKNOWN_READ_COMFY, SyncService } from '../../src/main/mcp/sync';
import { MCP_NODES_NEED_COMFY, MCP_UNKNOWN_SERVER } from '../../src/main/mcp/client';
import { recognizeProfile } from '../../src/main/mcp/profiles';
import { isReadOnlyCall } from '../../src/main/mcp/readOnly';
import { acceptedComfyUrl } from '../../src/main/comfy/read';
import { createTranslator, translateKnownError } from '../../src/shared/i18n';
import { sourceSentence, syncView } from '../../src/renderer/components/sync/syncView';
import { CLASSES } from '../fixtures/mcp/fakeMcpServer';
import { startFakeComfy } from '../fixtures/comfy/fakeComfy';
import { CHECKPOINT_LIST, PUBLIC_READ_TOOLS, startPublicMcp, type PublicKind } from '../fixtures/mcp/fakePublicMcp';

/**
 * MCP servers other than the catalog one: recognised by their tool list, read only through their read-only tools,
 * the rest taken from the ComfyUI address. TEST fixtures on 127.0.0.1 (tests/fixtures/mcp/fakePublicMcp.ts,
 * tests/fixtures/comfy/fakeComfy.ts).
 */
const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (closers.length > 0) await closers.pop()?.();
});

async function server(kind: PublicKind) {
  const fake = await startPublicMcp(kind);
  closers.push(fake.close);
  return fake;
}

async function comfy() {
  const fake = await startFakeComfy();
  closers.push(fake.close);
  return fake;
}

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

function service(address: { comfy: string; mcp: string }): SyncService {
  return new SyncService({
    readUrl: () => address.mcp,
    readComfyOrigin: () => address.comfy,
    token: () => null,
    checkTokenOrigin: () => undefined,
    authProvider: async () => null,
    signedIn: () => false,
    readEnrichment: () => ({ scope: 'loaders', perRun: 1000, pauseMs: 0 }),
    readLookupOnline: () => false,
  });
}

const toolCalls = (calls: Array<{ method: string; tool?: string; args?: Record<string, unknown> }>) => calls.filter((call) => call.method === 'tools/call');

describe('recognising a server by its tools', () => {
  const schema = (properties: Record<string, unknown> = {}, required: string[] = []) => ({ type: 'object', properties, required });
  it('names the kinds the app reads, and nothing else', () => {
    expect(recognizeProfile([{ name: 'studio_capabilities' }, { name: 'list_local_models' }])).toBe('catalog');
    expect(recognizeProfile([{ name: 'models' }])).toBe('catalog');
    expect(recognizeProfile([{ name: 'list_local_models', inputSchema: schema({ action: { type: 'string', enum: ['list', 'remove'] } }, ['action']) }, { name: 'model_metadata' }])).toBe('modelList');
    expect(recognizeProfile([{ name: 'list_models', inputSchema: schema() }, { name: 'run_workflow' }])).toBe('checkpointList');
    // The same names with schemas the app cannot call read-only are not recognised.
    expect(recognizeProfile([{ name: 'list_local_models', inputSchema: schema({ action: { type: 'string', enum: ['remove'] } }, ['action']) }])).toBeNull();
    expect(recognizeProfile([{ name: 'list_local_models', inputSchema: schema({ action: { enum: ['list'] }, folder: { type: 'string' } }, ['action', 'folder']) }])).toBeNull();
    expect(recognizeProfile([{ name: 'list_models', inputSchema: schema({ folder: { type: 'string' } }, ['folder']) }])).toBeNull();
    expect(recognizeProfile([{ name: 'search_web' }, { name: 'nodes' }, { name: 'search_models' }])).toBeNull();
    // Only the empty call of list_models passes the gate.
    expect(isReadOnlyCall('list_models', {})).toBe(true);
    expect(isReadOnlyCall('list_models', { folder: 'loras' })).toBe(false);
  });
});

describe('a server that lists models only (the comfyui-mcp family)', () => {
  it('gives the models with their sizes; the nodes come from the ComfyUI address; only the list is called', async () => {
    const mcp = await server('modelList');
    const local = await comfy();
    const db = openDb();
    const sync = service({ comfy: local.url, mcp: mcp.url });
    const status = await sync.runSync(db);
    await sync.whenEnrichmentDone();
    sync.stop();
    expect(status).toMatchObject({ state: 'idle', lastError: null, librarySource: 'mcp+comfy', mcpProfile: 'modelList' });
    expect(status.counts.nodeClasses).toBe(CLASSES.length);
    // The four files the server listed; the loaders' own lists in /object_info name more, which stay too.
    expect(db.prepare('SELECT COUNT(*) AS n FROM model_catalog WHERE synced_at IS NOT NULL').get()).toEqual({ n: 4 });
    expect(db.prepare("SELECT size_bytes FROM model_catalog WHERE directory = 'loras' AND name = 'add-detail-xl.safetensors'").get()).toEqual({ size_bytes: Math.round(217.8 * 1024 * 1024) });
    // The header is read from ComfyUI's /view_metadata, not from the server's own tool of another shape.
    const header = db.prepare("SELECT metadata_json FROM model_catalog WHERE directory = 'loras' AND name = 'add-detail-xl.safetensors'").get() as { metadata_json: string };
    expect(JSON.parse(header.metadata_json)).toMatchObject({ 'modelspec.title': 'Detail slider' });
    const calls = toolCalls(mcp.calls);
    expect(calls.map((call) => [call.tool, call.args])).toEqual([['list_local_models', { action: 'list' }]]);
    for (const call of calls) expect(PUBLIC_READ_TOOLS.modelList).toContain(call.tool);
    expect(sourceSentence(status)).toEqual({ key: 'sync.source.mcpAndComfy', host: new URL(local.url).host });
    db.close();
  }, 30_000);

  it('without a ComfyUI address, says that the nodes need one', async () => {
    const mcp = await server('modelList');
    const db = openDb();
    const sync = service({ comfy: '', mcp: mcp.url });
    const status = await sync.runSync(db);
    sync.stop();
    expect(status.state).toBe('idle');
    expect(status.warnings).toContain(MCP_NODES_NEED_COMFY);
    expect(status.counts.models).toBe(4);
    expect(syncView(status)).toMatchObject({ warned: true, labelKey: 'sync.state.warned' });
    expect(translateKnownError(createTranslator('ru'), MCP_NODES_NEED_COMFY)).toContain('Модели прочитаны через MCP-сервер');
    db.close();
  });
});

describe('a server that lists checkpoints only (the comfyui-mcp-server family)', () => {
  it('replaces the checkpoints only and calls list_models with nothing else', async () => {
    const mcp = await server('checkpointList');
    const local = await comfy();
    const db = openDb();
    const sync = service({ comfy: local.url, mcp: mcp.url });
    const status = await sync.runSync(db);
    sync.stop();
    expect(status).toMatchObject({ lastError: null, mcpProfile: 'checkpointList', librarySource: 'mcp+comfy' });
    const names = (db.prepare("SELECT name FROM model_catalog WHERE directory = 'checkpoints' AND synced_at IS NOT NULL ORDER BY name").all() as Array<{ name: string }>).map((row) => row.name);
    expect(names).toEqual([...CHECKPOINT_LIST].sort());
    expect(toolCalls(mcp.calls).map((call) => [call.tool, call.args])).toEqual([['list_models', {}]]);
    db.close();
  }, 30_000);
});

describe('a server of no kind the app knows', () => {
  it('without a ComfyUI address: an exact sentence and the way forward, never a green state, and no tool called', async () => {
    const mcp = await server('foreign');
    const db = openDb();
    const sync = service({ comfy: '', mcp: mcp.url });
    const status = await sync.runSync(db);
    sync.stop();
    expect(status).toMatchObject({ state: 'error', lastError: MCP_UNKNOWN_SERVER, mcpProfile: 'unknown' });
    expect(syncView(status).labelKey).toBe('sync.state.error');
    expect(toolCalls(mcp.calls)).toEqual([]);
    expect(translateKnownError(createTranslator('ru'), MCP_UNKNOWN_SERVER)).toContain('не знает его инструментов');
    db.close();
  });

  it('with a ComfyUI address: reads everything from ComfyUI and says why', async () => {
    const mcp = await server('foreign');
    const local = await comfy();
    const db = openDb();
    const sync = service({ comfy: local.url, mcp: mcp.url });
    const status = await sync.runSync(db);
    sync.stop();
    expect(status).toMatchObject({ state: 'idle', lastError: null, librarySource: 'comfy', mcpProfile: 'unknown' });
    expect(status.warnings[0]).toBe(MCP_UNKNOWN_READ_COMFY);
    expect(status.counts.nodeClasses).toBe(CLASSES.length);
    expect(sourceSentence(status)?.key).toBe('sync.source.comfyInstead');
    expect(toolCalls(mcp.calls)).toEqual([]);
    db.close();
  }, 30_000);
});

describe('a ComfyUI address a server names', () => {
  it('on "this computer" is read only when the server is on this computer too, or it is the address in Settings', () => {
    expect(acceptedComfyUrl('http://127.0.0.1:8188', '', 'http://127.0.0.1:9000/mcp')).toBe('http://127.0.0.1:8188');
    expect(acceptedComfyUrl('http://127.0.0.1:8188', '', 'https://studio.example.test/mcp')).toBeNull();
    expect(acceptedComfyUrl('http://localhost:8188', null, 'http://192.168.1.5:9000/mcp')).toBeNull();
    expect(acceptedComfyUrl('http://127.0.0.1:8188', 'http://127.0.0.1:8188', 'https://studio.example.test/mcp')).toBe('http://127.0.0.1:8188');
    expect(acceptedComfyUrl('http://192.168.1.5:8188', 'http://192.168.1.5:8188', 'http://192.168.1.5:9000/mcp')).toBe('http://192.168.1.5:8188');
  });
});
