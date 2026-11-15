/**
 * Runtime watch for e2e specs: records every network request, console error or warning, page error and unhandled
 * rejection in the main process, then fails the spec on anything unexpected. It also checks that the local Geist
 * font (with its Cyrillic range) really loaded. Used by desktop-captures and workspace-motion.
 * It protects the promise that the app works offline: nothing may reach a remote host unless the spec allows it.
 */
import { expect, type ElectronApplication, type Page } from '@playwright/test';

// The built page and its assets are served from the app's own scheme; nothing else under app: is local.
const LOCAL_SCHEME = /^(file:|devtools:|data:|blob:|app:\/\/bundle\/)/i;

/** What the page side saw: requested URLs, console errors and warnings, and thrown page errors. */
export type RuntimeWatch = {
  requests: string[];
  errors: string[];
  warnings: string[];
  pageErrors: string[];
};

// What the main side saw; kept on `global` in main so a second attach does not hook twice.
type MainWatch = { urls: string[]; failures: string[] };

/**
 * Starts recording in the page and in main. Main is watched at two levels: session requests (the window's own loads)
 * and a wrapped global fetch (requests main makes itself, which the session does not see).
 */
export async function attachRuntimeWatch(electronApp: ElectronApplication, window: Page): Promise<RuntimeWatch> {
  const watch: RuntimeWatch = { requests: [], errors: [], warnings: [], pageErrors: [] };
  window.on('request', (request) => {
    watch.requests.push(request.url());
  });
  window.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error') watch.errors.push(text);
    if (message.type() === 'warning') watch.warnings.push(text);
  });
  window.on('pageerror', (error) => {
    watch.pageErrors.push(error instanceof Error ? error.message : String(error));
  });
  await electronApp.evaluate(({ session }) => {
    const holder = global as typeof globalThis & { __runtimeWatch?: MainWatch };
    if (holder.__runtimeWatch) return;
    const urls: string[] = [];
    const failures: string[] = [];
    holder.__runtimeWatch = { urls, failures };
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
      urls.push(details.url);
      callback({});
    });
    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      urls.push(url);
      return originalFetch(input, init);
    };
    process.on('unhandledRejection', (reason) => {
      failures.push(reason instanceof Error ? `unhandledRejection ${reason.message}` : `unhandledRejection ${String(reason)}`);
    });
    process.on('uncaughtException', (error) => {
      failures.push(`uncaughtException ${error.message}`);
    });
  });
  // Resources loaded before the listeners were attached only show in the performance timeline.
  watch.requests.push(...await resourceUrls(window));
  return watch;
}

async function resourceUrls(window: Page): Promise<string[]> {
  return window.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
}

/**
 * Reads which Geist faces the page loaded and whether the face covering Cyrillic is in use. A hidden probe with
 * Russian text forces the browser to load the Cyrillic range, which it would otherwise load lazily.
 */
export async function readLocalFont(window: Page) {
  return window.evaluate(async () => {
    // The menu bar's first menu title: the shell's own text since the app bar became a menu bar.
    const label = document.querySelector('.document-bar [role="menuitem"]');
    if (!(label instanceof HTMLElement)) return { missing: true as const };
    const style = getComputedStyle(label);
    const sample = (label.textContent || 'A').trim() || 'A';
    const probe = document.createElement('span');
    probe.textContent = 'Проект';
    probe.setAttribute('data-font-probe', 'cyrillic');
    probe.style.fontFamily = '"Geist", system-ui, sans-serif';
    probe.style.fontSize = '14px';
    probe.style.fontWeight = '400';
    probe.style.position = 'absolute';
    probe.style.left = '-9999px';
    document.body.appendChild(probe);
    await document.fonts.load('600 14px "Geist"', sample);
    await document.fonts.load('400 14px "Geist"', 'A');
    const cyrillicFaces = await document.fonts.load('400 14px "Geist"', 'Проект');
    await document.fonts.ready;
    const faces = [...document.fonts].filter((face) => face.family.replace(/["']/g, '') === 'Geist');
    const loadedWeight = (weight: string) => faces.some((face) => String(face.weight) === weight && face.status === 'loaded');
    const coversCyrillic = (range: string) => /U\+0*400(?:-0*4[0-9A-F]{2})?/i.test(range);
    const ranged = cyrillicFaces.filter((face) => coversCyrillic(face.unicodeRange) && face.status === 'loaded');
    const declared = cyrillicFaces.filter((face) => face.status === 'loaded');
    probe.remove();
    return {
      missing: false as const,
      family: style.fontFamily,
      size: style.fontSize,
      weight: style.fontWeight,
      geist400: loadedWeight('400') ? 'loaded' : 'missing',
      geist600: loadedWeight('600') ? 'loaded' : 'missing',
      checkLabel: document.fonts.check('600 14px "Geist"', sample),
      checkCyrillic: document.fonts.check('400 14px "Geist"', 'Проект'),
      cyrillic: ranged.length > 0 ? 'loaded' : declared.length > 0 ? 'declared-fallback' : 'not-loaded',
      cyrillicRange: (ranged[0] ?? declared[0])?.unicodeRange ?? '',
    };
  });
}

/** Asserts the font facts from readLocalFont and prints them as FONT_* lines for the run log. */
export function logLocalFont(font: Awaited<ReturnType<typeof readLocalFont>>) {
  expect(font.missing).toBe(false);
  if (font.missing) return;
  expect(font.size).toBe('13px');
  expect(font.family).toContain('Geist');
  expect(font.checkLabel).toBe(true);
  expect(font.geist400).toBe('loaded');
  expect(font.geist600).toBe('loaded');
  expect(font.checkCyrillic).toBe(true);
  expect(font.cyrillic).toBe('loaded');
  console.log(`FONT_LOCAL geist-400=${font.geist400} geist-600=${font.geist600} label=${font.family} ${font.size}`);
  console.log(`FONT_CYRILLIC geist-cyrillic=${font.cyrillic} range=${font.cyrillicRange}`);
}

/**
 * Collects what both sides saw and fails on any remote URL or console message that `allowed` does not list.
 * Each allowance carries a reason, printed in the run log, so an exception never passes silently.
 */
export async function finishRuntime(
  electronApp: ElectronApplication,
  window: Page,
  watch: RuntimeWatch,
  allowed: { console: Array<{ text: string; reason: string }>; remotePrefix: Array<{ prefix: string; reason: string }> },
) {
  const main = await electronApp.evaluate(() => {
    const holder = global as typeof globalThis & { __runtimeWatch?: MainWatch };
    return holder.__runtimeWatch ?? { urls: [], failures: [] };
  });
  const urls = [...watch.requests, ...await resourceUrls(window), ...main.urls];
  const remote = [...new Set(urls.filter((url) => !LOCAL_SCHEME.test(url)))];
  const allowedRemote = remote.filter((url) => allowed.remotePrefix.some((item) => url.startsWith(item.prefix)));
  const unexpectedRemote = remote.filter((url) => !allowed.remotePrefix.some((item) => url.startsWith(item.prefix)));
  console.log(`NETWORK_REMOTE ${unexpectedRemote.length}${unexpectedRemote.length ? ` ${unexpectedRemote.join(' ')}` : ''}`);
  for (const url of allowedRemote) {
    const rule = allowed.remotePrefix.find((item) => url.startsWith(item.prefix));
    console.log(`NETWORK_ALLOWED ${url} reason=${rule?.reason ?? ''}`);
  }
  const allow = new Set(allowed.console.map((item) => item.text));
  const unexpectedErrors = watch.errors.filter((text) => !allow.has(text));
  const unexpectedWarnings = watch.warnings.filter((text) => !allow.has(text));
  for (const item of allowed.console) {
    const count = watch.errors.filter((text) => text === item.text).length + watch.warnings.filter((text) => text === item.text).length;
    if (count > 0) console.log(`CONSOLE_ALLOWED ${count} ${item.text} reason=${item.reason}`);
  }
  console.log(`CONSOLE_CLEAN errors=${unexpectedErrors.length} warnings=${unexpectedWarnings.length} pageerror=${watch.pageErrors.length} rejections=${main.failures.length}`);
  expect(unexpectedRemote).toEqual([]);
  expect(unexpectedErrors).toEqual([]);
  expect(unexpectedWarnings).toEqual([]);
  expect(watch.pageErrors).toEqual([]);
  expect(main.failures).toEqual([]);
}
