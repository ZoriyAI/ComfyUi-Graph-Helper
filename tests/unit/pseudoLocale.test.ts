/**
 * The pseudo-translation used by the layout tests (src/shared/i18n/pseudo, switched on by NODEWISE_PSEUDO_LOCALE in
 * src/main/systemLanguage): texts about 40 % longer with accents, padded with short words, and never on in an
 * installed app.
 * Why: it shows where a longer translation would break the layout, and must never reach a person's real window.
 */
import { describe, expect, it } from 'vitest';
import { pseudoText } from '../../src/shared/i18n/pseudo';
import { pseudoLocaleWanted } from '../../src/main/systemLanguage';

describe('the pseudo-translation of the layout tests', () => {
  it('makes a text about 40 % longer, with accents, and keeps its own words readable', () => {
    const text = 'Save workflow for ComfyUI…';
    const long = pseudoText(text);
    expect([...long].length).toBeGreaterThanOrEqual(Math.round(text.length * 1.4));
    expect(long.startsWith('Sávé wórkflów fór CómfýUI…')).toBe(true);
    expect(pseudoText('Сохранить')).toContain('Сӧхрӓнӣть');
    expect(pseudoText('')).toBe('');
  });

  it('pads with words of at most twelve letters, so a text still wraps', () => {
    const long = pseudoText('x'.repeat(100));
    expect(long.split(' ').slice(1).every((word) => [...word].length <= 12)).toBe(true);
  });

  it('is never on in an installed app', () => {
    expect(pseudoLocaleWanted(true, { NODEWISE_PSEUDO_LOCALE: '1' })).toBe(false);
    expect(pseudoLocaleWanted(false, { NODEWISE_PSEUDO_LOCALE: '1' })).toBe(true);
    expect(pseudoLocaleWanted(false, {})).toBe(false);
  });
});
