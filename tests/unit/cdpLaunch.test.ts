/**
 * Protects how scripts/lib/cdp-launch.js picks the app page when the package smoke scripts drive the installed app
 * over the Chrome DevTools protocol: normally only the app:// page, and the exact file of an older installed
 * renderer only when an upgrade check asks for it. Picking a wrong page would make a release check pass on the wrong window.
 * Also protects which DevToolsActivePort it trusts: only one written by this start, never the one an earlier run left
 * in a profile folder the app takes over (the 0.x upgrade check failed on that stale port).
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const { isAppPageUrl, readFreshPort } = createRequire(import.meta.url)('../../scripts/lib/cdp-launch.js');

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

describe('DevToolsActivePort freshness', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  /** A port file as Chromium writes it, with its modification time set to `writtenAt`. */
  function portFile(content: string, writtenAt: number): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-port-'));
    dirs.push(dir);
    const file = path.join(dir, 'DevToolsActivePort');
    fs.writeFileSync(file, content);
    fs.utimesSync(file, writtenAt / 1000, writtenAt / 1000);
    return file;
  }

  it('takes the port Chromium wrote during this start', () => {
    const startedAt = Date.now();
    expect(readFreshPort(portFile('45429\n/devtools/browser/abc\n', startedAt + 400), startedAt)).toBe('45429');
  });

  it('ignores the port an earlier run left in a profile folder taken over at start', () => {
    const startedAt = Date.now();
    // upgrade-prepare ran 0.9.0 on this folder seconds before; the new app renamed it into place with the file.
    expect(readFreshPort(portFile('42039\n/devtools/browser/old\n', startedAt - 8000), startedAt)).toBe('');
  });

  it('waits on a missing or half-written file', () => {
    const startedAt = Date.now();
    expect(readFreshPort(path.join(os.tmpdir(), 'no-such-folder', 'DevToolsActivePort'), startedAt)).toBe('');
    expect(readFreshPort(portFile('', startedAt + 100), startedAt)).toBe('');
  });

  it('counts a file from the same second on file systems with whole-second times', () => {
    const startedAt = Math.floor(Date.now() / 1000) * 1000 + 700;
    expect(readFreshPort(portFile('40001\n', startedAt - 700), startedAt)).toBe('40001');
  });
});
