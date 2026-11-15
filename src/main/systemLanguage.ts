/**
 * The languages of the person's system, as the main process knows them. Main sets them once at start from
 * app.getPreferredSystemLanguages(); until then (and in unit tests) the POSIX locale variables stand in.
 * No Electron import here, so every module that needs the system language can be loaded in a test.
 * Read by main/index.ts, main/database.ts, settings/repository.ts, knowledge/seedCore.ts and ipc/diagnosticsIpc.ts.
 */
import { languageFromSystem, localeFor, type AppLanguage } from '../shared/i18n/languages';

/** The system's languages as Electron reported them; null until set. */
let preferred: string[] | null = null;

/** Stores the system's languages (main/index.ts, at start). An empty list leaves the locale variables in charge. */
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

/** The system's locale tags, most preferred first. */
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

/**
 * The pseudo-translation of the layout tests (NODEWISE_PSEUDO_LOCALE=1): every text drawn about 40 % longer, so
 * a translation into a longer language is tried before it exists. Never in an installed app.
 */
export function pseudoLocaleWanted(isPackaged: boolean, env: NodeJS.ProcessEnv = process.env): boolean {
  return !isPackaged && env.NODEWISE_PSEUDO_LOCALE === '1';
}
