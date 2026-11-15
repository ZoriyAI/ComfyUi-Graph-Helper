/**
 * Lesson drafts of the assistant, waiting for the person. The draftLesson tool puts a checked draft here and the
 * chat shows it as a card; the person accepts it (it becomes one of "My lessons") or rejects it (it is gone).
 * Nothing is written to the profile before the person says so, the same rule as grey drafts on the canvas.
 *
 * Who uses it: the assistant's draftLesson tool (src/main/agent/lessonDraftTool.ts) and the lessons IPC.
 *
 * Why in memory only: a draft is a proposal of one conversation. After a restart its card says it is no longer
 * available, and the person asks again. A small cap keeps a long conversation from piling them up.
 */

import { randomUUID } from 'crypto';
import type { LessonDoc } from '../../shared/lessons/files/format';
import type { LessonDraft } from '../../shared/lessons/files/mine';

const MAX_DRAFTS = 20;

/** The drafts of this run of the app, oldest first. */
export class LessonDrafts {
  private readonly drafts = new Map<string, LessonDraft>();

  add(doc: LessonDoc, triedWith: LessonDraft['triedWith'], now = Date.now()): LessonDraft {
    const draft: LessonDraft = { id: randomUUID(), doc, createdAt: now, triedWith };
    this.put(draft);
    return draft;
  }

  put(draft: LessonDraft): void {
    this.drafts.set(draft.id, draft);
    while (this.drafts.size > MAX_DRAFTS) this.drafts.delete(this.drafts.keys().next().value as string);
  }

  get(id: string): LessonDraft | null {
    return this.drafts.get(id) ?? null;
  }

  /** Takes a draft out (accepted or rejected); null when it is not here. */
  take(id: string): LessonDraft | null {
    const draft = this.drafts.get(id) ?? null;
    this.drafts.delete(id);
    return draft;
  }
}

export const lessonDrafts = new LessonDrafts();
