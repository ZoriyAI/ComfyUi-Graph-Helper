/**
 * Protects the single open path (openFileAtPath in src/main/ipc/openIpc.ts): the File dialogs, a dropped file,
 * File > Recent and a file from the command line. It drives the channels with real files of every kind ComfyUI writes
 * (JSON, PNG, WebP, video), on a real database, and checks they all commit and are remembered the same way.
 * A person should get the same result however they open a file, and foreign paths must be refused.
 */
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const inflateCalls = vi.hoisted(() => ({ count: 0 }));
vi.mock('zlib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('zlib')>();
  const inflateSync = ((...args: Parameters<typeof actual.inflateSync>) => {
    inflateCalls.count += 1;
    return actual.inflateSync(...args);
  }) as typeof actual.inflateSync;
  return { ...actual, inflateSync, default: { ...actual, inflateSync } };
});

const holder: { db: Database.Database | null; userData: string } = { db: null, userData: '' };
// main reads the profile folder and the database through these two modules; both point at the test's own copies.
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
  BrowserWindow: { getAllWindows: () => [] },
  shell: { showItemInFolder: vi.fn(), openExternal: vi.fn(async () => undefined) },
  dialog: {},
}));
vi.mock('../../src/main/database', () => ({ getDatabase: () => holder.db }));

import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { IPC_CHANNELS } from '../../src/shared/ipc-channels';
import { fileFromArgs, journeyLink, openFileAtPath, registerOpenIpc, requestOpen } from '../../src/main/ipc/openIpc';
import { nativeProjectFile, openNativeFile } from '../../src/main/ipc/projectFile';
import { recentFiles, sourceOf } from '../../src/main/files/recentFiles';
import { projectFileState } from '../../src/main/projectFiles';
import { pngTexts } from '../../src/main/files/openFile';
import { createTranslator, translateKnownError } from '../../src/shared/i18n';
import { LEGACY_NATIVE_PROJECT_FORMAT_IDS, LEGACY_PROJECT_FILE_SUFFIXES } from '../../src/shared/legacyNames';

const P = DESKTOP_PROJECT_ID;
const WORKFLOW = {
  version: 0.4, last_node_id: 2, last_link_id: 0, links: [],
  nodes: [
    { id: 1, type: 'Note', pos: [0, 0], size: [200, 80], flags: {}, order: 0, mode: 0, properties: {}, widgets_values: ['first'] },
    { id: 2, type: 'Note', pos: [300, 0], size: [200, 80], flags: {}, order: 1, mode: 0, properties: {}, widgets_values: ['second'] },
  ],
};

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return Buffer.concat([length, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
}

/** A PNG as ComfyUI writes it: the workflow in a tEXt chunk (or a compressed iTXt one). */
function png(workflow: unknown, compressed = false): Buffer {
  const text = Buffer.from(JSON.stringify(workflow), compressed ? 'utf8' : 'latin1');
  const data = compressed
    ? Buffer.concat([Buffer.from('workflow\0\x01\x00\0\0', 'latin1'), zlib.deflateSync(text)])
    : Buffer.concat([Buffer.from('workflow\0', 'latin1'), text]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', Buffer.alloc(13)), chunk(compressed ? 'iTXt' : 'tEXt', data), chunk('IEND', Buffer.alloc(0))]);
}

let handlers: Map<string, (...args: unknown[]) => unknown>;
const calls: string[] = [];

beforeEach(() => {
  inflateCalls.count = 0;
  holder.db = new Database(':memory:');
  migrate(holder.db);
  ensureWorkspace(holder.db);
  holder.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'open-paths-'));
  handlers = new Map();
  calls.length = 0;
  registerOpenIpc({ handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn) } as never, {
    importWorkflow: (document) => {
      calls.push('import');
      const db = holder.db!;
      return commitCommand(db, { projectId: P, actionId: `t-${Math.random()}`, expectedRevisionId: readProjection(db, P)!.currentRevisionId, actor: 'manual', runId: null, payload: { type: 'import-workflow', document } }) as never;
    },
    openProject: (document) => {
      calls.push('project');
      return openNativeFile(holder.db!, P, document) as never;
    },
  });
});
afterEach(() => {
  holder.db?.close();
  fs.rmSync(holder.userData, { recursive: true, force: true });
});

/** A PNG assembled from text chunks so compressed expansion and chunk-count limits can be exercised. */
function withTextChunks(chunks: Buffer[]): Buffer {
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ...chunks, chunk('IEND', Buffer.alloc(0))]);
}

describe('bounded PNG workflow text', () => {
  it.each(['zTXt', 'iTXt'])('does not inflate an unrelated %s keyword', (type) => {
    const data = Buffer.concat([Buffer.from(type === 'zTXt' ? 'Comment\0\0' : 'Comment\0\x01\0\0\0', 'latin1'), zlib.deflateSync(Buffer.alloc(1024 * 1024, 120))]);
    const bytes = withTextChunks([chunk(type, data), chunk('tEXt', Buffer.from(`workflow\0${JSON.stringify(WORKFLOW)}`, 'latin1'))]);
    expect(JSON.parse(pngTexts(bytes).workflow)).toEqual(WORKFLOW);
    expect(inflateCalls.count).toBe(0);
  });

  it.each(['zTXt', 'iTXt'])('refuses an oversized %s expansion with a translated reason and no commit', (type) => {
    const data = Buffer.concat([Buffer.from(type === 'zTXt' ? 'workflow\0\0' : 'workflow\0\x01\0\0\0', 'latin1'), zlib.deflateSync(Buffer.alloc(16 * 1024 * 1024 + 1, 120))]);
    const bytes = withTextChunks([chunk(type, data)]);
    const before = readProjection(holder.db!, P)!.currentRevisionId;
    const response = openFileAtPath(write('too-much.png', bytes));
    expect(response.status).toBe('rejected');
    expect(response.result).toEqual({ error: 'The workflow text in this picture is too large.' });
    expect(readProjection(holder.db!, P)!.currentRevisionId).toBe(before);
    expect(calls).toEqual([]);
    expect(translateKnownError(createTranslator('en'), 'The workflow text in this picture is too large.')).toBe('The workflow text in this picture is too large. Open its workflow JSON file instead.');
    expect(translateKnownError(createTranslator('ru'), 'The workflow text in this picture is too large.')).toBe('Текст workflow в этой картинке слишком большой. Откройте файл workflow в формате JSON.');
  });

  it('bounds the total inflated text even when later chunks replace the same keyword', () => {
    const compressed = zlib.deflateSync(Buffer.alloc(12 * 1024 * 1024, 120));
    const data = Buffer.concat([Buffer.from('workflow\0\0', 'latin1'), compressed]);
    expect(() => pngTexts(withTextChunks(Array.from({ length: 3 }, () => chunk('zTXt', data)))))
      .toThrow('The workflow text in this picture is too large.');
  });

  it('bounds repeated small text chunks', () => {
    expect(() => pngTexts(withTextChunks(Array.from({ length: 257 }, () => chunk('tEXt', Buffer.from('workflow\0{}', 'latin1'))))))
      .toThrow('The workflow text in this picture is too large.');
  });

  it('accepts a compressed value at the per-value boundary', () => {
    const text = Buffer.alloc(16 * 1024 * 1024, 120);
    const data = Buffer.concat([Buffer.from('workflow\0\0', 'latin1'), zlib.deflateSync(text)]);
    expect(pngTexts(withTextChunks([chunk('zTXt', data)])).workflow).toHaveLength(text.length);
  });

  it('charges damaged compressed streams to the file budget while still allowing one bad chunk', () => {
    const damaged = zlib.deflateSync(Buffer.alloc(12 * 1024 * 1024, 120));
    damaged[damaged.length - 1] ^= 0xff;
    const bad = chunk('zTXt', Buffer.concat([Buffer.from('workflow\0\0', 'latin1'), damaged]));
    const good = chunk('zTXt', Buffer.concat([Buffer.from('workflow\0\0', 'latin1'), zlib.deflateSync(Buffer.from('{"nodes":[]}'))]));
    expect(JSON.parse(pngTexts(withTextChunks([bad, good])).workflow)).toEqual({ nodes: [] });
    inflateCalls.count = 0;
    expect(() => pngTexts(withTextChunks([bad, bad, good]))).toThrow('The workflow text in this picture is too large.');
    expect(inflateCalls.count).toBe(2);
  });

  it('keeps ordinary uncompressed text within the file limit without applying an inflation cap', () => {
    const text = Buffer.alloc(17 * 1024 * 1024, 120);
    const texts = pngTexts(withTextChunks(['workflow', 'prompt'].map((key) => chunk('tEXt', Buffer.concat([Buffer.from(`${key}\0`, 'latin1'), text])))));
    expect(texts.workflow).toHaveLength(text.length);
    expect(texts.prompt).toHaveLength(text.length);
    expect(inflateCalls.count).toBe(0);
  });
});

function write(name: string, data: string | Buffer): string {
  const file = path.join(holder.userData, name);
  fs.writeFileSync(file, data);
  return file;
}

const nodeCount = () => (readProjection(holder.db!, P)!.snapshot.nodes as unknown[]).length;

describe('one open path', () => {
  it('opens a workflow from JSON with a BOM, a PNG, a compressed PNG chunk, a WebP and a video, the same way', () => {
    const files = [
      write('bom.json', `﻿${JSON.stringify(WORKFLOW)}`),
      write('picture.png', png(WORKFLOW)),
      write('compressed.png', png(WORKFLOW, true)),
      write('anim.webp', Buffer.concat([Buffer.from('RIFF\0\0\0\0WEBPEXIF\0\0\0\0MM\0*workflow:', 'latin1'), Buffer.from(JSON.stringify(WORKFLOW)), Buffer.from('\0prompt:{}', 'latin1')])),
      write('clip.mp4', Buffer.concat([Buffer.from('\0\0\0\x18ftypisom\0\0\0\0----\0\0\0\x1cmean\0\0\0\0name\0\0\0\0workflow\0\0\0\x10data\0\0\0\x01\0\0\0\0', 'latin1'), Buffer.from(JSON.stringify(WORKFLOW)), Buffer.from('\0\0moov', 'latin1')])),
    ];
    const kinds: string[] = [];
    for (const file of files) {
      const response = openFileAtPath(file);
      expect(response.status, file).toBe('applied');
      expect(nodeCount()).toBe(2);
      kinds.push(response.opened!.from);
      // The app bar names the untitled graph after the file it came from.
      expect(sourceOf(holder.userData, projectFileState(holder.db!, P).graphKey)).toBe(path.basename(file));
    }
    expect(kinds).toEqual(['json', 'picture', 'picture', 'picture', 'video']);
    expect(calls).toEqual(['import', 'import', 'import', 'import', 'import']);
    expect(recentFiles(holder.userData).map((item) => path.basename(item.path))).toEqual(['clip.mp4', 'anim.webp', 'compressed.png', 'picture.png', 'bom.json']);
  });

  it('turns the API format into a canvas workflow and says so', () => {
    const file = write('api.json', JSON.stringify({ 1: { class_type: 'Note', inputs: { text: 'a' } }, 2: { class_type: 'Note', inputs: { text: 'b' } } }));
    const response = openFileAtPath(file);
    expect(response.status).toBe('applied');
    expect(response.opened?.from).toBe('api');
    expect(nodeCount()).toBe(2);
  });

  it('a project file opens as a project from any way in, and becomes the graph file', () => {
    openFileAtPath(write('w.json', JSON.stringify(WORKFLOW)));
    const project = nativeProjectFile(holder.db!, P);
    expect(project.ok).toBe(true);
    const file = write('mine.nodewise.json', `﻿${JSON.stringify((project as { project: unknown }).project)}`);
    const response = handlers.get(IPC_CHANNELS.FILE_OPEN_PATH)!({}, file) as { status: string; opened: { kind: string } };
    expect(response.status).toBe('applied');
    expect(response.opened.kind).toBe('project');
    expect(calls.at(-1)).toBe('project');
    expect(projectFileState(holder.db!, P).filePath).toBe(file);
  });

  it('a project file saved by 0.x (old format id and file ending) still opens as a project', () => {
    openFileAtPath(write('w.json', JSON.stringify(WORKFLOW)));
    const project = (nativeProjectFile(holder.db!, P) as { project: Record<string, unknown> }).project;
    const file = write(`old${LEGACY_PROJECT_FILE_SUFFIXES[0]}`, JSON.stringify({ ...project, format: LEGACY_NATIVE_PROJECT_FORMAT_IDS[0] }));
    const response = handlers.get(IPC_CHANNELS.FILE_OPEN_PATH)!({}, file) as { status: string; opened: { kind: string } };
    expect(response.status).toBe('applied');
    expect(response.opened.kind).toBe('project');
  });

  it('drop, Recent and the command line end in the same commit; foreign paths and kinds are refused', () => {
    const file = write('drop.json', JSON.stringify(WORKFLOW));
    expect((handlers.get(IPC_CHANNELS.FILE_OPEN_PATH)!({}, file) as { status: string }).status).toBe('applied');
    expect((handlers.get(IPC_CHANNELS.FILE_OPEN_RECENT)!({}, file) as { status: string }).status).toBe('applied');
    expect(fileFromArgs(['/usr/bin/app', '--no-sandbox', file], '/')).toBe(file);
    requestOpen(file);
    expect(handlers.get(IPC_CHANNELS.FILE_PENDING_OPEN)!({})).toEqual({ name: 'drop.json' });
    expect((handlers.get(IPC_CHANNELS.FILE_OPEN_PENDING)!({}) as { status: string }).status).toBe('applied');
    expect(handlers.get(IPC_CHANNELS.FILE_PENDING_OPEN)!({})).toBeNull();
    expect(calls).toEqual(['import', 'import', 'import']);
    // Not on the Recent list, not a kind the app opens, not absolute: refused without reading.
    const other = write('other.json', JSON.stringify(WORKFLOW));
    expect((handlers.get(IPC_CHANNELS.FILE_OPEN_RECENT)!({}, other) as { result: { error: string } }).result.error).toBe('This file cannot be opened here.');
    expect((handlers.get(IPC_CHANNELS.FILE_OPEN_PATH)!({}, write('x.exe', 'MZ')) as { result: { error: string } }).result.error).toBe('This file cannot be opened here.');
    expect((handlers.get(IPC_CHANNELS.FILE_OPEN_PATH)!({}, 'relative.json') as { result: { error: string } }).result.error).toBe('This file cannot be opened here.');
    expect(calls).toHaveLength(3);
  });

  it('a picture without a workflow, and text that is not JSON, are refused with a plain reason', () => {
    expect((openFileAtPath(write('plain.png', png({ nodes: 1 }).subarray(0, 40))).result as { error: string }).error).toBe('This file holds no workflow.');
    expect((openFileAtPath(write('broken.json', '{ nope')).result as { error: string }).error).toBe('Workflow JSON could not be parsed.');
    expect(calls).toEqual([]);
  });

  it('examples build from the node list and open through the same import', () => {
    expect(handlers.get(IPC_CHANNELS.FILE_EXAMPLES_LIST)!({})).toEqual([]);
    const response = handlers.get(IPC_CHANNELS.FILE_OPEN_EXAMPLE)!({}, 'image') as { result: { error: string } };
    expect(response.result.error).toBe('This example cannot be built from your node list.');
  });

  it('journey links: only the saved ComfyUI address over http(s) and two fixed pages', () => {
    expect(journeyLink('comfyui', 'http://127.0.0.1:8188/x')).toBe('http://127.0.0.1:8188/');
    expect(journeyLink('comfyui', 'file:///etc/passwd')).toBeNull();
    expect(journeyLink('comfyui', '')).toBeNull();
    expect(journeyLink('comfyui-download', '')).toMatch(/^https:\/\//);
    expect(journeyLink('https://evil.example', '')).toBeNull();
  });
});

describe('the dialogs use the one path too', () => {
  it('File ▸ Open workflow and File ▸ Open project call openFileAtPath and parse nothing themselves', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../src/main/ipc.ts'), 'utf8');
    for (const channel of ['FILE_IMPORT_WORKFLOW', 'FILE_OPEN_PROJECT']) {
      const start = source.indexOf(`ipcMain.handle(IPC_CHANNELS.${channel},`);
      const body = source.slice(start, source.indexOf('\n  });', start));
      expect(body, channel).toContain('openFileAtPath(result.filePaths[0])');
      expect(body, channel).not.toContain('JSON.parse');
    }
    const actions = fs.readFileSync(path.join(__dirname, '../../src/renderer/commands/actions.ts'), 'utf8');
    for (const name of ['importWorkflowNow', 'openProjectNow', 'openVia', 'runQueuedOpen']) {
      const start = actions.indexOf(`function ${name}(`);
      expect(actions.slice(start, actions.indexOf('\n}', start)), name).toContain('finishOpen(');
    }
  });
});
