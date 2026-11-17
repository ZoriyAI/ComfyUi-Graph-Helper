/**
 * Reads a file a person wants to open and says what it holds: a project of this app, a workflow, or nothing.
 *
 * Who uses it: every way of opening a file (File ▸ Open workflow, a file dropped on the window, a file named on the
 * command line, File ▸ Recent) through `openFileAtPath` in main/ipc/openIpc.ts, so they all end in one code path.
 * Why: ComfyUI writes its workflow into the pictures and videos it saves (PNG text chunks, WebP EXIF, the metadata of
 * MP4, WebM and MKV files written by video nodes), and people share workflows that way more than as .json. A text
 * file may start with a byte order mark (Windows Notepad writes one). A workflow is DATA: nothing in a file is run,
 * and only the JSON text found in it is read.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { FileTooLargeError, OPEN_FILE_MAX_BYTES } from './atomicWrite';
import { isNativeProjectFormat } from '../../shared/native-project';
import { readVideoMetadata, VIDEO_EXTENSIONS, VIDEO_METADATA_CANCELLED } from '../../shared/workflow/videoMetadata';

/** What a file holds, as far as opening it is concerned. */
export type OpenedFile =
  | { kind: 'project'; document: unknown }
  | { kind: 'workflow'; document: unknown; from: 'json' | 'picture' | 'video' };

/** Error texts the window translates (shared/i18n ERROR_KEYS); the file's own words never reach the screen. */
export const NO_WORKFLOW_IN_FILE = 'This file holds no workflow.';
export const NOT_A_WORKFLOW_FILE = 'Workflow JSON could not be parsed.';
/** A bounded PNG reader stopped before allocating more workflow text. */
export const PNG_TEXT_TOO_LARGE = 'The workflow text in this picture is too large.';

const PNG_TEXT_MAX = 16 * 1024 * 1024;
const PNG_INFLATED_TOTAL_MAX = 32 * 1024 * 1024;
const PNG_TEXT_CHUNKS_MAX = 256;

/** Distinguished from damaged chunks, which may be skipped to read another workflow chunk. */
class PngTextLimitError extends Error {
  constructor() {
    super(PNG_TEXT_TOO_LARGE);
  }
}

/** Extensions the open dialog offers and a drop or a command line accepts. */
export const OPENABLE_EXTENSIONS = ['json', 'png', 'webp', 'jpg', 'jpeg', 'mp4', 'webm', 'mkv', 'mov', 'gif', 'flac', 'mp3', 'opus', 'ogg'] as const;
/** Extensions reported as `from: 'picture'`; every other non-JSON file counts as a video (or audio) file. */
const PICTURES = new Set(['png', 'webp', 'jpg', 'jpeg', 'gif']);

/** Whether a path names a kind of file this app opens (by its extension). */
export function isOpenablePath(filePath: string): boolean {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  return (OPENABLE_EXTENSIONS as readonly string[]).includes(extension);
}

/** The text without a leading byte order mark. */
export function withoutBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** True when the parsed JSON is a project file of this app (also one saved by 0.x) rather than a workflow. */
export function isProjectDocument(document: unknown): boolean {
  return !!document && typeof document === 'object' && isNativeProjectFormat((document as { format?: unknown }).format);
}

/** Workflow and prompt text of a PNG; compressed values and the number of text chunks are bounded. */
export function pngTexts(bytes: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  let textChunks = 0;
  let inflated = 0;
  const inflate = (data: Buffer): Buffer => {
    const maxOutputLength = Math.min(PNG_TEXT_MAX, PNG_INFLATED_TOTAL_MAX - inflated);
    if (maxOutputLength <= 0) throw new PngTextLimitError();
    try {
      const text = zlib.inflateSync(data, { maxOutputLength });
      inflated += text.length;
      return text;
    } catch (error) {
      // A damaged stream may have expanded before its checksum failed; charge its full possible output.
      inflated += maxOutputLength;
      if ((error as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') throw new PngTextLimitError();
      throw error;
    }
  };
  // 0x89 'PNG' starts every PNG; chunks follow the 8-byte signature as length, type, data, CRC (4 + 4 + n + 4).
  if (bytes.length < 8 || bytes.readUInt32BE(0) !== 0x89504e47) return out;
  let at = 8;
  while (at + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString('latin1', at + 4, at + 8);
    const start = at + 8;
    const end = start + length;
    if (end + 4 > bytes.length) break;
    if (type === 'IEND') break;
    if (type !== 'tEXt' && type !== 'zTXt' && type !== 'iTXt') {
      at = end + 4;
      continue;
    }
    textChunks += 1;
    if (textChunks > PNG_TEXT_CHUNKS_MAX) throw new PngTextLimitError();
    const data = bytes.subarray(start, end);
    try {
      const zero = data.indexOf(0);
      if (zero > 0) {
        const keyword = data.toString('latin1', 0, zero);
        if (keyword !== 'workflow' && keyword !== 'prompt') {
          at = end + 4;
          continue;
        }
        // Literal text is already bounded by the input file size; only inflation needs the smaller budget.
        if (type === 'tEXt') out[keyword] = data.toString('latin1', zero + 1);
        // zTXt: keyword, NUL, one compression-method byte, then the deflated text.
        if (type === 'zTXt' && data[zero + 1] === 0) out[keyword] = inflate(data.subarray(zero + 2)).toString('latin1');
        // iTXt: keyword, NUL, compression flag, method, language tag, NUL, translated keyword, NUL, text.
        if (type === 'iTXt' && (data[zero + 1] === 0 || data[zero + 1] === 1) && data[zero + 2] === 0) {
          const compressed = data[zero + 1] === 1;
          const language = data.indexOf(0, zero + 3);
          const translated = language >= 0 ? data.indexOf(0, language + 1) : -1;
          if (translated >= 0) {
            const text = data.subarray(translated + 1);
            out[keyword] = (compressed ? inflate(text) : text).toString('utf8');
          }
        }
      }
    } catch (error) {
      if (error instanceof PngTextLimitError) throw error;
      // A damaged chunk: the others may still hold the workflow.
    }
    at = end + 4;
  }
  return out;
}

/**
 * The JSON object that starts at `from` (a '{'), read up to its matching '}' with strings and escapes respected;
 * null when it does not close or does not parse.
 */
function objectAt(bytes: Buffer, from: number): unknown {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = from; index < bytes.length; index += 1) {
    const byte = bytes[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (byte === 0x5c) escaped = true;
      else if (byte === 0x22) inString = false;
      continue;
    }
    if (byte === 0x22) inString = true;
    else if (byte === 0x7b) depth += 1;
    else if (byte === 0x7d) {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(bytes.toString('utf8', from, index + 1));
        } catch {
          return null;
        }
      }
    } else if (byte < 0x09) {
      // A raw control byte cannot be inside JSON text: this was not the start of an object.
      return null;
    }
  }
  return null;
}

/** True when a value looks like a canvas workflow (nodes and links). */
function isCanvasWorkflow(value: unknown): boolean {
  return !!value && typeof value === 'object' && Array.isArray((value as { nodes?: unknown }).nodes);
}

/**
 * The workflow a binary file carries after a label ("workflow", then "prompt"): the first JSON object found a few
 * bytes after the label that is one. Video and WebP files keep it in metadata next to such a label; a video node may
 * also write one object holding both ({"prompt": …, "workflow": …}).
 */
export function embeddedWorkflow(bytes: Buffer): unknown {
  for (const label of ['workflow', 'prompt']) {
    const needle = Buffer.from(label, 'latin1');
    let at = bytes.indexOf(needle);
    while (at >= 0) {
      // Container headers (atom sizes, tag ids, "workflow:" in EXIF) sit between the label and the JSON.
      const window = Math.min(bytes.length, at + needle.length + 48);
      for (let index = at + needle.length; index < window; index += 1) {
        if (bytes[index] !== 0x7b) continue;
        const found = objectAt(bytes, index);
        if (found && typeof found === 'object') {
          const record = found as Record<string, unknown>;
          if (label === 'workflow' && isCanvasWorkflow(record)) return record;
          if (label === 'workflow' && isCanvasWorkflow(record.workflow)) return record.workflow;
          if (label === 'prompt' && !Array.isArray(record)) return record;
        }
        break;
      }
      at = bytes.indexOf(needle, at + needle.length);
    }
  }
  return null;
}

/**
 * Reads and recognises a file. Throws an Error whose message is a code the window translates: too large, unreadable,
 * no workflow in it, not JSON.
 */
export async function readOpenedFile(filePath: string, signal?: AbortSignal): Promise<OpenedFile> {
  const file = await fs.promises.open(filePath, 'r');
  try {
    const before = await file.stat(); const size = before.size;
    if (signal?.aborted) throw new Error(VIDEO_METADATA_CANCELLED);
    if (VIDEO_EXTENSIONS.test(filePath)) {
      const metadata = await readVideoMetadata({ size, read: async (at, length) => {
        const bytes = Buffer.alloc(length); let filled = 0;
        while (filled < length) {
          if (signal?.aborted) throw new Error(VIDEO_METADATA_CANCELLED);
          const read = await file.read(bytes, filled, length - filled, at + filled);
          if (!read.bytesRead) break; filled += read.bytesRead;
        }
        return bytes.subarray(0, filled);
      } }, signal);
      if (metadata !== null) {
        const after = await file.stat();
        if (after.size !== size || after.mtimeMs !== before.mtimeMs) throw new Error(NOT_A_WORKFLOW_FILE);
        const document = embeddedWorkflow(Buffer.from(metadata));
        if (document) return { kind: 'workflow', document, from: 'video' };
        throw new Error(NO_WORKFLOW_IN_FILE);
      }
    }
    if (size > OPEN_FILE_MAX_BYTES) throw new FileTooLargeError();
    const bytes = Buffer.alloc(size);
    for (let at = 0; at < size;) {
      if (signal?.aborted) throw new Error(VIDEO_METADATA_CANCELLED);
      const read = await file.read(bytes, at, Math.min(256 * 1024, size - at), at);
      if (!read.bytesRead) throw new Error(NOT_A_WORKFLOW_FILE); at += read.bytesRead;
    }
    const after = await file.stat();
    if (after.size !== size || after.mtimeMs !== before.mtimeMs) throw new Error(NOT_A_WORKFLOW_FILE);
    if (signal?.aborted) throw new Error(VIDEO_METADATA_CANCELLED);
    return readOpenedBytes(path.basename(filePath), bytes);
  } finally { await file.close(); }
}

/** Recognises an uploaded file with exactly the same bounded metadata parser as desktop files. */
export function readOpenedBytes(name: string, bytes: Buffer): OpenedFile {
  if (bytes.length > OPEN_FILE_MAX_BYTES) throw new FileTooLargeError();
  const extension = path.extname(name).slice(1).toLowerCase();
  // A JSON file saved with another extension is still read as JSON when its text starts with '{'.
  const head = withoutBom(bytes.subarray(0, 64).toString('utf8')).trimStart();
  if (extension === 'json' || head.startsWith('{')) {
    let document: unknown;
    try {
      document = JSON.parse(withoutBom(bytes.toString('utf8')));
    } catch {
      throw new Error(NOT_A_WORKFLOW_FILE);
    }
    return isProjectDocument(document) ? { kind: 'project', document } : { kind: 'workflow', document, from: 'json' };
  }
  const from = PICTURES.has(extension) ? 'picture' : 'video';
  const texts = pngTexts(bytes);
  for (const key of ['workflow', 'prompt']) {
    if (!texts[key]) continue;
    try {
      return { kind: 'workflow', document: JSON.parse(texts[key]), from };
    } catch {
      // Not JSON in this chunk; try the next way.
    }
  }
  const found = embeddedWorkflow(bytes);
  if (found) return { kind: 'workflow', document: found, from };
  throw new Error(NO_WORKFLOW_IN_FILE);
}
