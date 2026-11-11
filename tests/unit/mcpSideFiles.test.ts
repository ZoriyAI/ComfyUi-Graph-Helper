import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import type { McpSession } from '../../src/shared/mcp/catalogSource';
import { McpRefusedError, readOnlySession } from '../../src/main/mcp/readOnly';
import { readSideFile, sideFilePath } from '../../src/main/mcp/sideFiles';
import { migrate } from '../../src/main/settings/migrate';

/** A server that holds one file and answers `workspace_files` read a slice at a time, at most `cap` bytes each. */
function serverWith(files: Record<string, Buffer>, cap = 1048576): { session: McpSession; calls: Array<Record<string, unknown>> } {
  const calls: Array<Record<string, unknown>> = [];
  const session: McpSession = {
    async listTools() {
      return [{ name: 'workspace_files' }];
    },
    async callTool(name, args) {
      calls.push({ name, ...args });
      const bytes = files[String(args.absolute_path)];
      if (!bytes) return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: { code: 'ADMIN_FILE_NOT_FOUND' } }) }] };
      const offset = Number(args.offset ?? 0);
      const slice = bytes.subarray(offset, offset + Math.min(Number(args.length ?? 65536), cap));
      const next = offset + slice.length;
      return { content: [{ type: 'text', text: JSON.stringify({ data_base64: slice.toString('base64'), offset, next_offset: next, total: bytes.length, size_bytes: bytes.length, complete: next >= bytes.length }) }] };
    },
    async close() {},
  };
  return { session: readOnlySession(session), calls };
}

describe('the path of a file next to a model', () => {
  it('is the folder and the name, and nothing that leaves the folder or is not such a file', () => {
    expect(sideFilePath('/srv/models/loras', 'style.metadata.json')).toBe('/srv/models/loras/style.metadata.json');
    expect(sideFilePath('/srv/models/loras/', 'sub/style.webp')).toBe('/srv/models/loras/sub/style.webp');
    for (const [root, name] of [
      [null, 'a.webp'], ['', 'a.webp'], ['/srv/models/loras', null], ['/srv/models/loras', ''],
      ['C:\\models\\loras', 'a.webp'], ['relative/loras', 'a.webp'],
      ['/srv/models/loras', '../../etc/passwd.png'], ['/srv/models/loras', 'a.safetensors'], ['/srv/models/loras', 'notes.txt'],
    ] as Array<[string | null, string | null]>) {
      expect(sideFilePath(root, name), `${root} + ${name}`).toBeNull();
    }
  });
});

describe('reading a file next to a model', () => {
  const path = '/srv/models/loras/style.webp';

  it('reads the whole file through the read-only gate, a chunk at a time', async () => {
    const bytes = Buffer.from(Array.from({ length: 2500 }, (_, index) => index % 251));
    const { session, calls } = serverWith({ [path]: bytes }, 1000);
    const read = await readSideFile(session, path, 10_000);
    expect(read?.equals(bytes)).toBe(true);
    expect(calls.map((call) => call.offset)).toEqual([0, 1000, 2000]);
    for (const call of calls) expect(call).toMatchObject({ name: 'workspace_files', action: 'read', encoding: 'base64', absolute_path: path });
    // An empty file is a file.
    const empty = serverWith({ [path]: Buffer.alloc(0) });
    expect((await readSideFile(empty.session, path, 10_000))?.length).toBe(0);
  });

  it('gives nothing for a file that is missing or larger than allowed, without reading it to the end', async () => {
    const missing = serverWith({});
    expect(await readSideFile(missing.session, path, 10_000)).toBeNull();
    const large = serverWith({ [path]: Buffer.alloc(50_000, 7) }, 1000);
    expect(await readSideFile(large.session, path, 10_000)).toBeNull();
    expect(large.calls).toHaveLength(1);
  });

  it('gives nothing when the answer is not what the tool gives, and never loops', async () => {
    const odd = (payload: unknown): McpSession => readOnlySession({
      async listTools() { return []; },
      async callTool() { return { content: [{ type: 'text', text: JSON.stringify(payload) }] }; },
      async close() {},
    });
    expect(await readSideFile(odd({ data: 'text only' }), path, 10_000)).toBeNull();
    expect(await readSideFile(odd('plain words'), path, 10_000)).toBeNull();
    // A server that keeps answering with nothing and never says it is done.
    expect(await readSideFile(odd({ data_base64: '', complete: false }), path, 10_000)).toBeNull();
    // A server that says the next slice starts somewhere else than where this one ended.
    expect(await readSideFile(odd({ data_base64: Buffer.from('abc').toString('base64'), next_offset: 99, complete: false }), path, 10_000)).toBeNull();
  });

  it('refuses a path that is not a file next to a model before any call is made', async () => {
    const { session, calls } = serverWith({ '/srv/models/loras/style.safetensors': Buffer.from('x') });
    await expect(readSideFile(session, '/srv/models/loras/style.safetensors', 10_000)).rejects.toBeInstanceOf(McpRefusedError);
    await expect(readSideFile(session, '/home/someone/.ssh/id_rsa', 10_000)).rejects.toBeInstanceOf(McpRefusedError);
    expect(calls).toEqual([]);
  });
});

describe('the catalog columns for the files next to a model (migration v12)', () => {
  it('adds them to a database of the version before, leaving its rows as they were', () => {
    const db = new Database(':memory:');
    migrate(db);
    // As version 11 left the table: without the new columns.
    for (const column of ['sidecar_file', 'sidecar_sig', 'sidecar_read_sig', 'preview_file', 'preview_sig', 'notes_json']) db.exec(`ALTER TABLE model_catalog DROP COLUMN ${column}`);
    db.prepare('DELETE FROM schema_migrations WHERE version >= 12').run();
    db.prepare("INSERT INTO model_catalog (directory, name, size_bytes, kind, base_model, enriched_at) VALUES ('loras', 'old.safetensors', 5, 'lora', 'sdxl', 3)").run();
    migrate(db);
    const row = db.prepare("SELECT * FROM model_catalog WHERE name = 'old.safetensors'").get() as Record<string, unknown>;
    expect(row).toMatchObject({ size_bytes: 5, kind: 'lora', base_model: 'sdxl', enriched_at: 3, sidecar_file: null, sidecar_sig: null, sidecar_read_sig: null, preview_file: null, preview_sig: null, notes_json: '{}' });
    // Opening it again changes nothing.
    migrate(db);
    expect((db.prepare('SELECT COUNT(*) AS n FROM schema_migrations WHERE version = 12').get() as { n: number }).n).toBe(1);
    db.close();
  });
});
