/**
 * The built page is served as `app://bundle/…` instead of `file://…`. On a file: page Chromium's CSP `'self'`
 * matches every file: URL on the disk; on this scheme `'self'` is the bundle folder and nothing else, and the
 * handler below serves only files inside that folder. main/index.ts registers the scheme and its handler.
 */
import * as path from 'path';
import { pathToFileURL } from 'url';

// The scheme, its one host and the page the window loads.
export const APP_SCHEME = 'app';
export const APP_HOST = 'bundle';
export const APP_ENTRY = `${APP_SCHEME}://${APP_HOST}/index.html`;

/** The scheme's privileges; registered before the app is ready (protocol.registerSchemesAsPrivileged). */
export const APP_SCHEME_PRIVILEGES = { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false, stream: true } as const;

/**
 * The file inside `bundleDir` an `app://bundle/<path>` request names, or null for any other host, a path that leaves
 * the folder (`..`, encoded or not), a NUL, or a folder itself.
 */
export function bundleFileFor(bundleDir: string, requestUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.protocol !== `${APP_SCHEME}:` || url.host !== APP_HOST) return null;
  let relative: string;
  try {
    relative = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  // A backslash is refused too, so a path means the same thing on every system.
  if (relative.includes('\0') || relative.includes('\\')) return null;
  const root = path.resolve(bundleDir);
  const file = path.resolve(root, `.${relative.startsWith('/') ? relative : `/${relative}`}`);
  // Resolved first, then compared: a `..` that climbs out of the folder lands outside `root` and is refused.
  if (file === root || !file.startsWith(`${root}${path.sep}`)) return null;
  return file;
}

/** The file: URL to hand to net.fetch for a bundle file. */
export function bundleFileUrl(file: string): string {
  return pathToFileURL(file).href;
}
