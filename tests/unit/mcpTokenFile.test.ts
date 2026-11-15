/**
 * Two small files in the app folder: the MCP token file (src/main/mcp/tokenFile), used on a computer without a
 * password store, and the password store chosen for the next start (src/main/settings/passwordStoreOverride).
 * The token file is owner-only, holds one origin, and a broken or oversized file is ignored.
 * Why: a remembered token must stay private and must never be sent to a server it was not saved for.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readTokenFile, removeTokenFile, tokenFileHolds, tokenFilePath, writeTokenFile } from '../../src/main/mcp/tokenFile';
import { PASSWORD_STORE_FILE, readPasswordStoreOverride, writePasswordStoreOverride } from '../../src/main/settings/passwordStoreOverride';

const dirs: string[] = [];
/** A fresh temporary app folder; afterEach removes it. */
function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'helper-token-file-'));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  while (dirs.length > 0) fs.rmSync(dirs.pop() as string, { recursive: true, force: true });
});

describe('the token remembered in the app folder', () => {
  it('writes an owner-only file for one origin and reads it back only for that origin', () => {
    const dir = tempDir();
    expect(readTokenFile(dir)).toBeNull();
    writeTokenFile(dir, 'http://127.0.0.1:29100', 'fixture-token-not-a-secret');
    const mode = fs.statSync(tokenFilePath(dir)).mode & 0o777;
    expect(mode).toBe(0o600);
    expect(readTokenFile(dir)).toEqual({ origin: 'http://127.0.0.1:29100', token: 'fixture-token-not-a-secret' });
    expect(tokenFileHolds(dir, 'http://127.0.0.1:29100')).toBe(true);
    expect(tokenFileHolds(dir, 'http://127.0.0.1:29101')).toBe(false);
    expect(tokenFileHolds(dir, null)).toBe(false);
    // Replaced, not appended: the previous origin is gone.
    writeTokenFile(dir, 'https://mcp.example.test', 'other');
    expect(tokenFileHolds(dir, 'http://127.0.0.1:29100')).toBe(false);
    expect(removeTokenFile(dir)).toBe(true);
    expect(removeTokenFile(dir)).toBe(false);
    expect(readTokenFile(dir)).toBeNull();
  });

  it('ignores a broken or oversized file', () => {
    const dir = tempDir();
    fs.writeFileSync(tokenFilePath(dir), '{not json');
    expect(readTokenFile(dir)).toBeNull();
    fs.writeFileSync(tokenFilePath(dir), JSON.stringify({ origin: 'http://x', token: 'a'.repeat(9000) }));
    expect(readTokenFile(dir)).toBeNull();
    fs.writeFileSync(tokenFilePath(dir), JSON.stringify({ origin: '', token: 'x' }));
    expect(readTokenFile(dir)).toBeNull();
  });
});

describe('the password store chosen for the next start', () => {
  it('keeps only a known choice and removes the file for "automatic"', () => {
    const dir = tempDir();
    expect(readPasswordStoreOverride(dir)).toBeNull();
    writePasswordStoreOverride(dir, 'kwallet6');
    expect(readPasswordStoreOverride(dir)).toBe('kwallet6');
    // 'basic' is not a store the app offers, so a hand-edited file with it is ignored.
    fs.writeFileSync(path.join(dir, PASSWORD_STORE_FILE), JSON.stringify({ store: 'basic' }));
    expect(readPasswordStoreOverride(dir)).toBeNull();
    writePasswordStoreOverride(dir, 'gnome-libsecret');
    expect(readPasswordStoreOverride(dir)).toBe('gnome-libsecret');
    writePasswordStoreOverride(dir, null);
    expect(fs.existsSync(path.join(dir, PASSWORD_STORE_FILE))).toBe(false);
    expect(readPasswordStoreOverride(dir)).toBeNull();
  });
});
