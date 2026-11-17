/**
 * Protects the sync against an MCP server behind a gateway, which lists every tool as `gateway_comfy-<tool>`. The
 * sync must read it all the same, through the same read-only allowlist, and the call log must still name the tool.
 * It also pins what the person is told when node details cannot be read from this computer. Labelled fixture.
 */
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { SyncService } from '../../src/main/mcp/sync';
import { readCatalogViaMcp } from '../../src/main/mcp/client';
import { READ_ONLY_TOOLS, setMcpCallObserver, type McpCallNote } from '../../src/main/mcp/readOnly';
import { CLASSES, modelFileCount, PACKS, startFakeMcp, WRITE_TOOLS, type FakeMcp } from '../fixtures/mcp/fakeMcpServer';

const PREFIX = 'gateway_comfy-';
let fake: FakeMcp | null = null;

afterEach(async () => {
  setMcpCallObserver(null);
  await fake?.close();
  fake = null;
});

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

describe('a server whose tools carry a gateway prefix', () => {
  it('syncs everything through the prefixed names and calls nothing off the allowlist', async () => {
    fake = await startFakeMcp({ toolPrefix: PREFIX });
    const notes: McpCallNote[] = [];
    setMcpCallObserver((note) => notes.push(note));
    const db = openDb();
    const sync = new SyncService({ readUrl: () => fake!.url, token: () => null, checkTokenOrigin: () => undefined, readEnrichment: () => ({ scope: 'loaders', perRun: 40, pauseMs: 0 }) });
    const status = await sync.runSync(db);
    await sync.whenEnrichmentDone();
    sync.stop();
    expect(status.lastError).toBeNull();
    expect(status.counts.nodeClasses).toBe(CLASSES.length);
    expect(status.counts.packs).toBe(PACKS.length);
    expect(status.counts.models).toBe(modelFileCount());
    const tools = fake.calls.filter((call) => call.method === 'tools/call');
    expect(tools.length).toBeGreaterThan(0);
    for (const call of tools) {
      expect(call.tool!.startsWith(PREFIX), call.tool).toBe(true);
      const bare = call.tool!.slice(PREFIX.length);
      expect(Object.keys(READ_ONLY_TOOLS)).toContain(bare);
      // The fixture does not implement ranges, so only the bounded 8-byte prefix probe is expected.
      const headerPrefix = bare === 'workspace_files' && /\.(safetensors|sft)$/i.test(String(call.args?.absolute_path));
      if (headerPrefix) expect(call.args).toMatchObject({ action: 'read', encoding: 'base64', offset: 0, length: 8 });
      else expect(READ_ONLY_TOOLS[bare](call.args ?? {})).toBe(true);
      expect(WRITE_TOOLS as readonly string[]).not.toContain(bare);
    }
    // The log names the tool by its bare name and the name the call went out under.
    expect(notes.some((note) => note.tool === 'studio_capabilities' && note.remote === `${PREFIX}studio_capabilities`)).toBe(true);
  }, 30_000);
});

describe('a comfy_api that cannot send object_info', () => {
  it('falls back to the native address, and says plainly when that cannot be reached either', async () => {
    fake = await startFakeMcp({ comfyDown: true });
    const db = openDb();
    const read = await readCatalogViaMcp(db, { url: fake.url, token: null }, globalThis.fetch);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    // comfy_api answered { state: 'outcome_unknown', error: { code: 'COMFY_API_BODY_CAPACITY' } } with isError false.
    expect(read.objectInfo).toBe('none');
    expect(read.nativeComfy).toBe('unreachable');
    expect(read.nodes).toBe(CLASSES.length);
  }, 30_000);
});

import { catalogWarnings, NODE_DETAILS_ELSEWHERE } from '../../src/main/mcp/sync';
import { createTranslator, translateKnownError } from '../../src/shared/i18n';

describe('what the person is told when node details cannot be read from here', () => {
  const base = { ok: true as const, tools: 40, nodes: 900, packs: 30, models: 500, skipped: [], objectInfo: 'none' as const };

  it('says that ComfyUI answers only on its own computer when the server is on another one', () => {
    const viaGateway = 'https://gateway.example/gateway_comfy/mcp';
    expect(catalogWarnings({ ...base, comfyUrl: 'http://127.0.0.1:18188', nativeComfy: 'unreachable' }, viaGateway)).toEqual([NODE_DETAILS_ELSEWHERE]);
    expect(catalogWarnings({ ...base, comfyUrl: 'http://192.168.1.50:8188', nativeComfy: 'notAllowed' }, viaGateway)).toEqual([NODE_DETAILS_ELSEWHERE]);
    // On the same computer an address that does not answer is a ComfyUI that is not running.
    expect(catalogWarnings({ ...base, comfyUrl: 'http://127.0.0.1:18188', nativeComfy: 'unreachable' }, 'http://127.0.0.1:9000/mcp')[0]).toMatch(/^ComfyUI is not running at 127\.0\.0\.1:18188/);
  });

  it('says it in plain words in both languages', () => {
    // The code names "settings" of nodes; on screen they are fields.
    expect(translateKnownError(createTranslator('en'), NODE_DETAILS_ELSEWHERE)).toBe(NODE_DETAILS_ELSEWHERE.replace('inputs and settings of nodes', 'inputs and fields of nodes'));
    expect(translateKnownError(createTranslator('ru'), NODE_DETAILS_ELSEWHERE)).toMatch(/^Названия нод и модели прочитаны, а входы и настройки нод нет: сам ComfyUI отвечает только на своём компьютере\./);
  });
});
