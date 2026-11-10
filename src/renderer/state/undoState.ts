import { create } from 'zustand';
import type { RevisionSummary } from '../../shared/contracts/revisions';

/**
 * Undo and redo over the engine's revision history. Nothing is rewound: undo commits `restore-revision` with
 * the revision before the current state, redo commits `restore-revision` with the state the undo left.
 *
 * The pure part (planUndo, afterUndo, afterRedo) works on the revision list alone:
 * - the *pointer* is the revision whose content is on the canvas. A restore commit points at what it
 *   restored (followed through chains of restores), every other revision points at itself;
 * - undo restores the pointer's parent (again followed through restores), so a restore commit is never
 *   itself the step that is undone;
 * - only the person's own revisions are undone, and never while an agent run is running;
 * - redo is a stack kept for this session. It holds while the head is the revision the last undo or redo
 *   made; any other commit (a new manual edit, an agent step) clears it.
 */

export type UndoRevision = Pick<RevisionSummary, 'id' | 'revSeq' | 'source'> & Partial<Pick<RevisionSummary, 'description' | 'actor' | 'payload' | 'restoredRevisionId'>>;

export interface UndoSession {
  /** Revision ids to restore on redo; the last one is next. */
  redo: string[];
  /** The head the last undo or redo produced. The redo stack only holds while this is still the head. */
  expectedHead: string | null;
}

export const EMPTY_SESSION: UndoSession = { redo: [], expectedHead: null };

export type UndoBlock = 'none' | 'running' | 'assistant';

export interface UndoPlan {
  /** The revision whose content is current. */
  pointer: string | null;
  /** Undo: the revision to restore, and the revision whose change it takes back. */
  undo: { target: string; undone: UndoRevision } | null;
  /** Redo: the revision to restore (it is also the change that comes back). */
  redo: { target: string; redone: UndoRevision } | null;
  /** Why undo is off while there is something before the pointer. */
  blocked: UndoBlock;
}

function isRestore(revision: UndoRevision): boolean {
  return revision.description === 'restore-revision' || Boolean(revision.restoredRevisionId);
}

/** The revision whose content `id` holds: itself, or what its restore commit copied (through chains). */
export function logicalRevision(byId: Map<string, UndoRevision>, id: string): string {
  let current = id;
  const seen = new Set<string>();
  for (;;) {
    const revision = byId.get(current);
    if (!revision || !isRestore(revision) || !revision.restoredRevisionId || seen.has(current)) return current;
    seen.add(current);
    current = revision.restoredRevisionId;
  }
}

/**
 * True when Undo may take this revision back: the person made it, or it only arranged nodes (the helper's tidy
 * after a build moves positions and nothing else, so taking it back cannot lose the helper's work).
 */
export function isUndoable(revision: UndoRevision): boolean {
  return isOwnRevision(revision) || (revision.payload?.type ?? revision.description) === 'move-nodes';
}

/** True when the person (not the assistant, not the system) made this revision. */
export function isOwnRevision(revision: UndoRevision): boolean {
  if (revision.actor) return revision.actor === 'manual';
  return revision.source === 'user';
}

/** What Undo and Redo would do now. `revisions` is oldest first (listRevisions order). */
export function planUndo(
  revisions: readonly UndoRevision[],
  headId: string | null,
  session: UndoSession,
  options: { running: boolean },
): UndoPlan {
  const byId = new Map(revisions.map((revision) => [revision.id, revision]));
  const index = new Map(revisions.map((revision, at) => [revision.id, at]));
  if (!headId || !byId.has(headId)) return { pointer: null, undo: null, redo: null, blocked: 'none' };
  const pointer = logicalRevision(byId, headId);
  const pointed = byId.get(pointer);
  const at = index.get(pointer);
  let undo: UndoPlan['undo'] = null;
  let blocked: UndoBlock = 'none';
  if (pointed && at !== undefined && at > 0) {
    if (!isUndoable(pointed)) blocked = 'assistant';
    else if (options.running) blocked = 'running';
    else {
      const target = logicalRevision(byId, revisions[at - 1].id);
      if (byId.has(target) && target !== pointer) undo = { target, undone: pointed };
    }
  }
  let redo: UndoPlan['redo'] = null;
  const stack = session.expectedHead === headId ? session.redo : [];
  const next = stack[stack.length - 1];
  const redone = next ? byId.get(next) : undefined;
  if (redone && !options.running) redo = { target: redone.id, redone };
  return { pointer, undo, redo, blocked };
}

/** The session after an undo from `pointer` produced `newHead`. */
export function afterUndo(session: UndoSession, previousHead: string, pointer: string, newHead: string): UndoSession {
  const kept = session.expectedHead === previousHead ? session.redo : [];
  return { redo: [...kept, pointer], expectedHead: newHead };
}

/** The session after a redo produced `newHead`. */
export function afterRedo(session: UndoSession, previousHead: string, newHead: string): UndoSession {
  const kept = session.expectedHead === previousHead ? session.redo : [];
  return { redo: kept.slice(0, -1), expectedHead: newHead };
}

const ACTION_KEYS: Record<string, string> = {
  'add-node': 'undo.addNode',
  'remove-node': 'undo.removeNode',
  'move-node': 'undo.moveNode',
  'move-nodes': 'undo.moveNodes',
  connect: 'undo.connect',
  'remove-edge': 'undo.removeEdge',
  'retarget-edge': 'undo.retargetEdge',
  'set-parameter': 'undo.setParameter',
  'annotate-node': 'undo.annotateNode',
  'import-workflow': 'undo.importWorkflow',
  'open-native': 'undo.openNative',
  'set-component': 'undo.setComponent',
  'set-process': 'undo.setProcess',
  'create-subgraph': 'undo.createSubgraph',
  'insert-subgraph': 'undo.insertSubgraph',
  'dissolve-subgraph': 'undo.dissolveSubgraph',
  'rename-subgraph': 'undo.renameSubgraph',
  'add-subgraph-io': 'undo.addSubgraphIo',
  'remove-subgraph-io': 'undo.removeSubgraphIo',
  'add-group': 'undo.addGroup',
  'remove-group': 'undo.removeGroup',
};

function text(value: unknown): string {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value.slice(0, 80) : '?';
}

/** "connect 2 → 4": the i18n key and values that name what a revision changed. */
export function describeRevision(revision: UndoRevision): { key: string; values: Record<string, string> } {
  const payload = revision.payload ?? {};
  const type = typeof payload.type === 'string' ? payload.type : revision.description ?? '';
  const key = ACTION_KEYS[type];
  if (!key) return { key: 'undo.other', values: { type: type || '?' } };
  return {
    key,
    values: {
      type: text(payload.nodeType),
      node: text(payload.nodeId),
      source: text(payload.source),
      target: text(payload.target),
      key: text(payload.key),
      owner: text(payload.ownerId),
      count: text(payload.count),
    },
  };
}

interface UndoState {
  projectId: string | null;
  revisions: UndoRevision[];
  session: UndoSession;
  /** An undo or redo commit is in flight. */
  busy: boolean;
  setRevisions: (projectId: string, revisions: UndoRevision[]) => void;
  setSession: (session: UndoSession) => void;
  setBusy: (busy: boolean) => void;
}

export const useUndoStore = create<UndoState>((set, get) => ({
  projectId: null,
  revisions: [],
  session: EMPTY_SESSION,
  busy: false,
  setRevisions: (projectId, revisions) => set(get().projectId === projectId
    ? { revisions }
    : { projectId, revisions, session: EMPTY_SESSION }),
  setSession: (session) => set({ session }),
  setBusy: (busy) => set({ busy }),
}));
