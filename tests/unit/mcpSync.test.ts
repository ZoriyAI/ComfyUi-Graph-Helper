import { afterEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { modelDetail, searchModels } from '../../src/main/knowledge/repository';
import { SyncService } from '../../src/main/mcp/sync';
import { isReadOnlyCall, McpRefusedError, readOnlySession, READ_ONLY_TOOLS } from '../../src/main/mcp/readOnly';
import type { McpSession, McpToolCallResult } from '../../src/shared/mcp/catalogSource';
import type { SyncStatus } from '../../src/shared/contracts/knowledge';
import { parseSidecar, stringifyMetadata } from '../../src/shared/knowledge/enrichment';

const TOKEN = 'tok-very-secret-123';

function json(value: unknown): McpToolCallResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

interface FakeOptions {
  tools?: string[];
  calls: Array<{ name: string; args: Record<string, unknown> }>;
  metadata?: (name: string) => McpToolCallResult | Error;
}

/** A deterministic stand-in for the home ComfyUI MCP server. Labelled test fixture, not a discovered environment. */
function fakeSession(options: FakeOptions): McpSession {
  return {
    async listTools() {
      return (options.tools ?? ['studio_info', 'studio_capabilities', 'models', 'model_metadata']).map((name) => ({ name }));
    },
    async callTool(name, args) {
      options.calls.push({ name, args });
      if (name === 'studio_info') return json({ installation_id: 'home-comfyui', comfyui_url: null });
      if (name === 'studio_capabilities' && args.kind === 'packs') {
        return json({
          items: args.cursor === '2'
            ? [{ name: 'rgthree-comfy', installed_state: 'installed', import_state: 'imported', version: '1.0', commit: 'abc', imported_class_count: 40 }]
            : [{ name: 'comfyui-kjnodes', installed_state: 'installed', import_state: 'imported', version: null, commit: null }],
          next_cursor: args.cursor === '2' ? null : '2',
        });
      }
      if (name === 'studio_capabilities') {
        return json({ items: [{ class_type: 'LoraLoader', module: 'nodes', display_name: 'Load LoRA', category: 'loaders' }] });
      }
      if (name === 'models') {
        return json({
          items: [
            { category: 'loras', filename: 'zimage_style.safetensors', root_path: '/m/loras', size_bytes: 10 },
            { category: 'loras', filename: 'Band_Shirt_Crop_Top_SDXL.safetensors', root_path: '/m/loras', size_bytes: 11 },
            { category: 'loras', filename: 'old.pt', root_path: '/m/loras', size_bytes: 12 },
            { category: 'checkpoints', filename: 'mystery.safetensors', root_path: '/m/checkpoints', size_bytes: 13 },
            { category: 'sams', filename: 'sam_vit_b.pth', root_path: '/m/sams', size_bytes: 14 },
          ],
        });
      }
      if (name === 'model_metadata') {
        const answer = options.metadata?.(String(args.name)) ?? json({ model_explorer: 'unavailable', embedded_metadata: {}, civitai_sidecar: null });
        if (answer instanceof Error) throw answer;
        return answer;
      }
      throw new Error(`unexpected tool ${name}`);
    },
    async close() {},
  };
}

function openDb(url = 'https://mcp.example.test/mcp'): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  db.prepare("INSERT INTO settings (id, theme, motion, provider, model, comfy_origin, base_url, mcp_url, language, updated_at) VALUES (1, 'dark', 'system', 'openai', 'x', '', '', ?, 'en', 0)").run(url);
  return db;
}

function service(options: FakeOptions, extra: Partial<ConstructorParameters<typeof SyncService>[0]> = {}) {
  const tokens: Array<string | null> = [];
  const sync = new SyncService({
    token: () => TOKEN,
    readUrl: (db) => (db.prepare('SELECT mcp_url FROM settings WHERE id = 1').get() as { mcp_url: string } | undefined)?.mcp_url ?? '',
    factory: async (_url, token) => {
      tokens.push(token);
      return fakeSession(options);
    },
    fetchImpl: (async () => { throw new Error('no network in unit tests'); }) as unknown as typeof fetch,
    now: () => 1_700_000_000_000,
    ...extra,
  });
  return { sync, tokens };
}

afterEach(() => vi.restoreAllMocks());

describe('read-only MCP allowlist', () => {
  it('allows only reading actions and refuses everything else at the session', async () => {
    expect(Object.keys(READ_ONLY_TOOLS).sort()).toEqual(['comfy_api', 'list_local_models', 'model_metadata', 'models', 'studio_capabilities', 'studio_info']);
    expect(isReadOnlyCall('models', { action: 'list' })).toBe(true);
    expect(isReadOnlyCall('models', { action: 'inspect' })).toBe(false);
    expect(isReadOnlyCall('models', { action: 'download' })).toBe(false);
    expect(isReadOnlyCall('models', { action: 'remove' })).toBe(false);
    expect(isReadOnlyCall('model_metadata', { action: 'propose' })).toBe(false);
    expect(isReadOnlyCall('model_metadata', { action: 'fetch_civitai' })).toBe(false);
    expect(isReadOnlyCall('comfy_api', { method: 'POST', route: '/prompt' })).toBe(false);
    expect(isReadOnlyCall('comfy_api', { method: 'GET', route: '/object_info' })).toBe(true);
    expect(isReadOnlyCall('comfy_api', { method: 'get', route: '/object_info' })).toBe(false);
    expect(isReadOnlyCall('list_local_models', { action: 'list' })).toBe(true);
    expect(isReadOnlyCall('list_local_models', { action: 'list', model_type: 'loras' })).toBe(true);
    for (const tool of ['install_custom_node', 'download_model', 'nodepacks', 'workflow_run', 'enqueue_workflow', 'restart_comfyui', 'clear_vram', 'stage_file', 'artifact_import_begin', 'toString', '__proto__']) {
      expect(isReadOnlyCall(tool, { action: 'list' }), tool).toBe(false);
    }
    const calls: FakeOptions['calls'] = [];
    const guarded = readOnlySession(fakeSession({ calls }));
    await expect(guarded.callTool('comfy_api', { method: 'GET', route: '/object_info', body: '{}' })).rejects.toBeInstanceOf(McpRefusedError);
    await expect(guarded.callTool('models', { action: 'remove', filename: 'x' })).rejects.toBeInstanceOf(McpRefusedError);
    await expect(guarded.callTool('enqueue_workflow', {})).rejects.toBeInstanceOf(McpRefusedError);
    expect(calls).toEqual([]);
  });
});

describe('strict read-only argument shapes', () => {
  const allowed: Array<[string, Record<string, unknown>]> = [
    ['comfy_api', { method: 'GET', route: '/system_stats' }],
    ['studio_info', { action: 'describe' }],
    ['studio_info', { action: 'paths' }],
    ['studio_capabilities', { section: 'nodes', kind: 'classes', limit: 100, cursor: 'abc' }],
    ['studio_capabilities', { section: 'models' }],
    ['models', { action: 'list', category: 'loras', limit: 10, cursor: '2' }],
    ['model_metadata', { action: 'read', category: 'loras', name: 'x.safetensors' }],
    ['list_local_models', { action: 'list' }],
  ];
  const refused: Array<[string, Record<string, unknown>]> = [
    ['comfy_api', { method: 'GET', route: '/prompt' }],
    ['comfy_api', { method: 'GET', route: '/object_info', body: {} }],
    ['comfy_api', { method: 'POST', route: '/object_info' }],
    ['comfy_api', { method: 'DELETE', route: '/queue' }],
    ['comfy_api', { method: 'GET', route: '/history', query: 'x' }],
    ['studio_info', { action: 'restart' }],
    ['studio_info', {}],
    ['studio_info', { action: 'describe', extra: 1 }],
    ['studio_capabilities', { section: 'jobs' }],
    ['studio_capabilities', { section: 'nodes', kind: 'install' }],
    ['studio_capabilities', { section: 'nodes', kind: 'classes', limit: 0 }],
    ['studio_capabilities', { section: 'nodes', action: 'install' }],
    ['models', { action: 'inspect', root_path: '/m', filename: 'x' }],
    ['models', { action: 'list', filename: 'x' }],
    ['models', { action: 'download', url: 'https://x' }],
    ['model_metadata', { action: 'read', category: 'loras' }],
    ['model_metadata', { action: 'read', category: 'loras', name: 'x', write: true }],
    ['model_metadata', { action: 'write', category: 'loras', name: 'x' }],
    ['list_local_models', { action: 'list', path: '/etc' }],
    ['list_local_models', { action: 'delete' }],
  ];

  it('accepts the shapes the app sends', () => {
    for (const [tool, args] of allowed) expect(isReadOnlyCall(tool, args), `${tool} ${JSON.stringify(args)}`).toBe(true);
  });

  it('refuses every other shape, including extra fields', async () => {
    for (const [tool, args] of refused) expect(isReadOnlyCall(tool, args), `${tool} ${JSON.stringify(args)}`).toBe(false);
    const calls: FakeOptions['calls'] = [];
    const guarded = readOnlySession(fakeSession({ calls }));
    for (const [tool, args] of refused) await expect(guarded.callTool(tool, args)).rejects.toBeInstanceOf(McpRefusedError);
    expect(calls).toEqual([]);
  });
});

describe('sync service', () => {
  it('reads packs and models, enriches metadata, and reports status transitions', async () => {
    const db = openDb();
    const calls: FakeOptions['calls'] = [];
    const logs = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    const { sync, tokens } = service({
      calls,
      metadata: (name) => {
        if (name === 'zimage_style.safetensors') {
          return json({
            model_explorer: 'unavailable',
            embedded_metadata: { ss_base_model_version: 'zimage', ss_num_train_images: 119, 'modelspec.architecture': 'zimage/lora' },
            civitai_sidecar: { id: 222, modelId: 111, baseModel: 'ZImageTurbo', trainedWords: ['zstyle, painterly'], model: { description: '<p>A <b>style</b> LoRA.</p>' } },
          });
        }
        if (name === 'mystery.safetensors') return new Error('tool failed');
        return { isError: true, content: [{ type: 'text', text: 'not found' }] };
      },
    });
    const seen: SyncStatus[] = [];
    sync.onStatus((status) => seen.push(status));
    expect(sync.status(db).state).toBe('never');

    const status = await sync.runSync(db);

    expect(tokens).toEqual([TOKEN]);
    expect(seen[0].state).toBe('running');
    expect(seen.some((item) => item.progress?.phase === 'enrich')).toBe(true);
    expect(seen[seen.length - 1].state).toBe('idle');
    expect(status).toMatchObject({
      state: 'idle',
      lastSyncAt: 1_700_000_000_000,
      lastError: null,
      mcpUrl: 'https://mcp.example.test/mcp',
      tokenHeld: true,
      auto: { enabled: false, intervalMinutes: 30 },
      counts: { nodeClasses: 1, packs: 2, models: 5, enrichedModels: 4 },
      progress: null,
    });
    expect(db.prepare('SELECT name, class_count, synced_at FROM node_packs ORDER BY name').all()).toEqual([
      { name: 'comfyui-kjnodes', class_count: null, synced_at: 1_700_000_000_000 },
      { name: 'rgthree-comfy', class_count: 40, synced_at: 1_700_000_000_000 },
    ]);
    expect(modelDetail(db, 'loras', 'zimage_style.safetensors')).toMatchObject({
      kind: 'lora',
      baseModel: 'zimage',
      baseModelEvidence: 'metadata',
      triggerWords: ['zstyle', 'painterly'],
      description: 'A style LoRA.',
      sourceUrl: 'https://civitai.com/models/111?modelVersionId=222',
      metadata: { ss_base_model_version: 'zimage', ss_num_train_images: '119', 'modelspec.architecture': 'zimage/lora' },
      rootPath: '/m/loras',
      enriched: true,
    });
    expect(modelDetail(db, 'loras', 'Band_Shirt_Crop_Top_SDXL.safetensors')).toMatchObject({ baseModel: 'sdxl', baseModelEvidence: 'filename', enriched: true });
    expect(modelDetail(db, 'checkpoints', 'mystery.safetensors')).toMatchObject({ baseModel: 'unknown', baseModelEvidence: 'none', kind: 'checkpoint', enriched: true });
    // Not a loader folder: no enrichment, but the name inference still ran.
    expect(modelDetail(db, 'sams', 'sam_vit_b.pth')).toMatchObject({ kind: 'other', enriched: false });
    // Only header files are read; old.pt is enriched from its name without a call.
    const metadataCalls = calls.filter((call) => call.name === 'model_metadata').map((call) => call.args.name).sort();
    expect(metadataCalls).toEqual(['Band_Shirt_Crop_Top_SDXL.safetensors', 'mystery.safetensors', 'zimage_style.safetensors']);
    expect(calls.every((call) => isReadOnlyCall(call.name, call.args))).toBe(true);
    expect(JSON.stringify(calls)).not.toContain(TOKEN);
    expect(JSON.stringify(seen)).not.toContain(TOKEN);
    expect(JSON.parse((db.prepare("SELECT value FROM sync_state WHERE key = 'server_identity'").get() as { value: string }).value))
      .toEqual({ installation_id: 'home-comfyui', comfyui_url: null });
    for (const spy of logs) expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
    expect(JSON.stringify(db.prepare('SELECT * FROM sync_state').all())).not.toContain(TOKEN);

    // A second run has nothing left to enrich but keeps file-name inference for every model.
    calls.length = 0;
    await sync.runSync(db);
    expect(calls.filter((call) => call.name === 'model_metadata')).toEqual([]);
    expect(searchModels(db, { query: '', baseModel: 'sdxl' }).map((item) => item.name)).toEqual(['Band_Shirt_Crop_Top_SDXL.safetensors']);
    db.close();
  });

  it('enriches from names and keeps going when the metadata tool is missing', async () => {
    const db = openDb();
    const calls: FakeOptions['calls'] = [];
    const { sync } = service({ calls, tools: ['studio_capabilities', 'models'] }, { enrichLimit: 2 });
    const status = await sync.runSync(db);
    expect(status).toMatchObject({ state: 'idle', lastError: null, counts: { enrichedModels: 2 } });
    expect(calls.some((call) => call.name === 'model_metadata')).toBe(false);
    db.close();
  });

  it('reports an error only when every metadata read failed', async () => {
    const db = openDb();
    const { sync } = service({ calls: [], metadata: () => new Error('down') });
    const status = await sync.runSync(db);
    expect(status).toMatchObject({ state: 'error', lastError: 'Model metadata could not be read.', counts: { enrichedModels: 4 } });
    db.close();
  });

  it('reports a refused token, an empty URL, and joins a run already in flight', async () => {
    const db = openDb();
    const refused = new SyncService({
      token: () => TOKEN,
      readUrl: () => 'https://x.test/mcp',
      factory: async () => {
        throw new Error(`HTTP 401 Unauthorized Bearer ${TOKEN}`);
      },
    });
    const status = await refused.runSync(db);
    expect(status).toMatchObject({ state: 'error', lastError: 'MCP server refused the token.', lastSyncAt: null });
    expect(JSON.stringify(status)).not.toContain(TOKEN);

    const empty = new SyncService({ token: () => null, readUrl: () => '' });
    expect(await empty.runSync(db)).toMatchObject({ state: 'error', lastError: 'MCP server URL is empty.', tokenHeld: false });

    const calls: FakeOptions['calls'] = [];
    const { sync, tokens } = service({ calls });
    const first = sync.runSync(db);
    const second = sync.runSync(db);
    expect(second).toBe(first);
    expect((await first).state).toBe('idle');
    expect(tokens).toHaveLength(1);
    db.close();
  });

  it('persists the auto schedule, clamps the interval, and runs on the timer', async () => {
    vi.useFakeTimers();
    try {
      const db = openDb();
      const calls: FakeOptions['calls'] = [];
      const { sync, tokens } = service({ calls });
      expect(sync.start(db).auto).toEqual({ enabled: false, intervalMinutes: 30 });
      expect(sync.setAuto(db, true, 1).auto).toEqual({ enabled: true, intervalMinutes: 5 });
      const restarted = service({ calls }).sync;
      expect(restarted.start(db).auto).toEqual({ enabled: true, intervalMinutes: 5 });
      restarted.stop();
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      expect(tokens).toHaveLength(1);
      sync.setAuto(db, false, 30);
      await vi.advanceTimersByTimeAsync(60 * 60_000);
      expect(tokens).toHaveLength(1);
      sync.stop();
      db.close();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('metadata parsing', () => {
  it('stringifies non-string header values and reads flat sidecars', () => {
    expect(stringifyMetadata({ a: 'x', b: 2, c: { d: true }, e: null })).toEqual({ a: 'x', b: '2', c: '{"d":true}' });
    expect(parseSidecar({ baseModel: 'Pony', trainedWords: ['a', 'a', 'b'], modelId: '5', modelVersionId: 6, description: 'x &amp; y' }))
      .toEqual({ baseModel: 'Pony', trainedWords: ['a', 'b'], description: 'x & y', modelId: '5', modelVersionId: '6' });
    expect(parseSidecar(null)).toBeNull();
  });
});
