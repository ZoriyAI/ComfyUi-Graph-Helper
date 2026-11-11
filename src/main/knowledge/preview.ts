import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type Database from 'better-sqlite3';
import type { ModelPreview } from '../../shared/contracts/knowledge';
import type { McpSession } from '../../shared/mcp/catalogSource';
import { previewKind, previewMime } from '../../shared/knowledge/sidecar';
import { webFoundFromJson } from '../../shared/knowledge/webLookup';
import { PREVIEW_MAX_BYTES, readSideFile, sideFilePath } from '../mcp/sideFiles';

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

export interface PreviewDeps {
  db: () => Database.Database;
  /** A read-only session with the saved MCP server, or null when there is none to open. */
  open: () => Promise<McpSession | null>;
  /** Where read previews are kept; null keeps none (tests, a profile that cannot be written). */
  cacheDir: string | null;
  /** Downloads a sample found on the internet; without it such a sample is not shown. */
  web?: (url: string) => Promise<{ bytes: Buffer; mime: string; kind: 'image' | 'video' } | null>;
}

interface PreviewRow {
  root_path: string | null;
  preview_file: string | null;
  preview_sig: string | null;
  web_status: string | null;
  web_notes_json: string | null;
}

const MIME_EXTENSION: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'video/mp4': 'mp4', 'video/webm': 'webm',
};

export class PreviewReader {
  private session: McpSession | null = null;
  private opening: Promise<McpSession | null> | null = null;
  private idle: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<Buffer | null> = Promise.resolve(null);
  private readonly inFlight = new Map<string, Promise<ModelPreview | null>>();
  private written = 0;

  constructor(private readonly deps: PreviewDeps) {}

  /** The preview of a model file, or null when it has none or it cannot be read now. Never throws. */
  get(directory: string, name: string): Promise<ModelPreview | null> {
    let row: PreviewRow | undefined;
    try {
      row = this.deps.db().prepare('SELECT root_path, preview_file, preview_sig, web_status, web_notes_json FROM model_catalog WHERE directory = ? AND name = ?')
        .get(directory, name) as PreviewRow | undefined;
    } catch {
      return Promise.resolve(null);
    }
    if (row && !row.preview_file && row.web_status === 'found') return this.getWeb(webFoundFromJson(row.web_notes_json)?.preview?.url ?? null);
    const file = row?.preview_file ?? null;
    const source = sideFilePath(row?.root_path, file);
    if (!row || !file || !source) return Promise.resolve(null);
    const key = createHash('sha256').update(`${source}\n${row.preview_sig ?? ''}`).digest('hex');
    const running = this.inFlight.get(key);
    if (running) return running;
    const work = this.load(key, source, file).catch(() => null).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, work);
    return work;
  }

  /** A sample from the internet: from the folder when it was downloaded before, else from the site. */
  private getWeb(url: string | null): Promise<ModelPreview | null> {
    const download = this.deps.web;
    if (!url || !download) return Promise.resolve(null);
    const key = createHash('sha256').update(`web\n${url}`).digest('hex');
    const running = this.inFlight.get(key);
    if (running) return running;
    const work = (async (): Promise<ModelPreview | null> => {
      if (this.deps.cacheDir) {
        for (const [mime, extension] of Object.entries(MIME_EXTENSION)) {
          try {
            const bytes = fs.readFileSync(path.join(this.deps.cacheDir, `${key}.${extension}`));
            if (bytes.length > 0) return { kind: mime.startsWith('video/') ? 'video' : 'image', mime, bytes: new Uint8Array(bytes) };
          } catch {
            // Not kept under this kind.
          }
        }
      }
      const got = await download(url);
      if (!got || got.bytes.length === 0) return null;
      const kept = this.cachePath(key, `x.${MIME_EXTENSION[got.mime] ?? 'bin'}`);
      if (kept && MIME_EXTENSION[got.mime]) this.keep(kept, got.bytes);
      return { kind: got.kind, mime: got.mime, bytes: new Uint8Array(got.bytes) };
    })().catch(() => null).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, work);
    return work;
  }

  /** Closes the session and stops the idle timer. Read previews stay in their folder. */
  stop(): void {
    if (this.idle) clearTimeout(this.idle);
    this.idle = null;
    const session = this.session;
    this.session = null;
    void session?.close().catch(() => undefined);
  }

  private async load(key: string, source: string, file: string): Promise<ModelPreview | null> {
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
    // One read at a time: the queue is what makes many thumbnails one connection.
    const turn = this.queue.catch(() => null).then(() => this.read(source));
    this.queue = turn;
    const bytes = await turn;
    if (!bytes || bytes.length === 0) return null;
    if (kept) this.keep(kept, bytes);
    return { kind, mime, bytes: new Uint8Array(bytes) };
  }

  private async read(source: string): Promise<Buffer | null> {
    if (this.idle) clearTimeout(this.idle);
    this.idle = null;
    try {
      if (!this.session) {
        this.opening ??= this.deps.open().finally(() => {
          this.opening = null;
        });
        this.session = await this.opening;
      }
      if (!this.session) return null;
      return await readSideFile(this.session, source, PREVIEW_MAX_BYTES);
    } catch {
      // The connection went away: the next read opens a new one.
      const broken = this.session;
      this.session = null;
      void broken?.close().catch(() => undefined);
      return null;
    } finally {
      this.idle = setTimeout(() => this.stop(), IDLE_CLOSE_MS);
      this.idle.unref?.();
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
      if (this.written % 200 === 1) trimCache(path.dirname(target), PREVIEW_CACHE_FILES);
    } catch {
      // A preview that cannot be kept is read again next time.
    }
  }
}

/** Removes the oldest files of the cache folder beyond `most`. */
export function trimCache(folder: string, most: number): void {
  try {
    const files = fs.readdirSync(folder)
      .map((name) => {
        const file = path.join(folder, name);
        return { file, time: fs.statSync(file).mtimeMs };
      })
      .sort((left, right) => right.time - left.time);
    for (const item of files.slice(most)) fs.rmSync(item.file, { force: true });
  } catch {
    // The folder is not there, or a file went away meanwhile.
  }
}
