/**
 * The revision history of a project as the renderer reads it: the list behind Undo, Redo and the replay player
 * (renderer/state/undoState.ts, components/graph/lib/replay.ts) and the snapshot of one revision. Main keeps the
 * revisions (main/commands/history.ts, commit.ts) and answers over engineIpc.ts.
 */
import type { Projection } from '../commands/types';

/** One row of a project's revision history, for the "replay how the graph grew" player. */
export interface RevisionSummary {
  id: string;
  revSeq: number;
  timestamp: number;
  /** The mutation type that produced the revision ('Initial' for the first one). */
  description: string | null;
  /** 'system' | 'user' | 'ai'. */
  source: string;
  /** Who committed it ('manual' or 'ai'); null for the initial revision. */
  actor?: 'ai' | 'manual' | null;
  /** The mutation payload without bulky fields (an imported workflow keeps only its type); null when unknown. */
  payload?: Record<string, unknown> | null;
  /** For a restore-revision commit: the revision whose snapshot it copied. */
  restoredRevisionId?: string | null;
  /** The helper's run that made it (actor 'ai'); null for the person's own changes. */
  runId?: string | null;
}

/** Which revision's snapshot to load. */
export interface LoadRevisionRequest {
  projectId: string;
  revisionId: string;
}

/** The snapshot of one revision, in the shape readProjection returns for the current one. */
export type RevisionSnapshot = Projection['snapshot'];

/** graph:list-revisions returns at most this many rows, oldest first. */
export const REVISION_LIST_LIMIT = 2000;
