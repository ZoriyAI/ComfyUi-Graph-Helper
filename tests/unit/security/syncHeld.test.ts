/**
 * Protects automatic catalog sync with an MCP server after a run that never finished (the app crashed or was
 * killed during it). The open-run mark left in the database holds the schedule until the person starts a sync
 * by hand, so a sync that crashed or froze the app does not run again on every start without their say.
 */
import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { migrate } from '../../../src/main/settings/migrate';
import { readState, STARTUP_DELAY_MS, SyncService } from '../../../src/main/mcp/sync';
import type { McpSession } from '../../../src/shared/mcp/catalogSource';

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  db.prepare("INSERT INTO settings (id, theme, motion, provider, model, comfy_origin, base_url, mcp_url, language, updated_at) VALUES (1, 'dark', 'system', 'openai', 'x', '', '', 'https://mcp.example.test/mcp', 'en', 0)").run();
  db.prepare("INSERT INTO sync_state (key, value) VALUES ('auto_enabled', '1'), ('auto_interval_minutes', '30')").run();
  return db;
}

function service(opened: { count: number }) {
  const session: McpSession = {
    async listTools() { return []; },
    async callTool() { throw new Error('not called'); },
    async close() {},
  };
  return new SyncService({
    token: () => 'fixture-token-not-a-secret',
    readUrl: (db) => (db.prepare('SELECT mcp_url FROM settings WHERE id = 1').get() as { mcp_url: string }).mcp_url,
    factory: async () => { opened.count += 1; return session; },
    fetchImpl: (async () => { throw new Error('no network'); }) as unknown as typeof fetch,
    now: () => 1_700_000_000_000,
  });
}

describe('a sync that never ended holds automatic sync', () => {
  it('marks a run while it is in flight and clears the mark when it ends', async () => {
    const db = openDb();
    const sync = service({ count: 0 });
    const run = sync.runSync(db);
    expect(readState(db).run_open).toBe('1700000000000');
    await run;
    expect(readState(db).run_open).toBeUndefined();
    sync.stop();
  });

  it('after a start that finds the mark, no automatic run until the person starts one; then the schedule is back', async () => {
    vi.useFakeTimers();
    try {
      const db = openDb();
      // The mark a previous start left behind when its run never ended.
      db.prepare("INSERT INTO sync_state (key, value) VALUES ('run_open', '1699999999000')").run();
      const opened = { count: 0 };
      const sync = service(opened);
      const started = sync.start(db);
      expect(started).toMatchObject({ autoHeld: true, nextRunAt: null });
      await vi.advanceTimersByTimeAsync(STARTUP_DELAY_MS + 60 * 60_000);
      expect(opened.count).toBe(0);
      // The person presses Sync now.
      await sync.runSync(db);
      expect(opened.count).toBe(1);
      expect(sync.status(db).autoHeld).toBe(false);
      expect(sync.status(db).nextRunAt).not.toBeNull();
      sync.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
