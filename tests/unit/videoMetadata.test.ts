/** Sparse files and virtual containers verify skipped frame ranges, resource budgets and cancellation. */
import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readVideoMetadata, VIDEO_METADATA_MAX, VIDEO_METADATA_LIMIT, VIDEO_METADATA_CANCELLED, VIDEO_METADATA_INVALID, type MetadataSource } from '../../src/shared/workflow/videoMetadata';
import { embeddedWorkflow, readOpenedFile } from '../../src/main/files/openFile';

const workflow = { version: 0.4, nodes: [], links: [] };
const atom = (kind: string, bytes: Buffer) => { const header = Buffer.alloc(8); header.writeUInt32BE(bytes.length + 8); header.write(kind, 4, 'latin1'); return Buffer.concat([header, bytes]); };
const ftyp = atom('ftyp', Buffer.from('isom0000'));
const moov = () => atom('moov', atom('udta', atom('meta', Buffer.concat([Buffer.alloc(4), atom('ilst', atom('©cmt', atom('data', Buffer.concat([Buffer.alloc(8), Buffer.from(JSON.stringify({ workflow }))]))))]))));
const sizes = (value: number, length = 5) => { const result = Buffer.alloc(length); for (let i = length - 1; i >= 0; i--) { result[i] = value % 256; value = Math.floor(value / 256); } result[0] |= 1 << (8 - length); return result; };
const ebml = (hex: string, bytes: Buffer) => Buffer.concat([Buffer.from(hex, 'hex'), sizes(bytes.length), bytes]);
const ebmlHeader = ebml('1a45dfa3', Buffer.alloc(0));
const tags = () => ebml('1254c367', ebml('7373', ebml('67c8', Buffer.concat([ebml('45a3', Buffer.from('WORKFLOW')), ebml('4487', Buffer.from(JSON.stringify(workflow)))]))));
const source = (bytes: Buffer): MetadataSource => ({ size: bytes.length, read: async (at, size) => bytes.subarray(at, at + size) });
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
const parsed = async (reader: MetadataSource, signal?: AbortSignal) => { const bytes = await readVideoMetadata(reader, signal); return bytes && embeddedWorkflow(Buffer.from(bytes)); };

function sparse(parts: Array<{ at: number; data: Buffer }>, size: number) {
  const calls: Array<{ at: number; size: number }> = [];
  const reader = { size, read: async (at: number, length: number) => {
    calls.push({ at, size: length }); const bytes = Buffer.alloc(length);
    for (const part of parts) { const start = Math.max(at, part.at); const end = Math.min(at + length, part.at + part.data.length); if (start < end) part.data.copy(bytes, start - at, start - part.at, end - part.at); }
    return bytes;
  } };
  return { reader, calls };
}

describe('bounded video metadata', () => {
  it('seeks beyond a multi-gigabyte mdat and reads less than 2 KiB, in both MOV and MP4', async () => {
    const dataSize = 5 * 1024 ** 3; const header = Buffer.alloc(16); header.writeUInt32BE(1); header.write('mdat', 4); header.writeBigUInt64BE(BigInt(dataSize), 8);
    const tail = moov(); const end = ftyp.length + dataSize;
    const { reader, calls } = sparse([{ at: 0, data: ftyp }, { at: ftyp.length, data: header }, { at: end, data: tail }], end + tail.length);
    expect(await parsed(reader)).toEqual(workflow);
    expect(calls.reduce((total, call) => total + call.size, 0)).toBeLessThan(2048);
    expect(calls.some(call => call.at > ftyp.length + 16 && call.at < end)).toBe(false);
  });

  it('reads a real sparse desktop file larger than 64 MiB without allocating it', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-video-')); dirs.push(dir);
    const file = path.join(dir, 'large.mp4'); const handle = fs.openSync(file, 'w');
    const size = 128 * 1024 ** 2; const header = Buffer.alloc(8); header.writeUInt32BE(size); header.write('mdat', 4);
    fs.writeSync(handle, ftyp, 0, ftyp.length, 0); fs.writeSync(handle, header, 0, header.length, ftyp.length);
    fs.writeSync(handle, moov(), 0, moov().length, ftyp.length + size); fs.closeSync(handle);
    expect(await readOpenedFile(file)).toEqual({ kind: 'workflow', from: 'video', document: workflow });
  });

  it('reads mdta workflow keys and skips a large cover image', async () => {
    const key = atom('mdta', Buffer.from('workflow')); const count = Buffer.alloc(4); count.writeUInt32BE(1);
    const keys = atom('keys', Buffer.concat([Buffer.alloc(4), count, key]));
    const value = atom('\0\0\0\x01', atom('data', Buffer.concat([Buffer.alloc(8), Buffer.from(JSON.stringify(workflow))])));
    const bytes = Buffer.concat([ftyp, atom('moov', atom('meta', Buffer.concat([Buffer.alloc(4), keys, atom('ilst', Buffer.concat([atom('covr', Buffer.alloc(1024)), value]))]))) ]);
    expect(await parsed(source(bytes))).toEqual(workflow);
  });

  it('follows Matroska SeekHead across an unknown-size Cluster to uppercase workflow Tags', async () => {
    const tagPosition = 3 * 1024 ** 3; const position = Buffer.alloc(8); position.writeBigUInt64BE(BigInt(tagPosition));
    const seek = ebml('114d9b74', ebml('4dbb', Buffer.concat([ebml('53ab', Buffer.from('1254c367', 'hex')), ebml('53ac', position)])));
    const segmentHeader = Buffer.concat([Buffer.from('18538067', 'hex'), Buffer.from('01ffffffffffffff', 'hex')]);
    const start = ebmlHeader.length + segmentHeader.length;
    const cluster = Buffer.concat([Buffer.from('1f43b675ff', 'hex'), Buffer.from('a3', 'hex'), sizes(tagPosition - seek.length - 11)]);
    const tail = tags();
    const { reader, calls } = sparse([{ at: 0, data: Buffer.concat([ebmlHeader, segmentHeader, seek, cluster]) }, { at: start + tagPosition, data: tail }], start + tagPosition + tail.length);
    expect(await parsed(reader)).toEqual(workflow);
    expect(calls.reduce((total, call) => total + call.size, 0)).toBeLessThan(2048);
  });

  it('skips known-size WebM Clusters without a seek table', async () => {
    const bytes = Buffer.concat([ebmlHeader, ebml('18538067', Buffer.concat([ebml('1f43b675', Buffer.alloc(1024)), tags()]))]);
    expect(await parsed(source(bytes))).toEqual(workflow);
  });

  it('cancels before a read and immediately while a read is stalled', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(parsed(source(ftyp), controller.signal)).rejects.toThrow(VIDEO_METADATA_CANCELLED);
    const active = new AbortController(); let calls = 0;
    const pending = parsed({ size: 100, read: () => { calls++; return new Promise(() => {}); } }, active.signal);
    await Promise.resolve(); active.abort();
    await expect(pending).rejects.toThrow(VIDEO_METADATA_CANCELLED); expect(calls).toBe(1);
  });

  it('refuses metadata above its budget before reading its payload, and truncated containers', async () => {
    const header = Buffer.alloc(8); header.writeUInt32BE(VIDEO_METADATA_MAX + 9); header.write('©cmt', 4, 'latin1');
    const udta = Buffer.alloc(8); udta.writeUInt32BE(header.readUInt32BE() + 8); udta.write('udta', 4);
    const moovHead = Buffer.alloc(8); moovHead.writeUInt32BE(udta.readUInt32BE() + 8); moovHead.write('moov', 4);
    const prefix = Buffer.concat([ftyp, moovHead, udta, header]);
    const { reader, calls } = sparse([{ at: 0, data: prefix }], ftyp.length + moovHead.readUInt32BE());
    await expect(parsed(reader)).rejects.toThrow(VIDEO_METADATA_LIMIT);
    expect(calls.every(call => call.size <= 12)).toBe(true);
    await expect(parsed(source(Buffer.concat([ftyp, moov().subarray(0, 18)])))).rejects.toThrow(VIDEO_METADATA_INVALID);
  });

  it('bounds hostile element counts and rejects unsafe 64-bit sizes', async () => {
    await expect(parsed(source(Buffer.concat([ftyp, ...Array.from({ length: 20001 }, () => atom('free', Buffer.alloc(0)))])))).rejects.toThrow(VIDEO_METADATA_LIMIT);
    const header = Buffer.alloc(16, 255); header.writeUInt32BE(1); header.write('mdat', 4);
    await expect(parsed(source(Buffer.concat([ftyp, header])))).rejects.toThrow(VIDEO_METADATA_INVALID);
  });
});
