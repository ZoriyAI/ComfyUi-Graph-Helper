/**
 * What the app does differently on Windows and macOS at start (src/main/platformMenu.ts and src/main/cli.ts), so the
 * builds the install scripts make (scripts/install/) open and answer like the Linux one: the native menu only on
 * macOS, the Linux keychain switch only on Linux, the help naming each system's profile folder, and `--version`
 * printed in one synchronous write, so a script reading it through a pipe on macOS gets the line before the app exits.
 */
import { describe, expect, it } from 'vitest';
import { applicationMenuTemplate, usesPasswordStoreSwitch } from '../../src/main/platformMenu';
import { commandLineAnswer, profileFolderHint, writeCommandLineAnswer } from '../../src/main/cli';

describe('start on each system', () => {
  it('sets the standard app, Edit and Window menus on macOS and no native menu elsewhere', () => {
    expect(applicationMenuTemplate('darwin')).toEqual([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]);
    expect(applicationMenuTemplate('linux')).toBeNull();
    expect(applicationMenuTemplate('win32')).toBeNull();
  });

  it('adds the keychain switch only on Linux', () => {
    expect(usesPasswordStoreSwitch('linux')).toBe(true);
    expect(usesPasswordStoreSwitch('darwin')).toBe(false);
    expect(usesPasswordStoreSwitch('win32')).toBe(false);
  });

  it('names the profile folder of each system in the help', () => {
    expect(profileFolderHint('linux')).toBe('~/.config/nodewise-studio');
    expect(profileFolderHint('darwin')).toBe('~/Library/Application Support/nodewise-studio');
    expect(profileFolderHint('win32')).toBe('%APPDATA%\\nodewise-studio');
    // Long lines wrap at spaces, so the words are compared with the wrapping undone.
    const mac = (commandLineAnswer(['app', '--help'], '1.2.3', 'en', 'darwin') ?? '').replace(/\s+/g, ' ');
    expect(mac).toContain('~/Library/Application Support/nodewise-studio');
    expect(mac).not.toContain('--password-store');
    expect(mac).not.toContain('--ozone-platform-hint');
    const windows = commandLineAnswer(['app', '--help'], '1.2.3', 'en', 'win32') ?? '';
    expect(windows).toContain('%APPDATA%\\nodewise-studio');
    const linux = commandLineAnswer(['app', '--help'], '1.2.3', 'en', 'linux') ?? '';
    expect(linux).toContain('--password-store=<store>');
    expect(linux).toContain('~/.config/nodewise-studio');
  });

  it('prints the answer in one write to standard output and never throws without one', () => {
    const writes: Array<[number, string]> = [];
    writeCommandLineAnswer('NodeWise Studio 1.2.3\n', (fd, text) => writes.push([fd, text]));
    expect(writes).toEqual([[1, 'NodeWise Studio 1.2.3\n']]);
    expect(() => writeCommandLineAnswer('x', () => { throw Object.assign(new Error('bad file descriptor'), { code: 'EBADF' }); })).not.toThrow();
  });
});
