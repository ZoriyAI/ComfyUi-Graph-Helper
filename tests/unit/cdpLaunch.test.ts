/**
 * Protects how scripts/lib/cdp-launch.js picks the app page when the package smoke scripts drive the installed app over
 * the Chrome DevTools protocol: normally only the app:// page, and the exact file of an older installed renderer
 * only when an upgrade check asks for it. Picking a wrong page would make a release check pass on the wrong window.
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const { isAppPageUrl } = createRequire(import.meta.url)('../../scripts/lib/cdp-launch.js');

/** Where an older package installed its renderer, which it loaded from a file URL instead of app://. */
const legacyRenderer = '/usr/lib/nodewise-studio/resources/app.asar/dist/renderer/index.html';
const legacyUrl = pathToFileURL(legacyRenderer).href;

describe('packaged CDP page selection', () => {
  it('keeps normal package and upgrade verification checks on app://', () => {
    expect(isAppPageUrl('app://nodewise/index.html')).toBe(true);
    expect(isAppPageUrl(legacyUrl)).toBe(false);
    expect(isAppPageUrl('about:blank')).toBe(false);
    expect(isAppPageUrl('http://localhost:5173/')).toBe(false);
  });

  it('allows the exact installed legacy renderer only when upgrade preparation opts in', () => {
    expect(isAppPageUrl(legacyUrl, legacyRenderer)).toBe(true);
    expect(isAppPageUrl('app://nodewise/index.html', legacyRenderer)).toBe(true);
    for (const url of ['file:///tmp/index.html', `${legacyUrl}.other`, `${legacyUrl}?other=1`, `${legacyUrl}#other`, 'about:blank']) {
      expect(isAppPageUrl(url, legacyRenderer)).toBe(false);
    }
  });

  it('uses Node file URL escaping for the exact installation path', () => {
    const renderer = '/tmp/installed app #1/resources/app.asar/dist/renderer/index.html';
    expect(isAppPageUrl(pathToFileURL(renderer).href, renderer)).toBe(true);
    expect(isAppPageUrl(`file://${renderer}`, renderer)).toBe(false);
  });
});
