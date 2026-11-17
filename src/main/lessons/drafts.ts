/**
 * Lesson drafts of the assistant, waiting for the person. The draftLesson tool puts a checked draft here and the
 * chat shows it as a card; the person accepts it (it becomes one of "My lessons") or rejects it (it is gone).
 * Chat-history preferences control draft storage; accepting it separately adds it to My lessons.
 *
 * Who uses it: the assistant's draftLesson tool (src/main/agent/lessonDraftTool.ts) and the lessons IPC.
 *
 * Pending drafts survive a restart but stay separate from My lessons until explicitly accepted.
 * The most recent 20 drafts per project are kept; clearing the chat also clears its pending drafts.
 */

import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { LESSON_FILE_FORMAT, LESSON_FILE_VERSION, readLessonFile, type LessonDoc } from '../../shared/lessons/share/format';
import type { LessonDraft } from '../../shared/lessons/share/mine';
import { carriesSecret } from '../../shared/config/draft';
import { DraftStore } from '../agent/draftStore';

/** Drafts kept at once; the oldest goes first when a new one comes. */
const MAX_DRAFTS = 20;

function readDraft(value: unknown): LessonDraft | null {
  if (!value || typeof value !== 'object') return null;
  const draft = value as LessonDraft;
  if (typeof draft.id !== 'string' || !draft.id || draft.id.length > 64 || !Number.isFinite(draft.createdAt)
    || !['catalog', 'lesson'].includes(draft.triedWith) || carriesSecret(draft.doc)) return null;
  const read = readLessonFile({ format: LESSON_FILE_FORMAT, version: LESSON_FILE_VERSION, lessons: [draft.doc] });
  return read.ok ? { id: draft.id, createdAt: draft.createdAt, triedWith: draft.triedWith, doc: read.file.lessons[0] } : null;
}

/** The pending lessons; production attaches the profile database before registering IPC. */
export class LessonDrafts {
  private readonly drafts = new DraftStore<LessonDraft>('lesson', MAX_DRAFTS, readDraft);

  attach(db: Database.Database, mayPersist?: () => boolean, containsHeldSecret?: (text: string) => boolean): void { this.drafts.attach(db, mayPersist, containsHeldSecret); }
  clearMemory(projectId: string): void { this.drafts.clearMemory(projectId); }

  /** Keeps a new draft under a fresh id and returns it. */
  add(doc: LessonDoc, triedWith: LessonDraft['triedWith'], now = Date.now(), projectId?: string): LessonDraft {
    const draft: LessonDraft = { id: randomUUID(), doc, createdAt: now, triedWith };
    return this.drafts.put(draft, projectId);
  }

  /** Keeps a draft as it is (also one put back after a failed accept), dropping the oldest past the cap. */
  put(draft: LessonDraft, projectId?: string): void { this.drafts.put(draft, projectId); }

  get(id: string): LessonDraft | null {
    return this.drafts.get(id);
  }

  /** Takes a draft out (accepted or rejected); null when it is not here. */
  take(id: string): LessonDraft | null {
    const draft = this.drafts.get(id);
    this.drafts.remove(id);
    return draft;
  }
}

/** The one store of the app; tests give the draft tool their own LessonDrafts. */
export const lessonDrafts = new LessonDrafts();
