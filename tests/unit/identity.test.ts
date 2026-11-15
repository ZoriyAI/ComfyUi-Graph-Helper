/**
 * The app's identity (src/main/identity.ts, read by main/index.ts at start, the MCP client, the About IPC and the
 * web readers): the stable name that picks the profile folder and keyring entry, the display name, the version sent
 * to servers, and the one project address shared by package.json, the issue forms and the READMEs. A silent change
 * of the stable name would leave a person with an empty profile and lost saved keys.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { APP_ID, DISPLAY_NAME, PROJECT_URL, SHORT_NAME, STABLE_APP_NAME, appVersion, projectLinks, projectUrlIsSet, userAgent, usesStableProfile } from '../../src/main/identity';
import { mcpClientInfo, setMcpClientVersion } from '../../src/main/mcp/client';

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')) as Record<string, unknown>;

describe('app identity', () => {
  it('runs under the 1.0 name: profile folder, package and executable', () => {
    // The profile folder ~/.config/nodewise-studio and the keyring entry depend on it. It changed once, for 1.0
    // (src/main/profileAdoption.ts takes the 0.x folder over); every further change costs people their saved keys.
    expect(STABLE_APP_NAME).toBe('nodewise-studio');
    expect(APP_ID).toBe('nodewise-studio');
    expect(pkg.name).toBe(STABLE_APP_NAME);
  });

  it('shows one display name, the one package.json gives the window', () => {
    expect(DISPLAY_NAME).toBe('NodeWise Studio');
    expect(SHORT_NAME).toBe('NodeWise');
    expect(pkg.productName).toBe(DISPLAY_NAME);
  });

  it('names the desktop entry after the package, so the window class matches the launcher', () => {
    expect(pkg.desktopName).toBe(`${STABLE_APP_NAME}.desktop`);
  });

  it('sends the real version to servers and sites', () => {
    expect(appVersion()).toBe(pkg.version);
    setMcpClientVersion(appVersion());
    expect(mcpClientInfo()).toEqual({ name: APP_ID, version: pkg.version });
    const site = projectUrlIsSet() ? `+${PROJECT_URL}; ` : '';
    expect(userAgent('page reader')).toBe(`NodeWiseStudio/${pkg.version} (${site}read-only; page reader)`);
  });

  it('uses the stable profile whatever the display name is', () => {
    expect(usesStableProfile('NodeWise Studio', true)).toBe(true);
    expect(usesStableProfile('NodeWise Studio', false)).toBe(true);
    expect(usesStableProfile('Some Later Name', false)).toBe(true);
    expect(usesStableProfile('nodewise-studio', true)).toBe(true);
    // A bare script launch keeps Electron's own name and folder.
    expect(usesStableProfile('Electron', false)).toBe(false);
  });

  it('keeps one project address: identity.ts, package.json, the issue forms, the README, the clone and install lines and the install scripts agree', () => {
    expect(PROJECT_URL).toBe('https://github.com/ZoriyAI/nodewise-studio');
    expect(projectUrlIsSet()).toBe(true);
    expect(pkg.homepage).toBe(PROJECT_URL);
    expect(pkg.repository).toEqual({ type: 'git', url: `git+${PROJECT_URL}.git` });
    expect(pkg.bugs).toEqual({ url: `${PROJECT_URL}/issues` });
    const root = path.join(__dirname, '..', '..');
    // Every github.com repository address in these files is the project's own.
    const repository = PROJECT_URL.replace('https://github.com/', '');
    const pages = ['CONTRIBUTING', 'docs/wiki/dev/Building-From-Source', 'docs/wiki/dev/Building-On-Windows', 'docs/wiki/dev/Building-On-macOS', 'docs/wiki/start/Installing-On-Windows', 'docs/wiki/start/Installing-On-macOS']
      .flatMap((page) => [`${page}.md`, `${page}.ru.md`]);
    for (const file of ['.github/ISSUE_TEMPLATE/config.yml', 'README.md', 'README.ru.md', ...pages]) {
      const text = fs.readFileSync(path.join(root, file), 'utf8');
      const repositories = [...text.matchAll(/https:\/\/(?:img\.shields\.io\/github\/v\/release\/|github\.com\/)([A-Za-z0-9-]+\/[A-Za-z0-9._-]+)/g)].map((match) => match[1].replace(/\.git$/, ''));
      expect(repositories.length, file).toBeGreaterThan(0);
      expect(new Set(repositories.filter((repo) => !repo.startsWith('actions/'))), file).toEqual(new Set([repository]));
    }
    // The install scripts for Windows and macOS ask this repository for the latest release.
    expect(fs.readFileSync(path.join(root, 'scripts/install/install-macos.sh'), 'utf8')).toContain(`REPOSITORY='${repository}'`);
    expect(fs.readFileSync(path.join(root, 'scripts/install/install-windows.ps1'), 'utf8')).toContain(`$Repository = '${repository}'`);
  });

  it('offers project links only for a real address', () => {
    expect(projectUrlIsSet('https://github.com/PLACEHOLDER-OWNER/PLACEHOLDER-REPOSITORY')).toBe(false);
    expect(projectLinks('https://github.com/PLACEHOLDER-OWNER/PLACEHOLDER-REPOSITORY')).toBeNull();
    expect(projectUrlIsSet('http://github.com/a/b')).toBe(false);
    expect(projectLinks('https://github.com/example/some-project')).toEqual({
      site: 'https://github.com/example/some-project',
      releases: 'https://github.com/example/some-project/releases',
      issues: 'https://github.com/example/some-project/issues',
      newIssue: 'https://github.com/example/some-project/issues/new',
    });
  });
});
