/**
 * Edit ▸ Undo and Redo: the plan over the revision history, the hints in menus, and the queue of presses.
 *
 * Who uses it: appCommands.ts (the edit.undo and edit.redo commands, and installUndoHistory at start).
 * Why it is shaped so: every change is a revision in main, so undo is a commit that restores an older revision;
 * presses are queued until edits in flight have landed, so a quick series never skips or repeats a step.
 */
import { i18n } from '../i18n';
import { useProjectionStore } from '../services/commands/projection';
import { commitManual } from '../components/graph/commit';
import { afterRedo, afterUndo, describeRevision, planUndo, useUndoStore, type UndoPlan } from '../state/undoState';
import { canEditLevel } from './actions';
import { pendingCommits, whenSettled } from '../services/commands/pending';

const t = (key: string, options?: Record<string, unknown>) => String(i18n.t(key, options ?? {}));

/** Counts revision-list reads; only the answer of the newest read is kept. */
let refreshSeq = 0;

/** Re-reads the revision list (newest answer wins). */
export async function refreshUndoHistory(): Promise<void> {
  const bridge = window.electronAPI;
  if (!bridge?.listRevisions) return;
  const projectId = useProjectionStore.getState().projectId;
  const seq = ++refreshSeq;
  const revisions = await bridge.listRevisions(projectId).catch(() => null);
  if (!revisions || seq !== refreshSeq) return;
  useUndoStore.getState().setRevisions(projectId, revisions);
}

/** Keeps the revision list in step with the head the canvas shows. Returns the unsubscribe. */
export function installUndoHistory(): () => void {
  let head = useProjectionStore.getState().currentRevisionId;
  if (head) void refreshUndoHistory();
  return useProjectionStore.subscribe((state) => {
    if (state.currentRevisionId === head) return;
    head = state.currentRevisionId;
    void refreshUndoHistory();
  });
}

/** What Undo and Redo would do now (state/undoState.ts planUndo), from the history and the run on screen. */
export function currentUndoPlan(): UndoPlan {
  const projection = useProjectionStore.getState();
  const undo = useUndoStore.getState();
  return planUndo(undo.revisions, projection.currentRevisionId || null, undo.session, {
    running: projection.activeRun?.status === 'running',
    activeRunId: projection.activeRun?.runId ?? null,
  });
}

/**
 * True while an undo is running or an edit is still landing. Undo and redo stay enabled then: a press is kept
 * (queued below), not dropped, and the plan is made once the history has caught up, so each press steps back one
 * revision. Undo and redo work on every level: a change made inside a subgraph is one step of the same history.
 */
function settling(): boolean {
  const head = useProjectionStore.getState().currentRevisionId;
  const store = useUndoStore.getState();
  // An edit that just landed: the head is new and the revision list has not been read again yet.
  const behind = Boolean(head) && !store.revisions.some((revision) => revision.id === head);
  return store.busy || pendingCommits() > 0 || behind;
}

export function canUndo(): boolean {
  return canEditLevel() && (settling() || currentUndoPlan().undo !== null);
}

export function canRedo(): boolean {
  return canEditLevel() && (settling() || currentUndoPlan().redo !== null);
}

/** The live tooltip of Undo: what it would undo, or why it cannot. */
export function undoHint(): string {
  const plan = currentUndoPlan();
  if (plan.undo) {
    const what = describeRevision(plan.undo.undone);
    return t('toolbar.undoHint', { action: t(what.key, what.values) });
  }
  if (plan.blocked === 'running') return t('toolbar.undoRunning');
  if (plan.blocked === 'too-old') return t('toolbar.undoTooOld');
  return t('toolbar.undoNone');
}

/** The live tooltip of Redo. */
export function redoHint(): string {
  const plan = currentUndoPlan();
  if (plan.redo) {
    const what = describeRevision(plan.redo.redone);
    return t('toolbar.redoHint', { action: t(what.key, what.values) });
  }
  return t('toolbar.redoNone');
}

/**
 * Commits a restore of the revision the plan names, then moves the undo session pointer so that Redo can find
 * the way back. The head is read before the commit because the session records the step from it.
 */
async function restore(kind: 'undo' | 'redo'): Promise<void> {
  const plan = currentUndoPlan();
  const step = kind === 'undo' ? plan.undo : plan.redo;
  const store = useUndoStore.getState();
  const previousHead = useProjectionStore.getState().currentRevisionId;
  if (!step || !plan.pointer) return;
  store.setBusy(true);
  try {
    const result = await commitManual({ type: 'restore-revision', revisionId: step.target }, kind) as
      | { status?: string; projection?: { currentRevisionId?: string } | null }
      | null;
    const newHead = result?.status === 'applied' ? result.projection?.currentRevisionId : undefined;
    if (newHead) {
      const session = useUndoStore.getState().session;
      useUndoStore.getState().setSession(kind === 'undo'
        ? afterUndo(session, previousHead, plan.pointer, newHead)
        : afterRedo(session, previousHead, newHead));
    }
  } finally {
    useUndoStore.getState().setBusy(false);
    await refreshUndoHistory();
  }
}

/**
 * Reads the revision list until it holds the head on screen. Another read started meanwhile (the projection
 * watcher) wins over this one, so a single read may leave the list a step behind.
 */
async function historyCaughtUp(): Promise<void> {
  // A few reads are enough in practice; after them the plan is made from what the list holds.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await refreshUndoHistory();
    const head = useProjectionStore.getState().currentRevisionId;
    if (!head || useUndoStore.getState().revisions.some((revision) => revision.id === head)) return;
  }
}

/**
 * Undo and redo run one after another, each once every edit the person started has landed (services/commands/
 * pending.ts): Ctrl+Z pressed while an add or an import is still on its way undoes that edit, and a quick series
 * of presses steps back one revision per press.
 */
let queue: Promise<void> = Promise.resolve();

function queued(kind: 'undo' | 'redo'): Promise<void> {
  const run = queue.then(async () => {
    // A new gesture can start while history is being read. Do not enqueue a restore planned on the old
    // head behind that edit: it would silently undo both. Check again after the last await, then enqueue
    // the restore synchronously, before another gesture can enter the manual commit queue.
    do {
      await whenSettled();
      await historyCaughtUp();
    } while (pendingCommits() > 0);
    await restore(kind);
  });
  queue = run.catch(() => undefined);
  return run;
}

export function undo(): Promise<void> {
  return queued('undo');
}

export function redo(): Promise<void> {
  return queued('redo');
}
