/**
 * A fake of the two sites a model card can ask about a file, for tests: Civitai's `model-versions/by-hash` and
 * Hugging Face's model search, model record and raw README, plus a picture server. Plain `http` on loopback; the
 * app is pointed at it through ModelWebClient's endpoints (unit and integration tests) or, in a test build only,
 * the NODEWISE_TEST_MODEL_WEB variable (end-to-end tests). Every request is recorded with its time, so a test
 * can prove what was sent and how far apart. Labelled fixture: these records are made up.
 *
 * Paths: /civitai/api/v1/model-versions/by-hash/<sha256>, /hf/api/models?search=…, /hf/api/models/<id>,
 * /hf/<id>/raw/main/README.md, /hf/<id>/resolve/main/<file>, /img/<name>.
 */
import * as fs from 'fs';
import * as http from 'http';
import type { AddressInfo } from 'net';
import * as path from 'path';
import { fakeFileHash } from '../mcp/fakeMcpServer';

export interface FakeModelWebRequest {
  path: string;
  at: number;
  /** Request headers that would carry a credential, if any came (none should). */
  credentials: string[];
}

export interface FakeModelWeb {
  origin: string;
  requests: FakeModelWebRequest[];
  close: () => Promise<void>;
}

const STILL = fs.readFileSync(path.join(__dirname, '../mcp/side/still.png'));

/** Files Civitai knows, by the fake MCP server's fingerprint of them. */
export const CIVITAI_KNOWN = {
  /** Found: a LoRA whose own header and name say nothing of its family. */
  mystery: fakeFileHash('loras', 'mystery_style_v3.safetensors'),
  /** Found, and marked by the site as adult content: model flag and a picture rated 16. */
  marked: fakeFileHash('loras', 'Wan21_CausVid_14B_T2V_lora_rank32.safetensors'),
} as const;

function civitaiRecord(hash: string, origin: string): Record<string, unknown> | null {
  if (hash === CIVITAI_KNOWN.mystery) {
    return {
      id: 900101,
      modelId: 900100,
      name: 'v3',
      baseModel: 'SDXL 1.0',
      trainedWords: ['mystery style'],
      description: '<p>Less noise than v2.</p>',
      model: { name: 'Mystery Style', type: 'LORA', nsfw: false, tags: ['style', 'moody'] },
      images: [
        { url: `${origin}/img/width=1024/mystery.png`, nsfwLevel: 1, type: 'image', meta: { prompt: 'mystery style, a lighthouse in fog', negativePrompt: 'sunny', steps: 20, cfgScale: 6, sampler: 'euler' } },
        { url: `${origin}/img/width=1024/mystery-2.png`, nsfwLevel: 4, type: 'image', meta: { prompt: 'mystery style, a figure on the stairs', steps: 20, cfgScale: 6, sampler: 'euler' } },
      ],
      creator: { username: 'fogmaker' },
      files: [{ name: 'mystery_style_v3.safetensors', type: 'Model', primary: true, hashes: { SHA256: hash.toUpperCase() } }],
    };
  }
  if (hash === CIVITAI_KNOWN.marked) {
    return {
      id: 900201,
      modelId: 900200,
      name: 'rank32',
      baseModel: 'Wan Video 14B t2v',
      trainedWords: [],
      description: null,
      model: { name: 'Velvet Hour', type: 'LORA', nsfw: true, description: '<p>A slow evening look.</p>', tags: ['video'] },
      images: [
        { url: `${origin}/img/width=1024/velvet.png`, nsfwLevel: 16, type: 'image', meta: { prompt: 'velvet hour, a quiet room at dusk', steps: 8, cfgScale: 1, sampler: 'lcm' } },
      ],
      files: [{ name: 'Wan21_CausVid_14B_T2V_lora_rank32.safetensors', type: 'Model', primary: true, hashes: { SHA256: hash } }],
    };
  }
  return null;
}

/** What a file in a fake repository is: a real picture, a picture over the preview cap, or text named like a picture. */
type HfFile = 'picture' | 'huge' | 'text';

/**
 * What Hugging Face holds: repositories a file name can find. One shows a picture in its README; one has only
 * sample files among its files (the first two too large or not a picture); one is marked as adult content.
 */
export const HF_MODELS: Array<{ id: string; detail: Record<string, unknown>; readme: string; files: Record<string, HfFile> }> = [
  {
    id: 'ByteDance/SDXL-Lightning',
    detail: {
      id: 'ByteDance/SDXL-Lightning',
      pipeline_tag: 'text-to-image',
      tags: ['diffusers', 'text-to-image', 'stable-diffusion', 'license:openrail++', 'region:us'],
      cardData: { license: 'openrail++', base_model: 'stabilityai/stable-diffusion-xl-base-1.0' },
      siblings: [{ rfilename: 'README.md' }, { rfilename: 'comfyui/sdxl_lightning_workflow_lora.jpg' }, { rfilename: 'sdxl_lightning_8step_lora.safetensors' }, { rfilename: 'sdxl_lightning_samples.jpg' }],
    },
    files: { 'sdxl_lightning_samples.jpg': 'picture', 'comfyui/sdxl_lightning_workflow_lora.jpg': 'picture' },
    readme: [
      '---',
      'license: openrail++',
      'tags:',
      '- text-to-image',
      '---',
      '# SDXL-Lightning',
      '',
      '![Intro Image](sdxl_lightning_samples.jpg)',
      '',
      'SDXL-Lightning is a lightning-fast text-to-image generation model. It can generate high-quality 1024px images in a few steps. For more information, please refer to our research paper: [SDXL-Lightning: Progressive Adversarial Diffusion Distillation](https://arxiv.org/abs/2402.13929).',
      '',
      'We open-source the model as part of the research.',
      '',
      '```python',
      'import torch',
      '```',
    ].join('\n'),
  },
  {
    id: 'finegrain-lab/add-detail-xl',
    detail: {
      id: 'finegrain-lab/add-detail-xl',
      pipeline_tag: 'text-to-image',
      tags: ['lora', 'text-to-image', 'sdxl', 'license:mit'],
      cardData: { base_model: 'stabilityai/stable-diffusion-xl-base-1.0', instance_prompt: 'detailed' },
      siblings: [
        { rfilename: '.gitattributes' }, { rfilename: 'README.md' }, { rfilename: 'add-detail-xl.safetensors' }, { rfilename: 'assets/logo.png' },
        { rfilename: 'deep/one/two/three.png' }, { rfilename: 'examples/full_grid.png' }, { rfilename: 'examples/notes.png' }, { rfilename: 'samples/detail_01.webp' },
      ],
    },
    files: { 'assets/logo.png': 'picture', 'deep/one/two/three.png': 'picture', 'examples/full_grid.png': 'huge', 'examples/notes.png': 'text', 'samples/detail_01.webp': 'picture' },
    readme: [
      '# Add Detail XL',
      '',
      '[![Downloads](https://img.shields.io/badge/downloads-1k-blue.svg)](https://example.com)',
      '',
      'Adds fine detail to SDXL pictures. Start at 0.8.',
    ].join('\n'),
  },
  {
    id: 'velvet-studio/realisticVisionV60B1_v51VAE',
    detail: {
      id: 'velvet-studio/realisticVisionV60B1_v51VAE',
      pipeline_tag: 'text-to-image',
      tags: ['text-to-image', 'stable-diffusion', 'not-for-all-audiences', 'license:creativeml-openrail-m'],
      cardData: { tags: ['not-for-all-audiences'] },
      siblings: [{ rfilename: 'README.md' }, { rfilename: 'previews/cover.png' }],
    },
    files: { 'previews/cover.png': 'picture' },
    readme: [
      '# Realistic Vision 6.0',
      '',
      '<img src="previews/cover.png" width="512" alt="cover">',
      '',
      'A photographic checkpoint for SD 1.5.',
    ].join('\n'),
  },
];

/** More than the preview cap (16 MiB): a file this large is skipped for the next one. */
const HUGE_BYTES = 17 * 1024 * 1024;

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)));
}

function json(res: http.ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

export async function startFakeModelWeb(): Promise<FakeModelWeb> {
  const requests: FakeModelWebRequest[] = [];
  let origin = '';
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const credentials = ['authorization', 'cookie', 'x-api-key'].filter((name) => req.headers[name] !== undefined);
    requests.push({ path: `${url.pathname}${url.search}`, at: Date.now(), credentials });
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    const byHash = /^\/civitai\/api\/v1\/model-versions\/by-hash\/([0-9a-f]{64})$/.exec(url.pathname);
    if (byHash) {
      const found = civitaiRecord(byHash[1], origin);
      if (found) json(res, 200, found);
      else json(res, 404, { error: 'Model not found' });
      return;
    }
    if (url.pathname === '/hf/api/models') {
      const query = (url.searchParams.get('search') ?? '').toLowerCase();
      json(res, 200, HF_MODELS.filter((model) => query !== '' && model.id.toLowerCase().includes(query)).map((model) => ({ id: model.id, likes: 1, downloads: 10 })));
      return;
    }
    const detail = /^\/hf\/api\/models\/([^/]+\/[^/]+)$/.exec(url.pathname);
    if (detail) {
      const found = HF_MODELS.find((model) => model.id === decodeURIComponent(detail[1]));
      if (found) json(res, 200, found.detail);
      else json(res, 404, { error: 'Repository not found' });
      return;
    }
    const readme = /^\/hf\/([^/]+\/[^/]+)\/raw\/main\/README\.md$/.exec(url.pathname);
    if (readme) {
      const found = HF_MODELS.find((model) => model.id === decodeURIComponent(readme[1]));
      if (!found) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(found.readme);
      return;
    }
    const download = /^\/hf\/([^/]+\/[^/]+)\/resolve\/main\/(.+)$/.exec(url.pathname);
    if (download) {
      const found = HF_MODELS.find((model) => model.id === decodeURIComponent(download[1]));
      const file = found?.files[download[2].split('/').map(decodeURIComponent).join('/')];
      if (!file) { res.writeHead(404); res.end(); return; }
      // The site names every one a picture: what it really is shows only in its bytes.
      const bytes = file === 'picture' ? STILL : file === 'huge' ? Buffer.alloc(HUGE_BYTES, 1) : Buffer.from('These are not the pictures you are looking for.\n'.repeat(4));
      res.writeHead(200, { 'content-type': 'image/png', 'content-length': String(bytes.length) });
      res.end(bytes);
      return;
    }
    if (url.pathname.startsWith('/img/')) {
      res.writeHead(200, { 'content-type': 'image/png', 'content-length': String(STILL.length) });
      res.end(STILL);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const port = await listen(server);
  origin = `http://127.0.0.1:${port}`;
  return {
    origin,
    requests,
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    }),
  };
}
