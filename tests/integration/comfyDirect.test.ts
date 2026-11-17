/**
 * Protects the main first-run path: only a ComfyUI address, no MCP server. Nodes, packs, model files, headers and
 * previews are read from ComfyUI's own HTTP API through the read-only gate (src/main/comfy/direct.ts and the sync).
 * It also pins the exact sentences a person sees when ComfyUI is not running, still starting, or is an MCP address.
 * TEST fixture: a fake ComfyUI on 127.0.0.1 (tests/fixtures/comfy/fakeComfy.ts). Only GETs of read routes may go out.
 */
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { migrate } from '../../src/main/settings/migrate';
import { comfyPreviewSource, folderUnreadWarning, MCP_UNAVAILABLE_READ_COMFY, SyncService } from '../../src/main/mcp/sync';
import {
  checkComfy, COMFY_IS_MCP, COMFY_MODELS_NAMES_ONLY, COMFY_NODES_UNREAD, COMFY_NOT_COMFY, COMFY_PREVIEW_FILE, comfyUnreachable,
} from '../../src/main/comfy/direct';
import { PreviewReader } from '../../src/main/knowledge/preview';
import { createTranslator, translateKnownError } from '../../src/shared/i18n';
import { sourceSentence, syncView } from '../../src/renderer/components/sync/syncView';
import { CLASSES, modelFileCount, PACKS, startFakeMcp } from '../fixtures/mcp/fakeMcpServer';
import { BIG_PACK, READ_ROUTE, startFakeComfy, SUB_FOLDER_LORA, WEBP, type FakeComfyOptions } from '../fixtures/comfy/fakeComfy';
import { startPublicMcp } from '../fixtures/mcp/fakePublicMcp';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (closers.length > 0) await closers.pop()?.();
});

async function comfy(options: FakeComfyOptions = {}) {
  const fake = await startFakeComfy(options);
  closers.push(fake.close);
  return fake;
}

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

function service(address: { comfy: string; mcp?: string }): SyncService {
  return new SyncService({
    readUrl: () => address.mcp ?? '',
    readComfyOrigin: () => address.comfy,
    token: () => null,
    checkTokenOrigin: () => undefined,
    readEnrichment: () => ({ scope: 'loaders', perRun: 1000, pauseMs: 0 }),
    readLookupOnline: () => false,
    signedIn: () => false,
  });
}

/** Files the fixture lists: MODELS without the junk, plus the LoRA in a sub-folder. */
const listedFiles = modelFileCount() + 1;
const customPacks = PACKS.filter((pack) => pack.module.startsWith('custom_nodes.')).map((pack) => pack.module.slice('custom_nodes.'.length));
const packsWithNodes = new Set(CLASSES.map((def) => PACKS[def.pack].module).filter((module) => module.startsWith('custom_nodes.'))).size;

describe('a first run with only a ComfyUI address', () => {
  it.each(['unreachable', 'sign-in'])('keeps reading the saved ComfyUI when MCP is %s, with an explicit warning', async mode => {
    const fake = await comfy(); const db = openDb();
    const secured = mode === 'sign-in' ? await startFakeMcp({ token: 'fixture-only-access' }) : null;
    if (secured) closers.push(secured.close);
    const sync = service({ comfy: fake.url, mcp: secured?.url ?? 'http://127.0.0.1:9/mcp' });
    try {
      await sync.runSync(db); await sync.whenEnrichmentDone(); const status = sync.status(db);
      expect(status).toMatchObject({ state: 'idle', lastError: null, librarySource: 'comfy', libraryElsewhere: false });
      expect(status.counts.models).toBe(listedFiles);
      expect(status.warnings).toContain(MCP_UNAVAILABLE_READ_COMFY);
      expect((status.warnings ?? []).join(' ')).toMatch(mode === 'sign-in' ? /requires sign-in/ : /unreachable/);
      expect(translateKnownError(createTranslator('ru'), MCP_UNAVAILABLE_READ_COMFY)).toContain('напрямую');
      for (const hit of fake.hits) expect(hit).toMatch(READ_ROUTE);
      expect(JSON.stringify(db.prepare('SELECT * FROM sync_state').all())).not.toContain('fixture-only-access');
    } finally { sync.stop(); db.close(); }
  });

  it('reads nodes, packs, model files with sizes and folders, headers and previews, and asks only GETs of the read routes', async () => {
    const fake = await comfy({ manager: true });
    const db = openDb();
    const sync = service({ comfy: fake.url });
    const status = await sync.runSync(db);
    await sync.whenEnrichmentDone();
    expect(status).toMatchObject({ state: 'idle', lastError: null, librarySource: 'comfy', comfyOrigin: fake.url, mcpUrl: '' });
    expect(status.counts.nodeClasses).toBe(CLASSES.length);
    expect(status.counts.packs).toBe(customPacks.length);
    expect(status.counts.models).toBe(listedFiles);
    expect(status.warnings).toEqual([]);
    // One "read" state for every view.
    expect(syncView(status)).toMatchObject({ blocked: null, labelKey: 'sync.state.idle' });
    expect(sourceSentence(status)).toEqual({ key: 'sync.source.comfy', host: new URL(fake.url).host });

    const lora = db.prepare("SELECT size_bytes, root_path, preview_file, enriched_at, base_model, kind FROM model_catalog WHERE directory = 'loras' AND name = 'add-detail-xl.safetensors'").get() as Record<string, unknown>;
    expect(lora).toMatchObject({ size_bytes: 228_400_000, root_path: '/srv/comfyui/models/loras', preview_file: COMFY_PREVIEW_FILE, kind: 'lora', base_model: 'sdxl' });
    expect(lora.enriched_at).not.toBeNull();
    // The second path of a folder is kept: previews ask ComfyUI by its index.
    const second = db.prepare("SELECT root_path FROM model_catalog WHERE directory = 'loras' AND name = 'wan2.2_i2v_A14b_low_noise_lora_rank64_lightx2v_4step_1022.safetensors'").get() as { root_path: string };
    expect(second.root_path).toBe('/mnt/shared/loras');
    // A file without a preview is not marked.
    expect((db.prepare("SELECT preview_file FROM model_catalog WHERE directory = 'loras' AND name = 'pixel-art-xl.safetensors'").get() as { preview_file: string | null }).preview_file).toBeNull();

    for (const hit of fake.hits) expect(hit, hit).toMatch(READ_ROUTE);
    // The command line ComfyUI was started with is never kept.
    expect(JSON.stringify(db.prepare('SELECT * FROM sync_state').all())).not.toContain('--secret-flag');
    sync.stop();

    // A restart keeps it all: a new service on the same database says "read" at once, before any run.
    const restarted = service({ comfy: fake.url });
    const after = restarted.start(db);
    expect(after).toMatchObject({ state: 'idle', librarySource: 'comfy' });
    expect(after.lastSyncAt).toBe(status.lastSyncAt);
    expect(after.counts.nodeClasses).toBe(CLASSES.length);
    restarted.stop();
    db.close();
  }, 30_000);

  it('takes the packs from the node modules when no ComfyUI-Manager answers', async () => {
    const fake = await comfy({ manager: false });
    const db = openDb();
    const sync = service({ comfy: fake.url });
    const status = await sync.runSync(db);
    sync.stop();
    expect(status.counts.packs).toBe(packsWithNodes);
    expect(fake.hits).toContain('GET /customnode/installed');
    db.close();
  });

  it('accepts what a ComfyUI on Windows reports: drive letters, backslashes, sub-folders', async () => {
    const fake = await comfy({ windows: true });
    const db = openDb();
    const sync = service({ comfy: fake.url });
    const status = await sync.runSync(db);
    await sync.whenEnrichmentDone();
    expect(status.lastError).toBeNull();
    expect(status.counts.models).toBe(listedFiles);
    const sub = db.prepare("SELECT name, root_path, preview_file FROM model_catalog WHERE directory = 'loras' AND name = ?").get(SUB_FOLDER_LORA.replace('/', '\\')) as Record<string, unknown>;
    expect(sub).toMatchObject({ root_path: 'C:\\ComfyUI\\models\\loras', preview_file: COMFY_PREVIEW_FILE });
    const header = db.prepare("SELECT enriched_at, metadata_json FROM model_catalog WHERE directory = 'loras' AND name = 'add-detail-xl.safetensors'").get() as { metadata_json: string };
    expect(JSON.parse(header.metadata_json)).toMatchObject({ 'modelspec.title': 'Detail slider' });

    // The card's picture comes from ComfyUI's preview route, by the folder's path index.
    const previews = new PreviewReader({ db: () => db, open: async () => null, cacheDir: null, comfy: () => comfyPreviewSource(db), fetchImpl: globalThis.fetch });
    const picture = await previews.get('loras', SUB_FOLDER_LORA.replace('/', '\\'));
    expect(picture).toMatchObject({ kind: 'image', mime: 'image/webp' });
    expect(Buffer.from(picture!.bytes).equals(WEBP)).toBe(true);
    expect(fake.hits.some((hit) => hit.startsWith('GET /experiment/models/preview/loras/0/sdxl'))).toBe(true);
    previews.stop();
    sync.stop();
    db.close();
  }, 30_000);

  it('reads a large /object_info', async () => {
    const fake = await comfy({ extraClasses: 4000 });
    const db = openDb();
    const sync = service({ comfy: fake.url });
    const status = await sync.runSync(db);
    sync.stop();
    expect(status.counts.nodeClasses).toBe(CLASSES.length + 4000);
    expect(db.prepare('SELECT class_count FROM node_packs WHERE name = ?').get(BIG_PACK)).toEqual({ class_count: 4000 });
    db.close();
  }, 60_000);

  it('says plainly what an older ComfyUI or a broken folder leaves out', async () => {
    const legacy = await comfy({ legacy: true });
    const db = openDb();
    const sync = service({ comfy: legacy.url });
    const status = await sync.runSync(db);
    expect(status.warnings).toContain(COMFY_MODELS_NAMES_ONLY);
    expect(status.counts.models).toBe(listedFiles);
    expect((db.prepare("SELECT size_bytes FROM model_catalog WHERE directory = 'checkpoints' AND name = 'sd_xl_base_1.0.safetensors'").get() as { size_bytes: number | null }).size_bytes).toBeNull();
    sync.stop();

    const broken = await comfy({ brokenFolder: 'loras' });
    const again = service({ comfy: broken.url });
    const partial = await again.runSync(db);
    again.stop();
    expect(partial.warnings).toContain(folderUnreadWarning('loras'));
    // Fresh object_info placeholders may name these models, but cannot inherit the old server's file identity.
    expect((db.prepare("SELECT COUNT(*) AS n FROM model_catalog WHERE directory = 'loras' AND (size_bytes IS NOT NULL OR root_path IS NOT NULL)").get() as { n: number }).n).toBe(0);
    expect(translateKnownError(createTranslator('ru'), COMFY_MODELS_NAMES_ONLY)).toContain('старый ComfyUI');
    db.close();
  }, 30_000);

  it('fails with an exact sentence: not running, still starting, an MCP address, something else', async () => {
    const db = openDb();
    const gone = service({ comfy: 'http://127.0.0.1:9' });
    expect((await gone.runSync(db)).lastError).toBe(comfyUnreachable('127.0.0.1:9'));
    gone.stop();

    const starting = await comfy({ noObjectInfo: true });
    const half = service({ comfy: starting.url });
    expect((await half.runSync(db)).lastError).toBe(COMFY_NODES_UNREAD);
    half.stop();

    const server = await startPublicMcp('checkpointList');
    closers.push(server.close);
    expect(await checkComfy(server.url, globalThis.fetch)).toEqual({ ok: false, error: COMFY_IS_MCP });
    expect(await checkComfy(server.url.replace(/\/mcp$/, ''), globalThis.fetch)).toEqual({ ok: false, error: COMFY_NOT_COMFY });
    const real = await comfy();
    expect(await checkComfy(real.url.replace('http://', ''), globalThis.fetch)).toMatchObject({ ok: true, origin: real.url, version: '0.45.0', local: true });
    for (const sentence of [comfyUnreachable('127.0.0.1:9'), COMFY_NODES_UNREAD, COMFY_IS_MCP, COMFY_NOT_COMFY]) {
      expect(translateKnownError(createTranslator('ru'), sentence), sentence).not.toBeNull();
      expect(translateKnownError(createTranslator('en'), sentence), sentence).not.toBeNull();
    }
    db.close();
  }, 30_000);

  it('has nothing to read without either address, and no red error for it', async () => {
    const db = openDb();
    const sync = service({ comfy: '' });
    const status = await sync.runSync(db);
    expect(status.state).toBe('never');
    expect(syncView(status).blocked).toBe('noUrl');
    sync.stop();
    db.close();
  });
});
