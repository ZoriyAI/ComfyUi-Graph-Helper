import { shell } from 'electron';

/** Env flag the e2e build sets; honoured only when NODE_ENV is 'test'. */
export const TEST_BROWSER_FLAG = 'GRAPH_HELPER_TEST_BROWSER';

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
export function browserOpener(env: NodeJS.ProcessEnv = process.env): (url: string) => Promise<void> {
  if (env.NODE_ENV === 'test' && env[TEST_BROWSER_FLAG] === 'follow-redirects') {
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
