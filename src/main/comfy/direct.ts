/**
 * The direct catalog read of a plain ComfyUI (no MCP server), and the address check of Settings > Connection.
 * Used by mcp/sync.ts (readComfyDirect, metadata and previews), mcp/client.ts (collectComfyDirect for the nodes),
 * knowledge/preview.ts (readComfyPreview), settings/connectionSuggestions.ts and ipc.ts (checkComfy).
 * Collecting and publishing are split so no network wait happens inside a SQLite transaction.
 * The details of what this path can and cannot give follow below the imports.
 */
import type Database from 'better-sqlite3';
import type { McpModelFile, McpSession, McpToolCallResult } from '../../shared/mcp/catalogSource';
import { isModelFileIn } from '../../shared/mcp/catalogSource';
import { ObjectInfoError, parseObjectInfo, type ParsedObjectInfo } from '../../shared/catalog/objectInfo';
import { hasScheme, isLoopbackHost, isPlausibleHost, withLoopbackScheme } from '../../shared/mcp/loopback';
import { isPlainRelativeName, normalServerFolder } from '../../shared/mcp/serverPaths';
import {
  acceptCatalogSource,
  bumpCatalogRevision,
  catalogSourceKey,
  inferModelsFromNames,
  packNameFromModule,
  removeStaleModelFiles,
  removeStaleModelFilesIn,
  removeStaleNodeClasses,
  replaceNodePacks,
  upsertModelFiles,
  upsertObjectInfo,
  type NodePackRow,
} from '../catalog/repository';
import { COMFY_ROUTES, comfyGet, ComfyGateError, type ComfyAnswer, type ComfyRoute } from './gate';

/*
 * Reading the catalog straight from a ComfyUI address: what a plain ComfyUI serves over its own HTTP API, through
 * the read-only gate (gate.ts). Nothing here needs an MCP server.
 *
 * What this path gives: every node class with its inputs, outputs and defaults (/object_info), the pack of each class
 * (from its python_module, or ComfyUI-Manager's list when it is installed), every model file with its size and the
 * folder that holds it (/experiment/models, or /models on an older ComfyUI), the header metadata of .safetensors
 * files (/view_metadata) and the preview ComfyUI finds for a model (/experiment/models/preview).
 *
 * What it cannot give: the description file a model manager keeps next to a model (.civitai.info,
 * .metadata.json), a pack's README and pyproject.toml, and a file's fingerprint (SHA-256). ComfyUI does not serve
 * those; an MCP server that can read files does.
 */

/** Fixed English sentences (the codes); the renderer translates them (shared/i18n ERROR_KEYS and patterns). */
export const COMFY_URL_EMPTY = 'ComfyUI address is empty.';
export const COMFY_URL_NOT_ADDRESS = 'ComfyUI address is not an address.';
export const COMFY_URL_NO_SCHEME = 'ComfyUI address has no http:// or https:// in front.';
export const COMFY_URL_PROTOCOL = 'ComfyUI address must start with http:// or https://.';
export const COMFY_URL_CREDENTIALS = 'ComfyUI address must not carry a user name or password.';
export const comfyUrlBadHost = (host: string) => `ComfyUI address host is not a valid address: ${host}.`;
export const comfyUnreachable = (host: string) => `ComfyUI does not answer at ${host}.`;
export const comfyHostNotFound = (host: string) => `ComfyUI host was not found: ${host}.`;
export const comfyTooSlow = (seconds: number) => `ComfyUI answered too slowly: nothing came within ${seconds} s.`;
/** The address is an MCP server's (its path ends in /mcp or /sse and ComfyUI's own routes are not there). */
export const COMFY_IS_MCP = 'This is the address of an MCP server, not of ComfyUI.';
/** Something answers, but not ComfyUI's /system_stats. */
export const COMFY_NOT_COMFY = 'The address answers, but not as ComfyUI.';
/** ComfyUI answered /system_stats, but /object_info could not be read or understood. */
export const COMFY_NODES_UNREAD = 'ComfyUI answered, but its node list could not be read.';
/** A redirect: ComfyUI never sends one for these routes, so the address is something in front of it. */
export const COMFY_REDIRECT = 'The address sends the app somewhere else; enter the address of ComfyUI itself.';
export const COMFY_TOO_LARGE = 'Catalog snapshot is too large.';
/** Non-fatal: the model folders could not be listed at all (the nodes were read). */
export const COMFY_MODELS_UNREAD = 'ComfyUI did not list its model folders; models were not updated.';
/** Non-fatal: ComfyUI is older than the routes that give sizes and previews; only names were read. */
export const COMFY_MODELS_NAMES_ONLY = 'This ComfyUI lists model names only, without sizes or previews.';

/**
 * What the library stores as a model's preview file when ComfyUI said it has a picture for it (asked once per file,
 * while its header is read): the picture itself is asked for from ComfyUI's preview route when a card shows it.
 */
export const COMFY_PREVIEW_FILE = 'comfyui-preview.webp';

/** Model folders that are not model files: settings files and node pack code. */
const NOT_MODEL_FOLDERS = new Set(['configs', 'custom_nodes']);
/** More folders or files than this is not a ComfyUI the app reads as a whole. */
const MAX_FOLDERS = 200;
const MAX_FILES_PER_FOLDER = 100_000;

function hostOf(origin: URL): string {
  return origin.host;
}

/** The address as typed, checked: an origin to read, or the fixed sentence of what is wrong with it. */
export function comfyAddress(value: string): { ok: true; origin: URL; looksLikeMcp: boolean } | { ok: false; error: string } {
  const text = withLoopbackScheme(value ?? '');
  if (text === '') return { ok: false, error: COMFY_URL_EMPTY };
  if (!hasScheme(text)) {
    return /^[a-z0-9.[\]-]+(?::\d{1,5})?(?:\/\S*)?$/i.test(text) && /[.:]/.test(text) ? { ok: false, error: COMFY_URL_NO_SCHEME } : { ok: false, error: COMFY_URL_NOT_ADDRESS };
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: COMFY_URL_NOT_ADDRESS };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, error: COMFY_URL_PROTOCOL };
  if (url.username || url.password) return { ok: false, error: COMFY_URL_CREDENTIALS };
  // The host as typed, not as URL parsed it: URL silently turns a typo such as `192.168.1` into a full IPv4 address.
  const typedHost = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?(\[[^\]]*\]|[^:/?#]*)/i.exec(text)?.[1] ?? url.hostname;
  if (!isPlausibleHost(typedHost)) return { ok: false, error: comfyUrlBadHost(typedHost) };
  // An MCP server is usually reached at /mcp (Streamable HTTP) or /sse; ComfyUI itself has no such page.
  const looksLikeMcp = /\/(?:mcp|sse)\/?$/i.test(url.pathname);
  return { ok: true, origin: new URL(url.origin), looksLikeMcp };
}

/**
 * True when a ComfyUI address points at another computer over plain http (allowed: nothing secret is sent).
 * No caller in the app uses it at present.
 */
export function comfyAddressIsRemoteHttp(value: string): boolean {
  const checked = comfyAddress(value);
  return checked.ok && checked.origin.protocol === 'http:' && !isLoopbackHost(checked.origin.hostname);
}

/** The sentence for a ComfyUI read that did not work. */
export function comfyFailureSentence(answer: Extract<ComfyAnswer, { ok: false }>, origin: URL, route: ComfyRoute, looksLikeMcp = false): string {
  switch (answer.error) {
    case 'timeout':
      return comfyTooSlow(Math.round(route.timeoutMs / 1000));
    case 'hostNotFound':
      return comfyHostNotFound(origin.hostname);
    case 'unreachable':
      return comfyUnreachable(hostOf(origin));
    case 'redirect':
      return COMFY_REDIRECT;
    case 'large':
      return COMFY_TOO_LARGE;
    default:
      return looksLikeMcp ? COMFY_IS_MCP : COMFY_NOT_COMFY;
  }
}

/** The facts of /system_stats the app keeps and shows. */
export interface ComfySystem {
  version: string;
  os: string;
  devices: number;
  /** The first device's name (`cuda:0 NVIDIA …`), for the check sentence. */
  device: string;
}

/** What /system_stats says, without its argv (the command line ComfyUI was started with is never kept). */
export function systemOf(json: unknown): ComfySystem | null {
  if (!json || typeof json !== 'object') return null;
  const system = (json as { system?: unknown }).system;
  if (!system || typeof system !== 'object' || Array.isArray(system)) return null;
  const record = system as Record<string, unknown>;
  const devices = (json as { devices?: unknown }).devices;
  const first = Array.isArray(devices) && devices[0] && typeof devices[0] === 'object' ? (devices[0] as Record<string, unknown>).name : null;
  const short = (value: unknown, fallback: string) => (typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, 80) : fallback);
  return {
    version: short(record.comfyui_version, 'unknown'),
    os: short(record.os, ''),
    devices: Array.isArray(devices) ? devices.length : 0,
    device: short(first, ''),
  };
}

/** The answer of the Connection "Check" button: what ComfyUI is, or the sentence of what went wrong. */
export type ComfyCheck =({ ok: true; origin: string; local: boolean } & ComfySystem) | { ok: false; error: string };

/**
 * Settings ▸ Connection ▸ "Check": does ComfyUI answer at this address? One GET of /system_stats, through the gate.
 * Never throws.
 */
export async function checkComfy(value: string, fetchImpl: typeof fetch, timeoutMs?: number): Promise<ComfyCheck> {
  const address = comfyAddress(value);
  if (!address.ok) return address;
  const route = timeoutMs ? { ...COMFY_ROUTES.systemStats(), timeoutMs } : COMFY_ROUTES.systemStats();
  const answer = await comfyGet(address.origin, route, fetchImpl);
  if (!answer.ok) return { ok: false, error: comfyFailureSentence(answer, address.origin, route, address.looksLikeMcp) };
  const system = 'json' in answer ? systemOf(answer.json) : null;
  if (!system) return { ok: false, error: address.looksLikeMcp ? COMFY_IS_MCP : COMFY_NOT_COMFY };
  return { ok: true, origin: address.origin.origin, local: isLoopbackHost(address.origin.hostname), ...system };
}

/** The JSON of a successful answer, or undefined for a failure or a picture. */
function jsonOf(answer: ComfyAnswer): unknown {
  return answer.ok && 'json' in answer ? answer.json : undefined;
}

/** One model folder as ComfyUI lists it: its name and the folders on disk that make it up (newer ComfyUI). */
interface FolderListing {
  name: string;
  roots: string[];
}

/** The folders, with their paths on the ComfyUI machine (newer ComfyUI), or their names only (older). */
async function readFolders(origin: URL, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<{ folders: FolderListing[]; detailed: boolean } | null> {
  const detailed = await comfyGet(origin, COMFY_ROUTES.modelFolders(), fetchImpl, signal);
  const listed = jsonOf(detailed);
  if (signal?.aborted) return null;
  if (Array.isArray(listed) && listed.length <= MAX_FOLDERS) {
    const folders: FolderListing[] = [];
    for (const item of listed.slice(0, MAX_FOLDERS)) {
      if (!item || typeof item !== 'object') continue;
      const { name, folders: paths } = item as { name?: unknown; folders?: unknown };
      if (typeof name !== 'string' || !/^[A-Za-z0-9_.-]{1,80}$/.test(name) || NOT_MODEL_FOLDERS.has(name)) continue;
      // An entry's index is what the preview route asks by, so a path that is not plain keeps its place as null.
      const roots = Array.isArray(paths) ? paths.map((path) => normalServerFolder(path) ?? '') : [];
      folders.push({ name, roots });
    }
    return { folders, detailed: true };
  }
  const legacy = jsonOf(await comfyGet(origin, COMFY_ROUTES.modelFoldersLegacy(), fetchImpl, signal));
  if (!Array.isArray(legacy) || legacy.length > MAX_FOLDERS) return null;
  const folders = legacy.slice(0, MAX_FOLDERS)
    .filter((name): name is string => typeof name === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(name) && !NOT_MODEL_FOLDERS.has(name))
    .map((name) => ({ name, roots: [] }));
  return { folders, detailed: false };
}

type DirectModelFile = McpModelFile & { rootPath: string | null };

/** The files of one folder, or null when the folder could not be listed. */
async function readFolderFiles(origin: URL, folder: FolderListing, detailed: boolean, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<DirectModelFile[] | null> {
  if (detailed) {
    const listed = jsonOf(await comfyGet(origin, COMFY_ROUTES.modelFiles(folder.name), fetchImpl, signal));
    if (signal?.aborted) return null;
    if (Array.isArray(listed) && listed.length <= MAX_FILES_PER_FOLDER) {
      const files: DirectModelFile[] = [];
      for (const item of listed.slice(0, MAX_FILES_PER_FOLDER)) {
        if (!item || typeof item !== 'object') continue;
        const { name, pathIndex, size } = item as { name?: unknown; pathIndex?: unknown; size?: unknown };
        if (typeof name !== 'string' || !isPlainRelativeName(name) || !isModelFileIn(folder.name, name)) continue;
        const root = typeof pathIndex === 'number' && Number.isInteger(pathIndex) ? folder.roots[pathIndex] || null : null;
        const sizeBytes = typeof size === 'number' && Number.isFinite(size) && size >= 0 ? Math.round(size) : null;
        files.push({ directory: folder.name, name, sizeBytes, rootPath: root });
      }
      return files;
    }
  }
  const names = jsonOf(await comfyGet(origin, COMFY_ROUTES.modelFilesLegacy(folder.name), fetchImpl, signal));
  if (!Array.isArray(names) || names.length > MAX_FILES_PER_FOLDER) return null;
  return names.slice(0, MAX_FILES_PER_FOLDER)
    .filter((name): name is string => typeof name === 'string' && isPlainRelativeName(name) && isModelFileIn(folder.name, name))
    .map((name) => ({ directory: folder.name, name, sizeBytes: null, rootPath: null }));
}

/** Packs as ComfyUI-Manager lists them (`/customnode/installed`), or null when no manager answers. */
async function readManagerPacks(origin: URL, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<Map<string, { version: string | null; enabled: boolean }> | null> {
  const listed = jsonOf(await comfyGet(origin, COMFY_ROUTES.installedPacks(), fetchImpl, signal));
  if (!listed || typeof listed !== 'object' || Array.isArray(listed) || Object.keys(listed).length > 5000) return null;
  const packs = new Map<string, { version: string | null; enabled: boolean }>();
  for (const [name, value] of Object.entries(listed as Record<string, unknown>).slice(0, 5000)) {
    if (!/^[^\u0000-\u001f\u007f/\\]{1,200}$/.test(name) || !value || typeof value !== 'object') continue;
    const { ver, enabled } = value as { ver?: unknown; enabled?: unknown };
    packs.set(name, { version: typeof ver === 'string' && ver.trim() !== '' ? ver.trim().slice(0, 80) : null, enabled: enabled !== false });
  }
  return packs;
}

/** A direct read that worked: what was read, from where, and the non-fatal gaps. */
export interface DirectReadSuccess {
  ok: true;
  /** The address read, as an origin (`http://127.0.0.1:8188`). */
  origin: string;
  system: ComfySystem;
  nodes: number;
  packs: number;
  models: number;
  /** Where the pack list came from: ComfyUI-Manager's list, or the node classes' python modules. */
  packsFrom: 'manager' | 'modules';
  /** The model listing: with sizes and folders (newer ComfyUI), names only (older), or not read. */
  modelListing: 'detailed' | 'names' | 'none';
  /** Model folders whose listing failed while the others were read; their old list stays. */
  failedFolders: string[];
  /** Each model folder's paths on the ComfyUI machine in ComfyUI's order: the preview route asks by that index. */
  roots: Record<string, string[]>;
  /** Non-fatal problems, as fixed sentences. */
  warnings: string[];
}

export type DirectReadResult = DirectReadSuccess | { ok: false; error: string };

/** Options shared by collecting and publishing a direct read. */
export interface DirectReadOptions {
  signal?: AbortSignal;
  sourceKey?: string;
  /** Synchronous state writes participate in catalog publication; must not emit. */
  publishState?: (result: DirectReadSuccess) => void;
  /** Read the model folders too. Off when an MCP server gives the model list and ComfyUI only the nodes. */
  models?: boolean;
  /** The phase in progress, for the indicator. */
  onPhase?: (phase: 'catalog' | 'models' | 'packs', done: number, total: number) => void;
  /** Whether to stop: the address changed while reading. */
  cancelled?: () => boolean;
}

/**
 * Collects the catalog from ComfyUI without touching SQLite. Only GETs of the gate's routes go out.
 * Network failures return a fixed sentence; a successful snapshot is published synchronously below.
 */
export async function collectComfyDirect(
  address: string,
  fetchImpl: typeof fetch,
  options: DirectReadOptions = {},
): Promise<DirectCollectedResult> {
  const checked = comfyAddress(address);
  if (!checked.ok) return checked;
  const { origin, looksLikeMcp } = checked;
  const statsRoute = COMFY_ROUTES.systemStats();
  const stats = await comfyGet(origin, statsRoute, fetchImpl, options.signal);
  if (!stats.ok) return { ok: false, error: comfyFailureSentence(stats, origin, statsRoute, looksLikeMcp) };
  const system = systemOf(jsonOf(stats));
  if (!system) return { ok: false, error: looksLikeMcp ? COMFY_IS_MCP : COMFY_NOT_COMFY };
  if (options.signal?.aborted || options.cancelled?.()) return { ok: false, error: COMFY_URL_EMPTY };

  options.onPhase?.('catalog', 0, 0);
  const infoRoute = COMFY_ROUTES.objectInfo();
  const info = await comfyGet(origin, infoRoute, fetchImpl, options.signal);
  if (!info.ok) {
    if (info.error === 'timeout' || info.error === 'unreachable' || info.error === 'hostNotFound' || info.error === 'large') {
      return { ok: false, error: comfyFailureSentence(info, origin, infoRoute) };
    }
    return { ok: false, error: COMFY_NODES_UNREAD };
  }
  let parsed;
  try {
    parsed = parseObjectInfo(jsonOf(info));
  } catch (error) {
    return { ok: false, error: error instanceof ObjectInfoError && /too large/i.test(error.message) ? COMFY_TOO_LARGE : COMFY_NODES_UNREAD };
  }
  if (parsed.nodes.length === 0) return { ok: false, error: COMFY_NODES_UNREAD };
  if (options.signal?.aborted || options.cancelled?.()) return { ok: false, error: COMFY_URL_EMPTY };

  // Packs: ComfyUI-Manager's list when it answers (it knows versions and disabled packs), else the folders the
  // node classes were loaded from.
  options.onPhase?.('packs', 0, 0);
  const counts = new Map<string, number>();
  for (const node of parsed.nodes) {
    const pack = packNameFromModule(node.pythonModule ?? '');
    if (pack !== 'core') counts.set(pack, (counts.get(pack) ?? 0) + 1);
  }
  const manager = await readManagerPacks(origin, fetchImpl, options.signal);
  const packRows: NodePackRow[] = [];
  if (manager) {
    for (const [name, pack] of manager) {
      packRows.push({ name, version: pack.version, commitSha: null, installedState: 'installed', importState: pack.enabled ? 'imported' : 'disabled', classCount: counts.get(name) ?? 0 });
    }
    for (const [name, count] of counts) {
      if (!manager.has(name)) packRows.push({ name, version: null, commitSha: null, installedState: 'installed', importState: 'imported', classCount: count });
    }
  } else {
    for (const [name, count] of counts) packRows.push({ name, version: null, commitSha: null, installedState: 'installed', importState: 'imported', classCount: count });
  }
  if (options.signal?.aborted || options.cancelled?.()) return { ok: false, error: COMFY_URL_EMPTY };

  const warnings: string[] = [];
  const failedFolders: string[] = [];
  const roots: Record<string, string[]> = {};
  const files: DirectModelFile[] = [];
  let modelListing: DirectReadSuccess['modelListing'] = 'none';
  if (options.models !== false) {
    const folders = await readFolders(origin, fetchImpl, options.signal);
    if (!folders) {
      warnings.push(COMFY_MODELS_UNREAD);
    } else {
      modelListing = folders.detailed ? 'detailed' : 'names';
      if (!folders.detailed) warnings.push(COMFY_MODELS_NAMES_ONLY);
      for (const [index, folder] of folders.folders.entries()) {
        if (options.signal?.aborted || options.cancelled?.()) return { ok: false, error: COMFY_URL_EMPTY };
        options.onPhase?.('models', index, folders.folders.length);
        roots[folder.name] = folder.roots;
        let listed: DirectModelFile[] | null;
        try {
          listed = await readFolderFiles(origin, folder, folders.detailed, fetchImpl, options.signal);
        } catch (error) {
          if (!(error instanceof ComfyGateError)) throw error;
          listed = null;
        }
        if (listed) files.push(...listed);
        else failedFolders.push(folder.name);
      }
    }
  }
  if (options.signal?.aborted || options.cancelled?.()) return { ok: false, error: COMFY_URL_EMPTY };
  return {
    ok: true,
    origin: origin.origin,
    system,
    nodes: parsed.nodes.length,
    packs: packRows.length,
    models: files.length,
    parsed,
    packRows,
    files,
    packsFrom: manager ? 'manager' : 'modules',
    modelListing,
    failedFolders,
    roots,
    warnings,
  };
}

export interface DirectCatalogSnapshot extends DirectReadSuccess {
  parsed: ParsedObjectInfo;
  packRows: NodePackRow[];
  files: DirectModelFile[];
}
export type DirectCollectedResult = DirectCatalogSnapshot | { ok: false; error: string };

/** No network work occurs inside this transaction. Provenance failures roll back every catalog section. */
export function publishComfyDirect(db: Database.Database, snapshot: DirectCatalogSnapshot, now: number, options: DirectReadOptions = {}): DirectReadSuccess {
  return db.transaction(() => {
    if (options.signal?.aborted || options.cancelled?.()) throw new Error('Catalog collection cancelled');
    acceptCatalogSource(db, options.sourceKey ?? catalogSourceKey(['comfy', snapshot.origin]));
    upsertObjectInfo(db, snapshot.parsed, now);
    removeStaleNodeClasses(db, now);
    replaceNodePacks(db, snapshot.packRows, now, true);
    upsertModelFiles(db, snapshot.files, now);
    if (snapshot.modelListing !== 'none') {
      if (snapshot.failedFolders.length === 0) removeStaleModelFiles(db, now);
      else removeStaleModelFilesIn(db, now, Object.keys(snapshot.roots).filter((folder) => !snapshot.failedFolders.includes(folder)));
    }
    inferModelsFromNames(db);
    bumpCatalogRevision(db);
    const { parsed: _parsed, packRows: _packs, files: _files, ...result } = snapshot;
    options.publishState?.(result);
    return result;
  }).immediate();
}

export async function readComfyDirect(db: Database.Database, address: string, fetchImpl: typeof fetch, now: number, options: DirectReadOptions = {}): Promise<DirectReadResult> {
  const collected = await collectComfyDirect(address, fetchImpl, options);
  if (!collected.ok) return collected;
  if (options.signal?.aborted || options.cancelled?.()) return { ok: false, error: COMFY_URL_EMPTY };
  return publishComfyDirect(db, collected, now, options);
}

/**
 * The header metadata of model files, read from ComfyUI's /view_metadata, shaped as the one metadata tool the
 * sync's reading already understands (`model_metadata` read → `{embedded_metadata, civitai_sidecar}`). A file with
 * no metadata (ComfyUI answers 404) is a file read with nothing to say; a failed read throws so it is retried later.
 * Only `model_metadata` is answered; any other name is refused.
 */
export function comfyMetadataSession(originText: string, fetchImpl: typeof fetch, signal?: AbortSignal): McpSession {
  const origin = new URL(originText);
  const answer = (payload: unknown): McpToolCallResult => ({ content: [{ type: 'text', text: JSON.stringify(payload) }], structuredContent: payload as Record<string, unknown> });
  return {
    listTools: async () => [{ name: 'model_metadata' }],
    async callTool(name, args) {
      if (name !== 'model_metadata') throw new ComfyGateError('tool');
      const category = String((args as { category?: unknown }).category ?? '');
      const file = String((args as { name?: unknown }).name ?? '');
      // ComfyUI reads the header of .safetensors files only; any other file has none to read.
      if (!/\.safetensors$/i.test(file)) return answer({ embedded_metadata: {}, civitai_sidecar: null });
      const read = await comfyGet(origin, COMFY_ROUTES.viewMetadata(category, file), fetchImpl, signal);
      if (read.ok && 'json' in read) {
        const meta = read.json && typeof read.json === 'object' && !Array.isArray(read.json) ? read.json : {};
        return answer({ embedded_metadata: meta, civitai_sidecar: null });
      }
      if (!read.ok && read.error === 'notFound') return answer({ embedded_metadata: {}, civitai_sidecar: null });
      throw new Error('ComfyUI metadata read failed');
    },
    close: async () => undefined,
  };
}

/** The picture ComfyUI finds for a model (next to it or in its header), or null. Never throws. */
export async function readComfyPreview(
  originText: string,
  folder: string,
  pathIndex: number,
  name: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<{ bytes: Buffer; mime: string } | null> {
  let origin: URL;
  try {
    origin = new URL(originText);
  } catch {
    return null;
  }
  let route: ComfyRoute;
  try {
    route = COMFY_ROUTES.modelPreview(folder, pathIndex, name);
  } catch {
    return null;
  }
  const read = await comfyGet(origin, route, fetchImpl, signal);
  return read.ok && 'image' in read ? { bytes: read.image, mime: read.mime } : null;
}
