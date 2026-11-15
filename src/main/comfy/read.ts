/**
 * The small ComfyUI read the MCP client does on top of an MCP sync: /system_stats and /object_info of the ComfyUI
 * an MCP server names, so node classes get their inputs and defaults even when the server's tools do not list them.
 * Used by mcp/client.ts (applyComfyRead, acceptedComfyUrl). The full direct read of a ComfyUI is comfy/direct.ts.
 * acceptedComfyUrl exists because the address comes from the server, and a server must not steer the app elsewhere.
 */
import type Database from 'better-sqlite3';
import { hardwareOf, rememberHardware } from './hardware';
import { upsertObjectInfo } from '../catalog/repository';
import { redactSecrets } from '../../shared/config/draft';
import { isLoopbackHost } from '../../shared/mcp/loopback';
import { OBJECT_INFO_MAX_BYTES, ObjectInfoError, parseObjectInfo, type ParsedObjectInfo } from '../../shared/catalog/objectInfo';
import { COMFY_ROUTES, comfyGet, comfyOriginOf } from './gate';

export { isLoopbackHost };

/** What a successful read found: ComfyUI's version, device count and how many classes and models it stored. */
export interface ComfyReadSuccess {
  ok: true;
  version: string;
  devices: number;
  nodes: number;
  models: number;
  skipped: string[];
}

/** A read that did not work, with an English sentence safe to show (secrets redacted). */
export interface ComfyReadFailure {
  ok: false;
  error: string;
}

/**
 * Reads a body chunk by chunk into one buffer and decodes it once (no second full copy as a string first).
 * `onBytes` sees the running total. More than `maxBytes` stops the read with ObjectInfoError, as the bytes arrive.
 * Not used by the app's own reads any more (they go through gate.ts); tests/unit/security/sizeCaps.test.ts keeps it.
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

/** ComfyUI's version from a /system_stats answer, cut to 80 characters, or 'unknown'. */
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

/**
 * GET /system_stats and GET /object_info on the origin, through the read-only gate (gate.ts). Never queues a
 * prompt. Stores the node classes only: the whole read (packs, models) is comfy/direct.ts.
 */
export async function applyComfyRead(db: Database.Database, origin: string, fetchImpl: typeof fetch, options: { signal?: AbortSignal; collect?: (parsed: ParsedObjectInfo, document: unknown) => void } = {}): Promise<ComfyReadSuccess | ComfyReadFailure> {
  const base = comfyOriginOf(origin);
  if (!base) return { ok: false, error: 'Comfy origin is empty.' };
  const stats = await comfyGet(base, COMFY_ROUTES.systemStats(), fetchImpl, options.signal);
  if (!stats.ok || !('json' in stats)) return { ok: false, error: 'Comfy origin was not read.' };
  const info = await comfyGet(base, COMFY_ROUTES.objectInfo(), fetchImpl, options.signal);
  if (!info.ok || !('json' in info)) {
    return { ok: false, error: !info.ok && info.error === 'large' ? 'Catalog snapshot is too large.' : !info.ok && info.error === 'shape' ? 'Catalog JSON could not be parsed.' : 'Comfy origin was not read.' };
  }
  try {
    const started = Date.now();
    const parsed = parseObjectInfo(info.json);
    // With `collect` the caller stores the classes itself, later, inside its own catalog publication.
    const stored = options.collect
      ? (options.collect(parsed, info.json), { nodes: parsed.nodes.length, models: parsed.models.length, skipped: parsed.skipped })
      : upsertObjectInfo(db, parsed);
    rememberHardware(db, hardwareOf(base.origin, stats.json));
    console.log(`[Comfy] object_info ${(info.bytes / (1024 * 1024)).toFixed(1)} MiB, ${stored.nodes} classes read in ${Date.now() - started} ms`);
    return {
      ok: true,
      version: versionOf(stats.json),
      devices: deviceCount(stats.json),
      nodes: stored.nodes,
      models: stored.models,
      skipped: stored.skipped,
    };
  } catch (error) {
    if (error instanceof ObjectInfoError) return { ok: false, error: redactSecrets(error.message) };
    return { ok: false, error: 'Comfy origin was not read.' };
  }
}

/** Whether an address is a loopback address (the MCP server runs on this computer). */
function onThisComputer(address: string | null): boolean {
  if (!address) return false;
  try {
    return isLoopbackHost(new URL(address).hostname);
  } catch {
    return false;
  }
}

/**
 * A ComfyUI URL an MCP server reported is read only when it is the origin the person saved, or when both the MCP
 * server and that ComfyUI are on this computer. A server on another computer that names `127.0.0.1` means its own
 * machine; reading this computer's address for it would let a server steer the app at a local service. Any other
 * address could point the app anywhere on the network. Returns the origin to read, or null.
 * Without `mcpUrl` (a caller that does not know it) a loopback address counts as on this computer.
 */
export function acceptedComfyUrl(reported: string | null, savedOrigin: string | null | undefined, mcpUrl?: string | null): string | null {
  if (!reported) return null;
  let url: URL;
  try {
    url = new URL(reported);
  } catch {
    return null;
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) return null;
  if (savedOrigin) {
    try {
      if (new URL(savedOrigin).origin === url.origin) return url.origin;
    } catch {
      // A saved value that is not an address matches nothing.
    }
  }
  if (isLoopbackHost(url.hostname) && (mcpUrl === undefined || onThisComputer(mcpUrl))) return url.origin;
  return null;
}
