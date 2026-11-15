import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type Database from 'better-sqlite3';
import type { ModelPreview } from '../../shared/contracts/knowledge';
import type { McpSession } from '../../shared/mcp/catalogSource';
import { previewKind, previewMime } from '../../shared/knowledge/sidecar';
import { PREVIEW_TRIES, webFoundFromJson } from '../../shared/knowledge/webLookup';
import { PREVIEW_MAX_BYTES, readSideFile, sideFilePath } from '../mcp/sideFiles';
import { COMFY_PREVIEW_FILE, readComfyPreview } from '../comfy/direct';
import { catalogSourceKey, normalizedMcpEndpoint } from '../catalog/repository';
import { readSettings } from '../settings/repository';

/**
 * The preview picture or clip a model manager keeps next to a model, handed to the window as bytes.
 *
 * A preview is read through the read-only MCP gate once and then kept in a folder of the app, under a name made
 * of its path and its listing signature: the same file is not asked for twice, and a preview that changed is.
 * Reads go one at a time over one session that closes after a short rest, so a list of thumbnails is one
 * connection and not a hundred. Nothing is written on the server.
 *
 * A file with nothing next to it may have a sample found on the internet at the person's request (see
 * modelWeb.ts). That one is downloaded by main from the site that named it, through the lookup's guarded client,
 * kept in the same folder, and handed over the same way: the window cannot tell the two apart, and needs not.
 */

/** The session rests this long after the last read before it is closed. */
const IDLE_CLOSE_MS = 20_000;
/** The cache folder is trimmed to this many files, oldest first, when it grows past it. */
export const PREVIEW_CACHE_FILES = 3000;
/** And to this many bytes: a sample video can be 16 MB, so a count alone could let the folder reach gigabytes. */
export const PREVIEW_CACHE_BYTES = 512 * 1024 * 1024;
/** Written since the last trim before the folder is looked at again. */
const TRIM_AFTER_BYTES = 64 * 1024 * 1024;

export interface PreviewDeps {
  db: () => Database.Database;
  /** A read-only session with the saved MCP server, or null when there is none to open. */
  open: () => Promise<McpSession | null>;
  /** Opaque accepted/configured connection binding for a fixed session provider (tests); null forbids network reads.
   * Defaults to comparing the saved endpoint with the published catalog connection in SQLite. */
  mcpBinding?: () => string | null;
  /** Where read previews are kept; null keeps none (tests, a profile that cannot be written). */
  cacheDir: string | null;
  /** Downloads a sample found on the internet; without it such a sample is not shown. */
  web?: (url: string) => Promise<{ bytes: Buffer; mime: string; kind: 'image' | 'video' } | null>;
  /**
   * When the library was read from ComfyUI itself: its address and each model folder's paths in ComfyUI's order.
   * A preview marked as ComfyUI's is then asked for from its preview route (comfy/gate.ts), not through MCP.
   */
  comfy?: () => { origin: string; roots: Record<string, string[]> } | null;
  fetchImpl?: typeof fetch;
}

interface PreviewRow {
  source_key: string | null;
  size_bytes: number | null;
  root_path: string | null;
  preview_file: string | null;
  preview_sig: string | null;
  web_status: string | null;
  web_notes_json: string | null;
}

const MIME_EXTENSION: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'video/mp4': 'mp4', 'video/webm': 'webm',
};

/** The name a sample from the internet is kept under in the folder: made of its address. */
function webKey(url: string): string {
  return createHash('sha256').update(`web\n${url}`).digest('hex');
}

/** The saved session helper opens current Settings: it may read catalog files only for the accepted endpoint. */
function savedMcpPreviewBinding(db: Database.Database): string | null {
  const settings = readSettings(db);
  if (settings.source === 'corrupt' || !settings.values.mcpUrl) return null;
  const rows = db.prepare("SELECT key, value FROM sync_state WHERE key IN ('catalog_source_key', 'catalog_source_connection', 'library_url', 'library_source')").all() as Array<{ key: string; value: string }>;
  const state = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  if (!state.catalog_source_key || !state.catalog_source_connection || !state.library_url
    || (state.library_source !== 'mcp' && state.library_source !== 'mcp+comfy')) return null;
  const current = normalizedMcpEndpoint(settings.values.mcpUrl);
  if (current !== normalizedMcpEndpoint(state.library_url)) return null;
  return catalogSourceKey([state.catalog_source_key, state.catalog_source_connection, current]);
}

export class PreviewReader {
  private session: McpSession | null = null;
  private opening: Promise<McpSession | null> | null = null;
  private idle: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<Buffer | null> = Promise.resolve(null);
  private readonly inFlight = new Map<string, Promise<ModelPreview | null>>();
  private sourceKey: string | null = null;
  private generation = 0;
  private written = 0;
  private writtenBytes = 0;

  constructor(private readonly deps: PreviewDeps) {}

  /** The preview of a model file, or null when it has none or it cannot be read now. Never throws. */
  get(directory: string, name: string): Promise<ModelPreview | null> {
    let row: PreviewRow | undefined;
    try {
      row = this.deps.db().prepare(`SELECT root_path, size_bytes, preview_file, preview_sig, web_status, web_notes_json, (SELECT value FROM sync_state WHERE key = 'catalog_source_key') AS source_key FROM model_catalog WHERE directory = ? AND name = ?`)
        .get(directory, name) as PreviewRow | undefined;
    } catch {
      return Promise.resolve(null);
    }
    if (row && row.source_key !== this.sourceKey) {
      this.stop();
      this.sourceKey = row.source_key;
    }
    if (row && !row.preview_file && row.web_status === 'found') {
      const preview = webFoundFromJson(row.web_notes_json)?.preview ?? null;
      return this.getWeb(preview ? [preview.url, ...(preview.more ?? [])] : []);
    }
    const file = row?.preview_file ?? null;
    if (row && file === COMFY_PREVIEW_FILE) return this.getComfy(directory, name, row);
    const source = sideFilePath(row?.root_path, file);
    if (!row || !file || !source) return Promise.resolve(null);
    const key = createHash('sha256').update(JSON.stringify([row.source_key, row.size_bytes, source, row.preview_sig])).digest('hex');
    const running = this.inFlight.get(key);
    if (running) return running;
    const work = this.load(key, source, file, this.generation).catch(() => null).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, work);
    return work;
  }

  /** The picture ComfyUI has for a model, from the folder when it was read before, else from ComfyUI's preview route. */
  private getComfy(directory: string, name: string, row: PreviewRow): Promise<ModelPreview | null> {
    let source: { origin: string; roots: Record<string, string[]> } | null = null;
    try {
      source = this.deps.comfy?.() ?? null;
    } catch {
      source = null;
    }
    const fetchImpl = this.deps.fetchImpl;
    const index = source && row.root_path ? (source.roots[directory] ?? []).indexOf(row.root_path) : -1;
    if (!source || !fetchImpl || index < 0) return Promise.resolve(null);
    const origin = source.origin;
    const key = createHash('sha256').update(JSON.stringify(['comfy', row.source_key, row.root_path, row.size_bytes, origin, directory, name, row.preview_sig])).digest('hex');
    const generation = this.generation;
    const running = this.inFlight.get(key);
    if (running) return running;
    const work = (async (): Promise<ModelPreview | null> => {
      const kept = this.cachePath(key, COMFY_PREVIEW_FILE);
      if (kept) {
        try {
          const bytes = fs.readFileSync(kept);
          if (bytes.length > 0) return { kind: 'image', mime: 'image/webp', bytes: new Uint8Array(bytes) };
        } catch {
          // Not kept yet.
        }
      }
      const got = await readComfyPreview(origin, directory, index, name, fetchImpl);
      if (generation !== this.generation || !got || got.bytes.length === 0) return null;
      if (kept && got.mime === 'image/webp') this.keep(kept, got.bytes);
      return { kind: 'image', mime: got.mime, bytes: new Uint8Array(got.bytes) };
    })().catch(() => null).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, work);
    return work;
  }

  /**
   * A sample from the internet: from the folder when it was downloaded before, else from the site. A marked
   * Hugging Face sample was not checked at lookup and may name a few places: they are tried in turn, at most
   * PREVIEW_TRIES, and the first that is a picture or a clip is shown.
   */
  private getWeb(urls: string[]): Promise<ModelPreview | null> {
    const download = this.deps.web;
    const tries = urls.slice(0, PREVIEW_TRIES);
    if (tries.length === 0 || !download) return Promise.resolve(null);
    const key = webKey(tries.join('\n'));
    const running = this.inFlight.get(key);
    if (running) return running;
    const work = (async (): Promise<ModelPreview | null> => {
      for (const url of tries) {
        const kept = this.keptWeb(url);
        if (kept) return kept;
      }
      for (const url of tries) {
        const got = await download(url);
        if (!got || got.bytes.length === 0) continue;
        this.keepWeb(url, got);
        return { kind: got.kind, mime: got.mime, bytes: new Uint8Array(got.bytes) };
      }
      return null;
    })().catch(() => null).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, work);
    return work;
  }

  private keptWeb(url: string): ModelPreview | null {
    if (!this.deps.cacheDir) return null;
    const key = webKey(url);
    for (const [mime, extension] of Object.entries(MIME_EXTENSION)) {
      try {
        const bytes = fs.readFileSync(path.join(this.deps.cacheDir, `${key}.${extension}`));
        if (bytes.length > 0) return { kind: mime.startsWith('video/') ? 'video' : 'image', mime, bytes: new Uint8Array(bytes) };
      } catch {
        // Not kept under this kind.
      }
    }
    return null;
  }

  /**
   * Keeps a sample from the internet in the folder, under its address. The lookup calls it for the sample it
   * downloaded to check, so the card that shows it does not download it again.
   */
  keepWeb(url: string, got: { bytes: Buffer; mime: string }): void {
    const extension = MIME_EXTENSION[got.mime];
    const kept = extension ? this.cachePath(webKey(url), `x.${extension}`) : null;
    if (kept && got.bytes.length > 0) this.keep(kept, got.bytes);
  }

  /** Closes the session and stops the idle timer. Read previews stay in their folder. */
  stop(): void {
    this.generation += 1;
    if (this.idle) clearTimeout(this.idle);
    this.idle = null;
    const session = this.session;
    this.session = null;
    void session?.close().catch(() => undefined);
  }

  private mcpBinding(): string | null {
    try {
      return this.deps.mcpBinding ? this.deps.mcpBinding() : savedMcpPreviewBinding(this.deps.db());
    } catch {
      return null;
    }
  }

  private mcpBindingCurrent(binding: string, generation: number): boolean {
    if (generation !== this.generation) return false;
    if (this.mcpBinding() === binding) return true;
    this.stop();
    return false;
  }

  private async load(key: string, source: string, file: string, generation: number): Promise<ModelPreview | null> {
    const binding = this.mcpBinding();
    if (binding === null) this.stop();
    const kind = previewKind(file);
    const mime = previewMime(file);
    const kept = this.cachePath(key, file);
    if (kept) {
      try {
        const bytes = fs.readFileSync(kept);
        if (bytes.length > 0) return { kind, mime, bytes: new Uint8Array(bytes) };
      } catch {
        // Not kept yet.
      }
    }
    // Cached catalog bytes remain valid while Settings points elsewhere; an uncached read must match.
    if (binding === null) return null;
    // One read at a time: the queue is what makes many thumbnails one connection.
    const turn = this.queue.catch(() => null).then(() => this.mcpBindingCurrent(binding, generation) ? this.read(source, generation, binding) : null);
    this.queue = turn;
    const bytes = await turn;
    if (!this.mcpBindingCurrent(binding, generation) || !bytes || bytes.length === 0) return null;
    if (kept) this.keep(kept, bytes);
    return { kind, mime, bytes: new Uint8Array(bytes) };
  }

  private async read(source: string, generation: number, binding: string): Promise<Buffer | null> {
    if (this.idle) clearTimeout(this.idle);
    this.idle = null;
    try {
      if (!this.session) {
        this.opening ??= this.deps.open().finally(() => {
          this.opening = null;
        });
        const opened = await this.opening;
        if (!this.mcpBindingCurrent(binding, generation)) { await opened?.close().catch(() => undefined); return null; }
        this.session = opened;
      }
      if (!this.session) return null;
      const bytes = await readSideFile(this.session, source, PREVIEW_MAX_BYTES);
      return this.mcpBindingCurrent(binding, generation) ? bytes : null;
    } catch {
      // The connection went away: the next read opens a new one.
      if (generation === this.generation) {
        const broken = this.session;
        this.session = null;
        void broken?.close().catch(() => undefined);
      }
      return null;
    } finally {
      if (generation === this.generation) {
        this.idle = setTimeout(() => this.stop(), IDLE_CLOSE_MS);
        this.idle.unref?.();
      }
    }
  }

  private cachePath(key: string, file: string): string | null {
    if (!this.deps.cacheDir) return null;
    const extension = /\.([a-z0-9]{2,5})$/i.exec(file)?.[1].toLowerCase() ?? 'bin';
    return path.join(this.deps.cacheDir, `${key}.${extension}`);
  }

  private keep(target: string, bytes: Buffer): void {
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      const partial = `${target}.part`;
      fs.writeFileSync(partial, bytes, { mode: 0o600 });
      fs.renameSync(partial, target);
      this.written += 1;
      this.writtenBytes += bytes.length;
      if (this.written % 200 === 1 || this.writtenBytes >= TRIM_AFTER_BYTES) {
        this.writtenBytes = 0;
        trimCache(path.dirname(target), PREVIEW_CACHE_FILES, PREVIEW_CACHE_BYTES);
      }
    } catch {
      // A preview that cannot be kept is read again next time.
    }
  }
}

/** Removes the oldest files of the cache folder beyond `most` files or `maxBytes` bytes in all. */
export function trimCache(folder: string, most: number, maxBytes = Infinity): void {
  try {
    const files = fs.readdirSync(folder)
      .map((name) => {
        const file = path.join(folder, name);
        const stat = fs.statSync(file);
        return { file, time: stat.mtimeMs, size: stat.size };
      })
      .sort((left, right) => right.time - left.time);
    let total = 0;
    files.forEach((item, index) => {
      total += item.size;
      if (index >= most || total > maxBytes) fs.rmSync(item.file, { force: true });
    });
  } catch {
    // The folder is not there, or a file went away meanwhile.
  }
}

/** The folder under the profile where previews are kept. */
export const PREVIEW_CACHE_FOLDER = 'model-previews';

/**
 * Empties the preview folder: Settings ▸ Privacy ▸ "Clear the picture cache", and a change of the server address
 * (pictures of another server's models do not stay on the disk). Returns how many files and bytes went.
 */
export function clearPreviewCache(folder: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  try {
    for (const name of fs.readdirSync(folder)) {
      const file = path.join(folder, name);
      try {
        const stat = fs.statSync(file);
        if (!stat.isFile()) continue;
        fs.rmSync(file, { force: true });
        files += 1;
        bytes += stat.size;
      } catch {
        // Gone meanwhile.
      }
    }
  } catch {
    // No folder: nothing kept.
  }
  return { files, bytes };
}

/** How many files and bytes the preview folder holds now. */
export function previewCacheSize(folder: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  try {
    for (const name of fs.readdirSync(folder)) {
      try {
        const stat = fs.statSync(path.join(folder, name));
        if (!stat.isFile()) continue;
        files += 1;
        bytes += stat.size;
      } catch {
        // Gone meanwhile.
      }
    }
  } catch {
    // No folder.
  }
  return { files, bytes };
}
