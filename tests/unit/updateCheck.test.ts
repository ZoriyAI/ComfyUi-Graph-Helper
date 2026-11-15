/**
 * Protects the optional update check: off until the person turns it on in Settings, at most one GitHub request a day
 * (an hour after a failure), only published releases of this project are trusted, and the download link fits how
 * the app was installed (.deb, .rpm, AppImage or tarball). A person who did not opt in sends nothing, and one who did
 * is never sent to a file from another site.
 */
import { describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  CHECK_INTERVAL_MS,
  RETRY_AFTER_FAILURE_MS,
  compareVersions,
  createUpdateChecker,
  githubRepository,
  installKind,
  parseRelease,
  pickDownload,
  readCheckState,
  releasesApiUrl,
} from '../../src/main/updates/updateCheck';
import { parsePreferences } from '../../src/shared/config/preferences';
import { PROJECT_URL } from '../../src/main/identity';
import { noticeOf } from '../../src/renderer/components/shell/UpdateNotice';

const PROJECT = 'https://github.com/example-owner/nodewise-studio';

/** A GitHub release answer with one file of each install kind, plus one hosted elsewhere that must be ignored. */
function release(tag: string, extra: Record<string, unknown> = {}) {
  return {
    tag_name: tag,
    html_url: `${PROJECT}/releases/tag/${tag}`,
    draft: false,
    prerelease: false,
    assets: [
      { name: `nodewise-studio_${tag.slice(1)}_amd64.deb`, browser_download_url: `${PROJECT}/releases/download/${tag}/nodewise-studio_${tag.slice(1)}_amd64.deb` },
      { name: `nodewise-studio-${tag.slice(1)}-1.x86_64.rpm`, browser_download_url: `${PROJECT}/releases/download/${tag}/nodewise-studio-${tag.slice(1)}-1.x86_64.rpm` },
      { name: `nodewise-studio-${tag.slice(1)}-x86_64.AppImage`, browser_download_url: `${PROJECT}/releases/download/${tag}/nodewise-studio-${tag.slice(1)}-x86_64.AppImage` },
      { name: `nodewise-studio-${tag.slice(1)}-linux-x64.tar.gz`, browser_download_url: `${PROJECT}/releases/download/${tag}/nodewise-studio-${tag.slice(1)}-linux-x64.tar.gz` },
      { name: 'elsewhere.deb', browser_download_url: 'https://example.com/elsewhere_amd64.deb' },
    ],
    ...extra,
  };
}

function answer(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function setup(options: { enabled?: boolean; fetch?: typeof fetch; now?: () => number; current?: string; projectUrl?: string } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-check-'));
  const stateFile = path.join(dir, 'update-check.json');
  const fetchMock = vi.fn(options.fetch ?? (async () => answer(release('v1.2.0'))));
  const checker = createUpdateChecker({
    projectUrl: options.projectUrl ?? PROJECT,
    currentVersion: options.current ?? '1.1.0',
    enabled: () => options.enabled ?? true,
    stateFile,
    fetch: fetchMock as unknown as typeof fetch,
    userAgent: 'NodeWiseStudio/1.1.0 (+read-only; update check)',
    kind: 'deb',
    now: options.now,
  });
  return { checker, fetchMock, stateFile };
}

describe('update check: off unless the person turns it on', () => {
  it('is off by default in the preferences', () => {
    expect(parsePreferences({}).privacy.checkUpdates).toBe(false);
  });

  it('asks nothing while the switch is off', async () => {
    const { checker, fetchMock } = setup({ enabled: false });
    expect(await checker.status()).toEqual({ state: 'off' });
    expect(checker.linkFor('download')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks nothing while the project address is the placeholder', async () => {
    const { checker, fetchMock } = setup({ projectUrl: 'https://github.com/OWNER/REPOSITORY' });
    expect(await checker.status()).toEqual({ state: 'off' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads the project address from identity.ts', () => {
    expect(PROJECT_URL.startsWith('https://github.com/')).toBe(true);
  });
});

describe('update check: once a day', () => {
  it('asks the latest-release API with the app user agent and shows a newer version', async () => {
    const { checker, fetchMock } = setup();
    expect(await checker.status()).toEqual({ state: 'available', notice: { version: '1.2.0' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/example-owner/nodewise-studio/releases/latest');
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('update check');
  });

  it('does not ask again within a day, and asks again after one', async () => {
    let clock = 1_000_000_000_000;
    const { checker, fetchMock } = setup({ now: () => clock });
    await checker.status();
    clock += CHECK_INTERVAL_MS - 1;
    await checker.status();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    clock += 2;
    await checker.status();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('says current when the newest release is this version or older', async () => {
    const { checker } = setup({ current: '1.2.0' });
    expect(await checker.status()).toEqual({ state: 'current' });
    const older = setup({ current: '2.0.0' });
    expect(await older.checker.status()).toEqual({ state: 'current' });
  });

  it('treats "no release yet" as current and a failure as a retry in an hour', async () => {
    let clock = 5_000_000_000_000;
    const none = setup({ fetch: async () => answer({ message: 'Not Found' }, 404), now: () => clock });
    expect(await none.checker.status()).toEqual({ state: 'current' });
    expect(readCheckState(none.stateFile).checkedAt).toBe(clock);

    const offline = setup({ fetch: async () => { throw new Error('offline'); }, now: () => clock });
    expect(await offline.checker.status()).toEqual({ state: 'current' });
    clock += RETRY_AFTER_FAILURE_MS - 1;
    await offline.checker.status();
    expect(offline.fetchMock).toHaveBeenCalledTimes(1);
    clock += 2;
    await offline.checker.status();
    expect(offline.fetchMock).toHaveBeenCalledTimes(2);
  });

  it('closing the notice hides this version until a later one', async () => {
    let clock = 7_000_000_000_000;
    let tag = 'v1.2.0';
    const { checker } = setup({ now: () => clock, fetch: async () => answer(release(tag)) });
    await checker.status();
    checker.dismiss('1.2.0');
    expect(await checker.status()).toEqual({ state: 'current' });
    tag = 'v1.3.0';
    clock += CHECK_INTERVAL_MS;
    expect(await checker.status()).toEqual({ state: 'available', notice: { version: '1.3.0' } });
  });

  it('opens only this project\'s release page and the file for this install', async () => {
    const { checker } = setup();
    await checker.status();
    expect(checker.linkFor('notes')).toBe(`${PROJECT}/releases/tag/v1.2.0`);
    expect(checker.linkFor('download')).toBe(`${PROJECT}/releases/download/v1.2.0/nodewise-studio_1.2.0_amd64.deb`);
  });
});

describe('update check: reading the answer', () => {
  it('compares versions by number, a release above its pre-release', () => {
    expect(compareVersions('1.2.10', '1.2.9')).toBe(1);
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.0', '1.0.0-rc.1')).toBe(1);
    expect(compareVersions('0.9.0', '1.0.0')).toBe(-1);
    expect(compareVersions('nonsense', '1.0.0')).toBe(0);
  });

  it('accepts only a published release of this project with links under its releases', () => {
    expect(parseRelease(release('v1.2.0'), PROJECT)?.version).toBe('1.2.0');
    expect(parseRelease(release('v1.2.0'), PROJECT)?.assets.some((asset) => asset.url.includes('example.com'))).toBe(false);
    expect(parseRelease(release('v1.2.0', { draft: true }), PROJECT)).toBeNull();
    expect(parseRelease(release('v1.2.0', { prerelease: true }), PROJECT)).toBeNull();
    expect(parseRelease(release('v1.2.0', { html_url: 'https://evil.example/releases/tag/v1.2.0' }), PROJECT)).toBeNull();
    expect(parseRelease(release('latest'), PROJECT)).toBeNull();
    expect(parseRelease(null, PROJECT)).toBeNull();
  });

  it('names the API address only for a real github.com repository', () => {
    expect(releasesApiUrl(`${PROJECT}/`)).toBe('https://api.github.com/repos/example-owner/nodewise-studio/releases/latest');
    expect(releasesApiUrl('https://gitlab.com/a/b')).toBeNull();
    expect(releasesApiUrl('http://github.com/a/b')).toBeNull();
    expect(githubRepository('https://github.com/a')).toBeNull();
  });

  it('picks the file of the same kind as this install', () => {
    const facts = parseRelease(release('v1.2.0'), PROJECT)!;
    expect(pickDownload(facts.assets, 'rpm', 'x64')).toMatch(/\.x86_64\.rpm$/);
    expect(pickDownload(facts.assets, 'appimage', 'x64')).toMatch(/\.AppImage$/);
    expect(pickDownload(facts.assets, 'tarball', 'x64')).toMatch(/-linux-x64\.tar\.gz$/);
    expect(pickDownload(facts.assets, 'deb', 'arm64')).toBeNull();
    expect(pickDownload(facts.assets, null, 'x64')).toBeNull();
  });

  it('tells the kind of install from where the program runs', () => {
    const files = new Set<string>();
    const exists = (file: string) => files.has(file);
    // AppImage sets $APPIMAGE; the tarball installer leaves run.sh and uninstall.sh; a dpkg file list means .deb;
    // /usr/lib without one is .rpm; a development run is none of them.
    expect(installKind('/tmp/x/nodewise-studio', { APPIMAGE: '/var/tmp/person/app.AppImage' }, exists, 'nodewise-studio')).toBe('appimage');
    files.add('/var/tmp/person/.local/share/nodewise-studio/run.sh');
    files.add('/var/tmp/person/.local/share/nodewise-studio/uninstall.sh');
    expect(installKind('/var/tmp/person/.local/share/nodewise-studio/nodewise-studio', {}, exists, 'nodewise-studio')).toBe('tarball');
    expect(installKind('/usr/lib/nodewise-studio/nodewise-studio', {}, exists, 'nodewise-studio')).toBe('rpm');
    files.add('/var/lib/dpkg/info/nodewise-studio.list');
    expect(installKind('/usr/lib/nodewise-studio/nodewise-studio', {}, exists, 'nodewise-studio')).toBe('deb');
    expect(installKind('/repo/node_modules/electron/dist/electron', {}, exists, 'nodewise-studio')).toBeNull();
  });

  it('the window shows a line only for an available version', () => {
    expect(noticeOf(null)).toBeNull();
    expect(noticeOf({ state: 'off' })).toBeNull();
    expect(noticeOf({ state: 'current' })).toBeNull();
    expect(noticeOf({ state: 'available', notice: { version: '2.0.0' } })).toEqual({ version: '2.0.0' });
  });
});
