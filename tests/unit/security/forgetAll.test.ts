/**
 * Protects "Forget all" in Settings: every provider key, MCP token and browser sign-in goes from memory, from the
 * database and from the fallback key and token files, and the database is rebuilt so no old encrypted bytes stay in
 * free pages. The confirmation also counts exactly what will go. A person handing over or leaving a computer must be
 * able to trust that nothing is left.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const faults = vi.hoisted(() => ({ unlink: new Set<string>(), writes: new Set<string>() }));
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  const denied = () => Object.assign(new Error('private filesystem failure'), { code: 'EACCES' });
  const patched = {
    ...actual,
    unlinkSync: (file: fs.PathLike) => { if (faults.unlink.has(String(file))) throw denied(); return actual.unlinkSync(file); },
    openSync: (file: fs.PathLike, flags: fs.OpenMode, mode?: fs.Mode) => { if (flags !== 'r' && faults.writes.has(String(file))) throw denied(); return actual.openSync(file, flags, mode); },
    renameSync: (from: fs.PathLike, to: fs.PathLike) => { if (faults.writes.has(String(to))) throw denied(); return actual.renameSync(from, to); },
  };
  return { ...patched, default: patched };
});
import { migrate } from '../../../src/main/settings/migrate';
import { forgetEverySecret } from '../../../src/main/settings/forgetAll';
import { writeKeyFile, keyFilePath, readKeyFile, removeKeyFile, removeKeyFromFile } from '../../../src/main/settings/keyFile';
import { writeTokenFile, tokenFilePath, removeTokenFile } from '../../../src/main/mcp/tokenFile';
import { McpOAuthManager } from '../../../src/main/mcp/oauth';

const dirs: string[] = [];
function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forget-all-'));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  faults.unlink.clear();
  faults.writes.clear();
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** A ciphertext-like marker that is easy to find in raw bytes. */
const MARK = (name: string) => Buffer.from(`v11-FAKE-CIPHER-${name}-${'x'.repeat(40)}`);

function rawBytes(dbFile: string): Buffer {
  const parts = [dbFile, `${dbFile}-wal`, `${dbFile}-shm`].filter((file) => fs.existsSync(file)).map((file) => fs.readFileSync(file));
  return Buffer.concat(parts);
}

describe('forget every secret', () => {
  it('distinguishes absent files and reports no failed store for an empty profile', () => {
    const userData = tempDir();
    const db = new Database(':memory:');
    migrate(db);
    expect(removeKeyFile(userData)).toBe('absent');
    expect(removeTokenFile(userData)).toBe('absent');
    expect(forgetEverySecret({ db, userData, forgetKeys: () => undefined, forgetMcpToken: () => undefined, forgetSignIns: () => undefined }))
      .toMatchObject({ files: 0, records: 0, failed: [] });
    db.close();
  });

  it('reports a failed key file while clearing other stores, and a retry removes the remainder', () => {
    const userData = tempDir();
    const db = new Database(':memory:');
    migrate(db);
    db.prepare('INSERT INTO secret_records (name, ciphertext) VALUES (?, ?)').run('provider-key:google', MARK('g'));
    writeKeyFile(userData, 'openai', 'fixture-key');
    writeTokenFile(userData, 'https://a.example', 'fixture-token');
    faults.unlink.add(keyFilePath(userData));
    faults.writes.add(keyFilePath(userData));
    const memory = { keys: true, token: true, signIns: true };
    const deps = { db, userData, forgetKeys: () => { memory.keys = false; }, forgetMcpToken: () => { memory.token = false; }, forgetSignIns: () => { memory.signIns = false; } };
    const result = forgetEverySecret(deps);
    expect(result.failed).toContain('keys-file');
    expect(result.records).toBe(1);
    expect(memory).toEqual({ keys: false, token: false, signIns: false });
    expect(readKeyFile(userData)).toEqual({ openai: 'fixture-key' });
    expect(fs.existsSync(tokenFilePath(userData))).toBe(false);
    expect(secretInventory({ db, userData, heldProviders: () => [], heldTokenOrigin: () => null, heldSignIns: () => [] }).providers).toEqual(['openai']);
    faults.unlink.clear();
    faults.writes.clear();
    expect(forgetEverySecret(deps).failed).toEqual([]);
    expect(readKeyFile(userData)).toEqual({});
    db.close();
  });

  it.each(['keys', 'token'])('empties and reads back the %s file when unlink is denied but writing is possible', (kind) => {
    const userData = tempDir();
    writeKeyFile(userData, 'openai', 'fixture-key');
    writeTokenFile(userData, 'https://a.example', 'fixture-token');
    const file = kind === 'keys' ? keyFilePath(userData) : tokenFilePath(userData);
    faults.unlink.add(file);
    const outcome = kind === 'keys' ? removeKeyFile(userData) : removeTokenFile(userData);
    expect(outcome).toBe('removed');
    expect(fs.readFileSync(file)).toHaveLength(0);
  });

  it('does not claim one provider was removed when the file could not be replaced', () => {
    const userData = tempDir();
    writeKeyFile(userData, 'openai', 'fixture-key');
    writeKeyFile(userData, 'google', 'other-fixture-key');
    faults.writes.add(keyFilePath(userData));
    expect(removeKeyFromFile(userData, 'openai')).toBe('failed');
    expect(readKeyFile(userData)).toEqual({ openai: 'fixture-key', google: 'other-fixture-key' });
    faults.writes.clear();
    expect(removeKeyFromFile(userData, 'openai')).toBe('removed');
    expect(readKeyFile(userData)).toEqual({ google: 'other-fixture-key' });
  });

  it('inventories and clears only the exact crash temporary secret files', () => {
    const userData = tempDir();
    const db = new Database(':memory:');
    migrate(db);
    const owned = ['.model-key.json.012345abcdef.tmp', '.mcp-token.json.abcdef012345.tmp'];
    const other = ['.model-key.json.notes.tmp', '.mcp-token.json.abcdef012345.tmp.keep', 'project.json'];
    for (const name of [...owned, ...other]) fs.writeFileSync(path.join(userData, name), 'fixture-bytes');
    const deps = { db, userData, heldProviders: () => [], heldTokenOrigin: () => null, heldSignIns: () => [] };
    expect(secretInventory(deps)).toMatchObject({ files: 2 });
    const result = forgetEverySecret({ db, userData, forgetKeys: () => undefined, forgetMcpToken: () => undefined, forgetSignIns: () => undefined });
    expect(result.files).toBe(2);
    expect(result.failed).toEqual([]);
    expect(fs.readdirSync(userData).sort()).toEqual(other.sort());
    db.close();
  });

  it('records a failed memory clear and still clears other memory and files', () => {
    const userData = tempDir();
    const db = new Database(':memory:');
    migrate(db);
    writeTokenFile(userData, 'https://a.example', 'fixture-token');
    const cleared: string[] = [];
    const result = forgetEverySecret({ db, userData, forgetKeys: () => { throw new Error('private failure'); }, forgetMcpToken: () => { cleared.push('token'); }, forgetSignIns: () => { cleared.push('sign-ins'); } });
    expect(result.failed).toContain('memory');
    expect(cleared).toEqual(['token', 'sign-ins']);
    expect(fs.existsSync(tokenFilePath(userData))).toBe(false);
    db.close();
  });
  it('removes keys, tokens for every address, sign-ins, both files and memory, and leaves no bytes behind', () => {
    const userData = tempDir();
    const dbFile = path.join(userData, 'test.db');
    const db = new Database(dbFile);
    db.pragma('journal_mode = WAL');
    migrate(db);
    const names = [
      'provider-key:openai', 'provider-key:anthropic', 'provider-key', 'mcp-token:https://a.example', 'mcp-token:https://b.example',
      'mcp-oauth-client:https://a.example', 'mcp-oauth-tokens:https://a.example', 'mcp-oauth-tokens:https://old.example',
    ];
    const insert = db.prepare('INSERT INTO secret_records (name, ciphertext) VALUES (?, ?)');
    for (const name of names) insert.run(name, MARK(name));
    // A row replaced earlier leaves its old bytes in a free page unless the database is rebuilt.
    db.prepare('UPDATE secret_records SET ciphertext = ? WHERE name = ?').run(MARK('refreshed'), 'mcp-oauth-tokens:https://a.example');
    db.pragma('wal_checkpoint(TRUNCATE)');
    writeKeyFile(userData, 'openai', 'fake-file-key-0000');
    writeTokenFile(userData, 'https://a.example', 'fake-file-token-0000');
    const memory = { keys: true, token: true, signIns: true };

    const result = forgetEverySecret({
      db,
      userData,
      forgetKeys: () => { memory.keys = false; },
      forgetMcpToken: () => { memory.token = false; },
      forgetSignIns: () => { memory.signIns = false; },
    });

    expect(result.records).toBe(names.length);
    expect(result.files).toBe(2);
    expect(result.compacted).toBe(true);
    expect((db.prepare('SELECT COUNT(*) AS n FROM secret_records').get() as { n: number }).n).toBe(0);
    expect(memory).toEqual({ keys: false, token: false, signIns: false });
    expect(fs.existsSync(keyFilePath(userData))).toBe(false);
    expect(fs.existsSync(tokenFilePath(userData))).toBe(false);
    db.close();
    const bytes = rawBytes(dbFile);
    expect(bytes.includes(Buffer.from('FAKE-CIPHER'))).toBe(false);
  });

  it('the sign-in manager forgets every address it holds', async () => {
    const db = new Database(':memory:');
    migrate(db);
    const manager = new McpOAuthManager({
      db: () => db,
      vault: { decision: async () => ({ persist: false }), encrypt: async () => Buffer.alloc(0), decrypt: async () => null },
      openExternal: async () => undefined,
      language: () => 'en',
      now: () => 1000,
    });
    await manager.saveTokens('https://a.example', { access_token: 'fake-access', token_type: 'Bearer' } as never);
    await manager.saveTokens('https://b.example', { access_token: 'fake-access-b', token_type: 'Bearer' } as never);
    expect(manager.signedIn('https://a.example/mcp')).toBe(true);
    manager.forgetAll();
    expect(manager.signedIn('https://a.example/mcp')).toBe(false);
    expect(manager.signedIn('https://b.example/mcp')).toBe(false);
  });
});

import { secretInventory } from '../../../src/main/settings/forgetAll';

describe('what Forget all would remove', () => {
  it('names providers and counts tokens and sign-ins for every address, from memory, records and files', () => {
    const userData = tempDir();
    const db = new Database(':memory:');
    migrate(db);
    const insert = db.prepare('INSERT INTO secret_records (name, ciphertext) VALUES (?, ?)');
    insert.run('provider-key:anthropic', MARK('a'));
    insert.run('mcp-token:https://a.example', MARK('t'));
    insert.run('mcp-oauth-tokens:https://b.example', MARK('o'));
    insert.run('mcp-oauth-client:https://b.example', MARK('c'));
    writeKeyFile(userData, 'google', 'fake-file-key-0000');
    writeTokenFile(userData, 'https://c.example', 'fake-file-token-0000');
    const found = secretInventory({
      db, userData,
      heldProviders: () => ['openai'],
      heldTokenOrigin: () => 'https://a.example',
      heldSignIns: () => ['https://b.example', 'https://d.example'],
    });
    // Tokens: a.example (memory and record, counted once) and c.example (file). Sign-ins: b.example and d.example.
    expect(found).toEqual({ providers: ['openai', 'anthropic', 'google'], serverTokens: 2, signIns: 2 });
    const none = secretInventory({ db: (() => { const empty = new Database(':memory:'); migrate(empty); return empty; })(), userData: tempDir(), heldProviders: () => [], heldTokenOrigin: () => null, heldSignIns: () => [] });
    expect(none).toEqual({ providers: [], serverTokens: 0, signIns: 0 });
  });
});
