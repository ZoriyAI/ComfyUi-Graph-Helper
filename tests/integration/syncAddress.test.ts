import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { migrate } from '../../src/main/settings/migrate';
import { folderUnreadWarning, mcpReadOutcome, SyncService } from '../../src/main/mcp/sync';
import { createTranslator, translateKnownError } from '../../src/shared/i18n';
import { syncSummary, syncView } from '../../src/renderer/components/sync/syncView';
import { startFakeMcp, type FakeMcp } from '../fixtures/mcp/fakeMcpServer';
import { startMcpProxy, toolText, type McpProxy } from '../fixtures/mcp/mcpProxy';

/**
 * The sync when the address changes, when one model folder fails, and without an address. TEST fixtures only:
 * fake MCP servers and a misbehaving proxy on 127.0.0.1 (tests/fixtures/mcp).
 */
const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (closers.length > 0) await closers.pop()?.();
});

async function fakeServer(): Promise<FakeMcp> {
  const fake = await startFakeMcp();
  closers.push(fake.close);
  return fake;
}

async function proxyFor(target: string): Promise<McpProxy> {
  const proxy = await startMcpProxy(target);
  closers.push(proxy.close);
  return proxy;
}

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

function service(address: { url: string }): SyncService {
  return new SyncService({
    readUrl: () => address.url,
    readComfyOrigin: () => '',
    token: () => null,
    checkTokenOrigin: () => undefined,
    readEnrichment: () => ({ scope: 'loaders', perRun: 1000, pauseMs: 0 }),
    readLookupOnline: () => false,
  });
}

const toolCalls = (fake: FakeMcp) => fake.calls.filter((call) => call.method === 'tools/call').length;

describe('a new address in Settings', () => {
  it('marks the library as read from the old address until the new one is read', async () => {
    const first = await fakeServer();
    const second = await fakeServer();
    const address = { url: first.url };
    const db = openDb();
    const sync = service(address);
    const read = await sync.runSync(db);
    expect(read).toMatchObject({ state: 'idle', libraryUrl: first.url, libraryElsewhere: false });
    expect(syncView(read).labelKey).toBe('sync.state.idle');

    address.url = second.url;
    const changed = sync.addressChanged(db);
    expect(changed).toMatchObject({ libraryUrl: first.url, libraryElsewhere: true });
    // Not "up to date": the indicator says where the library is from and offers to read the new address.
    const view = syncView(changed);
    expect(view).toMatchObject({ labelKey: 'sync.state.elsewhere', hintKey: 'sync.elsewhereHint', warned: true });
    await new Promise((resolve) => setTimeout(resolve, 200));
    // Auto sync is off: nothing was asked of the new server on its own.
    expect(toolCalls(second)).toBe(0);

    const reread = await sync.runSync(db);
    expect(reread).toMatchObject({ state: 'idle', libraryUrl: second.url, libraryElsewhere: false });
    sync.stop();
    db.close();
  });

  it('cancels a run for the old address and, with auto sync on, reads the new one', async () => {
    const first = await fakeServer();
    const second = await fakeServer();
    const slow = await proxyFor(first.url);
    const address = { url: slow.url };
    const db = openDb();
    const sync = service(address);
    await sync.runSync(db);
    const firstSyncAt = sync.status(db).lastSyncAt;
    sync.setAuto(db, true, 30);

    slow.state.delayMs = 300;
    const running = sync.runSync(db);
    await new Promise((resolve) => setTimeout(resolve, 500));
    address.url = second.url;
    sync.addressChanged(db);
    const cancelled = await running;
    // The cancelled run left no result behind: the last successful read is still the first one.
    expect(cancelled.lastSyncAt).toBe(firstSyncAt);

    // Auto sync is on, so the new address is read right after.
    await expect.poll(() => sync.status(db).libraryUrl, { timeout: 20_000 }).toBe(second.url);
    expect(sync.status(db)).toMatchObject({ libraryElsewhere: false, state: 'idle' });
    sync.stop();
    db.close();
  });
});

describe('a model folder that cannot be read', () => {
  it('is named in the summary, keeps its old list, and turns the indicator amber', async () => {
    const fake = await fakeServer();
    const proxy = await proxyFor(fake.url);
    const db = openDb();
    const sync = service({ url: proxy.url });
    const full = await sync.runSync(db);
    const before = full.counts.models;

    proxy.state.rules = [{ match: 'models:loras', result: toolText({ error: { code: 'INTERNAL', message: 'boom' } }, true) }];
    const partial = await sync.runSync(db);
    expect(partial.warnings).toContain(folderUnreadWarning('loras'));
    expect(partial.counts.models).toBe(before);
    expect(syncView(partial)).toMatchObject({ warned: true, labelKey: 'sync.state.warned' });
    const ru = translateKnownError(createTranslator('ru'), folderUnreadWarning('loras'));
    expect(ru).toBe('Папку моделей «loras» прочитать не удалось, в библиотеке остался её прежний список. Синхронизируйте снова, чтобы повторить.');
    sync.stop();
    db.close();
  });
});

describe('without an address', () => {
  it('does not run, is not a failure, and auto sync stays off', async () => {
    const db = openDb();
    const sync = service({ url: '' });
    const status = await sync.runSync(db);
    expect(status).toMatchObject({ state: 'never', lastError: null, mcpUrl: '' });
    expect(syncView(status)).toMatchObject({ blocked: 'noUrl', hintKey: 'sync.noUrl' });
    expect(sync.setAuto(db, true, 30).auto.enabled).toBe(false);
    db.close();
  });
});

describe('the summary of a run', () => {
  it('is one sentence that does not repeat the title, with one model counter', async () => {
    const fake = await fakeServer();
    const db = openDb();
    const sync = service({ url: fake.url });
    const status = await sync.runSync(db);
    const summary = syncSummary(status);
    const ru = createTranslator('ru');
    const en = createTranslator('en');
    const text = ru(summary.key, summary.params);
    expect(text).toMatch(/^Прочитано нод: \d+, паков: \d+, файлов моделей: \d+\.$/);
    expect(text).not.toContain('Синхронизировано');
    expect(en(summary.key, summary.params)).toMatch(/^Read \d+ nodes, \d+ packs and \d+ model files\.$/);
    expect(ru('sync.toastContinuing', { ...summary.params, done: 3, total: 9 })).toMatch(/читаются дальше: 3 из 9\.$/);
    // "Read through MCP" runs this same sync and reports it the same way.
    expect(mcpReadOutcome(status)).toMatchObject({ ok: true, nodes: status.counts.nodeClasses, models: status.counts.models });
    sync.stop();
    db.close();
  });
});
