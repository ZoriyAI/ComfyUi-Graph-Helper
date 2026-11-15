/**
 * The public screenshots (docs/screenshots): the English and Russian folders hold the same pictures, exactly the
 * ones the capture script makes, and each gallery page shows every picture of its language once and nothing else.
 * Why: the pictures are made by `npm run shots:public` and the pages are written by hand; this keeps them in step.
 */
import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_SHOTS, README_SHOTS } from '../e2e/public-shots/shotList';

const ROOT = path.join(__dirname, '../../docs/screenshots');
/** The pictures in one language folder; `linked` lists the pictures a gallery page links, in order. */
const pngs = (language: string) => fs.readdirSync(path.join(ROOT, language)).filter((name) => name.endsWith('.png')).sort();
const linked = (page: string, language: string) => Array.from(fs.readFileSync(path.join(ROOT, page), 'utf8').matchAll(/\]\(([a-z]{2})\/([^)]+\.png)\)/g))
  .map((match) => { expect(match[1], `${page} links a picture of another language`).toBe(language); return match[2]; });

describe('public screenshots', () => {
  it('both folders hold the same pictures, the ones in the shot list', () => {
    const expected = PUBLIC_SHOTS.map((name) => `${name}.png`).sort();
    expect(pngs('en')).toEqual(expected);
    expect(pngs('ru')).toEqual(expected);
  });

  it('each gallery page shows every picture of its language once, in order', () => {
    const expected = PUBLIC_SHOTS.map((name) => `${name}.png`);
    expect(linked('README.md', 'en')).toEqual(expected);
    expect(linked('README.ru.md', 'ru')).toEqual(expected);
  });

  it('the pictures stay small enough for a README', () => {
    for (const language of ['en', 'ru']) {
      for (const name of pngs(language)) expect(fs.statSync(path.join(ROOT, language, name)).size, `${language}/${name}`).toBeLessThan(500 * 1024);
    }
  });

  it('the wide pictures are composed at their sizes (README top 1600x800, social preview 1280x640 under 1 MB)', () => {
    // A PNG stores its width and height as big-endian numbers at bytes 16 and 20.
    const size = (name: string) => { const png = fs.readFileSync(path.join(ROOT, name)); return [png.readUInt32BE(16), png.readUInt32BE(20)]; };
    expect(size('hero.png')).toEqual([1600, 800]);
    expect(size('social-preview.png')).toEqual([1280, 640]);
    expect(fs.statSync(path.join(ROOT, 'social-preview.png')).size).toBeLessThan(1024 * 1024);
  });

  it('the README shots are part of the set', () => {
    for (const name of README_SHOTS) expect(PUBLIC_SHOTS).toContain(name);
  });
});
