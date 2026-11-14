import * as fs from 'fs';
import * as path from 'path';

/**
 * How the app names itself.
 *
 * People read DISPLAY_NAME (window, desktop entry, dialogs, the server's sign-in page). Machines read APP_ID
 * (MCP clientInfo in mcp/client.ts, user agents) and STABLE_APP_NAME (the profile folder ~/.config/comfyui-graph-builder and the
 * OS keyring entry the saved keys are encrypted under; also the deb package and the executable). STABLE_APP_NAME
 * must never change: an update would open an empty profile and could not decrypt the saved keys.
 *
 * No Electron import here, so unit tests can load every module that names the app.
 */
export const DISPLAY_NAME = 'Graph Helper for ComfyUI';
export const APP_ID = 'graph-helper-for-comfyui';
export const STABLE_APP_NAME = 'comfyui-graph-builder';

let cachedVersion: string | null = null;

/** The app's version from its package.json (dist/main sits two levels under it, packaged or not). */
export function appVersion(): string {
  if (cachedVersion) return cachedVersion;
  for (const file of [path.join(__dirname, '..', '..', 'package.json'), path.join(__dirname, '..', 'package.json')]) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { name?: unknown; version?: unknown };
      if (parsed.name === STABLE_APP_NAME && typeof parsed.version === 'string') {
        cachedVersion = parsed.version;
        return cachedVersion;
      }
    } catch {
      // Not there; the next place is tried.
    }
  }
  return '0.0.0';
}

/** The user agent for one kind of outbound read. */
export function userAgent(purpose: string): string {
  return `GraphHelperForComfyUI/${appVersion()} (+read-only; ${purpose})`;
}

/**
 * Whether the app must rename itself to STABLE_APP_NAME and use ~/.config/STABLE_APP_NAME as its profile.
 * Electron names the app after package.json productName whenever package.json is in effect (installed, or
 * `electron .`); a bare script launch (some tests) keeps Electron's own name "Electron" and its own folder.
 * The rule does not depend on the display name, so a later change of productName cannot move the profile.
 */
export function usesStableProfile(currentName: string, isPackaged: boolean): boolean {
  return isPackaged || currentName !== 'Electron';
}
