import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { SyncService } from '../../src/main/mcp/sync';
import { ModelWebClient } from '../../src/main/knowledge/webLookup';
import { writeFileHash } from '../../src/main/knowledge/modelWeb';
import { modelDetail } from '../../src/main/knowledge/repository';
import { fakeFileHash, startFakeMcp, type FakeMcp } from '../fixtures/mcp/fakeMcpServer';
import { CIVITAI_KNOWN, startFakeModelWeb, type FakeModelWeb } from '../fixtures/web/fakeModelWeb';

/**
 * Sync with Settings ▸ Privacy ▸ "Look up models on the internet" on, against the fake MCP server and the fake of
 * Civitai and Hugging Face (labelled fixtures). Only files whose fingerprint is known and that nothing from Civitai
 * describes are asked about; no fingerprint is made during sync; requests are spaced; answers are kept and not
 * asked for again.
 */
let fake: FakeMcp | null = null;
let web: FakeModelWeb | null = null;

afterEach(async () => {
  await fake?.close();
  await web?.close();
  fake = null;
  web = null;
});

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

const WAN_HIGH = 'wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022.safetensors';

function service(mcpUrl: string, origin: string, online: boolean, sleeps: number[], perRun?: number): SyncService {
  const client = new ModelWebClient({
    endpoints: { civitai: `${origin}/civitai`, huggingface: `${origin}/hf` },
    fetchImpl: (url, init) => fetch(url, init),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return new SyncService({
    readUrl: () => mcpUrl,
    token: () => null,
    readAuthMode: () => 'none',
    checkTokenOrigin: () => undefined,
    readEnrichment: () => ({ scope: 'loaders', perRun: 100, pauseMs: 0 }),
    readLookupOnline: () => online,
    webClient: () => client,
    // Asked for less: the pause never goes below a second all the same.
    lookupPauseMs: 10,
    lookupsPerRun: perRun,
  });
}

async function syncOnce(sync: SyncService, db: Database.Database): Promise<void> {
  const status = await sync.runSync(db);
  expect(status.lastError).toBeNull();
  await sync.whenEnrichmentDone();
  await sync.whenWebLookupsDone();
}

describe('sync looks model files up on the internet only when allowed', () => {
  it('asks nothing while the setting is off', async () => {
    fake = await startFakeMcp();
    web = await startFakeModelWeb();
    const db = openDb();
    const sync = service(fake.url, web.origin, false, []);
    await syncOnce(sync, db);
    expect(web.requests).toEqual([]);
    // The fingerprint a description gave is kept all the same: a card can use it without asking the server.
    expect(modelDetail(db, 'loras', WAN_HIGH)).toMatchObject({ sha256: fakeFileHash('loras', WAN_HIGH), web: { status: null } });
    sync.stop();
    db.close();
  }, 60_000);

  it('asks about files with a fingerprint and nothing from Civitai, spaced, keeps the answers, and does not ask again', async () => {
    fake = await startFakeMcp();
    web = await startFakeModelWeb();
    const db = openDb();
    const sleeps: number[] = [];
    const sync = service(fake.url, web.origin, true, sleeps);
    await syncOnce(sync, db);

    // The one file whose description gives a fingerprint and is not from Civitai: Civitai, then Hugging Face by name.
    const sent = web.requests.map((item) => item.path);
    expect(sent).toEqual([
      `/civitai/api/v1/model-versions/by-hash/${fakeFileHash('loras', WAN_HIGH)}`,
      '/hf/api/models?search=wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022&limit=5',
      '/hf/api/models?search=wan2.2-i2v&limit=5',
    ]);
    // pixel-art-xl has a fingerprint too, but its description came from Civitai: nothing to ask.
    expect(sent.join('\n')).not.toContain(fakeFileHash('loras', 'pixel-art-xl.safetensors'));
    expect(web.requests.every((item) => item.credentials.length === 0)).toBe(true);
    // Spaced at least a second apart, whatever was asked for.
    expect(sleeps).toHaveLength(sent.length - 1);
    for (const ms of sleeps) expect(ms).toBeGreaterThan(900);
    expect(modelDetail(db, 'loras', WAN_HIGH)!.web).toMatchObject({ status: 'not-found', error: null });
    // No fingerprint was made on the server during sync.
    expect(fake.calls.filter((call) => call.tool === 'workspace_files' && call.args?.action === 'hash')).toEqual([]);

    // A file whose fingerprint became known since (a card made it): the next sync asks about it alone.
    writeFileHash(db, 'loras', 'mystery_style_v3.safetensors', CIVITAI_KNOWN.mystery);
    const before = web.requests.length;
    await syncOnce(sync, db);
    expect(web.requests.slice(before).map((item) => item.path)).toEqual([`/civitai/api/v1/model-versions/by-hash/${CIVITAI_KNOWN.mystery}`]);
    expect(modelDetail(db, 'loras', 'mystery_style_v3.safetensors')).toMatchObject({
      baseModel: 'sdxl',
      baseModelEvidence: 'web',
      web: { status: 'found', found: { source: 'civitai', notes: { title: 'Mystery Style' } } },
    });
    // The sample is not downloaded by sync: only a card that shows it asks for it.
    expect(web.requests.some((item) => item.path.startsWith('/img/'))).toBe(false);

    // Nothing is asked again.
    const after = web.requests.length;
    await syncOnce(sync, db);
    expect(web.requests).toHaveLength(after);
    sync.stop();
    db.close();
  }, 60_000);

  it("checks a Hugging Face repository's picture within the same spacing, and leaves a marked one alone", async () => {
    fake = await startFakeMcp();
    web = await startFakeModelWeb();
    const db = openDb();
    const quiet = service(fake.url, web.origin, false, []);
    await syncOnce(quiet, db);
    quiet.stop();
    // Fingerprints Civitai does not know (made earlier from cards): Hugging Face guesses by name.
    writeFileHash(db, 'loras', 'sdxl_lightning_8step_lora.safetensors', 'a1'.repeat(32));
    writeFileHash(db, 'checkpoints', 'realisticVisionV60B1_v51VAE.safetensors', 'b2'.repeat(32));
    const sleeps: number[] = [];
    const sync = service(fake.url, web.origin, true, sleeps);
    await syncOnce(sync, db);
    const sent = web.requests.map((item) => item.path);
    expect(sent.filter((item) => item.includes('/resolve/'))).toEqual(['/hf/ByteDance/SDXL-Lightning/resolve/main/sdxl_lightning_samples.jpg']);
    // Every request, the picture too, at least a second after the one before.
    expect(sleeps).toHaveLength(sent.length - 1);
    for (const ms of sleeps) expect(ms).toBeGreaterThan(900);
    expect(modelDetail(db, 'loras', 'sdxl_lightning_8step_lora.safetensors')).toMatchObject({ preview: 'image', mature: false, web: { found: { source: 'huggingface' } } });
    expect(modelDetail(db, 'checkpoints', 'realisticVisionV60B1_v51VAE.safetensors')).toMatchObject({ preview: 'image', mature: true, web: { found: { notes: { mature: true } } } });
    sync.stop();
    db.close();
  }, 60_000);

  it('looks up at most the files allowed per run and the rest at the next', async () => {
    fake = await startFakeMcp();
    web = await startFakeModelWeb();
    const db = openDb();
    // Read the catalog first with the setting off, then two files have a fingerprint: one from its description,
    // one made earlier from a card.
    const quiet = service(fake.url, web.origin, false, []);
    await syncOnce(quiet, db);
    quiet.stop();
    writeFileHash(db, 'loras', 'Wan21_CausVid_14B_T2V_lora_rank32.safetensors', CIVITAI_KNOWN.marked);
    const sync = service(fake.url, web.origin, true, [], 1);
    const asked = () => [WAN_HIGH, 'Wan21_CausVid_14B_T2V_lora_rank32.safetensors'].filter((name) => modelDetail(db, 'loras', name)!.web.status !== null);
    await syncOnce(sync, db);
    expect(asked()).toHaveLength(1);
    await syncOnce(sync, db);
    expect(asked()).toHaveLength(2);
    // Marked by the site: kept marked, and its sample is closed like one next to a file.
    expect(modelDetail(db, 'loras', 'Wan21_CausVid_14B_T2V_lora_rank32.safetensors')).toMatchObject({ mature: true, preview: 'image', web: { found: { notes: { mature: true } } } });
    sync.stop();
    db.close();
  }, 60_000);
});
