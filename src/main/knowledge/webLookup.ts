import { pinnedRequest, vetWebTarget, type FetchLike } from '../agent/web';
import {
  bestHuggingFaceMatch, civitaiFound, huggingFaceFound, nameQueries, type WebError, type WebFound,
} from '../../shared/knowledge/webLookup';
import { PREVIEW_MAX_BYTES } from '../mcp/sideFiles';

/**
 * Asking Civitai and Hugging Face about a model file, from the main process only.
 *
 * Only plain GETs to fixed sites: civitai.com and huggingface.co, and the servers they keep pictures and files on.
 * No key, no cookie, no credential of any kind is sent; the app has none for these sites and wants none. Every
 * address is checked against that short list before anything is sent, every redirect again, and the connection
 * goes through the same guard as the helper's page reader (shared/agent/web.ts): the host is resolved and refused
 * when it points into this machine or a private network, and the connection is pinned to the address that was
 * checked. Answers are bounded in size and time. Requests are spaced: never faster than one every `pauseMs`.
 *
 * What is sent is the file's fingerprint (to Civitai) or its name without folder and precision (to Hugging Face).
 * That leaves the computer, so it happens only when the person asked: in the card of that file, or for all files
 * at sync when Settings ▸ Privacy allows it.
 */

export interface LookupEndpoints {
  civitai: string;
  huggingface: string;
}

/** The sites asked. Fixed: tests pass their own fake (ModelWebDeps.endpoints), the app never does. */
export const LOOKUP_ENDPOINTS: LookupEndpoints = { civitai: 'https://civitai.com', huggingface: 'https://huggingface.co' };
/** Where the two sites keep the pictures and files their pages and records point to. */
export const MEDIA_HOSTS = ['image.civitai.com', 'image-b2.civitai.com', 'cdn-lfs.huggingface.co', 'cdn-lfs-us-1.huggingface.co', 'cdn-lfs.hf.co'] as const;
export const LOOKUP_TIMEOUT_MS = 15_000;
/** An API answer of the size these sites give is far below this; more is not their answer. */
export const LOOKUP_JSON_MAX_BYTES = 2 * 1024 * 1024;
export const README_MAX_BYTES = 512 * 1024;
/** Sync spaces its requests at least this far apart, so many files never become a burst at the site. */
export const SYNC_LOOKUP_PAUSE_MS = 1_000;
/** How many files one sync looks up at most; the rest wait for the next sync. */
export const SYNC_LOOKUPS_PER_RUN = 200;
/** A lookup the person started in a card still keeps its requests apart, a little. */
export const CARD_LOOKUP_PAUSE_MS = 250;
const MAX_REDIRECTS = 3;
const USER_AGENT = 'ComfyUI-Graph-Helper (model card lookup)';

export class LookupFailure extends Error {
  constructor(readonly code: WebError) {
    super(`Model lookup failed: ${code}.`);
    this.name = 'LookupFailure';
  }
}

export type LookupOutcome = { status: 'found'; found: WebFound } | { status: 'not-found' } | { status: 'error'; error: WebError };

export interface ModelWebDeps {
  /** Tests only: a fake of both sites. Its own host is then the only one allowed, over http too. */
  endpoints?: LookupEndpoints;
  /** Tests only: the request without the address guard (the fake listens on this machine). */
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
}

interface Answer {
  status: number;
  type: string;
  bytes: Buffer;
}

function failureOf(error: unknown): LookupFailure {
  if (error instanceof LookupFailure) return error;
  const text = error instanceof Error ? `${error.name} ${error.message} ${String((error as { cause?: unknown }).cause ?? '')}` : String(error);
  return new LookupFailure(/timeout|abort/i.test(text) ? 'timeout' : 'unreachable');
}

async function readBounded(response: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(response.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new LookupFailure('bad-answer');
  }
  if (!response.body) {
    const whole = Buffer.from(await response.arrayBuffer());
    if (whole.length > maxBytes) throw new LookupFailure('bad-answer');
    return whole;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new LookupFailure('bad-answer');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export class ModelWebClient {
  readonly endpoints: LookupEndpoints;
  private readonly hosts: Set<string>;
  private readonly testing: boolean;
  private last = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: ModelWebDeps = {}) {
    this.testing = deps.endpoints !== undefined;
    this.endpoints = deps.endpoints ?? LOOKUP_ENDPOINTS;
    this.hosts = new Set(this.testing
      ? [new URL(this.endpoints.civitai).host, new URL(this.endpoints.huggingface).host]
      : [new URL(LOOKUP_ENDPOINTS.civitai).host, new URL(LOOKUP_ENDPOINTS.huggingface).host, ...MEDIA_HOSTS]);
  }

  /** Whether an address may be asked: one of the fixed hosts, https, no user name or password, the usual port. */
  allowed(raw: string): URL | null {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    if (url.username !== '' || url.password !== '') return null;
    if (this.testing) return (url.protocol === 'http:' || url.protocol === 'https:') && this.hosts.has(url.host) ? url : null;
    return url.protocol === 'https:' && url.port === '' && this.hosts.has(url.hostname.toLowerCase()) ? url : null;
  }

  /**
   * One GET, after the pause since the last request, through the address guard, following at most three
   * redirects that stay on the fixed hosts. 404 comes back as an answer; other failures throw LookupFailure.
   */
  get(raw: string, maxBytes: number, accept: string, pauseMs: number): Promise<Answer> {
    // One request at a time over the whole app: the pause holds between a card's lookup and a sync's.
    const turn = this.queue.catch(() => undefined).then(() => this.send(raw, maxBytes, accept, pauseMs));
    this.queue = turn;
    return turn;
  }

  private async send(raw: string, maxBytes: number, accept: string, pauseMs: number): Promise<Answer> {
    const now = this.deps.now ?? Date.now;
    const wait = this.last + pauseMs - now();
    if (this.last > 0 && wait > 0) await (this.deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(wait);
    const first = this.allowed(raw);
    if (!first) throw new LookupFailure('bad-answer');
    let url: URL = first;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('timeout')), this.deps.timeoutMs ?? LOOKUP_TIMEOUT_MS);
    try {
      for (let hop = 0; ; hop += 1) {
        this.last = now();
        const init: RequestInit = {
          method: 'GET',
          headers: { 'user-agent': USER_AGENT, accept },
          redirect: 'manual',
          credentials: 'omit',
          signal: controller.signal,
        };
        let response: Response;
        try {
          if (this.deps.fetchImpl) {
            response = await this.deps.fetchImpl(url.toString(), init);
          } else {
            const target = await vetWebTarget(url);
            if (!target) throw new LookupFailure('unreachable');
            response = await pinnedRequest(target, init);
          }
        } catch (error) {
          throw failureOf(error);
        }
        if (response.status >= 300 && response.status < 400) {
          await response.body?.cancel().catch(() => undefined);
          const location = response.headers.get('location');
          let next: URL | null = null;
          try {
            next = location && hop < MAX_REDIRECTS ? this.allowed(new URL(location, url).toString()) : null;
          } catch {
            next = null;
          }
          if (!next) throw new LookupFailure('bad-answer');
          url = next;
          continue;
        }
        if (response.status === 404) {
          await response.body?.cancel().catch(() => undefined);
          return { status: 404, type: '', bytes: Buffer.alloc(0) };
        }
        if (response.status === 429) throw new LookupFailure('rate-limited');
        if (!response.ok) throw new LookupFailure('server');
        let bytes: Buffer;
        try {
          bytes = await readBounded(response, maxBytes);
        } catch (error) {
          throw failureOf(error);
        }
        return { status: response.status, type: (response.headers.get('content-type') ?? '').toLowerCase(), bytes };
      }
    } finally {
      clearTimeout(timer);
    }
  }

  private async json(url: string, pauseMs: number): Promise<unknown | null> {
    const answer = await this.get(url, LOOKUP_JSON_MAX_BYTES, 'application/json', pauseMs);
    if (answer.status === 404) return null;
    try {
      return JSON.parse(answer.bytes.toString('utf8')) as unknown;
    } catch {
      throw new LookupFailure('bad-answer');
    }
  }

  /** Civitai's record of the version whose file has this fingerprint; null when Civitai does not know it. */
  async civitaiByHash(sha256: string, pauseMs: number): Promise<WebFound | null> {
    if (!/^[0-9a-f]{64}$/.test(sha256)) return null;
    const value = await this.json(`${this.endpoints.civitai}/api/v1/model-versions/by-hash/${sha256}`, pauseMs);
    if (value === null) return null;
    const found = civitaiFound(value);
    if (found) return found;
    // Civitai answers some unknown files with an error object instead of a 404.
    if (value && typeof value === 'object' && 'error' in value) return null;
    throw new LookupFailure('bad-answer');
  }

  /**
   * The Hugging Face repository named most like the file, with its record and the start of its README. A guess:
   * the name matched, not the file. Null when no repository is named like it.
   */
  async huggingFaceByName(filename: string, pauseMs: number): Promise<WebFound | null> {
    let id: string | null = null;
    for (const query of nameQueries(filename)) {
      const list = await this.json(`${this.endpoints.huggingface}/api/models?search=${encodeURIComponent(query)}&limit=5`, pauseMs);
      if (list !== null && !Array.isArray(list)) throw new LookupFailure('bad-answer');
      id = bestHuggingFaceMatch(list, filename);
      if (id) break;
    }
    if (!id) return null;
    const path = id.split('/').map(encodeURIComponent).join('/');
    const detail = await this.json(`${this.endpoints.huggingface}/api/models/${path}`, pauseMs);
    if (detail === null) return null;
    const readme = await this.get(`${this.endpoints.huggingface}/${path}/raw/main/README.md`, README_MAX_BYTES, 'text/plain, text/markdown', pauseMs);
    return huggingFaceFound(id, detail, readme.status === 404 ? '' : readme.bytes.toString('utf8'));
  }

  /**
   * Civitai by fingerprint first (that is this very file); when Civitai does not know it, or there is no
   * fingerprint, Hugging Face by name (a guess, marked as one). Never throws.
   */
  async lookup(file: { sha256: string | null; filename: string }, pauseMs: number): Promise<LookupOutcome> {
    try {
      const exact = file.sha256 ? await this.civitaiByHash(file.sha256, pauseMs) : null;
      if (exact) return { status: 'found', found: exact };
      const guess = await this.huggingFaceByName(file.filename, pauseMs);
      return guess ? { status: 'found', found: guess } : { status: 'not-found' };
    } catch (error) {
      return { status: 'error', error: failureOf(error).code };
    }
  }

  /** A sample picture or clip a found record points to: its bytes and kind, or null. Never throws. */
  async previewBytes(url: string): Promise<{ bytes: Buffer; mime: string; kind: 'image' | 'video' } | null> {
    try {
      const answer = await this.get(url, PREVIEW_MAX_BYTES, 'image/*, video/mp4, video/webm', CARD_LOOKUP_PAUSE_MS);
      if (answer.status === 404 || answer.bytes.length === 0) return null;
      const mime = answer.type.split(';')[0].trim();
      if (/^image\/(png|jpeg|webp|gif|avif)$/.test(mime)) return { bytes: answer.bytes, mime, kind: 'image' };
      if (/^video\/(mp4|webm)$/.test(mime)) return { bytes: answer.bytes, mime, kind: 'video' };
      return null;
    } catch {
      return null;
    }
  }
}

let shared: ModelWebClient | null = null;

/** The app-wide client: one queue, so the pause between requests holds across cards and sync. */
export function appWebClient(): ModelWebClient {
  shared ??= new ModelWebClient();
  return shared;
}

/** Main replaces it once at start (a test build may point it at a fake); tests reset it with null. */
export function setAppWebClient(client: ModelWebClient | null): void {
  shared = client;
}
