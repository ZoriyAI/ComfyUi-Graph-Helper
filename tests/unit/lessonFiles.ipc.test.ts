/**
 * The lessons IPC: what the window sends is checked again in main before anything is written (a lesson from the
 * editor, a dropped file's text, a pack to export), an export is a file the reader accepts, a write goes only to the
 * file chosen in the save dialog, and an assistant's draft is kept only when the person accepts it.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dialog = vi.hoisted(() => ({ showOpenDialog: vi.fn(), showSaveDialog: vi.fn() }));
vi.mock('electron', () => ({ app: { getPath: () => '/nowhere' }, dialog }));

import { registerLessonsIpc, withLessonExtension } from '../../src/main/lessons/lessonsIpc';
import { lessonDrafts } from '../../src/main/lessons/drafts';
import { IPC_CHANNELS } from '../../src/shared/ipc-channels';
import { LESSON_FILE_FORMAT, LESSON_FILE_VERSION, readLessonFileText } from '../../src/shared/lessons/share/format';
import { builtinGroupFile } from '../../src/shared/lessons/share/builtin';
import { sampleDoc } from '../fixtures/lessons/sampleLesson';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

let dir = '';
let handlers: Record<string, Handler> = {};
const call = (channel: string, ...args: unknown[]) => handlers[channel]({}, ...args) as Promise<any>;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lessons-ipc-'));
  handlers = {};
  registerLessonsIpc({ handle: (channel: string, handler: Handler) => { handlers[channel] = handler; } } as never, { language: () => 'en', userData: () => dir });
  dialog.showOpenDialog.mockReset();
  dialog.showSaveDialog.mockReset();
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const fileText = (lessons: unknown[]) => JSON.stringify({ format: LESSON_FILE_FORMAT, version: LESSON_FILE_VERSION, lessons });

describe('lessons IPC', () => {
  it('registers every lessons channel', () => {
    const expected = Object.entries(IPC_CHANNELS).filter(([key]) => key.startsWith('LESSONS_')).map(([, channel]) => channel).sort();
    expect(Object.keys(handlers).sort()).toEqual(expected);
  });

  it('imports a dropped file by its text only, and lists it after', async () => {
    expect(await call(IPC_CHANNELS.LESSONS_IMPORT_TEXT, '../../evil/first.lesson.json', fileText([sampleDoc()]))).toEqual({ ok: true, added: ['my:my-first'], replaced: [] });
    const listed = await call(IPC_CHANNELS.LESSONS_LIST);
    expect(listed).toHaveLength(1);
    expect(listed[0].fileName).toBe('first.lesson.json');
    expect(fs.readdirSync(path.join(dir, 'lessons'))).toEqual(['my-first.lesson.json']);
    expect(await call(IPC_CHANNELS.LESSONS_IMPORT_TEXT, 'x', 42)).toEqual({ ok: false, problem: { code: 'not-json' } });
  });

  it('imports through the open dialog and refuses a huge file unread', async () => {
    const file = path.join(dir, 'pack.json');
    fs.writeFileSync(file, fileText([sampleDoc()]));
    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [file] });
    expect(await call(IPC_CHANNELS.LESSONS_IMPORT_DIALOG)).toMatchObject({ ok: true, added: ['my:my-first'] });
    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    expect(await call(IPC_CHANNELS.LESSONS_IMPORT_DIALOG)).toEqual({ ok: false, canceled: true });
    const huge = path.join(dir, 'huge.json');
    fs.writeFileSync(huge, Buffer.alloc(9 * 1024 * 1024, 32));
    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [huge] });
    expect(await call(IPC_CHANNELS.LESSONS_IMPORT_DIALOG)).toEqual({ ok: false, problem: { code: 'too-large' } });
  });

  it('saves a lesson from the editor only when it reads and can be done', async () => {
    expect(await call(IPC_CHANNELS.LESSONS_SAVE, sampleDoc({ id: 'made-here' }))).toMatchObject({ ok: true, added: ['my:made-here'] });
    expect((await call(IPC_CHANNELS.LESSONS_LIST))[0].origin).toBe('made');
    expect(await call(IPC_CHANNELS.LESSONS_SAVE, { ...sampleDoc(), id: '../x' })).toMatchObject({ ok: false, problem: { code: 'invalid' } });
    expect(await call(IPC_CHANNELS.LESSONS_MARK_ADULT, 'my:made-here', true)).toBe(true);
    expect(await call(IPC_CHANNELS.LESSONS_MARK_ADULT, 'my:made-here', 'yes')).toBe(false);
    expect(await call(IPC_CHANNELS.LESSONS_REMOVE, 'my:made-here')).toBe(true);
    expect(await call(IPC_CHANNELS.LESSONS_REMOVE, 42)).toBe(false);
  });

  it('exports a built-in group to the chosen file, which reads back, and refuses what is not a lesson file', async () => {
    const target = path.join(dir, 'out', 'basics');
    fs.mkdirSync(path.dirname(target));
    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: target });
    expect(await call(IPC_CHANNELS.LESSONS_EXPORT, builtinGroupFile('basics'), 'basics.lesson.json')).toEqual({ ok: true });
    expect(dialog.showSaveDialog.mock.calls[0][0].defaultPath).toBe('basics.lesson.json');
    const written = fs.readFileSync(withLessonExtension(target), 'utf8');
    expect(readLessonFileText(written).ok).toBe(true);
    expect(await call(IPC_CHANNELS.LESSONS_EXPORT, { format: 'something else' }, 'x')).toMatchObject({ ok: false, problem: { code: 'not-lesson' } });
    // A suggested name with a path in it is not used.
    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: true });
    await call(IPC_CHANNELS.LESSONS_EXPORT, builtinGroupFile('basics'), '../../etc/passwd');
    expect(dialog.showSaveDialog.mock.calls[1][0].defaultPath).toBe('lessons.lesson.json');
  });

  it('keeps an assistant draft only when the person accepts it', async () => {
    const draft = lessonDrafts.add(sampleDoc({ id: 'drafted' }), 'lesson');
    expect(await call(IPC_CHANNELS.LESSONS_DRAFT_GET, draft.id)).toMatchObject({ id: draft.id, triedWith: 'lesson' });
    expect(await call(IPC_CHANNELS.LESSONS_LIST)).toEqual([]);
    expect(await call(IPC_CHANNELS.LESSONS_DRAFT_RESOLVE, draft.id, true)).toMatchObject({ ok: true, added: ['my:drafted'] });
    expect((await call(IPC_CHANNELS.LESSONS_LIST))[0].origin).toBe('assistant');
    expect(await call(IPC_CHANNELS.LESSONS_DRAFT_RESOLVE, draft.id, true)).toEqual({ ok: false, gone: true });
    const other = lessonDrafts.add(sampleDoc({ id: 'rejected' }), 'lesson');
    expect(await call(IPC_CHANNELS.LESSONS_DRAFT_RESOLVE, other.id, false)).toEqual({ ok: true, rejected: true });
    expect(await call(IPC_CHANNELS.LESSONS_DRAFT_GET, other.id)).toBeNull();
    expect((await call(IPC_CHANNELS.LESSONS_LIST)).map((item: { id: string }) => item.id)).toEqual(['my:drafted']);
  });
});
