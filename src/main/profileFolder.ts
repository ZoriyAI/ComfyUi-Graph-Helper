import * as fs from 'fs';

/**
 * The profile folder (database, chat history, logs, previews) is made readable by this user only. Electron creates
 * it with the default umask, which on some systems lets every local account read it. Best effort: a file system
 * without modes, or a folder that is not ours, is left as it is. Returns the mode it ended with, or null.
 */
export function secureProfileFolder(dir: string, fsImpl: Pick<typeof fs, 'mkdirSync' | 'chmodSync' | 'statSync'> = fs): number | null {
  try {
    fsImpl.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fsImpl.chmodSync(dir, 0o700);
    return fsImpl.statSync(dir).mode & 0o777;
  } catch {
    return null;
  }
}
