/**
 * Unit test for formatMegabytes (src/shared/i18n/format.ts): the web-page byte cap that Preferences states is written
 * with the unit word of the interface language, so a Russian screen never shows the English "MB".
 */
import { describe, expect, it } from 'vitest';
import { formatMegabytes } from '../../src/shared/i18n/format';
import { FETCH_PAGE_BYTE_CAP } from '../../src/shared/agent/limits';

describe('formatMegabytes', () => {
  it('writes the cap in the chosen language', () => {
    expect(formatMegabytes(FETCH_PAGE_BYTE_CAP, 'en', ['en-US'])).toBe('10 MB');
    expect(formatMegabytes(FETCH_PAGE_BYTE_CAP, 'ru', ['ru-RU'])).toBe('10 МБ');
  });

  it('rounds to whole megabytes and treats nonsense as zero', () => {
    expect(formatMegabytes(1.6 * 1024 * 1024, 'en', ['en-US'])).toBe('2 MB');
    expect(formatMegabytes(Number.NaN, 'ru', ['ru-RU'])).toBe('0 МБ');
  });
});
