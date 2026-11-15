/**
 * Protects the "Could not be read" report of the catalog sync (src/main/mcp/unreadable.ts, the sync's actions in
 * src/main/mcp/sync.ts, and the words of src/renderer/components/sync/unreadReport.ts): how a failed metadata read
 * is sorted into "the file" or "the connection", the records with their reason and time, the bounded reconnects,
 * the sentence when nothing could be read, "Try again now", "Skip this file" and "Try all again", the "try again"
 * answer of a listing, and the report text a person copies (never a server address or a secret).
 * Why: a person must see what is broken and what to do; a lost connection must never be blamed on healthy files.
 */
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { modelDetail } from '../../src/main/knowledge/repository';
import { retryableAnswer } from '../../src/main/mcp/client';
import { ALL_FAILED_CONNECTION, ALL_FAILED_SERVER, MAX_RECONNECTS, METADATA_CONNECTION_LOST, SyncService } from '../../src/main/mcp/sync';
import { classifyErrorAnswer, classifyReadError, logSummary, shortDetail, unreadableRows } from '../../src/main/mcp/unreadable';
import { reportText, rowLabel, rowTodo, rowWhy } from '../../src/renderer/components/sync/unreadReport';
import { createTranslator, translateKnownError } from '../../src/shared/i18n';
import type { McpSession, McpToolCallResult } from '../../src/shared/mcp/catalogSource';
import type { UnreadableItem } from '../../src/shared/contracts';

const NOW = 1_700_000_000_000;
const json = (value: unknown): McpToolCallResult => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
const header = () => json({ embedded_metadata: { ss_base_model_version: 'sdxl_base_v1-0' }, civitai_sidecar: null });
const LORAS = ['a.safetensors', 'b.safetensors', 'c.safetensors', 'd.safetensors', 'e.safetensors'];

/** A catalog server whose model_metadata answers with `metadata(name, connection)`; each new connection is numbered. */
function server(metadata: (name: string, connection: number) => McpToolCallResult | Error) {
  const asked: string[] = [];
  let connections = 0;
  const open = async (): Promise<McpSession> => {
    const connection = ++connections;
    return {
      async listTools() {
        return ['studio_capabilities', 'models', 'model_metadata'].map((name) => ({ name }));
      },
      async callTool(name, args) {
        if (name === 'studio_capabilities') return json({ items: [] });
        if (name === 'models') {
          if (typeof args.category !== 'string') return json({ items: [{ category: 'loras' }], complete: true });
          return json({ items: LORAS.map((filename) => ({ category: 'loras', filename, root_path: '/m/loras', size_bytes: 1 })), complete: true });
        }
        if (name === 'model_metadata') {
          asked.push(String(args.name));
          const answer = metadata(String(args.name), connection);
          if (answer instanceof Error) throw answer;
          return answer;
        }
        throw new Error(`unexpected ${name}`);
      },
      async close() {},
    };
  };
  return { asked, connections: () => connections, open };
}

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

function service(factory: () => Promise<McpSession>, extra: Partial<ConstructorParameters<typeof SyncService>[0]> = {}) {
  return new SyncService({
    readUrl: () => 'https://mcp.example.test/mcp',
    token: () => 'tok-test-marker',
    checkTokenOrigin: () => undefined,
    factory: async () => factory(),
    fetchImpl: (async () => { throw new Error('no network in unit tests'); }) as unknown as typeof fetch,
    now: () => NOW,
    readEnrichment: () => ({ scope: 'loaders', perRun: 100, pauseMs: 0 }),
    reconnectPauseMs: 0,
    log: () => undefined,
    ...extra,
  });
}

const records = (db: Database.Database) => JSON.parse((db.prepare("SELECT value FROM sync_state WHERE key = 'enrich_failures'").get() as { value: string } | undefined)?.value ?? '{}') as Record<string, { attempts: number; reason?: string }>;

describe('sorting a failed read', () => {
  it('tells the connection apart from the file', () => {
    // What a gateway in front of a dead reader answers, and what the transport here says when a socket closes.
    expect(classifyReadError(Object.assign(new Error('MCP error -32000: Connection closed'), { name: 'ProtocolError' })).reason).toBe('dropped');
    expect(classifyReadError(new Error('Not connected')).reason).toBe('notConnected');
    expect(classifyReadError(new TypeError('fetch failed')).reason).toBe('dropped');
    expect(classifyReadError(new TypeError('terminated')).reason).toBe('dropped');
    expect(classifyReadError(Object.assign(new Error('The answer is larger than 10 bytes.'), { name: 'ResponseTooLargeError' })).reason).toBe('tooLarge');
    expect(classifyReadError(Object.assign(new Error('Request timed out'), { name: 'SdkError' })).reason).toBe('timeout');
    expect(classifyReadError(Object.assign(new Error('Header too big'), { name: 'ProtocolError' }))).toEqual({ reason: 'serverError', detail: 'Header too big' });
    expect(classifyReadError(new Error('down')).reason).toBe('failed');
    expect(classifyErrorAnswer('{"error":{"code":"MODEL_HEADER_INVALID","message":"bad header"}}')).toEqual({ reason: 'serverError', detail: 'MODEL_HEADER_INVALID: bad header' });
    expect(classifyErrorAnswer('Not connected').reason).toBe('notConnected');
  });

  it('keeps no address, path or secret in the server text it shows', () => {
    const text = shortDetail('failed at http://10.1.2.3:9000/mcp reading /srv/models/loras/x.safetensors with Bearer sk-abcdefghijklmnopqrstuvwx and 192.168.1.20:8188');
    expect(text).not.toMatch(/10\.1\.2\.3|192\.168|\/srv\/|sk-abc|http/);
    expect(shortDetail('x'.repeat(400)).length).toBeLessThanOrEqual(160);
  });
});

describe('the run', () => {
  it('reconnects at most MAX_RECONNECTS times; each file that drops a new connection too is recorded; then it stops', async () => {
    // Every file drops every connection.
    const fake = server(() => new TypeError('fetch failed'));
    const db = openDb();
    const sync = service(fake.open);
    const status = await sync.runSync(db);
    // One first connection plus MAX_RECONNECTS new ones; the file after the last one is not blamed.
    expect(fake.connections()).toBe(1 + MAX_RECONNECTS);
    expect(Object.keys(records(db))).toEqual(LORAS.slice(0, MAX_RECONNECTS).map((name) => `loras/${name}`));
    expect(Object.values(records(db)).every((record) => record.reason === 'dropped' && record.attempts === 3)).toBe(true);
    // Nothing at all could be read and the library holds nothing: then, and only then, the sync failed, and says why.
    expect(status).toMatchObject({ state: 'error', lastError: ALL_FAILED_CONNECTION });
    expect(translateKnownError(createTranslator('ru'), ALL_FAILED_CONNECTION)).toMatch(/соединение/);
    expect(translateKnownError(createTranslator('en'), METADATA_CONNECTION_LOST)).toMatch(/Restart the MCP server/);
    sync.stop();
    db.close();
  });

  it('a file that fails once on a dropped connection but reads on the new one is not recorded', async () => {
    const fake = server((name, connection) => (name === 'b.safetensors' && connection === 1 ? new Error('MCP error -32000: Connection closed') : header()));
    const db = openDb();
    const sync = service(fake.open);
    const status = await sync.runSync(db);
    expect(fake.asked).toEqual(['a.safetensors', 'b.safetensors', 'b.safetensors', 'c.safetensors', 'd.safetensors', 'e.safetensors']);
    expect(records(db)).toEqual({});
    expect(status).toMatchObject({ state: 'idle', lastError: null, unreadable: [] });
    sync.stop();
    db.close();
  });

  it('says in plain words when the server answered every file with an error', async () => {
    const fake = server(() => ({ isError: true, content: [{ type: 'text', text: 'MODEL_HEADER_INVALID' }] }));
    const db = openDb();
    const sync = service(fake.open);
    const status = await sync.runSync(db);
    expect(fake.asked).toEqual(LORAS);
    expect(status).toMatchObject({ state: 'error', lastError: ALL_FAILED_SERVER });
    expect(status.unreadable?.map((row) => [row.name, row.reason, row.detail])).toEqual(LORAS.map((name) => [name, 'serverError', 'MODEL_HEADER_INVALID']));
    sync.stop();
    db.close();
  });
});

describe('the actions of the report', () => {
  it('"Try again now" reads the one file at once past its wait, or records why not', async () => {
    let broken = true;
    const fake = server((name) => (name === 'c.safetensors' && broken ? new Error('down') : header()));
    const db = openDb();
    const sync = service(fake.open);
    await sync.runSync(db);
    expect(Object.keys(records(db))).toEqual(['loras/c.safetensors']);
    fake.asked.length = 0;
    const again = await sync.retryItem(db, 'loras', 'c.safetensors');
    expect(again.outcome).toBe('failed');
    expect(records(db)['loras/c.safetensors']).toMatchObject({ attempts: 2, reason: 'failed' });
    broken = false;
    const read = await sync.retryItem(db, 'loras', 'c.safetensors');
    expect(read.outcome).toBe('read');
    expect(fake.asked).toEqual(['c.safetensors', 'c.safetensors']);
    expect(records(db)).toEqual({});
    expect(read.status.unreadable).toEqual([]);
    expect(modelDetail(db, 'loras', 'c.safetensors')).toMatchObject({ enriched: true, baseModel: 'sdxl' });
    expect((await sync.retryItem(db, 'loras', 'gone.safetensors')).outcome).toBe('unavailable');
    sync.stop();
    db.close();
  });

  it('"Skip this file" keeps it out of every sync and out of the failures until it is turned off', async () => {
    const fake = server((name) => (name === 'c.safetensors' ? new Error('down') : header()));
    const db = openDb();
    const sync = service(fake.open, { now: () => NOW });
    await sync.runSync(db);
    const skipped = sync.setSkipped(db, 'loras', 'c.safetensors', true);
    expect(records(db)).toEqual({});
    expect(skipped.unreadable).toEqual([expect.objectContaining({ name: 'c.safetensors', skipped: true, reason: 'failed', retryAt: null })]);
    // A day later every wait is over, but a skipped file is still not asked.
    const later = service(fake.open, { now: () => NOW + 2 * 24 * 3_600_000 });
    fake.asked.length = 0;
    await later.runSync(db);
    expect(fake.asked).not.toContain('c.safetensors');
    later.setSkipped(db, 'loras', 'c.safetensors', false);
    await later.runSync(db);
    expect(fake.asked).toContain('c.safetensors');
    later.stop();
    sync.stop();
    db.close();
  });

  it('"Try all again" clears every wait and syncs', async () => {
    let broken = true;
    const fake = server((name) => (broken && name !== 'a.safetensors' ? new Error('down') : header()));
    const db = openDb();
    const sync = service(fake.open);
    await sync.runSync(db);
    expect(Object.keys(records(db))).toHaveLength(4);
    broken = false;
    const status = await sync.retryAll(db);
    expect(records(db)).toEqual({});
    expect(status.unreadable).toEqual([]);
    sync.stop();
    db.close();
  });
});

describe('the listing "try again" answer', () => {
  it('is understood with its wait, kept within bounds', () => {
    const answer = (error: unknown): McpToolCallResult => ({ isError: true, content: [{ type: 'text', text: JSON.stringify({ error }) }] });
    expect(retryableAnswer(answer({ code: 'COMFY_UNAVAILABLE', retryable: true, retry_after_ms: 1000 }))).toEqual({ waitMs: 1000, code: 'COMFY_UNAVAILABLE' });
    expect(retryableAnswer(answer({ retryable: true, retry_after_ms: 600_000 }))?.waitMs).toBe(4000);
    expect(retryableAnswer(answer({ retryable: true }))?.waitMs).toBe(1000);
    expect(retryableAnswer(answer({ code: 'X', retryable: false }))).toBeNull();
    expect(retryableAnswer(json({ items: [] }))).toBeNull();
  });
});

describe('the words of the report', () => {
  const rows: UnreadableItem[] = [
    { kind: 'model', directory: 'loras', name: 'broken.safetensors', reason: 'dropped', lastAt: NOW, retryAt: NOW + 86_400_000, skipped: false },
    { kind: 'model', directory: 'checkpoints', name: 'odd.safetensors', reason: 'serverError', detail: 'bad header', lastAt: NOW, retryAt: NOW + 3_600_000, skipped: false },
    { kind: 'model', directory: 'vae', name: 'skip.safetensors', reason: 'failed', lastAt: NOW, retryAt: null, skipped: true },
    { kind: 'folder', name: 'upscale_models', reason: 'listing', lastAt: null, retryAt: null, skipped: false },
    { kind: 'section', name: 'node packs', reason: 'comfyDown', lastAt: null, retryAt: null, skipped: false },
  ];

  it('names each thing, says why and what to do, in both languages', () => {
    for (const language of ['en', 'ru'] as const) {
      const t = createTranslator(language);
      for (const row of rows) {
        for (const text of [rowLabel(row, t), rowWhy(row, t), rowTodo(row, t, language)]) {
          expect(text, `${language} ${row.name}`).not.toMatch(/sync\.unread|\{\{/);
          expect(text.length).toBeGreaterThan(5);
        }
      }
    }
    const en = createTranslator('en');
    expect(rowLabel(rows[0], en)).toBe('“broken.safetensors” in the folder “loras”');
    expect(rowTodo(rows[0], en, 'en')).toMatch(/damaged/);
    expect(rowWhy(rows[1], en)).toBe('The server answered with an error: bad header');
    expect(rowLabel(rows[4], en)).toBe('Catalog: the list of packs');
    expect(rowTodo(rows[4], en, 'en')).toBe('Start ComfyUI and sync again.');
  });

  it('copies as plain text, one line per row, with the summary', () => {
    const t = createTranslator('en');
    const text = reportText(rows, 'Model files read: 10 of 13; could not be read: 2; skipped: 1.', t, 'en');
    const lines = text.split('\n');
    expect(lines[0]).toBe('Could not be read');
    expect(lines[1]).toMatch(/^Model files read: 10 of 13/);
    expect(lines.filter((line) => line.startsWith('- '))).toHaveLength(rows.length);
  });

  it('logs counts and reasons only', () => {
    const line = logSummary(10, 13, rows);
    expect(line).toBe('[Sync] Metadata read 10 of 13; 2 could not be read (dropped=1 serverError=1); 1 skipped; 2 lists not read');
    expect(line).not.toMatch(/safetensors|loras/);
  });

  it('builds rows from the stored records, files first, with the time of the next try', () => {
    const state = {
      enrich_failures: JSON.stringify({ 'loras/sub/x.safetensors': { attempts: 2, lastAt: NOW, reason: 'timeout' }, 'loras/old.safetensors': { attempts: 1, lastAt: NOW } }),
      enrich_skipped: JSON.stringify({ 'vae/s.safetensors': { at: NOW, reason: 'dropped' } }),
      unread_parts: JSON.stringify([{ kind: 'section', name: 'node classes', reason: 'listing' }]),
    };
    expect(unreadableRows(state).map((row) => [row.kind, row.directory, row.name, row.reason, row.retryAt, row.skipped])).toEqual([
      ['model', 'loras', 'old.safetensors', 'failed', NOW + 3_600_000, false],
      ['model', 'loras', 'sub/x.safetensors', 'timeout', NOW + 6 * 3_600_000, false],
      ['model', 'vae', 's.safetensors', 'dropped', null, true],
      ['section', undefined, 'node classes', 'listing', null, false],
    ]);
  });
});
