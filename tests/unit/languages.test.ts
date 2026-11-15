/**
 * The app's language and locale (shared/i18n and main/systemLanguage.ts): the first-run language from the system, the
 * language used when the settings row cannot be read, the region for dates and numbers inside the chosen language,
 * and lists joined with each language's words. A Russian-speaking person should see Russian from the first start,
 * everyone else English, and dates in their own region's format.
 */
import { describe, expect, it } from 'vitest';
import { joinList, languageFromSystem, languageOf, localeFor } from '../../src/shared/i18n';
import { environmentLocales, setSystemLanguages, systemLanguage, systemLocaleFor } from '../../src/main/systemLanguage';

describe('first-run language from the system', () => {
  it('speaks Russian to a Russian system and English to everyone else', () => {
    expect(languageFromSystem(['ru-RU'])).toBe('ru');
    expect(languageFromSystem(['ru'])).toBe('ru');
    expect(languageFromSystem(['en-US'])).toBe('en');
    // The first language the app speaks wins; one it does not speak is skipped.
    expect(languageFromSystem(['en-GB', 'ru-RU'])).toBe('en');
    expect(languageFromSystem(['de-DE', 'ru-RU'])).toBe('ru');
    expect(languageFromSystem(['de-DE', 'fr-FR'])).toBe('en');
    expect(languageFromSystem(['zh-CN'])).toBe('en');
    expect(languageFromSystem(['ru_RU.UTF-8'])).toBe('ru');
    expect(languageFromSystem([])).toBe('en');
    expect(languageFromSystem(undefined)).toBe('en');
  });

  it('reads the POSIX locale variables when Electron has not said', () => {
    expect(environmentLocales({ LANGUAGE: 'ru_RU:en', LANG: 'en_US.UTF-8' })).toEqual(['ru_RU', 'en', 'en_US.UTF-8']);
    expect(environmentLocales({ LANG: 'C.UTF-8', LC_ALL: 'POSIX' })).toEqual([]);
  });

  it('prefers what the main process was told over the environment', () => {
    setSystemLanguages(['ru-RU', 'en-US']);
    expect(systemLanguage()).toBe('ru');
    expect(systemLocaleFor('en')).toBe('en-US');
    setSystemLanguages(['en-GB']);
    expect(systemLanguage()).toBe('en');
    expect(systemLocaleFor('en')).toBe('en-GB');
    expect(systemLocaleFor('ru')).toBe('ru-RU');
    setSystemLanguages(null);
  });
});

describe('the language of a settings read', () => {
  it('uses the stored language, and the system language when the row cannot be read', () => {
    expect(languageOf({ source: 'stored', values: { language: 'en' }, systemLanguage: 'ru' })).toBe('en');
    expect(languageOf({ source: 'stored', values: { language: 'ru' } })).toBe('ru');
    expect(languageOf({ source: 'corrupt', systemLanguage: 'ru' })).toBe('ru');
    expect(languageOf({ source: 'corrupt', systemLanguage: 'en' })).toBe('en');
    expect(languageOf({ source: 'corrupt' })).toBe('en');
    expect(languageOf({ source: 'stored', values: { language: 'xx' }, systemLanguage: 'ru' })).toBe('ru');
  });
});

describe('locales for dates and numbers', () => {
  it('follows the system region inside the chosen language', () => {
    expect(localeFor('en', ['en-GB'])).toBe('en-GB');
    expect(localeFor('en', ['en_IN.UTF-8'])).toBe('en-IN');
    expect(localeFor('en', ['ru-RU'])).toBe('en-US');
    expect(localeFor('ru', ['en-US', 'ru-UA'])).toBe('ru-UA');
    expect(localeFor('ru', [])).toBe('ru-RU');
    expect(localeFor('en', ['not a locale!'])).toBe('en-US');
  });
});

describe('lists in the words of the language', () => {
  it('joins with the separators and conjunctions of each language', () => {
    expect(joinList(['a', 'b', 'c'], 'en')).toBe('a, b, c');
    expect(joinList(['a', 'b', 'c'], 'en', 'and')).toBe('a, b, and c');
    expect(joinList(['a', 'b', 'c'], 'ru', 'and')).toBe('a, b и c');
    expect(joinList(['a', 'b'], 'en', 'or')).toBe('a or b');
    expect(joinList([], 'en')).toBe('');
    expect(joinList(['one'], 'ru')).toBe('one');
  });
});
