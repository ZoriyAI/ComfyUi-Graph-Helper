import * as fs from 'fs';
import * as path from 'path';
import { writeFileAtomic } from '../files/atomicWrite';
import { KEY_PROVIDERS } from '../../shared/config/keyOrigin';

/**
 * Model providers' keys remembered in a plain file, by the person's explicit choice, on a computer without a
 * password store the app can use. The file is readable by this user only (mode 0600) and holds at most one key per
 * cloud provider. Nothing else in the app reads or writes it; its content is never logged, exported or shown back.
 *
 * Shape (version 2): `{ "version": 2, "keys": { "openai": "...", "anthropic": "..." }, "origins": { "openai": "https://…" } }`.
 * `origins` names the address a key was pasted for when it is not the provider's official one (absent: official).
 * The version 1 shape `{ "version": 1, "provider": "anthropic", "key": "..." }` is still read: it was written for
 * the provider saved at the time, which is the provider its key belongs to.
 */
export const KEY_FILE = 'model-key.json';

export const KEY_FILE_PROVIDERS = KEY_PROVIDERS;
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

/** The address each key of the file belongs to, when it is not the provider's official one. */
export function readKeyFileOrigins(userData: string): Partial<Record<KeyFileProvider, string>> {
  try {
    const parsed = JSON.parse(fs.readFileSync(keyFilePath(userData), 'utf8')) as { origins?: unknown };
    const out: Partial<Record<KeyFileProvider, string>> = {};
    if (parsed?.origins && typeof parsed.origins === 'object') {
      for (const [provider, origin] of Object.entries(parsed.origins as Record<string, unknown>)) {
        if (isKeyFileProvider(provider) && typeof origin === 'string' && (/^https:\/\/[^/@]+$/.test(origin) || (provider === 'local' && /^http:\/\/[^/@]+$/.test(origin)))) out[provider] = origin;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeKeys(userData: string, keys: KeyFileKeys, origins: Partial<Record<KeyFileProvider, string>> = {}): void {
  const file = keyFilePath(userData);
  if (Object.keys(keys).length === 0) {
    removeKeyFile(userData);
    return;
  }
  const kept = Object.fromEntries(Object.entries(origins).filter(([provider]) => provider in keys));
  fs.mkdirSync(userData, { recursive: true });
  // Old file or whole new one: a full disk while adding a key never loses the keys already saved.
  writeFileAtomic(file, JSON.stringify({ version: 2, keys, ...(Object.keys(kept).length > 0 ? { origins: kept } : {}) }), { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Not every file system keeps modes; the write above already asked for owner-only.
  }
}

/**
 * Writes the key for `provider`, keeping the other providers' keys; the file stays owner-only. `origin`: the
 * address the key belongs to when it is not the official one.
 */
export function writeKeyFile(userData: string, provider: KeyFileProvider, key: string, origin?: string | null): void {
  const origins = readKeyFileOrigins(userData);
  delete origins[provider];
  if (origin) origins[provider] = origin;
  writeKeys(userData, { ...readKeyFile(userData), [provider]: key }, origins);
}

/** Removes one provider's key; the file goes away when no key is left. */
export function removeKeyFromFile(userData: string, provider: KeyFileProvider): void {
  const keys = readKeyFile(userData);
  if (!(provider in keys)) return;
  delete keys[provider];
  writeKeys(userData, keys, readKeyFileOrigins(userData));
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
