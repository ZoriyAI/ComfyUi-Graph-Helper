/**
 * Protects the colour contrast of the theme (renderer/theme/contrast and tokens.css): every painted text and
 * background pair stays above its WCAG floor, and CONTRAST.md lists each measured ratio. A person with low vision
 * must be able to read every label, and a token change that breaks this fails here first.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CONTRAST_PAIRS, contrastRatio, measurePairs, parseColor, readRootTokens } from '../../src/renderer/theme/contrast';

/** The theme tokens are read straight from the stylesheet the app ships. */
const css = fs.readFileSync(path.join(__dirname, '../../src/renderer/theme/tokens.css'), 'utf8');
const tokens = readRootTokens(css);

describe('theme contrast', () => {
  it('computes WCAG ratios', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(parseColor('#65d9ed')).toEqual([101, 217, 237]);
    expect(parseColor('rgba(1, 2, 3, 0.5)')).toEqual([1, 2, 3]);
  });

  it('resolves aliases from the root block', () => {
    expect(tokens['--accent']).toBe('#65d9ed');
    expect(tokens['--surface']).toBe(tokens['--surface-panel']);
  });

  it('keeps every painted pair above its floor', () => {
    const measured = measurePairs(tokens);
    expect(measured).toHaveLength(CONTRAST_PAIRS.length);
    for (const pair of measured) {
      expect(pair.ratio, `${pair.fg} on ${pair.over ? `${pair.over} over ` : ''}${pair.bg}`).toBeGreaterThanOrEqual(pair.min);
    }
  });

  it('lists every measured pair in CONTRAST.md', () => {
    const doc = fs.readFileSync(path.join(__dirname, '../../src/renderer/theme/CONTRAST.md'), 'utf8');
    for (const pair of measurePairs(tokens)) {
      expect(doc).toContain(`| \`${pair.fg}\` | \`${pair.over ? `${pair.over} over ${pair.bg}` : pair.bg}\` | ${pair.ratio.toFixed(2)} |`);
    }
  });
});
