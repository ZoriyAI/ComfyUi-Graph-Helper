import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

/**
 * Writes a file so that it is either the old file or the whole new one, never half of each: the bytes go to a
 * temporary file in the same folder, are flushed to the disk, and the temporary file then replaces the target
 * in one step (rename). A failure (disk full, read-only folder) leaves the old file as it was and removes the
 * temporary one. A target that is a link is written through: the file it points to is replaced. `mode` sets the
 * permissions of the written file (by default those of the file it replaces, or 0644 for a new one).
 */
export function writeFileAtomic(target: string, data: string | Buffer, options: { mode?: number } = {}): void {
  let destination = target;
  let mode = options.mode ?? 0o644;
  try {
    destination = fs.realpathSync(target);
    // An existing file keeps its permissions unless the caller names them (owner-only key files).
    if (options.mode === undefined) mode = fs.statSync(destination).mode & 0o777;
  } catch {
    // A new file: written where it was asked for.
  }
  const folder = path.dirname(destination);
  const temporary = path.join(folder, `.${path.basename(destination)}.${randomBytes(6).toString('hex')}.tmp`);
  const bytes = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  let handle: number | null = null;
  try {
    handle = fs.openSync(temporary, 'wx', mode);
    let written = 0;
    while (written < bytes.length) written += fs.writeSync(handle, bytes, written, bytes.length - written);
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = null;
    fs.renameSync(temporary, destination);
  } catch (error) {
    if (handle !== null) {
      try {
        fs.closeSync(handle);
      } catch {
        // Already closed.
      }
    }
    fs.rmSync(temporary, { force: true });
    throw error;
  }
  // The rename itself reaches the disk with the folder's entry; not every file system allows this, so best effort.
  try {
    const directory = fs.openSync(folder, 'r');
    try {
      fs.fsyncSync(directory);
    } finally {
      fs.closeSync(directory);
    }
  } catch {
    // The file is written; only the timing of the folder entry is left to the system.
  }
}

/** True when the folder can be written to but the file in it cannot (read-only, or made immutable). */
function fileIsProtected(target: string): boolean {
  try {
    fs.accessSync(path.dirname(target), fs.constants.W_OK);
  } catch {
    return false;
  }
  try {
    fs.accessSync(target, fs.constants.W_OK);
    return false;
  } catch (error) {
    return (error as { code?: string }).code !== 'ENOENT';
  }
}

/** Codes the window translates (shared/i18n ERROR_KEYS) for a file that could not be written. */
export function fileWriteErrorCode(error: unknown, fallback: string, target?: string): string {
  const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : '';
  if (code === 'ENOSPC' || code === 'EDQUOT' || code === 'EFBIG') return 'The disk is full.';
  // A folder that takes files but a file in it that is protected: say which of the two is in the way.
  if ((code === 'EACCES' || code === 'EPERM') && target && fileIsProtected(target)) return 'This file is protected from writing.';
  if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') return 'The folder cannot be written to.';
  return fallback;
}

/** A file bigger than this is not opened as a workflow or a project: real ones are well under a megabyte. */
export const OPEN_FILE_MAX_BYTES = 64 * 1024 * 1024;

class FileTooLargeError extends Error {
  constructor() {
    super('The file is too large to open.');
  }
}

/** Reads a text file the person picked; a file over OPEN_FILE_MAX_BYTES is refused before it is read. */
export function readPickedFile(file: string): string {
  if (fs.statSync(file).size > OPEN_FILE_MAX_BYTES) throw new FileTooLargeError();
  return fs.readFileSync(file, 'utf-8');
}

/** The code for a picked file that could not be opened: too large, or `fallback` (could not be read or parsed). */
export function fileOpenErrorCode(error: unknown, fallback: string): string {
  return error instanceof FileTooLargeError ? error.message : fallback;
}
