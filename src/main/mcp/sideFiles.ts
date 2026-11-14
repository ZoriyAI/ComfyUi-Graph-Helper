import type { McpSession } from '../../shared/mcp/catalogSource';
import { toolPayload } from '../../shared/mcp/catalogSource';
import { joinServerPath, pathStyle } from '../../shared/mcp/serverPaths';
import { isPackFilePath, isSideFilePath, McpRefusedError, SIDE_FILE_CHUNK_BYTES, SIDE_FILE_MAX_BYTES } from './readOnly';

/**
 * Reading the files a model manager keeps next to a model: the description (`<name>.metadata.json`,
 * `<name>.civitai.info`) and the preview picture or clip. Bytes are asked for through the read-only gate, in
 * chunks, and never more than a bound; nothing is written anywhere on the server.
 */

/** A description is text of some tens of kilobytes; more than this is not one. */
export const SIDECAR_MAX_BYTES = 2 * 1024 * 1024;
export const PREVIEW_MAX_BYTES = SIDE_FILE_MAX_BYTES;

/**
 * The absolute path of a file in a model folder, or null when the parts do not make a path the gate would pass
 * (no root, a name that climbs out of the folder). A root on Windows (`C:\\…`) is joined with its own separator.
 */
export function sideFilePath(rootPath: string | null | undefined, filename: string | null | undefined): string | null {
  if (!rootPath || !filename) return null;
  const path = joinServerPath(rootPath, filename);
  return path && isSideFilePath(path) ? path : null;
}

/** Base64 text of one chunk is at most this long; a longer answer is not the chunk that was asked for. */
export const SIDE_FILE_CHUNK_BASE64_MAX = Math.ceil(SIDE_FILE_CHUNK_BYTES / 3) * 4 + 4;

/** The chunk's base64 text when it is a string of a sane length; null otherwise (nothing is decoded then). */
function chunkText(row: Record<string, unknown> | null): string | null {
  const data = row?.data_base64;
  return typeof data === 'string' && data.length <= SIDE_FILE_CHUNK_BASE64_MAX ? data : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * The whole file, or null when it is missing, refused by the server, larger than `maxBytes`, or the answer is
 * not what `workspace_files` gives. A refusal by the app's own gate and a transport error are thrown: the first
 * is a programming error, the second ends the run it happens in.
 */
export async function readSideFile(session: McpSession, path: string, maxBytes: number): Promise<Buffer | null> {
  if (!isSideFilePath(path)) throw new McpRefusedError('workspace_files');
  return readWhole(session, path, maxBytes);
}

/** A pack's pyproject.toml is a page or two of settings; one larger than this is not read. */
export const PYPROJECT_MAX_BYTES = 64 * 1024;
/** Only the opening of a README is shown, so only its first bytes are asked for, whatever its length. */
export const README_HEAD_BYTES = 64 * 1024;

/**
 * The absolute path of a file at the top of a node pack's folder, or null when the parts do not make a path the
 * gate would pass (no root, a pack name that is not one folder, a root that is not a `custom_nodes` folder).
 */
export function packFilePath(root: string | null | undefined, pack: string | null | undefined, file: string): string | null {
  if (!root || !pack || !pathStyle(root) || /[\\/]/.test(pack)) return null;
  const path = joinServerPath(root, pack, file);
  return path && isPackFilePath(path) ? path : null;
}

/**
 * A file at the top of a node pack: the whole of it up to `maxBytes` (null when larger), or with `head` only its
 * first `maxBytes`, in one call. Null when it is missing or the answer is not what `workspace_files` gives; a
 * refusal by the gate and a transport error are thrown, as for the files next to a model.
 */
export async function readPackFile(session: McpSession, path: string, maxBytes: number, head = false): Promise<Buffer | null> {
  if (!isPackFilePath(path)) throw new McpRefusedError('workspace_files');
  if (!head) return readWhole(session, path, maxBytes);
  const row = record(toolPayload(await session.callTool('workspace_files', {
    action: 'read', absolute_path: path, encoding: 'base64', offset: 0, length: Math.min(maxBytes, SIDE_FILE_CHUNK_BYTES),
  })));
  const data = chunkText(row);
  if (data === null) return null;
  const chunk = Buffer.from(data, 'base64');
  return chunk.subarray(0, maxBytes);
}

async function readWhole(session: McpSession, path: string, maxBytes: number): Promise<Buffer | null> {
  const limit = Math.min(maxBytes, SIDE_FILE_MAX_BYTES);
  const chunks: Buffer[] = [];
  let offset = 0;
  // A file of the largest size allowed is this many chunks; two more turns are room for a short last read.
  for (let turn = 0; turn < Math.ceil(limit / SIDE_FILE_CHUNK_BYTES) + 2; turn += 1) {
    const row = record(toolPayload(await session.callTool('workspace_files', {
      action: 'read', absolute_path: path, encoding: 'base64', offset, length: SIDE_FILE_CHUNK_BYTES,
    })));
    const data = chunkText(row);
    if (!row || data === null) return null;
    const total = typeof row.size_bytes === 'number' ? row.size_bytes : typeof row.total === 'number' ? row.total : null;
    if (total !== null && total > limit) return null;
    const chunk = Buffer.from(data, 'base64');
    offset += chunk.length;
    if (offset > limit) return null;
    chunks.push(chunk);
    const complete = row.complete === true || (total !== null && offset >= total);
    if (complete) return Buffer.concat(chunks);
    // A read that brings nothing and is not the end would never end.
    if (chunk.length === 0) return null;
    if (typeof row.next_offset === 'number' && row.next_offset !== offset) return null;
  }
  return null;
}
