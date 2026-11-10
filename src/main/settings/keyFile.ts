import * as fs from 'fs';
import * as path from 'path';

/**
 * Model providers' keys remembered in a plain file, by the person's explicit choice, on a computer without a
 * password store the app can use. The file is readable by this user only (mode 0600) and holds at most one key per
 * cloud provider. Nothing else in the app reads or writes it; its content is never logged, exported or shown back.
 *
 * Shape (version 2): `{ "version": 2, "keys": { "openai": "...", "anthropic": "..." } }`.
 * The version 1 shape `{ "version": 1, "provider": "anthropic", "key": "..." }` is still read: it was written for
 * the provider saved at the time, which is the provider its key belongs to.
 */
export const KEY_FILE = 'model-key.json';

export const KEY_FILE_PROVIDERS = ['openai', 'anthropic', 'google'] as const;
export type KeyFileProvider = typeof KEY_FILE_PROVIDERS[number];
export type KeyFileKeys = Partial<Record<KeyFileProvider, string>>;

function isKeyFileProvider(value: unknown): value is KeyFileProvider {
  return typeof value === 'string' && (KEY_FILE_PROVIDERS as readonly string[]).includes(value);
}

function usableKey(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && value.length <= 4000;
}

export function keyFilePath(userData: string): string {
  return path.join(userData, KEY_FILE);
}

/** Every key in the file by provider; an unreadable or foreign file reads as no keys. */
export function readKeyFile(userData: string): KeyFileKeys {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(keyFilePath(userData), 'utf8')) as unknown;
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object') return {};
  const record = parsed as { provider?: unknown; key?: unknown; keys?: unknown };
  const out: KeyFileKeys = {};
  if (record.keys && typeof record.keys === 'object') {
    for (const [provider, key] of Object.entries(record.keys as Record<string, unknown>)) {
      if (isKeyFileProvider(provider) && usableKey(key)) out[provider] = key;
    }
    return out;
  }
  // Version 1: one key for the provider it was saved for.
  if (isKeyFileProvider(record.provider) && usableKey(record.key)) out[record.provider] = record.key;
  return out;
}

function writeKeys(userData: string, keys: KeyFileKeys): void {
  const file = keyFilePath(userData);
  if (Object.keys(keys).length === 0) {
    removeKeyFile(userData);
    return;
  }
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ version: 2, keys }), { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Not every file system keeps modes; the write above already asked for owner-only.
  }
}

/** Writes the key for `provider`, keeping the other providers' keys; the file stays owner-only. */
export function writeKeyFile(userData: string, provider: KeyFileProvider, key: string): void {
  writeKeys(userData, { ...readKeyFile(userData), [provider]: key });
}

/** Removes one provider's key; the file goes away when no key is left. */
export function removeKeyFromFile(userData: string, provider: KeyFileProvider): void {
  const keys = readKeyFile(userData);
  if (!(provider in keys)) return;
  delete keys[provider];
  writeKeys(userData, keys);
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
  return isKeyFileProvider(provider) && provider in readKeyFile(userData);
}
