/**
 * The MCP token remembered in a plain file, by the person's explicit choice, on a computer without a password
 * store the app can use. The file is readable by this user only (mode 0600) and holds the token for one MCP
 * origin. Nothing else in the app reads or writes it; its content is never logged, exported or shown back.
 * Used by ipc.ts (save, remove and status of the MCP token) and settings/forgetAll.ts.
 */
import * as fs from 'fs';
import * as path from 'path';
import { writeFileAtomic } from '../files/atomicWrite';

/** The file name in the profile folder. */
export const TOKEN_FILE = 'mcp-token.json';

export function tokenFilePath(userData: string): string {
  return path.join(userData, TOKEN_FILE);
}

/** The token and the origin it is for; null for no file, a damaged one, or one that does not look like a token. */
export function readTokenFile(userData: string): { origin: string; token: string } | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(tokenFilePath(userData), 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const { origin, token } = parsed as { origin?: unknown; token?: unknown };
    if (typeof origin !== 'string' || typeof token !== 'string' || origin === '' || token === '' || token.length > 8000) return null;
    return { origin, token };
  } catch {
    return null;
  }
}

/** Writes the token for `origin`; the file is created or replaced with owner-only permissions. */
export function writeTokenFile(userData: string, origin: string, token: string): void {
  const file = tokenFilePath(userData);
  fs.mkdirSync(userData, { recursive: true });
  writeFileAtomic(file, JSON.stringify({ version: 1, origin, token }), { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Not every file system keeps modes; the write above already asked for owner-only.
  }
}

/** Deletes the file; true when there was one. */
export function removeTokenFile(userData: string): boolean {
  try {
    fs.unlinkSync(tokenFilePath(userData));
    return true;
  } catch {
    return false;
  }
}

/** Whether the file holds a token for this origin (never the token itself). */
export function tokenFileHolds(userData: string, origin: string | null): boolean {
  if (!origin) return false;
  return readTokenFile(userData)?.origin === origin;
}
