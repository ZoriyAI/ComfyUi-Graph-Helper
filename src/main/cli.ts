import { DISPLAY_NAME, STABLE_APP_NAME } from './identity';

/**
 * `--version` and `--help` on the command line: print and leave without opening a window. Anything else starts the
 * app as usual. Chromium switches stay Chromium's; only these two words (and -v, -h) are taken.
 */
export function commandLineAnswer(argv: readonly string[], version: string): string | null {
  const args = argv.slice(1);
  if (args.some((arg) => arg === '--version' || arg === '-v')) return `${DISPLAY_NAME} ${version}\n`;
  if (args.some((arg) => arg === '--help' || arg === '-h')) {
    return [
      `${DISPLAY_NAME} ${version}`,
      '',
      `Usage: ${STABLE_APP_NAME} [options]`,
      '',
      'Options:',
      '  --version, -v               Print the version and exit.',
      '  --help, -h                  Print this help and exit.',
      '  --user-data-dir=<folder>    Keep settings, keys and projects in this folder',
      `                              instead of ~/.config/${STABLE_APP_NAME}.`,
      '  --password-store=<store>    Which password store keeps saved keys:',
      '                              gnome-libsecret, kwallet5, kwallet6.',
      '  --ozone-platform-hint=auto  Run natively on Wayland when the desktop uses it.',
      '',
    ].join('\n');
  }
  return null;
}
