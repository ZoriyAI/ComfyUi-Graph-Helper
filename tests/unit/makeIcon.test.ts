import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { makeIcon, crc32 } = require('../../scripts/make-icon.js') as {
  makeIcon: (output: string, size?: number) => Buffer;
  crc32: (buffer: Buffer) => number;
};

describe('make-icon script', () => {
  it('writes a valid RGBA PNG with the PNG signature and IHDR', () => {
    const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'icon-')), 'icon.png');
    makeIcon(output, 64);
    const png = fs.readFileSync(output);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.readUInt32BE(8)).toBe(13);
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(64);
    expect(png.readUInt32BE(20)).toBe(64);
    expect(png[24]).toBe(8);
    expect(png[25]).toBe(6);
    expect(png.readUInt32BE(29)).toBe(crc32(png.subarray(12, 29)));
    // IDAT inflates to height rows of (1 filter byte + width * 4).
    const idatAt = png.indexOf(Buffer.from('IDAT'));
    const length = png.readUInt32BE(idatAt - 4);
    const raw = zlib.inflateSync(png.subarray(idatAt + 4, idatAt + 4 + length));
    expect(raw.length).toBe(64 * (1 + 64 * 4));
    expect(png.subarray(png.length - 8, png.length - 4).toString('ascii')).toBe('IEND');
  });

  it('the committed icon is a 512x512 PNG', () => {
    const png = fs.readFileSync(path.join(__dirname, '../../resources/icon.png'));
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(512);
    expect(png.readUInt32BE(20)).toBe(512);
  });
});
