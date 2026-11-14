import { i18n } from '../i18n';
import { useProjectionStore } from '../services/commands/projection';
import { commitManual } from '../components/graph/commit';
import { afterRedo, afterUndo, describeRevision, planUndo, useUndoStore, type UndoPlan } from '../state/undoState';
import { canEditLevel } from './actions';

const t = (key: string, options?: Record<string, unknown>) => String(i18n.t(key, options ?? {}));

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

export function currentUndoPlan(): UndoPlan {
  const projection = useProjectionStore.getState();
  const undo = useUndoStore.getState();
  return planUndo(undo.revisions, projection.currentRevisionId || null, undo.session, {
    running: projection.activeRun?.status === 'running',
    activeRunId: projection.activeRun?.runId ?? null,
  });
}

/** Undo and redo work on every level: a change made inside a subgraph is one step of the same history. */
export function canUndo(): boolean {
  return canEditLevel() && !useUndoStore.getState().busy && currentUndoPlan().undo !== null;
}

export function canRedo(): boolean {
  return canEditLevel() && !useUndoStore.getState().busy && currentUndoPlan().redo !== null;
}

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

export function redoHint(): string {
  const plan = currentUndoPlan();
  if (plan.redo) {
    const what = describeRevision(plan.redo.redone);
    return t('toolbar.redoHint', { action: t(what.key, what.values) });
  }
  return t('toolbar.redoNone');
}

async function restore(kind: 'undo' | 'redo'): Promise<void> {
  const plan = currentUndoPlan();
  const step = kind === 'undo' ? plan.undo : plan.redo;
  const store = useUndoStore.getState();
  const previousHead = useProjectionStore.getState().currentRevisionId;
  if (!step || store.busy || !plan.pointer) return;
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

export function undo(): Promise<void> {
  return restore('undo');
}

export function redo(): Promise<void> {
  return restore('redo');
}
