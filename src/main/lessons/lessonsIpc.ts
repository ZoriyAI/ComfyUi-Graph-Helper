/**
 * The IPC of lessons as files: list "My lessons", import a lesson file (File ▸ Import lessons…, or a file dropped
 * on the lesson list), export a lesson or a group through the save dialog, save a lesson made in the editor,
 * remove one, mark one as adult content, and the assistant's lesson drafts (open, accept, reject).
 *
 * Who uses it: the Lessons panel and the File menu through the preload bridge; registered once from setupIPC.
 *
 * Why everything is checked again here: the window is the app's own, but a lesson file is not. Whatever arrives
 * (a dropped file's text, a lesson made in the editor, a pack to export) goes through the same strict reader as an
 * import before anything is written, and only into the profile's lessons folder or the file the person chose in
 * the save dialog.
 */

import { app, dialog, type IpcMain } from 'electron';
import * as fs from 'fs';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { createTranslator, type AppLanguage } from '../../shared/i18n';
import { LESSON_FILE_FORMAT, LESSON_FILE_VERSION, LESSON_LIMITS, readLessonFile } from '../../shared/lessons/share/format';
import { fileWriteErrorCode, writeFileAtomic } from '../files/atomicWrite';
import { importDocs, importLessonText, lessonsFolder, listMyLessons, markMyLessonAdult, removeMyLesson } from './store';
import type { LessonDraftResolution, LessonExportOutcome, LessonImportOutcome } from '../../shared/lessons/share/mine';
import { lessonDrafts } from './drafts';

/** A lesson file always ends in .json, so that the open dialog (which lists *.json) finds it again. */
export function withLessonExtension(filePath: string): string {
  if (/\.json$/i.test(filePath)) return filePath;
  return `${filePath.replace(/\.+$/, '')}.lesson.json`;
}

/** What the handlers need from outside, so tests can run them with a temporary folder. */
export interface LessonsIpcDeps {
  /** The language of the dialogs. */
  language: () => AppLanguage;
  /** The profile folder; app.getPath('userData') in the app. */
  userData?: () => string;
}

/** Registers the lessons:* channels. */
export function registerLessonsIpc(ipcMain: IpcMain, deps: LessonsIpcDeps): void {
  const folder = () => lessonsFolder((deps.userData ?? (() => app.getPath('userData')))());
  const translate = () => createTranslator(deps.language());

  ipcMain.handle(IPC_CHANNELS.LESSONS_LIST, () => listMyLessons(folder()));

  ipcMain.handle(IPC_CHANNELS.LESSONS_IMPORT_DIALOG, async (): Promise<LessonImportOutcome> => {
    const t = translate();
    const result = await dialog.showOpenDialog({
      title: t('lessonFiles.dialog.importTitle'),
      buttonLabel: t('lessonFiles.dialog.importButton'),
      filters: [{ name: t('lessonFiles.dialog.filter'), extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true };
    const file = result.filePaths[0];
    try {
      // The size is read before the file: a huge file is refused unread (a character takes up to four bytes).
      if (fs.statSync(file).size > LESSON_LIMITS.fileBytes * 4) return { ok: false, problem: { code: 'too-large' } };
      return importLessonText(folder(), fs.readFileSync(file, 'utf8'), { origin: 'file', fileName: file });
    } catch {
      return { ok: false, error: 'The file could not be read.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LESSONS_IMPORT_TEXT, (_event, name: unknown, text: unknown): LessonImportOutcome => {
    if (typeof text !== 'string') return { ok: false, problem: { code: 'not-json' } };
    return importLessonText(folder(), text, { origin: 'file', fileName: name });
  });

  ipcMain.handle(IPC_CHANNELS.LESSONS_SAVE, (_event, doc: unknown): LessonImportOutcome => {
    const read = readLessonFile({ format: LESSON_FILE_FORMAT, version: LESSON_FILE_VERSION, lessons: [doc] });
    if (!read.ok) return { ok: false, problem: read.problem };
    return importDocs(folder(), read.file.lessons, { origin: 'made' });
  });

  ipcMain.handle(IPC_CHANNELS.LESSONS_REMOVE, (_event, id: unknown) => typeof id === 'string' && removeMyLesson(folder(), id));

  ipcMain.handle(IPC_CHANNELS.LESSONS_MARK_ADULT, (_event, id: unknown, adult: unknown) => typeof id === 'string' && typeof adult === 'boolean' && markMyLessonAdult(folder(), id, adult));

  ipcMain.handle(IPC_CHANNELS.LESSONS_EXPORT, async (_event, file: unknown, suggestedName: unknown): Promise<LessonExportOutcome> => {
    // What is written is what the reader accepts: an export can always be imported again.
    const read = readLessonFile(file);
    if (!read.ok) return { ok: false, problem: read.problem };
    const t = translate();
    const name = typeof suggestedName === 'string' && /^[a-z0-9][a-z0-9.-]{0,100}$/.test(suggestedName) ? suggestedName : 'lessons.lesson.json';
    const result = await dialog.showSaveDialog({
      title: t('lessonFiles.dialog.exportTitle'),
      buttonLabel: t('lessonFiles.dialog.exportButton'),
      filters: [{ name: t('lessonFiles.dialog.filter'), extensions: ['json'] }],
      defaultPath: name,
      // GTK on Linux replaces an existing file without asking unless told to ask.
      properties: ['showOverwriteConfirmation'],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    try {
      writeFileAtomic(withLessonExtension(result.filePath), `${JSON.stringify(read.file, null, 2)}\n`);
    } catch (error) {
      return { ok: false, error: fileWriteErrorCode(error, 'The lesson file could not be written.') };
    }
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.LESSONS_DRAFT_GET, (_event, draftId: unknown) => (typeof draftId === 'string' ? lessonDrafts.get(draftId) : null));

  ipcMain.handle(IPC_CHANNELS.LESSONS_DRAFT_RESOLVE, (_event, draftId: unknown, accept: unknown): LessonDraftResolution => {
    if (typeof draftId !== 'string') return { ok: false, gone: true };
    const draft = lessonDrafts.take(draftId);
    if (!draft) return { ok: false, gone: true };
    if (accept !== true) return { ok: true, rejected: true };
    const outcome = importDocs(folder(), [draft.doc], { origin: 'assistant' });
    // A draft that could not be kept stays a draft: the person can try again.
    if (!outcome.ok) lessonDrafts.put(draft);
    return outcome;
  });
}
