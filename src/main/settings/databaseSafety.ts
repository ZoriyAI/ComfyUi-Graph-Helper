import * as fs from 'fs';
import * as path from 'path';
import type Database from 'better-sqlite3';
import type { Translator } from '../../shared/i18n';

/**
 * What can go wrong with the profile database when the app opens it, said in words a person can act on, and the
 * two things done to keep the person's data safe: a copy of the file before its schema is upgraded, and a damaged
 * file put aside (never deleted) when the person chooses to start with empty data.
 */

/** `declined`: the file is damaged and the person chose to quit; nothing more needs to be said. */
export type DatabaseProblem = 'newer' | 'damaged' | 'readOnly' | 'full' | 'busy' | 'declined' | 'unknown';

/** The database could not be opened; `problem` says why in a way the startup dialog can explain. */
export class DatabaseOpenError extends Error {
  constructor(readonly problem: DatabaseProblem, readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'DatabaseOpenError';
  }
}

const NEWER = /^Unsupported schema version \d+/;

export function classifyDatabaseError(error: unknown): DatabaseProblem {
  if (error instanceof DatabaseOpenError) return error.problem;
  const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : '';
  const message = error instanceof Error ? error.message : String(error);
  if (NEWER.test(message)) return 'newer';
  if (code === 'SQLITE_NOTADB' || code.startsWith('SQLITE_CORRUPT')) return 'damaged';
  if (code === 'SQLITE_FULL' || code === 'ENOSPC') return 'full';
  if (code.startsWith('SQLITE_READONLY') || code.startsWith('SQLITE_CANTOPEN') || code === 'EACCES' || code === 'EPERM' || code === 'EROFS') return 'readOnly';
  if (code.startsWith('SQLITE_BUSY') || code.startsWith('SQLITE_LOCKED')) return 'busy';
  return 'unknown';
}

/**
 * What the startup dialog says when the app could not start: a plain sentence with a next step for a database
 * problem, the general sentence with the log folder (and the error's own words) for anything else, and null when
 * the person already chose to quit.
 */
export function startupFailureText(error: unknown, t: Translator, folders: { profile: string; logs: string }, redact: (text: string) => string = (text) => text): string | null {
  const problem = error instanceof DatabaseOpenError ? error.problem : 'unknown';
  if (problem === 'declined') return null;
  const known = databaseProblemText(problem, t, folders.profile);
  if (known) return known;
  const detail = redact(error instanceof Error ? error.message : String(error)).slice(0, 500);
  return `${t('diagnostics.startupFailedMessage', { logs: folders.logs })}\n\n${detail}`;
}

/** The plain sentence for a database that could not be opened, or null for other failures. */
export function databaseProblemText(problem: DatabaseProblem, t: Translator, folder: string): string | null {
  switch (problem) {
    case 'newer': return t('diagnostics.dbNewer');
    case 'damaged': return t('diagnostics.dbDamagedStuck', { folder });
    case 'readOnly': return t('diagnostics.dbReadOnly', { folder });
    case 'full': return t('diagnostics.dbFull');
    case 'busy': return t('diagnostics.dbBusy');
    default: return null;
  }
}

/**
 * For a write that failed in the database while the app runs: the error code the window translates
 * (shared/i18n ERROR_KEYS), or null when the failure is not about storage.
 */
export const STORAGE_FULL = 'The disk is full; the change was not saved.';
export const STORAGE_FAILED = 'The change could not be stored.';

export function storageErrorCode(error: unknown): string | null {
  const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : '';
  if (!code.startsWith('SQLITE_')) return null;
  if (classifyDatabaseError(error) === 'full') return STORAGE_FULL;
  if (/^SQLITE_(READONLY|IOERR|CORRUPT|NOTADB|CANTOPEN|BUSY|LOCKED)/.test(code)) return STORAGE_FAILED;
  return null;
}

/** Database file plus the journal files SQLite keeps next to it. */
function companions(file: string): string[] {
  return [file, `${file}-wal`, `${file}-shm`];
}

function stamp(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/**
 * Before the schema of an existing database is upgraded: a copy of it next to it, `<file>.before-v<to>.bak`
 * (copies made for earlier upgrades are removed, so there is one). Returns the copy's path, or null when no copy
 * was made (a new or in-memory database, too little free space, a read-only folder). Never throws: a missing copy
 * does not stop the upgrade, which itself runs in transactions.
 */
export function backupBeforeUpgrade(db: Database.Database, file: string, from: number, to: number): string | null {
  if (from <= 0 || from >= to || file === ':memory:' || file === '') return null;
  try {
    // Everything committed is in the main file once the journal is folded in, so a plain copy is complete.
    db.pragma('wal_checkpoint(TRUNCATE)');
    const size = fs.statSync(file).size;
    const free = freeBytes(path.dirname(file));
    // Leave room for the upgrade itself and for the person's other work.
    if (free !== null && free < size * 2 + 64 * 1024 * 1024) return null;
    const target = `${file}.before-v${to}.bak`;
    const partial = `${target}.part`;
    fs.copyFileSync(file, partial);
    fs.renameSync(partial, target);
    try {
      fs.chmodSync(target, 0o600);
    } catch {
      // The copy is already in the owner-only profile folder.
    }
    for (const name of fs.readdirSync(path.dirname(file))) {
      const other = path.join(path.dirname(file), name);
      if (other !== target && name.startsWith(`${path.basename(file)}.before-v`) && name.endsWith('.bak')) fs.rmSync(other, { force: true });
    }
    return target;
  } catch {
    return null;
  }
}

function freeBytes(folder: string): number | null {
  try {
    const stats = fs.statfsSync(folder);
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return null;
  }
}

/**
 * Puts a damaged database aside: `<file>` (and its journal files) become `<file>.damaged-<date>`. Nothing is
 * deleted; the next open starts with an empty database. Returns the new name of the main file.
 */
export function setAsideDamaged(file: string, now = new Date()): string {
  const suffix = `.damaged-${stamp(now)}`;
  for (const item of companions(file)) {
    if (fs.existsSync(item)) fs.renameSync(item, path.join(path.dirname(file), path.basename(item).replace(path.basename(file), `${path.basename(file)}${suffix}`)));
  }
  return `${file}${suffix}`;
}
