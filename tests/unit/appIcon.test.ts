/**
 * The app icon (resources/icon.svg, icon-small.svg, rendered by scripts/render-icons.js): every size the Linux
 * packages and the window use is a PNG of exactly that size, and the vector sources carry no letters, so a new
 * product name never needs a new icon.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const RESOURCES = path.join(__dirname, '../../resources');
const sizeOf = (file: string) => {
  const png = fs.readFileSync(file);
  expect(png.subarray(1, 4).toString('ascii'), file).toBe('PNG');
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
};

describe('app icon', () => {
  it('every package size is a PNG of that size, and the window icon is 512', () => {
    for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) expect(sizeOf(path.join(RESOURCES, 'icons', `${size}x${size}.png`))).toEqual([size, size]);
    expect(sizeOf(path.join(RESOURCES, 'icon.png'))).toEqual([512, 512]);
  });

  it('the vector sources hold no text', () => {
    for (const name of ['icon.svg', 'icon-small.svg']) expect(fs.readFileSync(path.join(RESOURCES, name), 'utf8')).not.toMatch(/<text\b/);
  });
});
