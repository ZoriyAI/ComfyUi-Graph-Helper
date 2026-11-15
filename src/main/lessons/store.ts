/**
 * Where "My lessons" live: one file per lesson in the `lessons` folder of the profile (next to the database), each
 * written atomically and readable by this user only. Files instead of a table: no migration, a lesson survives a
 * damaged database, and the person can see their lessons as files.
 *
 * Who uses it: the lessons IPC (lessonsIpc.ts) for list, import, save, remove and the adult mark, and the
 * assistant's draft tool when the person accepts a draft.
 *
 * Why it is careful: everything here comes from files other people wrote. A file name in the profile is built
 * only from a lesson id the format allows (lower-case words and hyphens), never from a name in a file, so nothing
 * is written outside the folder. Every file is read back through the same strict reader as an import.
 */

import * as fs from 'fs';
import * as path from 'path';
import { writeFileAtomic } from '../files/atomicWrite';
import { LESSON_LIMITS, lessonFileName, readLessonFileText, type LessonDoc } from '../../shared/lessons/files/format';
import { checkLessonDoc, docIdOf, myLessonId, readStoredRecord, roomFor, safeFileName, storedRecord, type LessonImportOutcome, type LessonOrigin, type MyLesson } from '../../shared/lessons/files/mine';

/** The folder of a profile that holds the person's lessons. */
export function lessonsFolder(userData: string): string {
  return path.join(userData, 'lessons');
}

function ensureFolder(folder: string): void {
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
}

/** The file of a lesson in the folder: its own id and `.lesson.json`, nothing else. */
function fileOf(folder: string, docId: string): string {
  const file = path.join(folder, lessonFileName(docId));
  // A belt to the braces of the id pattern: the file is always directly inside the folder.
  if (path.dirname(file) !== path.resolve(folder)) throw new Error('A lesson file must stay in the lessons folder.');
  return file;
}

/** Every lesson in the folder that reads back whole, newest first. A file that does not read is left alone, unlisted. */
export function listMyLessons(folder: string): MyLesson[] {
  let names: string[];
  try {
    names = fs.readdirSync(folder);
  } catch {
    return [];
  }
  const out: MyLesson[] = [];
  for (const name of names) {
    if (!name.endsWith('.lesson.json')) continue;
    const file = path.join(folder, name);
    try {
      const stat = fs.lstatSync(file);
      // Links are not followed: a link in the profile could point anywhere.
      if (!stat.isFile() || stat.size > LESSON_LIMITS.fileBytes) continue;
      const lesson = readStoredRecord(JSON.parse(fs.readFileSync(file, 'utf8')));
      // The file name must be the lesson's own: a record copied under another name would shadow a lesson.
      if (lesson && lessonFileName(lesson.doc.id) === name) out.push(lesson);
    } catch {
      // Unreadable or not JSON: not a lesson.
    }
  }
  return out.sort((a, b) => b.savedAt - a.savedAt || a.id.localeCompare(b.id));
}

/** Writes one lesson; an existing lesson of the same id is replaced. */
export function writeMyLesson(folder: string, lesson: MyLesson): void {
  ensureFolder(folder);
  writeFileAtomic(fileOf(folder, lesson.doc.id), JSON.stringify(storedRecord(lesson), null, 2), { mode: 0o600 });
}

/** Removes a lesson by its app id; false when there was none. */
export function removeMyLesson(folder: string, id: string): boolean {
  const docId = docIdOf(id);
  if (!docId || !/^[a-z0-9][a-z0-9-]*$/.test(docId)) return false;
  const file = fileOf(folder, docId);
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file, { force: true });
  return true;
}

/** The outcomes an import here can have (the dialog adds canceled and unreadable). */
export type ImportOutcome = Extract<LessonImportOutcome, { added: string[] } | { problem: unknown } | { tried: unknown } | { full: true }>;

/**
 * Imports a lesson file's text: read, checked lesson by lesson (parts that hold together, can be done from an
 * empty canvas), then written. All or nothing: one lesson that fails refuses the file.
 */
export function importLessonText(folder: string, text: string, options: { origin: LessonOrigin; fileName?: unknown; now?: number }): ImportOutcome {
  const read = readLessonFileText(text);
  if (!read.ok) return { ok: false, problem: read.problem };
  return importDocs(folder, read.file.lessons, options);
}

/** Checks and writes lesson documents already read; see importLessonText. */
export function importDocs(folder: string, docs: LessonDoc[], options: { origin: LessonOrigin; fileName?: unknown; now?: number }): ImportOutcome {
  const kept = listMyLessons(folder);
  const keptById = new Map(kept.map((lesson) => [lesson.doc.id, lesson]));
  const incoming = new Map(docs.map((doc) => [doc.id, doc]));
  const find = (docId: string) => incoming.get(docId) ?? keptById.get(docId)?.doc ?? null;
  for (const doc of docs) {
    const check = checkLessonDoc(doc, find);
    if (!check.ok) return 'problem' in check ? { ok: false, problem: check.problem } : { ok: false, tried: check.tried };
  }
  const fresh = docs.filter((doc) => !keptById.has(doc.id)).length;
  if (!roomFor(kept.length, fresh)) return { ok: false, full: true };
  const now = options.now ?? Date.now();
  const fileName = safeFileName(options.fileName);
  const added: string[] = [];
  const replaced: string[] = [];
  for (const doc of docs) {
    const before = keptById.get(doc.id);
    // A lesson imported again keeps the person's own adult mark.
    writeMyLesson(folder, { id: myLessonId(doc.id), origin: options.origin, savedAt: now, adultMark: before?.adultMark ?? false, ...(fileName ? { fileName } : {}), doc });
    (before ? replaced : added).push(myLessonId(doc.id));
  }
  return { ok: true, added, replaced };
}

/** Sets or clears the person's adult mark on a lesson; false when there is no such lesson. */
export function markMyLessonAdult(folder: string, id: string, adult: boolean): boolean {
  const lesson = listMyLessons(folder).find((item) => item.id === id);
  if (!lesson) return false;
  writeMyLesson(folder, { ...lesson, adultMark: adult });
  return true;
}
