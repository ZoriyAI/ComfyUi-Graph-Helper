import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { databasePath } from '../../src/shared/database-path';
import { migrate, schemaVersion, tableNames } from '../../src/main/settings/migrate';
import { attemptSaveSecret, readSettings, saveSettings, secretRecordCount } from '../../src/main/settings/repository';

function version0Database(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      graph_data TEXT,
      metadata TEXT
    );
  `);
  db.prepare(
    'INSERT INTO projects (id, name, created_at, updated_at, graph_data, metadata) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('p1', 'Kept', 1, 1, '{}', '{}');
  return db;
}

describe('settings migration', () => {
  it('builds the database path from userData and the fixed file name', () => {
    expect(databasePath('/tmp/profile')).toBe(path.join('/tmp/profile', 'comfyui-desktop.db'));
    expect(databasePath('/tmp/profile')).not.toContain('process.env');
  });

  it('rolls back version 1 when the stamp is not written', () => {
    const db = version0Database();
    expect(() => migrate(db, { failBeforeVersionStamp: true })).toThrow(/before version stamp/);
    expect(schemaVersion(db)).toBe(0);
    expect(tableNames(db)).toEqual(['projects']);
    const row = db.prepare('SELECT name FROM projects WHERE id = ?').get('p1') as { name: string };
    expect(row.name).toBe('Kept');
    db.close();
  });

  it('stores and reopens only non-secret settings', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-'));
    const dbPath = databasePath(dir);
    const db = new Database(dbPath);
    migrate(db);
    expect(readSettings(db)).toEqual({
      source: 'default',
      values: {
        theme: 'graphite',
        motion: 'system',
        provider: '',
        model: '',
        comfyOrigin: '',
      },
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM settings').get()).toEqual({ count: 0 });

    const saved = saveSettings(db, {
      theme: 'graphite',
      motion: 'off',
      provider: 'openai',
      model: 'stored-model',
      comfyOrigin: 'http://127.0.0.1:8188',
    });
    expect(saved.ok).toBe(true);
    db.close();

    const reopened = new Database(dbPath);
    expect(schemaVersion(reopened)).toBe(1);
    expect(readSettings(reopened)).toMatchObject({
      source: 'stored',
      values: {
        motion: 'off',
        provider: 'openai',
        model: 'stored-model',
        comfyOrigin: 'http://127.0.0.1:8188',
      },
    });
    reopened.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('does not replace a corrupt settings row with defaults', () => {
    const db = new Database(':memory:');
    migrate(db);
    db.prepare(
      'INSERT INTO settings (id, theme, motion, provider, model, comfy_origin, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?)'
    ).run('not-a-theme', 'system', '', '', '', 1);
    expect(readSettings(db).source).toBe('corrupt');
    const row = db.prepare('SELECT theme FROM settings WHERE id = 1').get() as { theme: string };
    expect(row.theme).toBe('not-a-theme');
    db.close();
  });

  it('rejects a secret save without writing secret_records and leaves runs empty', () => {
    const db = new Database(':memory:');
    migrate(db);
    expect(tableNames(db)).toEqual(
      expect.arrayContaining(['runs', 'applied_commands', 'secret_records', 'settings'])
    );
    const result = attemptSaveSecret(db);
    expect(result).toEqual({ status: 'secret-storage-blocked' });
    expect(secretRecordCount(db)).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS count FROM runs').get()).toEqual({ count: 0 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM applied_commands').get()).toEqual({ count: 0 });
    const columns = db.prepare('PRAGMA table_info(secret_records)').all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toEqual(['name', 'ciphertext']);
    db.close();
  });
});
