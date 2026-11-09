import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { SyncService } from '../../src/main/mcp/sync';
import { READ_ONLY_TOOLS } from '../../src/main/mcp/readOnly';
import { searchModels } from '../../src/main/knowledge/repository';
import { CLASSES, modelFileCount, PACKS, startFakeMcp, WRITE_TOOLS, type FakeMcp } from '../fixtures/mcp/fakeMcpServer';

/**
 * The sync over the real Streamable HTTP client against a fake MCP server on loopback: the transport, paging,
 * the comfy_api refusal and the native object_info fallback all run for real. Labelled fixture, not a live server.
 */
const TOKEN = 'fake-token-not-a-secret';
let fake: FakeMcp | null = null;

afterEach(async () => {
  await fake?.close();
  fake = null;
});

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

function service(url: string, token: string | null, enrichment: { perRun: number; pauseMs: number } = { perRun: 40, pauseMs: 0 }): SyncService {
  return new SyncService({
    readUrl: () => url,
    token: () => token,
    checkTokenOrigin: () => undefined,
    readEnrichment: () => ({ scope: 'loaders', ...enrichment }),
  });
}

describe('sync against the fake MCP server', () => {
  it('reads classes, packs, models, metadata and the native object_info with read-only calls only', async () => {
    fake = await startFakeMcp({ token: TOKEN });
    const db = openDb();
    const status = await service(fake.url, TOKEN).runSync(db);
    expect(status.lastError).toBeNull();
    expect(status.state).toBe('idle');
    expect(status.counts.nodeClasses).toBe(CLASSES.length);
    expect(status.counts.detailedClasses).toBe(CLASSES.length);
    expect(status.counts.packs).toBe(PACKS.length);
    expect(status.counts.models).toBe(modelFileCount());
    expect(status.counts.enrichedModels).toBeGreaterThan(0);

    const tools = fake.calls.filter((call) => call.method === 'tools/call');
    expect(tools.length).toBeGreaterThan(0);
    for (const call of tools) {
      expect(Object.keys(READ_ONLY_TOOLS)).toContain(call.tool);
      expect(READ_ONLY_TOOLS[call.tool!](call.args ?? {})).toBe(true);
      expect(WRITE_TOOLS as readonly string[]).not.toContain(call.tool);
    }
    // Paging ran past the server's page cap.
    expect(tools.filter((call) => call.tool === 'studio_capabilities' && call.args?.kind === 'classes').length).toBeGreaterThan(1);
    expect(tools.some((call) => call.tool === 'comfy_api')).toBe(true);
    expect(fake.comfyHits).toEqual(['GET /system_stats', 'GET /object_info']);
    expect(fake.calls.every((call) => call.authorized)).toBe(true);
    expect(JSON.stringify(fake.calls)).not.toContain(TOKEN);

    const pony = searchModels(db, { query: 'PerfectBreasts' });
    expect(pony[0]?.baseModel).toBe('pony');
    const zimage = searchModels(db, { query: 'Z-Image-Turbo-Realism' });
    expect(zimage[0]?.baseModel).toBe('zimage');
  }, 30_000);

  it('reports a refused token with the fixed message and never stores it', async () => {
    fake = await startFakeMcp({ token: TOKEN });
    const db = openDb();
    const status = await service(fake.url, null).runSync(db);
    expect(status.state).toBe('error');
    expect(status.lastError).toBe('MCP server refused the token.');
    expect(fake.calls.some((call) => call.method === 'tools/call')).toBe(false);
  }, 30_000);
});

describe('sync lifecycle against the fake MCP server', () => {
  it('reads the metadata of a 130-file catalog in batches until every file is enriched', async () => {
    fake = await startFakeMcp({ token: TOKEN, extraLoras: 100 });
    const db = openDb();
    const sync = service(fake.url, TOKEN, { perRun: 25, pauseMs: 20 });
    const first = await sync.runSync(db);
    expect(first).toMatchObject({ state: 'idle', lastError: null, warnings: [], progress: { phase: 'enrichment', done: 25, total: 130 } });
    expect(first.counts.models).toBe(modelFileCount() + 100);
    await sync.whenEnrichmentDone();
    const done = sync.status(db);
    expect(done).toMatchObject({ state: 'idle', progress: null, metadata: { done: 130, total: 130 } });
    const reads = fake.calls.filter((call) => call.method === 'tools/call' && call.tool === 'model_metadata');
    // Header files only: the two .pth files are named, not read.
    expect(reads).toHaveLength(128);
    expect(new Set(reads.map((call) => `${call.args?.category}/${call.args?.name}`)).size).toBe(128);
    // One session for the listing and every batch, closed at the end.
    expect(fake.calls.filter((call) => call.method === 'initialize')).toHaveLength(1);
    expect(fake.calls.filter((call) => call.method === 'DELETE').length).toBeLessThanOrEqual(1);
    for (const call of fake.calls.filter((item) => item.method === 'tools/call')) {
      expect(READ_ONLY_TOOLS[call.tool!](call.args ?? {})).toBe(true);
    }
    sync.stop();
  }, 60_000);

  it('says ComfyUI is not running when the node ports could not be refreshed', async () => {
    fake = await startFakeMcp({ token: TOKEN, comfyDown: true });
    const db = openDb();
    const sync = service(fake.url, TOKEN);
    const status = await sync.runSync(db);
    const host = new URL(fake.comfyUrl).host;
    expect(status).toMatchObject({ state: 'idle', lastError: null });
    expect(status.warnings).toEqual([`ComfyUI is not running at ${host} — node ports were not updated; start ComfyUI and sync again.`]);
    expect(status.counts.nodeClasses).toBe(CLASSES.length);
    expect(status.counts.detailedClasses).toBe(0);
    sync.stop();
  }, 30_000);

  it('says the MCP server is unreachable when nothing listens at its address', async () => {
    fake = await startFakeMcp({ token: TOKEN });
    const url = fake.url;
    await fake.close();
    fake = null;
    const db = openDb();
    const status = await service(url, TOKEN).runSync(db);
    expect(status).toMatchObject({ state: 'error', lastError: `MCP server unreachable: ${new URL(url).host}.` });
  }, 30_000);
});

describe('mcpUrlNeedsHttps (Settings ▸ Connection warning)', () => {
  it('flags plain http to another machine only', async () => {
    const { mcpUrlNeedsHttps } = await import('../../src/shared/mcp/loopback');
    expect(mcpUrlNeedsHttps('http://example.com/mcp')).toBe(true);
    expect(mcpUrlNeedsHttps('http://192.168.1.20:8000/mcp')).toBe(true);
    expect(mcpUrlNeedsHttps('https://llm.propriq.io/home_comfyui/mcp')).toBe(false);
    expect(mcpUrlNeedsHttps('http://127.0.0.1:8000/mcp')).toBe(false);
    expect(mcpUrlNeedsHttps('http://localhost:8000/mcp')).toBe(false);
    expect(mcpUrlNeedsHttps('')).toBe(false);
    expect(mcpUrlNeedsHttps('not a url')).toBe(false);
  });
});
