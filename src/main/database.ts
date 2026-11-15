/**
 * The one profile database (SQLite): opened, checked and upgraded at start by initDatabase (main/index.ts), then
 * handed out with getDatabase to every IPC handler, the update check and the MCP session store. A damaged file is
 * never deleted: the person chooses to put it aside and start empty, open its folder, or quit.
 */
import Database from 'better-sqlite3';
import * as path from 'path';
import { app, dialog, shell } from 'electron';
import { ensureWorkspace } from './commands/commit';
import { trimAllHistories } from './commands/history';
import { closeInterruptedRuns } from './agent/interrupted';
import { readSettings } from './settings/repository';
import { languageOf } from '../shared/i18n';
import { systemLanguage } from './systemLanguage';
import { databasePath } from '../shared/database-path';
import { migrate, schemaVersion, SCHEMA_VERSION } from './settings/migrate';
import { backupBeforeUpgrade, classifyDatabaseError, DatabaseOpenError, setAsideDamaged } from './settings/databaseSafety';
import { reseedCoreKnowledge } from './knowledge/seedCore';
import { createTranslator } from '../shared/i18n';
import { ownerOnlyFiles } from './profileFolder';

/** The open database; null before initDatabase and after closeDatabase. */
let db: Database.Database | null = null;

/**
 * Opens and upgrades the profile database. A file from a newer app version is refused before anything is
 * written; an existing file is copied before its schema is upgraded (settings/databaseSafety.ts). A failure is a
 * DatabaseOpenError that says what kind of problem it is.
 */
export function openDatabase(dbPath: string): Database.Database {
  let opened: Database.Database | null = null;
  try {
    opened = new Database(dbPath);
    // A file from a newer version is refused before anything is written to it.
    const from = schemaVersion(opened);
    if (from > SCHEMA_VERSION) throw new DatabaseOpenError('newer', new Error(`Unsupported schema version ${from}`));
    opened.pragma('journal_mode = WAL');
    // Deleted or replaced rows (a forgotten key's ciphertext, a refreshed token) are overwritten, not left in free pages.
    opened.pragma('secure_delete = ON');
    const copy = backupBeforeUpgrade(opened, dbPath, from, SCHEMA_VERSION);
    if (copy) console.log(`[Database] Copy before upgrade from version ${from}: ${path.basename(copy)}`);
    migrate(opened);
    // The database holds prompts and conversations: readable by this user only, also when it is copied out of the
    // profile folder, and so are its journal files (WAL mode created them above).
    ownerOnlyFiles([dbPath, `${dbPath}-wal`, `${dbPath}-shm`]);
    return opened;
  } catch (error) {
    try {
      opened?.close();
    } catch {
      // Already unusable.
    }
    throw error instanceof DatabaseOpenError ? error : new DatabaseOpenError(classifyDatabaseError(error), error);
  }
}

/**
 * A damaged file: the person may put it aside (it is renamed, never deleted) and start with empty data, open the
 * folder, or quit. The settings cannot be read, so it speaks the system's language.
 */
function askAboutDamagedFile(dbPath: string): boolean {
  const t = createTranslator(systemLanguage());
  const folder = path.dirname(dbPath);
  for (;;) {
    const choice = dialog.showMessageBoxSync({
      type: 'error',
      title: t('diagnostics.dbDamagedTitle'),
      message: t('diagnostics.dbDamagedMessage'),
      detail: t('diagnostics.dbDamagedDetail', { folder }),
      buttons: [t('diagnostics.dbStartEmpty'), t('diagnostics.openFolder'), t('diagnostics.quit')],
      defaultId: 2,
      cancelId: 2,
      noLink: true,
    });
    if (choice === 0) return true;
    if (choice === 1) {
      void shell.openPath(folder);
      // Opening the folder answers nothing: the question comes back until the person starts empty or quits.
      continue;
    }
    return false;
  }
}

/**
 * Opens the database at start and brings it to a usable state: the workspace project, interrupted runs closed,
 * the built-in knowledge reseeded, long histories trimmed. Throws a DatabaseOpenError when the file cannot be
 * opened, or is damaged and the person declines to put it aside.
 */
export function initDatabase(): void {
  const userDataDir = app.getPath('userData');
  const dbPath = databasePath(userDataDir);
  console.log('[Database] Opening', dbPath);
  try {
    db = openDatabase(dbPath);
  } catch (error) {
    if (!(error instanceof DatabaseOpenError) || error.problem !== 'damaged') throw error;
    console.error('[Database] The file is damaged:', error.message);
    if (!askAboutDamagedFile(dbPath)) throw new DatabaseOpenError('declined', error.cause);
    const aside = setAsideDamaged(dbPath);
    console.warn(`[Database] Damaged file kept as ${path.basename(aside)}; starting with empty data`);
    db = openDatabase(dbPath);
  }
  ensureWorkspace(db);
  // No turn survives a restart: runs left open by the previous session would block or confuse the next one. A run
  // that had changed the graph leaves one line in the chat saying so.
  closeInterruptedRuns(db, languageOf(readSettings(db)));
  reseedCoreKnowledge(db); // Built-in teaching knowledge in the saved interface language; never fatal.
  // A history grown past its limits shrinks in short steps after start (commands/history.ts).
  trimAllHistories(db);
  console.log('[Database] Schema ready');
}

/** The open database; throws when called before initDatabase. */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

/** Closes the database at quit, so the WAL journal is folded back into the file. */
export function closeDatabase(): void {
  if (db) {
    console.log('[Database] Closing');
    db.close();
    db = null;
  }
}
