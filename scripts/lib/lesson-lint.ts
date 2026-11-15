/**
 * The body of scripts/lesson-lint.js, run through vite-node so it can read the lessons from their TypeScript sources.
 * It lints built-in lessons by id (all of them with --all, the lessons of standard 2 with no argument) or lesson
 * files by path, and prints each lesson's errors and what the template of standard 2 still asks for.
 *
 * Who uses it: the people who write lessons (see docs/wiki/dev/Writing-A-Lesson.md). Exit code 1 when any lesson
 * linted has an error, or, with --strict, when a lesson of standard 1 named on the command line misses a part.
 */
import * as fs from 'fs';
import { LESSONS } from '../../src/shared/lessons/lessons';
import { builtinLessonDoc } from '../../src/shared/lessons/share/builtin';
import { readLessonFileText, type LessonDoc } from '../../src/shared/lessons/share/format';
import { lintLessonDoc, lintLines, type LessonLint } from '../../src/shared/lessons/share/lint';

/** The lessons to lint from the command line arguments, and the flags. */
function plan(argv: readonly string[]): { docs: Array<{ doc: LessonDoc; find: (id: string) => LessonDoc | null }>; strict: boolean; problems: string[] } {
  const strict = argv.includes('--strict');
  const all = argv.includes('--all');
  const names = argv.filter((arg) => !arg.startsWith('--'));
  const problems: string[] = [];
  const docs: Array<{ doc: LessonDoc; find: (id: string) => LessonDoc | null }> = [];
  const builtin = (id: string) => {
    const doc = builtinLessonDoc(id);
    if (doc) docs.push({ doc, find: builtinLessonDoc });
    else problems.push(`${id}: no built-in lesson has this id`);
  };
  if (names.length === 0) {
    for (const lesson of LESSONS) if (all || lesson.standard === 2) builtin(lesson.id);
  }
  for (const name of names) {
    if (!name.endsWith('.json')) {
      builtin(name);
      continue;
    }
    let text: string;
    try {
      text = fs.readFileSync(name, 'utf8');
    } catch {
      problems.push(`${name}: the file cannot be read`);
      continue;
    }
    const read = readLessonFileText(text);
    if (!read.ok) {
      problems.push(`${name}: not a lesson file the app reads (${JSON.stringify(read.problem)})`);
      continue;
    }
    const pack = new Map(read.file.lessons.map((doc) => [doc.id, doc]));
    // A lesson of the file goes on from another of the same file first, else from a built-in lesson.
    for (const doc of read.file.lessons) docs.push({ doc, find: (id) => pack.get(id) ?? builtinLessonDoc(id) });
  }
  return { docs, strict, problems };
}

/** Lints and prints; returns the exit code. */
export function main(argv: readonly string[]): number {
  if (argv.includes('--help')) {
    console.log('Usage: node scripts/lesson-lint.js [--all] [--strict] [lesson-id | file.lesson.json ...]');
    console.log('  no argument: every built-in lesson of standard 2; --all: every built-in lesson.');
    return 0;
  }
  const { docs, strict, problems } = plan(argv);
  const lints: LessonLint[] = docs.map(({ doc, find }) => lintLessonDoc(doc, find));
  for (const line of problems) console.log(`error: ${line}`);
  for (const lint of lints) for (const line of lintLines(lint)) console.log(line);
  const errors = problems.length + lints.reduce((sum, lint) => sum + lint.errors.length, 0);
  const missing = lints.reduce((sum, lint) => sum + lint.missing.length, 0);
  console.log(`\n${lints.length} lesson(s): ${errors} error(s), ${missing} part(s) missing for standard 2.`);
  return errors > 0 || (strict && missing > 0) ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
