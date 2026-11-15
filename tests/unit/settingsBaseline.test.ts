/**
 * Unit test for settingsBaseline (src/shared/config/draft.ts): the row Settings starts from and returns to on Cancel.
 * On a first start of an English system, closing Settings without saving must leave the window English (it used to
 * go back to the schema default, Russian).
 */
import { describe, expect, it } from 'vitest';
import { settingsBaseline } from '../../src/shared/config/draft';
import { nonSecretDefaults } from '../../src/shared/config/schema';

describe('settingsBaseline', () => {
  it('keeps the system language of a first start', () => {
    const read = { source: 'default' as const, values: { ...nonSecretDefaults, language: 'en' as const }, systemLanguage: 'en' as const };
    expect(settingsBaseline(read, 'en').language).toBe('en');
  });

  it('uses the shown language when a first-start read carries the schema default', () => {
    const read = { source: 'default' as const, values: nonSecretDefaults, systemLanguage: 'en' as const };
    expect(settingsBaseline(read, 'en')).toEqual({ ...nonSecretDefaults, language: 'en' });
  });

  it('falls back to the defaults in the shown language for a damaged row', () => {
    expect(settingsBaseline({ source: 'corrupt', systemLanguage: 'ru' }, 'ru')).toEqual({ ...nonSecretDefaults, language: 'ru' });
    expect(settingsBaseline({ source: 'corrupt', systemLanguage: 'en' }, 'en').language).toBe('en');
  });

  it('returns a stored row as it is', () => {
    const values = { ...nonSecretDefaults, language: 'ru' as const, model: 'stored-model' };
    expect(settingsBaseline({ source: 'stored', values }, 'ru')).toBe(values);
  });
});
