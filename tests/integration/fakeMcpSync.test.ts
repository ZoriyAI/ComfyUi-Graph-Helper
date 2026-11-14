import { catalogModelRoots } from '../../src/main/mcp/knownRoots';
import { setKnownRootsSource } from '../../src/main/mcp/readOnly';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { migrate } from '../../src/main/settings/migrate';
import { SyncService } from '../../src/main/mcp/sync';
import { connectStreamableHttp, openReadOnlySession } from '../../src/main/mcp/client';
import { READ_ONLY_TOOLS } from '../../src/main/mcp/readOnly';
import { PreviewReader } from '../../src/main/knowledge/preview';
import { modelDetail, nodeClassDetail, searchModels } from '../../src/main/knowledge/repository';
import {
  CLASSES, CUSTOM_NODE_ROOT, KJNODES_DESCRIPTION, KJNODES_REPOSITORY, modelFileCount, PACK_FILES, PACKS, SIDE_FILES, startFakeMcp, WAN_README_OPENING,
  WRITE_TOOLS, type FakeMcp,
} from '../fixtures/mcp/fakeMcpServer';

/**
 * The sync over the real Streamable HTTP client against a fake MCP server on loopback: the transport, paging,
 * the comfy_api refusal and the native object_info fallback all run for real. Labelled fixture, not a live server.
 */
const TOKEN = 'fake-token-not-a-secret';
let fake: FakeMcp | null = null;

afterEach(async () => {
  setKnownRootsSource(null);
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

    const pony = searchModels(db, { query: 'PastelDetail' });
    expect(pony[0]?.baseModel).toBe('pony');
    const zimage = searchModels(db, { query: 'Z-Image-Turbo-Realism' });
    expect(zimage[0]?.baseModel).toBe('zimage');
  }, 30_000);

  it('reports a 401 as "requires sign-in" without credentials and as "refused the token" with a wrong one', async () => {
    fake = await startFakeMcp({ token: TOKEN });
    const db = openDb();
    const anonymous = await service(fake.url, null).runSync(db);
    expect(anonymous.state).toBe('error');
    expect(anonymous.lastError).toBe('MCP server requires sign-in.');
    const wrong = await service(fake.url, 'not-the-token').runSync(db);
    expect(wrong.state).toBe('error');
    expect(wrong.lastError).toBe('MCP server refused the token.');
    expect(fake.calls.some((call) => call.method === 'tools/call')).toBe(false);
    expect(JSON.stringify(fake.calls)).not.toContain('not-the-token');
  }, 30_000);

  it('syncs a server that needs no token without any credentials and remembers that', async () => {
    fake = await startFakeMcp();
    const db = openDb();
    const status = await service(fake.url, null).runSync(db);
    expect(status.state).toBe('idle');
    expect(status.authMode).toBe('anonymous');
    expect(status.counts.models).toBeGreaterThan(0);
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
    expect(mcpUrlNeedsHttps('http://192.168.1.50:8000/mcp')).toBe(true);
    expect(mcpUrlNeedsHttps('https://comfy.example.com/mcp')).toBe(false);
    expect(mcpUrlNeedsHttps('http://127.0.0.1:8000/mcp')).toBe(false);
    expect(mcpUrlNeedsHttps('http://localhost:8000/mcp')).toBe(false);
    expect(mcpUrlNeedsHttps('')).toBe(false);
    expect(mcpUrlNeedsHttps('not a url')).toBe(false);
  });
});

describe('what a model manager keeps next to a model', () => {
  // Reads of the files next to models; what node packs say about themselves is read too, and counted apart.
  const sideReads = () => fake!.calls.filter((call) => call.method === 'tools/call' && call.tool === 'workspace_files'
    && !String(call.args?.absolute_path).startsWith(`${CUSTOM_NODE_ROOT}/`));
  const sideBytes = (name: string) => SIDE_FILES.find((file) => file.filename === name)!.bytes;

  it('reads the description next to a file and says what it is for: name, words, tags, usage, examples', async () => {
    fake = await startFakeMcp({ token: TOKEN });
    const db = openDb();
    const sync = service(fake.url, TOKEN);
    const status = await sync.runSync(db);
    await sync.whenEnrichmentDone();
    expect(status.lastError).toBeNull();
    // The files next to the models are not models.
    expect(sync.status(db).counts.models).toBe(modelFileCount());

    const pixel = modelDetail(db, 'loras', 'pixel-art-xl.safetensors')!;
    expect(pixel).toMatchObject({
      title: 'Pixel Art XL',
      preview: 'image',
      mature: false,
      baseModel: 'sdxl',
      baseModelEvidence: 'sidecar',
      triggerWords: ['pixel art'],
      sourceUrl: 'https://civitai.com/models/120096?modelVersionId=135931',
    });
    expect(pixel.description).toBe('What it does\nTurns a picture into pixel art with a limited palette.\n• Works at 1024 x 1024.\n• Downscale the result eight times for true pixels.\nSharper edges than v1.0.');
    expect(pixel.notes).toMatchObject({
      versionName: 'v1.1',
      creator: 'nerijs',
      baseModelLabel: 'SDXL 1.0',
      tags: ['style', 'pixel art', 'retro'],
      notes: 'Turn the strength down for portraits.',
      usage: { strength: 0.9, strengthMin: 0.6, strengthMax: 1.2, clipSkip: null },
    });
    expect(pixel.notes.examples.map((item) => item.prompt)).toEqual([
      'pixel art, a lighthouse on a cliff, sunset, seagulls',
      'pixel art, a cat sleeping on a bookshelf, warm lamp light',
    ]);
    // A name its author gave it finds the file.
    expect(searchModels(db, { query: 'retro' }).map((item) => item.name)).toEqual(['pixel-art-xl.safetensors']);

    // Marked as adult content by its author: the app knows, and shows nothing of it unasked.
    expect(modelDetail(db, 'loras', 'flux_realism_lora.safetensors')).toMatchObject({ title: 'Night Painter', mature: true, preview: 'image', baseModel: 'flux1' });
    // And a file with nothing next to it is as it was: its family not known, nothing to show.
    expect(modelDetail(db, 'loras', 'mystery_style_v3.safetensors')).toMatchObject({ title: '', mature: false, preview: null, baseModel: 'unknown' });
    // A record that never met Civitai says almost nothing; the clip next to the file is still its preview.
    const local = modelDetail(db, 'loras', 'wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022.safetensors')!;
    expect(local).toMatchObject({ preview: 'video', mature: false, baseModel: 'wan2.2' });
    expect(local.notes.tags).toEqual([]);
    // The other convention: a bare Civitai record and `.preview.png`.
    const base = modelDetail(db, 'checkpoints', 'juggernautXL_v9.safetensors')!;
    expect(base).toMatchObject({ title: 'Juggernaut XL', preview: 'image', mature: false });
    expect(base.notes.examples[0]).toMatchObject({ prompt: 'a portrait photograph of an old sailor, overcast light, 85mm', steps: 30, cfg: 4.5 });
    // A file with nothing next to it stays as it was.
    expect(modelDetail(db, 'loras', 'add-detail-xl.safetensors')).toMatchObject({ title: '', preview: null, mature: false });

    // Descriptions only, whole, through the read-only gate; never a preview during a sync, never a stray file.
    const reads = sideReads();
    expect(reads.map((call) => String(call.args?.absolute_path).split('/').pop()).sort()).toEqual([
      'flux_realism_lora.metadata.json',
      'juggernautXL_v9.civitai.info',
      'pixel-art-xl.metadata.json',
      'wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022.metadata.json',
    ]);
    for (const call of reads) expect(READ_ONLY_TOOLS.workspace_files(call.args ?? {})).toBe(true);

    // The next sync reads nothing again: nothing changed.
    const before = reads.length;
    await sync.runSync(db);
    await sync.whenEnrichmentDone();
    expect(sideReads()).toHaveLength(before);
    expect(sync.status(db).metadata).toMatchObject({ done: sync.status(db).metadata!.total });
    sync.stop();
  }, 60_000);

  it('reads the description of a file that an earlier version had already read without it, and one that changed', async () => {
    fake = await startFakeMcp({ token: TOKEN });
    const db = openDb();
    const sync = service(fake.url, TOKEN);
    await sync.runSync(db);
    await sync.whenEnrichmentDone();
    // As an earlier version of the app left it: the header read, nothing known of the files next to the model.
    db.prepare("UPDATE model_catalog SET notes_json = '{}', sidecar_read_sig = NULL, sidecar_file = NULL, sidecar_sig = NULL, preview_file = NULL, preview_sig = NULL").run();
    db.prepare("UPDATE model_catalog SET trigger_words = '[]', description = '', source_url = NULL WHERE name = 'pixel-art-xl.safetensors'").run();
    expect(modelDetail(db, 'loras', 'pixel-art-xl.safetensors')).toMatchObject({ title: '', preview: null, triggerWords: [], enriched: true });
    const headerReads = () => fake!.calls.filter((call) => call.tool === 'model_metadata').length;
    const headers = headerReads();
    await sync.runSync(db);
    await sync.whenEnrichmentDone();
    expect(modelDetail(db, 'loras', 'pixel-art-xl.safetensors')).toMatchObject({ title: 'Pixel Art XL', preview: 'image', triggerWords: ['pixel art'], baseModel: 'sdxl', sourceUrl: 'https://civitai.com/models/120096?modelVersionId=135931' });
    // The headers were read once and are not read again for it.
    expect(headerReads()).toBe(headers);

    // The person edits the description in their model manager: the file has another size, and is read again.
    const file = SIDE_FILES.find((item) => item.filename === 'pixel-art-xl.metadata.json')!;
    const original = file.bytes;
    try {
      file.bytes = Buffer.from(original.toString('utf8').replace('Turn the strength down for portraits.', 'Use 0.7 with portraits and 1.0 with landscapes.'), 'utf8');
      const reads = sideReads().length;
      await sync.runSync(db);
      await sync.whenEnrichmentDone();
      expect(sideReads().length).toBe(reads + 1);
      expect(modelDetail(db, 'loras', 'pixel-art-xl.safetensors')!.notes.notes).toBe('Use 0.7 with portraits and 1.0 with landscapes.');
    } finally {
      file.bytes = original;
    }
    sync.stop();
  }, 60_000);

  it('hands the preview over as bytes, keeps it, and asks the server once', async () => {
    fake = await startFakeMcp({ token: TOKEN });
    const db = openDb();
    const sync = service(fake.url, TOKEN);
    await sync.runSync(db);
    await sync.whenEnrichmentDone();
    sync.stop();
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'previews-'));
    let opened = 0;
    const url = fake.url;
    const open = async () => {
      opened += 1;
      const session = await openReadOnlySession({ url, token: TOKEN }, connectStreamableHttp);
      return session.ok ? session.session : null;
    };
    // As main does at start: the gate knows the model folders of the last sync.
    setKnownRootsSource(() => catalogModelRoots(db));
    const reader = new PreviewReader({ db: () => db, open, cacheDir });
    try {
      const before = sideReads().length;
      // A list asks for several at once: one connection, one read each.
      const [still, again, clip, marked, none, missing] = await Promise.all([
        reader.get('loras', 'pixel-art-xl.safetensors'),
        reader.get('loras', 'pixel-art-xl.safetensors'),
        reader.get('loras', 'wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022.safetensors'),
        reader.get('loras', 'flux_realism_lora.safetensors'),
        reader.get('loras', 'add-detail-xl.safetensors'),
        reader.get('loras', 'no-such-file.safetensors'),
      ]);
      expect(still).toMatchObject({ kind: 'image', mime: 'image/webp' });
      expect(Buffer.from(still!.bytes).equals(sideBytes('pixel-art-xl.webp'))).toBe(true);
      expect(again).toBe(still);
      expect(clip).toMatchObject({ kind: 'video', mime: 'video/mp4' });
      expect(Buffer.from(clip!.bytes).equals(sideBytes('wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022.mp4'))).toBe(true);
      expect(marked).toMatchObject({ kind: 'image', mime: 'image/png' });
      expect(none).toBeNull();
      expect(missing).toBeNull();
      expect(opened).toBe(1);
      expect(sideReads().length).toBe(before + 3);
      for (const call of sideReads()) expect(READ_ONLY_TOOLS.workspace_files(call.args ?? {})).toBe(true);
      // Kept in the app's folder: asked again, the server hears nothing.
      expect(fs.readdirSync(cacheDir).map((name) => path.extname(name)).sort()).toEqual(['.mp4', '.png', '.webp']);
      const second = await reader.get('loras', 'pixel-art-xl.safetensors');
      expect(Buffer.from(second!.bytes).equals(sideBytes('pixel-art-xl.webp'))).toBe(true);
      expect(sideReads().length).toBe(before + 3);
      // A preview that changed is another file to the cache.
      db.prepare("UPDATE model_catalog SET preview_sig = 'pixel-art-xl.webp:999' WHERE name = 'pixel-art-xl.safetensors'").run();
      await reader.get('loras', 'pixel-art-xl.safetensors');
      expect(sideReads().length).toBe(before + 4);
    } finally {
      reader.stop();
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  }, 60_000);
});

describe('what a node pack says about itself', () => {
  const packReads = () => fake!.calls.filter((call) => call.method === 'tools/call' && call.tool === 'workspace_files'
    && String(call.args?.absolute_path).startsWith(`${CUSTOM_NODE_ROOT}/`));
  const rootReads = () => fake!.calls.filter((call) => call.method === 'tools/call' && call.tool === 'studio_capabilities' && call.args?.section === 'roots');
  type PackRow = { name: string; description: string | null; repository_url: string | null; readme_summary: string | null; info_sig: string | null; info_read_at: number | null };
  const packRow = (db: Database.Database, name: string) => db.prepare('SELECT name, description, repository_url, readme_summary, info_sig, info_read_at FROM node_packs WHERE name = ?').get(name) as PackRow;

  it('reads the pyproject.toml and README of each pack once, and again only when the pack is updated', async () => {
    fake = await startFakeMcp({ token: TOKEN });
    const db = openDb();
    const sync = service(fake.url, TOKEN);
    const status = await sync.runSync(db);
    await sync.whenEnrichmentDone();
    expect(status.lastError).toBeNull();

    // A pack that says who it is and where it lives: that is what it is, so its README (the same words, then
    // "I know I'm bad at documentation") is not shown at all.
    const kj = packRow(db, 'ComfyUI-KJNodes');
    expect(kj).toMatchObject({ description: KJNODES_DESCRIPTION, repository_url: KJNODES_REPOSITORY, info_sig: '1.1.7@a1b2c3d' });
    expect(kj.readme_summary ?? '').toBe('');
    // A pack with only a README; a pack with neither file is read, says nothing, and is not asked again.
    expect(packRow(db, 'ComfyUI-WanVideoWrapper')).toMatchObject({ description: null, repository_url: null, readme_summary: WAN_README_OPENING });
    expect(packRow(db, 'comfyui_controlnet_aux')).toMatchObject({ description: null, repository_url: null, readme_summary: null, info_sig: '1.1.2@' });
    expect(packRow(db, 'comfyui_controlnet_aux').info_read_at).not.toBeNull();
    // ComfyUI itself has no pack folder to read.
    expect(packRow(db, 'comfy-core').info_read_at).toBeNull();

    // The node card of a class from the pack gets it with the class.
    expect(nodeClassDetail(db, 'ColorMatch')?.packInfo).toMatchObject({ description: KJNODES_DESCRIPTION, repositoryUrl: KJNODES_REPOSITORY });
    expect(nodeClassDetail(db, 'ColorMatch')?.packInfo?.readmeSummary ?? '').toBe('');
    expect(nodeClassDetail(db, 'KSampler')?.packInfo).toBeUndefined();

    // Only the two files at the top of a pack, through the gate; never the pack's code or a file deeper in it.
    const reads = packReads();
    expect(reads.length).toBeGreaterThan(0);
    for (const call of reads) {
      expect(READ_ONLY_TOOLS.workspace_files(call.args ?? {})).toBe(true);
      expect(String(call.args?.absolute_path)).toMatch(/\/custom_nodes\/[^/]+\/(pyproject\.toml|README\.md|readme\.md|Readme\.md)$/);
    }
    const never = PACK_FILES.filter((file) => !['pyproject.toml', 'README.md'].includes(file.file)).map((file) => `${CUSTOM_NODE_ROOT}/${file.pack}/${file.file}`);
    expect(reads.some((call) => never.includes(String(call.args?.absolute_path)))).toBe(false);
    expect(rootReads()).toHaveLength(1);

    // Nothing changed: the next sync asks nothing about the packs, not even where they lie.
    const before = reads.length;
    await sync.runSync(db);
    await sync.whenEnrichmentDone();
    expect(packReads()).toHaveLength(before);
    expect(rootReads()).toHaveLength(1);

    // KJNodes is updated: only its files are read again.
    const kjPack = PACKS.find((pack) => pack.name === 'ComfyUI-KJNodes')!;
    const version = kjPack.version;
    kjPack.version = '1.1.8';
    try {
      await sync.runSync(db);
      await sync.whenEnrichmentDone();
    } finally {
      kjPack.version = version;
    }
    const again = packReads().slice(before);
    expect(again.length).toBeGreaterThan(0);
    expect(again.every((call) => String(call.args?.absolute_path).startsWith(`${CUSTOM_NODE_ROOT}/ComfyUI-KJNodes/`))).toBe(true);
    expect(packRow(db, 'ComfyUI-KJNodes').info_sig).toBe('1.1.8@a1b2c3d');
    sync.stop();
  }, 60_000);
});
