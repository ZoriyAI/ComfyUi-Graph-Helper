/**
 * The read-only gate for ComfyUI's own HTTP API, as strict as the MCP one (main/mcp/readOnly.ts).
 *
 * Catalog, metadata and preview requests go through `comfyGet`, and `comfyGet` can only build URLs from
 * the closed list of read routes below: GET only, no body, no redirect followed, a byte cap and a time limit per
 * route. A route that queues a prompt, uploads, frees memory, interrupts, deletes or writes history, writes user
 * data or settings, or installs anything has no constructor here and cannot be asked for. The separate
 * upload.ts module accepts only an explicit user-selected file for the fixed input upload route.
 * Callers: comfy/direct.ts (catalog read, metadata, previews) and comfy/read.ts (the object_info read the MCP
 * client does when a server names its ComfyUI). The product rule behind it: the tutor never changes ComfyUI.
 *
 * Verified against ComfyUI's public source (comfyanonymous/ComfyUI at eee59185, version 0.45.0, November 2026):
 * server.py (`/system_stats`, `/object_info`, `/models`, `/models/{folder}`, `/view_metadata/{folder}`),
 * app/model_manager.py (`/experiment/models`, `/experiment/models/{folder}`,
 * `/experiment/models/preview/{folder}/{path_index}/{filename}`), app/custom_node_manager.py (`/i18n`), and
 * ComfyUI-Manager (Comfy-Org/ComfyUI-Manager at cac0748, glob/manager_server.py `/customnode/installed`).
 */

import { isPlainRelativeName } from '../../shared/mcp/serverPaths';
import { connectFailureKind } from '../mcp/connectError';

/** A read route of ComfyUI, with the byte cap and time limit of its answer. */
export interface ComfyRoute {
  /** Path and query, already encoded. */
  path: string;
  maxBytes: number;
  /** For the whole answer, headers and body. */
  timeoutMs: number;
  /** What the answer is: JSON, or a picture (the preview route). */
  kind: 'json' | 'image';
}

const MB = 1024 * 1024;
/** Limits for the small JSON answers (stats, folder lists, metadata, the Manager's pack list). */
const SMALL = { maxBytes: 4 * MB, timeoutMs: 20_000, kind: 'json' as const };

/** A folder name as ComfyUI names its model folders (checkpoints, loras, text_encoders, LLM …). */
const FOLDER = /^[A-Za-z0-9_.-]{1,80}$/;

/** The folder name encoded for a path, or ComfyGateError when it is not a plain folder name. */
function folderOk(folder: string): string {
  if (!FOLDER.test(folder) || folder === '.' || folder === '..') throw new ComfyGateError('folder');
  return encodeURIComponent(folder);
}

/** A model file name relative to its folder, as ComfyUI lists it: may hold sub-folders, `/` or `\`. */
function fileOk(name: string): string {
  if (name.length === 0 || name.length > 1024 || name.includes('\0')) throw new ComfyGateError('file');
  const parts = name.split(/[\\/]/);
  if (parts.some((part) => part === '..' || part === '.')) throw new ComfyGateError('file');
  return name;
}

/** The constructors of every route the app may ask for. Nothing else can be built. */
export const COMFY_ROUTES = {
  /** Version, operating system, memory and devices. */
  systemStats: (): ComfyRoute => ({ path: '/system_stats', ...SMALL }),
  /** Inspect existing execution only. No queue, history, interrupt or free mutation is permitted. */
  queue: (): ComfyRoute => ({ path: '/queue', maxBytes: 4 * MB, timeoutMs: 5000, kind: 'json' }),
  executionGuard: (): ComfyRoute => ({ path: '/reference_studio/ollama/status', maxBytes: 256 * 1024, timeoutMs: 5000, kind: 'json' }),
  promptHistory: (id: string): ComfyRoute => {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new ComfyGateError('prompt');
    return { path: `/history/${id}`, maxBytes: 4 * MB, timeoutMs: 5000, kind: 'json' };
  },
  /** Every node class: inputs, outputs, defaults, names, descriptions, category, python_module. Can be tens of MB. */
  objectInfo: (): ComfyRoute => ({ path: '/object_info', maxBytes: 128 * MB, timeoutMs: 180_000, kind: 'json' }),
  /** Model folders with their paths and file extensions (newer ComfyUI). */
  modelFolders: (): ComfyRoute => ({ path: '/experiment/models', ...SMALL }),
  /** Model folder names only (every ComfyUI). */
  modelFoldersLegacy: (): ComfyRoute => ({ path: '/models', ...SMALL }),
  /** The files of one folder with size, dates and which of its paths holds them (newer ComfyUI). */
  modelFiles: (folder: string): ComfyRoute => ({ path: `/experiment/models/${folderOk(folder)}`, maxBytes: 64 * MB, timeoutMs: 60_000, kind: 'json' }),
  /** The file names of one folder (every ComfyUI). */
  modelFilesLegacy: (folder: string): ComfyRoute => ({ path: `/models/${folderOk(folder)}`, maxBytes: 64 * MB, timeoutMs: 60_000, kind: 'json' }),
  /** The `__metadata__` of a .safetensors header (ComfyUI reads at most 1 MB of it). */
  viewMetadata: (folder: string, filename: string): ComfyRoute => {
    const name = fileOk(filename);
    if (!/\.safetensors$/i.test(name)) throw new ComfyGateError('file');
    return { path: `/view_metadata/${folderOk(folder)}?filename=${encodeURIComponent(name)}`, ...SMALL };
  },
  /** The preview picture ComfyUI finds next to a model file or in its header, as webp (newer ComfyUI). */
  modelPreview: (folder: string, pathIndex: number, filename: string): ComfyRoute => {
    if (!Number.isInteger(pathIndex) || pathIndex < 0 || pathIndex > 999) throw new ComfyGateError('index');
    const name = fileOk(filename).split(/[\\/]/).map(encodeURIComponent).join('/');
    return { path: `/experiment/models/preview/${folderOk(folder)}/${pathIndex}/${name}`, maxBytes: 16 * MB, timeoutMs: 30_000, kind: 'image' };
  },
  /** Explicitly named input raster only: no absolute path and no output/temp or arbitrary query. */
  inputImage: (filename: string): ComfyRoute => {
    if (!isPlainRelativeName(filename) || filename.includes('\\')) throw new ComfyGateError('file');
    const parts = filename.split('/'); const name = parts.pop()!;
    return { path: `/view?filename=${encodeURIComponent(name)}&type=input&subfolder=${encodeURIComponent(parts.join('/'))}&preview=webp%3B80`, maxBytes: 4 * MB, timeoutMs: 20_000, kind: 'image' };
  },
  /** Installed node packs with versions, only when ComfyUI-Manager is installed (404 otherwise). */
  installedPacks: (): ComfyRoute => ({ path: '/customnode/installed', ...SMALL }),
  /** Node name translations from the packs' locales folders. */
  translations: (): ComfyRoute => ({ path: '/i18n', maxBytes: 32 * MB, timeoutMs: 30_000, kind: 'json' }),
} as const;

/** Paths the gate lets out, as patterns over the encoded path (the second line of defence, checked on every request). */
const ALLOWED_PATHS: RegExp[] = [
  /^\/system_stats$/,
  /^\/queue$/,
  /^\/reference_studio\/ollama\/status$/,
  /^\/history\/[A-Za-z0-9_-]{1,128}$/,
  /^\/object_info$/,
  /^\/experiment\/models$/,
  /^\/models$/,
  /^\/experiment\/models\/[A-Za-z0-9_.-]{1,80}$/,
  /^\/models\/[A-Za-z0-9_.-]{1,80}$/,
  /^\/view_metadata\/[A-Za-z0-9_.-]{1,80}\?filename=[^&#]+$/,
  /^\/experiment\/models\/preview\/[A-Za-z0-9_.-]{1,80}\/\d{1,3}\/[^?#]+$/,
  /^\/view\?filename=[^&#]+&type=input&subfolder=[^&#]*&preview=webp%3B80$/,
  /^\/customnode\/installed$/,
  /^\/i18n$/,
];

/** Thrown when code asks for a route or argument the gate does not allow; `reason` names which check refused. */
export class ComfyGateError extends Error {
  constructor(readonly reason: string) {
    super('ComfyUI request refused by the read-only gate.');
    this.name = 'ComfyGateError';
  }
}

/** Whether a path (with its query) is one the gate lets out. */
export function comfyPathAllowed(pathAndQuery: string): boolean {
  if (pathAndQuery.includes('/../') || pathAndQuery.includes('/./') || /%2e%2e/i.test(pathAndQuery.split('?')[0])) return false;
  return ALLOWED_PATHS.some((pattern) => pattern.test(pathAndQuery));
}

/** The origin a ComfyUI address stands for: http(s), no user name or password, no path of its own. */
export function comfyOriginOf(address: string): URL | null {
  let url: URL;
  try {
    url = new URL(address.trim());
  } catch {
    return null;
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) return null;
  return new URL(url.origin);
}

/** The result of one gated read: parsed JSON, a picture, or why it failed. */
export type ComfyAnswer =
  | { ok: true; status: number; json: unknown; bytes: number }
  | { ok: true; status: number; image: Buffer; mime: string }
  | { ok: false; status: number | null; error: ComfyFailure };

/**
 * Why a read did not work: 'timeout' (slow), 'unreachable' (connection refused), 'hostNotFound' (no such host),
 * 'notFound' (404), 'http' (another error status), 'redirect' (a 3xx, never followed), 'shape' (not JSON, or not a
 * picture for the preview route), 'large' (past the route's byte cap).
 */
export type ComfyFailure = 'timeout' | 'unreachable' | 'hostNotFound' | 'notFound' | 'http' | 'redirect' | 'shape' | 'large';

/**
 * GET one allowed route of the ComfyUI at `origin`. Never throws for network problems; throws ComfyGateError for a
 * route outside the list (a programming error, never a server's doing).
 */
export async function comfyGet(origin: URL, route: ComfyRoute, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<ComfyAnswer> {
  if (!comfyPathAllowed(route.path)) throw new ComfyGateError('path');
  // A path such as `//host/x` would resolve to another origin; the second check refuses it.
  const target = new URL(route.path, origin);
  if (target.origin !== origin.origin) throw new ComfyGateError('origin');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), route.timeoutMs);
  timer.unref?.();
  try {
    // redirect: 'manual' so a 3xx cannot carry the request past the gate to a route or host it did not check.
    const response = await fetchImpl(target, { method: 'GET', redirect: 'manual', signal: controller.signal, headers: { accept: route.kind === 'json' ? 'application/json' : 'image/*' } });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel().catch(() => undefined);
      return { ok: false, status: response.status, error: 'redirect' };
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return { ok: false, status: response.status, error: response.status === 404 ? 'notFound' : 'http' };
    }
    const body = await readCapped(response, route.maxBytes);
    if (body === null) return { ok: false, status: response.status, error: 'large' };
    if (route.kind === 'image') {
      const mime = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!mime.startsWith('image/')) return { ok: false, status: response.status, error: 'shape' };
      return { ok: true, status: response.status, image: body, mime };
    }
    try {
      return { ok: true, status: response.status, json: JSON.parse(body.toString('utf8')) as unknown, bytes: body.length };
    } catch {
      return { ok: false, status: response.status, error: 'shape' };
    }
  } catch (error) {
    // The caller's own abort is reported as 'timeout' as well: either way the answer did not come in time.
    if (controller.signal.aborted) return { ok: false, status: null, error: 'timeout' };
    return { ok: false, status: null, error: connectFailureKind(error).kind === 'hostNotFound' ? 'hostNotFound' : 'unreachable' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

/** The body, or null once it grows past `maxBytes` (the read stops there). */
async function readCapped(response: Response, maxBytes: number): Promise<Buffer | null> {
  const declared = Number(response.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!response.body) {
    const whole = Buffer.from(await response.arrayBuffer());
    return whole.length > maxBytes ? null : whole;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}
