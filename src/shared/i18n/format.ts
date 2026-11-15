import { en, ru } from './catalog';
import { displayLocale, type AppLanguage } from './languages';

const CATALOGS = { en, ru } as const;

/**
 * Numbers, sizes and dates in the chosen language, written the way the person's system writes them in that
 * language (en-GB: 14 Nov 2026; en-US: Nov 14, 2026). `locales` are the system's (the renderer's navigator by default).
 */
export function formatNumber(value: number, language: AppLanguage, options: Intl.NumberFormatOptions = {}, locales?: readonly string[]): string {
  return new Intl.NumberFormat(displayLocale(language, locales), options).format(value);
}

/** A file size with its unit word from the catalog: 940 B, 1.5 KB, 12 GB. */
export function formatByteSize(bytes: number, language: AppLanguage, locales?: readonly string[], largest: 'gigabytes' | 'terabytes' = 'terabytes'): string {
  const units = CATALOGS[language].units;
  const order = (['bytes', 'kilobytes', 'megabytes', 'gigabytes', 'terabytes'] as const).slice(0, largest === 'gigabytes' ? 4 : 5);
  let value = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  let unit = 0;
  while (value >= 1024 && unit < order.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${formatNumber(value, language, { maximumFractionDigits: digits, minimumFractionDigits: digits }, locales)} ${units[order[unit]]}`;
}

export function formatDateTime(timestamp: number, language: AppLanguage, options: Intl.DateTimeFormatOptions, locales?: readonly string[]): string {
  return new Intl.DateTimeFormat(displayLocale(language, locales), options).format(timestamp);
}
