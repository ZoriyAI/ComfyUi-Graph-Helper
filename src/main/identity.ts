/**
 * How the app names itself, for the main process: window, dialogs, desktop entry, profile folder, user agents,
 * MCP clientInfo and the update check all take their names from here (main/index.ts, cli.ts, diagnostics.ts,
 * agent/web.ts, knowledge/webLookup.ts, mcp/client.ts, mcp/oauth.ts, ipc/aboutIpc.ts, updates/updateIpc.ts).
 *
 * The spellings themselves live in src/shared/productNames.ts (the renderer's texts need them too and cannot import
 * main-process code); this module re-exports them so main-process code has one place to read every name from.
 *
 * People read DISPLAY_NAME. Machines read APP_ID (MCP clientInfo in mcp/client.ts, the .deb / .rpm package, the
 * executable, the desktop file and icons) and STABLE_APP_NAME, the name Electron runs under: it names the profile
 * folder ~/.config/nodewise-studio and the OS keyring entry ("nodewise-studio Safe Storage") the saved keys are
 * encrypted under. It changed once, for 1.0 (from the 0.x profile name in src/shared/legacyNames.ts):
 * src/main/profileAdoption.ts moves the old folder over on the first start; keys the keyring encrypted under the
 * old name do not open under the new one and are entered again. Do not change it again: every change costs people
 * their saved keys.
 *
 * No Electron import here, so unit tests can load every module that names the app.
 */
import * as fs from 'fs';
import * as path from 'path';

export { APP_ID, DISPLAY_NAME, SHORT_NAME, USER_AGENT_PRODUCT } from '../shared/productNames';
import { APP_ID, USER_AGENT_PRODUCT } from '../shared/productNames';
/** The name Electron runs under; it names the profile folder and the keyring entry (see the header). */
export const STABLE_APP_NAME = APP_ID;

/**
 * The public project address (the repository on GitHub): the one constant for it. package.json (repository,
 * homepage, bugs), the issue forms' config and the README badges repeat it, and tests/unit/identity.test.ts
 * compares them. The repository still has its pre-1.0 name; when the owner renames it, change this value and the
 * test lists every copy to follow. A placeholder value (`OWNER/REPOSITORY`) greys the project links out and stops
 * the update check.
 */
export const PROJECT_URL = 'https://github.com/ZoriyAI/ComfyUi-Graph-Helper';

/** False while PROJECT_URL is the placeholder: no link to a project page is offered or sent. */
export function projectUrlIsSet(url: string = PROJECT_URL): boolean {
  return /^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(url)
    && !url.includes('PLACEHOLDER') && !url.endsWith('/OWNER/REPOSITORY');
}

/** The pages the app can open in the browser: the project, its releases and a new issue. */
export function projectLinks(url: string = PROJECT_URL): { site: string; releases: string; issues: string; newIssue: string } | null {
  if (!projectUrlIsSet(url)) return null;
  return { site: url, releases: `${url}/releases`, issues: `${url}/issues`, newIssue: `${url}/issues/new` };
}

let cachedVersion: string | null = null;

/** The app's version from its package.json (dist/main sits two levels under it, packaged or not). */
export function appVersion(): string {
  if (cachedVersion) return cachedVersion;
  for (const file of [path.join(__dirname, '..', '..', 'package.json'), path.join(__dirname, '..', 'package.json')]) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { name?: unknown; version?: unknown };
      // The name check skips a package.json of some other package that happens to sit at that place.
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
  const site = projectUrlIsSet() ? `+${PROJECT_URL}; ` : '';
  return `${USER_AGENT_PRODUCT}/${appVersion()} (${site}read-only; ${purpose})`;
}

/**
 * Whether the app must rename itself to STABLE_APP_NAME and use ~/.config/STABLE_APP_NAME as its profile (and so
 * whether the 0.x profile may be adopted: src/main/profileAdoption.ts).
 * Electron names the app after package.json productName whenever package.json is in effect (installed, or
 * `electron .`); a bare script launch (some tests) keeps Electron's own name "Electron" and its own folder.
 * The rule does not depend on the display name, so a later change of productName cannot move the profile.
 */
export function usesStableProfile(currentName: string, isPackaged: boolean): boolean {
  return isPackaged || currentName !== 'Electron';
}
