import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import type { McpSession } from '../../src/shared/mcp/catalogSource';
import {
  bestHuggingFaceMatch, civitaiFound, huggingFaceFound, nameQueries, nameStem, readmeSummary, smallCivitaiImage, summarize, webFoundFromJson,
} from '../../src/shared/knowledge/webLookup';
import { isReadOnlyCall, readOnlySession } from '../../src/main/mcp/readOnly';
import { LOOKUP_ENDPOINTS, ModelWebClient } from '../../src/main/knowledge/webLookup';
import { dueLookups, ModelLookupService, sha256FromHashAnswer, writeFileHash, writeWebOutcome } from '../../src/main/knowledge/modelWeb';
import { inferModelsFromNames, upsertModelFiles, writeModelEnrichment } from '../../src/main/catalog/repository';
import { modelDetail, modelDetailForHelper, searchModels } from '../../src/main/knowledge/repository';
import { PreviewReader } from '../../src/main/knowledge/preview';
import { migrate } from '../../src/main/settings/migrate';
import { CIVITAI_KNOWN, startFakeModelWeb, type FakeModelWeb } from '../fixtures/web/fakeModelWeb';

/** A Civitai model-version record as `model-versions/by-hash` returns it (and as `.civitai.info` holds it). */
const VERSION = {
  id: 135931,
  modelId: 120096,
  name: 'v1.1',
  trainedWords: ['pixel art'],
  baseModel: 'SDXL 1.0',
  description: '<p>Sharper edges than v1.0.</p>',
  model: { name: 'Pixel Art XL', type: 'LORA', nsfw: false, description: '<p>Turns a picture into <b>pixel art</b>.</p><script>x()</script>', tags: ['style', 'retro'] },
  images: [
    { url: 'https://image.civitai.com/abc/def/original=true/1.png', nsfwLevel: 8, type: 'image', meta: { prompt: 'pixel art, a figure in a doorway', steps: 8 } },
    { url: 'https://image.civitai.com/abc/def/width=1024/2.jpeg', nsfwLevel: 1, type: 'image', meta: { prompt: 'pixel art, a lighthouse', negativePrompt: 'blurry', steps: 8, cfgScale: 1.5, sampler: 'euler' } },
    { url: 'javascript:alert(1)', nsfwLevel: 1, type: 'image' },
  ],
  creator: { username: 'nerijs' },
  files: [{ name: 'pixel-art-xl.safetensors', type: 'Model', primary: true, hashes: { SHA256: 'AB'.repeat(32) } }],
};

describe('what Civitai says about a file, read from its record', () => {
  it('reads the record a .civitai.info holds: name, version, author, base, words, summary, examples, link', () => {
    const found = civitaiFound(VERSION)!;
    expect(found).toMatchObject({
      source: 'civitai',
      url: 'https://civitai.com/models/120096?modelVersionId=135931',
      byName: false,
      triggerWords: ['pixel art'],
      summary: 'Turns a picture into pixel art.\nSharper edges than v1.0.',
    });
    expect(found.notes).toMatchObject({ title: 'Pixel Art XL', versionName: 'v1.1', creator: 'nerijs', baseModelLabel: 'SDXL 1.0', tags: ['style', 'retro'], notes: '', mature: false });
    // The examples keep their own rating: the one rated 8 is closed until the person opens it.
    expect(found.notes.examples.map((item) => [item.prompt, item.mature])).toEqual([['pixel art, a figure in a doorway', true], ['pixel art, a lighthouse', false]]);
    // The preview is the first picture rated for everyone, at the small size; never an address that is not the web.
    expect(found.preview).toEqual({ url: 'https://image.civitai.com/abc/def/width=450/2.jpeg', kind: 'image' });
    expect(JSON.stringify(found)).not.toMatch(/<[a-z/]|script/i);
  });

  it('marks it from the model flag, or when the only sample is rated above "for everyone"', () => {
    expect(civitaiFound({ ...VERSION, model: { ...VERSION.model, nsfw: true } })!.notes.mature).toBe(true);
    const onlyMarked = civitaiFound({ ...VERSION, images: [VERSION.images[0]] })!;
    expect(onlyMarked.notes).toMatchObject({ mature: true, previewRating: 8 });
    expect(onlyMarked.preview?.url).toBe('https://image.civitai.com/abc/def/width=450/1.png');
    expect(civitaiFound({ ...VERSION, images: [] })!.preview).toBeNull();
  });

  it('is not fooled by an error answer or other JSON, and survives being stored and read back', () => {
    for (const value of [null, [], 'x', { error: 'Model not found' }, { id: 5, name: 'no model id' }]) expect(civitaiFound(value), JSON.stringify(value)).toBeNull();
    const found = civitaiFound(VERSION)!;
    expect(webFoundFromJson(JSON.stringify(found))).toEqual(found);
    expect(webFoundFromJson('{"source":"civitai","url":"javascript:x"}')).toBeNull();
    expect(webFoundFromJson('not json')).toBeNull();
    expect(smallCivitaiImage('https://image.civitai.com/a/b/c.png')).toBe('https://image.civitai.com/a/b/c.png');
  });
});

describe('what a file is called on Hugging Face', () => {
  it('drops the folder, the extension and the precision it was saved in', () => {
    expect(nameStem('wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors')).toBe('wan2.2_i2v_high_noise_14B');
    expect(nameStem('umt5_xxl_fp8_e4m3fn_scaled.safetensors')).toBe('umt5_xxl');
    expect(nameStem('z_image_turbo_bf16.safetensors')).toBe('z_image_turbo');
    expect(nameStem('qwen_3_4b_fp16.safetensors')).toBe('qwen_3_4b');
    expect(nameStem('sub/dir/flux1-dev-Q4_K_M.gguf')).toBe('flux1-dev');
    expect(nameStem('sd_xl_base_1.0.safetensors')).toBe('sd_xl_base_1.0');
    expect(nameStem('4x-UltraSharp.pth')).toBe('4x-UltraSharp');
    expect(nameStem('model-pruned-emaonly.ckpt')).toBe('model');
  });

  it('searches the stem, then its first two words the way repositories are named', () => {
    expect(nameQueries('sdxl_lightning_8step_lora.safetensors')).toEqual(['sdxl_lightning_8step_lora', 'sdxl-lightning']);
    expect(nameQueries('ae.safetensors')).toEqual([]);
    expect(nameQueries('juggernaut_v9.safetensors')).toEqual(['juggernaut_v9']);
  });

  it('picks the repository named like the file, else one that holds its name, else the first', () => {
    const list = [{ id: 'someone/sdxl-lightning-copy' }, { id: 'ByteDance/SDXL-Lightning' }, { id: 'bad id' }];
    expect(bestHuggingFaceMatch(list, 'SDXL_Lightning.safetensors')).toBe('ByteDance/SDXL-Lightning');
    expect(bestHuggingFaceMatch([{ id: 'a/other' }, { id: 'b/lightning-x' }], 'lightning.safetensors')).toBe('b/lightning-x');
    expect(bestHuggingFaceMatch([{ id: 'a/other' }], 'lightning.safetensors')).toBe('a/other');
    expect(bestHuggingFaceMatch([], 'x.safetensors')).toBeNull();
    expect(bestHuggingFaceMatch({ id: 'a/b' }, 'x.safetensors')).toBeNull();
  });

  it('summarizes a README: no front matter, pictures, badges, code, headings or markup, at most 700 characters', () => {
    const readme = [
      '---', 'license: mit', 'tags:', '- lora', '---',
      '# My LoRA', '',
      '[![badge](https://img.shields.io/x.svg)](https://example.com) ![sample](a.png)', '',
      'A **soft** look for <b>portraits</b>, made with [our trainer](https://example.com/trainer).', '',
      '| a | b |', '|---|---|', '',
      '```python', 'print("hi")', '```', '',
      '- works at 1024', '- fast', '',
      'x'.repeat(900),
    ].join('\n');
    const summary = readmeSummary(readme);
    expect(summary.startsWith('A soft look for portraits, made with our trainer.\n\n• works at 1024\n• fast')).toBe(true);
    expect(summary.length).toBeLessThanOrEqual(701);
    expect(summary).not.toMatch(/license|My LoRA|badge|shields|print|\||<|\*\*|\]\(/);
    expect(readmeSummary('---\nunterminated front matter')).toBe('');
    expect(summarize('One. Two three four five six seven.', 12)).toBe('One. Two…');
    expect(summarize('A first sentence here. Then more words follow on.', 30)).toBe('A first sentence here.');
  });

  it('reads a model record as a guess by name: id, owner, base model, readable tags, words, adult tag', () => {
    const found = huggingFaceFound('owner/soft-lora', {
      pipeline_tag: 'text-to-image',
      tags: ['diffusers', 'lora', 'license:mit', 'region:us', 'portrait', 'not-for-all-audiences'],
      cardData: { base_model: ['black-forest-labs/FLUX.1-dev'], instance_prompt: 'soft look, portrait' },
    }, 'Soft portraits.')!;
    expect(found).toMatchObject({ source: 'huggingface', url: 'https://huggingface.co/owner/soft-lora', byName: true, triggerWords: ['soft look', 'portrait'], summary: 'Soft portraits.', preview: null });
    expect(found.notes).toMatchObject({ title: 'owner/soft-lora', creator: 'owner', baseModelLabel: 'black-forest-labs/FLUX.1-dev', tags: ['text-to-image', 'portrait', 'not-for-all-audiences'], mature: true });
    expect(huggingFaceFound('../etc', {}, '')).toBeNull();
  });
});

describe('the read-only gate and the fingerprint of a model file', () => {
  const read = { action: 'read', absolute_path: '/srv/models/loras/a.metadata.json', encoding: 'base64' };

  it('lets `hash` through for a model file only, with nothing else in the call', () => {
    for (const name of ['a.safetensors', 'a.sft', 'a.ckpt', 'a.pt', 'a.pth', 'a.bin', 'a.gguf', 'sub/A.SafeTensors']) {
      expect(isReadOnlyCall('workspace_files', { action: 'hash', absolute_path: `/srv/models/loras/${name}` }), name).toBe(true);
    }
    for (const absolute_path of [
      '/srv/models/loras/a.metadata.json', '/srv/models/loras/a.png', '/etc/passwd', '/srv/models/../../etc/x.safetensors',
      'srv/models/a.safetensors', '/a.safetensors', '/srv//a.safetensors', '/srv/./a.safetensors', 'C:\\models\\a.safetensors', '/srv/a.safetensors\0.txt',
    ]) {
      expect(isReadOnlyCall('workspace_files', { action: 'hash', absolute_path }), absolute_path).toBe(false);
    }
    const hash = { action: 'hash', absolute_path: '/srv/models/loras/a.safetensors' };
    for (const extra of [{ encoding: 'base64' }, { offset: 0 }, { expected_sha256: 'missing' }, { content: 'x' }, { destination: '/srv/b.safetensors' }]) {
      expect(isReadOnlyCall('workspace_files', { ...hash, ...extra }), JSON.stringify(extra)).toBe(false);
    }
  });

  it('opens nothing else: reads stay for the files next to a model, and no other action passes', () => {
    expect(isReadOnlyCall('workspace_files', read)).toBe(true);
    expect(isReadOnlyCall('workspace_files', { ...read, absolute_path: '/srv/models/loras/a.safetensors' })).toBe(false);
    for (const action of ['list', 'stat', 'search', 'write', 'patch', 'mkdir', 'copy', 'move', 'trash', 'restore', 'diff']) {
      expect(isReadOnlyCall('workspace_files', { action, absolute_path: '/srv/models/loras/a.safetensors' }), action).toBe(false);
    }
  });

  it('reads the fingerprint from the answer, whatever the exact shape, and nothing that is not one', () => {
    const hex = 'ab'.repeat(32);
    expect(sha256FromHashAnswer({ path: '/x', sha256: hex.toUpperCase(), size_bytes: 3 })).toBe(hex);
    // The answer as a real Home ComfyUI MCP server gives it (2026-11, workspace_files hash of a LoRA).
    expect(sha256FromHashAnswer({
      path: '/srv/models/loras/a.safetensors', root: 'models', relative_path: 'loras/a.safetensors', type: 'file', size_bytes: 28627792,
      mode: 436, mtime: '2026-11-07T15:10:36.548Z', identity: '66306:227057231:28627792:1:2', algorithm: 'sha256', sha256: hex, complete: true,
    })).toBe(hex);
    expect(sha256FromHashAnswer({ hash: { sha256: hex } })).toBe(hex);
    expect(sha256FromHashAnswer({ result: { algorithm: 'SHA-256', digest: hex } })).toBe(hex);
    expect(sha256FromHashAnswer({ algorithm: 'sha256', hash: hex })).toBe(hex);
    for (const value of [null, 'text', { sha256: 'short' }, { algorithm: 'md5', hash: hex }, { a: { b: { sha256: hex } } }]) expect(sha256FromHashAnswer(value)).toBeNull();
  });
});

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

let web: FakeModelWeb | null = null;
afterEach(async () => {
  await web?.close();
  web = null;
});

function client(fake: FakeModelWeb, sleeps: number[] = []): ModelWebClient {
  return new ModelWebClient({
    endpoints: { civitai: `${fake.origin}/civitai`, huggingface: `${fake.origin}/hf` },
    fetchImpl: (url, init) => fetch(url, init),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
}

describe('asking the sites', () => {
  it('finds a file on Civitai by its fingerprint and nothing else is sent', async () => {
    web = await startFakeModelWeb();
    const outcome = await client(web).lookup({ sha256: CIVITAI_KNOWN.mystery, filename: 'mystery_style_v3.safetensors' }, 0);
    expect(outcome).toMatchObject({ status: 'found', found: { source: 'civitai', url: 'https://civitai.com/models/900100?modelVersionId=900101', notes: { title: 'Mystery Style' } } });
    expect(web.requests.map((item) => item.path)).toEqual([`/civitai/api/v1/model-versions/by-hash/${CIVITAI_KNOWN.mystery}`]);
    expect(web.requests.every((item) => item.credentials.length === 0)).toBe(true);
  });

  it('asks Hugging Face by name when Civitai does not know the file, spaced as asked', async () => {
    web = await startFakeModelWeb();
    const sleeps: number[] = [];
    const outcome = await client(web, sleeps).lookup({ sha256: 'cd'.repeat(32), filename: 'sdxl_lightning_8step_lora.safetensors' }, 1000);
    expect(outcome.status).toBe('found');
    const found = outcome.status === 'found' ? outcome.found : null;
    expect(found).toMatchObject({ source: 'huggingface', byName: true, url: 'https://huggingface.co/ByteDance/SDXL-Lightning', notes: { title: 'ByteDance/SDXL-Lightning', baseModelLabel: 'stabilityai/stable-diffusion-xl-base-1.0' } });
    expect(found!.summary.startsWith('SDXL-Lightning is a lightning-fast text-to-image generation model.')).toBe(true);
    expect(web.requests.map((item) => item.path)).toEqual([
      `/civitai/api/v1/model-versions/by-hash/${'cd'.repeat(32)}`,
      '/hf/api/models?search=sdxl_lightning_8step_lora&limit=5',
      '/hf/api/models?search=sdxl-lightning&limit=5',
      '/hf/api/models/ByteDance/SDXL-Lightning',
      '/hf/ByteDance/SDXL-Lightning/raw/main/README.md',
    ]);
    // A pause before every request but the first, none shorter than asked (a fast fake makes them about a second).
    expect(sleeps).toHaveLength(4);
    for (const ms of sleeps) expect(ms).toBeGreaterThan(900);
  });

  it('says when neither site knows the file, and asks nothing of Civitai without a fingerprint', async () => {
    web = await startFakeModelWeb();
    expect(await client(web).lookup({ sha256: null, filename: 'Z-Image-Turbo-Fun-Controlnet-Union.safetensors' }, 0)).toEqual({ status: 'not-found' });
    expect(web.requests.map((item) => item.path)).toEqual(['/hf/api/models?search=Z-Image-Turbo-Fun-Controlnet-Union&limit=5', '/hf/api/models?search=Z-Image&limit=5']);
  });

  it('names what went wrong, follows no redirect off the fixed hosts, and refuses an answer too large', async () => {
    const answering = (respond: () => Response) => new ModelWebClient({ endpoints: { civitai: 'http://127.0.0.1:9/civitai', huggingface: 'http://127.0.0.1:9/hf' }, fetchImpl: async () => respond() });
    const sha = { sha256: 'ef'.repeat(32), filename: 'a_lora.safetensors' };
    expect(await answering(() => new Response('', { status: 429 })).lookup(sha, 0)).toEqual({ status: 'error', error: 'rate-limited' });
    expect(await answering(() => new Response('', { status: 503 })).lookup(sha, 0)).toEqual({ status: 'error', error: 'server' });
    expect(await answering(() => new Response('<html>', { status: 200 })).lookup(sha, 0)).toEqual({ status: 'error', error: 'bad-answer' });
    expect(await answering(() => new Response(null, { status: 302, headers: { location: 'https://evil.example/x' } })).lookup(sha, 0)).toEqual({ status: 'error', error: 'bad-answer' });
    expect(await answering(() => new Response('x'.repeat(3 * 1024 * 1024), { status: 200 })).lookup(sha, 0)).toEqual({ status: 'error', error: 'bad-answer' });
    const offline = new ModelWebClient({ endpoints: { civitai: 'http://127.0.0.1:9/civitai', huggingface: 'http://127.0.0.1:9/hf' }, fetchImpl: async () => { throw new TypeError('fetch failed'); } });
    expect(await offline.lookup(sha, 0)).toEqual({ status: 'error', error: 'unreachable' });
  });

  it('asks only the fixed sites over https in the app', () => {
    const app = new ModelWebClient();
    expect(app.endpoints).toEqual(LOOKUP_ENDPOINTS);
    for (const url of ['https://civitai.com/api/v1/x', 'https://huggingface.co/api/models', 'https://image.civitai.com/a/b.png']) expect(app.allowed(url), url).not.toBeNull();
    for (const url of ['http://civitai.com/api', 'https://civitai.com:8443/api', 'https://user:pw@civitai.com/', 'https://evil.example/', 'https://civitai.com.evil.example/', 'https://127.0.0.1/', 'file:///etc/passwd']) {
      expect(app.allowed(url), url).toBeNull();
    }
  });
});

describe('what was found, kept in the catalog', () => {
  it('keeps a find, gives an unknown family the one Civitai names as learned from the internet, and the file wins later', async () => {
    web = await startFakeModelWeb();
    const db = openDb();
    upsertModelFiles(db, [{ directory: 'loras', name: 'mystery_style_v3.safetensors', sizeBytes: 5, rootPath: '/srv/comfyui/models/loras' }], 1);
    inferModelsFromNames(db);
    writeFileHash(db, 'loras', 'mystery_style_v3.safetensors', CIVITAI_KNOWN.mystery);
    const outcome = await client(web).lookup({ sha256: CIVITAI_KNOWN.mystery, filename: 'mystery_style_v3.safetensors' }, 0);
    writeWebOutcome(db, 'loras', 'mystery_style_v3.safetensors', outcome, 50);
    const detail = modelDetail(db, 'loras', 'mystery_style_v3.safetensors')!;
    expect(detail).toMatchObject({ baseModel: 'sdxl', baseModelEvidence: 'web', preview: 'image', mature: false, civitaiKnown: false });
    expect(detail.web).toMatchObject({ status: 'found', checkedAt: 50, error: null, found: { source: 'civitai', notes: { title: 'Mystery Style' } } });
    // The helper model hears where it was found and what it is called, never the example prompts or the picture.
    const told = modelDetailForHelper(detail);
    expect(told.web.found!.notes.examples).toEqual([]);
    expect(told.web.found!.preview).toBeNull();
    expect(JSON.stringify(told)).not.toContain('lighthouse in fog');
    // A later sync that still knows nothing from the file keeps the family; a header that says it wins.
    inferModelsFromNames(db);
    expect(modelDetail(db, 'loras', 'mystery_style_v3.safetensors')).toMatchObject({ baseModel: 'sdxl', baseModelEvidence: 'web' });
    writeModelEnrichment(db, 'loras', 'mystery_style_v3.safetensors', { kind: 'lora', baseModel: 'unknown', baseModelEvidence: 'none', triggerWords: [], description: '', sourceUrl: null, metadata: {}, enrichedAt: 60 });
    expect(modelDetail(db, 'loras', 'mystery_style_v3.safetensors')).toMatchObject({ baseModel: 'sdxl', baseModelEvidence: 'web' });
    writeModelEnrichment(db, 'loras', 'mystery_style_v3.safetensors', { kind: 'lora', baseModel: 'pony', baseModelEvidence: 'metadata', triggerWords: [], description: '', sourceUrl: null, metadata: {}, enrichedAt: 61 });
    expect(modelDetail(db, 'loras', 'mystery_style_v3.safetensors')).toMatchObject({ baseModel: 'pony', baseModelEvidence: 'metadata' });
    // A failed ask later does not wipe the find; it is not asked at sync again either.
    writeWebOutcome(db, 'loras', 'mystery_style_v3.safetensors', { status: 'error', error: 'timeout' }, 70);
    expect(modelDetail(db, 'loras', 'mystery_style_v3.safetensors')!.web.status).toBe('found');
    expect(dueLookups(db, 10, 100)).toEqual([]);
    expect(searchModels(db, { query: 'mystery' })[0]).toMatchObject({ preview: 'image', mature: false });
    db.close();
  });

  it('downloads the sample through main into the same folder and hands it over like one next to a file', async () => {
    web = await startFakeModelWeb();
    const db = openDb();
    const lookups = client(web);
    upsertModelFiles(db, [{ directory: 'loras', name: 'mystery_style_v3.safetensors', sizeBytes: 5, rootPath: '/srv/comfyui/models/loras' }], 1);
    writeWebOutcome(db, 'loras', 'mystery_style_v3.safetensors', await lookups.lookup({ sha256: CIVITAI_KNOWN.mystery, filename: 'x.safetensors' }, 0), 5);
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-previews-'));
    const reader = new PreviewReader({ db: () => db, open: async () => null, cacheDir, web: (url) => lookups.previewBytes(url) });
    const preview = await reader.get('loras', 'mystery_style_v3.safetensors');
    expect(preview).toMatchObject({ kind: 'image', mime: 'image/png' });
    expect(preview!.bytes.byteLength).toBeGreaterThan(0);
    expect(web.requests.filter((item) => item.path.startsWith('/img/')).map((item) => item.path)).toEqual(['/img/width=450/mystery.png']);
    // The second time it comes from the folder.
    await reader.get('loras', 'mystery_style_v3.safetensors');
    expect(web.requests.filter((item) => item.path.startsWith('/img/'))).toHaveLength(1);
    reader.stop();
    fs.rmSync(cacheDir, { recursive: true, force: true });
    db.close();
  });

  it('makes the fingerprint on the server only when asked, through the gate, then looks the file up', async () => {
    web = await startFakeModelWeb();
    const db = openDb();
    upsertModelFiles(db, [
      { directory: 'loras', name: 'mystery_style_v3.safetensors', sizeBytes: 5, rootPath: '/srv/comfyui/models/loras' },
      { directory: 'loras', name: 'nowhere.safetensors', sizeBytes: 5, rootPath: null },
    ], 1);
    const calls: Array<{ name: string; args: Record<string, unknown>; options?: unknown }> = [];
    const session: McpSession = readOnlySession({
      async listTools() { return []; },
      async callTool(name, args, options) {
        calls.push({ name, args, options });
        return { content: [{ type: 'text', text: JSON.stringify({ path: args.absolute_path, algorithm: 'sha256', sha256: CIVITAI_KNOWN.mystery }) }] };
      },
      async close() {},
    });
    const service = new ModelLookupService({ db: () => db, client: () => client(web!), open: async () => session, now: () => 77 });
    const hashed = await service.hash('loras', 'mystery_style_v3.safetensors');
    expect(hashed).toMatchObject({ ok: true, detail: { sha256: CIVITAI_KNOWN.mystery } });
    expect(calls).toEqual([{ name: 'workspace_files', args: { action: 'hash', absolute_path: '/srv/comfyui/models/loras/mystery_style_v3.safetensors' }, options: { timeoutMs: 600000 } }]);
    // Known now: not made again.
    await service.hash('loras', 'mystery_style_v3.safetensors');
    expect(calls).toHaveLength(1);
    const looked = await service.lookup('loras', 'mystery_style_v3.safetensors');
    expect(looked).toMatchObject({ ok: true, detail: { web: { status: 'found', checkedAt: 77 } } });
    // A file with no folder on the server has no fingerprint to make; no server, nothing to make it on.
    expect(await service.hash('loras', 'nowhere.safetensors')).toMatchObject({ ok: false, error: 'no-hash' });
    const offline = new ModelLookupService({ db: () => db, client: () => client(web!), open: async () => null });
    upsertModelFiles(db, [{ directory: 'loras', name: 'other.safetensors', sizeBytes: 5, rootPath: '/srv/comfyui/models/loras' }], 1);
    expect(await offline.hash('loras', 'other.safetensors')).toMatchObject({ ok: false, error: 'no-server' });
    db.close();
  });
});
