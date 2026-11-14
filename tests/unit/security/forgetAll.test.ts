import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { migrate } from '../../../src/main/settings/migrate';
import { forgetEverySecret } from '../../../src/main/settings/forgetAll';
import { writeKeyFile, keyFilePath } from '../../../src/main/settings/keyFile';
import { writeTokenFile, tokenFilePath } from '../../../src/main/mcp/tokenFile';
import { McpOAuthManager } from '../../../src/main/mcp/oauth';

const dirs: string[] = [];
function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forget-all-'));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** A ciphertext-like marker that is easy to find in raw bytes. */
const MARK = (name: string) => Buffer.from(`v11-FAKE-CIPHER-${name}-${'x'.repeat(40)}`);

function rawBytes(dbFile: string): Buffer {
  const parts = [dbFile, `${dbFile}-wal`, `${dbFile}-shm`].filter((file) => fs.existsSync(file)).map((file) => fs.readFileSync(file));
  return Buffer.concat(parts);
}

describe('forget every secret', () => {
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
    expect(found).toEqual({ providers: ['openai', 'anthropic', 'google'], serverTokens: 2, signIns: 2 });
    const none = secretInventory({ db: (() => { const empty = new Database(':memory:'); migrate(empty); return empty; })(), userData: tempDir(), heldProviders: () => [], heldTokenOrigin: () => null, heldSignIns: () => [] });
    expect(none).toEqual({ providers: [], serverTokens: 0, signIns: 0 });
  });
});
