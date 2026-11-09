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

function service(url: string, token: string | null): SyncService {
  return new SyncService({
    readUrl: () => url,
    token: () => token,
    checkTokenOrigin: () => undefined,
    readEnrichment: () => ({ scope: 'loaders', perRun: 40 }),
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
