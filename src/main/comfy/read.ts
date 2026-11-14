import type Database from 'better-sqlite3';
import { upsertObjectInfo } from '../catalog/repository';
import { redactSecrets } from '../../shared/config/draft';
import { isLoopbackHost } from '../../shared/mcp/loopback';
import { assertObjectInfoSize, OBJECT_INFO_MAX_BYTES, ObjectInfoError, parseObjectInfo } from '../../shared/catalog/objectInfo';

export { isLoopbackHost };

/** Until the response headers arrive. */
const CONNECT_TIMEOUT_MS = 8000;
/**
 * For the whole body once headers are in. A large install (3000+ node classes) serves tens of MB from a busy
 * server; there is no size cap, only this generous time limit.
 */
const BODY_TIMEOUT_MS = 120_000;

export interface ComfyReadSuccess {
  ok: true;
  version: string;
  devices: number;
  nodes: number;
  models: number;
  skipped: string[];
}

export interface ComfyReadFailure {
  ok: false;
  error: string;
}

function allowedUrl(origin: string, path: '/system_stats' | '/object_info'): URL | null {
  let base: URL;
  try {
    base = new URL(origin);
  } catch {
    return null;
  }
  if ((base.protocol !== 'http:' && base.protocol !== 'https:') || base.username !== '' || base.password !== '') return null;
  const target = new URL(path, base);
  if (target.origin !== base.origin || target.pathname !== path) return null;
  return target;
}

/**
 * Reads a body chunk by chunk into one buffer and decodes it once (no second full copy as a string first).
 * `onBytes` sees the running total. More than `maxBytes` stops the read with ObjectInfoError, as the bytes arrive.
 */
export async function readBody(response: Response, onBytes?: (bytes: number) => void, maxBytes = OBJECT_INFO_MAX_BYTES): Promise<Buffer> {
  const declared = Number(response.headers?.get?.('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new ObjectInfoError('Catalog snapshot is too large.');
  }
  if (!response.body) {
    const whole = Buffer.from(await response.arrayBuffer());
    if (whole.length > maxBytes) throw new ObjectInfoError('Catalog snapshot is too large.');
    return whole;
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
      throw new ObjectInfoError('Catalog snapshot is too large.');
    }
    chunks.push(value);
    onBytes?.(total);
  }
  return Buffer.concat(chunks, total);
}

async function getJson(fetchImpl: typeof fetch, url: URL): Promise<{ ok: true; value: unknown; bytes: number } | ComfyReadFailure> {
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { method: 'GET', redirect: 'manual', signal: controller.signal });
    if (response.status >= 300 && response.status < 400) return { ok: false, error: 'Comfy origin was not read.' };
    if (!response.ok) return { ok: false, error: 'Comfy origin was not read.' };
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), BODY_TIMEOUT_MS);
    const body = await readBody(response);
    assertObjectInfoSize(body.length);
    return { ok: true, value: JSON.parse(body.toString('utf8')) as unknown, bytes: body.length };
  } catch (error) {
    if (error instanceof ObjectInfoError) return { ok: false, error: redactSecrets(error.message) };
    if (error instanceof SyntaxError) return { ok: false, error: 'Catalog JSON could not be parsed.' };
    return { ok: false, error: 'Comfy origin was not read.' };
  } finally {
    clearTimeout(timer);
  }
}

function versionOf(value: unknown): string {
  if (!value || typeof value !== 'object') return 'unknown';
  const system = (value as { system?: { comfyui_version?: unknown } }).system;
  const version = system?.comfyui_version;
  return typeof version === 'string' && version.trim() !== '' ? version.trim().slice(0, 80) : 'unknown';
}

function deviceCount(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const devices = (value as { devices?: unknown }).devices;
  return Array.isArray(devices) ? devices.length : 0;
}

/** GET /system_stats and GET /object_info on the saved origin. Never queues a prompt. */
export async function applyComfyRead(db: Database.Database, origin: string, fetchImpl: typeof fetch): Promise<ComfyReadSuccess | ComfyReadFailure> {
  const statsUrl = allowedUrl(origin, '/system_stats');
  const infoUrl = allowedUrl(origin, '/object_info');
  if (!statsUrl || !infoUrl) return { ok: false, error: 'Comfy origin is empty.' };
  const stats = await getJson(fetchImpl, statsUrl);
  if (!stats.ok) return stats;
  const info = await getJson(fetchImpl, infoUrl);
  if (!info.ok) return info;
  try {
    const started = Date.now();
    const parsed = parseObjectInfo(info.value);
    const stored = upsertObjectInfo(db, parsed);
    console.log(`[Comfy] object_info ${(info.bytes / (1024 * 1024)).toFixed(1)} MiB, ${stored.nodes} classes stored in ${Date.now() - started} ms`);
    return {
      ok: true,
      version: versionOf(stats.value),
      devices: deviceCount(stats.value),
      nodes: stored.nodes,
      models: stored.models,
      skipped: stored.skipped,
    };
  } catch (error) {
    if (error instanceof ObjectInfoError) return { ok: false, error: redactSecrets(error.message) };
    if (error instanceof SyntaxError) return { ok: false, error: 'Catalog JSON could not be parsed.' };
    return { ok: false, error: 'Comfy origin was not read.' };
  }
}

/**
 * A ComfyUI URL an MCP server reported is read only when it stays on this machine or is the origin the person
 * saved; otherwise a server could point the app at any address on the network. Returns the origin to read, or null.
 */
export function acceptedComfyUrl(reported: string | null, savedOrigin: string | null | undefined): string | null {
  if (!reported) return null;
  let url: URL;
  try {
    url = new URL(reported);
  } catch {
    return null;
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) return null;
  if (isLoopbackHost(url.hostname)) return url.origin;
  if (savedOrigin) {
    try {
      if (new URL(savedOrigin).origin === url.origin) return url.origin;
    } catch {
      return null;
    }
  }
  return null;
}
