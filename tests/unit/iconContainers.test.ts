/**
 * The Windows and macOS icon files (resources/icon.ico, resources/icon.icns), which Electron Forge sets on the .exe
 * and the .app when the install scripts build the app there. They hold the same PNGs as the Linux packages
 * (scripts/lib/icon-containers.js); the committed files must be exactly what the packer makes from the committed
 * PNGs, so a redrawn icon cannot leave Windows and macOS with the old picture.
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';

const require = createRequire(import.meta.url);
const { buildIco, buildIcns, pngSize } = require('../../scripts/lib/icon-containers.js');
const { readPngs } = require('../../scripts/make-icon-containers.js');
const RESOURCES = path.join(__dirname, '../../resources');

describe('icon containers', () => {
  const images: Array<[number, Buffer]> = readPngs();

  it('the .ico lists every size up to 256 with its PNG at the stated offset', () => {
    const ico: Buffer = buildIco(images);
    expect(ico.readUInt16LE(2)).toBe(1);
    const count = ico.readUInt16LE(4);
    expect(count).toBe(7);
    for (let i = 0; i < count; i++) {
      const entry = 6 + 16 * i;
      const width = ico.readUInt8(entry) || 256;
      const length = ico.readUInt32LE(entry + 8);
      const offset = ico.readUInt32LE(entry + 12);
      expect(pngSize(ico.subarray(offset, offset + length))).toEqual({ width, height: width });
    }
  });

  it('the .icns has its header length and PNG elements of the right sizes', () => {
    const icns: Buffer = buildIcns(images);
    expect(icns.subarray(0, 4).toString('latin1')).toBe('icns');
    expect(icns.readUInt32BE(4)).toBe(icns.length);
    const want: Record<string, number> = { icp4: 16, icp5: 32, icp6: 64, ic07: 128, ic08: 256, ic09: 512, ic11: 32, ic12: 64, ic13: 256, ic14: 512 };
    const seen: string[] = [];
    for (let at = 8; at < icns.length;) {
      const type = icns.subarray(at, at + 4).toString('latin1');
      const length = icns.readUInt32BE(at + 4);
      expect(pngSize(icns.subarray(at + 8, at + length)).width).toBe(want[type]);
      seen.push(type);
      at += length;
    }
    expect(seen.sort()).toEqual(Object.keys(want).sort());
  });

  it('refuses a picture of the wrong size', () => {
    expect(() => buildIco([[32, images[0][1]]])).toThrow('the 32px icon is 16x16');
    expect(() => buildIcns([[16, Buffer.from('not a png')]])).toThrow('not a PNG file');
  });

  it('the committed files are what the packer makes from the committed PNGs', () => {
    expect(fs.readFileSync(path.join(RESOURCES, 'icon.ico')).equals(buildIco(images))).toBe(true);
    expect(fs.readFileSync(path.join(RESOURCES, 'icon.icns')).equals(buildIcns(images))).toBe(true);
  });
});
