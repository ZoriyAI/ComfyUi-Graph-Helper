import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: {}, dialog: {}, shell: {} }));

import { openDatabase } from '../../src/main/database';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { migrate, schemaVersion, SCHEMA_VERSION } from '../../src/main/settings/migrate';
import { readSettings } from '../../src/main/settings/repository';
import {
  backupBeforeUpgrade,
  classifyDatabaseError,
  DatabaseOpenError,
  setAsideDamaged,
  startupFailureText,
  storageErrorCode,
} from '../../src/main/settings/databaseSafety';
import { createTranslator, translateKnownError } from '../../src/shared/i18n';
import { DESKTOP_PROJECT_ID as P } from '../../src/shared/project';

const folders: string[] = [];
function tempFolder(): string {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'nodewise-db-'));
  folders.push(folder);
  return folder;
}
afterEach(() => {
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

const ru = createTranslator('ru');
const en = createTranslator('en');
const PROFILE = { profile: '/home/someone/.config/app', logs: '/home/someone/.config/app/logs' };

/** The shape of the schema: every table with its columns and every index with its columns. */
function schemaShape(db: Database.Database): Record<string, string[]> {
  const shape: Record<string, string[]> = {};
  const objects = db.prepare("SELECT type, name, tbl_name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all() as Array<{ type: string; name: string; tbl_name: string }>;
  for (const object of objects) {
    const columns = object.type === 'table'
      ? (db.prepare(`PRAGMA table_info(${object.name})`).all() as Array<{ name: string; type: string; dflt_value: unknown }>).map((column) => `${column.name}:${column.type}:${String(column.dflt_value)}`)
      : (db.prepare(`PRAGMA index_info(${object.name})`).all() as Array<{ name: string }>).map((column) => column.name);
    shape[`${object.type}:${object.name}:${object.tbl_name}`] = columns.sort();
  }
  return shape;
}

describe('opening the profile database', () => {
  it('upgrades a database left at every earlier version to the same schema as a new one, keeping its data', () => {
    const reference = new Database(':memory:');
    migrate(reference);
    const expected = schemaShape(reference);
    for (let version = 0; version < SCHEMA_VERSION; version += 1) {
      const db = new Database(':memory:');
      migrate(db, { upTo: version });
      expect(schemaVersion(db)).toBe(version);
      if (version === 0) {
        db.exec('CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, graph_data TEXT, metadata TEXT)');
      }
      db.prepare('INSERT INTO projects (id, name, created_at, updated_at, graph_data, metadata) VALUES (?, ?, 1, 1, ?, ?)').run('kept', `Kept at ${version}`, '{}', '{}');
      if (version >= 1) {
        db.prepare("INSERT INTO settings (id, theme, motion, provider, model, comfy_origin, updated_at) VALUES (1, 'graphite', 'reduced', 'openai', 'stored-model', '', 1)").run();
        db.prepare("INSERT INTO graph_revisions (id, project_id, timestamp, nodes, edges, parent_revision_id, description, source) VALUES ('old-1', 'kept', 1, '[]', '[]', NULL, 'Initial', 'system')").run();
      }
      migrate(db);
      expect(schemaVersion(db), `from version ${version}`).toBe(SCHEMA_VERSION);
      expect(schemaShape(db), `from version ${version}`).toEqual(expected);
      expect((db.prepare("SELECT name FROM projects WHERE id = 'kept'").get() as { name: string }).name).toBe(`Kept at ${version}`);
      if (version >= 1) {
        const settings = readSettings(db);
        expect(settings.source, `from version ${version}`).toBe('stored');
        expect(settings.source === 'stored' ? settings.values.model : null).toBe('stored-model');
      }
      // The upgraded database works: the workspace and a first change.
      ensureWorkspace(db);
      const before = readProjection(db, P)!;
      const added = commitCommand(db, { projectId: P, runId: null, actionId: 'a', expectedRevisionId: before.currentRevisionId, actor: 'manual', payload: { type: 'add-node', nodeType: 'Note' } });
      expect(added.status, `from version ${version}`).toBe('applied');
      db.close();
    }
  });

  it('copies an older database before upgrading it and keeps one copy', () => {
    const folder = tempFolder();
    const file = path.join(folder, 'comfyui-desktop.db');
    const old = new Database(file);
    old.pragma('journal_mode = WAL');
    migrate(old, { upTo: SCHEMA_VERSION - 1 });
    old.prepare("INSERT INTO projects (id, name, created_at, updated_at, graph_data, metadata) VALUES ('p', 'Before', 1, 1, '{}', '{}')").run();
    old.close();
    fs.writeFileSync(`${file}.before-v3.bak`, 'an older copy');
    const db = openDatabase(file);
    expect(schemaVersion(db)).toBe(SCHEMA_VERSION);
    db.close();
    const copy = `${file}.before-v${SCHEMA_VERSION}.bak`;
    expect(fs.existsSync(copy)).toBe(true);
    expect(fs.existsSync(`${file}.before-v3.bak`)).toBe(false);
    const kept = new Database(copy, { readonly: true });
    expect(schemaVersion(kept)).toBe(SCHEMA_VERSION - 1);
    expect((kept.prepare("SELECT name FROM projects WHERE id = 'p'").get() as { name: string }).name).toBe('Before');
    kept.close();
    // Opening again (already upgraded) makes no new copy.
    fs.rmSync(copy);
    openDatabase(file).close();
    expect(fs.existsSync(copy)).toBe(false);
  });

  it('makes no copy of a new database', () => {
    const db = new Database(':memory:');
    expect(backupBeforeUpgrade(db, ':memory:', 3, SCHEMA_VERSION)).toBeNull();
    const folder = tempFolder();
    const file = path.join(folder, 'comfyui-desktop.db');
    openDatabase(file).close();
    expect(fs.readdirSync(folder).filter((name) => name.endsWith('.bak'))).toEqual([]);
  });

  it('refuses a database from a newer version without changing it, and says so plainly', () => {
    const folder = tempFolder();
    const file = path.join(folder, 'comfyui-desktop.db');
    const db = new Database(file);
    migrate(db);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, 1)').run(SCHEMA_VERSION + 1);
    db.close();
    const bytes = fs.readFileSync(file);
    let caught: unknown = null;
    try {
      openDatabase(file);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DatabaseOpenError);
    expect((caught as DatabaseOpenError).problem).toBe('newer');
    expect(fs.readFileSync(file).equals(bytes)).toBe(true);
    const text = startupFailureText(caught, ru, PROFILE)!;
    expect(text).toMatch(/более новой версией/);
    expect(text).not.toMatch(/schema|Unsupported|version \d/i);
    expect(startupFailureText(caught, en, PROFILE)).toMatch(/newer version/);
  });

  it('recognises a damaged file, puts it aside without deleting it, and starts empty', () => {
    const folder = tempFolder();
    const file = path.join(folder, 'comfyui-desktop.db');
    fs.writeFileSync(file, Buffer.alloc(8192, 0x41));
    let caught: unknown = null;
    try {
      openDatabase(file);
    } catch (error) {
      caught = error;
    }
    expect((caught as DatabaseOpenError).problem).toBe('damaged');
    // Journal files next to it move with it.
    fs.writeFileSync(`${file}-wal`, 'journal');
    const aside = setAsideDamaged(file, new Date(2026, 10, 14, 9, 5, 7));
    expect(path.basename(aside)).toBe('comfyui-desktop.db.damaged-20261114-090507');
    expect(fs.readFileSync(aside).length).toBe(8192);
    expect(fs.existsSync(`${aside}-wal`)).toBe(true);
    expect(fs.existsSync(file)).toBe(false);
    const db = openDatabase(file);
    expect(schemaVersion(db)).toBe(SCHEMA_VERSION);
    db.close();
    // A truncated database is damaged too.
    const good = path.join(folder, 'good.db');
    const made = new Database(good);
    migrate(made);
    made.exec('CREATE TABLE filler (x TEXT)');
    for (let index = 0; index < 400; index += 1) made.prepare('INSERT INTO filler VALUES (?)').run('x'.repeat(400));
    made.close();
    const truncated = path.join(folder, 'truncated.db');
    const bytes = fs.readFileSync(good);
    fs.writeFileSync(truncated, bytes.subarray(0, Math.floor(bytes.length / 3)));
    expect(() => openDatabase(truncated)).toThrow(DatabaseOpenError);
  });

  it('says what to do for each kind of problem, never the raw error', () => {
    const codes: Array<[string, string]> = [
      ['SQLITE_FULL', 'full'], ['SQLITE_READONLY', 'readOnly'], ['SQLITE_CANTOPEN', 'readOnly'], ['EACCES', 'readOnly'],
      ['SQLITE_BUSY', 'busy'], ['SQLITE_NOTADB', 'damaged'], ['SQLITE_CORRUPT', 'damaged'], ['SQLITE_ERROR', 'unknown'],
    ];
    for (const [code, problem] of codes) {
      const error = Object.assign(new Error(`raw ${code} words`), { code });
      expect(classifyDatabaseError(error)).toBe(problem);
      if (problem === 'unknown') continue;
      const text = startupFailureText(new DatabaseOpenError(classifyDatabaseError(error), error), ru, PROFILE)!;
      expect(text).not.toMatch(/raw|SQLITE/);
      expect(text.length).toBeGreaterThan(20);
    }
    expect(startupFailureText(new DatabaseOpenError('declined', null), ru, PROFILE)).toBeNull();
    // Anything else keeps the general sentence with the log folder.
    expect(startupFailureText(new Error('boom'), ru, PROFILE)).toMatch(/Журнал находится в \/home\/someone\/\.config\/app\/logs/);
  });

  it('a change that cannot be stored because the disk is full is refused with a plain reason, and nothing is half written', () => {
    const db = new Database(':memory:');
    migrate(db);
    ensureWorkspace(db);
    const before = readProjection(db, P)!;
    const pages = db.pragma('page_count', { simple: true }) as number;
    db.pragma(`max_page_count = ${pages}`);
    const big = 'x'.repeat(200_000);
    const result = commitCommand(db, { projectId: P, runId: null, actionId: 'full', expectedRevisionId: before.currentRevisionId, actor: 'manual', payload: { type: 'add-node', nodeType: 'Note', title: big } });
    expect(result.status).toBe('rejected');
    expect((result.result as { error: string }).error).toBe('The disk is full; the change was not saved.');
    expect(translateKnownError(ru, 'The disk is full; the change was not saved.')).toMatch(/нет свободного места/);
    const after = readProjection(db, P)!;
    expect(after.currentRevisionId).toBe(before.currentRevisionId);
    expect((db.prepare('SELECT COUNT(*) AS c FROM applied_commands').get() as { c: number }).c).toBe(0);
    expect(storageErrorCode(new Error('plain'))).toBeNull();
  });
});
