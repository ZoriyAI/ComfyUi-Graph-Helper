/**
 * Edits the person started that have not landed yet: an add waiting for the node's size, an import waiting for the
 * file dialog, a commit on its way to main. Undo and redo wait for them, so Ctrl+Z right after an action undoes that
 * action and not the one before it (an undo planned on the old head would restore a revision from before the edit
 * and silently drop it).
 */
let pending = 0;
let waiters: Array<() => void> = [];

function settle(): void {
  pending = Math.max(0, pending - 1);
  if (pending > 0) return;
  const ready = waiters;
  waiters = [];
  for (const resolve of ready) resolve();
}

/** Counts `work` as landing from now until it settles. Call it synchronously when the action starts. */
export function trackCommit<T>(work: () => Promise<T>): Promise<T> {
  pending += 1;
  let promise: Promise<T>;
  try {
    promise = work();
  } catch (error) {
    settle();
    return Promise.reject(error);
  }
  return promise.finally(settle);
}

/** Resolves once nothing is landing. */
export function whenSettled(): Promise<void> {
  if (pending === 0) return Promise.resolve();
  return new Promise((resolve) => waiters.push(resolve));
}

export function pendingCommits(): number {
  return pending;
}
