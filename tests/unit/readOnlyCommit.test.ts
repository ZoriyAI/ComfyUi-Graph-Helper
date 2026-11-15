import { afterAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import { cachedCatalog, commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'read-only-commit-'));
afterAll(() => fs.rmSync(folder, { recursive: true, force: true }));

function preparedFile(name: string): string {
  const file = path.join(folder, name);
  const writable = new Database(file);
  migrate(writable);
  ensureWorkspace(writable);
  writable.close();
  return file;
}

/** A connection on which every statement that writes, temporary ones too, fails the way SQLite fails on a read-only file. */
function refusingWrites(db: Database.Database): Database.Database {
  const exec = db.exec.bind(db);
  db.exec = ((sql: string) => {
    if (/^\s*(CREATE|INSERT|UPDATE|DELETE)/i.test(sql)) throw Object.assign(new Error('attempt to write a readonly database'), { code: 'SQLITE_READONLY' });
    return exec(sql);
  }) as typeof db.exec;
  return db;
}

function addNode(db: Database.Database, expected: string) {
  return commitCommand(db, {
    projectId: DESKTOP_PROJECT_ID, actionId: `ro-${expected}`, expectedRevisionId: expected, actor: 'manual', runId: null,
    payload: { type: 'add-node', nodeType: 'KSampler', x: 0, y: 0 },
  });
}

describe('a change on a database that cannot be written', () => {
  it('is refused with a reason on the first change of a fresh read-only connection', () => {
    const db = new Database(preparedFile('read-only.sqlite'), { readonly: true });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const current = readProjection(db, DESKTOP_PROJECT_ID)!;
    const response = addNode(db, current.currentRevisionId);
    expect(response.status).toBe('rejected');
    expect(response.result).toMatchObject({ error: expect.any(String) });
    expect(readProjection(db, DESKTOP_PROJECT_ID)!.currentRevisionId).toBe(current.currentRevisionId);
    db.close();
  });

  it('does not throw when even the catalog cache cannot be set up: the catalog is read without it', () => {
    const db = refusingWrites(new Database(preparedFile('no-temp.sqlite')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(Array.isArray(cachedCatalog(db).nodes)).toBe(true);
    const current = readProjection(db, DESKTOP_PROJECT_ID)!;
    expect(() => addNode(db, current.currentRevisionId)).not.toThrow();
    db.close();
  });
});
