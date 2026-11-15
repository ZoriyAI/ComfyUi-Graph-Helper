import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const ROOT = path.join(__dirname, '..', '..');
const PORTABLE = path.join(ROOT, 'resources', 'linux', 'portable');
const NAME = 'nodewise-studio';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { appRunScript, desktopEntry } = require('../../scripts/make-linux-portable.js') as { appRunScript: () => string; desktopEntry: () => string };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { REQUIRED, fuseProblems } = require('../../scripts/check-fuses.js') as {
  REQUIRED: Record<string, boolean>;
  fuseProblems: (actual: Record<string, number>, wanted: Record<string, boolean>, state: { ENABLE: number; DISABLE: number }) => string[];
};

/** An unpacked tar.gz with a stand-in program that writes its arguments to $ARGS_FILE. */
function fakeArchive(): string {
  const folder = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'portable-')), `${NAME}-1.0.0-linux-x64`);
  fs.mkdirSync(path.join(folder, 'share', 'applications'), { recursive: true });
  fs.writeFileSync(path.join(folder, NAME), '#!/bin/sh\nprintf "%s\\n" "$@" > "$ARGS_FILE"\n', { mode: 0o755 });
  fs.writeFileSync(path.join(folder, 'chrome-sandbox'), '', { mode: 0o755 });
  for (const script of ['run.sh', 'install.sh', 'uninstall.sh']) fs.copyFileSync(path.join(PORTABLE, script), path.join(folder, script));
  for (const script of ['run.sh', 'install.sh', 'uninstall.sh']) fs.chmodSync(path.join(folder, script), 0o755);
  fs.writeFileSync(path.join(folder, 'share', 'applications', `${NAME}.desktop`), desktopEntry());
  for (const size of [16, 256]) {
    fs.mkdirSync(path.join(folder, 'share', 'icons', 'hicolor', `${size}x${size}`, 'apps'), { recursive: true });
    fs.writeFileSync(path.join(folder, 'share', 'icons', 'hicolor', `${size}x${size}`, 'apps', `${NAME}.png`), 'png');
  }
  return folder;
}

function envFor(home: string, argsFile: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: home, ARGS_FILE: argsFile };
  return env;
}

describe('Linux tar.gz: run.sh, install.sh, uninstall.sh', () => {
  it('run.sh starts the program in its folder and passes the arguments on', () => {
    const folder = fakeArchive();
    const argsFile = path.join(path.dirname(folder), 'args');
    execFileSync(path.join(folder, 'run.sh'), ['--version', '--user-data-dir=/tmp/x y'], { env: envFor(path.dirname(folder), argsFile), stdio: 'ignore' });
    const args = fs.readFileSync(argsFile, 'utf8').trim().split('\n');
    // --no-sandbox appears only when this system lets no sandbox start from a folder (see run.sh).
    expect(args.filter((arg) => arg !== '--no-sandbox')).toEqual(['--version', '--user-data-dir=/tmp/x y']);
    execFileSync(path.join(folder, 'run.sh'), ['--no-sandbox', '--version'], { env: envFor(path.dirname(folder), argsFile), stdio: 'ignore' });
    expect(fs.readFileSync(argsFile, 'utf8').trim().split('\n')).toEqual(['--no-sandbox', '--version']);
  });

  it('install.sh installs for one user without root; uninstall.sh removes only that and keeps the profile', () => {
    const folder = fakeArchive();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'portable-home-'));
    const argsFile = path.join(home, 'args');
    const env = envFor(home, argsFile);
    execFileSync(path.join(folder, 'install.sh'), [], { env, stdio: 'ignore' });

    const appDir = path.join(home, '.local', 'share', NAME);
    const launcher = path.join(home, '.local', 'bin', NAME);
    const entry = path.join(home, '.local', 'share', 'applications', `${NAME}.desktop`);
    expect(fs.existsSync(path.join(appDir, NAME))).toBe(true);
    expect(fs.existsSync(path.join(appDir, 'install.sh'))).toBe(false);
    expect(fs.statSync(launcher).mode & 0o111).not.toBe(0);
    const entryText = fs.readFileSync(entry, 'utf8');
    expect(entryText).toContain(`Exec="${launcher}" %U`);
    expect(entryText).toContain(`Icon=${NAME}`);
    expect(fs.existsSync(path.join(home, '.local', 'share', 'icons', 'hicolor', '256x256', 'apps', `${NAME}.png`))).toBe(true);

    execFileSync(launcher, ['--help'], { env, stdio: 'ignore' });
    expect(fs.readFileSync(argsFile, 'utf8')).toContain('--help');

    // Again over the first copy: replaced, not refused.
    execFileSync(path.join(folder, 'install.sh'), [], { env, stdio: 'ignore' });
    // A launcher someone else made is never overwritten.
    fs.writeFileSync(launcher, '#!/bin/sh\necho mine\n');
    expect(() => execFileSync(path.join(folder, 'install.sh'), [], { env, stdio: 'ignore' })).toThrow();
    fs.rmSync(launcher);
    execFileSync(path.join(folder, 'install.sh'), [], { env, stdio: 'ignore' });

    const profile = path.join(home, '.config', NAME);
    fs.mkdirSync(profile, { recursive: true });
    fs.writeFileSync(path.join(profile, 'comfyui-desktop.db'), 'data');
    execFileSync(path.join(appDir, 'uninstall.sh'), [], { env, stdio: 'ignore' });
    for (const gone of [appDir, launcher, entry]) expect(fs.existsSync(gone)).toBe(false);
    expect(fs.existsSync(path.join(profile, 'comfyui-desktop.db'))).toBe(true);
    execFileSync(path.join(folder, 'uninstall.sh'), ['--purge'], { env, stdio: 'ignore' });
    expect(fs.existsSync(profile)).toBe(false);
  });
});

describe('Linux AppImage and fuses', () => {
  it('AppRun is run.sh pointed at usr/lib inside the image', () => {
    const script = appRunScript();
    expect(script).toContain(`APP_SUBDIR=usr/lib/${NAME}`);
    expect(script).toContain('IN_APPIMAGE=1');
    expect(script).not.toMatch(/^APP_SUBDIR=\.$/m);
  });

  it('the menu entry is the deb\'s entry with the name filled in', () => {
    const entry = desktopEntry();
    expect(entry).toContain(`Exec=${NAME} %U`);
    expect(entry).toContain(`StartupWMClass=${NAME}`);
    expect(entry).not.toContain('<%');
  });

  it('every release keeps the inspector, RUN_AS_NODE and NODE_OPTIONS off', () => {
    expect(REQUIRED).toMatchObject({ RunAsNode: false, EnableNodeOptionsEnvironmentVariable: false, EnableNodeCliInspectArguments: false, OnlyLoadAppFromAsar: true });
    const forge = fs.readFileSync(path.join(ROOT, 'forge.config.js'), 'utf8');
    expect(forge).toMatch(/\[FuseV1Options\.EnableNodeCliInspectArguments\]:\s*false/);
    expect(forge).toMatch(/\[FuseV1Options\.RunAsNode\]:\s*false/);
  });

  it('a binary whose fuses differ from the config is named with each wrong fuse', () => {
    const state = { ENABLE: 49, DISABLE: 48 };
    expect(fuseProblems({ RunAsNode: 48, OnlyLoadAppFromAsar: 49 }, { RunAsNode: false, OnlyLoadAppFromAsar: true }, state)).toEqual([]);
    expect(fuseProblems({ RunAsNode: 49, EnableNodeCliInspectArguments: 49 }, { RunAsNode: false, EnableNodeCliInspectArguments: false }, state))
      .toEqual(['RunAsNode=on (want off)', 'EnableNodeCliInspectArguments=on (want off)']);
  });

  it('the shell scripts pass shellcheck where it is installed', () => {
    let available = true;
    try {
      execFileSync('sh', ['-c', 'command -v shellcheck'], { stdio: 'ignore' });
    } catch {
      available = false;
    }
    if (!available) return;
    execFileSync('shellcheck', ['-s', 'sh', ...['run.sh', 'install.sh', 'uninstall.sh'].map((file) => path.join(PORTABLE, file)), path.join(ROOT, 'resources', 'linux', 'postinst')], { stdio: 'inherit' });
  });
});
