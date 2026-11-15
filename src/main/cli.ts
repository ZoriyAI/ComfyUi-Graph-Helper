/**
 * The command-line answers: `--version` and `--help` print and the app quits before any window opens.
 * main/index.ts asks commandLineAnswer first thing at start and prints the answer with writeCommandLineAnswer. The
 * help also lists the Chromium switches a Linux user may need (keyring, Wayland); on Windows and macOS it names that
 * system's profile folder and leaves the Linux-only switches out. The install scripts for Windows and macOS
 * (scripts/install/) read `--version` through a pipe to check what they installed.
 */
import * as fs from 'fs';
import { DISPLAY_NAME, STABLE_APP_NAME } from './identity';
import { createTranslator, type AppLanguage } from '../shared/i18n';

/** One option line: the option as typed, then its explanation, wrapped under it. */
function optionLine(option: string, text: string): string[] {
  // Explanations start at column 30 and wrap before 110 characters, so the help fits a usual terminal.
  const column = 30;
  const words = text.split(' ');
  const lines: string[] = [];
  let line = `  ${option}`.padEnd(column);
  for (const word of words) {
    if (line.trim() !== '' && line.length + word.length > 110 && line.length > column) {
      lines.push(line.trimEnd());
      line = ' '.repeat(column);
    }
    line += `${word} `;
  }
  lines.push(line.trimEnd());
  return lines;
}

/** Where the profile folder is on each system, as the help names it (Electron's appData plus the app's name). */
export function profileFolderHint(platform: NodeJS.Platform = process.platform): string {
  if (platform === 'win32') return `%APPDATA%\\${STABLE_APP_NAME}`;
  if (platform === 'darwin') return `~/Library/Application Support/${STABLE_APP_NAME}`;
  return `~/.config/${STABLE_APP_NAME}`;
}

/**
 * `--version` and `--help` on the command line: print and leave without opening a window. Anything else starts the
 * app as usual. Chromium switches stay Chromium's; only these two words (and -v, -h) are taken. The help speaks the
 * system's language.
 */
export function commandLineAnswer(argv: readonly string[], version: string, language: AppLanguage = 'en', platform: NodeJS.Platform = process.platform): string | null {
  const args = argv.slice(1);
  if (args.some((arg) => arg === '--version' || arg === '-v')) return `${DISPLAY_NAME} ${version}\n`;
  if (args.some((arg) => arg === '--help' || arg === '-h')) {
    const t = createTranslator(language);
    return [
      `${DISPLAY_NAME} ${version}`,
      '',
      t('cli.usage', { command: STABLE_APP_NAME }),
      '',
      t('cli.options'),
      ...optionLine('--version, -v', t('cli.version')),
      ...optionLine('--help, -h', t('cli.help')),
      ...optionLine('--user-data-dir=<folder>', t('cli.userDataDir', { folder: profileFolderHint(platform) })),
      // Both switches exist only on Linux: Windows and macOS have one keychain each and no Wayland.
      ...(platform === 'linux' ? optionLine('--password-store=<store>', t('cli.passwordStore', { stores: 'gnome-libsecret, kwallet5, kwallet6' })) : []),
      ...(platform === 'linux' ? optionLine('--ozone-platform-hint=auto', t('cli.wayland')) : []),
      ...optionLine('[file]', t('cli.file')),
      '',
    ].join('\n');
  }
  return null;
}

/**
 * Prints the answer on standard output in one synchronous write. Why not process.stdout.write: on macOS (and for some
 * handles on Windows) a pipe is written asynchronously, and the app exits right after this call, so a script that
 * reads `--version` through a pipe could get nothing. Without any output handle (a window app started from the
 * Windows desktop) there is nowhere to print, and the start goes on to exit quietly.
 */
export function writeCommandLineAnswer(text: string, write: (fd: number, text: string) => void = (fd, value) => { fs.writeSync(fd, value); }): void {
  try {
    write(1, text);
  } catch {
    // No standard output (EBADF) or a closed pipe (EPIPE): nothing to print to.
  }
}
