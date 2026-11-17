/** Seek through container headers, never through encoded frames. Works with File.slice and positional file reads. */
export interface MetadataSource { size: number; read(offset: number, length: number): Promise<Uint8Array> }
export const VIDEO_METADATA_MAX = 8 * 1024 * 1024;
export const VIDEO_METADATA_INVALID = 'The video metadata is damaged or unsupported.';
export const VIDEO_METADATA_LIMIT = 'The video metadata exceeds the reading budget.';
export const VIDEO_METADATA_CANCELLED = 'File reading was cancelled.';
export const VIDEO_EXTENSIONS = /\.(mp4|mov|mkv|webm)$/i;
const IO_MAX = 16 * 1024 * 1024;
const ELEMENTS_MAX = 20000;
const TIME_MS = 10000;
const CHUNK = 256 * 1024;
const text = new TextEncoder();
const decoder = new TextDecoder();
export class VideoMetadataError extends Error {}
const invalid = (): never => { throw new VideoMetadataError(VIDEO_METADATA_INVALID); };
const limited = (): never => { throw new VideoMetadataError(VIDEO_METADATA_LIMIT); };

class Reader {
  private io = 0;
  private elements = 0;
  private total = 0;
  private readonly deadline = Date.now() + TIME_MS;
  private readonly parts: Uint8Array[] = [];
  constructor(readonly source: MetadataSource, readonly signal?: AbortSignal) {
    if (!Number.isSafeInteger(source.size) || source.size < 0) invalid();
  }
  check(): void {
    if (this.signal?.aborted) throw new VideoMetadataError(VIDEO_METADATA_CANCELLED);
    if (Date.now() > this.deadline) limited();
  }
  element(): void { this.check(); if (++this.elements > ELEMENTS_MAX) limited(); }
  async read(at: number, length: number): Promise<Uint8Array> {
    this.check();
    if (!Number.isSafeInteger(at) || !Number.isSafeInteger(length) || at < 0 || length < 0 || at + length > this.source.size) invalid();
    this.io += length; if (this.io > IO_MAX) limited();
    if (length === 0) return new Uint8Array();
    // A stalled filesystem or Blob read must still honour Cancel and the deadline.
    const data = await new Promise<Uint8Array>((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); this.signal?.removeEventListener('abort', abort); };
      const abort = () => { cleanup(); reject(new VideoMetadataError(VIDEO_METADATA_CANCELLED)); };
      const timer = setTimeout(() => { cleanup(); reject(new VideoMetadataError(VIDEO_METADATA_LIMIT)); }, Math.max(1, this.deadline - Date.now()));
      this.signal?.addEventListener('abort', abort, { once: true });
      Promise.resolve().then(() => this.source.read(at, length)).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    });
    this.check(); if (data.length !== length) invalid(); return data;
  }
  async collect(at: number, length: number, prefix = ''): Promise<void> {
    const label = text.encode(prefix);
    if (this.total + label.length + length + 1 > VIDEO_METADATA_MAX) limited();
    this.total += label.length + length + 1; this.parts.push(label);
    for (let offset = 0; offset < length; offset += CHUNK) this.parts.push(await this.read(at + offset, Math.min(CHUNK, length - offset)));
    this.parts.push(new Uint8Array([0]));
  }
  finish(): Uint8Array {
    this.check(); const output = new Uint8Array(this.total); let at = 0;
    for (const part of this.parts) { output.set(part, at); at += part.length; } return output;
  }
}

const uint = (bytes: Uint8Array): number => {
  let value = 0;
  for (const byte of bytes) { value = value * 256 + byte; if (!Number.isSafeInteger(value)) invalid(); }
  return value;
};
const ascii = (bytes: Uint8Array): string => String.fromCharCode(...bytes);

/** ISO BMFF: skip mdat/trak; follow moov/udta/meta to text-bearing atoms. Never inflate compressed moov. */
async function mp4(reader: Reader, start: number, end: number, depth = 0, metadata = false): Promise<void> {
  if (depth > 12) limited();
  let keys: string[] = [];
  for (let at = start; at < end;) {
    reader.element(); if (end - at < 8) invalid();
    const header = await reader.read(at, 8); const kind = ascii(header.subarray(4));
    let length = uint(header.subarray(0, 4)); let head = 8;
    if (length === 1) { if (end - at < 16) invalid(); length = uint(await reader.read(at + 8, 8)); head = 16; }
    else if (length === 0) length = end - at;
    if (length < head || length > end - at) invalid();
    const body = at + head; const stop = at + length;
    if (kind === 'moov' || kind === 'udta' || kind === 'meta') {
      const fullBox = kind === 'meta' ? 4 : 0;
      if (body + fullBox > stop) invalid();
      await mp4(reader, body + fullBox, stop, depth + 1, metadata || kind === 'udta' || kind === 'meta');
    } else if (metadata && kind === 'keys') {
      if (stop - body > VIDEO_METADATA_MAX || stop - body < 8) limited();
      const data = await reader.read(body, stop - body); const count = uint(data.subarray(4, 8));
      if (count > 4096) limited(); keys = [];
      let offset = 8;
      for (let index = 0; index < count; index++) {
        if (offset + 8 > data.length) invalid(); const size = uint(data.subarray(offset, offset + 4));
        if (size < 8 || size > data.length - offset) invalid();
        keys.push(decoder.decode(data.subarray(offset + 8, offset + size)).toLowerCase()); offset += size;
      }
    } else if (kind === 'ilst') {
      for (let entry = body; entry < stop;) {
        reader.element(); if (stop - entry < 8) invalid();
        const data = await reader.read(entry, 8); const size = uint(data.subarray(0, 4));
        if (size < 8 || size > stop - entry) invalid();
        const key = keys[uint(data.subarray(4, 8)) - 1];
        if (key === 'workflow' || key === 'prompt') await reader.collect(entry + 8, size - 8, `${key}\0`);
        else if (['©cmt', '©des', 'desc', 'ldes', '----'].includes(ascii(data.subarray(4, 8))) || key === 'comment' || key === 'description') await reader.collect(entry + 8, size - 8);
        entry += size;
      }
    } else if (metadata && ['©cmt', '©des', 'desc', 'ldes', 'XMP_', 'uuid'].includes(kind)) {
      await reader.collect(body, stop - body);
    } else if (kind === 'cmov') invalid();
    at = stop;
  }
}

interface Element { id: number; body: number; end: number; unknown: boolean }
const SEGMENT = 0x18538067; const CLUSTER = 0x1f43b675; const SEEK_HEAD = 0x114d9b74; const TAGS = 0x1254c367;
const TOP_LEVEL = new Set([SEEK_HEAD, TAGS, CLUSTER, 0x1549a966, 0x1654ae6b, 0x1c53bb6b, 0x1941a469, 0x1043a770]);

async function element(reader: Reader, at: number, end: number): Promise<Element> {
  reader.element();
  const prefix = await reader.read(at, Math.min(12, end - at));
  const vint = (offset: number, id: boolean) => {
    const first = prefix[offset]; if (!first) invalid();
    let length = 1; let mask = 128;
    while (!(first & mask)) { length++; mask >>= 1; }
    if (length > (id ? 4 : 8) || offset + length > prefix.length) invalid();
    const bytes = prefix.slice(offset, offset + length);
    const unknown = !id && (first & (mask - 1)) === mask - 1 && bytes.subarray(1).every(byte => byte === 255);
    if (!id) bytes[0] &= mask - 1;
    return { length, value: unknown ? 0 : uint(bytes), unknown };
  };
  const id = vint(0, true); const size = vint(id.length, false); const body = at + id.length + size.length;
  if (body > end || (!size.unknown && size.value > end - body)) invalid();
  return { id: id.value, body, end: size.unknown ? end : body + size.value, unknown: size.unknown };
}

async function tags(reader: Reader, start: number, end: number, depth = 0): Promise<void> {
  if (depth > 12) limited();
  let name = ''; const values: Element[] = [];
  for (let at = start; at < end;) {
    const item = await element(reader, at, end); if (item.unknown) invalid();
    if (item.id === 0x7373 || item.id === 0x67c8) await tags(reader, item.body, item.end, depth + 1);
    else if (item.id === 0x45a3) { if (item.end - item.body > 1024) limited(); name = decoder.decode(await reader.read(item.body, item.end - item.body)).toLowerCase(); }
    else if (item.id === 0x4487) values.push(item);
    at = item.end;
  }
  for (const value of values) {
    if (['workflow', 'prompt', 'comment', 'description'].includes(name)) await reader.collect(value.body, value.end - value.body, name === 'workflow' || name === 'prompt' ? `${name}\0` : '');
  }
}

/** EBML seek positions are relative to the Segment payload; bound and visit each referenced header once. */
async function matroska(reader: Reader): Promise<void> {
  let segment: Element | undefined;
  for (let at = 0; at < reader.source.size;) {
    const item = await element(reader, at, reader.source.size);
    if (item.id === SEGMENT) { segment = item; break; }
    if (item.unknown) invalid(); at = item.end;
  }
  const segmentData = segment ?? invalid();
  const seen = new Set<number>();
  const visit = async (at: number, depth = 0): Promise<Element> => {
    if (depth > 12) limited();
    if (at < segmentData.body || at >= segmentData.end) invalid();
    const item = await element(reader, at, segmentData.end);
    if (seen.has(at)) return item; seen.add(at);
    if (item.id === TAGS) { if (item.unknown) invalid(); await tags(reader, item.body, item.end); }
    else if (item.id === SEEK_HEAD) {
      if (item.unknown) invalid();
      for (let p = item.body; p < item.end;) {
        const seek = await element(reader, p, item.end); if (seek.unknown) invalid();
        if (seek.id === 0x4dbb) {
          let target = 0; let position: number | undefined;
          for (let q = seek.body; q < seek.end;) {
            const field = await element(reader, q, seek.end); if (field.unknown) invalid();
            if (field.id === 0x53ab || field.id === 0x53ac) {
              if (field.end - field.body > 8) invalid();
              const value = uint(await reader.read(field.body, field.end - field.body));
              if (field.id === 0x53ab) target = value; else position = value;
            }
            q = field.end;
          }
          if ((target === TAGS || target === SEEK_HEAD) && position != null) {
            const dest = segmentData.body + position; if (!Number.isSafeInteger(dest)) invalid();
            const found = await visit(dest, depth + 1); if (found.id !== target) invalid();
          }
        }
        p = seek.end;
      }
    }
    return item;
  };
  for (let at = segmentData.body; at < segmentData.end;) {
    const item = await visit(at);
    if (!item.unknown) at = item.end;
    else {
      if (item.id !== CLUSTER) invalid();
      // Unknown-size live Clusters end at the next top-level element. Skip each encoded block by length.
      at = item.body;
      while (at < segmentData.end) {
        const child = await element(reader, at, segmentData.end);
        if (TOP_LEVEL.has(child.id)) break;
        if (child.unknown) invalid(); at = child.end;
      }
    }
  }
}

/** Null means this is not a recognized video container. A valid container may have no workflow metadata. */
export async function readVideoMetadata(source: MetadataSource, signal?: AbortSignal): Promise<Uint8Array | null> {
  const reader = new Reader(source, signal);
  const header = await reader.read(0, Math.min(12, source.size));
  if (header.length >= 4 && uint(header.subarray(0, 4)) === 0x1a45dfa3) await matroska(reader);
  else if (header.length >= 8 && ['ftyp', 'moov', 'mdat', 'free', 'wide', 'skip'].includes(ascii(header.subarray(4, 8)))) await mp4(reader, 0, source.size);
  else return null;
  return reader.finish();
}
