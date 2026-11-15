import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const { isAppPageUrl } = createRequire(import.meta.url)('../../scripts/lib/cdp-launch.js');

const legacyRenderer = '/usr/lib/comfyui-graph-builder/resources/app.asar/dist/renderer/index.html';
const legacyUrl = pathToFileURL(legacyRenderer).href;

describe('packaged CDP page selection', () => {
  it('keeps normal package and upgrade verification checks on app://', () => {
    expect(isAppPageUrl('app://graph-helper/index.html')).toBe(true);
    expect(isAppPageUrl(legacyUrl)).toBe(false);
    expect(isAppPageUrl('about:blank')).toBe(false);
    expect(isAppPageUrl('http://localhost:5173/')).toBe(false);
  });

  it('allows the exact installed legacy renderer only when upgrade preparation opts in', () => {
    expect(isAppPageUrl(legacyUrl, legacyRenderer)).toBe(true);
    expect(isAppPageUrl('app://graph-helper/index.html', legacyRenderer)).toBe(true);
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
