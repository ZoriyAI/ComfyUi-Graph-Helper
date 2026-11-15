/**
 * WCAG 2.x contrast helpers and the token pairs the interface actually paints.
 * tests/unit/contrast.test.ts reads tokens.css, resolves every pair below and checks the floor;
 * theme/CONTRAST.md records the measured values. Only that test imports this module; the app does not.
 * Why: readable text on every surface is a product rule (WCAG AA), and a token change must not break it unseen.
 */
/** A colour as red, green and blue, 0 to 255. */
export type Rgb = [number, number, number];

/** Reads '#rrggbb', 'rgb(...)' or 'rgba(...)' (alpha ignored here); null for anything else. */
export function parseColor(value: string): Rgb | null {
  const text = value.trim();
  const hex = text.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = text.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(',').map((part) => Number(part.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every((part) => Number.isFinite(part))) return [parts[0], parts[1], parts[2]];
  }
  return null;
}

/** Alpha of an rgba() value, 1 for anything opaque. */
export function alphaOf(value: string): number {
  const rgb = value.trim().match(/^rgba\(([^)]+)\)$/i);
  if (!rgb) return 1;
  const parts = rgb[1].split(',').map((part) => Number(part.trim()));
  return parts.length === 4 && Number.isFinite(parts[3]) ? parts[3] : 1;
}

/** `top` at `alpha` painted over `below`: the colour the eye sees. */
export function blend(top: Rgb, alpha: number, below: Rgb): Rgb {
  return [0, 1, 2].map((index) => Math.round(top[index] * alpha + below[index] * (1 - alpha))) as Rgb;
}

/** One sRGB channel made linear, as WCAG defines it. */
function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1 to 21; 4.5 is the floor for body text, 3 for large text and non-text marks. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const left = luminance(a);
  const right = luminance(b);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

/** Reads `--name: value;` declarations from the first :root block of a stylesheet and resolves var() aliases. */
export function readRootTokens(css: string): Record<string, string> {
  const start = css.indexOf(':root');
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = start >= 0 && open > start && close > open ? css.slice(open + 1, close) : '';
  const raw: Record<string, string> = {};
  for (const match of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) raw[match[1]] = match[2].trim();
  const resolve = (value: string, depth = 0): string => {
    const alias = value.match(/^var\((--[a-z0-9-]+)\)$/i);
    if (!alias || depth > 8) return value;
    return resolve(raw[alias[1]] ?? value, depth + 1);
  };
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, resolve(value)]));
}

/** One colour pair the interface paints, with the ratio it must reach and where it is used. */
export interface ContrastPair {
  /** Text token. */
  fg: string;
  /** Surface token; a translucent `over` token is composited on `bg` first. */
  bg: string;
  over?: string;
  min: number;
  use: string;
}

/** The surfaces body text can sit on. */
const SURFACES = ['--surface-canvas', '--surface-panel', '--surface-raised', '--surface-overlay', '--surface-sunken', '--surface-hover'];

/** Every pair the test checks. */
export const CONTRAST_PAIRS: ContrastPair[] = [
  ...SURFACES.flatMap((bg) => [
    { fg: '--text', bg, min: 4.5, use: 'body text' },
    { fg: '--text-dim', bg, min: 4.5, use: 'secondary text, hints' },
    { fg: '--text-faint', bg, min: 4.5, use: 'disabled and tertiary text' },
  ]),
  ...['--surface-panel', '--surface-raised', '--surface-overlay'].flatMap((bg) => [
    { fg: '--accent', bg, min: 4.5, use: 'accent text and links' },
    { fg: '--ai', bg, min: 4.5, use: 'AI and focus text' },
    { fg: '--warn', bg, min: 4.5, use: 'warning text' },
    { fg: '--danger', bg, min: 4.5, use: 'error text' },
    { fg: '--ok', bg, min: 4.5, use: 'success text' },
    { fg: '--text-mono', bg, min: 4.5, use: 'class types and ids' },
  ]),
  { fg: '--text', bg: '--surface-active', min: 4.5, use: 'selected row text' },
  { fg: '--text-dim', bg: '--surface-active', min: 4.5, use: 'selected row secondary text' },
  { fg: '--on-accent', bg: '--accent', min: 4.5, use: 'primary button label' },
  { fg: '--on-warn', bg: '--warn', min: 4.5, use: 'warning button label' },
  { fg: '--on-danger', bg: '--danger-strong', min: 4.5, use: 'danger button label' },
  { fg: '--accent', bg: '--surface-raised', over: '--accent-soft', min: 4.5, use: 'accent badge' },
  { fg: '--ai', bg: '--surface-raised', over: '--ai-soft', min: 4.5, use: 'AI / inference badge' },
  { fg: '--warn', bg: '--surface-raised', over: '--warn-soft', min: 4.5, use: 'warning badge' },
  { fg: '--danger', bg: '--surface-raised', over: '--danger-soft', min: 4.5, use: 'error badge' },
  { fg: '--ok', bg: '--surface-raised', over: '--ok-soft', min: 4.5, use: 'fact / success badge' },
  { fg: '--focus', bg: '--surface-panel', min: 3, use: 'focus ring (non-text, 3:1)' },
  { fg: '--border-strong', bg: '--surface-panel', min: 3, use: 'control border (non-text, 3:1)' },
  ...['--type-model', '--type-clip', '--type-vae', '--type-conditioning', '--type-latent', '--type-image', '--type-mask',
    '--type-controlnet', '--type-string', '--type-int', '--type-float'].map((fg) => (
    { fg, bg: '--surface-canvas', min: 3, use: 'port and edge colour (non-text, 3:1)' }
  )),
];

/** A pair with its measured ratio (0 when a token could not be read). */
export interface MeasuredPair extends ContrastPair {
  ratio: number;
}

/** Measures each pair against the given tokens. */
export function measurePairs(tokens: Record<string, string>, pairs: ContrastPair[] = CONTRAST_PAIRS): MeasuredPair[] {
  return pairs.map((pair) => {
    const fg = parseColor(tokens[pair.fg] ?? '');
    let bg = parseColor(tokens[pair.bg] ?? '');
    if (pair.over && bg) {
      const overValue = tokens[pair.over] ?? '';
      const over = parseColor(overValue);
      if (over) bg = blend(over, alphaOf(overValue), bg);
    }
    const ratio = fg && bg ? contrastRatio(fg, bg) : 0;
    return { ...pair, ratio };
  });
}
