/** Exercises model header reading through recovered MCP sessions and direct fallback paths. */
import { describe, expect, it } from 'vitest';
import { readOnlySession, readSessionModelHeader } from '../../src/main/mcp/readOnly';
import type { McpSession } from '../../src/shared/mcp/catalogSource';

import { headerBytes } from '../fixtures/modelHeader';
function reader(bytes: Buffer, mutate?: (row: Record<string, unknown>) => void) {
  const reads: Array<[number, number]> = [];
  const raw: McpSession = { listTools: async () => [{ name: 'gateway_workspace_files' }, { name: 'gateway_models' }], close: async () => undefined,
    callTool: async (name, args) => {
      expect(name).toBe('gateway_workspace_files');
      const start = Number(args.offset), length = Number(args.length); reads.push([start, length]);
      const row = { data_base64: bytes.subarray(start, start + length).toString('base64'), size_bytes: bytes.length, next_offset: start + length };
      mutate?.(row); return { structuredContent: row };
    } };
  return { session: readOnlySession(raw, { roots: ['/models'] }), reads };
}
describe('bounded automatic model header recovery', () => {
  it.each([undefined, { description: 'x'.repeat(2 * 1024 * 1024) }])('reads optional/large metadata and never reads tensor bytes', async (metadata) => {
    const bytes = headerBytes(metadata), r = reader(bytes);
    const result = await readSessionModelHeader(r.session, '/models/test.safetensors', 'test.safetensors', bytes.length);
    expect(result?.metadata).toEqual(metadata ? { description: 'x'.repeat(4000) } : {});
    expect(r.reads.reduce((sum, [, length]) => sum + length, 0)).toBe(bytes.length - 4);
    expect(r.reads.every(([offset, length]) => length <= 1024 * 1024 && offset + length <= bytes.length - 4)).toBe(true);
    await expect(r.session.callTool('workspace_files', { action: 'read', absolute_path: '/models/test.safetensors', encoding: 'base64', offset: 0, length: 100 })).rejects.toThrow();
  });
  it('rejects paths outside known roots before any call', async () => {
    const bytes = headerBytes(), r = reader(bytes);
    await expect(readSessionModelHeader(r.session, '/private/test.safetensors', 'test.safetensors', bytes.length)).rejects.toThrow();
    expect(r.reads).toEqual([]);
  });
  it.each(['size_bytes', 'next_offset', 'data_base64'])('rejects a mismatched %s response', async key => {
    const bytes = headerBytes(), r = reader(bytes, row => { row[key] = key === 'data_base64' ? 'AAAA' : 0; });
    await expect(readSessionModelHeader(r.session, '/models/test.safetensors', 'test.safetensors', bytes.length)).rejects.toThrow();
    expect(r.reads).toHaveLength(1);
  });
  it('stops at the prefix when cancelled; rejects oversized declarations before reading them', async () => {
    const bytes = headerBytes(), controller = new AbortController(), r = reader(bytes, () => controller.abort());
    await expect(readSessionModelHeader(r.session, '/models/test.safetensors', 'test.safetensors', bytes.length, controller.signal)).rejects.toThrow();
    expect(r.reads).toHaveLength(1);
    bytes.writeBigUInt64LE(BigInt(65 * 1024 * 1024));
    const large = reader(bytes);
    await expect(readSessionModelHeader(large.session, '/models/test.safetensors', 'test.safetensors', bytes.length)).rejects.toMatchObject({ code: 'tooLarge' });
    expect(large.reads).toHaveLength(1);
  });
});
