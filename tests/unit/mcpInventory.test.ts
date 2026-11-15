/**
 * The model file inventory read through the MCP `models` tool (src/main/mcp/inventory): one paged listing per
 * category, only loader files kept, a failed category leaving the rest, older servers that list everything at once,
 * and the description and preview files that lie next to each model, matched by folder and root.
 * Why: the model library and the tutor's advice are built from this list, so a missing folder or a wrong preview
 * would show the person a library that is not theirs.
 */
import { describe, expect, it } from 'vitest';
import { readModelFilesWithRoots } from '../../src/main/mcp/inventory';
import { McpPageError } from '../../src/shared/mcp/catalogSource';
import type { McpSession, McpToolCallResult } from '../../src/shared/mcp/catalogSource';

/** Wraps a value the way an MCP tool answers: one text content block holding JSON. */
function json(value: unknown): McpToolCallResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

type Row = Record<string, unknown>;

/** TEST fixture: the current server shape. The plain listing names categories; files come one category at a time, paged. */
function categoryFirstServer(files: Record<string, Row[]>, options: { failing?: string[]; pageSize?: number } = {}) {
  const calls: Row[] = [];
  const session: McpSession = {
    async listTools() {
      return [{ name: 'models' }];
    },
    async callTool(name, args) {
      calls.push({ name, ...args });
      if (name !== 'models') throw new Error(`unexpected ${name}`);
      const category = typeof args.category === 'string' ? args.category : null;
      if (!category) {
        const categories = ['.cache', ...Object.keys(files)];
        return json({ items: categories.map((item) => ({ category: item })), total: categories.length, complete: true });
      }
      if (options.failing?.includes(category)) return { isError: true, content: [{ type: 'text', text: 'boom' }] };
      const rows = files[category] ?? [];
      const size = options.pageSize ?? rows.length;
      const start = typeof args.cursor === 'string' ? Number(args.cursor) : 0;
      const page = rows.slice(start, start + size);
      const next = start + size < rows.length ? String(start + size) : null;
      return json({ items: page, next_cursor: next, total: rows.length, complete: next === null });
    },
    async close() {},
  };
  return { session, calls };
}

describe('model files from the current server', () => {
  const files = {
    loras: [
      { category: 'loras', filename: 'style.safetensors', root_path: '/models/loras', size_bytes: 10 },
      { category: 'loras', filename: '.cache/huggingface/.gitignore', root_path: '/models/loras', size_bytes: 1 },
      { category: 'loras', filename: 'detail.safetensors', root_path: '/models/loras', size_bytes: 20 },
      { category: 'loras', filename: 'readme.txt', root_path: '/models/loras', size_bytes: 3 },
    ],
    checkpoints: [{ category: 'checkpoints', filename: 'base.safetensors', root_path: '/models/checkpoints', size_bytes: 30 }],
    LLM: [],
  };

  it('expands every category row into its own paged listing and keeps only loader files', async () => {
    const { session, calls } = categoryFirstServer(files, { pageSize: 2 });
    const read = await readModelFilesWithRoots(session);
    expect(read.complete).toBe(true);
    expect(read.items.map((item) => `${item.directory}/${item.name}`).sort()).toEqual([
      'checkpoints/base.safetensors', 'loras/detail.safetensors', 'loras/style.safetensors',
    ]);
    expect(read.items.find((item) => item.name === 'detail.safetensors')).toMatchObject({ sizeBytes: 20, rootPath: '/models/loras' });
    // The plain listing, then one listing per category (the hidden .cache folder is not a category); loras took two pages.
    const categories = calls.filter((call) => call.name === 'models').map((call) => call.category ?? '(all)');
    expect(categories).toEqual(['(all)', 'loras', 'loras', 'checkpoints', 'LLM']);
    expect(calls.some((call) => call.category === '.cache')).toBe(false);
  });

  it('keeps the other folders when one category fails and marks the run incomplete', async () => {
    const { session } = categoryFirstServer(files, { failing: ['loras'] });
    const read = await readModelFilesWithRoots(session);
    expect(read.complete).toBe(false);
    expect(read.items.map((item) => item.name)).toEqual(['base.safetensors']);
  });

  it('fails the section only when every category failed', async () => {
    const { session } = categoryFirstServer(files, { failing: ['loras', 'checkpoints', 'LLM'] });
    await expect(readModelFilesWithRoots(session)).rejects.toBeInstanceOf(McpPageError);
  });

  it('still reads an older server that lists files in the plain listing', async () => {
    const session: McpSession = {
      async listTools() {
        return [{ name: 'models' }];
      },
      async callTool(_name, args) {
        if (typeof args.category === 'string') throw new Error('older servers take no category');
        return json({ items: [
          { category: 'loras', filename: 'a.safetensors', root_path: '/m/loras', size_bytes: 1 },
          { category: 'loras', filename: 'a.safetensors', root_path: '/m/loras', size_bytes: 1 },
          { category: 'vae', filename: 'v.pt' },
        ] });
      },
      async close() {},
    };
    const read = await readModelFilesWithRoots(session);
    expect(read.complete).toBe(true);
    expect(read.items).toEqual([
      { directory: 'loras', name: 'a.safetensors', sizeBytes: 1, rootPath: '/m/loras', sidecarFile: null, sidecarSig: null, previewFile: null, previewSig: null },
      { directory: 'vae', name: 'v.pt', sizeBytes: null, rootPath: null, sidecarFile: null, sidecarSig: null, previewFile: null, previewSig: null },
    ]);
  });

  it('hands each model the description and the preview that lie next to it, by folder and by root', async () => {
    const rows: Record<string, Array<Record<string, unknown>>> = {
      loras: [
        { category: 'loras', filename: 'style.safetensors', root_path: '/shared/loras', size_bytes: 100 },
        { category: 'loras', filename: 'style.metadata.json', root_path: '/shared/loras', size_bytes: 2000 },
        { category: 'loras', filename: 'style.civitai.info', root_path: '/shared/loras', size_bytes: 900 },
        { category: 'loras', filename: 'style.mp4', root_path: '/shared/loras', size_bytes: 50000 },
        { category: 'loras', filename: 'style.webp', root_path: '/shared/loras', size_bytes: 8000 },
        // The same names under another root belong to another file, which the listing does not have.
        { category: 'loras', filename: 'other.webp', root_path: '/local/loras', size_bytes: 7000 },
        { category: 'loras', filename: 'other.safetensors', root_path: '/shared/loras', size_bytes: 100 },
        { category: 'loras', filename: 'sub/deep.safetensors', root_path: '/shared/loras', size_bytes: 100 },
        { category: 'loras', filename: 'sub/deep.preview.png', root_path: '/shared/loras' },
        { category: 'loras', filename: 'readme.txt', root_path: '/shared/loras', size_bytes: 10 },
        { category: 'loras', filename: '.cache/x.webp', root_path: '/shared/loras', size_bytes: 10 },
      ],
      checkpoints: [
        { category: 'checkpoints', filename: 'style.safetensors', root_path: '/shared/checkpoints', size_bytes: 100 },
      ],
    };
    const session: McpSession = {
      async listTools() {
        return [{ name: 'models' }];
      },
      async callTool(_name, args) {
        if (typeof args.category !== 'string') return json({ items: [{ category: 'loras' }, { category: 'checkpoints' }], complete: true });
        return json({ items: rows[args.category] ?? [], complete: true });
      },
      async close() {},
    };
    const read = await readModelFilesWithRoots(session);
    const byName = Object.fromEntries(read.items.map((item) => [`${item.directory}/${item.name}`, item]));
    expect(Object.keys(byName).sort()).toEqual(['checkpoints/style.safetensors', 'loras/other.safetensors', 'loras/style.safetensors', 'loras/sub/deep.safetensors']);
    // The manager's own record before the bare Civitai one, a still before a clip; the signature is name and size.
    expect(byName['loras/style.safetensors']).toMatchObject({ sidecarFile: 'style.metadata.json', sidecarSig: 'style.metadata.json:2000', previewFile: 'style.webp', previewSig: 'style.webp:8000' });
    expect(byName['loras/other.safetensors']).toMatchObject({ sidecarFile: null, sidecarSig: null, previewFile: null, previewSig: null });
    expect(byName['loras/sub/deep.safetensors']).toMatchObject({ sidecarFile: null, previewFile: 'sub/deep.preview.png', previewSig: 'sub/deep.preview.png:' });
    // A file of the same name in another folder has nothing next to it.
    expect(byName['checkpoints/style.safetensors']).toMatchObject({ sidecarFile: null, previewFile: null });
  });
});
