import { afterEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { modelDetail, searchModels } from '../../src/main/knowledge/repository';
import {
  catalogWarnings, classifySyncError, METADATA_STOPPED, NODE_PORTS_NO_URL, reportedComfyUrl, STARTUP_DELAY_MS, SyncService,
} from '../../src/main/mcp/sync';
import { createTranslator, translateKnownError } from '../../src/shared/i18n';
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
  /** Replaces the default model listing. */
  models?: Array<{ category: string; filename: string }>;
  closed?: { count: number };
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
      if (name === 'models' && options.models) {
        return json({ items: options.models.map((model) => ({ ...model, root_path: `/m/${model.category}`, size_bytes: 1 })) });
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
    async close() {
      if (options.closed) options.closed.count += 1;
    },
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
    expect(Object.keys(READ_ONLY_TOOLS).sort()).toEqual(['comfy_api', 'list_local_models', 'model_metadata', 'models', 'ollama_models', 'ollama_targets', 'studio_capabilities', 'studio_info']);
    expect(isReadOnlyCall('ollama_targets', {})).toBe(true);
    expect(isReadOnlyCall('ollama_targets', { target: 'ollama_5090' })).toBe(false);
    expect(isReadOnlyCall('ollama_models', { target: 'ollama_5090' })).toBe(true);
    expect(isReadOnlyCall('ollama_models', {})).toBe(false);
    expect(isReadOnlyCall('ollama_models', { target: '' })).toBe(false);
    expect(isReadOnlyCall('ollama_models', { target: 'x'.repeat(101) })).toBe(false);
    expect(isReadOnlyCall('ollama_models', { target: 'ollama_5090', model: 'qwen3:14b' })).toBe(false);
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
    for (const tool of ['install_custom_node', 'download_model', 'nodepacks', 'ollama_pull', 'ollama_load', 'ollama_unload', 'ollama_chat', 'ollama', 'workflow_run', 'enqueue_workflow', 'restart_comfyui', 'clear_vram', 'stage_file', 'artifact_import_begin', 'toString', '__proto__']) {
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
      // zimage_style read with metadata; old.pt was named only, so it does not count as a model with metadata.
      // The two failed reads stay unenriched for a retry.
      counts: { nodeClasses: 1, packs: 2, models: 5, enrichedModels: 1 },
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
    expect(modelDetail(db, 'loras', 'Band_Shirt_Crop_Top_SDXL.safetensors')).toMatchObject({ baseModel: 'sdxl', baseModelEvidence: 'filename', enriched: false });
    expect(modelDetail(db, 'checkpoints', 'mystery.safetensors')).toMatchObject({ baseModel: 'unknown', baseModelEvidence: 'none', kind: 'checkpoint', enriched: false });
    const failures = JSON.parse((db.prepare("SELECT value FROM sync_state WHERE key = 'enrich_failures'").get() as { value: string }).value);
    expect(failures).toEqual({
      'loras/Band_Shirt_Crop_Top_SDXL.safetensors': { attempts: 1, lastAt: 1_700_000_000_000 },
      'checkpoints/mystery.safetensors': { attempts: 1, lastAt: 1_700_000_000_000 },
    });
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
    expect(reportedComfyUrl(db)).toBeNull();
    for (const spy of logs) expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
    expect(JSON.stringify(db.prepare('SELECT * FROM sync_state').all())).not.toContain(TOKEN);

    // A second run within the hour skips the failed files and keeps file-name inference for every model.
    calls.length = 0;
    await sync.runSync(db);
    expect(calls.filter((call) => call.name === 'model_metadata')).toEqual([]);
    expect(searchModels(db, { query: '', baseModel: 'sdxl' }).map((item) => item.name)).toEqual(['Band_Shirt_Crop_Top_SDXL.safetensors']);
    db.close();
  });

  it('reads Preferences ▸ Sync on each run: scope "all" enriches every folder, per run caps the count', async () => {
    const db = openDb();
    db.prepare('UPDATE settings SET preferences_json = ? WHERE id = 1').run(JSON.stringify({ sync: { enrichmentScope: 'all', enrichPerRun: 10 } }));
    const { sync } = service({ calls: [] });
    await sync.runSync(db);
    expect(modelDetail(db, 'sams', 'sam_vit_b.pth')).toMatchObject({ enriched: true });

    // "Models per batch" paces the reading; it is not a stop: the rest follows in the background.
    const capped = openDb();
    const limited = service({ calls: [] }, { readEnrichment: () => ({ scope: 'loaders', perRun: 2, pauseMs: 0 }) });
    const status = await limited.sync.runSync(capped);
    // The batch holds two reads; their headers were empty, so they are read but carry no metadata.
    expect((capped.prepare('SELECT COUNT(*) AS n FROM model_catalog WHERE enriched_at IS NOT NULL').get() as { n: number }).n).toBe(2);
    expect(status.counts.enrichedModels).toBe(0);
    expect(status).toMatchObject({ state: 'idle', progress: { phase: 'enrichment', done: 2, total: 4 } });
    await limited.sync.whenEnrichmentDone();
    expect(limited.sync.status(capped)).toMatchObject({ state: 'idle', progress: null, metadata: { done: 4, total: 4 } });
    expect(modelDetail(capped, 'sams', 'sam_vit_b.pth')).toMatchObject({ enriched: false });
    db.close();
    capped.close();
  });

  it('enriches from names and keeps going when the metadata tool is missing', async () => {
    const db = openDb();
    const calls: FakeOptions['calls'] = [];
    const { sync } = service({ calls, tools: ['studio_capabilities', 'models'] }, { enrichLimit: 2, batchPauseMs: 0 });
    const status = await sync.runSync(db);
    // Name-only inference is not metadata: nothing counts as a model with metadata.
    expect(status).toMatchObject({ state: 'idle', lastError: null, counts: { enrichedModels: 0 } });
    expect((db.prepare('SELECT COUNT(*) AS n FROM model_catalog WHERE enriched_at IS NOT NULL').get() as { n: number }).n).toBe(2);
    await sync.whenEnrichmentDone();
    expect((db.prepare('SELECT COUNT(*) AS n FROM model_catalog WHERE enriched_at IS NOT NULL').get() as { n: number }).n).toBe(4);
    expect(calls.some((call) => call.name === 'model_metadata')).toBe(false);
    db.close();
  });

  it('reports an error only when every metadata read failed', async () => {
    const db = openDb();
    const { sync } = service({ calls: [], metadata: () => new Error('down') });
    const status = await sync.runSync(db);
    expect(status).toMatchObject({ state: 'error', lastError: 'Model metadata could not be read.', counts: { enrichedModels: 0 } });
    db.close();
  });

  it('retries failed metadata reads with a growing backoff, LoRAs first', async () => {
    const db = openDb();
    const calls: FakeOptions['calls'] = [];
    let clock = 1_700_000_000_000;
    let healthy = false;
    const { sync } = service({
      calls,
      metadata: () => (healthy ? json({ model_explorer: 'unavailable', embedded_metadata: { ss_base_model_version: 'sdxl_base_v1-0' }, civitai_sidecar: null }) : new Error('down')),
    }, { now: () => clock });
    const reads = () => calls.filter((call) => call.name === 'model_metadata').map((call) => `${call.args.category}/${call.args.name}`);
    await sync.runSync(db);
    expect(reads()).toEqual(['loras/Band_Shirt_Crop_Top_SDXL.safetensors', 'loras/zimage_style.safetensors', 'checkpoints/mystery.safetensors']);
    const steps: Array<[number, number]> = [[30 * 60_000, 0], [31 * 60_000, 3], [5 * 3_600_000, 0], [3_600_000 + 1, 3], [23 * 3_600_000, 0], [3_600_000 + 1, 3], [24 * 3_600_000, 3]];
    for (const [advance, expected] of steps) {
      calls.length = 0;
      clock += advance;
      await sync.runSync(db);
      expect(reads(), `after +${advance}`).toHaveLength(expected);
    }
    const failures = JSON.parse((db.prepare("SELECT value FROM sync_state WHERE key = 'enrich_failures'").get() as { value: string }).value);
    expect(failures['loras/zimage_style.safetensors'].attempts).toBe(5);
    expect(modelDetail(db, 'loras', 'zimage_style.safetensors')).toMatchObject({ enriched: false });
    healthy = true;
    clock += 24 * 3_600_000;
    await sync.runSync(db);
    expect(modelDetail(db, 'loras', 'zimage_style.safetensors')).toMatchObject({ enriched: true, baseModel: 'sdxl', baseModelEvidence: 'metadata' });
    expect(JSON.parse((db.prepare("SELECT value FROM sync_state WHERE key = 'enrich_failures'").get() as { value: string }).value)).toEqual({});
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

const metadataOk = () => json({ model_explorer: 'unavailable', embedded_metadata: { ss_base_model_version: 'sdxl_base_v1-0' }, civitai_sidecar: null });
const hundredLoras = Array.from({ length: 100 }, (_, index) => ({ category: 'loras', filename: `lora_${String(index).padStart(3, '0')}.safetensors` }));

describe('sync at startup', () => {
  it('runs about 5 s after start when auto sync is on and a token or sign-in is held', async () => {
    vi.useFakeTimers();
    try {
      const db = openDb();
      db.prepare("INSERT INTO sync_state (key, value) VALUES ('auto_enabled', '1'), ('auto_interval_minutes', '30')").run();
      const calls: FakeOptions['calls'] = [];
      let clock = 1_700_000_000_000;
      const { sync, tokens } = service({ calls }, { now: () => clock });
      const started = sync.start(db);
      expect(started).toMatchObject({ startupPending: true, nextRunAt: clock + STARTUP_DELAY_MS });
      await vi.advanceTimersByTimeAsync(STARTUP_DELAY_MS - 100);
      expect(tokens).toHaveLength(0);
      clock += STARTUP_DELAY_MS;
      await vi.advanceTimersByTimeAsync(200);
      await vi.waitFor(() => expect(sync.status(db).state).toBe('idle'));
      expect(tokens).toHaveLength(1);
      // The next automatic run comes one interval later.
      expect(sync.status(db)).toMatchObject({ startupPending: false, nextRunAt: clock + 30 * 60_000 });
      sync.stop();
      expect(sync.status(db).nextRunAt).toBeNull();
      db.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits for the interval when the last sync is recent, and does not start early without credentials', async () => {
    vi.useFakeTimers();
    try {
      const now = 1_700_000_000_000;
      const db = openDb();
      db.prepare("INSERT INTO sync_state (key, value) VALUES ('auto_enabled', '1'), ('auto_interval_minutes', '30'), ('last_sync_at', ?)").run(String(now - 10 * 60_000));
      const recent = service({ calls: [] }, { now: () => now });
      expect(recent.sync.start(db)).toMatchObject({ startupPending: false, nextRunAt: now + 20 * 60_000 });
      await vi.advanceTimersByTimeAsync(STARTUP_DELAY_MS * 2);
      expect(recent.tokens).toHaveLength(0);
      recent.sync.stop();

      const fresh = openDb();
      fresh.prepare("INSERT INTO sync_state (key, value) VALUES ('auto_enabled', '1'), ('auto_interval_minutes', '30')").run();
      const anonymous = service({ calls: [] }, { now: () => now, token: () => null, signedIn: () => false, authProvider: async () => null });
      expect(anonymous.sync.start(fresh)).toMatchObject({ startupPending: false, nextRunAt: now + 30 * 60_000 });
      await vi.advanceTimersByTimeAsync(STARTUP_DELAY_MS * 2);
      expect(anonymous.tokens).toHaveLength(0);
      anonymous.sync.stop();

      // A browser sign-in counts as credentials.
      const signed = service({ calls: [] }, { now: () => now, token: () => null, signedIn: () => true, authProvider: async () => null });
      expect(signed.sync.start(fresh)).toMatchObject({ startupPending: true });
      signed.sync.stop();
      // Auto sync off: nothing is scheduled.
      fresh.prepare("UPDATE sync_state SET value = '0' WHERE key = 'auto_enabled'").run();
      expect(service({ calls: [] }).sync.start(fresh)).toMatchObject({ startupPending: false, nextRunAt: null });
      db.close();
      fresh.close();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('background metadata reading', () => {
  it('reads a 100-file catalog in batches until every file is enriched, and ignores Sync now meanwhile', async () => {
    const db = openDb();
    const calls: FakeOptions['calls'] = [];
    const closed = { count: 0 };
    const { sync, tokens } = service({ calls, models: hundredLoras, metadata: metadataOk, closed }, { enrichLimit: 10, batchPauseMs: 1 });
    const seen: SyncStatus[] = [];
    sync.onStatus((status) => seen.push(status));
    const first = await sync.runSync(db);
    expect(first).toMatchObject({ state: 'idle', counts: { enrichedModels: 10 }, progress: { phase: 'enrichment', done: 10, total: 100 } });
    expect(closed.count).toBe(0);
    // Sync now during enrichment is ignored: no second connection.
    expect((await sync.runSync(db)).progress?.phase).toBe('enrichment');
    expect(tokens).toHaveLength(1);
    await sync.whenEnrichmentDone();
    const reads = calls.filter((call) => call.name === 'model_metadata').map((call) => call.args.name);
    expect(reads).toHaveLength(100);
    expect(reads).toEqual([...reads].sort());
    expect(sync.status(db)).toMatchObject({ state: 'idle', progress: null, metadata: { done: 100, total: 100 }, counts: { enrichedModels: 100 } });
    expect(closed.count).toBe(1);
    const enrichment = seen.filter((status) => status.progress?.phase === 'enrichment');
    expect(enrichment.length).toBeGreaterThan(0);
    expect(enrichment.every((status) => status.state === 'idle')).toBe(true);
    expect(Math.max(...enrichment.map((status) => status.progress!.done))).toBeGreaterThanOrEqual(90);
    // Nothing left: the next run reads no metadata.
    calls.length = 0;
    await sync.runSync(db);
    expect(calls.filter((call) => call.name === 'model_metadata')).toEqual([]);
    sync.stop();
    db.close();
  });

  it('stops after 5 failed reads in a row and leaves the rest to the backoff and the next run', async () => {
    const db = openDb();
    const calls: FakeOptions['calls'] = [];
    // The first 12 files read, then the tool goes down.
    const { sync } = service({
      calls,
      models: hundredLoras,
      metadata: (name) => (Number(name.slice(5, 8)) < 12 ? metadataOk() : new Error('down')),
    }, { enrichLimit: 10, batchPauseMs: 0 });
    await sync.runSync(db);
    await sync.whenEnrichmentDone();
    const status = sync.status(db);
    expect(status).toMatchObject({ state: 'idle', lastError: null, progress: null, counts: { enrichedModels: 12 } });
    expect(status.warnings).toEqual([NODE_PORTS_NO_URL, METADATA_STOPPED]);
    expect(calls.filter((call) => call.name === 'model_metadata')).toHaveLength(17);
    const failures = JSON.parse((db.prepare("SELECT value FROM sync_state WHERE key = 'enrich_failures'").get() as { value: string }).value);
    expect(Object.keys(failures)).toHaveLength(5);
    expect(translateKnownError(createTranslator('ru'), METADATA_STOPPED)).toMatch(/5 неудач/);
    sync.stop();
    db.close();
  });

  it('stop() and pause cancel the background reading without leaving timers or sessions behind', async () => {
    vi.useFakeTimers();
    try {
      const db = openDb();
      const calls: FakeOptions['calls'] = [];
      const closed = { count: 0 };
      const { sync } = service({ calls, models: hundredLoras, metadata: metadataOk, closed }, { enrichLimit: 10, batchPauseMs: 1500 });
      await sync.runSync(db);
      expect(sync.status(db).progress?.phase).toBe('enrichment');
      await vi.advanceTimersByTimeAsync(1500);
      expect(sync.status(db).counts.enrichedModels).toBe(20);
      sync.stop();
      await sync.whenEnrichmentDone();
      expect(closed.count).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(sync.status(db)).toMatchObject({ progress: null, counts: { enrichedModels: 20 } });

      // Pause: same, and the status says so until the next run, which picks up where it stopped.
      await sync.runSync(db);
      expect(sync.status(db).counts.enrichedModels).toBe(30);
      expect(sync.pauseEnrichment(db)).toMatchObject({ progress: null, enrichmentPaused: true, metadata: { done: 30, total: 100 } });
      expect(vi.getTimerCount()).toBe(0);
      const next = await sync.runSync(db);
      expect(next).toMatchObject({ enrichmentPaused: false, counts: { enrichedModels: 40 } });
      sync.stop();
      db.close();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('reported ComfyUI address', () => {
  it('returns the address the server named, with its own port, and null for a missing or broken row', () => {
    const db = new Database(':memory:');
    migrate(db);
    expect(reportedComfyUrl(db)).toBeNull();
    const put = db.prepare("INSERT INTO sync_state (key, value) VALUES ('server_identity', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    put.run(JSON.stringify({ installation_id: 'home', comfyui_url: 'http://127.0.0.1:28188' }));
    expect(reportedComfyUrl(db)).toBe('http://127.0.0.1:28188');
    put.run(JSON.stringify({ installation_id: 'home', comfyui_url: 'http://192.168.0.7:8188' }));
    expect(reportedComfyUrl(db)).toBe('http://192.168.0.7:8188');
    put.run(JSON.stringify({ installation_id: 'home', comfyui_url: null }));
    expect(reportedComfyUrl(db)).toBeNull();
    put.run('{not json');
    expect(reportedComfyUrl(db)).toBeNull();
    db.close();
  });
});

describe('sync error classification', () => {
  it('tells an unreachable server apart from a refused token', async () => {
    const db = openDb();
    const unreachable = new SyncService({
      token: () => TOKEN,
      readUrl: () => 'https://mcp.example.test:8443/mcp',
      factory: async () => {
        throw new TypeError('fetch failed', { cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }) });
      },
    });
    expect(await unreachable.runSync(db)).toMatchObject({ state: 'error', lastError: 'MCP server unreachable: mcp.example.test:8443.' });
    expect(classifySyncError(new Error('timeout'), 'http://127.0.0.1:9000/mcp')).toBe('MCP server unreachable: 127.0.0.1:9000.');
    expect(classifySyncError(new Error('HTTP 401 Unauthorized'), 'https://x.test/mcp')).toBe('MCP server refused the token.');
    expect(classifySyncError(new Error('bad json'), 'https://x.test/mcp')).toBe('MCP server was not read.');
    const en = createTranslator('en');
    const ru = createTranslator('ru');
    expect(translateKnownError(en, 'MCP server unreachable: mcp.example.test:8443.')).toBe('MCP server unreachable: mcp.example.test:8443. Check the address and that the server is running.');
    expect(translateKnownError(ru, 'MCP server unreachable: mcp.example.test:8443.')).toMatch(/^Сервер MCP недоступен: mcp\.example\.test:8443/);
    db.close();
  });

  it('reports ComfyUI not running, a failed section and missing node ports as warnings', () => {
    const base = { ok: true as const, tools: 5, nodes: 10, packs: 2, models: 3, skipped: [] };
    expect(catalogWarnings({ ...base, objectInfo: 'none', comfyUrl: 'http://127.0.0.1:28188', nativeComfy: 'unreachable', failedSections: ['model files'] })).toEqual([
      'MCP catalog section could not be read: model files.',
      'ComfyUI is not running at 127.0.0.1:28188 — node ports were not updated; start ComfyUI and sync again.',
    ]);
    expect(catalogWarnings({ ...base, objectInfo: 'native', comfyUrl: 'http://127.0.0.1:28188', nativeComfy: 'ok' })).toEqual([]);
    expect(catalogWarnings({ ...base, objectInfo: 'none', comfyUrl: null })).toEqual([NODE_PORTS_NO_URL]);
    const ru = createTranslator('ru');
    expect(translateKnownError(ru, 'ComfyUI is not running at 127.0.0.1:28188 — node ports were not updated; start ComfyUI and sync again.'))
      .toBe('ComfyUI не запущен на 127.0.0.1:28188 — порты нод не обновлены; запустите ComfyUI и синхронизируйте снова.');
    expect(translateKnownError(ru, 'MCP catalog section could not be read: node packs.')).toMatch(/паки нод/);
    expect(translateKnownError(createTranslator('en'), NODE_PORTS_NO_URL)).toBe(NODE_PORTS_NO_URL);
  });

  it('a run with ComfyUI down stores the warning and stays idle', async () => {
    const db = openDb();
    const { sync } = service({ calls: [] });
    const status = await sync.runSync(db);
    // The unit fake names no ComfyUI address and has no comfy_api.
    expect(status).toMatchObject({ state: 'idle', warnings: [NODE_PORTS_NO_URL] });
    db.close();
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
