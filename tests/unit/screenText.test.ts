import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { catalogLeaves, en, ru } from '../../src/shared/i18n';

/** Rules every text on screen follows, in both languages (the glossary of the brief). */
const ROOT = path.join(__dirname, '../..');
const LONG_DASH = /[—–]/;

function leaf(catalog: unknown, key: string): string {
  return String(key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], catalog));
}

describe('texts on screen', () => {
  it('have no long dash: a colon, a comma or two sentences; ranges take a hyphen or "to"', () => {
    const found: string[] = [];
    for (const [name, catalog] of [['en', en], ['ru', ru]] as const) {
      for (const key of catalogLeaves(catalog)) {
        if (LONG_DASH.test(leaf(catalog, key))) found.push(`${name}.${key}`);
      }
    }
    // Lessons and built-in knowledge are text on screen too.
    for (const file of ['src/shared/lessons/texts.en.ts', 'src/shared/lessons/texts.ru.ts', 'src/shared/knowledge/coreKnowledge.en.ts', 'src/shared/knowledge/coreKnowledge.ru.ts']) {
      fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n').forEach((line, index) => {
        if (LONG_DASH.test(line)) found.push(`${file}:${index + 1}`);
      });
    }
    expect(found).toEqual([]);
  });

  it('say input and output, not port or slot, in Russian sentences', () => {
    const found = catalogLeaves(ru)
      .filter((key) => /(^|[^а-яё])(порт(а|у|ом|е|ы|ов|ам|ами|ах)?|слот\p{L}*)([^а-яё]|$)/iu.test(leaf(ru, key)))
      // A port of a network address is a port.
      .filter((key) => !/адрес|http|сервер/i.test(leaf(ru, key)));
    expect(found).toEqual([]);
  });

  it('use American spelling and the glossary words in English', () => {
    const banned = /\b(colour|behaviour|licence|centre|cancelled|uncategorised|revision|inspector)\b/i;
    const found = catalogLeaves(en).filter((key) => banned.test(leaf(en, key).replace(/\{\{[^}]+\}\}/g, '')));
    expect(found).toEqual([]);
  });

  it('quote names with curly quotes in English', () => {
    const found = catalogLeaves(en).filter((key) => /"\{\{/.test(leaf(en, key)));
    expect(found).toEqual([]);
  });
});

describe('fonts for other scripts', () => {
  const tokens = fs.readFileSync(path.join(ROOT, 'src/renderer/theme/tokens.css'), 'utf8');
  const family = (name: string) => (new RegExp(`--${name}:([^;]+);`).exec(tokens)?.[1] ?? '').replace(/\s+/g, ' ');

  it('names Chinese, Japanese and Korean fonts of Linux, Windows and macOS before the generic family', () => {
    const cjk = family('font-cjk');
    for (const font of ['Noto Sans CJK SC', 'Noto Sans CJK JP', 'Noto Sans CJK KR', 'WenQuanYi Zen Hei', 'Microsoft YaHei', 'Malgun Gothic', 'PingFang SC', 'Hiragino Sans']) {
      expect(cjk).toContain(`"${font}"`);
    }
    const sans = family('font-sans');
    expect(sans.indexOf('var(--font-cjk)')).toBeGreaterThan(sans.indexOf('"Geist"'));
    expect(sans.indexOf('var(--font-cjk)')).toBeLessThan(sans.indexOf('sans-serif'));
    expect(family('font-mono')).toContain('var(--font-cjk)');
  });
});
