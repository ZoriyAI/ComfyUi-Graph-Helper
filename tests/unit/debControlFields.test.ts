/**
 * The .deb of 1.0 declares that it replaces the package 0.x was shipped as (scripts/lib/deb-control-fields.js, run
 * from forge.config.js postMake). The text change is checked everywhere; the rewrite of a real package only where
 * dpkg-deb and fakeroot exist (the Linux machines that make packages), and it must keep owners and modes.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { LEGACY_APP_ID } from '../../src/shared/legacyNames';

const require = createRequire(import.meta.url);
const { addControlFields, withControlFields } = require('../../scripts/lib/deb-control-fields.js') as {
  addControlFields: (debFile: string, fields: Record<string, string>) => void;
  withControlFields: (control: string, fields: Record<string, string>) => string;
};

const CONTROL = [
  'Package: nodewise-studio',
  'Version: 1.0.0',
  'Architecture: amd64',
  'Depends: libc6',
  'Replaces: something-else',
  'Description: A desktop tutor for ComfyUI graphs',
  ' NodeWise Studio is an experimental desktop app.',
  ' .',
  ' Second paragraph.',
  '',
].join('\n');

function have(command: string): boolean {
  try {
    execFileSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('control fields of the .deb', () => {
  it('adds the fields before Description, replaces a field of the same name and keeps the long description', () => {
    const text = withControlFields(CONTROL, { Replaces: LEGACY_APP_ID, Conflicts: LEGACY_APP_ID });
    expect(text).toBe([
      'Package: nodewise-studio',
      'Version: 1.0.0',
      'Architecture: amd64',
      'Depends: libc6',
      `Replaces: ${LEGACY_APP_ID}`,
      `Conflicts: ${LEGACY_APP_ID}`,
      'Description: A desktop tutor for ComfyUI graphs',
      ' NodeWise Studio is an experimental desktop app.',
      ' .',
      ' Second paragraph.',
      '',
    ].join('\n'));
  });

  it('is what forge.config.js asks for after making the .deb', async () => {
    const forge = require('../../forge.config.js') as { hooks: { postMake: (config: unknown, results: Array<{ artifacts: string[] }>) => Promise<unknown> } };
    // Nothing to rewrite in a result without a .deb; the hook hands the results on.
    const results = [{ artifacts: ['/nowhere/app.rpm'] }];
    await expect(forge.hooks.postMake({}, results)).resolves.toBe(results);
  });

  it.runIf(process.platform === 'linux' && have('dpkg-deb') && have('fakeroot'))('rewrites a real package and keeps owners and modes', () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'deb-fields-test-'));
    try {
      const root = path.join(work, 'root');
      fs.mkdirSync(path.join(root, 'DEBIAN'), { recursive: true });
      fs.mkdirSync(path.join(root, 'usr', 'lib', 'nodewise-studio'), { recursive: true });
      fs.writeFileSync(path.join(root, 'DEBIAN', 'control'), CONTROL.replace('Replaces: something-else\n', ''));
      const helper = path.join(root, 'usr', 'lib', 'nodewise-studio', 'chrome-sandbox');
      fs.writeFileSync(helper, 'x');
      const deb = path.join(work, 'app.deb');
      // Built the way the maker builds it: as root inside fakeroot, the helper SUID root.
      execFileSync('fakeroot', ['sh', '-c', `chmod 4755 "${helper}" && dpkg-deb --build "${root}" "${deb}" >/dev/null`]);
      addControlFields(deb, { Replaces: LEGACY_APP_ID, Conflicts: LEGACY_APP_ID });
      const field = (name: string) => execFileSync('dpkg-deb', ['--field', deb, name], { encoding: 'utf8' }).trim();
      expect(field('Replaces')).toBe(LEGACY_APP_ID);
      expect(field('Conflicts')).toBe(LEGACY_APP_ID);
      expect(field('Package')).toBe('nodewise-studio');
      const listing = execFileSync('dpkg-deb', ['--contents', deb], { encoding: 'utf8' });
      expect(listing).toMatch(/-rwsr-xr-x root\/root .*\.\/usr\/lib\/nodewise-studio\/chrome-sandbox/);
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  });
});
