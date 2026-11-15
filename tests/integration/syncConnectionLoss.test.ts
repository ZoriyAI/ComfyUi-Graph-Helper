/**
 * Protects the sync when a model file's metadata read breaks the connection, over the real Streamable HTTP client
 * against the fake MCP server on loopback (labelled fixture, not a live server). The three shapes of the break:
 * the server's own reader behind the tool dies on one file ("Connection closed", then "Not connected" for every
 * later call, as a gateway in front of a dead reader answers), the socket is closed without an answer, and the
 * answer is cut mid-body. What must hold: a lost connection is opened again (bounded, same sign-in) and is never
 * counted against the files asked after it; only the file that breaks the connection again is recorded, with its
 * reason; the run ends as a success with a report while the library holds anything read; old failure marks from
 * before reasons existed are cleared once; and a "try again" answer of a listing is honoured within a small cap.
 * This is the fix for a sync that failed every time and pushed five more healthy files into a day's wait per run.
 */
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { catalogModelRoots } from '../../src/main/mcp/knownRoots';
import { setKnownRootsSource } from '../../src/main/mcp/readOnly';
import { connectStreamableHttp, LISTING_RETRIES, type McpSessionFactory } from '../../src/main/mcp/client';
import { METADATA_CONNECTION_LOST, SyncService } from '../../src/main/mcp/sync';
import { FAILURES_RESET_KEY } from '../../src/main/mcp/unreadable';
import { modelDetail } from '../../src/main/knowledge/repository';
import { startFakeMcp, type FakeMcp } from '../fixtures/mcp/fakeMcpServer';

const TOKEN = 'fake-token-connection-loss';
/** A LoRA in the middle of the folder's reading order: files before it are read before the break. */
const BROKEN = 'pixel-art-xl.safetensors';
let fake: FakeMcp | null = null;

afterEach(async () => {
  setKnownRootsSource(null);
  await fake?.close();
  fake = null;
});

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  // As in the app: workspace_files may read inside the model folders the catalog knows (index.ts sets this).
  setKnownRootsSource(() => catalogModelRoots(db));
  return db;
}

/** The app's own factory, with every new connection's bearer token recorded (the value is a test marker). */
function service(url: string, tokens: Array<string | null>, logs: string[] = []): SyncService {
  const factory: McpSessionFactory = async (target, token, provider) => {
    tokens.push(token);
    return connectStreamableHttp(target, token, provider);
  };
  return new SyncService({
    readUrl: () => url,
    token: () => TOKEN,
    checkTokenOrigin: () => undefined,
    factory,
    readEnrichment: () => ({ scope: 'loaders', perRun: 100, pauseMs: 0 }),
    reconnectPauseMs: 0,
    log: (line) => logs.push(line),
  });
}

const metadataCalls = (target: FakeMcp) => target.calls.filter((call) => call.tool === 'model_metadata').map((call) => String(call.args?.name));
const failures = (db: Database.Database) => JSON.parse((db.prepare("SELECT value FROM sync_state WHERE key = 'enrich_failures'").get() as { value: string } | undefined)?.value ?? '{}') as Record<string, { attempts: number; reason?: string }>;

describe('a metadata read that breaks the connection', () => {
  it('the server\'s reader dies on one file: that file alone is recorded, the run ends as done with a report', async () => {
    fake = await startFakeMcp({ token: TOKEN, metadataBreak: { name: BROKEN, mode: 'innerLost' } });
    const db = openDb();
    const tokens: Array<string | null> = [];
    const logs: string[] = [];
    const sync = service(fake.url, tokens, logs);

    const first = await sync.runSync(db);
    const asked = metadataCalls(fake);
    // The broken file is asked twice: once on the first connection, once on a new one; nothing after it.
    expect(asked.filter((name) => name === BROKEN)).toHaveLength(2);
    expect(asked[asked.length - 1]).toBe(BROKEN);
    expect(asked.indexOf(BROKEN)).toBeGreaterThan(0);
    // The files before it were read, so this is not a failed sync: a warning and the report, no "Last error".
    expect(first).toMatchObject({ state: 'idle', lastError: null });
    expect(first.counts.enrichedModels).toBeGreaterThan(0);
    expect(first.warnings).toContain(METADATA_CONNECTION_LOST);
    expect(Object.keys(failures(db))).toEqual([`loras/${BROKEN}`]);
    expect(failures(db)[`loras/${BROKEN}`]).toMatchObject({ reason: 'dropped', attempts: 3 });
    expect(first.unreadable).toEqual([expect.objectContaining({ kind: 'model', directory: 'loras', name: BROKEN, reason: 'dropped', skipped: false })]);
    // The reconnect went through the same factory with the same sign-in.
    expect(tokens).toEqual([TOKEN, TOKEN]);
    expect(fake.calls.every((call) => call.authorized)).toBe(true);
    // The log line counts, and names no file and no address.
    expect(logs.at(-1)).toMatch(/^\[Sync\] Metadata read \d+ of \d+; 1 could not be read \(dropped=1\); 0 skipped$/);
    expect(logs.join('\n')).not.toContain(BROKEN);
    expect(logs.join('\n')).not.toContain('127.0.0.1');

    // The server stays broken: the very first read of the next sync says "Not connected". One new connection is
    // tried, then the reading stops. No other file is blamed and nothing new waits a day.
    fake.calls.length = 0;
    const second = await sync.runSync(db);
    expect(metadataCalls(fake)).toHaveLength(2);
    expect(new Set(metadataCalls(fake)).size).toBe(1);
    expect(metadataCalls(fake)).not.toContain(BROKEN);
    expect(second).toMatchObject({ state: 'idle', lastError: null });
    expect(second.warnings).toContain(METADATA_CONNECTION_LOST);
    expect(Object.keys(failures(db))).toEqual([`loras/${BROKEN}`]);

    // The server is restarted: everything is read but the broken file, which waits out its day.
    fake.heal();
    fake.calls.length = 0;
    const third = await sync.runSync(db);
    expect(metadataCalls(fake)).not.toContain(BROKEN);
    expect(third).toMatchObject({ state: 'idle', lastError: null });
    expect(third.warnings).not.toContain(METADATA_CONNECTION_LOST);
    expect(third.metadata!.done).toBe(third.metadata!.total - 1);
    expect(third.unreadable?.map((row) => row.name)).toEqual([BROKEN]);
    expect(modelDetail(db, 'loras', BROKEN)).toMatchObject({ enriched: false });
    sync.stop();
    db.close();
  }, 30_000);

  for (const mode of ['dropSocket', 'cutStream'] as const) {
    it(`${mode}: the file is asked again on a new connection, recorded, and every other file is read`, async () => {
      fake = await startFakeMcp({ token: TOKEN, metadataBreak: { name: BROKEN, mode } });
      const db = openDb();
      const tokens: Array<string | null> = [];
      const sync = service(fake.url, tokens);
      const status = await sync.runSync(db);
      await sync.whenEnrichmentDone();
      expect(metadataCalls(fake).filter((name) => name === BROKEN)).toHaveLength(2);
      expect(status).toMatchObject({ state: 'idle', lastError: null });
      expect(status.warnings).not.toContain(METADATA_CONNECTION_LOST);
      const after = sync.status(db);
      expect(after.metadata!.done).toBe(after.metadata!.total - 1);
      expect(Object.keys(failures(db))).toEqual([`loras/${BROKEN}`]);
      expect(after.unreadable).toEqual([expect.objectContaining({ name: BROKEN, reason: 'dropped' })]);
      expect(tokens).toEqual([TOKEN, TOKEN]);
      sync.stop();
      db.close();
    }, 30_000);
  }

  it('a server that stays broken: one new connection per run, then the reading stops without blaming a file', async () => {
    fake = await startFakeMcp({ token: TOKEN, metadataBreak: { name: BROKEN, mode: 'innerLost' } });
    const db = openDb();
    const tokens: Array<string | null> = [];
    const sync = service(fake.url, tokens);
    // Break the server's reader before the first sync: every read is "Not connected".
    await sync.runSync(db);
    fake.calls.length = 0;
    tokens.length = 0;
    const status = await sync.runSync(db);
    expect(tokens.length).toBeLessThanOrEqual(1 + 3);
    expect(metadataCalls(fake).length).toBeLessThanOrEqual(2 * 3);
    expect(status.warnings).toContain(METADATA_CONNECTION_LOST);
    expect(Object.keys(failures(db))).toEqual([`loras/${BROKEN}`]);
    sync.stop();
    db.close();
  }, 30_000);
});

describe('failure marks from older versions', () => {
  it('are cleared once at the first sync of this version, then kept', async () => {
    fake = await startFakeMcp({ token: TOKEN });
    const db = openDb();
    const sync = service(fake.url, []);
    // What an older version left: healthy files waiting a day because the connection was gone when they were asked.
    const old = JSON.stringify({ 'loras/add-detail-xl.safetensors': { attempts: 3, lastAt: Date.now() }, 'loras/flux_realism_lora.safetensors': { attempts: 3, lastAt: Date.now() } });
    db.prepare("INSERT INTO sync_state (key, value) VALUES ('enrich_failures', ?)").run(old);
    await sync.runSync(db);
    expect(metadataCalls(fake)).toContain('add-detail-xl.safetensors');
    expect(failures(db)).toEqual({});
    expect((db.prepare('SELECT value FROM sync_state WHERE key = ?').get(FAILURES_RESET_KEY) as { value: string }).value).toBe('1');
    // A mark written after that is a real one and stays.
    db.prepare("UPDATE sync_state SET value = ? WHERE key = 'enrich_failures'").run(JSON.stringify({ 'loras/add-detail-xl.safetensors': { attempts: 3, lastAt: Date.now(), reason: 'dropped' } }));
    fake.calls.length = 0;
    await sync.runSync(db);
    expect(metadataCalls(fake)).not.toContain('add-detail-xl.safetensors');
    expect(Object.keys(failures(db))).toEqual(['loras/add-detail-xl.safetensors']);
    sync.stop();
    db.close();
  }, 30_000);
});

describe('a listing the server answers with "try again"', () => {
  it('is asked again after the stated wait, and the list is read', async () => {
    fake = await startFakeMcp({ token: TOKEN, retryable: { tool: 'studio_capabilities', times: 2, retryAfterMs: 100 } });
    const db = openDb();
    const sync = service(fake.url, []);
    const status = await sync.runSync(db);
    expect(status).toMatchObject({ state: 'idle', lastError: null });
    expect(status.warnings?.some((warning) => warning.startsWith('MCP catalog section could not be read'))).toBe(false);
    expect(status.unreadable?.filter((row) => row.kind === 'section')).toEqual([]);
    sync.stop();
    db.close();
  }, 30_000);

  it('gives up after a bounded number of tries and names the section with "ComfyUI was not running"', async () => {
    fake = await startFakeMcp({ token: TOKEN, retryable: { tool: 'studio_capabilities', times: 100, retryAfterMs: 100 } });
    const db = openDb();
    const sync = service(fake.url, []);
    const status = await sync.runSync(db);
    const asked = fake.calls.filter((call) => call.tool === 'studio_capabilities');
    // Native object_info already supplied the classes; only packs need the retryable discovery tool.
    expect(asked).toHaveLength(1 + LISTING_RETRIES);
    expect(status.state).toBe('idle');
    expect(status.unreadable?.filter((row) => row.kind === 'section')).toEqual([
      expect.objectContaining({ name: 'node packs', reason: 'comfyDown' }),
    ]);
    sync.stop();
    db.close();
  }, 30_000);
});
