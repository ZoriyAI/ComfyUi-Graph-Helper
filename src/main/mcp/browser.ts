/**
 * Opens the MCP sign-in page in the person's own browser, for the OAuth login (mcp/oauth.ts).
 * ipc.ts passes browserOpener() to configureMcpOAuth. The e2e tests swap in a stand-in that follows the
 * redirects itself, but only in an unpackaged test run, so a shipped app always uses the real browser.
 */
import { app, shell } from 'electron';
import { testSwitchesAllowed } from '../runMode';

/** Env flag the e2e build sets; honoured only in an unpackaged app with NODE_ENV 'test'. */
export const TEST_BROWSER_FLAG = 'NODEWISE_TEST_BROWSER';

/** Only http(s) addresses are handed to the browser: a server could otherwise name a file: or app scheme. */
function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * TEST ONLY stand-in for the system browser: GETs the authorization URL and follows its redirects (at most five)
 * the way a browser would, which ends at the app's loopback callback. Only for NODE_ENV=test with the flag set.
 */
async function followLikeABrowser(start: string): Promise<void> {
  let current = start;
  for (let hop = 0; hop < 5; hop += 1) {
    const response = await fetch(current, { redirect: 'manual' });
    await response.arrayBuffer().catch(() => undefined);
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) return;
    current = new URL(location, current).toString();
  }
}

/**
 * How the OAuth login opens the authorization page: the system browser through shell.openExternal, never a
 * window of this app (the app's own pages may not navigate away; see index.ts).
 */
export function browserOpener(env: NodeJS.ProcessEnv = process.env, packaged: boolean = app?.isPackaged ?? true): (url: string) => Promise<void> {
  if (testSwitchesAllowed(packaged, env) && env[TEST_BROWSER_FLAG] === 'follow-redirects') {
    return async (url) => {
      if (!isWebUrl(url)) throw new Error('not a web URL');
      void followLikeABrowser(url).catch(() => undefined);
    };
  }
  return async (url) => {
    if (!isWebUrl(url)) throw new Error('not a web URL');
    await shell.openExternal(url);
  };
}
