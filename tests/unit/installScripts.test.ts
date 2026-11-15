/**
 * The install scripts for Windows and macOS (scripts/install/install-windows.ps1 and install-macos.sh), which people
 * download from a release and run to build and install the app on those systems, and the portable app check they
 * end with (scripts/smoke-installed-app.js). What is checked here without Windows or a Mac:
 * - both scripts name the project's own repository and the app's names, and share one table of exit codes, which the
 *   two wiki pages explain row by row;
 * - they download only over HTTPS from the hosts they list, never run downloaded code as a command
 *   (no Invoke-Expression, no `curl | sh`) and never switch off a system protection;
 * - every message they show exists in English and in Russian;
 * - Git is not needed: every package npm installs comes from the npm registry, none from a Git address;
 * - the bash script answers --help, refuses a wrong option (2) and a system that is not macOS (3), and passes
 *   shellcheck where it is installed.
 * Running them for real is .github/workflows/install-scripts.yml, on GitHub's Windows and macOS runners.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';
import { PROJECT_URL } from '../../src/main/identity';
import { APP_ID, DISPLAY_NAME } from '../../src/shared/productNames';

const require = createRequire(import.meta.url);
const ROOT = path.join(__dirname, '..', '..');
const PS1 = path.join(ROOT, 'scripts', 'install', 'install-windows.ps1');
const SH = path.join(ROOT, 'scripts', 'install', 'install-macos.sh');
const ps1 = fs.readFileSync(PS1, 'utf8').replace(/^\uFEFF/, '');
const sh = fs.readFileSync(SH, 'utf8');
const REPOSITORY = PROJECT_URL.replace('https://github.com/', '');

/** The exit code table of each script: name to number. */
function exitCodes(text: string, pattern: RegExp): Record<string, number> {
  return Object.fromEntries([...text.matchAll(pattern)].map((match) => [match[1].replace(/_/g, '').toLowerCase(), Number(match[2])]));
}

describe('install scripts', () => {
  it('name the project, the app and its folder exactly as the app does', () => {
    expect(ps1).toContain(`$Repository = '${REPOSITORY}'`);
    expect(sh).toContain(`REPOSITORY='${REPOSITORY}'`);
    expect(ps1).toContain(`$AppId = '${APP_ID}'`);
    expect(sh).toContain(`APP_ID='${APP_ID}'`);
    expect(ps1).toContain(`$DisplayName = '${DISPLAY_NAME}'`);
    expect(sh).toContain(`DISPLAY_NAME='${DISPLAY_NAME}'`);
  });

  it('share one table of exit codes, and both wiki pages explain every code', () => {
    const windows = exitCodes(ps1, /^\$Exit([A-Za-z]+) = (\d+)$/gm);
    const mac = exitCodes(sh, /^EXIT_([A-Z_]+)=(\d+)$/gm);
    expect(Object.keys(windows).length).toBe(14);
    expect(windows).toEqual(mac);
    for (const page of ['Installing-On-Windows', 'Installing-On-macOS']) {
      for (const language of ['', '.ru']) {
        const text = fs.readFileSync(path.join(ROOT, 'docs', 'wiki', 'start', `${page}${language}.md`), 'utf8');
        for (const code of Object.values(windows)) expect(text, `${page}${language} code ${code}`).toMatch(new RegExp(`^\\| ${code} \\|`, 'm'));
      }
    }
  });

  it('download only over HTTPS from the hosts they list', () => {
    const hosts = (sh.match(/^ALLOWED_HOSTS='([^']+)'$/m) ?? [])[1]?.split(' ').sort();
    const windowsHosts = [...(ps1.match(/^\$AllowedHosts = @\(([^)]+)\)$/m) ?? [])[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
    expect(hosts).toEqual(['api.github.com', 'codeload.github.com', 'github.com', 'nodejs.org', 'registry.npmjs.org']);
    expect(windowsHosts).toEqual(hosts);
    for (const text of [ps1, sh]) {
      expect(text).not.toMatch(/\bhttp:\/\//);
      // A dot escaped inside a pattern (github\.com) is still that host.
      for (const match of text.replace(/\\\./g, '.').matchAll(/https:\/\/([a-z0-9.-]+)/gi)) expect(hosts, match[0]).toContain(match[1].toLowerCase());
    }
  });

  it('never run downloaded code as a command and never switch off a system protection', () => {
    expect(ps1).not.toMatch(/Invoke-Expression|\biex\b|Set-ExecutionPolicy|Set-MpPreference|Add-MpPreference|DisableRealtimeMonitoring/i);
    expect(sh).not.toMatch(/\|\s*(ba|z)?sh\b|curl[^\n]*\|\s*bash|spctl\s+--master-disable|spctl\s+--global-disable|csrutil|\beval\b/);
    // The documented process-scoped bypass is the only execution-policy switch, and it is not system-wide.
    for (const match of ps1.matchAll(/ExecutionPolicy\s+(\w+)/g)) expect(match[1]).toBe('Bypass');
    expect(ps1).toMatch(/^Set-StrictMode -Version Latest$/m);
    expect(ps1).toMatch(/^\$ErrorActionPreference = 'Stop'$/m);
    expect(sh).toMatch(/^set -euo pipefail$/m);
  });

  it('have every message in English and in Russian', () => {
    const block = (language: string) => {
      const start = ps1.indexOf(`  ${language} = @{`);
      return ps1.slice(start, ps1.indexOf('\n  }', start));
    };
    const keysOf = (text: string) => new Set([...text.matchAll(/^ {4}([a-z_]+) = '/gm)].map((match) => match[1]));
    const en = keysOf(block('en'));
    expect(en.size).toBeGreaterThan(40);
    expect(keysOf(block('ru'))).toEqual(en);
    const used = new Set([...ps1.matchAll(/(?:Show-Message|Exit-Install \$\w+|Confirm-Choice|Get-Text|Show-Step|Use-Phase \$\w+) '([a-z_]+)'/g)].map((match) => match[1]));
    for (const key of used) expect(en, `install-windows.ps1 uses ${key}`).toContain(key);

    const shKeys = (language: string) => new Set([...sh.matchAll(new RegExp(`^ {4}${language}:([a-z_]+)\\)`, 'gm'))].map((match) => match[1]));
    expect(shKeys('ru')).toEqual(shKeys('en'));
    const code = sh.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');
    // A call starts a command (line start, after ; { && || then else or !), so words of the help text never count.
    const shUsed = new Set([...code.matchAll(/(?:^|[;{!]|&&|\|\||\bthen|\belse)\s*(?:say|warn|die \$\w+|ask|step|phase \$\w+) ([a-z_]+)\b/gm)].map((match) => match[1]));
    expect(shUsed.size).toBeGreaterThan(30);
    for (const key of shUsed) expect(shKeys('en'), `install-macos.sh uses ${key}`).toContain(key);
  });

  it('build on the case-insensitive file systems of Windows and macOS: no two files differ only in letter case', () => {
    // An import names a module without its extension, so markdownLite.ts beside MarkdownLite.tsx is one module name
    // on a Mac or a Windows computer (the first macOS build failed on exactly that).
    const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 1 << 26 }).toString('utf8').split('\0').filter(Boolean);
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const file of tracked) {
      const key = file.replace(/\.(tsx?|jsx?|mjs|cjs)$/, '').toLowerCase();
      const other = seen.get(key);
      if (other && other !== file) clashes.push(`${other} / ${file}`);
      seen.set(key, file);
    }
    expect(clashes).toEqual([]);
  });

  it('need no Git: every package comes from the npm registry', () => {
    const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8')) as { packages: Record<string, { resolved?: string; link?: boolean }> };
    const elsewhere = Object.entries(lock.packages).filter(([name, entry]) => name && !entry.link && entry.resolved && !entry.resolved.startsWith('https://registry.npmjs.org/'));
    expect(elsewhere).toEqual([]);
  });

  it('find themselves in the source they build, so an older release is refused with exit code 13', () => {
    expect(ps1).toContain("'scripts\\install\\install-windows.ps1'");
    expect(sh).toContain('"$CHECK_DIR/scripts/install/install-macos.sh"');
  });

  it('are saved so each system can run them', () => {
    expect(fs.readFileSync(PS1).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(sh.startsWith('#!/bin/bash\n')).toBe(true);
    expect(fs.statSync(SH).mode & 0o111).not.toBe(0);
    expect(sh).not.toContain('\r');
  });

  it('install-macos.sh answers --help, refuses a wrong option and a system that is not macOS', () => {
    const run = (args: string[]) => spawnSync('bash', [SH, ...args], { encoding: 'utf8', env: { ...process.env, TMPDIR: fs.mkdtempSync(path.join(require('os').tmpdir(), 'install-sh-')) } });
    const help = run(['--help']);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('13 this version cannot be installed by this script');
    expect(run(['--no-such-option']).status).toBe(2);
    expect(run(['--main', '--version', 'v1.0.0']).status).toBe(2);
    expect(run(['--version', 'latest']).status).toBe(2);
    if (process.platform !== 'darwin') {
      const refused = run(['--dry-run', '--lang', 'ru']);
      expect(refused.status).toBe(3);
      expect(refused.stderr).toContain('Этот скрипт для macOS');
    }
  });

  it('are proved by a workflow on Windows and macOS runners, with every action pinned by commit', () => {
    const { parse } = require('yaml');
    const text = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'install-scripts.yml'), 'utf8');
    const workflow = parse(text);
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.on.push.paths).toEqual(expect.arrayContaining(['scripts/install/**', 'forge.config.js', 'package.json', '.github/workflows/install-scripts.yml']));
    expect(workflow.on.workflow_dispatch).toBeDefined();
    expect(workflow.on.schedule).toHaveLength(1);
    expect(workflow.jobs.windows.strategy.matrix.include.map((row: { os: string }) => row.os)).toEqual(['windows-latest', 'windows-2022']);
    expect(workflow.jobs.macos.strategy.matrix.os).toEqual(['macos-latest', 'macos-15-intel']);
    for (const match of text.matchAll(/uses: (\S+)/g)) expect(match[1]).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
    // The scripts are run the way the documentation tells a person to, and both upgrade and uninstall are checked.
    expect(text).toContain('-ExecutionPolicy Bypass -File scripts\\install\\install-windows.ps1');
    expect(text).toContain('/bin/bash scripts/install/install-macos.sh');
    expect(text).toContain('install-check-marker.txt');
  });

  it('install-macos.sh passes shellcheck where it is installed', () => {
    if (spawnSync('sh', ['-c', 'command -v shellcheck']).status !== 0) return;
    execFileSync('shellcheck', ['-s', 'bash', SH], { stdio: 'inherit' });
  });
});

describe('the installed app check', () => {
  const { parseArgs, versionMatches, CHECK_SWITCHES } = require('../../scripts/smoke-installed-app.js');

  it('reads its options and refuses unknown ones', () => {
    expect(parseArgs(['--app', 'C:\\Apps\\x.exe', '--expect-version=1.0.0'])).toEqual({ app: 'C:\\Apps\\x.exe', expectVersion: '1.0.0', screenshot: '' });
    expect(() => parseArgs(['--app'])).toThrow('--app needs a value');
    expect(() => parseArgs(['--expect-version', '1.0.0'])).toThrow('--app <executable> is required');
    expect(() => parseArgs(['--app', 'x', '--skip-window'])).toThrow('unknown option');
  });

  it('accepts exactly the display name and version, with a Windows line end', () => {
    expect(versionMatches('NodeWise Studio 1.0.0\r\n', '1.0.0')).toBe(true);
    expect(versionMatches('NodeWise Studio 1.0.1\n', '1.0.0')).toBe(false);
    expect(versionMatches('', '1.0.0')).toBe(false);
  });

  it('keeps the check away from the macOS Keychain', () => {
    expect(CHECK_SWITCHES).toContain('--use-mock-keychain');
  });
});
