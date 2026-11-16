/** Checks model header repair, file identity matching and safe catalog enrichment. */
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { readSelectedModelHeader, MODEL_HEADER_LIMIT } from '../../src/shared/knowledge/modelHeader';
import { importModelHeaderSchema } from '../../src/shared/knowledge/schemas';
import { migrate } from '../../src/main/settings/migrate';
import { SyncService } from '../../src/main/mcp/sync';

const NAME = 'example.safetensors';
function file(metadata?: Record<string, string>) {
  const text = JSON.stringify({ ...(metadata ? { __metadata__: metadata } : {}), weight: { dtype: 'F32', shape: [1], data_offsets: [0, 4] } });
  const header = new TextEncoder().encode(text);
  const prefix = new Uint8Array(8); new DataView(prefix.buffer).setBigUint64(0, BigInt(header.length), true);
  const reads: Array<[number, number]> = [];
  return { name: NAME, size: header.length + 12, reads, slice(start: number, end: number) {
    reads.push([start, end]);
    if (start === 0 && end === 8) return { arrayBuffer: async () => prefix.buffer };
    if (start === 8 && end === header.length + 8) return { arrayBuffer: async () => header.buffer };
    throw new Error('Tensor weights must never be read');
  } };
}

describe('repairing an unavailable model header from a user-selected file', () => {
  it('reads a header larger than the native route limit without uploading training statistics or reading weights', async () => {
    const selected = file({ 'modelspec.description': 'A LoRA', ss_tag_frequency: 'x'.repeat(2 * 1024 * 1024) });
    const got = await readSelectedModelHeader(selected, `nested/${NAME}`);
    expect(got.headerBytes).toBeGreaterThan(1024 * 1024);
    expect(got.metadata['modelspec.description']).toBe('A LoRA');
    expect(got.metadata.ss_tag_frequency).toHaveLength(4000);
    expect(selected.reads).toEqual([[0, 8], [8, got.headerBytes + 8]]);
  });

  it('distinguishes a readable header with no metadata from a broken or oversized header and wrong selection', async () => {
    expect((await readSelectedModelHeader(file(), NAME)).metadata).toEqual({});
    await expect(readSelectedModelHeader(file(), 'other.safetensors')).rejects.toMatchObject({ code: 'wrongFile' });
    const huge = new ArrayBuffer(8); new DataView(huge).setBigUint64(0, BigInt(MODEL_HEADER_LIMIT + 1), true);
    await expect(readSelectedModelHeader({ name: NAME, size: MODEL_HEADER_LIMIT * 2, slice: () => ({ arrayBuffer: async () => huge }) }, NAME)).rejects.toMatchObject({ code: 'tooLarge' });
    await expect(readSelectedModelHeader({ ...file(), size: 10 }, NAME)).rejects.toMatchObject({ code: 'invalid' });
  });

  it.each([undefined, { 'modelspec.description': 'Recovered description' }])('accepts a selected header, clears exclusions and preserves sidecar facts (%j)', async metadata => {
    const selected = file(metadata);
    const db = new Database(':memory:'); migrate(db);
    db.prepare('INSERT INTO model_catalog (directory, name, size_bytes, description, trigger_words) VALUES (?, ?, ?, ?, ?)').run('loras', NAME, selected.size, 'Sidecar description', '["trigger"]');
    const sync = new SyncService({ readUrl: () => '', readComfyOrigin: () => '', now: () => 1_800_000_000_000 });
    sync.setSkipped(db, 'loras', NAME, true);
    const input = importModelHeaderSchema.parse({ directory: 'loras', name: NAME, catalogRevision: 0, ...await readSelectedModelHeader(selected, NAME) });
    expect(sync.importModelHeader(db, { ...input, fileSize: input.fileSize + 1 }).outcome).toBe('mismatch');
    expect(sync.importModelHeader(db, { ...input, catalogRevision: 9 }).outcome).toBe('stale');
    expect(sync.status(db).unreadable).toHaveLength(1);
    const result = sync.importModelHeader(db, input);
    expect(result.outcome).toBe(metadata ? 'read' : 'empty');
    expect(result.status.metadata).toEqual({ done: 1, total: 1 });
    expect(result.status.unreadable).toEqual([]);
    expect(result.status.headerRepairs).toMatchObject([{ name: NAME, empty: !metadata }]);
    expect(db.prepare('SELECT description, trigger_words FROM model_catalog').get()).toEqual({ description: metadata?.['modelspec.description'] ?? 'Sidecar description', trigger_words: '["trigger"]' });
    expect(sync.importModelHeader(db, input).outcome).toBe('stale');
    db.close();
  });
});
