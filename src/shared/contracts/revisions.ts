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
}

export interface LoadRevisionRequest {
  projectId: string;
  revisionId: string;
}

/** The snapshot of one revision, in the shape readProjection returns for the current one. */
export type RevisionSnapshot = Projection['snapshot'];

/** graph:list-revisions returns at most this many rows, oldest first. */
export const REVISION_LIST_LIMIT = 2000;
