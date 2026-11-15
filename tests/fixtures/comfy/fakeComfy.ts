/**
 * A plain ComfyUI, as its own HTTP API answers (comfyanonymous/ComfyUI 0.45.0: server.py, app/model_manager.py),
 * with ComfyUI-Manager's `/customnode/installed` when asked for. Every request is recorded as `METHOD /path?query`
 * so a test can prove the app sent nothing but GETs of the read routes. Anything that is not a GET gets 405.
 * Labelled fixture: names, sizes and versions are made up.
 * Used by comfy-only-first-run, mcp-profiles and public e2e specs and by the comfyDirect and mcpProfiles integration
 * tests, which check how the app talks to a ComfyUI that has no MCP server in front of it.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { CLASSES, MODELS, objectInfoDocument, PACKS, VIDEO_CLASSES } from '../mcp/fakeMcpServer';

export interface FakeComfyOptions {
  /** Paths and sub-folder names as a ComfyUI on Windows reports them (`C:\ComfyUI\models\loras`, `sdxl\style.safetensors`). */
  windows?: boolean;
  /** ComfyUI-Manager is installed: `/customnode/installed` answers. */
  manager?: boolean;
  /** An older ComfyUI without the `/experiment/models` routes: names only, no sizes, no previews. */
  legacy?: boolean;
  /**
   * Serve the nodes every built-in lesson needs too (the fake MCP server's `video` set: video, model families,
   * techniques, foundations, sound, 3D, faces, the daily cycle), so the lesson list shows no lesson as unfit.
   */
  video?: boolean;
  /** Extra node classes in one big pack, for a large /object_info (each about 1 KB). */
  extraClasses?: number;
  /** One model folder answers 500 (its list is not read). */
  brokenFolder?: string;
  /** /object_info answers 500 (ComfyUI still starting). */
  noObjectInfo?: boolean;
  /** Listen on this port of 127.0.0.1 (8188 for "Find on this computer"); a random free one otherwise. */
  port?: number;
}

/** A running fake: its base URL, every request as `METHOD /path?query`, and a close that ends open connections. */
export interface FakeComfy {
  url: string;
  hits: string[];
  close: () => Promise<void>;
}

/** The model folders the fixture serves, each with one path on disk (two for loras). */
export const COMFY_FOLDERS = ['checkpoints', 'loras', 'vae', 'text_encoders', 'diffusion_models', 'controlnet', 'upscale_models', 'embeddings'];

/** Files that carry a preview picture in the fixture. */
export const PREVIEWED = new Set(['loras/add-detail-xl.safetensors', 'loras/sdxl/style_in_folder.safetensors']);

/** A LoRA in a sub-folder, listed `sdxl/style_in_folder.safetensors` (`sdxl\style_in_folder.safetensors` on Windows). */
export const SUB_FOLDER_LORA = 'sdxl/style_in_folder.safetensors';

/** The `__metadata__` of some .safetensors headers. */
export const HEADER_METADATA: Record<string, Record<string, string>> = {
  'loras/add-detail-xl.safetensors': {
    'modelspec.title': 'Detail slider',
    'modelspec.architecture': 'stable-diffusion-xl-v1-base/lora',
    ss_base_model_version: 'sdxl_base_v1-0',
  },
};

/** A tiny valid webp (1×1). */
export const WEBP = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64');

/** A big pack for a large /object_info: `custom_nodes.ComfyUI-BigPack`. */
export const BIG_PACK = 'ComfyUI-BigPack';

/** The disk path ComfyUI reports for a model folder; `index` 1 is a second, shared path (only loras has one). */
function rootOf(folder: string, index: number, windows: boolean): string {
  if (windows) return index === 0 ? `C:\\ComfyUI\\models\\${folder}` : `D:\\AI\\shared\\${folder}`;
  return index === 0 ? `/srv/comfyui/models/${folder}` : `/mnt/shared/${folder}`;
}

/** The files of a folder as ComfyUI lists them, with the path index; sub-folders use the system's separator. */
function filesOf(folder: string, windows: boolean): Array<{ name: string; pathIndex: number; size: number; display: string }> {
  const extra = folder === 'loras' ? [{ category: 'loras', filename: SUB_FOLDER_LORA, size: 144_000_000 }] : [];
  return [...MODELS, ...extra]
    .filter((model) => model.category === folder && !model.filename.startsWith('.') && !model.filename.includes('/.'))
    .map((model, index) => ({
      name: windows ? model.filename.replace(/\//g, '\\') : model.filename,
      display: model.filename,
      // The second file of loras lies in the second path.
      pathIndex: folder === 'loras' && index === 1 ? 1 : 0,
      size: model.size,
    }));
}

/** The /object_info document of the MCP fixture's classes plus `extra` generated classes of the big pack. */
function documentWith(extra: number, video: boolean): Record<string, unknown> {
  const doc = objectInfoDocument(video ? [...CLASSES, ...VIDEO_CLASSES] : CLASSES);
  for (let index = 0; index < extra; index += 1) {
    const name = `BigPackNode${String(index).padStart(5, '0')}`;
    doc[name] = {
      input: { required: { image: ['IMAGE'], strength: ['FLOAT', { default: 1, min: 0, max: 10, step: 0.01, tooltip: 'How strongly the effect is applied to the picture.' }] } },
      input_order: { required: ['image', 'strength'] },
      output: ['IMAGE'],
      output_is_list: [false],
      output_name: ['IMAGE'],
      name,
      display_name: `Big pack node ${index}`,
      description: 'A node of a large labelled pack used to test a large catalog.',
      python_module: `custom_nodes.${BIG_PACK}`,
      category: 'image/big',
      output_node: false,
    };
  }
  return doc;
}

/** Starts the fake on 127.0.0.1. The /object_info body is built once, so a large catalog costs time only here. */
export async function startFakeComfy(options: FakeComfyOptions = {}): Promise<FakeComfy> {
  const hits: string[] = [];
  const windows = options.windows === true;
  const info = JSON.stringify(documentWith(options.extraClasses ?? 0, options.video === true));
  const json = (res: http.ServerResponse, value: unknown, status = 200) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(typeof value === 'string' ? value : JSON.stringify(value));
  };
  const server = http.createServer((req, res) => {
    hits.push(`${req.method} ${req.url}`);
    if (req.method !== 'GET') {
      res.writeHead(405);
      res.end();
      return;
    }
    const url = new URL(req.url ?? '/', 'http://fixture');
    // Every route is also served under /api, as ComfyUI does.
    const path = decodeURIComponent(url.pathname.replace(/^\/api(?=\/)/, ''));
    if (path === '/system_stats') {
      json(res, {
        system: { os: windows ? 'nt' : 'posix', ram_total: 68_719_476_736, ram_free: 34_359_738_368, comfyui_version: '0.45.0', python_version: '3.12.9', pytorch_version: '2.9.0', embedded_python: windows, argv: ['main.py', '--listen', '--secret-flag'] },
        devices: [{ name: 'cuda:0 NVIDIA GeForce RTX 4090 : cudaMallocAsync', type: 'cuda', index: 0, vram_total: 25_757_220_864, vram_free: 20_000_000_000 }],
      });
      return;
    }
    if (path === '/object_info') {
      if (options.noObjectInfo) json(res, { error: 'starting' }, 500);
      else json(res, info);
      return;
    }
    if (path === '/customnode/installed' && options.manager) {
      json(res, Object.fromEntries(PACKS.filter((pack) => pack.module.startsWith('custom_nodes.')).map((pack) => [
        pack.module.slice('custom_nodes.'.length), { ver: pack.version ?? 'nightly', cnr_id: pack.name.toLowerCase(), aux_id: null, enabled: true },
      ])));
      return;
    }
    if (!options.legacy && path === '/experiment/models') {
      json(res, COMFY_FOLDERS.map((name) => ({ name, folders: name === 'loras' ? [rootOf(name, 0, windows), rootOf(name, 1, windows)] : [rootOf(name, 0, windows)], extensions: ['.safetensors', '.ckpt', '.pt', '.pth', '.bin', '.gguf'] })));
      return;
    }
    if (path === '/models') {
      json(res, COMFY_FOLDERS);
      return;
    }
    const detailed = /^\/experiment\/models\/([A-Za-z0-9_.-]+)$/.exec(path);
    if (!options.legacy && detailed) {
      if (!COMFY_FOLDERS.includes(detailed[1])) return json(res, { error: 'unknown folder' }, 404);
      if (detailed[1] === options.brokenFolder) return json(res, { error: 'broken' }, 500);
      json(res, filesOf(detailed[1], windows).map((file) => ({ name: file.name, pathIndex: file.pathIndex, modified: 1_760_000_000, created: 1_750_000_000, size: file.size })));
      return;
    }
    const legacyFolder = /^\/models\/([A-Za-z0-9_.-]+)$/.exec(path);
    if (legacyFolder) {
      if (!COMFY_FOLDERS.includes(legacyFolder[1])) return json(res, { error: 'unknown folder' }, 404);
      if (legacyFolder[1] === options.brokenFolder) return json(res, { error: 'broken' }, 500);
      json(res, filesOf(legacyFolder[1], windows).map((file) => file.name));
      return;
    }
    const meta = /^\/view_metadata\/([A-Za-z0-9_.-]+)$/.exec(path);
    if (meta) {
      const filename = (url.searchParams.get('filename') ?? '').replace(/\\/g, '/');
      const found = HEADER_METADATA[`${meta[1]}/${filename}`];
      if (found) json(res, found);
      else {
        res.writeHead(404);
        res.end();
      }
      return;
    }
    const preview = /^\/experiment\/models\/preview\/([A-Za-z0-9_.-]+)\/(\d+)\/(.+)$/.exec(path);
    if (!options.legacy && preview) {
      const filename = preview[3].replace(/\\/g, '/');
      if (PREVIEWED.has(`${preview[1]}/${filename}`)) {
        res.writeHead(200, { 'content-type': 'image/webp' });
        res.end(WEBP);
      } else {
        res.writeHead(404);
        res.end();
      }
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, '127.0.0.1', () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    hits,
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    }),
  };
}

/** Read routes the app may ask a ComfyUI for, as the fixture records them (path and query). */
export const READ_ROUTE = /^GET \/(system_stats|object_info|models(\/[A-Za-z0-9_.-]+)?|experiment\/models(\/[A-Za-z0-9_.-]+)?|experiment\/models\/preview\/[A-Za-z0-9_.-]+\/\d+\/[^?]+|view_metadata\/[A-Za-z0-9_.-]+\?filename=[^&]+|customnode\/installed|i18n)$/;
