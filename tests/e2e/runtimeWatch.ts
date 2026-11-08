import { expect, type ElectronApplication, type Page } from '@playwright/test';

const LOCAL_SCHEME = /^(file:|devtools:|data:|blob:)/i;

export type RuntimeWatch = {
  requests: string[];
  errors: string[];
  warnings: string[];
  pageErrors: string[];
};

type MainWatch = { urls: string[]; failures: string[] };

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
  watch.requests.push(...await resourceUrls(window));
  return watch;
}

async function resourceUrls(window: Page): Promise<string[]> {
  return window.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
}

export async function readLocalFont(window: Page) {
  return window.evaluate(async () => {
    const label = document.querySelector('.app-title');
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

export function logLocalFont(font: Awaited<ReturnType<typeof readLocalFont>>) {
  expect(font.missing).toBe(false);
  if (font.missing) return;
  expect(font.size).toBe('14px');
  expect(font.family).toContain('Geist');
  expect(font.checkLabel).toBe(true);
  expect(font.geist400).toBe('loaded');
  expect(font.geist600).toBe('loaded');
  expect(font.checkCyrillic).toBe(true);
  expect(font.cyrillic).toBe('loaded');
  console.log(`FONT_LOCAL geist-400=${font.geist400} geist-600=${font.geist600} label=${font.family} ${font.size}`);
  console.log(`FONT_CYRILLIC geist-cyrillic=${font.cyrillic} range=${font.cyrillicRange}`);
}

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
