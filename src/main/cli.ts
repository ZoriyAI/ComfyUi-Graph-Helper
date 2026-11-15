import { DISPLAY_NAME, STABLE_APP_NAME } from './identity';
import { createTranslator, type AppLanguage } from '../shared/i18n';

/** One option line: the option as typed, then its explanation, wrapped under it. */
function optionLine(option: string, text: string): string[] {
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

/**
 * `--version` and `--help` on the command line: print and leave without opening a window. Anything else starts the
 * app as usual. Chromium switches stay Chromium's; only these two words (and -v, -h) are taken. The help speaks the
 * system's language.
 */
export function commandLineAnswer(argv: readonly string[], version: string, language: AppLanguage = 'en'): string | null {
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
      ...optionLine('--user-data-dir=<folder>', t('cli.userDataDir', { folder: `~/.config/${STABLE_APP_NAME}` })),
      ...optionLine('--password-store=<store>', t('cli.passwordStore', { stores: 'gnome-libsecret, kwallet5, kwallet6' })),
      ...optionLine('--ozone-platform-hint=auto', t('cli.wayland')),
      ...optionLine('[file]', t('cli.file')),
      '',
    ].join('\n');
  }
  return null;
}
