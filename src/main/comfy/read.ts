import type Database from 'better-sqlite3';
import { upsertObjectInfo } from '../catalog/repository';
import { assertObjectInfoSize, MAX_OBJECT_INFO_BYTES, ObjectInfoError, parseObjectInfo } from '../../shared/catalog/objectInfo';

const READ_TIMEOUT_MS = 8000;

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

async function getJson(fetchImpl: typeof fetch, url: URL): Promise<{ ok: true; value: unknown } | ComfyReadFailure> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { method: 'GET', redirect: 'manual', signal: controller.signal });
    if (response.status >= 300 && response.status < 400) return { ok: false, error: 'Comfy origin was not read.' };
    if (!response.ok) return { ok: false, error: 'Comfy origin was not read.' };
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > MAX_OBJECT_INFO_BYTES) {
      return { ok: false, error: 'Catalog snapshot is too large.' };
    }
    const text = await response.text();
    assertObjectInfoSize(Buffer.byteLength(text));
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    if (error instanceof ObjectInfoError) return { ok: false, error: error.message };
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
    const parsed = parseObjectInfo(info.value);
    const stored = upsertObjectInfo(db, parsed);
    return {
      ok: true,
      version: versionOf(stats.value),
      devices: deviceCount(stats.value),
      nodes: stored.nodes,
      models: stored.models,
      skipped: stored.skipped,
    };
  } catch (error) {
    if (error instanceof ObjectInfoError) return { ok: false, error: error.message };
    if (error instanceof SyntaxError) return { ok: false, error: 'Catalog JSON could not be parsed.' };
    return { ok: false, error: 'Comfy origin was not read.' };
  }
}
