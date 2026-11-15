/**
 * The build target of an Electron Forge run (scripts/lib/forge-target.js, read by forge.config.js): the Linux packages
 * keep exactly the database module they always shipped (linux-x64), and the Windows and macOS builds that the install
 * scripts make carry their own module and no other. A wrong pattern would ship an app that cannot open its database.
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { packageTarget, prebuildIgnore, optionValue } = require('../../scripts/lib/forge-target.js');

describe('the build target', () => {
  it('reads --platform and --arch as Forge does, and falls back to this machine', () => {
    expect(packageTarget(['node', 'electron-forge', 'make', '--platform', 'linux', '--arch', 'x64'], 'darwin', 'arm64')).toBe('linux-x64');
    expect(packageTarget(['node', 'electron-forge', 'package', '--platform=win32', '--arch=x64'], 'linux', 'x64')).toBe('win32-x64');
    expect(packageTarget(['node', 'electron-forge', 'package'], 'darwin', 'arm64')).toBe('darwin-arm64');
    expect(optionValue(['--arch'], '--arch')).toBe('');
    expect(() => packageTarget(['x', '--arch=x64,arm64'], 'darwin', 'arm64')).toThrow('one target at a time');
  });

  it('keeps the Linux pattern exactly as before and only the target module elsewhere', () => {
    expect(prebuildIgnore('linux-x64').source).toBe(String.raw`^\/node_modules\/better-sqlite3\/prebuilds\/(?!linux-x64\.node$)`);
    const mac = prebuildIgnore('darwin-arm64');
    expect(mac.test('/node_modules/better-sqlite3/prebuilds/darwin-arm64.node')).toBe(false);
    expect(mac.test('/node_modules/better-sqlite3/prebuilds/darwin-x64.node')).toBe(true);
    expect(mac.test('/node_modules/better-sqlite3/prebuilds/linux-x64.node')).toBe(true);
    const windows = prebuildIgnore('win32-x64');
    expect(windows.test('/node_modules/better-sqlite3/prebuilds/win32-x64.node')).toBe(false);
    expect(windows.test('/node_modules/better-sqlite3/prebuilds/win32-arm64.node')).toBe(true);
  });

  it('forge.config.js uses it and names the Windows and macOS icons and metadata', () => {
    const forge = require('../../forge.config.js');
    const patterns = forge.packagerConfig.ignore.map(String);
    expect(patterns).toContain(String(prebuildIgnore(packageTarget())));
    expect(forge.packagerConfig.icon).toBe('resources/icon');
    expect(forge.packagerConfig.win32metadata).toEqual({ ProductName: 'NodeWise Studio', FileDescription: 'NodeWise Studio' });
    // No signing settings: the install scripts sign the copied .app ad hoc on the person's Mac.
    expect(forge.packagerConfig.osxSign).toBeUndefined();
  });
});
