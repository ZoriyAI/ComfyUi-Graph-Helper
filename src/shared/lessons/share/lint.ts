/**
 * The writer's check of a lesson: everything the app itself refuses (the rules of schema.ts, the words of every
 * checklist item, criterion and question, a lesson that cannot be done from an empty canvas) and, measured against
 * the template of the new standard (standard 2), what is still missing, each in one plain English sentence.
 *
 * Who uses it: scripts/lesson-lint.js (through scripts/lib/lesson-lint.ts) for the people who write lessons, and
 * tests/unit/lessonLint.test.ts. Pure: it reads a lesson document, never a file.
 *
 * Why two lists: an error stops a lesson from being shipped or imported; "missing" is what a lesson of standard 1
 * would need to become a lesson of standard 2, so a writer sees the distance without being refused.
 */

import { lessonRuleText, lessonStandardProblems, lessonWordsProblems, type WordsByLanguage } from '../schema';
import { engineLesson, lessonDocProblem, type LessonDoc } from './format';
import { builtinLessonDoc } from './builtin';
import { checkLessonDoc } from './mine';

/** What the lint says of one lesson. */
export interface LessonLint {
  id: string;
  standard: 1 | 2;
  /** Problems that stop the lesson: the app would refuse it. */
  errors: string[];
  /** What the template of standard 2 still asks for (for a lesson of standard 1: what it lacks to become one). */
  missing: string[];
}

/** The words of a document by language, as the schema checks read them. */
function wordsOf(doc: LessonDoc): WordsByLanguage {
  return { ...(doc.texts.en ? { en: doc.texts.en } : {}), ...(doc.texts.ru ? { ru: doc.texts.ru } : {}) };
}

/**
 * Lints one lesson document. `find` gives the lessons it continues (another lesson of the same pack, or a built-in
 * lesson by its id), so a lesson that starts from another one's graph is tried the way a person meets it.
 */
export function lintLessonDoc(doc: LessonDoc, find: (docId: string) => LessonDoc | null = builtinLessonDoc): LessonLint {
  const errors: string[] = [];
  const problem = lessonDocProblem(doc);
  if (problem) {
    errors.push(problem.code === 'rules' ? lessonRuleText(doc.id, problem.rule) : `${doc.id}: ${JSON.stringify(problem)}`);
  } else {
    const check = checkLessonDoc(doc, find);
    if (!check.ok) {
      errors.push('problem' in check
        ? `${doc.id}: ${JSON.stringify(check.problem)}`
        : `${doc.id}: step "${check.tried.stepId}" cannot be done from an empty canvas (${check.tried.why})`);
    }
  }
  const lesson = engineLesson(doc, doc.id);
  const words = wordsOf(doc);
  // The rules every lesson follows are already in `errors`; the words of the new steps are said here once more only
  // when the format did not stop at them first.
  for (const item of lessonWordsProblems(lesson, words)) {
    const sentence = lessonRuleText(doc.id, item);
    if (!errors.includes(sentence)) errors.push(sentence);
  }
  const asStandard = lessonStandardProblems({ ...lesson, standard: 2 }, words).map((item) => lessonRuleText(doc.id, item));
  if (!words.en) asStandard.push(`${doc.id}: the English words are missing`);
  if (!words.ru) asStandard.push(`${doc.id}: the Russian words are missing`);
  if (!lesson.outcomes || lesson.outcomes.length < 2) asStandard.push(`${doc.id}: it declares only "structure checked"; a lesson of standard 2 says whether it ends with a run and an assessed result`);
  if (!(doc.level !== undefined && doc.tracks?.length)) asStandard.push(`${doc.id}: its level and tracks are not given`);
  const standard = doc.standard === 2 ? 2 : 1;
  if (standard === 2) {
    for (const sentence of asStandard) if (!errors.includes(sentence)) errors.push(sentence);
    return { id: doc.id, standard, errors, missing: [] };
  }
  return { id: doc.id, standard, errors, missing: asStandard };
}

/** One lesson's lint as lines for a terminal: a heading, then each error and each missing part. */
export function lintLines(lint: LessonLint): string[] {
  const head = `${lint.id} (standard ${lint.standard}): ${lint.errors.length === 0 ? 'no errors' : `${lint.errors.length} error(s)`}`;
  return [
    head,
    ...lint.errors.map((line) => `  error: ${line}`),
    ...(lint.missing.length > 0 ? [`  to reach standard 2 (${lint.missing.length}):`, ...lint.missing.map((line) => `    - ${line}`)] : []),
  ];
}
