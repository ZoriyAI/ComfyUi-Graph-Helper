/**
 * The languages of the interface, in one place. A third language is added here, in the catalog and in the
 * locale table below; code that needs "which language" uses AppLanguage and these helpers instead of 'en' | 'ru'.
 * Used by the settings schema, i18n/index.ts and format.ts, and by main to pick the first-start language
 * (main/systemLanguage.ts).
 */
export const APP_LANGUAGES = ['en', 'ru'] as const;

/** A language the interface speaks. */
export type AppLanguage = (typeof APP_LANGUAGES)[number];

/** The language used when nothing better is known (a person whose system speaks none of ours). */
export const FALLBACK_LANGUAGE: AppLanguage = 'en';

/** The locale for dates and numbers when the system gives none in this language. */
const DEFAULT_LOCALE: Record<AppLanguage, string> = { en: 'en-US', ru: 'ru-RU' };

/** Type guard for a language code from storage or the system. */
export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && (APP_LANGUAGES as readonly string[]).includes(value);
}

/** 'ru-RU' → 'ru', 'zh_Hans_CN' → 'zh'. */
function primaryTag(tag: string): string {
  return tag.trim().toLowerCase().split(/[-_.@]/)[0] ?? '';
}

/**
 * The interface language for a first start: the first of the system's preferred languages that the app speaks,
 * else English. ['de-DE', 'ru-RU'] gives Russian; ['de-DE', 'en-US'] and ['zh-CN'] give English.
 */
export function languageFromSystem(preferred: readonly string[] | null | undefined): AppLanguage {
  for (const tag of preferred ?? []) {
    if (typeof tag !== 'string') continue;
    const primary = primaryTag(tag);
    if (isAppLanguage(primary)) return primary;
  }
  return FALLBACK_LANGUAGE;
}

/**
 * The locale dates and numbers are written in: the system's own locale when it is in the chosen language (en-GB
 * writes 14/11/2026, en-IN groups digits its own way), else the usual locale of that language.
 */
export function localeFor(language: AppLanguage, systemLocales?: readonly string[] | null): string {
  for (const tag of systemLocales ?? []) {
    if (typeof tag !== 'string' || primaryTag(tag) !== language) continue;
    const normal = tag.trim().replace(/_/g, '-').split(/[.@]/)[0];
    try {
      return Intl.getCanonicalLocales(normal)[0] ?? DEFAULT_LOCALE[language];
    } catch {
      continue;
    }
  }
  return DEFAULT_LOCALE[language];
}

/** The system's preferred locales where a browser-like global offers them (the renderer); empty elsewhere. */
export function browserLocales(): string[] {
  const nav = (globalThis as { navigator?: { languages?: readonly string[]; language?: string } }).navigator;
  if (!nav) return [];
  if (Array.isArray(nav.languages) && nav.languages.length > 0) return [...nav.languages];
  return nav.language ? [nav.language] : [];
}

/** localeFor with the locales of this process (the renderer's navigator); the main process passes its own. */
export function displayLocale(language: AppLanguage, systemLocales: readonly string[] = browserLocales()): string {
  return localeFor(language, systemLocales);
}
