/**
 * The window's side of lessons as files: import (the File menu, a file dropped on the lesson list), export (a
 * lesson or a group, built-in or the person's own), and the plain sentences that say why a file was refused.
 *
 * Who uses it: the File menu commands, the "My lessons" group and the export buttons in the Lessons panel, the
 * lesson editor and the assistant's draft card.
 *
 * Why the sentences are built here: main answers with codes (format.ts LessonFileProblem, tryLesson's verdict);
 * the person reads them in their language, with the lesson and step named by their titles where the app knows them.
 */

import type { TFunction } from 'i18next';
import { i18n } from '../../i18n';
import { showToast } from '../../ui/toastStore';
import { builtinGroupFile, builtinLessonDoc } from '../../../shared/lessons/files/builtin';
import { LESSON_LIMITS, lessonFileName, lessonFileOf, type LessonFileProblem } from '../../../shared/lessons/files/format';
import { MY_LESSONS_MAX, type FailedTry, type LessonExportOutcome, type LessonImportOutcome } from '../../../shared/lessons/files/mine';
import { myLesson, useMyLessonsStore } from '../../state/myLessonsState';

type Translate = TFunction | ((key: string, options?: Record<string, unknown>) => string);

const say = (t: Translate, key: string, values?: Record<string, unknown>) => String(values ? (t as (k: string, v: Record<string, unknown>) => string)(key, values) : (t as (k: string) => string)(key));

/** Why a file does not read as a lesson file, in one sentence. */
export function problemText(t: Translate, problem: LessonFileProblem): string {
  switch (problem.code) {
    case 'too-large':
      return say(t, 'lessonFiles.problem.tooLarge');
    case 'too-deep':
      return say(t, 'lessonFiles.problem.tooDeep');
    case 'not-json':
      return say(t, 'lessonFiles.problem.notJson');
    case 'not-lesson':
      return say(t, 'lessonFiles.problem.notLesson');
    case 'newer-version':
      return say(t, 'lessonFiles.problem.newerVersion', { version: problem.version });
    case 'invalid':
      return problem.lesson ? say(t, 'lessonFiles.problem.invalidIn', { lesson: problem.lesson, at: problem.at }) : say(t, 'lessonFiles.problem.invalid', { at: problem.at });
    case 'duplicate-lesson':
      return say(t, 'lessonFiles.problem.duplicateLesson', { lesson: problem.lesson });
    case 'duplicate-step':
      return say(t, 'lessonFiles.problem.duplicateStep', { lesson: problem.lesson, step: problem.step });
    case 'no-words':
      return say(t, 'lessonFiles.problem.noWords', { lesson: problem.lesson });
    case 'missing-words':
      return say(t, 'lessonFiles.problem.missingWords', { lesson: problem.lesson, step: problem.step });
    case 'unknown-role':
      return say(t, 'lessonFiles.problem.unknownRole', { lesson: problem.lesson, step: problem.step, role: problem.role });
    case 'role-twice':
      return say(t, 'lessonFiles.problem.roleTwice', { lesson: problem.lesson, step: problem.step, role: problem.role });
    case 'bad-range':
      return say(t, 'lessonFiles.problem.badRange', { lesson: problem.lesson, step: problem.step, field: problem.field });
    case 'nothing-to-do':
      return say(t, 'lessonFiles.problem.nothingToDo', { lesson: problem.lesson });
  }
}

/** Which step cannot be done from an empty canvas, named by the titles of the lesson and the step. */
export function triedText(t: Translate, tried: FailedTry, language: string): string {
  const names = tried.names?.[language === 'ru' ? 'ru' : 'en'] ?? tried.names?.en ?? tried.names?.ru;
  const values = { lesson: names?.lesson ?? tried.lessonId, step: names?.step ?? tried.stepId };
  if (tried.why === 'no-class') return say(t, 'lessonFiles.tried.noClass', values);
  if (tried.why === 'too-long') return say(t, 'lessonFiles.tried.tooLong', values);
  return say(t, 'lessonFiles.tried.stuck', values);
}

/** The reason an import, a save or an accepted draft did not keep anything; null when it did (or was cancelled). */
export function refusalText(t: Translate, outcome: LessonImportOutcome, language: string): string | null {
  if (outcome.ok || 'canceled' in outcome) return null;
  if ('problem' in outcome) return problemText(t, outcome.problem);
  if ('tried' in outcome) return triedText(t, outcome.tried, language);
  if ('full' in outcome) return say(t, 'lessonFiles.full', { max: MY_LESSONS_MAX });
  return say(t, 'lessonFiles.unreadable');
}

/** Says how an import went, in a toast, and reads the list again. */
export async function reportImport(outcome: LessonImportOutcome): Promise<void> {
  const t = i18n.t.bind(i18n) as Translate;
  if (!outcome.ok && 'canceled' in outcome) return;
  if (outcome.ok) {
    await useMyLessonsStore.getState().refresh();
    const lines = [
      outcome.added.length > 0 ? say(t, 'lessonFiles.imported', { count: outcome.added.length }) : '',
      outcome.replaced.length > 0 ? say(t, 'lessonFiles.replaced', { count: outcome.replaced.length }) : '',
    ].filter(Boolean);
    showToast({ id: 'lesson-import', tone: 'success', title: lines.join(' '), duration: 5000 });
    return;
  }
  showToast({ id: 'lesson-import', tone: 'error', title: say(t, 'lessonFiles.importFailed'), description: refusalText(t, outcome, i18n.language) ?? undefined, duration: 10000 });
}

/** File ▸ Import lessons…: the open dialog in main, then the outcome. */
export async function importLessonsFromDialog(): Promise<void> {
  const bridge = window.electronAPI;
  if (!bridge?.importLessonsDialog) return;
  await reportImport(await bridge.importLessonsDialog());
}

/**
 * Files dropped on the lesson list. Only the text goes to main, with the name for the mark "from the file …":
 * the path of a dropped file is never used. A file far over the cap is refused here without reading it.
 */
export async function importDroppedFiles(files: readonly File[]): Promise<void> {
  const bridge = window.electronAPI;
  if (!bridge?.importLessonsText) return;
  for (const file of files.slice(0, 8)) {
    if (file.size > LESSON_LIMITS.fileBytes * 4) {
      await reportImport({ ok: false, problem: { code: 'too-large' } });
      continue;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      await reportImport({ ok: false, error: 'unreadable' });
      continue;
    }
    await reportImport(await bridge.importLessonsText(file.name, text));
  }
}

function reportExport(outcome: LessonExportOutcome): void {
  const t = i18n.t.bind(i18n) as Translate;
  if (outcome.ok) {
    showToast({ id: 'lesson-export', tone: 'success', title: say(t, 'lessonFiles.exported'), duration: 4000 });
    return;
  }
  if ('canceled' in outcome) return;
  showToast({ id: 'lesson-export', tone: 'error', title: say(t, 'lessonFiles.exportFailed'), description: 'problem' in outcome ? problemText(t, outcome.problem) : outcome.error, duration: 8000 });
}

/** Exports one built-in lesson, or one of "My lessons" (by app id), through the save dialog. */
export async function exportLesson(id: string): Promise<void> {
  const bridge = window.electronAPI;
  if (!bridge?.exportLessons) return;
  const mine = myLesson(id);
  const doc = mine ? mine.doc : builtinLessonDoc(id);
  if (!doc) return;
  reportExport(await bridge.exportLessons(lessonFileOf([doc]), lessonFileName(doc.id)));
}

/** Exports a whole built-in group as one pack through the save dialog. */
export async function exportGroup(groupId: string): Promise<void> {
  const bridge = window.electronAPI;
  const file = builtinGroupFile(groupId);
  if (!bridge?.exportLessons || !file) return;
  reportExport(await bridge.exportLessons(file, lessonFileName(groupId)));
}

/** Exports every one of "My lessons" as one pack. */
export async function exportMine(): Promise<void> {
  const bridge = window.electronAPI;
  const lessons = useMyLessonsStore.getState().lessons;
  if (!bridge?.exportLessons || lessons.length === 0) return;
  reportExport(await bridge.exportLessons(lessonFileOf(lessons.map((lesson) => lesson.doc), { en: 'My lessons', ru: 'Мои уроки' }), lessonFileName('my-lessons')));
}
