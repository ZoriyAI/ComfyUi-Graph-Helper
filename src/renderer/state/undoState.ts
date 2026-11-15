/**
 * Undo and redo over the engine's revision history. Nothing is rewound: undo commits `restore-revision` with
 * the revision before the current state, redo commits `restore-revision` with the state the undo left.
 *
 * The pure part (planUndo, afterUndo, afterRedo) works on the revision list alone:
 * - the *pointer* is the revision whose content is on the canvas. A restore commit points at what it
 *   restored (followed through chains of restores), every other revision points at itself;
 * - undo restores the pointer's parent (again followed through restores), so a restore commit is never
 *   itself the step that is undone;
 * - the person's own revisions are undone one by one; the helper's contiguous revisions from one run are undone
 *   as one step (manual edits and other runs form boundaries, and redo restores that interval), and nothing while
 *   a run is still open;
 * - redo is a stack kept for this session. It holds while the head is the revision the last undo or redo
 *   made; any other commit (a new manual edit, an agent step) clears it.
 *
 * Who uses it: commands/undo.ts (the Edit menu), commands/appCommands.ts (state source) and
 * components/graph/lib/replay.ts (names of revisions in History replay).
 */
import { create } from 'zustand';
import type { RevisionSummary } from '../../shared/contracts/revisions';

/** The fields of a revision summary the undo plan reads. */
export type UndoRevision = Pick<RevisionSummary, 'id' | 'revSeq' | 'source'> & Partial<Pick<RevisionSummary, 'description' | 'actor' | 'payload' | 'restoredRevisionId' | 'runId'>>;

/** The redo state of this window session. */
export interface UndoSession {
  /** Revision ids to restore on redo; the last one is next. */
  redo: string[];
  /** The head the last undo or redo produced. The redo stack only holds while this is still the head. */
  expectedHead: string | null;
}

/** No redo available. */
export const EMPTY_SESSION: UndoSession = { redo: [], expectedHead: null };

/** running: a helper run is still open; too-old: the version before a build is no longer kept (bounded history). */
export type UndoBlock = 'none' | 'running' | 'too-old';

/** What Undo and Redo would restore now, from planUndo. */
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

/** A revision made by an undo or redo (a restore commit). */
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

/** True when the person (not the assistant, not the system) made this revision. */
export function isOwnRevision(revision: UndoRevision): boolean {
  if (revision.actor) return revision.actor === 'manual';
  return revision.source === 'user';
}

/** The helper's run a revision belongs to, or null for the person's own change. */
function helperRun(revision: UndoRevision | undefined): string | null {
  if (!revision || isOwnRevision(revision) || isRestore(revision)) return null;
  return revision.runId ?? null;
}

/**
 * Undo of a helper's revision: the revision before its contiguous interval in the same run. Stop at every
 * manual edit, restore or different run so the restored snapshot preserves interleaved work.
 */
function runUndo(revisions: readonly UndoRevision[], byId: Map<string, UndoRevision>, at: number, runId: string, pointer: string): UndoPlan['undo'] {
  let first = at;
  let steps = 0;
  for (let index = at; index >= 0; index -= 1) {
    const revision = revisions[index];
    if (helperRun(revision) !== runId) break;
    first = index;
    steps += 1;
  }
  if (first === 0) return null;
  const target = logicalRevision(byId, revisions[first - 1].id);
  if (!byId.has(target) || target === pointer) return null;
  const undone: UndoRevision = { ...byId.get(pointer)!, description: 'agent-run', payload: { type: 'agent-run', count: steps } };
  return { target, undone };
}

/**
 * What Undo and Redo would do now. `revisions` is oldest first (listRevisions order). `activeRunId` is the
 * helper's open run (running or paused), whose steps are not undone while it is open.
 */
export function planUndo(
  revisions: readonly UndoRevision[],
  headId: string | null,
  session: UndoSession,
  options: { running: boolean; activeRunId?: string | null },
): UndoPlan {
  const byId = new Map(revisions.map((revision) => [revision.id, revision]));
  const index = new Map(revisions.map((revision, at) => [revision.id, at]));
  if (!headId || !byId.has(headId)) return { pointer: null, undo: null, redo: null, blocked: 'none' };
  const pointer = logicalRevision(byId, headId);
  const pointed = byId.get(pointer);
  const at = index.get(pointer);
  let undo: UndoPlan['undo'] = null;
  let blocked: UndoBlock = 'none';
  const run = helperRun(pointed);
  if (pointed && at !== undefined && at > 0) {
    if (options.running || (run && run === options.activeRunId)) blocked = 'running';
    else if (run) {
      undo = runUndo(revisions, byId, at, run, pointer);
      // The history keeps a limited number of versions: the one before this build may be gone. Say so plainly.
      if (!undo) blocked = 'too-old';
    }
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

/** Command type of a revision → the i18n key that names it in the Undo and Redo hints. */
const ACTION_KEYS: Record<string, string> = {
  'add-node': 'undo.addNode',
  'remove-node': 'undo.removeNode',
  'remove-selection': 'undo.removeSelection',
  'paste-selection': 'undo.pasteSelection',
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
  'configure-subgraph': 'undo.createSubgraph',
  'insert-subgraph': 'undo.insertSubgraph',
  'dissolve-subgraph': 'undo.dissolveSubgraph',
  'rename-subgraph': 'undo.renameSubgraph',
  'add-subgraph-io': 'undo.addSubgraphIo',
  'remove-subgraph-io': 'undo.removeSubgraphIo',
  'add-group': 'undo.addGroup',
  'remove-group': 'undo.removeGroup',
  'rename-group': 'undo.renameGroup',
  'rename-node': 'undo.renameNode',
  'collapse-node': 'undo.collapseNode',
  'rename-subgraph-io': 'undo.renameSubgraphIo',
  'edit-in-subgraph': 'undo.editInSubgraph',
  // Editing commands (main/commands/editOps.ts).
  'set-node-mode': 'undo.setNodeMode',
  'set-note-text': 'undo.setNoteText',
  'insert-node-on-edge': 'undo.insertNodeOnEdge',
  'replace-node': 'undo.replaceNode',
  'set-node-color': 'undo.setNodeColor',
  'set-group-color': 'undo.setGroupColor',
  'set-group-members': 'undo.setGroupMembers',
  'agent-run': 'undo.agentRun',
};

/** A payload value as short text for a hint ('?' when missing). */
function text(value: unknown): string {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value.slice(0, 80) : '?';
}

/** "connect 2 → 4": the i18n key and values that name what a revision changed. */
export function describeRevision(revision: UndoRevision): { key: string; values: Record<string, string> } {
  const payload = revision.payload ?? {};
  const type = typeof payload.type === 'string' ? payload.type : revision.description ?? '';
  if (type === 'batch') {
    // Several edits as one step: named by what the person did (delete, paste, duplicate, cut, move) and how many.
    const label = typeof payload.label === 'string' ? payload.label : 'move';
    // The revision list keeps a batch as its label and counts (shared/agent/recentActions.ts).
    const all = typeof payload.count === 'number' ? payload.count : 0;
    const nodes = typeof payload.nodes === 'number' ? payload.nodes : 0;
    const count = label === 'delete' || label === 'move' ? all : nodes;
    const keyOf: Record<string, string> = { delete: 'undo.batchDelete', paste: 'undo.batchPaste', duplicate: 'undo.batchDuplicate', cut: 'undo.batchCut', move: 'undo.batchMove', 'add-linked': 'undo.batchAddLinked', subgraph: 'undo.createSubgraph' };
    return { key: keyOf[label] ?? 'undo.batchMove', values: { count: String(count || all) } };
  }
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

/** The revision list of the project on screen, the redo session and whether a restore is in flight. */
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

/** Undo state; a revision list of another project starts a fresh session (no redo across projects). */
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
