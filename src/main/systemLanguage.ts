import { languageFromSystem, localeFor, type AppLanguage } from '../shared/i18n/languages';

/**
 * The languages of the person's system, as the main process knows them. Main sets them once at start from
 * app.getPreferredSystemLanguages(); until then (and in unit tests) the POSIX locale variables stand in.
 * No Electron import here, so every module that needs the system language can be loaded in a test.
 */
let preferred: string[] | null = null;

export function setSystemLanguages(list: readonly string[] | null | undefined): void {
  const clean = (list ?? []).filter((tag): tag is string => typeof tag === 'string' && tag.trim() !== '');
  preferred = clean.length > 0 ? clean : null;
}

/** LANGUAGE (a colon list), then LC_ALL, LC_MESSAGES and LANG: what a Linux desktop says. 'C' and 'POSIX' say nothing. */
export function environmentLocales(env: NodeJS.ProcessEnv = process.env): string[] {
  const found: string[] = [];
  for (const value of [...(env.LANGUAGE ?? '').split(':'), env.LC_ALL, env.LC_MESSAGES, env.LANG]) {
    const tag = (value ?? '').trim();
    if (tag === '' || tag === 'C' || tag === 'POSIX' || tag.startsWith('C.')) continue;
    if (!found.includes(tag)) found.push(tag);
  }
  return found;
}

export function systemLocales(): string[] {
  return preferred ?? environmentLocales();
}

/** The interface language a first start uses, and the language of dialogs shown before settings can be read. */
export function systemLanguage(): AppLanguage {
  return languageFromSystem(systemLocales());
}

/** The locale for dates and numbers in the main process (dialogs, reports), in the chosen language. */
export function systemLocaleFor(language: AppLanguage): string {
  return localeFor(language, systemLocales());
}
