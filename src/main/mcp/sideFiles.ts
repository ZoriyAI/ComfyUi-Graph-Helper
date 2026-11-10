import type { McpSession } from '../../shared/mcp/catalogSource';
import { toolPayload } from '../../shared/mcp/catalogSource';
import { isSideFilePath, McpRefusedError, SIDE_FILE_CHUNK_BYTES, SIDE_FILE_MAX_BYTES } from './readOnly';

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
 * (no root, a Windows root, a name that climbs out of the folder).
 */
export function sideFilePath(rootPath: string | null | undefined, filename: string | null | undefined): string | null {
  if (!rootPath || !filename || !rootPath.startsWith('/')) return null;
  const path = `${rootPath.replace(/\/+$/, '')}/${filename.replace(/^\/+/, '')}`;
  return isSideFilePath(path) ? path : null;
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
  const limit = Math.min(maxBytes, SIDE_FILE_MAX_BYTES);
  const chunks: Buffer[] = [];
  let offset = 0;
  // A file of the largest size allowed is this many chunks; two more turns are room for a short last read.
  for (let turn = 0; turn < Math.ceil(limit / SIDE_FILE_CHUNK_BYTES) + 2; turn += 1) {
    const row = record(toolPayload(await session.callTool('workspace_files', {
      action: 'read', absolute_path: path, encoding: 'base64', offset, length: SIDE_FILE_CHUNK_BYTES,
    })));
    if (!row || typeof row.data_base64 !== 'string') return null;
    const total = typeof row.size_bytes === 'number' ? row.size_bytes : typeof row.total === 'number' ? row.total : null;
    if (total !== null && total > limit) return null;
    const chunk = Buffer.from(row.data_base64, 'base64');
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
