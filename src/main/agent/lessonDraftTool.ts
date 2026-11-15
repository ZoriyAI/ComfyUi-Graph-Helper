/**
 * The assistant's draftLesson tool: the assistant writes a lesson in the lesson file format (from the graph on the
 * canvas, or from a request such as "teach me inpainting with what I have installed"); the app checks it with the
 * same strict reader as an imported file, tries it from an empty canvas with the classes of the person's ComfyUI,
 * and only then shows it in the chat as a card the person keeps or discards. Nothing is saved without the person.
 *
 * Who uses it: tools.ts adds it to the assistant's tool set; the chat's ToolCard draws the card from the draft id
 * this returns (src/renderer/components/lessons/LessonDraftCard.tsx).
 *
 * Why it answers with plain reasons: a draft that does not read or cannot be done goes back to the model with the
 * step and the cause, so it can correct the draft in the same turn; the person sees only drafts that work.
 */

import type Database from 'better-sqlite3';
import { jsonSchema } from 'ai';
import { carriesSecret } from '../../shared/config/draft';
import { LESSON_FILE_FORMAT, LESSON_FILE_VERSION, readLessonFile, type LessonDoc, type LessonFileProblem } from '../../shared/lessons/share/format';
import { checkLessonDoc } from '../../shared/lessons/share/mine';
import { lessonRuleText } from '../../shared/lessons/schema';
import { catalogShapes } from '../../shared/lessons/share/tryLesson';
import type { NodeClassDetail } from '../../shared/contracts';
import { validateNodeClass } from '../knowledge/nodeClassGuard';
import { lessonDrafts, type LessonDrafts } from '../lessons/drafts';
import { MAIN_TOOL_SPECS } from './toolSpecs';

/** What the tool needs from the turn; tests pass their own drafts store. */
export interface LessonDraftToolDeps {
  db: Database.Database;
  /** The catalog of the person's ComfyUI: a class with its inputs and outputs, or null. */
  nodeClassDetail: (db: Database.Database, classType: string) => NodeClassDetail | null;
  /** Aborted when the turn is cancelled: no draft is shown after that. */
  signal?: AbortSignal;
  /** The drafts waiting for the person; the app's one store by default. */
  drafts?: LessonDrafts;
}

/** A reason the reader gave, in a sentence the model can act on. */
export function problemForModel(problem: LessonFileProblem): string {
  switch (problem.code) {
    case 'invalid':
      return `The lesson does not follow the format at "${problem.at}"${problem.step ? ` (step "${problem.step}")` : ''}. Check the key names, the types and the length caps.`;
    case 'duplicate-step':
      return `Step id "${problem.step}" is used twice.`;
    case 'no-words':
      return 'The lesson needs texts in "en" or "ru" (or both).';
    case 'missing-words':
      return `Step "${problem.step}" has no title and body in texts.${problem.language}.steps.`;
    case 'unknown-role':
      return `Step "${problem.step}" names the role "${problem.role}" before any step brings it in "roles".`;
    case 'role-twice':
      return `Step "${problem.step}" brings the role "${problem.role}" a second time; bring each role once.`;
    case 'bad-range':
      return `In step "${problem.step}" the range of "${problem.field}" is empty or "prefer" lies outside it.`;
    case 'nothing-to-do':
      return 'Every step only explains; add steps that ask for nodes, links or field values.';
    case 'unknown-file-kind':
      return `Step "${problem.step}" asks for a kind of model file in "${problem.field}" the app does not list; use { "kind": "chosen" } instead.`;
    case 'rules':
      return `The lesson breaks a rule: ${lessonRuleText(problem.lesson, problem.rule)}`;
    default:
      return 'The lesson is not a valid lesson document.';
  }
}

/** Every text of a lesson in every language, to look for secrets in. */
function texts(doc: LessonDoc): string[] {
  return Object.values(doc.texts).flatMap((words) => (words ? [words.title, words.result, ...Object.values(words.steps).flatMap((step) => [step.title, step.body])] : []));
}

/** The draftLesson tool definition for the AI SDK: description, input schema and the checks above. */
export function createLessonDraftTool(deps: LessonDraftToolDeps) {
  const drafts = deps.drafts ?? lessonDrafts;
  const fail = (error: string) => ({ success: false, error });
  return {
    description: MAIN_TOOL_SPECS.draftLesson.description,
    inputSchema: jsonSchema(MAIN_TOOL_SPECS.draftLesson.parameters as Parameters<typeof jsonSchema>[0]),
    execute: async (args: unknown) => {
      if (deps.signal?.aborted) return fail('The turn was cancelled; no draft was shown.');
      const lesson = args && typeof args === 'object' ? (args as { lesson?: unknown }).lesson : undefined;
      // The lesson is wrapped as a one-lesson file, so it passes exactly the reader an imported file passes.
      const read = readLessonFile({ format: LESSON_FILE_FORMAT, version: LESSON_FILE_VERSION, lessons: [lesson] });
      if (!read.ok) return fail(problemForModel(read.problem));
      const doc = read.file.lessons[0];
      if (texts(doc).some((text) => carriesSecret({ text }))) return fail('A text of the lesson looks like it carries a secret; leave keys and tokens out.');
      // Every role must have a class this ComfyUI has, once its catalog is read: a lesson for what is installed.
      const classes = [...new Set(doc.steps.flatMap((step) => (step.roles ?? []).map((spec) => spec.classes)).map((list) => list.join('|')))];
      const details = new Map<string, NodeClassDetail | null>();
      let synced = true;
      for (const list of classes.map((item) => item.split('|'))) {
        const verdicts = list.map((classType) => ({ classType, verdict: validateNodeClass(deps.db, classType) }));
        // known === false: the catalog is not read yet, so nothing can be judged installed or missing.
        if (verdicts.some((item) => item.verdict.ok && item.verdict.known === false)) synced = false;
        if (synced && !verdicts.some((item) => item.verdict.ok)) {
          const first = verdicts[0];
          return fail(first && !first.verdict.ok ? first.verdict.error : `None of ${list.join(', ')} is installed.`);
        }
        for (const classType of list) details.set(classType, deps.nodeClassDetail(deps.db, classType));
      }
      // With the catalog the trial uses the real inputs and outputs; without it, only what the lesson itself says.
      const withCatalog = synced && [...details.values()].some((detail) => detail?.detailed);
      const shapes = withCatalog ? catalogShapes((classType) => (details.get(classType)?.detailed ? details.get(classType) : null)) : undefined;
      const check = checkLessonDoc(doc, () => null, shapes);
      if (!check.ok) {
        if ('problem' in check) return fail(problemForModel(check.problem));
        const missing = check.tried.missing ? ` What it lacks then: ${JSON.stringify(check.tried.missing).slice(0, 400)}.` : '';
        return fail(`Tried from an empty canvas, step "${check.tried.stepId}" cannot be done (${check.tried.why}).${missing} Fix that step and draft again.`);
      }
      // Checked again: the checks above can take a while, and the person may have cancelled meanwhile.
      if (deps.signal?.aborted) return fail('The turn was cancelled; no draft was shown.');
      const draft = drafts.add(doc, withCatalog ? 'catalog' : 'lesson');
      const words = doc.texts.en ?? doc.texts.ru!;
      return {
        success: true,
        message: 'The lesson draft is shown to the person as a card. It is kept in My lessons only if they accept it; nothing is saved now.',
        lessonDraftId: draft.id,
        title: words.title,
        steps: doc.steps.length,
        triedWith: draft.triedWith,
      };
    },
  };
}
