import * as fs from 'fs';
import * as path from 'path';

/**
 * The model provider's key remembered in a plain file, by the person's explicit choice, on a computer without a
 * password store the app can use. The file is readable by this user only (mode 0600) and holds one key for one
 * provider. Nothing else in the app reads or writes it; its content is never logged, exported or shown back.
 */
export const KEY_FILE = 'model-key.json';

export function keyFilePath(userData: string): string {
  return path.join(userData, KEY_FILE);
}

export function readKeyFile(userData: string): { provider: string; key: string } | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(keyFilePath(userData), 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const { provider, key } = parsed as { provider?: unknown; key?: unknown };
    if (typeof provider !== 'string' || typeof key !== 'string' || provider === '' || key === '' || key.length > 4000) return null;
    return { provider, key };
  } catch {
    return null;
  }
}

/** Writes the key for `provider`; the file is created or replaced with owner-only permissions. */
export function writeKeyFile(userData: string, provider: string, key: string): void {
  const file = keyFilePath(userData);
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ version: 1, provider, key }), { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Not every file system keeps modes; the write above already asked for owner-only.
  }
}

export function removeKeyFile(userData: string): boolean {
  try {
    fs.unlinkSync(keyFilePath(userData));
    return true;
  } catch {
    return false;
  }
}

/** Whether the file holds a key for this provider (never the key itself). */
export function keyFileHolds(userData: string, provider: string): boolean {
  return provider !== '' && readKeyFile(userData)?.provider === provider;
}
